import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { Withdrawal, WithdrawalStatus } from './entities/withdrawal.entity';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { SellerService } from 'src/seller/seller.service';
import { PaymentGatewayFactory } from 'src/payment-gateways/factories/payment-gateway.factory';
import { PaymentMethod } from 'src/orders/entities/order.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    @InjectRepository(Withdrawal) private withdrawalRepo: Repository<Withdrawal>,

    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly sellerService: SellerService,
    private dataSource: DataSource,
  ) {}

  async getWalletData(userId: string) {
    let wallet = await this.walletRepo.findOne({
      where: { seller: { user: { id: userId } } },
      relations: ['seller'],
    });

    if (!wallet) {
      const seller = await this.sellerService.getMyStore(userId);
      wallet = this.walletRepo.create({
        seller,
        availableBalance: 0,
        pendingBalance: 0,
      });
      await this.walletRepo.save(wallet);
    }

    return wallet;
  }

  async getTransactions(userId: string) {
    return this.txRepo.find({
      where: { seller: { user: { id: userId } } },
      order: { createdAt: 'DESC' },
    });
  }

  async requestWithdrawal(userId: string, dto: CreateWithdrawalDto) {
    const wallet = await this.getWalletData(userId);
    const amount = Number(dto.amount);

    if (Number(wallet.availableBalance) < amount) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${wallet.availableBalance}`
      );
    }

    // ✅ Validate the bank account belongs to this seller AND
    // has a recipient code for the requested gateway
    const bank = await this.dataSource.getRepository('SellerBank').findOne({
      where: { id: dto.bankAccountId, seller: { id: wallet.seller.id } },
    });

    if (!bank) throw new NotFoundException('Bank account not found');

    const requestedMethod = dto.paymentMethod ?? PaymentMethod.PAYSTACK;

    // ✅ Check that the bank has a recipient code for this gateway
    const recipientCode = requestedMethod === PaymentMethod.FLUTTERWAVE
      ? bank.flutterwaveRecipientCode
      : bank.paystackRecipientCode;

    if (!recipientCode) {
      throw new BadRequestException(
        `This bank account is not registered for ${requestedMethod} payouts`
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Atomic debit — prevents race conditions
      await queryRunner.manager
        .createQueryBuilder()
        .update(Wallet)
        .set({ availableBalance: () => `availableBalance - ${amount}` })
        .where('id = :id AND availableBalance >= :amount', { id: wallet.id, amount })
        .execute();

      // ✅ Save gateway method on the withdrawal record
      const withdrawal = await queryRunner.manager.save(Withdrawal, {
        amount,
        seller: wallet.seller,
        bankAccount: { id: dto.bankAccountId },
        paymentMethod: requestedMethod,
        status: WithdrawalStatus.PENDING,
      });

      await queryRunner.manager.save(Transaction, {
        amount: -amount,
        type: TransactionType.WITHDRAWAL,
        status: 'pending',
        seller: wallet.seller,
        reference: withdrawal.id,
      });

      await queryRunner.commitTransaction();
      return withdrawal;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async addPendingFunds(sellerId: string, amount: number, orderId: string) {
    const wallet = await this.getOrCreateWallet(sellerId);

    await this.walletRepo.increment({ id: wallet.id }, 'pendingBalance', amount);

    const newTransaction = this.txRepo.create({
      amount,
      type: TransactionType.SALE_REVENUE,
      status: 'pending',
      seller: { id: sellerId } as any,
      reference: orderId,
    });

    return await this.txRepo.save(newTransaction);
  }

  async releaseEscrow(sellerId: string, amount: number, orderId: string) {
    const wallet = await this.getOrCreateWallet(sellerId);

    if (Number(wallet.pendingBalance) < amount) {
      throw new BadRequestException('Insufficient pending funds to release');
    }

    await this.walletRepo.decrement({ id: wallet.id }, 'pendingBalance', amount);
    await this.walletRepo.increment({ id: wallet.id }, 'availableBalance', amount);

    const transaction = await this.txRepo.findOneBy({ reference: orderId });
    if (transaction) {
      transaction.status = 'completed';
      await this.txRepo.save(transaction);
    }
  }

  async processWithdrawal(withdrawalId: string) {
    const withdrawal = await this.withdrawalRepo.findOne({
      where: { id: withdrawalId },
      relations: ['seller', 'bankAccount'],
    });

    if (!withdrawal) throw new NotFoundException('Request not found');
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('Already processed');
    }

    // ✅ Pick the right gateway based on what was saved at request time
    const gateway = this.gatewayFactory.getGateway(
      withdrawal.paymentMethod ?? PaymentMethod.PAYSTACK
    );

    // ✅ Pick the right recipient code for this gateway
    const recipientCode = withdrawal.paymentMethod === PaymentMethod.FLUTTERWAVE
      ? withdrawal.bankAccount.flutterwaveRecipientCode
      : withdrawal.bankAccount.paystackRecipientCode;

    if (!recipientCode) {
      withdrawal.status = WithdrawalStatus.FAILED;
      await this.withdrawalRepo.save(withdrawal);
      throw new BadRequestException(
        `No ${withdrawal.paymentMethod} recipient code found for this bank account`
      );
    }

    try {
      const transfer = await gateway.createTransfer(
        withdrawal.amount,
        recipientCode,
        `Payout: ${withdrawal.id.slice(0, 8)}`,
      );

      // ✅ Gateway-agnostic field name
      withdrawal.status = WithdrawalStatus.PROCESSED;
      withdrawal.gatewayTransferCode = transfer.transfer_code ?? transfer.data?.id;
      await this.withdrawalRepo.save(withdrawal);

      await this.txRepo.update(
        { reference: withdrawal.id },
        { status: 'completed' }
      );

      return { success: true, transferCode: withdrawal.gatewayTransferCode };
    } catch (error) {
      withdrawal.status = WithdrawalStatus.FAILED;
      await this.withdrawalRepo.save(withdrawal);
      throw new BadRequestException('Transfer failed: ' + error.message);
    }
  }

  private async getOrCreateWallet(sellerId: string) {
    let wallet = await this.walletRepo.findOne({
      where: { seller: { id: sellerId } },
    });

    if (!wallet) {
      wallet = await this.walletRepo.save(
        this.walletRepo.create({
          seller: { id: sellerId } as any,
          availableBalance: 0,
          pendingBalance: 0,
        })
      );
    }

    return wallet;
  }

  async findAllWithdrawals(status?: WithdrawalStatus) {
    return this.withdrawalRepo.find({
      where: status ? { status } : {},
      relations: ['seller', 'bankAccount'],
      order: { createdAt: 'DESC' },
    });
  }
}
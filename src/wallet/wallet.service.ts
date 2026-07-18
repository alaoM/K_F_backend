import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { Withdrawal, WithdrawalStatus } from './entities/withdrawal.entity';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { SellerService } from 'src/seller/seller.service';
import { PaymentGatewayFactory } from 'src/payment-gateways/factories/payment-gateway.factory';
import { PaymentMethod } from 'src/orders/entities/order.entity';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

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
      const updateResult = await queryRunner.manager
        .createQueryBuilder()
        .update(Wallet)
        .set({ availableBalance: () => `availableBalance - ${amount}` })
        .where('id = :id AND availableBalance >= :amount', { id: wallet.id, amount })
        .execute();

      if (!updateResult.affected || updateResult.affected === 0) {
        throw new BadRequestException('Insufficient balance or concurrent withdrawal request.');
      }

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

  async releaseEscrow(sellerId: string, amount: number, orderId: string, manager?: EntityManager) {
    const wallet = await this.getOrCreateWallet(sellerId, manager);

    if (Number(wallet.pendingBalance) < amount) {
      throw new BadRequestException('Insufficient pending funds to release');
    }

    const walletRepo = manager ? manager.getRepository(Wallet) : this.walletRepo;
    const txRepo = manager ? manager.getRepository(Transaction) : this.txRepo;

    await walletRepo.decrement({ id: wallet.id }, 'pendingBalance', amount);
    await walletRepo.increment({ id: wallet.id }, 'availableBalance', amount);

    const transaction = await txRepo.findOneBy({ reference: orderId });
    if (transaction) {
      transaction.status = 'completed';
      await txRepo.save(transaction);
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
      await this.refundFailedWithdrawal(withdrawal);
      throw new BadRequestException(
        `No ${withdrawal.paymentMethod} recipient code found for this bank account. Seller wallet has been refunded.`
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
      await this.refundFailedWithdrawal(withdrawal);
      throw new BadRequestException('Transfer failed: ' + error.message + '. Seller wallet has been refunded.');
    }
  }

  private async refundFailedWithdrawal(withdrawal: Withdrawal) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      withdrawal.status = WithdrawalStatus.FAILED;
      await queryRunner.manager.save(Withdrawal, withdrawal);

      // Refund the available balance back
      await queryRunner.manager.increment(
        Wallet,
        { seller: { id: withdrawal.seller.id } },
        'availableBalance',
        withdrawal.amount
      );

      // Set the transaction status to failed
      await queryRunner.manager.update(
        Transaction,
        { reference: withdrawal.id },
        { status: 'failed' }
      );

      await queryRunner.commitTransaction();
      this.logger.log(`Refunded withdrawal ${withdrawal.id} successfully.`);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to refund wallet for failed withdrawal ${withdrawal.id}: ${err.message}`, err.stack);
    } finally {
      await queryRunner.release();
    }
  }

  private async getOrCreateWallet(sellerId: string, manager?: EntityManager) {
    const walletRepo = manager ? manager.getRepository(Wallet) : this.walletRepo;

    let wallet = await walletRepo.findOne({
      where: { seller: { id: sellerId } },
    });

    if (!wallet) {
      wallet = await walletRepo.save(
        walletRepo.create({
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
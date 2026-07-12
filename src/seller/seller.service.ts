// src/sellers/seller.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SellerProfile } from './entities/seller-profile.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { SellerBank } from './entities/seller-bank.entity';
import { PaystackService } from 'src/payment-gateways/paystack.service';
import { AddBankDto } from './dto/add-bank.dto';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { OrderItem } from 'src/orders/entities/order-item.entity';
import { ActivityType, UserActivity } from 'src/tracking/entities/user-activity.entity';
import { PaymentGatewayFactory } from 'src/payment-gateways/factories/payment-gateway.factory';
import { PaymentMethod } from 'src/orders/entities/order.entity';
import { User } from 'src/users/entities/user.entity';
import { UserRole } from 'src/users/user-role.enum';

@Injectable()
export class SellerService {
  constructor(
    @InjectRepository(SellerProfile)
    private readonly sellerRepo: Repository<SellerProfile>,

    @InjectRepository(SellerBank)
    private readonly bankRepo: Repository<SellerBank>,

    private readonly gatewayFactory: PaymentGatewayFactory,


    @InjectRepository(OrderItem) private orderItemRepo: Repository<OrderItem>,
    @InjectRepository(UserActivity) private activityRepo: Repository<UserActivity>,

    private readonly paystackService: PaystackService,
    private dataSource: DataSource

  ) { }



  // Seller Stats
  async getSellerStats(sellerId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Revenue & Sales Count by Day (for the Graph)
    const salesOverTime = await this.orderItemRepo
      .createQueryBuilder('item')
      .leftJoin('item.order', 'order')
      .select("DATE_FORMAT(order.createdAt, '%Y-%m-%d')", 'date')
      .addSelect('SUM(item.priceAtPurchase * item.quantity)', 'revenue')
      .addSelect('COUNT(item.id)', 'salesCount')
      .where('item.sellerId = :sellerId', { sellerId })
      .andWhere('order.paymentStatus IN (:...statuses)', { statuses: ['escrow_held', 'released'] })
      .andWhere('order.createdAt >= :startDate', { startDate: thirtyDaysAgo })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    // 2. Top Performing Products (by Revenue)
    const topProducts = await this.orderItemRepo
      .createQueryBuilder('item')
      .select('item.productSnapshotTitle', 'title')
      .addSelect('SUM(item.quantity)', 'totalSold')
      .addSelect('SUM(item.priceAtPurchase * item.quantity)', 'revenue')
      .where('item.sellerId = :sellerId', { sellerId })
      .groupBy('item.productSnapshotTitle')
      .orderBy('revenue', 'DESC')
      .limit(5)
      .getRawMany();

    // 3. Product Engagement (Views from Tracking)
    const engagement = await this.activityRepo.count({
      where: {
        product: { seller: { id: sellerId } },
        activityType: ActivityType.VIEW
      }
    });

    return {
      salesOverTime,
      topProducts,
      summary: {
        totalRevenue: topProducts.reduce((acc, p) => acc + Number(p.revenue), 0),
        totalUnitsSold: topProducts.reduce((acc, p) => acc + Number(p.totalSold), 0),
        storeViews: engagement
      }
    };
  }

  /* ---------------- CREATE ---------------- */
  async create(userId: string, dto: CreateSellerDto) {
    return this.dataSource.transaction(async (manager) => {
      const sellerRepo = manager.getRepository(SellerProfile);
      const walletRepo = manager.getRepository(Wallet);

      const exists = await sellerRepo.findOne({
        where: { user: { id: userId } },
      });

      if (exists) {
        throw new BadRequestException('Seller profile already exists');
      }

      // Generate Slug
      let baseSlug = this.generateSlug(dto.businessName);
      let storeSlug = baseSlug;

      // Ensure uniqueness
      let slugExists = await sellerRepo.findOne({ where: { storeSlug } });
      let counter = 1;
      while (slugExists) {
        storeSlug = `${baseSlug}-${counter}`;
        slugExists = await sellerRepo.findOne({ where: { storeSlug } });
        counter++;
      }

      const seller = await sellerRepo.save(
        sellerRepo.create({
          ...dto,
          storeSlug,
          user: { id: userId },
        }),
      );

      const wallet = walletRepo.create({
        seller,
        availableBalance: 0,
        pendingBalance: 0,
      });

      await walletRepo.save(wallet);

      // ✅ Update user role to SELLER
      await manager.getRepository(User).update(userId, { role: UserRole.SELLER });

      return seller;
    });
  }


  /* ---------------- UPDATE ---------------- */
  async update(userId: string, dto: UpdateSellerDto) {
    const seller = await this.getMyStore(userId);


    Object.assign(seller, dto);
    return this.sellerRepo.save(seller);
  }

  /* ---------------- GET MY STORE ---------------- */
  async getMyStore(userId: string) {

    if (!userId) {
      throw new BadRequestException('Invalid User ID. Please log in again.');
    }


    const seller = await this.sellerRepo.findOne({
      where: { user: { id: userId } },
    });


    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    return seller;
  }

  /* ---------------- SOFT DELETE ---------------- */
  async softDelete(userId: string) {
    const seller = await this.getMyStore(userId);

    seller.isActive = false;

    return this.sellerRepo.save(seller);
  }

  /* ---------------- PUBLIC STORE ---------------- */
  async getPublicStore(idOrSlug: string) {
    const seller = await this.sellerRepo.findOne({
      where: [
        { id: idOrSlug, isActive: true },
        { storeSlug: idOrSlug, isActive: true }
      ],
    });

    if (!seller) {
      throw new NotFoundException('Store not found');
    }

    return seller;
  }

  /* ---------------- GET ALL STORES ---------------- */
  async getAllStores(page = 1, limit = 10) {
    const [stores, total] = await this.sellerRepo.findAndCount({
      where: { isActive: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: stores,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /* ---------------- BANK MANAGEMENT ---------------- */

  // Fetch all banks for a logged-in user
  async findAllBanks(userId: string) {
    const seller = await this.getMyStore(userId);

    return this.bankRepo.find({
      where: { seller: { id: seller.id } },
      order: { isPrimary: 'DESC', createdAt: 'DESC' }
    });
  }

  async addBank(userId: string, dto: AddBankDto) {
    const seller = await this.getMyStore(userId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Register with both gateways in parallel
      const [paystackResult, flutterwaveResult] = await Promise.allSettled([
        this.gatewayFactory.getGateway(PaymentMethod.PAYSTACK)
          .createRecipient(dto.accountName, dto.accountNumber, dto.bankCode),
        this.gatewayFactory.getGateway(PaymentMethod.FLUTTERWAVE)
          .createRecipient(dto.accountName, dto.accountNumber, dto.bankCode),
      ]);

      // Paystack is required — fail hard if it errors
      if (paystackResult.status === 'rejected') {
        throw new BadRequestException('Could not verify bank account with payment provider');
      }

      const existingBanksCount = await queryRunner.manager.count(SellerBank, {
        where: { seller: { id: seller.id } },
      });

      const newBank = this.bankRepo.create({
        ...dto,
        paystackRecipientCode: paystackResult.value.recipientCode,
        // Flutterwave is optional — store if it succeeded, null if not
        flutterwaveRecipientCode: flutterwaveResult.status === 'fulfilled'
          ? flutterwaveResult.value.recipientCode
          : null,
        isPrimary: existingBanksCount === 0,
        seller,
      });

      const saved = await queryRunner.manager.save(newBank);
      await queryRunner.commitTransaction();
      return saved;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /*  async addBank(userId: string, dto: AddBankDto) {
   const seller = await this.getMyStore(userId);
 
   return this.dataSource.transaction(async (manager) => {
     
     const resolvedAccount = await this.paystackService.resolveAccount(
       dto.accountNumber,
       dto.bankCode
     );
 
     const recipientCode = await this.paystackService.createRecipient(
       resolvedAccount.account_name,
       dto.accountNumber,
       dto.bankCode
     );
 
     const existingBanksCount = await manager.count(SellerBank, {
       where: { seller: { id: seller.id } },
     });
 
     const isFirstBank = existingBanksCount === 0;
 
     const newBank = manager.create(SellerBank, {
       accountName: resolvedAccount.account_name,
       accountNumber: dto.accountNumber,
       bankCode: dto.bankCode,
       paystackRecipientCode: recipientCode,
       isPrimary: isFirstBank,
       seller,
     });
 
     return manager.save(newBank);
   });
 } */


  async setPrimary(userId: string, bankId: string) {
    const seller = await this.getMyStore(userId);

    // Ensure the bank belongs to this seller before updating
    const bank = await this.bankRepo.findOne({
      where: { id: bankId, seller: { id: seller.id } }
    });
    if (!bank) throw new NotFoundException("Bank account not found");

    // Reset all to false, set target to true
    await this.bankRepo.update({ seller: { id: seller.id } }, { isPrimary: false });
    await this.bankRepo.update(bankId, { isPrimary: true });

    return { success: true };
  }

  async removeBank(userId: string, bankId: string) {
    const seller = await this.getMyStore(userId);

    const bank = await this.bankRepo.findOne({
      where: { id: bankId, seller: { id: seller.id } }
    });

    if (!bank) throw new NotFoundException("Bank account not found");
    if (bank.isPrimary) throw new BadRequestException("Cannot delete your primary payout account");

    return this.bankRepo.remove(bank);
  }

  /* ---------------- ADMIN ACTIONS ---------------- */
  async suspend(id: string) {
    const seller = await this.sellerRepo.findOne({ where: { id } });
    if (!seller) throw new NotFoundException('Store not found');

    seller.isActive = false;
    return this.sellerRepo.save(seller);
  }

  async unsuspend(id: string) {
    const seller = await this.sellerRepo.findOne({ where: { id } });
    if (!seller) throw new NotFoundException('Store not found');

    seller.isActive = true;
    return this.sellerRepo.save(seller);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .split("-")
      .slice(0, 8)
      .join("-");
  };



}

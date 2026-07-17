import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "src/orders/entities/order.entity";
import { Product } from "src/products/entities/product.entity";
import { User } from "src/users/entities/user.entity";
import { Withdrawal } from "src/wallet/entities/withdrawal.entity";
import { Repository } from "typeorm";

@Injectable()
export class AnalyticsService {
    constructor(
        @InjectRepository(Order) private orderRepo: Repository<Order>,
        @InjectRepository(User) private userRepo: Repository<User>,
        @InjectRepository(Product) private productRepo: Repository<Product>,
        @InjectRepository(Withdrawal) private withdrawalRepo: Repository<Withdrawal>,
    ) { }

    async getPlatformStats() {
        // 1. Calculate GMV (Gross Merchandise Value) & Total Commissions
        const orderStats = await this.orderRepo
            .createQueryBuilder('order')
            .select('SUM(order.totalAmount)', 'gmv') // The full amount paid by buyer
            .addSelect('SUM(order.platformFee)', 'revenue') // ONLY the 5% commission
            .addSelect('COUNT(order.id)', 'count')
            .where('order.paymentStatus IN (:...statuses)', { statuses: ['escrow_held', 'released'] })
            .getRawOne();
        // 2. User Statistics
        const totalSellers = await this.userRepo.count({ where: { role: 'seller' as any } });
        const totalBuyers = await this.userRepo.count({ where: { role: 'buyer' as any } });

        // 3. Product Inventory
        const totalProducts = await this.productRepo.count();

        // 4. Payout Activity
        const pendingWithdrawals = await this.withdrawalRepo.count({ where: { status: 'pending' as any } });

        return {
            gmv: parseFloat(orderStats.gmv || 0),
            revenue: parseFloat(orderStats.revenue || 0), // This is FKstores' actual profit
            totalOrders: parseInt(orderStats.count || 0),
            users: {
                sellers: totalSellers,
                buyers: totalBuyers,
                total: totalSellers + totalBuyers
            },
            inventory: totalProducts,
            alerts: {
                pendingWithdrawals
            }
        };
    }

    async getSellerStats(userId: string) {
        // 1. Get seller profile
        const user = await this.userRepo.findOne({ 
            where: { id: userId }, 
            relations: ['sellerProfile'] 
        });
        const sellerProfileId = user?.sellerProfile?.id;

        if (!sellerProfileId) return null;

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 2. Calculate Revenue & Orders
        const stats = await this.orderRepo
            .createQueryBuilder('order')
            .innerJoin('order.items', 'item')
            .select('SUM(item.priceAtPurchase * item.quantity)', 'revenue')
            .addSelect('COUNT(DISTINCT order.id)', 'count')
            .where('item.seller = :sellerProfileId', { sellerProfileId })
            .andWhere('order.paymentStatus IN (:...statuses)', { statuses: ['escrow_held', 'released'] })
            .getRawOne();

        // 3. Sales Over Time (for Graphs)
        const salesOverTime = await this.orderRepo
            .createQueryBuilder('order')
            .innerJoin('order.items', 'item')
            .select("DATE_FORMAT(order.createdAt, '%Y-%m-%d')", 'date')
            .addSelect('SUM(item.priceAtPurchase * item.quantity)', 'revenue')
            .addSelect('COUNT(DISTINCT order.id)', 'orderCount')
            .where('item.seller = :sellerProfileId', { sellerProfileId })
            .andWhere('order.paymentStatus IN (:...statuses)', { statuses: ['escrow_held', 'released'] })
            .andWhere('order.createdAt >= :startDate', { startDate: thirtyDaysAgo })
            .groupBy('date')
            .orderBy('date', 'ASC')
            .getRawMany();

        // 4. Inventory
        const totalProducts = await this.productRepo.count({ 
            where: { sellerProfileId } 
        });

        return {
            revenue: parseFloat(stats.revenue || 0),
            totalOrders: parseInt(stats.count || 0),
            inventory: totalProducts,
            salesOverTime: salesOverTime.map(s => ({
                name: s.date,
                sales: parseFloat(s.revenue || 0),
                orders: parseInt(s.orderCount || 0)
            }))
        };
    }
}
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm'; // Import Not
import { UserActivity } from './entities/user-activity.entity';
import { Product } from 'src/products/entities/product.entity';

@Injectable()
export class DiscoveryService {
  constructor(
    @InjectRepository(UserActivity)
    private activityRepo: Repository<UserActivity>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
  ) {}

  async getPersonalizedFeed(userId: string | null, limit = 8, excludeId?: string) {
    // 1. If user is not logged in, return trending products (with exclusion)
    if (!userId) {
      return this.getTrendingProducts(limit, excludeId);
    }

    // 2. Identify Top Interests (The TikTok logic)
    const topInterests = await this.activityRepo
      .createQueryBuilder('activity')
      .leftJoin('activity.product', 'product')
      .select('product.categoryId', 'categoryId')
      .addSelect(
        `SUM(CASE 
            WHEN activity.activityType = 'purchase' THEN 10 
            WHEN activity.activityType = 'cart_add' THEN 5 
            WHEN activity.activityType = 'click' THEN 2 
            ELSE 1 
         END)`, 
        'score'
      )
      .where('activity.userId = :userId', { userId })
      .andWhere('product.categoryId IS NOT NULL')
      .groupBy('product.categoryId')
      .orderBy('score', 'DESC')
      .limit(3)
      .getRawMany();

    // 3. Fallback if no activity is found
    if (topInterests.length === 0) {
      return this.getTrendingProducts(limit, excludeId);
    }

    // 4. Fetch products from top categories, excluding the current one
    const categoryIds = topInterests.map(i => i.categoryId);
    
    return this.productRepo.find({
      where: {
        categoryId: In(categoryIds),
        status: 'published' as any,
        ...(excludeId && { id: Not(excludeId) }) // Spread the condition ONLY if excludeId exists
      },
      relations: ['category', 'seller'],
      order: { createdAt: 'DESC' },
      take: limit
    });
  }

  /**
   * Helper to get global trending items while respecting the exclusion
   */
  private async getTrendingProducts(limit: number, excludeId?: string) {
    return this.productRepo.find({
      where: { 
        status: 'published' as any,
        ...(excludeId && { id: Not(excludeId) }) // Ensure the current product isn't here either
      },
      relations: ['category', 'seller'],
      order: { averageRating: 'DESC', createdAt: 'DESC' },
      take: limit
    });
  }
}
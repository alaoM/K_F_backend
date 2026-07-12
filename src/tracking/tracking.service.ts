import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserActivity, ActivityType } from './entities/user-activity.entity';

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(UserActivity)
    private activityRepo: Repository<UserActivity>,
  ) {}

  async track(userId: string | null, productId: string | null, type: ActivityType, metadata?: any) {
    const activity = this.activityRepo.create({
      user: userId ? { id: userId } : null,
      product: productId ? { id: productId } : null,
      activityType: type,
      metadata,
    });

    // We don't await this in the controller to keep the frontend fast
    return this.activityRepo.save(activity);
  }

  /**
    
   * Find what this user likes based on their history
   */
  async getUserInterests(userId: string) {
    return this.activityRepo
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .where('activity.userId = :userId', { userId })
      .select('category.id', 'categoryId')
      .addSelect('COUNT(*)', 'interestScore')
      .groupBy('category.id')
      .orderBy('interestScore', 'DESC')
      .limit(5)
      .getRawMany();
  }
}
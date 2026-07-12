import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { Product } from 'src/products/entities/product.entity';
import { SellerProfile } from 'src/seller/entities/seller-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Product, SellerProfile])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}

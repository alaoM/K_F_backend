// src/reviews/reviews.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Product } from 'src/products/entities/product.entity';

import { CreateReviewDto } from './dto/create-review.dto';
import { SellerProfile } from 'src/seller/entities/seller-profile.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(SellerProfile)
    private sellerRepository: Repository<SellerProfile>,
  ) {}

  async createReview(productId: string, userId: string | null, dto: CreateReviewDto) {
    // 1. Verify Product exists
    
    const product = await this.productRepository.findOne({ 
      where: { id: productId },
    //   relations: ['seller'] 
    });
    
    if (!product) throw new NotFoundException('Product not found');

    // 2. Create the review
    const review = this.reviewRepository.create({
      ...dto,
      product: { id: productId },
      user: userId ? { id: userId } : null,
      isAnonymous: dto.isAnonymous || !userId, // Force anonymous if no userId
    });
    
    const savedReview = await this.reviewRepository.save(review);

    // 3. Update Product Stats
    await this.updateProductStats(productId);

    // 4. Update Seller Stats
    if (product.seller) {
      await this.updateSellerStats(product.seller.id);
    }

    return savedReview;
  }

  private async updateProductStats(productId: string) {
    const reviews = await this.reviewRepository.find({ where: { product: { id: productId } } });
    
    const reviewCount = reviews.length;
    const sum = reviews.reduce((acc, item) => acc + item.rating, 0);
    const averageRating = reviewCount > 0 ? sum / reviewCount : 0;

    await this.productRepository.update(productId, {
      averageRating: parseFloat(averageRating.toFixed(1)),
      reviewCount: reviewCount
    });
  }

  private async updateSellerStats(sellerId: string) {
    // Get all products for this seller to aggregate their ratings
    const products = await this.productRepository.find({ 
        where: { seller: { id: sellerId } } 
    });

    const productsWithReviews = products.filter(p => p.reviewCount > 0);
    const sum = productsWithReviews.reduce((acc, p) => acc + Number(p.averageRating), 0);
    const sellerRating = productsWithReviews.length > 0 ? sum / productsWithReviews.length : 0;

    await this.sellerRepository.update(sellerId, {
      rating: parseFloat(sellerRating.toFixed(1))
    });
  }

  async findByProduct(productId: string) {
    return this.reviewRepository.find({
      where: { product: { id: productId } },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }
}
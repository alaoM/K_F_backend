// src/reviews/reviews.controller.ts
import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post(':productId')
  async create(
    @Param('productId') productId: string,
    @Body() createReviewDto: CreateReviewDto,
    @Req() req: any, // We check if JWT strategy populated req.user
  ) {
    const userId = req.user?.id || null;
    return this.reviewsService.createReview(productId, userId, createReviewDto);
  }

  @Get('product/:productId')
  async getByProduct(@Param('productId') productId: string) {
    return this.reviewsService.findByProduct(productId);
  }
}
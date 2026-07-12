// src/reviews/dto/create-review.dto.ts
import { IsNumber, IsString, IsBoolean, IsOptional, Min, Max, IsNotEmpty } from 'class-validator';

export class CreateReviewDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsNotEmpty()
  comment: string;

  @IsBoolean()
  @IsOptional()
  isAnonymous?: boolean;
}
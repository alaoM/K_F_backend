import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class ProductFilterDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() minPrice?: number;
  
  @IsOptional() @IsNumber() maxPrice?: number;

  @IsOptional() @IsString() location?: string;

  @IsOptional() @IsString() sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'rating';

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  offset?: number;

   @IsOptional()
  @IsString()
  sellerSlug?: string; // Add this!
}
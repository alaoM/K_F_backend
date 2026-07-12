// src/products/dto/create-product.dto.ts
import { 
  IsString, 
  IsNumber, 
  IsInt, 
  IsArray, 
  IsEnum, 
  IsOptional, 
  IsBoolean, 
  Min, 
  MinLength, 
  ArrayMinSize,
  IsObject,
  IsPositive,
  IsUUID,
  IsNotEmpty
} from 'class-validator';
import { ProductStatus } from '../enum/product-status.enum';

export class CreateProductDto {
  @IsString()
  @MinLength(3, { message: 'Title is too short. Minimum 3 characters.' })
  title: string;

  @IsString()
  @MinLength(10, { message: 'Description should be at least 10 characters.' })
  description: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @IsInt()
  @Min(0)
  stock: number;

  @IsUUID()
  @IsOptional()
  category: string;

   @IsUUID()
  @IsOptional()
  categoryId

   @IsString()
  @IsNotEmpty({message: 'Please upload an image proof to your product'})
  primaryImage: string; // The main image URL

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  otherImages: string[];

  

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>; // For specs like "Weight", "Color", etc.
}
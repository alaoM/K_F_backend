import { IsArray, ValidateNested, IsNotEmpty, IsString, isString, IsOptional, IsEnum, IsNumber, IsPositive, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/order.entity';

class CartItemDto {
  @IsNotEmpty()
  productId: string;

 @IsNumber()
@IsPositive()
@IsInt()
quantity: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsString()
  @IsNotEmpty()
  shippingAddress: string;

  @IsEnum(['paystack', 'flutterwave'])
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsString()
  @IsOptional()
  noteToSeller?: string;
}
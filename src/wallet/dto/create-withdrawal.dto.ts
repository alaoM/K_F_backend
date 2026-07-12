import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { PaymentMethod } from 'src/orders/entities/order.entity';

export class CreateWithdrawalDto {
  @IsNumber()
  @Min(100) // Minimum withdrawal e.g. 100
  amount: number;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsUUID()
  bankAccountId: string; // The ID of the SellerBank account
}
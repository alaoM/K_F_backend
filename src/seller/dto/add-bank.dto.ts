// src/seller/dto/add-bank.dto.ts
import { IsString, IsNotEmpty, Length, IsBoolean, IsOptional } from 'class-validator';

export class AddBankDto {
  @IsString()
  @IsNotEmpty()
  bankName: string; // e.g., "Guaranty Trust Bank"

  @IsString()
  @IsNotEmpty()
  bankCode: string; // e.g., "058" (Required for Paystack transfers)

  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Account number must be exactly 10 digits' })
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  accountName: string; // The name resolved/verified from Paystack

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean; // Optional: can be set manually or defaulted by service
}
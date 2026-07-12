// resend-verification.dto.ts
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail()
  @IsOptional()
  email: string;

  @IsString()
  @IsOptional()
  token: string;
}
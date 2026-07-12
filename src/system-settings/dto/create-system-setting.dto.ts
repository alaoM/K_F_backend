import { IsOptional, IsString } from 'class-validator';

export class CreateSystemSettingDto {
  @IsOptional()
  @IsString()
  COMMISSION_PERCENT?: string;

  @IsOptional()
  @IsString()
  PAYSTACK_PERCENT?: string;

  @IsOptional()
  @IsString()
  PAYSTACK_FLAT_FEE?: string;

  @IsOptional()
  @IsString()
  PAYSTACK_CAP?: string;

  @IsOptional()
  @IsString()
  PLATFORM_NAME?: string;

  @IsOptional()
  @IsString()
  SUPPORT_EMAIL?: string;

  @IsOptional()
  @IsString()
  MAINTENANCE_MODE?: string;
}


import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateSellerDto {
  /* ---------------- STORE INFO ---------------- */

  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  bio?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  banner?: string;

  /* ---------------- CONTACT ---------------- */

  @IsOptional()
  @IsString()
  businessPhoneNumber?: string;

  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @IsOptional()
  @IsString()
  businessAddress?: string;

  @IsOptional()
  @IsString()
  businessCity?: string;

  @IsOptional()
  @IsString()
  businessState?: string;

  @IsOptional()
  @IsString()
  businessPostalCode?: string;

  /* ---------------- STATUS ---------------- */

  @IsOptional()
  @IsBoolean()
  vacationMode?: boolean;
}
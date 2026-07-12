import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { UserRole } from '../user-role.enum';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  userAvatar?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  location?: string;

   @IsString()
  @IsOptional()
  businessName?: string;

   @IsString()
  @IsOptional()
  farmSize?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  areaOfExpertise?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  areaOfInterest?: string[];

 
  @IsBoolean()
  @IsOptional()
  isTwoFactorEnabled?: boolean;

  // Admin-only update
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

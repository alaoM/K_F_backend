import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ArrayNotEmpty,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '../user-role.enum';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  fullName: string;

  @IsString()
  @MinLength(8)
  password: string;

 @IsString()
  phoneNumber: string;

  @IsString()
  address: string;

  @IsString()
  location: string;
 /* 
  // ===== SELLER ONLY =====
  @ValidateIf(dto => dto.role === UserRole.SELLER)
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty({ message: 'Sellers must specify areaOfExpertise' })
  areaOfExpertise?: string[];

  // ===== CREATOR ONLY =====
  @ValidateIf(dto => dto.role === UserRole.CREATOR)
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty({ message: 'Creators must specify areaOfInterest' })
  areaOfInterest?: string[];

  // Default = BUYER
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.BUYER; */
}

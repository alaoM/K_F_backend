import { IsEmail, IsEnum, IsOptional, IsPhoneNumber, isString, IsString, MinLength } from 'class-validator';


export class RegisterDto {
  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)  
  password: string;

  @IsOptional()
  @IsPhoneNumber(null)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  location?: string;
}

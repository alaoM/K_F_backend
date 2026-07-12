import { IsOptional, IsString, IsPhoneNumber,  } from 'class-validator';
import { UserRole } from '../user-role.enum';

export class OnboardUserDto {
 
  @IsPhoneNumber(null)
  phoneNumber: string;

  @IsString()
  address: string;
  
  @IsString()
  location: string;

  
  @IsOptional()
  role: UserRole;

}

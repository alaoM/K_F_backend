// dto/verify-2fa.dto.ts
import { IsString } from 'class-validator';

export class VerifyTwoFactorDto {
  @IsString()
  code: string;
}

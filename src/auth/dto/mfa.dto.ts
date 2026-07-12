import { IsString } from "class-validator";

export class MfaDto {
  @IsString() userId: string;
  @IsString() code: string;
}
import { IsArray, IsEnum, IsOptional, IsString } from "class-validator";
import { DisputePriority } from "../entities/dispute.entity";

export class InitiateDisputeDto {
  @IsString()
  reason: string; // e.g., "Rotten Produce", "Wrong Quantity"

  @IsString()
  priority: DisputePriority

  @IsString()
  message: string;

  @IsArray()
  @IsOptional()
  attachments?: string[];
}

export class AddDisputeMessageDto {
  @IsString()
  message: string;

  // priority: DisputePriority

  @IsArray()
  @IsOptional()
  attachments?: string[];
}

export class ResolveDisputeDto {
  @IsEnum(['refund', 'release'])
  action: 'refund' | 'release';

  @IsString()
  note: string;
}
import { IsNumber, IsOptional, IsString, IsUUID, Max, Min, MinLength, ValidateIf } from "class-validator";

export class CreateCategoryDto {


  @IsString()
  @MinLength(2, { message: 'Category name is too short. Minimum 3 characters.' })
  name: string;

  @IsOptional()
  @ValidateIf((o) => o.parentId !== '' && o.parentId !== null)
  @IsUUID()
  parentId?: string; // If creating a sub-category

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  commissionPercent?: number; // 0.08 = 8%, null = use global

}

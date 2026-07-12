import { IsArray, IsOptional, IsString, MinLength } from "class-validator";

export class CreateBlogPostDto {
    @IsString()
    @MinLength(3)
    title: string;

    @IsString()
    @MinLength(10)
    content: string;

    @IsString()
    @IsOptional()
    featuredImage?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];
}

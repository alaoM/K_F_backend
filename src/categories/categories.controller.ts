import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { Roles } from "src/auth/roles.decorator";
import { RolesGuard } from "src/auth/roles.guard";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UserRole } from "src/users/user-role.enum";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { CategoriesService } from './categories.service';


@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) {}


  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN) 
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  // Public: Sellers need this to populate listing dropdowns
  // Buyers need this for the search sidebar
  findAll() {
    return this.categoriesService.findAll();
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
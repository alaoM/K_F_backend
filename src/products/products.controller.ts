import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'src/users/user-role.enum';
import { RolesGuard } from 'src/auth/roles.guard';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from 'src/users/entities/user.entity';

@Controller('products')
export class ProductController {
  constructor(private readonly productsService: ProductsService) {}

  /* ================= PUBLIC ================= */

  @Get()
  getAllProducts(@Query() filters: ProductFilterDto) {
    return this.productsService.findAllPublic(filters);
  }

  

  
  

  /* ================= SELLER ================= */

  @Get('seller')
  @UseGuards(JwtAuthGuard)
  getMyProducts(@Req() req, @Query() filters: ProductFilterDto) {

    return this.productsService.findAllBySeller(req.user.sub, filters);
  }

  @Get('seller/:id')
  @UseGuards(JwtAuthGuard)
  getMyProduct(@Req() req, @Param('id') id: string) {
    return this.productsService.findOneBySeller(req.user.sub, id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req, @Body() dto: CreateProductDto) {
    return this.productsService.create(req.user.sub, dto);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard)
  bulkCreate(@Req() req, @Body() dtos: CreateProductDto[]) {
    return this.productsService.bulkCreate(req.user.sub, dtos);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(req.user.sub, id, dto);
  }


  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req, @Param('id') id: string) {
    return this.productsService.delete(req.user.sub, id);
  }


  @Get(':id')
  getOnePublicProduct(@Param('id') id: string) {
    return this.productsService.findOnePublic(id);
  }
 
}

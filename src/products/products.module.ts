import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductController } from './products.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Category } from 'src/categories/entities/category.entity';
import { SellerProfile } from 'src/seller/entities/seller-profile.entity';
import { UsersModule } from 'src/users/users.module';
import { TrackingModule } from 'src/tracking/tracking.module';
import { User } from 'src/users/entities/user.entity';
 

@Module({

  imports: [
    TypeOrmModule.forFeature([Product, Category, SellerProfile, User,]), 
    UsersModule,
    TrackingModule,
  ],
  controllers: [ProductController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}

import { Module } from '@nestjs/common';
import { SellerService } from './seller.service';
import { SellerController } from './seller.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { User } from 'src/users/entities/user.entity';
import { Product } from 'src/products/entities/product.entity';
import { SellerProfile } from './entities/seller-profile.entity';
import { PaymentGatewaysModule } from 'src/payment-gateways/payment-gateways.module';
import { SellerBank } from './entities/seller-bank.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { OrderItem } from 'src/orders/entities/order-item.entity';
import { UserActivity } from 'src/tracking/entities/user-activity.entity';

@Module({

    imports: [
      TypeOrmModule.forFeature([Product, SellerProfile,  User, SellerBank, Wallet, OrderItem, UserActivity]), 
      UsersModule, PaymentGatewaysModule
    ],
  controllers: [SellerController],
  providers: [SellerService],
  exports: [SellerService]
})
export class SellerModule {}

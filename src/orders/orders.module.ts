import { forwardRef, Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerProfile } from 'src/seller/entities/seller-profile.entity';
import { Product } from 'src/products/entities/product.entity';
 
import { UsersModule } from 'src/users/users.module';
import { User } from 'src/users/entities/user.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { SystemSettingsModule } from 'src/system-settings/system-settings.module';
import { PaymentGatewaysModule } from 'src/payment-gateways/payment-gateways.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { SellerModule } from 'src/seller/seller.module';
import { Dispute } from './entities/dispute.entity';
import { DisputeMessage } from './entities/dispute-messages';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';

@Module({
  imports: [
      TypeOrmModule.forFeature([Order,OrderItem, Product, SellerProfile, User, Dispute, DisputeMessage]), 
      UsersModule, SystemSettingsModule, 
      WalletModule , 
      forwardRef(() => SellerModule),
      forwardRef(() => PaymentGatewaysModule),
    ],
  controllers: [OrdersController, DisputeController],
  providers: [OrdersService, DisputeService],
  exports: [OrdersService],
})
export class OrdersModule {}
 



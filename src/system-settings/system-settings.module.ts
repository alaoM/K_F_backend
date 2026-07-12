import { forwardRef, Module } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController } from './system-settings.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSettings } from './entities/system-setting.entity';
import { AnalyticsService } from './analyticsService.service';
import { Order } from 'src/orders/entities/order.entity';
import { User } from 'src/users/entities/user.entity';
import { Product } from 'src/products/entities/product.entity';
import { Withdrawal } from 'src/wallet/entities/withdrawal.entity';

@Module({
   imports: [
        TypeOrmModule.forFeature([SystemSettings, Order, User, Product, Withdrawal]),
         
      ],
  controllers: [SystemSettingsController],
  providers: [SystemSettingsService, AnalyticsService],
  exports: [SystemSettingsService, AnalyticsService]
})
export class SystemSettingsModule {}

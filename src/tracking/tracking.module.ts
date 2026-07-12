import { Module } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserActivity } from './entities/user-activity.entity';
import { Product } from 'src/products/entities/product.entity';
import { User } from 'src/users/entities/user.entity';

@Module({
  imports: [
        TypeOrmModule.forFeature([UserActivity, Product, User])
      ],
  controllers: [TrackingController, DiscoveryController],
  providers: [TrackingService, DiscoveryService],
  exports: [TrackingService],
})
export class TrackingModule {}

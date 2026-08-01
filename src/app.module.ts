import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MailserviceModule } from './mailservice/mailservice.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SellerModule } from './seller/seller.module';
import { WalletModule } from './wallet/wallet.module';
import { CategoriesModule } from './categories/categories.module';
import { UploadsModule } from './uploads/uploads.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';
import { PaymentGatewaysModule } from './payment-gateways/payment-gateways.module';
import { TrackingModule } from './tracking/tracking.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BlogModule } from './blog/blog.module';
import { NewsletterModule } from './newsletter/newsletter.module';

import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // 🚀 Global Cache Module (In-Memory response/data cache)
    CacheModule.register({
      isGlobal: true,
      ttl: 60000, // 60 seconds default cache TTL
      max: 1000,  // Max 1000 items in memory
    }),
    // 🛡️ Rate Limiting Module (Protects server from brute-force & DDoS)
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,  // 1 second window
        limit: 15,  // max 15 requests/sec per IP
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds window
        limit: 60,  // max 60 requests per 10 secs
      },
      {
        name: 'long',
        ttl: 60000, // 60 seconds (1 minute) window
        limit: 200, // max 200 requests per minute per IP
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.HOST, // Your MySQL host
      port: 3306, // Your MySQL port
      username:
        process.env.APP_ENVIRONMENT == 'dev'
          ? process.env.MYSQL_USERNAME_LOCAL
          : process.env.MYSQL_USERNAME_LIVE,
      password:
        process.env.APP_ENVIRONMENT == 'dev'
          ? process.env.MYSQL_PASSWORD_LOCAL
          : process.env.MYSQL_PASSWORD_LIVE,
      database:
        process.env.APP_ENVIRONMENT == 'dev'
          ? process.env.MYSQL_DATABASE_LOCAL
          : process.env.MYSQL_DATABASE_LIVE,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: ['error', 'warn'],
      autoLoadEntities: true,
    }),
    UsersModule,
    AuthModule,
    MailserviceModule,
    SellerModule,
    WalletModule,
    ProductsModule,
    CategoriesModule,
    UploadsModule,
    OrdersModule,
    ReviewsModule,
    SystemSettingsModule,
    PaymentGatewaysModule,
    TrackingModule,
    NotificationsModule,
    BlogModule,
    NewsletterModule,
  ],

  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Applies global rate limiting to all routes
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}


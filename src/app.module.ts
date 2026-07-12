import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MailserviceModule } from './mailservice/mailservice.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
 
 
 
 
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
      
      // logging: true
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
  providers: [AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor
    },
    
  ],
})
export class AppModule {}

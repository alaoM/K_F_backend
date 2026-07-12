import { forwardRef, Module } from '@nestjs/common';
import { PaymentGatewaysService } from './payment-gateways.service';
import { PaymentGatewaysController } from './payment-gateways.controller';
import { PaystackService } from './paystack.service';
import { WalletModule } from 'src/wallet/wallet.module';
import { OrdersModule } from 'src/orders/orders.module';
import { FlutterwaveService } from './flutterwave.service';
 
import { PaymentGatewayFactory } from './factories/payment-gateway.factory';
import { SystemSettingsModule } from 'src/system-settings/system-settings.module';

@Module({
  imports: [WalletModule,
    forwardRef(() => OrdersModule),
     SystemSettingsModule, 
  ],
  controllers: [PaymentGatewaysController],
  exports: [PaymentGatewayFactory, PaystackService],
  providers: [PaymentGatewaysService, PaystackService, FlutterwaveService, PaymentGatewayFactory],
})
export class PaymentGatewaysModule { }

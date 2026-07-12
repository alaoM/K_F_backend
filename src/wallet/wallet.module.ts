import { forwardRef, Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { Withdrawal } from './entities/withdrawal.entity';
import { Transaction } from './entities/transaction.entity';
import { SellerModule } from 'src/seller/seller.module';
import { SellerProfile } from 'src/seller/entities/seller-profile.entity';

import { PaymentGatewaysModule } from 'src/payment-gateways/payment-gateways.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Withdrawal, Transaction, SellerProfile]),
    forwardRef(() => SellerModule),
    forwardRef(() => PaymentGatewaysModule)
  ],
  exports: [WalletService],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule { }

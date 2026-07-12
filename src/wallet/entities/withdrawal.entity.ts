import { PaymentMethod } from "src/orders/entities/order.entity";
import { SellerBank } from "src/seller/entities/seller-bank.entity";
import { SellerProfile } from "src/seller/entities/seller-profile.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

export enum WithdrawalStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

@Entity('withdrawals')
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal' })
  amount: number;

  @Column({ type: 'enum', enum: WithdrawalStatus, default: WithdrawalStatus.PENDING })
  status: WithdrawalStatus;

  @ManyToOne(() => SellerBank)
  bankAccount: SellerBank; // Which bank did they choose for this withdrawal?

  @ManyToOne(() => SellerProfile)
  seller: SellerProfile;

  @Column({ nullable: true })
  gatewayTransferCode: string;
  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.PAYSTACK })
  paymentMethod: PaymentMethod;

  @CreateDateColumn()
  createdAt: Date;
}
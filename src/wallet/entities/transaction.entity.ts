import { SellerProfile } from "src/seller/entities/seller-profile.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

// src/wallet/entities/transaction.entity.ts
export enum TransactionType {
  SALE_REVENUE = 'sale_revenue',
  WITHDRAWAL = 'withdrawal',
  REFUND = 'refund',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ default: 'completed' }) // pending, completed, failed
  status: string;

  @ManyToOne(() => SellerProfile)
  seller: SellerProfile;

  @Column({ nullable: true })
  reference: string; // Order ID or Payout Reference

  @CreateDateColumn()
  createdAt: Date;
}
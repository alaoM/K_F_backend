// src/seller/entities/seller-bank.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { SellerProfile } from './seller-profile.entity';

@Entity('seller_banks')
export class SellerBank {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  bankName: string;

  @Column()
  bankCode: string; // e.g., '058' for GTB

  @Column()
  accountNumber: string;

  @Column()
  accountName: string;

  @Column()
  paystackRecipientCode: string;

  @Column({ nullable: true })
  flutterwaveRecipientCode: string;

  @Column({ default: false })
  isPrimary: boolean; // The one used for automatic payouts

  @ManyToOne(() => SellerProfile, (seller) => seller.banks)
  seller: SellerProfile;

  @CreateDateColumn()
  createdAt: Date;
}
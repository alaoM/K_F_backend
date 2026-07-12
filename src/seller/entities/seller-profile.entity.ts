// src/sellers/entities/seller-profile.entity.ts
import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Product } from 'src/products/entities/product.entity';
import { SellerBank } from './seller-bank.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';

@Entity('seller_profiles')
export class SellerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ---------------- RELATION ---------------- */
  @OneToOne(() => User, (user) => user.sellerProfile, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  /* ---------------- STORE INFO ---------------- */
  @Column()
  businessName: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ nullable: true })
  logo?: string;

  @Column({ nullable: true })
  banner?: string;

  /* ---------------- CONTACT ---------------- */
  @Column({ type: 'varchar', nullable: true, default: null })
  businessPhoneNumber: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  businessEmail: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  businessAddress: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  businessCity: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  businessState: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  businessPostalCode: string;

  @Column({ nullable: true })
  storeSlug: string; 




  /* ---------------- STATUS ---------------- */
  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  vacationMode: boolean;

  @Column({ default: false })
  isVerified: boolean;

  /* ---------------- STATS ---------------- */
  @Column({ default: 0 })
  rating: number;

  @Column({ default: 0 })
  totalSales: number;

  @Column({ default: 0 })
  totalProducts: number;

  /* ---------------- RELATIONS ---------------- */
  @OneToMany(() => Product, (product) => product.seller)
  products: Product[];

  @OneToMany(() => SellerBank, (bank) => bank.seller)
  banks: SellerBank[];

  @OneToOne(() => Wallet, (wallet) => wallet.seller)
  wallet: Wallet; 

  /* ---------------- META ---------------- */
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

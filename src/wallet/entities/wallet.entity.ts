import { SellerProfile } from "src/seller/entities/seller-profile.entity";
import { Check, Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";

@Check(`"availableBalance" >= 0`) // This prevents negative values at the SQL level
@Check(`"pendingBalance" >= 0`)
@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // If a seller has a wallet, we usually link to the SellerProfile 
  // because transactions happen at the business level.
  @OneToOne(() => SellerProfile, (seller) => seller.wallet, { onDelete: 'CASCADE' })
  @JoinColumn() 
  seller: SellerProfile;

  @Column({ 
    type: 'decimal', 
    precision: 12, 
    scale: 2, 
    default: 0,
    transformer: {
        to: (value: number) => value,
        from: (value: string) => parseFloat(value) // Automatically converts string to number
    }
  })
  availableBalance: number;

  @Column({ 
    type: 'decimal', 
    precision: 12, 
    scale: 2, 
    default: 0,
    transformer: {
        to: (value: number) => value,
        from: (value: string) => parseFloat(value)
    }
  })
  pendingBalance: number;

  @CreateDateColumn()
  updatedAt: Date;
}
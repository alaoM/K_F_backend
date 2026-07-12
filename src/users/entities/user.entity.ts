import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  OneToOne,
  OneToMany,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { UserRole } from '../user-role.enum';
import { Exclude } from 'class-transformer';
import * as crypto from 'crypto';
import { SellerProfile } from 'src/seller/entities/seller-profile.entity';
import { Order } from 'src/orders/entities/order.entity';
import { Notification } from 'src/notifications/entities/notification.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ================== AUTH ================== */

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude({ toPlainOnly: true })
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.BUYER,
  })
  role: UserRole;

  @Column({ type: 'varchar', nullable: true, select: false, default: null })
  @Exclude({ toPlainOnly: true })
  hashedRefreshToken?: string | null;

  /* ================== PROFILE ================== */

  @Column()
  fullName: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  userAvatar: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  businessName: string;

 

  // Use nullable: true for fields collected during onboarding
  @Column({ type: 'varchar', nullable: true, default: null })
  phoneNumber: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  address: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  location: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  @Exclude({ toPlainOnly: true })
  lifetimeSalesVolume: number; 

  
  @OneToOne(() => SellerProfile, (profile) => profile.user)
  sellerProfile: SellerProfile;


  /* ================== VERIFICATION & SECURITY ================== */

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: false })
  isTwoFactorEnabled: boolean;

  /**
   * isVerified: Represents KYC/Identity verification
   * isOnboarded: Represents profile completion (Role selection, address, etc.)
   */
  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'uuid', nullable: true })
  @Exclude({ toPlainOnly: true })
  verifiedBy: string | null;

  @Column({ default: false })
  isOnboarded: boolean;

  @Column({ type: 'varchar', nullable: true, select: false, default: null })
  @Exclude({ toPlainOnly: true })
  twoFactorSecret?: string | null;

  @Column({ type: 'varchar', nullable: true, select: false, default: null })
  @Exclude({ toPlainOnly: true })
  passwordResetToken?: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false, default: null })
  passwordResetExpires?: Date | null;

  @Column({ default: false })
  isSuspended: boolean;

  @Column({ default: true })
  emailNotificationsEnabled: boolean;

  @Column({ default: true })
  pushNotificationsEnabled: boolean;

  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'pending' | 'suspended' | 'rejected';

  @Index()
  @Column({ type: 'timestamp', nullable: true })
  @Exclude({ toPlainOnly: true })
  deletedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  @Exclude({ toPlainOnly: true })
  deletedBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Exclude({ toPlainOnly: true })
  restoredBy: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Exclude({ toPlainOnly: true })
  deleteReason?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Exclude({ toPlainOnly: true })
  rejectionReason?: string | null;
  /* ================== META ================== */

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;


  @Column({ nullable: true })
  @Exclude({ toPlainOnly: true })
  verificationToken: string;

  @Column({ type: 'timestamp', nullable: true })
  @Exclude({ toPlainOnly: true })
  verificationExpires: Date;

  @BeforeInsert()
  generateVerificationDetails() {
    // Generate a secure random 32-character hex string
    this.verificationToken = crypto.randomBytes(32).toString('hex');

    // Set expiration to 24 hours from now
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);
    this.verificationExpires = expires;
  }

  @OneToMany(() => Order, (order) => order.buyer)
  orders: Order[];

   @OneToMany(() => Notification, (notification) => notification.recipient)
  notifications: Notification[];
}
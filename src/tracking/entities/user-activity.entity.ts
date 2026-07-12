export class Tracking {}
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Product } from 'src/products/entities/product.entity';

export enum ActivityType {
  VIEW = 'view',         // User opened product page
  CLICK = 'click',       // User clicked a product card
  SEARCH = 'search',     // User typed in the search bar
  CART_ADD = 'cart_add', // User added to basket
  PURCHASE = 'purchase', // User completed payment
}

@Entity('user_activities')
export class UserActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nullable because we might track guest users via session IDs
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  user: User;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'CASCADE' })
  product: Product;

  @Column({ type: 'enum', enum: ActivityType })
  activityType: ActivityType;

  @Column({ type: 'json', nullable: true })
  metadata: any; // { search_term: 'Corn', duration: 30, device: 'mobile' }

  @CreateDateColumn()
  createdAt: Date;
}
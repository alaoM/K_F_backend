import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Product } from 'src/products/entities/product.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  rating: number; // 1 to 5

  @Column({ type: 'text' })
  comment: string;

  // If true, frontend displays "Anonymous Buyer" instead of user name
  @Column({ default: false })
  isAnonymous: boolean;

  /* ---------------- RELATIONS ---------------- */
  
  // Nullable because you mentioned allowing guest/anonymous reviews
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  user: User;

  @ManyToOne(() => Product, (product) => product.reviews, { onDelete: 'CASCADE' })
  product: Product;

  /* ---------------- META ---------------- */
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
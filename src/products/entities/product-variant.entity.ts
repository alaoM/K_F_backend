import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, (product) => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ nullable: true })
  productId: string;

  @Column({ nullable: true })
  sku: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  colorHex: string;

  @Column({ nullable: true })
  size: string;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  price: number;

  @Column({ type: 'varchar', nullable: true })
  image: string;

  @Column({ type: 'json', nullable: true })
  attributes: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

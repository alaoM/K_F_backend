// src/orders/entities/order-item.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Order } from './order.entity';
import { Product, ProductType } from 'src/products/entities/product.entity';
import { SellerProfile } from 'src/seller/entities/seller-profile.entity';

export enum FulfillmentStatus {
  PENDING = 'pending',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  //Incase there is an order but the seller changes the modifies  the item on the stock, productSnapshotTitle, productSnapshotImage, productSnapshotCategory never changes

  @Column()
  productSnapshotTitle: string;

  @Column()
  productSnapshotImage: string;


  @Column({ type: 'enum', enum: ProductType, default: ProductType.PHYSICAL })
  typeSnapshot: ProductType;


  @Column({ nullable: true })
  productSnapshotCategory: string;

  @ManyToOne(() => Order, (order) => order.items)
  order: Order;

  @ManyToOne(() => Product)
  product: Product;

  @ManyToOne(() => SellerProfile)
  seller: SellerProfile; // This allows sellers to see "their" part of an order

  @Column()
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  priceAtPurchase: number; // Capture the price at the moment of checkout

  @Column({ type: 'text', nullable: true })
  noteToSeller?: string;

  @Column({
    type: 'enum',
    enum: FulfillmentStatus,
    default: FulfillmentStatus.PENDING
  })
  fulfillmentStatus: FulfillmentStatus;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  commissionRate: number | null;
}
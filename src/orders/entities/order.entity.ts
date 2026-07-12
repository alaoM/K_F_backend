// src/orders/entities/order.entity.ts
import { User } from "src/users/entities/user.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { OrderStatus } from "../orders.enum";
import { OrderItem } from "./order-item.entity";

export enum PaymentMethod {
  PAYSTACK = 'paystack',
  FLUTTERWAVE = 'flutterwave',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.orders)
  buyer: User;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number; // Sum of (item price * quantity)

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  platformFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  paymentGatewayFee: number; // Paystack's 1.5% + 100 cut

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number; // Total amount the buyer pays (Subtotal + any shipping)

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING
  })
  status: OrderStatus;

  @Column({ default: 'unpaid' }) // unpaid, escrow_held, released, refunded
  paymentStatus: string;

  @Column({ type: 'text', nullable: true })
  shippingAddress: string;

  @Column({ type: 'text', nullable: true })
  noteToSeller?: string;


  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ unique: true, nullable: true })
  paymentReference: string;


  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.PAYSTACK })
  paymentMethod: PaymentMethod;


  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;
}
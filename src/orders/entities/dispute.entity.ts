import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, JoinColumn, CreateDateColumn, OneToMany, UpdateDateColumn } from 'typeorm';
import { Order } from './order.entity';
import { DisputeMessage } from './dispute-messages';
import { User } from 'src/users/entities/user.entity'; // Import User

export enum DisputeStatus {
    OPEN = 'open',
    AWAITING_BUYER = 'awaiting_buyer',
    AWAITING_SELLER = 'awaiting_seller',
    AWAITING_RESPONSE = 'awaiting_response',
    ESCALATED = 'escalated',
    CLOSED = 'closed',
    RESOLVED_REFUNDED = 'resolved_refunded',
    RESOLVED_RELEASED = 'resolved_released'
}

export enum DisputePriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high'
}

@Entity('disputes')
export class Dispute {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @OneToOne(() => Order)
    @JoinColumn()
    order: Order;

    // ADD THIS: The relationship that was missing
    @ManyToOne(() => User)
    buyer: User;

    @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
    status: DisputeStatus;

    @Column({
        type: 'enum',
        enum: DisputePriority,
        default: DisputePriority.MEDIUM
    })
    priority: DisputePriority;

    @Column()
    reason: string;

    @Column({ type: 'text', nullable: true }) // Make nullable so it doesn't fail on create
    adminResolutionNote: string;

    @OneToMany(() => DisputeMessage, (msg) => msg.dispute)
    messages: DisputeMessage[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
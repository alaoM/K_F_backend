import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from 'src/users/entities/user.entity';

export enum NotificationType {
  ORDER = 'order',
  PAYOUT = 'payout',
  DISPUTE = 'dispute',
  SYSTEM = 'system',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.SYSTEM })
  type: NotificationType;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  link: string; 

  @ManyToOne(() => User, (user) => user.notifications, { 
    onDelete: 'CASCADE' 
  })
  recipient: User;

  @CreateDateColumn()
  createdAt: Date;
}
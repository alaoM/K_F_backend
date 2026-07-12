import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Dispute } from "./dispute.entity";
import { User } from "src/users/entities/user.entity";

@Entity('dispute_messages')
export class DisputeMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Dispute, (d) => d.messages)
  dispute: Dispute;

  @ManyToOne(() => User)
  sender: User;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'simple-array', nullable: true })
  attachments: string[]; // Photos of the evidence

  @CreateDateColumn()
  createdAt: Date;
}
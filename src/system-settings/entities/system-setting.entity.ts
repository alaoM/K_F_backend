import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";


@Entity()
export class SystemSettings {
    @PrimaryColumn()
    key: string; // e.g., 'COMMISSION_PERCENT'

    @Column({ type: 'text' })
    value: string; // Store as string, parse as needed

    @UpdateDateColumn()
    updatedAt: Date;
}

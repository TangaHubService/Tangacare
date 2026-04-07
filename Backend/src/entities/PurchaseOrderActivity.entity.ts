import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from './PurchaseOrder.entity';
import { User } from './User.entity';

export enum ActivityAction {
    CREATED = 'created',
    UPDATED = 'updated',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    CANCELLED = 'cancelled',
    SENT = 'sent',
    SUBMITTED = 'submitted',
    QUOTED = 'quoted',
    VIEWED = 'viewed',
    CONFIRMED = 'confirmed',
    CLARIFICATION_REQUESTED = 'clarification_requested',
    COMMENTED = 'commented',
}

export enum ActivityActorType {
    USER = 'user',
    SUPPLIER = 'supplier',
    SYSTEM = 'system',
}

@Entity('purchase_order_activities')
export class PurchaseOrderActivity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    purchase_order_id: number;

    @Column({
        type: 'enum',
        enum: ActivityAction,
    })
    action: ActivityAction;

    @Column({
        type: 'enum',
        enum: ActivityActorType,
    })
    actor_type: ActivityActorType;

    @Column({ type: 'int', nullable: true })
    user_id: number;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata: any;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @ManyToOne(() => PurchaseOrder, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'purchase_order_id' })
    purchase_order: PurchaseOrder;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'user_id' })
    user: User;
}

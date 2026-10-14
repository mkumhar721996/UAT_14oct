import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type OrderType = 'parent' | 'child';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'distributor_id', type: 'uuid' })
  distributorId!: string;

  @Column({ name: 'cart_id', type: 'uuid', nullable: true })
  cartId!: string | null;

  @Column({ name: 'order_type', type: 'text' })
  orderType!: OrderType;

  @Column({ name: 'parent_order_id', type: 'uuid', nullable: true })
  parentOrderId!: string | null;

  @Column({ name: 'sap_instance', type: 'text', nullable: true })
  sapInstance!: string | null;

  @Column({ name: 'placement_status', type: 'text', default: 'pending' })
  placementStatus!: string;

  @Column({ name: 'sap_order_number', type: 'text', nullable: true })
  sapOrderNumber!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

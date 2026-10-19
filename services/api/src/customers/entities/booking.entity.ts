import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ServiceType } from '../service-types';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'customer_sub', type: 'text' })
  customerSub!: string;

  @Column({ name: 'service_type', type: 'text' })
  serviceType!: ServiceType;

  @Column({ type: 'text', default: 'Requested' })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

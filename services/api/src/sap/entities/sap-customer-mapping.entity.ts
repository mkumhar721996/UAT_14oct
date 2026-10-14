import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('sap_customer_mappings')
export class SapCustomerMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'distributor_id', type: 'uuid' })
  distributorId!: string;

  @Column({ name: 'sap_instance', type: 'text' })
  sapInstance!: string;

  @Column({ name: 'sap_customer_number', type: 'text' })
  sapCustomerNumber!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

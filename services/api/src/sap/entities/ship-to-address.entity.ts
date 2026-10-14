import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('ship_to_addresses')
export class ShipToAddress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'distributor_id', type: 'uuid' })
  distributorId!: string;

  @Column({ name: 'address_line1', type: 'text' })
  addressLine1!: string;

  @Column({ name: 'address_line2', type: 'text', nullable: true })
  addressLine2!: string | null;

  @Column({ type: 'text' })
  city!: string;

  @Column({ type: 'text', nullable: true })
  region!: string | null;

  @Column({ name: 'postal_code', type: 'text' })
  postalCode!: string;

  @Column({ name: 'country_code', type: 'text' })
  countryCode!: string;

  @Column({ name: 'sap_ship_to_number', type: 'text', nullable: true })
  sapShipToNumber!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

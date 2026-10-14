import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('cart_line_items')
export class CartLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'cart_id', type: 'uuid' })
  cartId!: string;

  @Column({ name: 'sap_material_number', type: 'text' })
  sapMaterialNumber!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

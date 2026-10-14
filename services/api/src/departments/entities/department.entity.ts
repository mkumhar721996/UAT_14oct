import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ name: 'manager_id', type: 'uuid' })
  managerId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'distributor_id', type: 'uuid' })
  distributorId!: string;

  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId!: string | null;

  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

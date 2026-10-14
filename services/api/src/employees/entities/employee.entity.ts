import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

const numeric = {
  to: (v?: number | null) => v,
  from: (v?: string | null) => (v === null || v === undefined ? null : Number(v)),
};

@Entity('employees')
@Index(['tenantId', 'employeeNumber'], { unique: true })
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'employee_number', type: 'text' })
  employeeNumber!: string;

  @Column({ name: 'full_name', type: 'text' })
  fullName!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'job_title', type: 'text', nullable: true })
  jobTitle!: string | null;

  @Column({ type: 'text', nullable: true })
  department!: string | null;

  @Column({ name: 'contract_type', type: 'text', nullable: true })
  contractType!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numeric })
  salary!: number | null;

  @Column({ name: 'personal_email', type: 'text', nullable: true })
  personalEmail!: string | null;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

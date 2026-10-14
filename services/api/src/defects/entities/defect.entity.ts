import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DefectSeverity } from '../defect-severities';

@Entity('defects')
export class Defect {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text' })
  severity!: DefectSeverity;

  @Column({ name: 'steps_to_reproduce', type: 'text' })
  stepsToReproduce!: string;

  @Column({ name: 'expected_result', type: 'text', nullable: true })
  expectedResult!: string | null;

  @Column({ name: 'actual_result', type: 'text', nullable: true })
  actualResult!: string | null;

  @Column({ type: 'text', nullable: true })
  environment!: string | null;

  @Column({ type: 'text', default: 'New' })
  status!: string;

  @Column({ name: 'reported_by', type: 'text' })
  reportedBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

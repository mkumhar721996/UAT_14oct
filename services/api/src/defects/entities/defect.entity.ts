import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('defects')
export class Defect {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @Column({ name: 'defect_number', type: 'text' }) defectNumber!: string;
  @Column({ type: 'text' }) title!: string;
  @Column({ type: 'text' }) description!: string;
  @Column({ name: 'repro_steps', type: 'text' }) reproSteps!: string;
  @Column({ type: 'text' }) severity!: string;
  @Column({ type: 'text', nullable: true }) priority!: string | null;
  @Column({ type: 'text' }) type!: string;
  @Column({ type: 'text' }) status!: string;
  @Column({ name: 'triaged_at', type: 'timestamptz', nullable: true }) triagedAt!: Date | null;
  @Column({ name: 'reporter_id', type: 'text' }) reporterId!: string;
  @Column({ name: 'reporter_name', type: 'text', nullable: true }) reporterName!: string | null;
  @Column({ name: 'assignee_id', type: 'text', nullable: true }) assigneeId!: string | null;
  @Column({ name: 'assignee_name', type: 'text', nullable: true }) assigneeName!: string | null;
  @Column({ name: 'expected_result', type: 'text', nullable: true }) expectedResult!: string | null;
  @Column({ name: 'actual_result', type: 'text', nullable: true }) actualResult!: string | null;
  @Column({ type: 'text', nullable: true }) environment!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

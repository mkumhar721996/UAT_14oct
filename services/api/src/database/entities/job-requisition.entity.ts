import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export const REQUISITION_STATUSES = [
  'draft',
  'pending_approval',
  'open',
  'rejected',
] as const;

export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];

export interface PipelineCandidate {
  name: string;
  stage: string;
}

@Entity('job_requisitions')
export class JobRequisition {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'varchar', nullable: true })
  department!: string | null;

  @Column({ type: 'varchar', nullable: true })
  location!: string | null;

  @Column({ name: 'employment_type', type: 'varchar', default: 'Full-time' })
  employmentType!: string;

  @Column({ type: 'int', default: 1 })
  headcount!: number;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'salary_min', type: 'int', nullable: true })
  salaryMin!: number | null;

  @Column({ name: 'salary_max', type: 'int', nullable: true })
  salaryMax!: number | null;

  @Column({ name: 'hiring_manager_id', type: 'varchar' })
  hiringManagerId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'hiring_manager_id' })
  hiringManager?: User;

  @Column({ type: 'varchar', default: 'draft' })
  status!: RequisitionStatus;

  /** Placeholder for the candidate pipeline, which is owned by a later story. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  pipeline!: PipelineCandidate[];

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'approved_by', type: 'varchar', nullable: true })
  approvedBy!: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'rejected_by', type: 'varchar', nullable: true })
  rejectedBy!: string | null;

  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt!: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ name: 'last_saved_at', type: 'timestamptz', nullable: true })
  lastSavedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

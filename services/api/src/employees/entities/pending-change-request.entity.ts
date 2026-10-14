import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';

@Entity('pending_change_requests')
@Index(['tenantId', 'status'])
export class PendingChangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Column({ type: 'text' })
  field!: string;

  @Column({ name: 'requested_value', type: 'text' })
  requestedValue!: string;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'text', default: 'pending' })
  status!: ChangeRequestStatus;

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'resolved_by', type: 'text', nullable: true })
  resolvedBy!: string | null;
}

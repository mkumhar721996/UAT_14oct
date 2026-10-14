import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Append-only: nothing in the codebase updates or deletes these rows. */
@Entity('employment_history_entries')
@Index(['tenantId', 'employeeId'])
export class EmploymentHistoryEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Column({ type: 'text' })
  field!: string;

  @Column({ name: 'previous_value', type: 'text', nullable: true })
  previousValue!: string | null;

  @Column({ name: 'new_value', type: 'text', nullable: true })
  newValue!: string | null;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate!: string;

  @CreateDateColumn({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ name: 'recorded_by', type: 'text', nullable: true })
  recordedBy!: string | null;
}

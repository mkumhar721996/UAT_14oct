import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('retry_queue')
export class RetryQueueEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'child_order_id', type: 'uuid' })
  childOrderId!: string;

  @Column({ name: 'distributor_id', type: 'uuid' })
  distributorId!: string;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ name: 'attempt_limit', type: 'int', default: 3 })
  attemptLimit!: number;

  @Column({ name: 'initial_interval_seconds', type: 'int', default: 30 })
  initialIntervalSeconds!: number;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt!: Date | null;

  @Column({ type: 'text', default: 'pending' })
  status!: string;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'owner_sub', type: 'text' })
  ownerSub!: string;

  /** numeric(12,2) comes back from Postgres as a string, e.g. "12.50". */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  /** A calendar date (YYYY-MM-DD) with no timezone. */
  @Column({ name: 'expense_date', type: 'date' })
  expenseDate!: string;

  @Column({ type: 'text' })
  merchant!: string;

  @Column({ type: 'text' })
  category!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

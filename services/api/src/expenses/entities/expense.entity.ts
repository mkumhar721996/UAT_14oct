import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ExpenseCategory } from '../expense-categories';

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'user_sub', type: 'text' })
  userSub!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string | number;

  @Column({ type: 'text' })
  currency!: string;

  @Column({ name: 'spent_on', type: 'date' })
  spentOn!: string;

  @Column({ type: 'text', nullable: true })
  merchant!: string | null;

  @Column({ type: 'text' })
  category!: ExpenseCategory;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

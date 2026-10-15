import { Column, Entity, PrimaryColumn } from 'typeorm';

export type EmploymentStatus = 'active' | 'terminated';

/** Minimal local projection of an employee, used for role checks on requisition owners. */
@Entity('users')
export class User {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  role!: string;

  @Column({ name: 'employment_status', type: 'varchar', default: 'active' })
  employmentStatus!: EmploymentStatus;
}

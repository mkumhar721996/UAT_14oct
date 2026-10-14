import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { EmploymentHistoryEntry } from '../employees/entities/employment-history-entry.entity';
import { PendingChangeRequest } from '../employees/entities/pending-change-request.entity';
import { CreateEmployeesSchema1700000000000 } from './migrations/1700000000000-create-employees-schema';
import { UniquePendingChangeRequest1700000000001 } from './migrations/1700000000001-unique-pending-change-request';
import { EmployeeLifecycleStatus1700000000002 } from './migrations/1700000000002-employee-lifecycle-status';

export const dataSourceOptions = (): DataSourceOptions => ({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Employee, EmploymentHistoryEntry, PendingChangeRequest],
  migrations: [CreateEmployeesSchema1700000000000, UniquePendingChangeRequest1700000000001, EmployeeLifecycleStatus1700000000002],
});

// Used by the TypeORM CLI for running migrations.
export default new DataSource(dataSourceOptions());

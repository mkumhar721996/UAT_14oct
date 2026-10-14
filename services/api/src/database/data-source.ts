import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Department } from '../departments/entities/department.entity';
import { Employee } from '../employees/entities/employee.entity';
import { EmploymentHistoryEntry } from '../employees/entities/employment-history-entry.entity';
import { PendingChangeRequest } from '../employees/entities/pending-change-request.entity';
import { CreateEmployeesSchema1700000000000 } from './migrations/1700000000000-create-employees-schema';
import { CreateDepartmentsAndReportingLines1700000000002 } from './migrations/1700000000002-create-departments-and-reporting-lines';
import { UniquePendingChangeRequest1700000000001 } from './migrations/1700000000001-unique-pending-change-request';

export const dataSourceOptions = (): DataSourceOptions => ({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Employee, EmploymentHistoryEntry, PendingChangeRequest, Department],
  migrations: [CreateEmployeesSchema1700000000000, UniquePendingChangeRequest1700000000001, CreateDepartmentsAndReportingLines1700000000002],
});

// Used by the TypeORM CLI for running migrations.
export default new DataSource(dataSourceOptions());

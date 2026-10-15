import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Defect } from '../defects/entities/defect.entity';
import { Employee } from '../employees/entities/employee.entity';
import { EmploymentHistoryEntry } from '../employees/entities/employment-history-entry.entity';
import { PendingChangeRequest } from '../employees/entities/pending-change-request.entity';
import { CreateEmployeesSchema1700000000000 } from './migrations/1700000000000-create-employees-schema';
import { AddDefectPriorityAssignee1700000000003 } from './migrations/1700000000003-add-defect-priority-assignee';
import { CreateDefectsSchema1700000000002 } from './migrations/1700000000002-create-defects-schema';
import { UniquePendingChangeRequest1700000000001 } from './migrations/1700000000001-unique-pending-change-request';

export const dataSourceOptions = (): DataSourceOptions => ({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Employee, EmploymentHistoryEntry, PendingChangeRequest, Defect],
  migrations: [CreateEmployeesSchema1700000000000, UniquePendingChangeRequest1700000000001, CreateDefectsSchema1700000000002, AddDefectPriorityAssignee1700000000003],
});

// Used by the TypeORM CLI for running migrations.
export default new DataSource(dataSourceOptions());

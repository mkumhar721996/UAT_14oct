import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { EmploymentHistoryEntry } from '../employees/entities/employment-history-entry.entity';
import { PendingChangeRequest } from '../employees/entities/pending-change-request.entity';
import { JobRequisition } from './entities/job-requisition.entity';
import { User } from './entities/user.entity';
import { CreateEmployeesSchema1700000000000 } from './migrations/1700000000000-create-employees-schema';
import { UniquePendingChangeRequest1700000000001 } from './migrations/1700000000001-unique-pending-change-request';
import { CreateRequisitions1760000000000 } from './migrations/1760000000000-create-requisitions';

export const dataSourceOptions = (): DataSourceOptions => {
  const isTest = process.env.NODE_ENV === 'test';
  return {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User, JobRequisition, Employee, EmploymentHistoryEntry, PendingChangeRequest],
    migrations: [
      CreateEmployeesSchema1700000000000,
      UniquePendingChangeRequest1700000000001,
      CreateRequisitions1760000000000,
    ],
    // Schema comes from the committed migrations everywhere except test databases.
    synchronize: isTest,
    migrationsRun: !isTest,
  };
};

// Used by the TypeORM CLI for running migrations.
export default new DataSource(dataSourceOptions());

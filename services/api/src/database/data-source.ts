import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { JobRequisition } from './entities/job-requisition.entity';
import { User } from './entities/user.entity';
import { CreateRequisitions1760000000000 } from './migrations/1760000000000-create-requisitions';

export function buildDataSourceOptions(): DataSourceOptions {
  const isTest = process.env.NODE_ENV === 'test';
  return {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User, JobRequisition],
    migrations: [CreateRequisitions1760000000000],
    // Schema comes from the committed migration everywhere except test databases.
    synchronize: isTest,
    migrationsRun: !isTest,
  };
}

export default new DataSource(buildDataSourceOptions());

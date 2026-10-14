import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Cart } from '../carts/entities/cart.entity';
import { CartLineItem } from '../carts/entities/cart-line-item.entity';
import { Defect } from '../defects/entities/defect.entity';
import { Distributor } from '../distributors/entities/distributor.entity';
import { Employee } from '../employees/entities/employee.entity';
import { EmploymentHistoryEntry } from '../employees/entities/employment-history-entry.entity';
import { PendingChangeRequest } from '../employees/entities/pending-change-request.entity';
import { Order } from '../orders/entities/order.entity';
import { RetryQueueEntry } from '../orders/entities/retry-queue-entry.entity';
import { Permission } from '../rbac/entities/permission.entity';
import { Role } from '../rbac/entities/role.entity';
import { SapCustomerMapping } from '../sap/entities/sap-customer-mapping.entity';
import { ShipToAddress } from '../sap/entities/ship-to-address.entity';
import { User } from '../users/entities/user.entity';
import { CreateEmployeesSchema1700000000000 } from './migrations/1700000000000-create-employees-schema';
import { UniquePendingChangeRequest1700000000001 } from './migrations/1700000000001-unique-pending-change-request';
import { CreateDefectsSchema1700000000002 } from './migrations/1700000000002-create-defects-schema';
import { CreateDistributorsAndRbacSchema1700000000003 } from './migrations/1700000000003-create-distributors-and-rbac-schema';
import { CreateSapMappingsAndShipToPlaceholder1700000000004 } from './migrations/1700000000004-create-sap-mappings-and-shipto-placeholder';
import { CreateCartsAndOrdersSchema1700000000005 } from './migrations/1700000000005-create-carts-and-orders-schema';
import { ReplaceShipToPlaceholderWithWomStructure1700000000006 } from './migrations/1700000000006-replace-shipto-placeholder-with-wom-structure';

export const entities = [
  Employee, EmploymentHistoryEntry, PendingChangeRequest, Defect,
  Distributor, Role, Permission, User, SapCustomerMapping, ShipToAddress,
  Cart, CartLineItem, Order, RetryQueueEntry,
];

export const migrations = [
  CreateEmployeesSchema1700000000000,
  UniquePendingChangeRequest1700000000001,
  CreateDefectsSchema1700000000002,
  CreateDistributorsAndRbacSchema1700000000003,
  CreateSapMappingsAndShipToPlaceholder1700000000004,
  CreateCartsAndOrdersSchema1700000000005,
  ReplaceShipToPlaceholderWithWomStructure1700000000006,
];

export const dataSourceOptions = (): DataSourceOptions => ({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities,
  migrations,
});

// Used by the TypeORM CLI for running migrations.
export default new DataSource(dataSourceOptions());

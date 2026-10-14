import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { PendingChangeRequestsController } from './pending-change-requests.controller';

@Module({
  imports: [AuthModule],
  controllers: [EmployeesController, PendingChangeRequestsController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}

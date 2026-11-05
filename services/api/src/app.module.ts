import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomersModule } from './customers/customers.module';
import { DatabaseModule } from './database/typeorm.module';
import { InventoryModule } from './inventory/inventory.module';
import { DefectsModule } from './defects/defects.module';
import { EmployeesModule } from './employees/employees.module';
import { RevalidationModule } from './revalidation/revalidation.module';
import { ExpensesModule } from './expenses/expenses.module';

@Module({
  imports: [DatabaseModule, EmployeesModule, DefectsModule, CustomersModule, InventoryModule, RevalidationModule, ExpensesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

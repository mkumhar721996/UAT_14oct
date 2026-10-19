import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomersModule } from './customers/customers.module';
import { DatabaseModule } from './database/typeorm.module';
import { InventoryModule } from './inventory/inventory.module';
import { DefectsModule } from './defects/defects.module';
import { EmployeesModule } from './employees/employees.module';
import { PagesModule } from './pages/pages.module';
import { RevalidationModule } from './revalidation/revalidation.module';

@Module({
  imports: [
    DatabaseModule,
    EmployeesModule,
    DefectsModule,
    CustomersModule,
    InventoryModule,
    PagesModule,
    RevalidationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

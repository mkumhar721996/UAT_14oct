import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomersModule } from './customers/customers.module';
import { DatabaseModule } from './database/typeorm.module';
import { DefectsModule } from './defects/defects.module';
import { EmployeesModule } from './employees/employees.module';

@Module({
  imports: [DatabaseModule, EmployeesModule, DefectsModule, CustomersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

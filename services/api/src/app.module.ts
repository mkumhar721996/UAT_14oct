import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/typeorm.module';
import { EmployeesModule } from './employees/employees.module';
import { RequisitionsModule } from './requisitions/requisitions.module';

@Module({
  imports: [DatabaseModule, EmployeesModule, RequisitionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/typeorm.module';
import { DefectsModule } from './defects/defects.module';
import { EmployeesModule } from './employees/employees.module';

@Module({
  imports: [DatabaseModule, EmployeesModule, DefectsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ServiceTypesController } from './service-types.controller';
import { ServiceTypesService } from './service-types.service';

@Module({
  imports: [AuthModule],
  controllers: [ServiceTypesController],
  providers: [ServiceTypesService],
})
export class ServiceTypesModule {}

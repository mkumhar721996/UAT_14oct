import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DefectsController } from './defects.controller';
import { DefectsService } from './defects.service';

@Module({
  imports: [AuthModule],
  controllers: [DefectsController],
  providers: [DefectsService],
})
export class DefectsModule {}

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActorMiddleware } from '../auth/actor.middleware';
import { JobRequisition } from '../database/entities/job-requisition.entity';
import { User } from '../database/entities/user.entity';
import { DevSeedService } from './dev-seed.service';
import {
  JobBoardController,
  RequisitionsController,
} from './requisitions.controller';
import { RequisitionsService } from './requisitions.service';

@Module({
  imports: [TypeOrmModule.forFeature([JobRequisition, User])],
  controllers: [RequisitionsController, JobBoardController],
  providers: [RequisitionsService, DevSeedService],
})
export class RequisitionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ActorMiddleware).forRoutes('*');
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { buildDataSourceOptions } from './database/data-source';
import { RequisitionsModule } from './requisitions/requisitions.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(buildDataSourceOptions()),
    RequisitionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

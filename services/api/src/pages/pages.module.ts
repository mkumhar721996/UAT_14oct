import { Module } from '@nestjs/common';
import { DrupalModule } from '../drupal/drupal.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [DrupalModule],
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesModule {}

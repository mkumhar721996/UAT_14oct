import { Controller, Get, Param } from '@nestjs/common';
import { PagesService } from './pages.service';

// Unguarded on purpose: a published marketing page is visible to anonymous visitors.
@Controller('pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get('landing-page/:pageId')
  getLandingPage(@Param('pageId') pageId: string) {
    return this.pages.getLandingPage(pageId);
  }
}

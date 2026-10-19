import { Module } from '@nestjs/common';
import { createResourceRegistry } from '../drupal/resource-registry';
import { createRevalidationRegistry } from '../drupal/revalidation-registry';
import { registerClientWorkParagraphs } from './client-work/client-work-paragraphs';
import { createPageCache } from './page-cache';
import { PagesController } from './pages.controller';
import { CLIENT_WORK_RESOURCE_REGISTRY, PagesService } from './pages.service';
import { PAGE_CACHE, REVALIDATION_REGISTRY } from './pages.tokens';

@Module({
  controllers: [PagesController],
  providers: [
    PagesService,
    { provide: REVALIDATION_REGISTRY, useFactory: createRevalidationRegistry },
    { provide: PAGE_CACHE, useFactory: createPageCache, inject: [REVALIDATION_REGISTRY] },
    {
      provide: CLIENT_WORK_RESOURCE_REGISTRY,
      useFactory: () => {
        const registry = createResourceRegistry();
        registerClientWorkParagraphs(registry);
        return registry;
      },
    },
  ],
})
export class PagesModule {}

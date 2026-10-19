import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { RESOURCE_REGISTRY, REVALIDATION_REGISTRY } from './drupal.tokens';
import { createMediaImageFetcher } from './media-fetcher';
import { createResourceRegistry, type ResourceRegistry } from './resource-registry';
import { createRevalidationRegistry } from './revalidation-registry';

export { RESOURCE_REGISTRY, REVALIDATION_REGISTRY };

// The registry's stale mark is the handoff contract: the shared `POST /revalidation` route
// (RevalidationModule) marks a tag stale here, and a consumer in this process (e.g. PagesService)
// reads isStale(tag) to refetch. It is per-process in-memory; a multi-instance API must share
// (or replace) it.
@Module({
  providers: [
    { provide: RESOURCE_REGISTRY, useFactory: createResourceRegistry },
    { provide: REVALIDATION_REGISTRY, useFactory: createRevalidationRegistry },
  ],
  exports: [RESOURCE_REGISTRY, REVALIDATION_REGISTRY],
})
export class DrupalModule implements OnModuleInit {
  constructor(@Inject(RESOURCE_REGISTRY) private readonly registry: ResourceRegistry) {}

  onModuleInit() {
    this.registry.register({ jsonApiType: 'media--image', fetcher: createMediaImageFetcher() });
  }
}

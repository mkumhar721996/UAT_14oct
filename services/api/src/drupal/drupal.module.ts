import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { RESOURCE_REGISTRY, REVALIDATION_REGISTRY } from './drupal.tokens';
import { createMediaImageFetcher } from './media-fetcher';
import { createResourceRegistry, type ResourceRegistry } from './resource-registry';
import { RevalidationController } from './revalidation.controller';
import { createRevalidationRegistry } from './revalidation-registry';

export { RESOURCE_REGISTRY, REVALIDATION_REGISTRY };

@Module({
  controllers: [RevalidationController],
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

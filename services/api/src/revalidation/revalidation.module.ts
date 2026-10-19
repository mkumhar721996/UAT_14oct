import { Module } from '@nestjs/common';
import { createRevalidationRegistry } from '../drupal/revalidation-registry';
import { RevalidationController } from './revalidation.controller';
import { REVALIDATION_REGISTRY } from './revalidation.tokens';
import { RevalidationSecretGuard } from './revalidation-secret.guard';

export { REVALIDATION_REGISTRY };

@Module({
  controllers: [RevalidationController],
  providers: [RevalidationSecretGuard, { provide: REVALIDATION_REGISTRY, useFactory: () => createRevalidationRegistry() }],
})
export class RevalidationModule {}

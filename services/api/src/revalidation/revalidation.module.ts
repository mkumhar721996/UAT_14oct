import { Module } from '@nestjs/common';
import { createRevalidationRegistry } from '../drupal/revalidation-registry';
import { RevalidationController } from './revalidation.controller';
import { REVALIDATION_REGISTRY } from './revalidation.tokens';
import { RevalidationSecretGuard } from './revalidation-secret.guard';

// The registry's stale mark is the handoff contract: a consumer in this process reads isStale(tag) to refetch.
// It is per-process in-memory; Phase 2 must share it (or replace it) if the API runs multiple instances.
@Module({
  controllers: [RevalidationController],
  providers: [RevalidationSecretGuard, { provide: REVALIDATION_REGISTRY, useFactory: () => createRevalidationRegistry() }],
})
export class RevalidationModule {}

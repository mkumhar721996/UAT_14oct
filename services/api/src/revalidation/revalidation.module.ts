import { Module } from '@nestjs/common';
import { DrupalModule } from '../drupal/drupal.module';
import { RevalidationController } from './revalidation.controller';
import { RevalidationSecretGuard } from './revalidation-secret.guard';

// The registry's stale mark is the handoff contract: a consumer in this process reads isStale(tag) to refetch.
// It is per-process in-memory; Phase 2 must share it (or replace it) if the API runs multiple instances.
// The registry itself is owned by DrupalModule (imported here, not re-created) so this route marks
// the exact same instance that PagesService reads from.
@Module({
  imports: [DrupalModule],
  controllers: [RevalidationController],
  providers: [RevalidationSecretGuard],
})
export class RevalidationModule {}

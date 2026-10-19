import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import type { RevalidationRegistry } from '../drupal/revalidation-registry';
import { RevalidateDto } from './dto/revalidate.dto';
import { REVALIDATION_REGISTRY } from './revalidation.tokens';
import { RevalidationSecretGuard } from './revalidation-secret.guard';

@Controller('revalidation')
@UseGuards(RevalidationSecretGuard)
export class RevalidationController {
  constructor(@Inject(REVALIDATION_REGISTRY) private readonly registry: RevalidationRegistry) {}

  @Post()
  @HttpCode(200)
  revalidate(@Body() dto: RevalidateDto): { revalidated: true; tag: string } {
    this.registry.markStale(dto.tag);
    return { revalidated: true, tag: dto.tag };
  }
}

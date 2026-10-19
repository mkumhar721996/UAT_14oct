import { Body, Controller, Headers, Inject, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { RevalidateDto } from './dto/revalidate.dto';
import { REVALIDATION_REGISTRY } from './drupal.tokens';
import type { RevalidationRegistry } from './revalidation-registry';
import { isValidRevalidationToken } from './revalidation-token';

// Called by Drupal's webhook, not a signed-in user: authorized by the shared secret instead.
@Controller('revalidation')
export class RevalidationController {
  private readonly logger = new Logger(RevalidationController.name);

  constructor(@Inject(REVALIDATION_REGISTRY) private readonly revalidation: RevalidationRegistry) {}

  @Post()
  revalidate(@Headers('authorization') authorization: string | undefined, @Body() dto: RevalidateDto) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    if (!isValidRevalidationToken(token)) {
      // Never log the token itself, valid or not.
      this.logger.warn(`revalidation_outcome count=1 outcome=rejected tag=${dto.tag}`);
      throw new UnauthorizedException('Invalid or missing revalidation token');
    }
    this.revalidation.markStale(dto.tag);
    this.logger.log(`revalidation_outcome count=1 outcome=accepted tag=${dto.tag}`);
    return { revalidated: true, tag: dto.tag };
  }
}

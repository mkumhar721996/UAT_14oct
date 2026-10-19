import { Body, Controller, Headers, Inject, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { RevalidateDto } from './dto/revalidate.dto';
import { REVALIDATION_REGISTRY } from './drupal.tokens';
import type { RevalidationRegistry } from './revalidation-registry';
import { isValidRevalidationToken } from './revalidation-token';

const MAX_LOGGED_TAG_LENGTH = 200;

// Strips control characters (the CR/LF log-injection vector) and caps length before a
// caller-supplied value is ever written to a log line, independent of the DTO's own validation.
function sanitizeForLog(value: string): string {
  const stripped = value.replace(/[\x00-\x1F\x7F]/g, '');
  return JSON.stringify(stripped.slice(0, MAX_LOGGED_TAG_LENGTH));
}

// Called by Drupal's webhook, not a signed-in user: authorized by the shared secret instead.
@Controller('revalidation')
export class RevalidationController {
  private readonly logger = new Logger(RevalidationController.name);

  constructor(@Inject(REVALIDATION_REGISTRY) private readonly revalidation: RevalidationRegistry) {}

  @Post()
  revalidate(@Headers('authorization') authorization: string | undefined, @Body() dto: RevalidateDto) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    if (!isValidRevalidationToken(token)) {
      // Unauthenticated input: never log the token, or the caller-supplied tag, even sanitized.
      this.logger.warn('revalidation_outcome count=1 outcome=rejected');
      throw new UnauthorizedException('Invalid or missing revalidation token');
    }
    this.revalidation.markStale(dto.tag);
    this.logger.log(`revalidation_outcome count=1 outcome=accepted tag=${sanitizeForLog(dto.tag)}`);
    return { revalidated: true, tag: dto.tag };
  }
}

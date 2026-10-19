import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { RevalidationRegistry } from '../drupal/revalidation-registry';
import type { PageCache } from './page-cache';
import { isCacheablePage, PageNotFoundError, PagesService } from './pages.service';
import { PAGE_CACHE, REVALIDATION_REGISTRY } from './pages.tokens';
import { RevalidationSecretGuard } from './revalidation-secret.guard';

const DEFAULT_PAGE_CACHE_TTL_MS = 5 * 60 * 1000;

function pageCacheTtlMs(): number {
  const ttl = Number(process.env.PAGE_CACHE_TTL_MS);
  return Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_PAGE_CACHE_TTL_MS;
}

// Public: published marketing pages are viewable without sign-in.
@Controller('pages')
export class PagesController {
  constructor(
    private readonly pages: PagesService,
    @Inject(PAGE_CACHE) private readonly cache: PageCache,
    @Inject(REVALIDATION_REGISTRY) private readonly revalidation: RevalidationRegistry,
  ) {}

  @Get('client-work/:id')
  async clientWork(@Param('id') id: string) {
    try {
      return await this.cache.getOrCompose(`node:${id}`, pageCacheTtlMs(), () =>
        this.pages.composeClientWorkPage(id),
        isCacheablePage,
      );
    } catch (error) {
      if (error instanceof PageNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }

  // Idempotent: only sets a stale flag, so an uncached tag is not an error.
  @Post('revalidate')
  @HttpCode(200)
  @UseGuards(RevalidationSecretGuard)
  revalidate(@Body() body: { tag?: unknown }) {
    if (typeof body?.tag !== 'string' || !body.tag.trim()) {
      throw new BadRequestException('tag is required');
    }
    this.revalidation.markStale(body.tag);
    return { revalidated: true, tag: body.tag };
  }
}

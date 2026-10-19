import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RecordPageReviewDto } from './dto/record-page-review.dto';
import { fetchPublishedPages } from './drupal-page-catalog';
import { PageReview } from './entities/page-review.entity';
import { TemplateType } from './template-type';

export interface InventoryEntry {
  pageId: string;
  templateType: TemplateType;
  title: string;
  path: string | null;
  reviewerName: string | null;
  reviewDate: string | null;
  status: 'pass' | 'fail' | null;
}

@Injectable()
export class InventoryService {
  constructor(private readonly dataSource: DataSource) {}

  // Iterates the live catalog only, so a review for an unpublished/deleted page is never listed.
  async buildInventory(env?: NodeJS.ProcessEnv): Promise<InventoryEntry[]> {
    const pages = await fetchPublishedPages(env);
    const reviews = await this.dataSource.getRepository(PageReview).find();
    const byPageId = new Map(reviews.map((r) => [r.pageId, r]));
    return pages.map((p) => {
      const review = byPageId.get(p.pageId);
      return {
        pageId: p.pageId,
        templateType: p.templateType,
        title: p.title,
        path: p.path,
        reviewerName: review?.reviewerName ?? null,
        reviewDate: review?.reviewDate ?? null,
        status: review?.result ?? null,
      };
    });
  }

  async recordResult(pageId: string, dto: RecordPageReviewDto): Promise<PageReview> {
    const repo = this.dataSource.getRepository(PageReview);
    const existing = await repo.findOne({ where: { pageId } });
    return repo.save(
      repo.create({ ...(existing ?? {}), pageId, reviewerName: dto.reviewerName.trim(), reviewDate: dto.reviewDate, result: dto.result }),
    );
  }
}

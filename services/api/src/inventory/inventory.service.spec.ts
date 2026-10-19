import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeDataSource } from '../../test/support/fake-data-source';
import * as catalog from './drupal-page-catalog';
import { PageReview } from './entities/page-review.entity';
import { InventoryService } from './inventory.service';

const page = (pageId: string) => ({ pageId, templateType: 'Services' as const, title: pageId, path: null });
const dto = { reviewerName: '  Pat ', reviewDate: '2026-10-19', result: 'pass' as 'pass' | 'fail' };

describe('InventoryService', () => {
  afterEach(() => vi.restoreAllMocks());
  const setup = (pages: string[]) => {
    vi.spyOn(catalog, 'fetchPublishedPages').mockResolvedValue(pages.map(page));
    const ds = new FakeDataSource() as any;
    return { ds, service: new InventoryService(ds) };
  };

  it('AC4/AC6/AC7: a pass result shows reviewer, date and pass', async () => {
    const { service } = setup(['page-1']);
    await service.recordResult('page-1', dto);
    const [entry] = await service.buildInventory();
    expect(entry).toMatchObject({ reviewerName: 'Pat', reviewDate: '2026-10-19', status: 'pass' });
  });

  it('AC5/AC6/AC8: a fail result overwrites with reviewer, date and fail', async () => {
    const { service } = setup(['page-1']);
    await service.recordResult('page-1', dto);
    await service.recordResult('page-1', { ...dto, result: 'fail' });
    const entries = await service.buildInventory();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ reviewerName: 'Pat', reviewDate: '2026-10-19', status: 'fail' });
  });

  it('AC10: a page without a result stays listed with no status', async () => {
    const { service } = setup(['page-1']);
    const entries = await service.buildInventory();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ reviewerName: null, reviewDate: null, status: null });
  });

  it('AC11: a stored review for a page Drupal no longer returns is not listed', async () => {
    const { ds, service } = setup(['page-1']);
    await ds.getRepository(PageReview).save({ pageId: 'ghost-1', reviewerName: 'Pat', reviewDate: '2026-10-19', result: 'pass' });
    const entries = await service.buildInventory();
    expect(entries.map((e) => e.pageId)).toEqual(['page-1']);
  });
});

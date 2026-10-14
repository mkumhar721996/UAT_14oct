import { describe, expect, it } from 'vitest';
import { FakeDataSource } from '../../test/support/fake-data-source';
import { DefectsService } from './defects.service';

describe('DefectsService', () => {
  const service = () => new DefectsService(new FakeDataSource() as any);
  const dto = { title: '  T  ', description: ' D ', severity: 'High' as const, stepsToReproduce: ' S ', actualResult: ' ' };

  it('trims required fields, nulls blank optionals and starts at New', async () => {
    const d = await service().createDefect('tenant', dto, 'rep-1');
    expect(d).toMatchObject({ tenantId: 'tenant', title: 'T', description: 'D', stepsToReproduce: 'S', status: 'New', reportedBy: 'rep-1', actualResult: null, expectedResult: null, environment: null });
  });
});

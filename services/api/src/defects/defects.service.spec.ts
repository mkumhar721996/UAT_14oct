import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeDataSource } from '../../test/support/fake-data-source';
import { AuthUser } from '../auth/auth-user';
import { DefectsService } from './defects.service';
import { Defect } from './entities/defect.entity';

const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenant = '22222222-2222-4222-8222-222222222222';

const user = (sub: string, role: AuthUser['role'] = 'employee'): AuthUser => ({ sub, tenantId, role, employeeId: null });
const reporter = user('reporter-1');
const admin = user('admin-1', 'admin');
const other = user('other-1');

describe('DefectsService', () => {
  let service: DefectsService;
  let fresh: Defect;
  let triaged: Defect;

  beforeEach(async () => {
    const ds = new FakeDataSource();
    service = new DefectsService(ds as any);
    const base = {
      tenantId, title: 'T', description: 'Desc', reproSteps: 'Steps', severity: 'Medium', type: 'Functional',
      reporterId: 'reporter-1', reporterName: 'Jordan Lee', assigneeId: null, assigneeName: null, environment: null,
    };
    const repo = ds.getRepository(Defect);
    fresh = await repo.save({ ...base, defectNumber: 'DEF-1042', status: 'New', priority: null, triagedAt: null });
    triaged = await repo.save({
      ...base, defectNumber: 'DEF-1038', status: 'Triaged', priority: 'P2 — High', triagedAt: new Date(), assigneeName: 'Sam Okafor',
    });
  });

  it('AC1: returns the full record, scoped by tenant', async () => {
    expect(await service.getDefect(tenantId, triaged.id)).toMatchObject({ defectNumber: 'DEF-1038', status: 'Triaged', assigneeName: 'Sam Okafor' });
    await expect(service.getDefect(otherTenant, triaged.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('AC2: Reporter can change description and reproSteps before Triaged', async () => {
    const d = await service.updateDefect(tenantId, fresh.id, reporter, { description: 'New', reproSteps: 'New steps' });
    expect(d).toMatchObject({ description: 'New', reproSteps: 'New steps' });
    expect(await service.getDefect(tenantId, fresh.id)).toMatchObject({ description: 'New' });
  });

  it('AC3: Reporter cannot change description or reproSteps once Triaged', async () => {
    await expect(service.updateDefect(tenantId, triaged.id, reporter, { description: 'Hack' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.updateDefect(tenantId, triaged.id, reporter, { reproSteps: 'Hack' })).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.getDefect(tenantId, triaged.id)).description).toBe('Desc');
  });

  it('Reporter cannot change severity, and a mixed request is rejected whole', async () => {
    await expect(service.updateDefect(tenantId, fresh.id, reporter, { description: 'Ok', severity: 'Low' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(await service.getDefect(tenantId, fresh.id)).toMatchObject({ description: 'Desc', severity: 'Medium' });
  });

  it('AC4: Admin can change severity at any status', async () => {
    expect((await service.updateDefect(tenantId, fresh.id, admin, { severity: 'Critical' })).severity).toBe('Critical');
    expect((await service.updateDefect(tenantId, triaged.id, admin, { severity: 'Low' })).severity).toBe('Low');
  });

  it('AC5: Admin can change description once Triaged', async () => {
    expect((await service.updateDefect(tenantId, triaged.id, admin, { description: 'Refined' })).description).toBe('Refined');
  });

  it('AC6: neither Reporter nor Admin is refused for any field', async () => {
    for (const dto of [{ description: 'x' }, { reproSteps: 'x' }, { severity: 'Low' }]) {
      await expect(service.updateDefect(tenantId, fresh.id, other, dto)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('AC7: changing severity leaves priority unchanged', async () => {
    const d = await service.updateDefect(tenantId, triaged.id, admin, { severity: 'Low' });
    expect(d.priority).toBe('P2 — High');
  });
});

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { FakeDataSource } from '../../test/support/fake-data-source';
import { DefectsService } from './defects.service';
import { Defect } from './entities/defect.entity';

describe('DefectsService', () => {
  const service = () => new DefectsService(new FakeDataSource() as any);
  const dto = { title: '  T  ', description: ' D ', severity: 'High' as const, stepsToReproduce: ' S ', actualResult: ' ' };

  it('trims required fields, nulls blank optionals and starts at New', async () => {
    const d = await service().createDefect('tenant', dto, 'rep-1');
    expect(d).toMatchObject({ tenantId: 'tenant', title: 'T', description: 'D', stepsToReproduce: 'S', status: 'New', reportedBy: 'rep-1', actualResult: null, expectedResult: null, environment: null });
  });

  describe('updateDefect', () => {
    const reporter = { sub: 'rep-1', role: 'reporter' as const, tenantId: 'tenant', employeeId: null };
    const other = { sub: 'e-9', role: 'employee' as const, tenantId: 'tenant', employeeId: null };
    const admin = { sub: 'adm-1', role: 'admin' as const, tenantId: 'tenant', employeeId: null };
    const seed = async (status: string) => {
      const ds = new FakeDataSource() as any;
      const svc = new DefectsService(ds);
      const d = await svc.createDefect('tenant', dto, 'rep-1');
      await ds.getRepository(Defect).save({ ...d, status, priority: 'P2' });
      return { svc, id: d.id };
    };

    it('AC2: the reporter edits description and steps before triage', async () => {
      const { svc, id } = await seed('New');
      const u = await svc.updateDefect('tenant', id, reporter, { description: ' New desc ', stepsToReproduce: 'New steps' });
      expect(u).toMatchObject({ description: 'New desc', stepsToReproduce: 'New steps' });
    });

    it('AC3: the reporter cannot edit description or steps once triaged', async () => {
      const { svc, id } = await seed('Triaged');
      await expect(svc.updateDefect('tenant', id, reporter, { description: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.updateDefect('tenant', id, reporter, { stepsToReproduce: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
      expect((await svc.getDefect('tenant', id)).description).toBe('D');
    });

    it('AC4: an admin changes severity at any status; the reporter cannot', async () => {
      for (const status of ['New', 'Triaged']) {
        const { svc, id } = await seed(status);
        expect((await svc.updateDefect('tenant', id, admin, { severity: 'Low' })).severity).toBe('Low');
        await expect(svc.updateDefect('tenant', id, reporter, { severity: 'Low' })).rejects.toBeInstanceOf(ForbiddenException);
      }
    });

    it('AC5: an admin edits description once triaged, but not before', async () => {
      const triaged = await seed('Triaged');
      expect((await triaged.svc.updateDefect('tenant', triaged.id, admin, { description: 'Updated' })).description).toBe('Updated');
      const fresh = await seed('New');
      await expect(fresh.svc.updateDefect('tenant', fresh.id, admin, { description: 'Updated' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('AC6: someone who is neither reporter nor admin is refused', async () => {
      const { svc, id } = await seed('New');
      await expect(svc.updateDefect('tenant', id, other, { description: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.updateDefect('tenant', id, other, { severity: 'Low' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('AC7: changing severity leaves priority and status untouched', async () => {
      const { svc, id } = await seed('Triaged');
      expect(await svc.updateDefect('tenant', id, admin, { severity: 'Low' })).toMatchObject({ severity: 'Low', priority: 'P2', status: 'Triaged' });
    });

    it('404s for an unknown defect or another tenant', async () => {
      const { svc, id } = await seed('New');
      await expect(svc.getDefect('tenant', 'nope')).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.getDefect('other', id)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

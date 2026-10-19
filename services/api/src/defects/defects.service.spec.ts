import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
  describe('transitionDefect', () => {
    const user = (sub: string, role: any) => ({ sub, role, tenantId: 'tenant', employeeId: null });
    const qa = user('qa-1', 'qa_verifier');
    const dev = user('dev-1', 'developer');
    const dev2 = user('dev-2', 'developer');
    const admin = user('adm-1', 'admin');
    const seed = async (status: string, extra: Record<string, unknown> = {}) => {
      const ds = new FakeDataSource() as any;
      const svc = new DefectsService(ds);
      const d = await svc.createDefect('tenant', dto, 'rep-1');
      await ds.getRepository(Defect).save({ ...d, status, ...extra });
      return { svc, id: d.id };
    };
    const t = (svc: DefectsService, id: string, u: any, body: any) => svc.transitionDefect('tenant', id, u, body);
    const refused = async (status: string, extra: Record<string, unknown>, u: any, body: any) => {
      const { svc, id } = await seed(status, extra);
      await expect(t(svc, id, u, body)).rejects.toBeInstanceOf(ForbiddenException);
      expect((await svc.getDefect('tenant', id)).status).toBe(status);
    };

    it('AC1: QA/Verifier triages New with a priority', async () => {
      const { svc, id } = await seed('New');
      expect(await t(svc, id, qa, { action: 'triage', priority: 'P2' })).toMatchObject({ status: 'Triaged', priority: 'P2' });
    });
    it('AC2: Developer triage is refused and status remains New', async () => {
      await refused('New', {}, dev, { action: 'triage', priority: 'P2' });
    });
    it('AC3: Admin assigns a Triaged defect', async () => {
      const { svc, id } = await seed('Triaged');
      expect(await t(svc, id, admin, { action: 'assign', assigneeId: 'dev-1' })).toMatchObject({ status: 'Assigned', assigneeName: 'dev-1' });
    });
    it('AC4: Admin reassigns an Assigned defect', async () => {
      const { svc, id } = await seed('Assigned', { assigneeName: 'dev-1' });
      expect(await t(svc, id, admin, { action: 'assign', assigneeId: 'dev-2' })).toMatchObject({ status: 'Assigned', assigneeName: 'dev-2' });
    });
    it('only Admin assigns', async () => {
      await refused('Triaged', {}, qa, { action: 'assign', assigneeId: 'dev-1' });
    });
    it('the assigned Developer starts work; another Developer cannot', async () => {
      const { svc, id } = await seed('Assigned', { assigneeName: 'dev-1' });
      expect((await t(svc, id, dev, { action: 'start' })).status).toBe('In Progress');
      await refused('Assigned', { assigneeName: 'dev-1' }, dev2, { action: 'start' });
    });
    it('AC5: the assigned Developer resolves with a note', async () => {
      const { svc, id } = await seed('In Progress', { assigneeName: 'dev-1' });
      expect(await t(svc, id, dev, { action: 'resolve', resolutionNote: 'Fixed the null check.' })).toMatchObject({ status: 'Resolved', resolutionNote: 'Fixed the null check.' });
    });
    it('another Developer cannot resolve', async () => {
      await refused('In Progress', { assigneeName: 'dev-1' }, dev2, { action: 'resolve', resolutionNote: 'x' });
    });
    it('AC7: QA/Verifier verifies a Resolved defect', async () => {
      const { svc, id } = await seed('Resolved');
      expect((await t(svc, id, qa, { action: 'verify' })).status).toBe('Verified');
    });
    it('AC8: Developer reopen of Verified is refused', async () => {
      await refused('Verified', {}, dev, { action: 'reopen', reopenReason: 'Still broken' });
    });
    it('AC9: QA/Verifier reopens Verified', async () => {
      const { svc, id } = await seed('Verified');
      expect(await t(svc, id, qa, { action: 'reopen', reopenReason: 'Regression found' })).toMatchObject({ status: 'Reopened', reopenReason: 'Regression found' });
    });
    it('AC11: QA/Verifier reopens Closed', async () => {
      const { svc, id } = await seed('Closed');
      expect((await t(svc, id, qa, { action: 'reopen', reopenReason: 'Found again' })).status).toBe('Reopened');
    });
    it('AC12: QA/Verifier reopens Resolved', async () => {
      const { svc, id } = await seed('Resolved');
      expect((await t(svc, id, qa, { action: 'reopen', reopenReason: 'Not actually fixed' })).status).toBe('Reopened');
    });
    it('AC13: Admin reopens Verified but not Resolved or Closed', async () => {
      const { svc, id } = await seed('Verified');
      expect((await t(svc, id, admin, { action: 'reopen', reopenReason: 'Customer still sees it' })).status).toBe('Reopened');
      await refused('Resolved', {}, admin, { action: 'reopen', reopenReason: 'x' });
      await refused('Closed', {}, admin, { action: 'reopen', reopenReason: 'x' });
    });
    it('AC14: Admin triages New', async () => {
      const { svc, id } = await seed('New');
      expect(await t(svc, id, admin, { action: 'triage', priority: 'P1' })).toMatchObject({ status: 'Triaged', priority: 'P1' });
    });
    it('a Reopened defect can be assigned again', async () => {
      const { svc, id } = await seed('Reopened');
      expect((await t(svc, id, admin, { action: 'assign', assigneeId: 'dev-1' })).status).toBe('Assigned');
    });
    it('an action from the wrong status conflicts', async () => {
      const { svc, id } = await seed('Triaged');
      await expect(t(svc, id, qa, { action: 'triage', priority: 'P1' })).rejects.toBeInstanceOf(ConflictException);
    });
    it('404s for another tenant', async () => {
      const { svc, id } = await seed('New');
      await expect(svc.transitionDefect('other', id, qa, { action: 'triage', priority: 'P1' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

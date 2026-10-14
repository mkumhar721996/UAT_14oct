import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeDataSource } from '../../test/support/fake-data-source';
import { EmployeesService } from './employees.service';
import { Employee } from './entities/employee.entity';
import { PendingChangeRequest } from './entities/pending-change-request.entity';

const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenant = '22222222-2222-4222-8222-222222222222';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let id: string;

  beforeEach(async () => {
    service = new EmployeesService(new FakeDataSource() as any);
    ({ id } = await service.createEmployee(tenantId, { fullName: 'Jordan Lee', startDate: '2026-01-05' }));
  });

  it('AC8/AC9: saves with only name and start date and generates an EMP id', async () => {
    const e = await service.createEmployee(tenantId, { fullName: 'Min Viable', startDate: '2026-01-01' });
    expect(e.employeeNumber).toMatch(/^EMP-\d+$/);
    expect(e.jobTitle).toBeNull();
  });

  it('AC1: saves the four core values on create', async () => {
    const e = await service.createEmployee(tenantId, {
      fullName: 'A', startDate: '2026-01-01', jobTitle: 'Designer', department: 'Design', contractType: 'Full-time', salary: 95000,
    });
    expect(e).toMatchObject({ jobTitle: 'Designer', department: 'Design', contractType: 'Full-time', salary: 95000 });
  });

  it('AC4/AC5: appends a history row per change and keeps earlier rows, oldest first', async () => {
    await service.updateAsHrAdmin(tenantId, id, { jobTitle: 'Product Designer', jobTitleEffectiveDate: '2026-02-01' });
    await service.updateAsHrAdmin(tenantId, id, { jobTitle: 'Senior Product Designer', jobTitleEffectiveDate: '2026-01-05' });
    const history = await service.getHistory(tenantId, id);
    expect(history.map((h) => h.newValue)).toEqual(['Senior Product Designer', 'Product Designer']);
    expect(history.map((h) => h.effectiveDate)).toEqual(['2026-01-05', '2026-02-01']);
  });

  it.each([
    ['jobTitle', 'Lead', 'Lead'],
    ['department', 'Sales', 'Sales'],
    ['contractType', 'Part-time', 'Part-time'],
    ['salary', 100000, '100000'],
  ])('AC4/AC6/AC13: changing %s writes one dated, timestamped entry and updates the active value', async (field, value, text) => {
    const e = await service.updateAsHrAdmin(tenantId, id, { [field]: value, [`${field}EffectiveDate`]: '2026-03-01' } as any);
    expect((e as any)[field]).toBe(value);
    const history = await service.getHistory(tenantId, id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ field, newValue: text, effectiveDate: '2026-03-01' });
    expect(history[0].recordedAt).toBeInstanceOf(Date);
  });

  it('requires an effective date for a changed core field', async () => {
    await expect(service.updateAsHrAdmin(tenantId, id, { jobTitle: 'X' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not write history for unchanged values or non-core edits', async () => {
    await service.updateAsHrAdmin(tenantId, id, { fullName: 'Jordan L.' });
    expect(await service.getHistory(tenantId, id)).toHaveLength(0);
  });

  it('scopes by tenant', async () => {
    await expect(service.getEmployee(otherTenant, id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('AC11: updateOwnContact saves directly', async () => {
    const e = await service.updateOwnContact(tenantId, id, { personalEmail: 'new@personalmail.com' });
    expect(e.personalEmail).toBe('new@personalmail.com');
  });

  it('AC12: change request leaves value untouched until approved; approval writes history', async () => {
    await service.updateAsHrAdmin(tenantId, id, { jobTitle: 'Manager', jobTitleEffectiveDate: '2026-01-06' });
    const req = await service.submitChangeRequest(tenantId, id, { field: 'jobTitle', requestedValue: 'Director', effectiveDate: '2026-12-01' });
    expect((await service.getEmployee(tenantId, id)).jobTitle).toBe('Manager');
    await expect(
      service.submitChangeRequest(tenantId, id, { field: 'jobTitle', requestedValue: 'VP', effectiveDate: '2026-12-02' }),
    ).rejects.toThrow();
    const e = await service.approveChangeRequest(tenantId, req.id, 'hr-sub');
    expect(e.jobTitle).toBe('Director');
    const history = await service.getHistory(tenantId, id);
    expect(history.at(-1)).toMatchObject({ newValue: 'Director', previousValue: 'Manager', effectiveDate: '2026-12-01' });
    expect(await service.listPendingRequests(tenantId)).toHaveLength(0);
  });

  it('locks the request and employee rows while resolving or editing', async () => {
    const ds = new FakeDataSource();
    const svc = new EmployeesService(ds as any);
    const { id: eid } = await svc.createEmployee(tenantId, { fullName: 'L', startDate: '2026-01-01' });
    const req = await svc.submitChangeRequest(tenantId, eid, { field: 'department', requestedValue: 'Sales', effectiveDate: '2026-02-01' });
    const locks: unknown[] = [];
    for (const entity of [Employee, PendingChangeRequest]) {
      const repo = ds.getRepository(entity);
      const orig = repo.findOne.bind(repo);
      repo.findOne = (o: any) => (locks.push(o.lock?.mode), orig(o));
    }
    await svc.updateAsHrAdmin(tenantId, eid, { fullName: 'L2' });
    expect(locks).toEqual(['pessimistic_write']);
    locks.length = 0;
    await svc.approveChangeRequest(tenantId, req.id, 'hr');
    expect(locks).toEqual(['pessimistic_write', 'pessimistic_write']);
  });

  it('maps a racing duplicate pending request (DB unique violation) to a conflict', async () => {
    const ds = new FakeDataSource();
    const svc = new EmployeesService(ds as any);
    const { id: eid } = await svc.createEmployee(tenantId, { fullName: 'R', startDate: '2026-01-01' });
    const repo = ds.getRepository(PendingChangeRequest);
    const originalSave = repo.save.bind(repo);
    repo.save = (row: any) => {
      repo.save = originalSave;
      const err = Object.assign(new Error('duplicate key value violates unique constraint "uq_pending_change_requests_open"'), {
        code: '23505',
      });
      throw err;
    };
    await expect(
      svc.submitChangeRequest(tenantId, eid, { field: 'jobTitle', requestedValue: 'Lead', effectiveDate: '2026-02-01' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejecting a request changes nothing', async () => {
    const req = await service.submitChangeRequest(tenantId, id, { field: 'salary', requestedValue: '120000', effectiveDate: '2026-12-01' });
    await service.rejectChangeRequest(tenantId, req.id, 'hr-sub');
    expect((await service.getEmployee(tenantId, id)).salary).toBeNull();
    expect(await service.getHistory(tenantId, id)).toHaveLength(0);
  });
});

describe('EmployeesService lifecycle status', () => {
  let service: EmployeesService;
  let id: string;

  beforeEach(async () => {
    service = new EmployeesService(new FakeDataSource() as any);
    ({ id } = await service.createEmployee(tenantId, { fullName: 'Jordan Lee', startDate: '2026-01-05', jobTitle: 'Designer', salary: 90000 }));
  });

  it('AC1: new employees default to active', async () => {
    expect((await service.getEmployee(tenantId, id)).status).toBe('active');
  });

  it('AC2/AC3/AC13: manual transitions between active and on_leave are saved', async () => {
    expect((await service.setStatus(tenantId, id, 'on_leave')).status).toBe('on_leave');
    expect((await service.getEmployee(tenantId, id)).status).toBe('on_leave');
    expect((await service.setStatus(tenantId, id, 'active')).status).toBe('active');
    expect((await service.getEmployee(tenantId, id)).status).toBe('active');
  });

  it('AC4/AC13: terminates an active employee, and an on_leave one', async () => {
    expect((await service.setStatus(tenantId, id, 'terminated')).status).toBe('terminated');
    const { id: other } = await service.createEmployee(tenantId, { fullName: 'B', startDate: '2026-01-01' });
    await service.setStatus(tenantId, other, 'on_leave');
    expect((await service.setStatus(tenantId, other, 'terminated')).status).toBe('terminated');
  });

  it('treats a same-value transition as a no-op', async () => {
    expect((await service.setStatus(tenantId, id, 'active')).status).toBe('active');
  });

  it('AC5/AC6: leave decisions set on_leave / active; repeated approval is tolerated', async () => {
    expect((await service.recordLeaveDecision(tenantId, id, 'approved')).status).toBe('on_leave');
    expect((await service.recordLeaveDecision(tenantId, id, 'approved')).status).toBe('on_leave');
    expect((await service.recordLeaveDecision(tenantId, id, 'rejected')).status).toBe('active');
  });

  it('AC6: a rejection leaves an active employee active', async () => {
    expect((await service.recordLeaveDecision(tenantId, id, 'rejected')).status).toBe('active');
  });

  it('AC7: terminated records reject edits, status changes and leave decisions', async () => {
    await service.setStatus(tenantId, id, 'terminated');
    await expect(service.updateAsHrAdmin(tenantId, id, { fullName: 'New Name' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.setStatus(tenantId, id, 'active')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.recordLeaveDecision(tenantId, id, 'approved')).rejects.toBeInstanceOf(ConflictException);
  });

  it('AC7: terminated records also reject contact updates, change requests and change-request approval', async () => {
    const req = await service.submitChangeRequest(tenantId, id, { field: 'jobTitle', requestedValue: 'Lead', effectiveDate: '2026-02-01' });
    await service.setStatus(tenantId, id, 'terminated');
    await expect(service.updateOwnContact(tenantId, id, { phone: '555-0100' })).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.submitChangeRequest(tenantId, id, { field: 'department', requestedValue: 'Sales', effectiveDate: '2026-02-01' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(service.approveChangeRequest(tenantId, req.id, 'hr-sub')).rejects.toBeInstanceOf(ConflictException);
    expect(await service.getEmployee(tenantId, id)).toMatchObject({ jobTitle: 'Designer', phone: null });
  });

  it('AC9: a terminated record keeps its data', async () => {
    await service.setStatus(tenantId, id, 'terminated');
    expect(await service.getEmployee(tenantId, id)).toMatchObject({ fullName: 'Jordan Lee', jobTitle: 'Designer', salary: 90000 });
  });

  it('AC10/AC11/AC12: rehire creates a linked new record and leaves the source terminated', async () => {
    await service.setStatus(tenantId, id, 'terminated');
    const rehired = await service.rehireEmployee(tenantId, id, { startDate: '2026-06-01' });
    expect(rehired.id).not.toBe(id);
    expect(rehired).toMatchObject({ status: 'active', rehiredFromId: id, fullName: 'Jordan Lee', startDate: '2026-06-01' });
    expect(rehired.employeeNumber).not.toBe((await service.getEmployee(tenantId, id)).employeeNumber);
    expect((await service.getEmployee(tenantId, id)).status).toBe('terminated');
  });

  it('rehire does not clone core fields, but accepts supplied ones', async () => {
    await service.setStatus(tenantId, id, 'terminated');
    expect(await service.rehireEmployee(tenantId, id, { startDate: '2026-06-01' })).toMatchObject({
      jobTitle: null, department: null, contractType: null, salary: null,
    });
    expect(await service.rehireEmployee(tenantId, id, { startDate: '2026-06-01', jobTitle: 'Lead', fullName: 'Jordan L.' })).toMatchObject({
      jobTitle: 'Lead', fullName: 'Jordan L.',
    });
  });

  it('allows several rehires from one terminated record', async () => {
    await service.setStatus(tenantId, id, 'terminated');
    const r1 = await service.rehireEmployee(tenantId, id, { startDate: '2026-06-01' });
    const r2 = await service.rehireEmployee(tenantId, id, { startDate: '2026-07-01' });
    expect([r1.rehiredFromId, r2.rehiredFromId]).toEqual([id, id]);
    expect(r1.id).not.toBe(r2.id);
  });

  it('rejects rehiring a non-terminated employee', async () => {
    await expect(service.rehireEmployee(tenantId, id, { startDate: '2026-06-01' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('scopes the new methods by tenant', async () => {
    await expect(service.setStatus(otherTenant, id, 'on_leave')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.recordLeaveDecision(otherTenant, id, 'approved')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.rehireEmployee(otherTenant, id, { startDate: '2026-06-01' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { FakeDataSource } from '../../test/support/fake-data-source';
import { ServiceTypesService } from './service-types.service';

describe('ServiceTypesService', () => {
  const service = () => new ServiceTypesService(new FakeDataSource() as any);

  it('AC1: trims the name, stores a blank description as null and defaults active to true', async () => {
    expect(await service().createServiceType('t', { name: '  Faucet repair  ', description: '  ' })).toMatchObject({
      tenantId: 't',
      name: 'Faucet repair',
      description: null,
      active: true,
    });
  });

  it('rejects a duplicate name on create, case-insensitively', async () => {
    const svc = service();
    await svc.createServiceType('t', { name: 'Drain cleaning' });
    await expect(svc.createServiceType('t', { name: 'drain CLEANING' })).rejects.toThrow(ConflictException);
    await expect(svc.createServiceType('other', { name: 'drain cleaning' })).resolves.toBeTruthy();
  });

  it('AC2/AC3: updateServiceType changes name and description', async () => {
    const svc = service();
    const created = await svc.createServiceType('t', { name: 'AC tune-up', description: 'Old' });
    expect(await svc.updateServiceType('t', created.id, { name: 'AC tune-up (seasonal)', description: 'New' })).toMatchObject({
      name: 'AC tune-up (seasonal)',
      description: 'New',
    });
  });

  it('rejects renaming to another row\'s name but allows keeping its own', async () => {
    const svc = service();
    const a = await svc.createServiceType('t', { name: 'Faucet repair' });
    await svc.createServiceType('t', { name: 'Drain cleaning' });
    await expect(svc.updateServiceType('t', a.id, { name: 'drain cleaning' })).rejects.toThrow(ConflictException);
    await expect(svc.updateServiceType('t', a.id, { name: 'Faucet repair', description: 'x' })).resolves.toMatchObject({ description: 'x' });
  });

  it('AC4/AC6: setStatus flips active and the customer list follows; admin still sees all', async () => {
    const svc = service();
    const created = await svc.createServiceType('t', { name: 'X' });
    await svc.setStatus('t', created.id, false);
    expect(await svc.listServiceTypes('t', 'customer')).toEqual([]);
    expect(await svc.listServiceTypes('t', 'admin')).toMatchObject([{ active: false }]);
    await svc.setStatus('t', created.id, true);
    expect(await svc.listServiceTypes('t', 'customer')).toHaveLength(1);
  });

  it('AC7: an empty catalog lists nothing for a customer', async () => {
    expect(await service().listServiceTypes('t', 'customer')).toEqual([]);
  });

  it('throws NotFound for an unknown id (also for another tenant)', async () => {
    const svc = service();
    await expect(svc.updateServiceType('t', 'no-such-id', { name: 'X' })).rejects.toThrow(NotFoundException);
    await expect(svc.setStatus('t', 'no-such-id', false)).rejects.toThrow(NotFoundException);
    const created = await svc.createServiceType('t', { name: 'X' });
    await expect(svc.setStatus('other', created.id, false)).rejects.toThrow(NotFoundException);
  });

  it('setStatus is idempotent', async () => {
    const svc = service();
    const created = await svc.createServiceType('t', { name: 'X' });
    await expect(svc.setStatus('t', created.id, true)).resolves.toMatchObject({ active: true });
  });

  it('clears a description back to null', async () => {
    const svc = service();
    const created = await svc.createServiceType('t', { name: 'X', description: 'old' });
    expect(await svc.updateServiceType('t', created.id, { name: 'X', description: '' })).toMatchObject({ description: null });
  });
});

import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeDataSource } from '../../test/support/fake-data-source';
import { EmployeesService } from '../employees/employees.service';
import { DepartmentsService } from './departments.service';

const tenantId = '11111111-1111-4111-8111-111111111111';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let employees: EmployeesService;
  let m: { id: string };
  let n: { id: string };
  let e: { id: string };

  const emp = (fullName: string) => employees.createEmployee(tenantId, { fullName, startDate: '2026-01-05' });

  beforeEach(async () => {
    const ds = new FakeDataSource() as any;
    service = new DepartmentsService(ds);
    employees = new EmployeesService(ds);
    m = await emp('Manager M');
    n = await emp('Manager N');
    e = await emp('Employee E');
  });

  it('AC1: creates a top-level department', async () => {
    const dept = await service.createDepartment(tenantId, { name: 'Executive', managerId: m.id });
    expect(dept.parentId).toBeNull();
    expect((await service.listDepartments(tenantId)).map((d) => d.id)).toContain(dept.id);
  });

  it('AC2: nests a new department under an existing parent', async () => {
    const eng = await service.createDepartment(tenantId, { name: 'Engineering', managerId: m.id });
    const platform = await service.createDepartment(tenantId, { name: 'Platform', parentId: eng.id, managerId: n.id });
    expect(platform.parentId).toBe(eng.id);
  });

  it('rejects a non-existent parent', async () => {
    await expect(
      service.createDepartment(tenantId, { name: 'X', parentId: '33333333-3333-4333-8333-333333333333', managerId: m.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('AC3: renames a department', async () => {
    const dept = await service.createDepartment(tenantId, { name: 'Old Name', managerId: m.id });
    const updated = await service.updateDepartment(tenantId, dept.id, { name: 'New Name' });
    expect(updated.name).toBe('New Name');
  });

  it('AC4: rejects creating a department with no manager', async () => {
    await expect(service.createDepartment(tenantId, { name: 'No Manager' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(await service.listDepartments(tenantId)).toHaveLength(0);
  });

  it('AC5: changing manager leaves exactly one, new, manager', async () => {
    const dept = await service.createDepartment(tenantId, { name: 'Eng', managerId: m.id });
    const updated = await service.updateDepartment(tenantId, dept.id, { managerId: n.id });
    expect(updated.managerId).toBe(n.id);
  });

  it('AC10: moving a department keeps its employees and sub-departments nested under it', async () => {
    const eng = await service.createDepartment(tenantId, { name: 'Engineering', managerId: m.id });
    const platform = await service.createDepartment(tenantId, { name: 'Platform', parentId: eng.id, managerId: n.id });
    await employees.assignDepartment(tenantId, e.id, eng.id);
    const product = await service.createDepartment(tenantId, { name: 'Product', managerId: n.id });
    await service.updateDepartment(tenantId, eng.id, { parentId: product.id });
    const all = await service.listDepartments(tenantId);
    expect(all.find((d) => d.id === eng.id)?.parentId).toBe(product.id);
    expect(all.find((d) => d.id === platform.id)?.parentId).toBe(eng.id);
    expect((await employees.getEmployee(tenantId, e.id)).departmentId).toBe(eng.id);
  });

  it('rejects moving a department under its own descendant', async () => {
    const eng = await service.createDepartment(tenantId, { name: 'Engineering', managerId: m.id });
    const platform = await service.createDepartment(tenantId, { name: 'Platform', parentId: eng.id, managerId: n.id });
    await expect(service.updateDepartment(tenantId, eng.id, { parentId: platform.id })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateDepartment(tenantId, eng.id, { parentId: eng.id })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('AC11: blocks deleting a department with an unreassigned member', async () => {
    const dept = await service.createDepartment(tenantId, { name: 'HasMembers', managerId: m.id });
    await employees.assignDepartment(tenantId, e.id, dept.id);
    await expect(service.deleteDepartment(tenantId, dept.id)).rejects.toBeInstanceOf(ConflictException);
    expect((await service.listDepartments(tenantId)).some((d) => d.id === dept.id)).toBe(true);
  });

  it('AC12: blocks deleting a department with an unreassigned sub-department', async () => {
    const parent = await service.createDepartment(tenantId, { name: 'Parent', managerId: m.id });
    await service.createDepartment(tenantId, { name: 'Child', parentId: parent.id, managerId: m.id });
    await expect(service.deleteDepartment(tenantId, parent.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('AC13: deletes once all members and sub-departments are reassigned', async () => {
    const dept = await service.createDepartment(tenantId, { name: 'Temp', managerId: m.id });
    const other = await service.createDepartment(tenantId, { name: 'Other', managerId: m.id });
    await employees.assignDepartment(tenantId, e.id, dept.id);
    await employees.assignDepartment(tenantId, e.id, other.id);
    await service.deleteDepartment(tenantId, dept.id);
    expect((await service.listDepartments(tenantId)).some((d) => d.id === dept.id)).toBe(false);
  });

  describe('my department', () => {
    it('AC14/AC15: includes nested sub-department employees and excludes outsiders', async () => {
      const eng = await service.createDepartment(tenantId, { name: 'Engineering', managerId: m.id });
      const platform = await service.createDepartment(tenantId, { name: 'Platform', parentId: eng.id, managerId: n.id });
      const product = await service.createDepartment(tenantId, { name: 'Product', managerId: n.id });
      const outsider = await emp('Maya');
      await employees.assignDepartment(tenantId, e.id, platform.id);
      await employees.assignDepartment(tenantId, outsider.id, product.id);
      const { employees: seen, departments } = await service.getMyDepartment(tenantId, m.id);
      expect(seen.map((x) => x.id)).toContain(e.id);
      expect(seen.map((x) => x.id)).not.toContain(outsider.id);
      expect(departments.map((d) => d.id).sort()).toEqual([eng.id, platform.id].sort());
    });

    it('returns nothing when the employee manages no department', async () => {
      expect(await service.getMyDepartment(tenantId, e.id)).toEqual({ departments: [], employees: [] });
    });
  });

  it('AC16: rejects a blank department name', async () => {
    await expect(service.createDepartment(tenantId, { name: '   ', managerId: m.id })).rejects.toBeInstanceOf(BadRequestException);
    expect(await service.listDepartments(tenantId)).toHaveLength(0);
  });

  it('AC17: rejects a duplicate sibling name under the same parent', async () => {
    const eng = await service.createDepartment(tenantId, { name: 'Engineering', managerId: m.id });
    await service.createDepartment(tenantId, { name: 'Platform', parentId: eng.id, managerId: m.id });
    await expect(
      service.createDepartment(tenantId, { name: 'platform ', parentId: eng.id, managerId: m.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.listDepartments(tenantId)).filter((d) => d.name === 'Platform' && d.parentId === eng.id)).toHaveLength(1);
  });
});

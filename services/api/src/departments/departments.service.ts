import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Department } from './entities/department.entity';

/** The department itself plus every department nested beneath it, at any depth. */
function subtreeIds(departments: Department[], rootId: string): string[] {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) {
    for (const d of departments) if (d.parentId === ids[i] && !ids.includes(d.id)) ids.push(d.id);
  }
  return ids;
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly dataSource: DataSource) {}

  private get repo() {
    return this.dataSource.getRepository(Department);
  }

  async listDepartments(tenantId: string): Promise<Department[]> {
    const rows = await this.repo.find({ where: { tenantId } });
    return rows.sort((a: Department, b: Department) => a.name.localeCompare(b.name));
  }

  private async requireManager(tenantId: string, managerId: string | undefined): Promise<void> {
    if (!managerId) throw new BadRequestException('A department manager is required');
    const manager = await this.dataSource.getRepository(Employee).findOne({ where: { tenantId, id: managerId } });
    if (!manager) throw new BadRequestException('Manager not found');
  }

  private assertUniqueSibling(all: Department[], name: string, parentId: string | null, selfId?: string): void {
    const clash = all.some(
      (d) => d.id !== selfId && (d.parentId ?? null) === parentId && d.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (clash) throw new BadRequestException(`A department named "${name}" already exists at this level`);
  }

  private cleanName(name: string | undefined): string {
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new BadRequestException('Department name is required');
    return trimmed;
  }

  async createDepartment(tenantId: string, dto: CreateDepartmentDto): Promise<Department> {
    const name = this.cleanName(dto.name);
    const parentId = dto.parentId ?? null;
    await this.requireManager(tenantId, dto.managerId);
    const all = await this.repo.find({ where: { tenantId } });
    if (parentId && !all.some((d: Department) => d.id === parentId)) throw new BadRequestException('Parent department not found');
    this.assertUniqueSibling(all, name, parentId);
    return this.repo.save(this.repo.create({ tenantId, name, parentId, managerId: dto.managerId }));
  }

  async updateDepartment(tenantId: string, id: string, dto: UpdateDepartmentDto): Promise<Department> {
    const all: Department[] = await this.repo.find({ where: { tenantId } });
    const dept = all.find((d) => d.id === id);
    if (!dept) throw new NotFoundException('Department not found');
    const name = dto.name !== undefined ? this.cleanName(dto.name) : dept.name;
    const parentId = dto.parentId !== undefined ? dto.parentId : dept.parentId;
    if (dto.managerId !== undefined) await this.requireManager(tenantId, dto.managerId);
    if (parentId) {
      if (!all.some((d) => d.id === parentId)) throw new BadRequestException('Parent department not found');
      if (subtreeIds(all, id).includes(parentId)) throw new BadRequestException('A department cannot be moved under itself or its own sub-departments');
    }
    this.assertUniqueSibling(all, name, parentId, id);
    dept.name = name;
    dept.parentId = parentId;
    if (dto.managerId !== undefined) dept.managerId = dto.managerId;
    return this.repo.save(dept);
  }

  async deleteDepartment(tenantId: string, id: string): Promise<void> {
    const dept = await this.repo.findOne({ where: { tenantId, id } });
    if (!dept) throw new NotFoundException('Department not found');
    const members = await this.dataSource.getRepository(Employee).find({ where: { tenantId, departmentId: id } });
    if (members.length > 0) throw new ConflictException('Reassign this department\'s employees before deleting it');
    const children = await this.repo.find({ where: { tenantId, parentId: id } });
    if (children.length > 0) throw new ConflictException('Reassign this department\'s sub-departments before deleting it');
    await this.repo.delete({ tenantId, id });
  }

  /** The department managed by `employeeId` and everything beneath it; empty if they manage none. */
  async getMyDepartment(tenantId: string, employeeId: string): Promise<{ departments: Department[]; employees: Employee[] }> {
    const all: Department[] = await this.repo.find({ where: { tenantId } });
    const roots = all.filter((d) => d.managerId === employeeId);
    if (roots.length === 0) return { departments: [], employees: [] };
    const ids = new Set(roots.flatMap((r) => subtreeIds(all, r.id)));
    const staff: Employee[] = await this.dataSource.getRepository(Employee).find({ where: { tenantId } });
    return {
      departments: all.filter((d) => ids.has(d.id)),
      employees: staff.filter((e) => e.departmentId !== null && ids.has(e.departmentId)).sort((a, b) => a.fullName.localeCompare(b.fullName)),
    };
  }
}

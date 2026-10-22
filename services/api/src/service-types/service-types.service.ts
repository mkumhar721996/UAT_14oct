import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../auth/roles';
import { UpsertServiceTypeDto } from './dto/upsert-service-type.dto';
import { ServiceType } from './entities/service-type.entity';

const toText = (v: string | null | undefined): string | null => (v?.trim() ? v.trim() : null);

@Injectable()
export class ServiceTypesService {
  constructor(private readonly dataSource: DataSource) {}

  async createServiceType(tenantId: string, dto: UpsertServiceTypeDto): Promise<ServiceType> {
    const name = dto.name.trim();
    await this.assertNameFree(tenantId, name);
    const repo = this.dataSource.getRepository(ServiceType);
    return repo.save(repo.create({ tenantId, name, description: toText(dto.description), active: true }));
  }

  async updateServiceType(tenantId: string, id: string, dto: UpsertServiceTypeDto): Promise<ServiceType> {
    const row = await this.loadServiceType(tenantId, id);
    const name = dto.name.trim();
    await this.assertNameFree(tenantId, name, id);
    row.name = name;
    row.description = toText(dto.description);
    return this.dataSource.getRepository(ServiceType).save(row);
  }

  async setStatus(tenantId: string, id: string, active: boolean): Promise<ServiceType> {
    const row = await this.loadServiceType(tenantId, id);
    row.active = active;
    return this.dataSource.getRepository(ServiceType).save(row);
  }

  async listServiceTypes(tenantId: string, role: Role): Promise<ServiceType[]> {
    const rows = await this.dataSource.getRepository(ServiceType).find({ where: { tenantId } });
    const visible = role === 'admin' ? rows : rows.filter((r) => r.active);
    return visible.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async loadServiceType(tenantId: string, id: string): Promise<ServiceType> {
    const row = await this.dataSource.getRepository(ServiceType).findOne({ where: { tenantId, id } });
    if (!row) throw new NotFoundException('Service type not found');
    return row;
  }

  private async assertNameFree(tenantId: string, name: string, excludeId?: string): Promise<void> {
    const rows = await this.dataSource.getRepository(ServiceType).find({ where: { tenantId } });
    const taken = rows.some((r) => r.id !== excludeId && r.name.trim().toLowerCase() === name.toLowerCase());
    if (taken) throw new ConflictException('Another service type already uses this name.');
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser } from '../auth/auth-user';
import { CreateDefectDto } from './dto/create-defect.dto';
import { UpdateDefectDto } from './dto/update-defect.dto';
import { Defect } from './entities/defect.entity';

const toText = (v: string | null | undefined): string | null => (v?.trim() ? v.trim() : null);

const EDITABLE_FIELDS = ['description', 'reproSteps', 'severity'] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

@Injectable()
export class DefectsService {
  constructor(private readonly dataSource: DataSource) {}

  private async nextDefectNumber(): Promise<string> {
    const [row] = await this.dataSource.query(`SELECT nextval('defect_number_seq') AS n`);
    return `DEF-${row.n}`;
  }

  async createDefect(tenantId: string, dto: CreateDefectDto, reporterId: string): Promise<Defect> {
    const repo = this.dataSource.getRepository(Defect);
    return repo.save(
      repo.create({
        tenantId,
        defectNumber: await this.nextDefectNumber(),
        title: dto.title.trim(),
        description: dto.description.trim(),
        severity: dto.severity,
        reproSteps: dto.reproSteps.trim(),
        priority: null,
        type: 'Bug',
        status: 'New',
        triagedAt: null,
        reporterId,
        reporterName: null,
        assigneeId: null,
        assigneeName: null,
        expectedResult: toText(dto.expectedResult),
        actualResult: toText(dto.actualResult),
        environment: toText(dto.environment),
      }),
    );
  }

  async getDefect(tenantId: string, id: string): Promise<Defect> {
    const defect = await this.dataSource.getRepository(Defect).findOne({ where: { id, tenantId } });
    if (!defect) throw new NotFoundException('Defect not found');
    return defect;
  }

  /** Admins edit any editable field at any status; the Reporter only description/reproSteps before Triaged. */
  async updateDefect(tenantId: string, id: string, user: AuthUser, dto: UpdateDefectDto): Promise<Defect> {
    const defect = await this.getDefect(tenantId, id);
    const isAdmin = user.role === 'admin';
    const isReporter = defect.reporterId === user.sub;
    if (!isAdmin && !isReporter) throw new ForbiddenException('Only the Reporter or an Admin can edit this defect');

    const allowed = new Set<EditableField>();
    if (isAdmin) EDITABLE_FIELDS.forEach((f) => allowed.add(f));
    if (isReporter && defect.triagedAt === null) {
      allowed.add('description');
      allowed.add('reproSteps');
    }
    for (const key of EDITABLE_FIELDS) {
      if (dto[key] !== undefined && !allowed.has(key)) throw new ForbiddenException(`Cannot change ${key} on this defect`);
    }
    for (const key of EDITABLE_FIELDS) {
      if (dto[key] !== undefined) defect[key] = dto[key];
    }
    return this.dataSource.getRepository(Defect).save(defect);
  }
}

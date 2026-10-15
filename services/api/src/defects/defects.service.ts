import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser } from '../auth/auth-user';
import { CreateDefectDto } from './dto/create-defect.dto';
import { UpdateDefectDto } from './dto/update-defect.dto';
import { Defect } from './entities/defect.entity';

const toText = (v: string | null | undefined): string | null => (v?.trim() ? v.trim() : null);

@Injectable()
export class DefectsService {
  constructor(private readonly dataSource: DataSource) {}

  async createDefect(tenantId: string, dto: CreateDefectDto, reportedBy: string): Promise<Defect> {
    const repo = this.dataSource.getRepository(Defect);
    return repo.save(
      repo.create({
        tenantId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        severity: dto.severity,
        stepsToReproduce: dto.stepsToReproduce.trim(),
        expectedResult: toText(dto.expectedResult),
        actualResult: toText(dto.actualResult),
        environment: toText(dto.environment),
        status: 'New',
        reportedBy,
      }),
    );
  }

  private async loadDefect(tenantId: string, id: string): Promise<Defect> {
    const defect = await this.dataSource.getRepository(Defect).findOne({ where: { tenantId, id } });
    if (!defect) throw new NotFoundException('Defect not found');
    return defect;
  }

  getDefect(tenantId: string, id: string): Promise<Defect> {
    return this.loadDefect(tenantId, id);
  }

  async updateDefect(tenantId: string, id: string, user: AuthUser, dto: UpdateDefectDto): Promise<Defect> {
    const repo = this.dataSource.getRepository(Defect);
    const defect = await this.loadDefect(tenantId, id);
    const isReporter = user.sub === defect.reportedBy;
    const isAdmin = user.role === 'admin';
    if (!isReporter && !isAdmin) throw new ForbiddenException("You don't have permission to edit this defect.");

    const isTriaged = defect.status !== 'New';
    const changingDescription = dto.description !== undefined || dto.stepsToReproduce !== undefined;
    if (changingDescription && !((isReporter && !isTriaged) || (isAdmin && isTriaged))) {
      throw new ForbiddenException('The description and reproduction details cannot be changed right now.');
    }
    if (dto.severity !== undefined && !isAdmin) {
      throw new ForbiddenException('Only an Admin can change severity.');
    }

    if (dto.description !== undefined) defect.description = dto.description.trim();
    if (dto.stepsToReproduce !== undefined) defect.stepsToReproduce = dto.stepsToReproduce.trim();
    if (dto.severity !== undefined) defect.severity = dto.severity;
    return repo.save(defect);
  }
}

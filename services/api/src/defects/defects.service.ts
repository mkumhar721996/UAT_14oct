import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateDefectDto } from './dto/create-defect.dto';
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
}

import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser } from '../auth/auth-user';
import { CreateDefectDto } from './dto/create-defect.dto';
import { TransitionDefectDto } from './dto/transition-defect.dto';
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

  async transitionDefect(tenantId: string, id: string, user: AuthUser, dto: TransitionDefectDto): Promise<Defect> {
    const repo = this.dataSource.getRepository(Defect);
    const defect = await this.loadDefect(tenantId, id);
    const isAssignee = defect.assigneeName !== null && user.sub === defect.assigneeName;
    const requireFrom = (action: string, ...from: string[]) => {
      if (!from.includes(defect.status)) throw new ConflictException(`Can't ${action} a defect that's ${defect.status}.`);
    };
    const requireAllowed = (allowed: boolean, message: string) => {
      if (!allowed) throw new ForbiddenException(message);
    };

    switch (dto.action) {
      case 'triage':
        requireFrom('triage', 'New');
        requireAllowed(user.role === 'qa_verifier' || user.role === 'admin', 'Triaging a defect is limited to QA/Verifier or Admin.');
        defect.priority = dto.priority!;
        defect.status = 'Triaged';
        break;
      case 'assign':
        requireFrom('assign', 'Triaged', 'Reopened', 'Assigned');
        requireAllowed(
          user.role === 'admin',
          defect.status === 'Assigned' ? 'Reassigning a defect is limited to Admin.' : 'Assigning a defect is limited to Admin.',
        );
        defect.assigneeName = dto.assigneeId!.trim();
        defect.status = 'Assigned';
        break;
      case 'start':
        requireFrom('start', 'Assigned');
        requireAllowed(isAssignee, 'Starting work is limited to the assigned Developer.');
        defect.status = 'In Progress';
        break;
      case 'resolve':
        requireFrom('resolve', 'In Progress');
        requireAllowed(isAssignee, 'Marking this resolved is limited to the assigned Developer.');
        defect.resolutionNote = dto.resolutionNote!.trim();
        defect.status = 'Resolved';
        break;
      case 'verify':
        requireFrom('verify', 'Resolved');
        requireAllowed(user.role === 'qa_verifier', 'Verifying a defect is limited to QA/Verifier.');
        defect.status = 'Verified';
        break;
      case 'reopen':
        requireFrom('reopen', 'Verified', 'Resolved', 'Closed');
        if (defect.status === 'Verified') {
          requireAllowed(user.role === 'qa_verifier' || user.role === 'admin', 'Reopening a defect is limited to QA/Verifier or Admin.');
        } else {
          requireAllowed(user.role === 'qa_verifier', 'Reopening a defect is limited to QA/Verifier.');
        }
        defect.reopenReason = dto.reopenReason!.trim();
        defect.status = 'Reopened';
        break;
    }
    return repo.save(defect);
  }
}

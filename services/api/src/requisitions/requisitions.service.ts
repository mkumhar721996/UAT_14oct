import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Actor, ActorRole } from '../auth/actor.types';
import { JobRequisition, REQUISITION_STATUSES, RequisitionStatus } from '../database/entities/job-requisition.entity';
import { User } from '../database/entities/user.entity';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { UpdateRequisitionDto } from './dto/update-requisition.dto';

const ROLE_LABELS: Record<string, string> = {
  hiring_manager: 'Hiring Manager',
  recruiter: 'Recruiter',
  hr_admin: 'HR Admin',
};

const REVIEWER_ROLES: ActorRole[] = ['recruiter', 'hr_admin'];

const SUBMIT_REQUIRED_FIELDS = [
  'title',
  'department',
  'location',
  'description',
] as const;

export interface OwnerSummary {
  id: string;
  name: string;
  role: string;
  employmentStatus: string;
  /** True while the owner is still an active Hiring Manager. */
  eligible: boolean;
}

@Injectable()
export class RequisitionsService {
  constructor(
    @InjectRepository(JobRequisition)
    private readonly requisitions: Repository<JobRequisition>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async createRequisition(
    actor: Actor,
    dto: CreateRequisitionDto,
  ): Promise<JobRequisition> {
    if (!(await this.users.findOneBy({ id: actor.id }))) {
      throw new ForbiddenException('Unknown user.');
    }
    const { action, ...fields } = dto;
    const requisition = this.requisitions.create({
      ...fields,
      hiringManagerId: actor.id,
      status: 'draft',
      pipeline: [],
    });
    this.applyFields(requisition, {});
    requisition.lastSavedAt = new Date();
    if (action === 'submit') {
      this.markSubmitted(requisition);
    }
    return this.requisitions.save(requisition);
  }

  async update(
    actor: Actor,
    id: number,
    dto: UpdateRequisitionDto,
  ): Promise<JobRequisition> {
    const requisition = await this.getOwned(actor, id);
    if (requisition.status !== 'draft' && requisition.status !== 'rejected') {
      throw new ConflictException(
        'Only a draft or rejected requisition can be edited.',
      );
    }
    this.applyFields(requisition, dto);
    requisition.lastSavedAt = new Date();
    return this.requisitions.save(requisition);
  }

  async submit(actor: Actor, id: number): Promise<JobRequisition> {
    const requisition = await this.getOwned(actor, id);
    if (requisition.status !== 'draft' && requisition.status !== 'rejected') {
      throw new ConflictException(
        'Only a draft or rejected requisition can be submitted.',
      );
    }
    this.markSubmitted(requisition);
    return this.requisitions.save(requisition);
  }

  async approve(actor: Actor, id: number): Promise<JobRequisition> {
    this.assertReviewer(actor);
    const requisition = await this.getPending(id);
    requisition.status = 'open';
    requisition.approvedBy = await this.describeReviewer(actor);
    requisition.publishedAt = new Date();
    return this.requisitions.save(requisition);
  }

  async reject(
    actor: Actor,
    id: number,
    reason: string,
  ): Promise<JobRequisition> {
    this.assertReviewer(actor);
    const requisition = await this.getPending(id);
    requisition.status = 'rejected';
    requisition.rejectedBy = await this.describeReviewer(actor);
    requisition.rejectedAt = new Date();
    requisition.rejectionReason = reason;
    return this.requisitions.save(requisition);
  }

  async reassign(
    actor: Actor,
    id: number,
    newHiringManagerId: string,
  ): Promise<JobRequisition> {
    this.assertReviewer(actor);
    const requisition = await this.getOrFail(id);
    if (requisition.status !== 'open') {
      throw new ConflictException(
        'Reassignment is only available once a requisition is open.',
      );
    }
    const target = await this.users.findOneBy({ id: newHiringManagerId });
    if (
      !target ||
      target.role !== 'hiring_manager' ||
      target.employmentStatus !== 'active'
    ) {
      throw new BadRequestException(
        'The new owner must be an active user with the Hiring Manager role.',
      );
    }
    // Only the owner changes; the candidate pipeline is deliberately untouched.
    requisition.hiringManagerId = target.id;
    return this.requisitions.save(requisition);
  }

  async findById(actor: Actor, id: number): Promise<JobRequisition> {
    const requisition = await this.getOrFail(id);
    if (actor.role === 'hiring_manager') {
      if (requisition.hiringManagerId !== actor.id) {
        throw new ForbiddenException('This requisition belongs to another manager.');
      }
    } else if (requisition.status === 'draft') {
      throw new NotFoundException('Requisition not found.');
    }
    return requisition;
  }

  async listMine(actor: Actor): Promise<JobRequisition[]> {
    return newestFirst(
      await this.requisitions.find({ where: { hiringManagerId: actor.id } }),
    );
  }

  async listForReviewers(status?: string): Promise<JobRequisition[]> {
    const wanted = REQUISITION_STATUSES.find((s) => s === status);
    if (status && (!wanted || wanted === 'draft')) {
      return [];
    }
    const where = wanted
      ? { status: wanted as RequisitionStatus }
      : { status: Not<RequisitionStatus>('draft') };
    return newestFirst(await this.requisitions.find({ where }));
  }

  async listPendingApproval(): Promise<JobRequisition[]> {
    return newestFirst(
      await this.requisitions.find({ where: { status: 'pending_approval' } }),
    );
  }

  async listOpen(search?: string): Promise<JobRequisition[]> {
    const open = newestFirst(
      await this.requisitions.find({ where: { status: 'open' } }),
    );
    const q = search?.trim().toLowerCase();
    if (!q) {
      return open;
    }
    return open.filter((r) =>
      [r.title, r.department, r.location].some((v) =>
        v?.toLowerCase().includes(q),
      ),
    );
  }

  async findOpenById(id: number): Promise<JobRequisition> {
    const requisition = await this.requisitions.findOneBy({ id, status: 'open' });
    if (!requisition) {
      throw new NotFoundException('This posting is not open.');
    }
    return requisition;
  }

  /** Candidate application intake is out of scope; this only enforces the open-only rule. */
  async apply(id: number): Promise<void> {
    const requisition = await this.getOrFail(id);
    if (requisition.status !== 'open') {
      throw new ConflictException(
        'This job posting is not open for applications.',
      );
    }
  }

  async listReassignmentTargets(): Promise<OwnerSummary[]> {
    const users = await this.users.find();
    return users.map((u) => this.summarize(u));
  }

  async describeOwner(requisition: JobRequisition): Promise<OwnerSummary | null> {
    const owner = await this.users.findOneBy({ id: requisition.hiringManagerId });
    return owner ? this.summarize(owner) : null;
  }

  async present(requisition: JobRequisition) {
    return this.withOwner(requisition, await this.describeOwner(requisition));
  }

  /** Looks every owner up in a single query rather than one per requisition. */
  async presentMany(requisitions: JobRequisition[]) {
    const ids = [...new Set(requisitions.map((r) => r.hiringManagerId))];
    const owners = ids.length
      ? await this.users.find({ where: { id: In(ids) } })
      : [];
    const byId = new Map(owners.map((u) => [u.id, this.summarize(u)]));
    return requisitions.map((r) =>
      this.withOwner(r, byId.get(r.hiringManagerId) ?? null),
    );
  }

  private withOwner(requisition: JobRequisition, owner: OwnerSummary | null) {
    return {
      ...requisition,
      hiringManager: owner,
      pipelineCandidateCount: requisition.pipeline.length,
    };
  }

  private summarize(user: User): OwnerSummary {
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      employmentStatus: user.employmentStatus,
      eligible: user.role === 'hiring_manager' && user.employmentStatus === 'active',
    };
  }

  private assertReviewer(actor: Actor): void {
    if (!REVIEWER_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only a Recruiter or HR Admin can do this.');
    }
  }

  private async describeReviewer(actor: Actor): Promise<string> {
    const user = await this.users.findOneBy({ id: actor.id });
    return `${user?.name ?? actor.id} (${ROLE_LABELS[actor.role]})`;
  }

  private async getOrFail(id: number): Promise<JobRequisition> {
    const requisition = await this.requisitions.findOneBy({ id });
    if (!requisition) {
      throw new NotFoundException('Requisition not found.');
    }
    return requisition;
  }

  private async getOwned(actor: Actor, id: number): Promise<JobRequisition> {
    const requisition = await this.getOrFail(id);
    if (requisition.hiringManagerId !== actor.id) {
      throw new ForbiddenException('Only the owning manager can do this.');
    }
    return requisition;
  }

  private async getPending(id: number): Promise<JobRequisition> {
    const requisition = await this.getOrFail(id);
    if (requisition.status !== 'pending_approval') {
      throw new ConflictException('This requisition is not pending approval.');
    }
    return requisition;
  }

  /** Fills defaults for fields a draft may omit, then applies `dto` over them. */
  private applyFields(
    requisition: JobRequisition,
    dto: UpdateRequisitionDto,
  ): void {
    requisition.department ??= null;
    requisition.location ??= null;
    requisition.description ??= null;
    requisition.startDate ??= null;
    requisition.salaryMin ??= null;
    requisition.salaryMax ??= null;
    requisition.employmentType ??= 'Full-time';
    requisition.headcount ??= 1;
    Object.assign(requisition, dto);
  }

  private markSubmitted(requisition: JobRequisition): void {
    const missing = SUBMIT_REQUIRED_FIELDS.filter((f) => !requisition[f]?.trim());
    if (missing.length > 0 || requisition.headcount < 1) {
      throw new BadRequestException(
        `Complete these fields before submitting: ${missing.join(', ') || 'headcount'}.`,
      );
    }
    requisition.status = 'pending_approval';
    requisition.submittedAt = new Date();
    requisition.rejectedBy = null;
    requisition.rejectedAt = null;
    requisition.rejectionReason = null;
  }
}

function newestFirst(rows: JobRequisition[]): JobRequisition[] {
  return [...rows].sort((a, b) => b.id - a.id);
}

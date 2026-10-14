import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Actor } from '../auth/actor.types';
import { CurrentActor } from '../auth/current-actor.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { ReassignRequisitionDto } from './dto/reassign-requisition.dto';
import { RejectRequisitionDto } from './dto/reject-requisition.dto';
import { UpdateRequisitionDto } from './dto/update-requisition.dto';
import { RequisitionsService } from './requisitions.service';

const validation = new ValidationPipe({ whitelist: true, transform: true });

@Controller('requisitions')
@UseGuards(RolesGuard)
@UsePipes(validation)
export class RequisitionsController {
  constructor(private readonly service: RequisitionsService) {}

  @Post()
  @Roles('hiring_manager')
  async create(
    @CurrentActor() actor: Actor,
    @Body() dto: CreateRequisitionDto,
  ) {
    return this.service.present(await this.service.createRequisition(actor, dto));
  }

  /** A hiring manager sees their own requisitions; reviewers see every non-draft one. */
  @Get()
  @Roles('hiring_manager', 'recruiter', 'hr_admin')
  async list(@CurrentActor() actor: Actor, @Query('status') status?: string) {
    const rows =
      actor.role === 'hiring_manager'
        ? await this.service.listMine(actor)
        : await this.service.listForReviewers(status);
    return this.service.presentMany(rows);
  }

  @Get('pending-approval')
  @Roles('recruiter', 'hr_admin')
  async listPending() {
    return this.service.presentMany(await this.service.listPendingApproval());
  }

  @Get('reassignment-targets')
  @Roles('recruiter', 'hr_admin')
  listReassignmentTargets() {
    return this.service.listReassignmentTargets();
  }

  @Get(':id')
  @Roles('hiring_manager', 'recruiter', 'hr_admin')
  async findOne(
    @CurrentActor() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.present(await this.service.findById(actor, id));
  }

  @Patch(':id')
  @Roles('hiring_manager')
  async update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRequisitionDto,
  ) {
    return this.service.present(await this.service.update(actor, id, dto));
  }

  @Post(':id/submit')
  @HttpCode(200)
  @Roles('hiring_manager')
  async submit(
    @CurrentActor() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.present(await this.service.submit(actor, id));
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Roles('recruiter', 'hr_admin')
  async approve(
    @CurrentActor() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.present(await this.service.approve(actor, id));
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('recruiter', 'hr_admin')
  async reject(
    @CurrentActor() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectRequisitionDto,
  ) {
    return this.service.present(
      await this.service.reject(actor, id, dto.reason),
    );
  }

  @Post(':id/reassign')
  @HttpCode(200)
  @Roles('recruiter', 'hr_admin')
  async reassign(
    @CurrentActor() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReassignRequisitionDto,
  ) {
    return this.service.present(
      await this.service.reassign(actor, id, dto.newHiringManagerId),
    );
  }
}

/** Public, unauthenticated candidate-facing surface: only `open` requisitions are ever exposed. */
@Controller('job-board')
export class JobBoardController {
  constructor(private readonly service: RequisitionsService) {}

  @Get()
  async list(@Query('q') q?: string) {
    return (await this.service.listOpen(q)).map(toPublicPosting);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return toPublicPosting(await this.service.findOpenById(id));
  }

  @Post(':id/apply')
  @HttpCode(200)
  async apply(@Param('id', ParseIntPipe) id: number) {
    await this.service.apply(id);
    return { applied: true };
  }
}

function toPublicPosting(r: {
  id: number;
  title: string;
  department: string | null;
  location: string | null;
  employmentType: string;
  startDate: string | null;
  description: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
}) {
  return {
    id: r.id,
    title: r.title,
    department: r.department,
    location: r.location,
    employmentType: r.employmentType,
    startDate: r.startDate,
    description: r.description,
    salaryMin: r.salaryMin,
    salaryMax: r.salaryMax,
  };
}

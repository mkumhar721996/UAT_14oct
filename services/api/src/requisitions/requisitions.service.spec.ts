import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { Actor } from '../auth/actor.types';
import { JobRequisition } from '../database/entities/job-requisition.entity';
import { User } from '../database/entities/user.entity';
import { FakeRepository } from '../../test/support/fake-repository';
import { RequisitionsService } from './requisitions.service';

const priya: Actor = { id: 'priya', role: 'hiring_manager' };
const morgan: Actor = { id: 'morgan', role: 'hr_admin' };
const devon: Actor = { id: 'devon', role: 'recruiter' };

const complete = {
  title: 'Senior Backend Engineer',
  department: 'Engineering',
  location: 'Remote (US)',
  headcount: 1,
  description: 'Own the rewrite.',
};

describe('RequisitionsService', () => {
  let users: FakeRepository<User>;
  let service: RequisitionsService;

  beforeEach(async () => {
    users = new FakeRepository<User>();
    const reqs = new FakeRepository<JobRequisition>(true);
    service = new RequisitionsService(reqs as never, users as never);
    const seed: Array<[string, string, string]> = [
      ['priya', 'Priya Nathan', 'hiring_manager'],
      ['jordan', 'Jordan Reyes', 'hiring_manager'],
      ['sam', 'Sam Osei', 'finance_analyst'],
      ['morgan', 'Morgan Clarke', 'hr_admin'],
      ['devon', 'Devon Blake', 'recruiter'],
    ];
    for (const [id, name, role] of seed) {
      await users.save({ id, name, role, employmentStatus: 'active' });
    }
  });

  const pending = async () =>
    service.createRequisition(priya, { ...complete, action: 'submit' });
  const open = async () => service.approve(morgan, (await pending()).id);

  it('AC1: submitting a new requisition creates it pending approval', async () => {
    const created = await pending();
    expect(created.status).toBe('pending_approval');
    expect(created.hiringManagerId).toBe('priya');
  });

  it('AC2: a recruiter or HR admin approving publishes it', async () => {
    const approved = await service.approve(devon, (await pending()).id);
    expect(approved.status).toBe('open');
    expect(approved.approvedBy).toBe('Devon Blake (Recruiter)');
    expect(approved.publishedAt).toBeInstanceOf(Date);
  });

  it('AC3: a hiring manager cannot approve and it stays pending', async () => {
    const { id } = await pending();
    await expect(service.approve(priya, id)).rejects.toThrow(ForbiddenException);
    expect((await service.findById(morgan, id)).status).toBe('pending_approval');
  });

  it('AC4: a recruiter or HR admin rejecting records the reason', async () => {
    const rejected = await service.reject(
      morgan,
      (await pending()).id,
      'Headcount moves to Q1.',
    );
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('Headcount moves to Q1.');
    expect(rejected.rejectedBy).toBe('Morgan Clarke (HR Admin)');
  });

  it('AC5: a hiring manager cannot reject and it stays pending', async () => {
    const { id } = await pending();
    await expect(service.reject(priya, id, 'no')).rejects.toThrow(
      ForbiddenException,
    );
    expect((await service.findById(morgan, id)).status).toBe('pending_approval');
  });

  it('approve and reject refuse a requisition that is not pending', async () => {
    const { id } = await open();
    await expect(service.approve(morgan, id)).rejects.toThrow(ConflictException);
    await expect(service.reject(morgan, id, 'late')).rejects.toThrow(
      ConflictException,
    );
  });

  it('AC6: only open requisitions appear on the job board, with search', async () => {
    await service.createRequisition(priya, { title: 'Draft one', action: 'draft' });
    await pending();
    const { id } = await open();
    const rejectedId = (await pending()).id;
    await service.reject(morgan, rejectedId, 'no');
    const board = await service.listOpen();
    expect(board.map((r) => r.id)).toEqual([id]);
    expect(await service.listOpen('engineering')).toHaveLength(1);
    expect(await service.listOpen('nothing-matches')).toHaveLength(0);
  });

  it('AC6: an unapproved requisition is not found as an open posting', async () => {
    const { id } = await pending();
    await expect(service.findOpenById(id)).rejects.toThrow(NotFoundException);
  });

  it('AC7: applying to an unapproved requisition is refused', async () => {
    const { id } = await pending();
    await expect(service.apply(id)).rejects.toThrow(ConflictException);
  });

  it('applying to an open requisition is accepted', async () => {
    const { id } = await open();
    await expect(service.apply(id)).resolves.toBeUndefined();
  });

  it('AC8/AC9: reassigning an open requisition changes the owner and keeps the pipeline', async () => {
    const created = await open();
    created.pipeline = [{ name: 'Elena Cho', stage: 'Phone screen' }];
    const reassigned = await service.reassign(morgan, created.id, 'jordan');
    expect(reassigned.hiringManagerId).toBe('jordan');
    expect(reassigned.pipeline).toEqual([
      { name: 'Elena Cho', stage: 'Phone screen' },
    ]);
  });

  it('AC10: a hiring manager cannot reassign', async () => {
    const { id } = await open();
    await expect(service.reassign(priya, id, 'jordan')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('AC11: an owner whose role changed leaves the requisition open and unchanged', async () => {
    const { id } = await open();
    const owner = (await users.findOneBy({ id: 'priya' }))!;
    owner.role = 'finance_analyst';
    const view = await service.findById(morgan, id);
    expect(view.status).toBe('open');
    expect(view.hiringManagerId).toBe('priya');
    expect(await service.describeOwner(view)).toMatchObject({
      id: 'priya',
      eligible: false,
    });
  });

  it('AC12: a saved draft is listed as draft for its owner', async () => {
    const draft = await service.createRequisition(priya, {
      title: 'Staff Engineer',
      action: 'draft',
    });
    expect(draft.status).toBe('draft');
    const mine = await service.listMine(priya);
    expect(mine.find((r) => r.id === draft.id)?.status).toBe('draft');
  });

  it('AC13: submitting a complete draft makes it pending approval', async () => {
    const draft = await service.createRequisition(priya, {
      ...complete,
      action: 'draft',
    });
    expect((await service.submit(priya, draft.id)).status).toBe('pending_approval');
  });

  it('submitting an incomplete draft is rejected as invalid', async () => {
    const draft = await service.createRequisition(priya, {
      title: 'Half done',
      action: 'draft',
    });
    await expect(service.submit(priya, draft.id)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('AC14: a rejected requisition shows as rejected to its owner', async () => {
    const { id } = await pending();
    await service.reject(morgan, id, 'Not now.');
    expect((await service.findById(priya, id)).status).toBe('rejected');
  });

  it('AC15: resubmitting a rejected requisition clears the rejection', async () => {
    const { id } = await pending();
    await service.reject(morgan, id, 'Not now.');
    const resubmitted = await service.submit(priya, id);
    expect(resubmitted.status).toBe('pending_approval');
    expect(resubmitted.rejectionReason).toBeNull();
    expect(resubmitted.rejectedBy).toBeNull();
  });

  it('only the owner can submit', async () => {
    const { id } = await service.createRequisition(priya, {
      ...complete,
      action: 'draft',
    });
    await expect(
      service.submit({ id: 'jordan', role: 'hiring_manager' }, id),
    ).rejects.toThrow(ForbiddenException);
  });

  it('AC16: reassigning a pending requisition is refused', async () => {
    const { id } = await pending();
    await expect(service.reassign(morgan, id, 'jordan')).rejects.toThrow(
      ConflictException,
    );
  });

  it('AC17: reassigning to a user without the hiring manager role is refused', async () => {
    const { id } = await open();
    await expect(service.reassign(morgan, id, 'sam')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.reassign(morgan, id, 'nobody')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('reassigning to a terminated hiring manager is refused', async () => {
    const { id } = await open();
    (await users.findOneBy({ id: 'jordan' }))!.employmentStatus = 'terminated';
    await expect(service.reassign(morgan, id, 'jordan')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('presenting many requisitions looks owners up in one query', async () => {
    await pending();
    await pending();
    const before = users.findCalls;
    const views = await service.presentMany(await service.listPendingApproval());
    expect(views.every((v) => v.hiringManager?.name === 'Priya Nathan')).toBe(true);
    expect(users.findCalls - before).toBe(1);
  });

  it('the approval queue lists only pending requisitions', async () => {
    await service.createRequisition(priya, { title: 'Draft', action: 'draft' });
    const { id } = await pending();
    expect((await service.listPendingApproval()).map((r) => r.id)).toEqual([id]);
  });

  it('reviewers list non-draft requisitions, optionally by status', async () => {
    await service.createRequisition(priya, { title: 'Draft', action: 'draft' });
    const { id } = await open();
    await pending();
    expect(await service.listForReviewers()).toHaveLength(2);
    expect((await service.listForReviewers('open')).map((r) => r.id)).toEqual([id]);
  });

  it('a hiring manager cannot view another manager’s requisition, nor a recruiter a draft', async () => {
    const draft = await service.createRequisition(priya, {
      title: 'Secret',
      action: 'draft',
    });
    await expect(
      service.findById({ id: 'jordan', role: 'hiring_manager' }, draft.id),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.findById(morgan, draft.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updating is limited to the owner of a draft or rejected requisition', async () => {
    const draft = await service.createRequisition(priya, {
      title: 'Old',
      action: 'draft',
    });
    expect((await service.update(priya, draft.id, { title: 'New' })).title).toBe(
      'New',
    );
    const { id } = await pending();
    await expect(service.update(priya, id, { title: 'x' })).rejects.toThrow(
      ConflictException,
    );
  });
});

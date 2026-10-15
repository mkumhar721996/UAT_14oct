import {
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ActorMiddleware } from '../src/auth/actor.middleware';
import { JobRequisition } from '../src/database/entities/job-requisition.entity';
import { User } from '../src/database/entities/user.entity';
import { FakeRepository } from './support/fake-repository';
import {
  JobBoardController,
  RequisitionsController,
} from '../src/requisitions/requisitions.controller';
import { RequisitionsService } from '../src/requisitions/requisitions.service';

const users = new FakeRepository<User>();
const reqs = new FakeRepository<JobRequisition>(true);

// Same controllers/service/middleware as RequisitionsModule, with in-memory repositories
// so the HTTP surface is exercised without a database.
@Module({
  controllers: [RequisitionsController, JobBoardController],
  providers: [
    RequisitionsService,
    { provide: getRepositoryToken(JobRequisition), useValue: reqs },
    { provide: getRepositoryToken(User), useValue: users },
  ],
})
class TestRequisitionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ActorMiddleware).forRoutes('*');
  }
}

const as = (id: string, role: string) => ({
  'x-actor-id': id,
  'x-actor-role': role,
});
const priya = as('priya', 'hiring_manager');
const morgan = as('morgan', 'hr_admin');
const devon = as('devon', 'recruiter');

const complete = {
  title: 'Senior Backend Engineer',
  department: 'Engineering',
  location: 'Remote (US)',
  employmentType: 'Full-time',
  headcount: 1,
  description: 'Own the rewrite.',
};

describe('Requisitions (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestRequisitionsModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    users.rows = [];
    reqs.rows = [];
    for (const [id, name, role] of [
      ['priya', 'Priya Nathan', 'hiring_manager'],
      ['jordan', 'Jordan Reyes', 'hiring_manager'],
      ['sam', 'Sam Osei', 'finance_analyst'],
      ['morgan', 'Morgan Clarke', 'hr_admin'],
      ['devon', 'Devon Blake', 'recruiter'],
    ]) {
      await users.save({ id, name, role, employmentStatus: 'active' });
    }
  });

  const create = async (action: 'draft' | 'submit') =>
    (await http().post('/requisitions').set(priya).send({ ...complete, action }))
      .body;
  const createOpen = async () => {
    const { id } = await create('submit');
    await http().post(`/requisitions/${id}/approve`).set(morgan).send({});
    return id as number;
  };

  it('AC1: a hiring manager submitting creates a pending requisition', async () => {
    const res = await http()
      .post('/requisitions')
      .set(priya)
      .send({ ...complete, action: 'submit' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending_approval');
  });

  it('refuses unauthenticated and invalid creation', async () => {
    expect((await http().post('/requisitions').send(complete)).status).toBe(401);
    expect(
      (await http().post('/requisitions').set(priya).send({ title: '' })).status,
    ).toBe(400);
    expect(
      (await http().post('/requisitions').set(morgan).send(complete)).status,
    ).toBe(403);
  });

  it('AC2: an HR admin approving publishes the requisition', async () => {
    const { id } = await create('submit');
    const res = await http()
      .post(`/requisitions/${id}/approve`)
      .set(morgan)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('open');
  });

  it('AC3: a hiring manager approving is refused and it stays pending', async () => {
    const { id } = await create('submit');
    const res = await http()
      .post(`/requisitions/${id}/approve`)
      .set(priya)
      .send({});
    expect(res.status).toBe(403);
    expect((await http().get(`/requisitions/${id}`).set(priya)).body.status).toBe(
      'pending_approval',
    );
  });

  it('AC4: a recruiter rejecting records the reason', async () => {
    const { id } = await create('submit');
    const res = await http()
      .post(`/requisitions/${id}/reject`)
      .set(devon)
      .send({ reason: 'Headcount moves to Q1 planning.' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.rejectionReason).toBe('Headcount moves to Q1 planning.');
  });

  it('AC5: a hiring manager rejecting is refused and it stays pending', async () => {
    const { id } = await create('submit');
    const res = await http()
      .post(`/requisitions/${id}/reject`)
      .set(priya)
      .send({ reason: 'no' });
    expect(res.status).toBe(403);
    expect(reqs.rows[0].status).toBe('pending_approval');
  });

  it('AC6: unapproved requisitions never appear on the job board', async () => {
    const draft = await create('draft');
    const pendingReq = await create('submit');
    const rejected = await create('submit');
    await http()
      .post(`/requisitions/${rejected.id}/reject`)
      .set(morgan)
      .send({ reason: 'no' });
    const openId = await createOpen();
    const list = await http().get('/job-board');
    expect(list.body.map((r: { id: number }) => r.id)).toEqual([openId]);
    expect(list.body[0]).not.toHaveProperty('hiringManagerId');
    for (const { id } of [draft, pendingReq, rejected]) {
      expect((await http().get(`/job-board/${id}`)).status).toBe(404);
    }
    expect((await http().get('/job-board?q=nomatch')).body).toEqual([]);
  });

  it('AC7: applying to an unapproved requisition is refused', async () => {
    const { id } = await create('submit');
    const res = await http().post(`/job-board/${id}/apply`).send({});
    expect(res.status).toBe(409);
    const openId = await createOpen();
    expect((await http().post(`/job-board/${openId}/apply`).send({})).status).toBe(
      200,
    );
  });

  it('AC8/AC9: reassigning updates the owner and keeps the pipeline', async () => {
    const id = await createOpen();
    reqs.rows[0].pipeline = [{ name: 'Elena Cho', stage: 'Phone screen' }];
    const res = await http()
      .post(`/requisitions/${id}/reassign`)
      .set(morgan)
      .send({ newHiringManagerId: 'jordan' });
    expect(res.status).toBe(200);
    expect(res.body.hiringManagerId).toBe('jordan');
    expect(res.body.hiringManager.name).toBe('Jordan Reyes');
    expect(res.body.pipelineCandidateCount).toBe(1);
    expect(reqs.rows[0].pipeline).toHaveLength(1);
  });

  it('AC10: a hiring manager reassigning is refused', async () => {
    const id = await createOpen();
    const res = await http()
      .post(`/requisitions/${id}/reassign`)
      .set(priya)
      .send({ newHiringManagerId: 'jordan' });
    expect(res.status).toBe(403);
  });

  it('AC11: an owner whose role changed leaves the requisition open', async () => {
    const id = await createOpen();
    (await users.findOneBy({ id: 'priya' }))!.role = 'finance_analyst';
    const res = await http().get(`/requisitions/${id}`).set(morgan);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('open');
    expect(res.body.hiringManagerId).toBe('priya');
    expect(res.body.hiringManager.eligible).toBe(false);
  });

  it('AC12/AC13: a saved draft lists as draft and can then be submitted', async () => {
    const draft = await http()
      .post('/requisitions')
      .set(priya)
      .send({ title: 'Staff Engineer', action: 'draft' });
    expect(draft.body.status).toBe('draft');
    const list = await http().get('/requisitions').set(priya);
    expect(
      list.body.find((r: { id: number }) => r.id === draft.body.id).status,
    ).toBe('draft');
    await http()
      .patch(`/requisitions/${draft.body.id}`)
      .set(priya)
      .send(complete);
    const submitted = await http()
      .post(`/requisitions/${draft.body.id}/submit`)
      .set(priya)
      .send({});
    expect(submitted.body.status).toBe('pending_approval');
  });

  it('AC14/AC15: a rejected requisition shows as rejected and can be resubmitted', async () => {
    const { id } = await create('submit');
    await http()
      .post(`/requisitions/${id}/reject`)
      .set(morgan)
      .send({ reason: 'Not now.' });
    expect((await http().get(`/requisitions/${id}`).set(priya)).body.status).toBe(
      'rejected',
    );
    const res = await http().post(`/requisitions/${id}/submit`).set(priya).send({});
    expect(res.body.status).toBe('pending_approval');
    expect(res.body.rejectionReason).toBeNull();
  });

  it('AC16: reassigning a pending requisition is refused', async () => {
    const { id } = await create('submit');
    const res = await http()
      .post(`/requisitions/${id}/reassign`)
      .set(morgan)
      .send({ newHiringManagerId: 'jordan' });
    expect(res.status).toBe(409);
  });

  it('AC17: reassigning to a non hiring manager is refused', async () => {
    const id = await createOpen();
    const res = await http()
      .post(`/requisitions/${id}/reassign`)
      .set(morgan)
      .send({ newHiringManagerId: 'sam' });
    expect(res.status).toBe(400);
  });

  it('lets reviewers list open requisitions at GET /requisitions', async () => {
    await create('draft');
    const openId = await createOpen();
    await create('submit');
    const res = await http().get('/requisitions?status=open').set(devon);
    expect(res.body.map((r: { id: number }) => r.id)).toEqual([openId]);
    expect((await http().get('/requisitions')).status).toBe(401);
  });

  it('serves the approval queue and reassignment targets to reviewers only', async () => {
    const { id } = await create('submit');
    const queue = await http().get('/requisitions/pending-approval').set(morgan);
    expect(queue.body.map((r: { id: number }) => r.id)).toEqual([id]);
    expect(
      (await http().get('/requisitions/pending-approval').set(priya)).status,
    ).toBe(403);
    const targets = await http().get('/requisitions/reassignment-targets').set(devon);
    expect(
      targets.body.find((u: { id: string }) => u.id === 'sam').eligible,
    ).toBe(false);
  });
});

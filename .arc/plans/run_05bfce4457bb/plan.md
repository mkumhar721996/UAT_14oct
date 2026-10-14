summary: |
  Implements job requisition creation and approval end-to-end: a Hiring Manager drafts and submits
  a requisition, a Recruiter or HR Admin approves or rejects it, approved requisitions publish to a
  public candidate job board, and an open requisition's owner can be reassigned without disturbing
  its candidate pipeline. The repository is currently a bare scaffold (comp_api_service has only a
  health-check controller; comp_web_app renders a placeholder heading) with no ORM, no persistence
  schema, no auth/RBAC, and no client-side routing, so this plan builds the minimum domain
  foundation (Postgres schema via TypeORM, a role-based authorization stand-in, and React routing)
  alongside the requisition workflow itself. The build follows the approved prototype at
  `.arc/designs/UAT-14OCT-STORY-017-design.html` for every screen (Hiring Manager console,
  Recruiter/HR Admin console, public candidate job board) and reuses its documented token recipes
  for the two composite patterns it introduces (`chip-neutral` for Draft, the modal-overlay scrim).
  Candidate sourcing and pipeline movement beyond "apply is refused/accepted" are explicitly out of
  scope, per the story's own scope note.

scope:
  - description: |
      Add TypeORM + Postgres wiring: a `DataSource` config reading `DATABASE_URL`, a `User` entity
      (id, name, role, employment_status) and a `JobRequisition` entity (id, title, department,
      location, employment_type, headcount, start_date, description, salary_min, salary_max,
      hiring_manager_id FK, status, submitted_at, approved_by, published_at, rejected_by,
      rejected_at, rejection_reason, last_saved_at, created_at, updated_at), and one migration
      creating both tables plus a `status` check constraint
      (`draft|pending_approval|open|rejected`).
    files:
      - services/api/src/database/data-source.ts
      - services/api/src/database/entities/user.entity.ts
      - services/api/src/database/entities/job-requisition.entity.ts
      - services/api/src/database/migrations/1760000000000-create-requisitions.ts
      - services/api/src/app.module.ts
      - services/api/package.json
    rationale: |
      Nothing in the scaffold persists data today (`app.module.ts` only wires `AppController`/
      `AppService`). TypeORM is the idiomatic Nest+Postgres pairing (`@nestjs/typeorm`) and keeps
      entities colocated with decorators, matching Nest conventions elsewhere in the stack. A
      `User` table is the minimal local projection needed for role checks on reassignment targets
      (AC17) and to represent a hiring manager's post-hoc role change (AC11) independent of the
      requisition's own denormalized fields — see assumptions for why this is intentionally
      minimal rather than a full identity sync.
  - description: |
      Add a request-scoped actor stand-in: an `ActorMiddleware` that reads `x-actor-id` /
      `x-actor-role` headers and attaches `req.actor`, a `@CurrentActor()` param decorator, and a
      `@Roles(...)` decorator + `RolesGuard` that throws `ForbiddenException` when
      `req.actor.role` isn't in the required list.
    files:
      - services/api/src/auth/actor.types.ts
      - services/api/src/auth/actor.middleware.ts
      - services/api/src/auth/current-actor.decorator.ts
      - services/api/src/auth/roles.decorator.ts
      - services/api/src/auth/roles.guard.ts
      - services/api/src/auth/roles.guard.spec.ts
      - services/api/src/app.module.ts
    rationale: |
      Every AC is gated on who's signed in (Hiring Manager vs. Recruiter/HR Admin vs. candidate),
      but comp_identity_provider (Cognito) integration doesn't exist anywhere in this codebase yet
      and building real JWT verification is a platform-wide concern, not scoped to this story. This
      header-based actor is an explicit, isolated stand-in: it's the only place that extracts
      identity, so swapping in real Cognito-verified claims later is a one-file change. Flagged in
      assumptions_or_open_questions.
  - description: |
      Implement `RequisitionsService` as the state machine: `createDraft`, `submit` (draft|rejected
      -> pending_approval), `approve`/`reject` (pending_approval -> open|rejected, role-gated),
      `reassign` (open-only, role-gated, target-role-gated), and read methods `listMine`,
      `listPendingApproval`, `listOpen(search?)`, `findOpenById`, and `apply` (throws unless open).
    files:
      - services/api/src/requisitions/requisitions.service.ts
      - services/api/src/requisitions/requisitions.service.spec.ts
      - services/api/src/requisitions/dto/create-requisition.dto.ts
      - services/api/src/requisitions/dto/update-requisition.dto.ts
      - services/api/src/requisitions/dto/reject-requisition.dto.ts
      - services/api/src/requisitions/dto/reassign-requisition.dto.ts
    rationale: |
      Keeping the state machine in a plain service (unit-tested with vitest, no HTTP) lets every
      transition rule (AC1-5, AC8-17) be exercised without spinning up Nest's HTTP layer, which is
      faster and pins down the exact error type per rule before wiring the controller.
  - description: |
      Implement `RequisitionsController` + `RequisitionsModule`, wiring routes to the service
      behind `RolesGuard`: `POST /requisitions`, `PATCH /requisitions/:id`,
      `POST /requisitions/:id/submit`, `POST /requisitions/:id/approve`,
      `POST /requisitions/:id/reject`, `POST /requisitions/:id/reassign`, `GET /requisitions`
      (mine), `GET /requisitions/pending-approval`, `GET /requisitions/:id`,
      `GET /job-board` (public, status=open only, optional `?q=`),
      `GET /job-board/:id` (public), `POST /job-board/:id/apply` (public).
    files:
      - services/api/src/requisitions/requisitions.controller.ts
      - services/api/src/requisitions/requisitions.module.ts
      - services/api/test/requisitions.e2e-spec.ts
      - services/api/src/app.module.ts
    rationale: |
      One e2e spec per module keeps all 17 ACs's HTTP-level behavior (status codes, RBAC
      refusals, state transitions) in a single, realistic request/response surface that exercises
      the guard, decorator, service, and entities together against a real Postgres connection.
  - description: |
      Configure the Tailwind theme to match the approved prototype's design tokens (colors,
      radii, spacing, font sizes read from the `:root` custom properties in the design file —
      e.g. `--color-primary: #2563eb`, `--color-bg-subtle: #f8fafc`, `--radius-md: 6px`,
      `--space-2/3/4: 8/12/16px`) and replace the placeholder dark-theme `App.tsx` with a
      light-theme `AppShell` (persistent sidebar + topbar, per the UI guidelines) and
      `react-router-dom` routes for the six screens.
    files:
      - apps/web/tailwind.config.js
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/src/components/AppShell.tsx
      - apps/web/src/components/Sidebar.tsx
      - apps/web/src/components/Topbar.tsx
      - apps/web/src/components/StatusChip.tsx
      - apps/web/src/auth/ActorContext.tsx
      - apps/web/package.json
    rationale: |
      The current `App.tsx` renders a `bg-slate-950`/dark-theme placeholder, which directly
      conflicts with the UI guideline's light-theme-only rule and the prototype's actual palette —
      this must be replaced, not extended. `ActorContext` is the frontend mirror of the backend's
      header-based actor stand-in (a hardcoded/dev-switchable `{id, name, role}`, not a login UI),
      explicitly temporary until a real sign-in story lands — see assumptions. The prototype's
      "Prototype control — simulate role/navigation" buttons are reviewer-only scaffolding for the
      HTML mockup and must NOT be built; production derives role from `ActorContext` only.
  - description: |
      Build the Hiring Manager console: `MyRequisitionsPage` (table of the signed-in HM's
      requisitions with status chip, empty state, "New requisition" primary action) and
      `RequisitionFormPage` serving new/edit-draft/resubmit-rejected, with inline per-field
      validation and "Save as draft" (secondary) / "Submit for approval" (primary) actions that
      disable + relabel while pending, matching the design's Create/Edit screen.
    files:
      - apps/web/src/api/requisitionsApi.ts
      - apps/web/src/features/requisitions/MyRequisitionsPage.tsx
      - apps/web/src/features/requisitions/MyRequisitionsPage.test.tsx
      - apps/web/src/features/requisitions/RequisitionFormPage.tsx
      - apps/web/src/features/requisitions/RequisitionFormPage.test.tsx
    rationale: |
      Covers AC1, AC12, AC13, AC14, AC15 against the design's "Hiring Manager – My Requisitions"
      and "Hiring Manager – Create / Edit Requisition" screens, including the resubmit banner
      quoting the rejection reason.
  - description: |
      Build the shared `RequisitionDetailPage` (summary card + status-specific section per the
      design: draft banner, pending-approval approve/reject actions, rejected banner +
      resubmit, open ownership/pipeline card) and `ReassignModal` (eligible-Hiring-Manager-only
      select, ineligible users shown disabled per the design's field hint).
    files:
      - apps/web/src/features/requisitions/RequisitionDetailPage.tsx
      - apps/web/src/features/requisitions/RequisitionDetailPage.test.tsx
      - apps/web/src/features/requisitions/ReassignModal.tsx
      - apps/web/src/features/requisitions/ReassignModal.test.tsx
    rationale: |
      Covers AC2, AC3, AC4, AC5, AC8, AC9, AC10, AC11, AC16, AC17 — permission differences are
      asserted by rendering the page with different `ActorContext` values (role = hiring_manager
      vs recruiter/hr_admin), not via the prototype's role-simulator toggle.
  - description: |
      Build `ApprovalQueuePage`: table of pending_approval requisitions with inline Approve /
      Reject (reason required) actions, matching the design's loading/error/empty/success states.
    files:
      - apps/web/src/features/approvals/ApprovalQueuePage.tsx
      - apps/web/src/features/approvals/ApprovalQueuePage.test.tsx
    rationale: |
      Supports AC2 and AC4 from the Recruiter/HR Admin console entry point shown in the design's
      "Approvals" sidebar item.
  - description: |
      Build the public candidate console: `JobBoardPage` (search-filtered list of open
      requisitions as cards, per the design) and `JobPostingPage` (full posting + Apply when
      open; a disabled "Apply now" with an explanatory banner when not open).
    files:
      - apps/web/src/features/jobs/JobBoardPage.tsx
      - apps/web/src/features/jobs/JobBoardPage.test.tsx
      - apps/web/src/features/jobs/JobPostingPage.tsx
      - apps/web/src/features/jobs/JobPostingPage.test.tsx
    rationale: |
      Covers AC6 and AC7 against the design's "Candidate – Job Board" and "Candidate – Job
      Posting" screens; reaching an unapproved posting is via a direct link (route param), not the
      prototype's "simulate navigation" buttons, which are prototype-only.

tests:
  - |
    AC1 (api/e2e, services/api/test/requisitions.e2e-spec.ts): a Hiring Manager submits a new
    requisition and it's created pending approval.
      const res = await request(app.getHttpServer())
        .post('/requisitions')
        .set('x-actor-id', 'priya').set('x-actor-role', 'hiring_manager')
        .send({ title: 'Senior Backend Engineer', department: 'Engineering', location: 'Remote (US)',
                employmentType: 'Full-time', headcount: 1, description: 'Own the rewrite.', action: 'submit' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending_approval');
  - |
    AC2 (api/e2e): a Recruiter or HR Admin approves a pending requisition and it becomes open.
      const res = await request(app.getHttpServer())
        .post(`/requisitions/${pendingId}/approve`)
        .set('x-actor-id', 'morgan').set('x-actor-role', 'hr_admin').send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('open');
  - |
    AC3 (api/e2e): a Hiring Manager attempting to approve a pending requisition is refused and the
    requisition stays pending.
      const res = await request(app.getHttpServer())
        .post(`/requisitions/${pendingId}/approve`)
        .set('x-actor-id', 'priya').set('x-actor-role', 'hiring_manager').send({});
      expect(res.status).toBe(403);
      const stillPending = await requisitionsService.findById(pendingId);
      expect(stillPending.status).toBe('pending_approval');
  - |
    AC4 (api/e2e): a Recruiter or HR Admin rejects a pending requisition with a reason and it
    becomes rejected.
      const res = await request(app.getHttpServer())
        .post(`/requisitions/${pendingId}/reject`)
        .set('x-actor-id', 'devon').set('x-actor-role', 'recruiter')
        .send({ reason: 'Headcount moves to Q1 planning.' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('rejected');
      expect(res.body.rejectionReason).toBe('Headcount moves to Q1 planning.');
  - |
    AC5 (api/e2e): a Hiring Manager attempting to reject a pending requisition is refused and it
    stays pending.
      const res = await request(app.getHttpServer())
        .post(`/requisitions/${pendingId}/reject`)
        .set('x-actor-id', 'priya').set('x-actor-role', 'hiring_manager').send({ reason: 'no' });
      expect(res.status).toBe(403);
  - |
    AC6 (api/e2e + web RTL): an unapproved requisition never appears on the candidate job board.
      const res = await request(app.getHttpServer()).get('/job-board');
      expect(res.body.map((r) => r.id)).not.toContain(draftOrPendingOrRejectedId);
    And in apps/web/src/features/jobs/JobBoardPage.test.tsx:
      expect(screen.queryByText(/Product Designer/i)).not.toBeInTheDocument();
  - |
    AC7 (api/e2e): applying to a requisition that hasn't been approved is refused.
      const res = await request(app.getHttpServer()).post(`/job-board/${pendingId}/apply`).send({});
      expect(res.status).toBe(409);
  - |
    AC8 (api/e2e): reassigning an open requisition updates the shown owner.
      const res = await request(app.getHttpServer())
        .post(`/requisitions/${openId}/reassign`)
        .set('x-actor-id', 'morgan').set('x-actor-role', 'hr_admin')
        .send({ newHiringManagerId: 'jordan' });
      expect(res.status).toBe(200);
      expect(res.body.hiringManagerId).toBe('jordan');
  - |
    AC9 (api/e2e): reassigning an open requisition with a pipeline leaves the pipeline/candidate
    count on the requisition untouched (pipeline itself is out of this story's scope, but
    reassignment must not mutate or clear it).
      const before = await requisitionsService.findById(openIdWithPipeline);
      await request(app.getHttpServer()).post(`/requisitions/${openIdWithPipeline}/reassign`)
        .set('x-actor-id', 'morgan').set('x-actor-role', 'hr_admin').send({ newHiringManagerId: 'jordan' });
      const after = await requisitionsService.findById(openIdWithPipeline);
      expect(after.pipelineCandidateCount).toBe(before.pipelineCandidateCount);
  - |
    AC10 (api/e2e): a Hiring Manager attempting to reassign an open requisition is refused.
      const res = await request(app.getHttpServer())
        .post(`/requisitions/${openId}/reassign`)
        .set('x-actor-id', 'priya').set('x-actor-role', 'hiring_manager')
        .send({ newHiringManagerId: 'jordan' });
      expect(res.status).toBe(403);
  - |
    AC11 (api/e2e + unit): an open requisition whose owner's role has since changed (and no
    reassignment has happened) remains open with its owner and pipeline unchanged on view.
      await usersRepo.update({ id: 'jordan' }, { role: 'support_engineer' });
      const res = await request(app.getHttpServer()).get(`/requisitions/${openOwnedByJordan}`)
        .set('x-actor-id', 'morgan').set('x-actor-role', 'hr_admin');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('open');
      expect(res.body.hiringManagerId).toBe('jordan');
  - |
    AC12 (api/e2e + web RTL): a draft, once saved without submitting, shows in the Hiring
    Manager's list as draft.
      const res = await request(app.getHttpServer()).post('/requisitions')
        .set('x-actor-id', 'priya').set('x-actor-role', 'hiring_manager')
        .send({ title: 'Staff Engineer', action: 'draft' });
      expect(res.body.status).toBe('draft');
      const list = await request(app.getHttpServer()).get('/requisitions')
        .set('x-actor-id', 'priya').set('x-actor-role', 'hiring_manager');
      expect(list.body.find((r) => r.id === res.body.id).status).toBe('draft');
    And in apps/web/src/features/requisitions/MyRequisitionsPage.test.tsx:
      expect(screen.getByText('Draft')).toBeInTheDocument();
  - |
    AC13 (api/e2e): submitting a draft moves it to pending approval.
      const res = await request(app.getHttpServer()).post(`/requisitions/${draftId}/submit`)
        .set('x-actor-id', 'priya').set('x-actor-role', 'hiring_manager').send({});
      expect(res.body.status).toBe('pending_approval');
  - |
    AC14 (web RTL): a rejected requisition shows as rejected when the Hiring Manager views it.
      render(<RequisitionDetailPage requisitionId="REQ-1031" />, { actor: hiringManagerActor });
      expect(await screen.findByText(/Rejected by/i)).toBeInTheDocument();
  - |
    AC15 (api/e2e): resubmitting a rejected requisition creates it in pending approval again.
      const res = await request(app.getHttpServer()).post(`/requisitions/${rejectedId}/submit`)
        .set('x-actor-id', 'priya').set('x-actor-role', 'hiring_manager').send({});
      expect(res.body.status).toBe('pending_approval');
      expect(res.body.rejectionReason).toBeNull();
  - |
    AC16 (api/e2e): a Recruiter or HR Admin attempting to reassign a pending-approval requisition
    is refused.
      const res = await request(app.getHttpServer()).post(`/requisitions/${pendingId}/reassign`)
        .set('x-actor-id', 'morgan').set('x-actor-role', 'hr_admin')
        .send({ newHiringManagerId: 'jordan' });
      expect(res.status).toBe(409);
  - |
    AC17 (api/e2e): reassigning an open requisition to a user without the Hiring Manager role is
    refused.
      const res = await request(app.getHttpServer()).post(`/requisitions/${openId}/reassign`)
        .set('x-actor-id', 'morgan').set('x-actor-role', 'hr_admin')
        .send({ newHiringManagerId: 'sam' });
      expect(res.status).toBe(400);

assumptions_or_open_questions:
  - |
    No auth/session system exists anywhere in this codebase yet (comp_identity_provider/Cognito
    isn't wired into comp_api_service or comp_web_app). This plan adds a minimal, explicitly
    temporary header-based actor stand-in (`x-actor-id`/`x-actor-role` on the API,
    `ActorContext` on the web app) rather than building real Cognito JWT verification, which is a
    platform-wide concern bigger than this story. If a parallel auth story already exists or is
    planned, its actor-extraction should replace `ActorMiddleware`/`ActorContext` without touching
    `RolesGuard`, the service, or any screen.
  - |
    No user/identity directory exists either. This plan adds a minimal local `User` table (id,
    name, role, employment_status) scoped only to what requisition RBAC and reassignment-target
    listing need (AC11, AC17) — not a full identity sync. The parent epic notes Core HR & Employee
    Records owns "employee master data"; once that exists, this table should likely become a view
    or be replaced by a call into that service.
  - |
    No ORM/database wiring exists yet, so this plan chooses TypeORM + `pg` against the already-
    confirmed Postgres 16/RDS target, matching common Nest+Postgres convention. For e2e tests,
    `synchronize: true` is used only when `NODE_ENV=test` against a reachable test database (env
    var `DATABASE_URL`); production always runs via the committed migration. Open question: does
    CI already provision a Postgres instance for e2e, or does this story also need to add that
    provisioning (e.g. a docker-compose service)? Assumed yes, a reachable instance is available,
    since the component stack already commits to RDS Postgres 16 for the project as a whole.
  - |
    "Candidate pipeline" is treated as an opaque, already-existing concept for this story
    (a `pipelineCandidateCount`/placeholder association on `JobRequisition`) since pipeline
    management itself is explicitly out of scope. AC9's test only asserts reassignment doesn't
    mutate it, not that a full pipeline model is built.
  - |
    AC7's "application is refused" is implemented as a guard on `POST /job-board/:id/apply` that
    throws unless the requisition is open; a *successful* apply is a no-op acknowledgement (no
    persisted application/pipeline record), since building the real application-intake flow is
    candidate sourcing, which the story explicitly excludes.
  - |
    The approved prototype's `.chip-neutral` (Draft status) and `.modal-overlay` scrim are called
    out in the design's own notes as composite patterns beyond the current design-system token set.
    This plan implements them using the exact recipes the design documents (chip-neutral from
    `color-bg-subtle`/`color-fg-muted`/`color-border`; overlay from the same alpha-blended
    `color-fg` recipe already used for `--shadow-card`) rather than inventing new values, but does
    not promote them into a shared design-system package — that's flagged by the design itself as
    a follow-up, not this story.
  - |
    The design's Reject button uses a dedicated danger variant (red outline) rather than the
    generic UI guideline of "one primary action, everything else secondary." Since the prototype is
    the approved source of truth for this item, this plan follows the design (a `.btn-danger`-
    equivalent Tailwind composition) for Reject/destructive actions instead of the generic
    secondary-everything-else rule.
  - |
    Error status codes (403 for role refusals, 409 for invalid state transitions, 400 for an
    ineligible reassignment target) are this plan's own choice, since no ACs specify HTTP
    semantics — flagging in case the reviewer wants a different convention (e.g. 422 instead of
    400).

estimated_points: 8

package_dependencies:
  - name: typeorm
    version: ^0.3.20
    ecosystem: npm
    component_id: comp_api_service
    rationale: |
      ORM for the `User`/`JobRequisition` entities and the migration that creates them; no ORM
      exists in comp_api_service today.
  - name: "@nestjs/typeorm"
    version: ^11.0.0
    ecosystem: npm
    component_id: comp_api_service
    rationale: Nest-idiomatic module/DI wiring for TypeORM, matching the project's NestJS stack.
  - name: pg
    version: ^8.13.1
    ecosystem: npm
    component_id: comp_api_service
    rationale: Postgres driver required by TypeORM to connect to the confirmed RDS for PostgreSQL 16 target.
  - name: class-validator
    version: ^0.14.1
    ecosystem: npm
    component_id: comp_api_service
    rationale: |
      Request DTO validation (e.g. required title/department, reason required on reject) via
      Nest's `ValidationPipe`, which isn't set up anywhere in the scaffold yet.
  - name: class-transformer
    version: ^0.5.1
    ecosystem: npm
    component_id: comp_api_service
    rationale: Required peer of class-validator's decorator-based DTOs under Nest's ValidationPipe.
  - name: react-router-dom
    version: ^7.1.1
    ecosystem: npm
    component_id: comp_web_app
    rationale: |
      No client-side routing exists yet (`App.tsx` renders a single static placeholder); needed
      for the six screens (My requisitions, Create/Edit, Detail, Approvals, Job board, Posting).

notes: |
  This story lands on a genuinely empty scaffold: `services/api/src/app.module.ts` only wires a
  health-check controller, and `apps/web/src/App.tsx` is a static dark-theme placeholder. Nothing
  in this plan is a refactor of existing requisition code — it's the first domain feature in the
  repository, which is why the scope list includes foundational pieces (schema, auth stand-in,
  routing/theme) alongside the workflow itself.

  ```mermaid
  flowchart TD
    AppModule[AppModule] --> ReqModule[RequisitionsModule]
    ReqModule --> ReqController[RequisitionsController]
    ReqController --> RolesGuard[RolesGuard + CurrentActor decorator]
    ReqController --> ReqService[RequisitionsService - state machine]
    ReqService --> JobReqEntity[JobRequisition entity]
    ReqService --> UserEntity[User entity]
    JobReqEntity --> DataSource[TypeORM DataSource - Postgres 16]
    UserEntity --> DataSource

    AppTsx[App.tsx] --> AppShell[AppShell: Sidebar + Topbar]
    AppShell --> MyReqs[MyRequisitionsPage]
    AppShell --> ReqForm[RequisitionFormPage]
    AppShell --> ReqDetail[RequisitionDetailPage + ReassignModal]
    AppShell --> Approvals[ApprovalQueuePage]
    AppShell --> JobBoard[JobBoardPage]
    AppShell --> JobPosting[JobPostingPage]
    MyReqs --> ReqApi[requisitionsApi.ts]
    ReqForm --> ReqApi
    ReqDetail --> ReqApi
    Approvals --> ReqApi
    JobBoard --> ReqApi
    JobPosting --> ReqApi
    ReqApi -. HTTP .-> ReqController

    classDef touched fill:#f96,color:#000
    class AppModule,ReqModule,ReqController,RolesGuard,ReqService,JobReqEntity,UserEntity,DataSource,AppTsx,AppShell,MyReqs,ReqForm,ReqDetail,Approvals,JobBoard,JobPosting,ReqApi touched
  ```

review_focus: |
  In scope: the requisition state machine and its RBAC rules (AC1-5, AC8-17) on the API, the
  candidate-facing read/apply-refusal surface (AC6-7), and the six web screens from the approved
  prototype. Explicitly out of scope and not built here: real Cognito authentication (a header-
  based actor stand-in is used instead — see assumptions), any candidate pipeline/application
  persistence beyond a refusal check, and promoting the design's two composite patterns
  (chip-neutral, modal-overlay) into a shared design-system package. The riskiest area is the
  reassignment state-gating (AC8-11, AC16-17) — four different refusal reasons (wrong role, wrong
  requisition state, ineligible target role) map to three different HTTP status codes in this
  plan's own convention (403/409/400), which a reviewer should check for consistency rather than
  assume is a typo. Also note the Reject button intentionally uses a danger variant rather than
  the generic "secondary for everything but primary" UI guideline, because the approved prototype
  specifies it that way.

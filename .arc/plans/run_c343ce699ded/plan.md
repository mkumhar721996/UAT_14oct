summary: |
  Implements the employee master record and its dated employment history (job title,
  department, contract type, salary) for UAT-14OCT-STORY-012. Today `services/api` and
  `apps/web` are bare NestJS/React scaffolds with no ORM, no auth/RBAC wiring and no
  domain code, so this plan both bootstraps the minimum foundation (TypeORM + Postgres
  connection, a Cognito-JWT auth guard with role-based access control, DTO validation,
  React routing, and the design-system CSS import into the web app) and builds the full
  feature on top of it: HR-Admin-only create/edit of a profile with system-generated
  employee ID, an append-only employment history per core field, employee self-service
  for non-core fields with an HR-approval workflow for core-field change requests, and
  the six screens already approved in the design prototype (Employee Directory, New
  Employee Profile, Employee Profile Detail, Edit Employee Profile, My Profile
  self-service, Pending Changes review). Tenant isolation (`tenant_id` column, scoped on
  every query per ADR-0011) is applied throughout.
scope:
  - description: |
      Add the API's data-layer and HTTP dependencies not yet present in the scaffold:
      `@nestjs/typeorm`, `typeorm`, `pg` for Postgres access, `class-validator` /
      `class-transformer` for DTO validation, and `aws-jwt-verify` for verifying
      Cognito-issued access tokens. Wire a global `ValidationPipe` and `app.enableCors()`
      in `main.ts` so the web app (a different origin/port per `.env`) can call it.
    files:
      - services/api/package.json
      - services/api/src/main.ts
    rationale: |
      None of these exist in the current scaffold (`services/api/package.json` only
      lists `@nestjs/common|core|platform-express`), but DTO validation, DB access and
      token verification are required by nearly every acceptance criterion.
  - description: |
      Add a TypeORM data source and a migration creating `employees`,
      `employment_history_entries` and `pending_change_requests`, each with a
      `tenant_id` column per ADR-0011, plus a `employee_number_seq` sequence used to
      generate IDs like `EMP-1045`.
    files:
      - services/api/src/database/data-source.ts
      - services/api/src/database/typeorm.module.ts
      - services/api/src/database/migrations/1700000000000-create-employees-schema.ts
    rationale: |
      No ORM or schema exists yet. `employees` holds only the CURRENT value of job
      title/department/contract type/salary (AC6: one active value per field);
      `employment_history_entries` is append-only (AC4/AC5/AC13/AC14 — no update/delete
      path is ever built against it); `pending_change_requests` backs the
      employee-submitted, HR-approved workflow (AC11/AC12).
  - description: |
      Add a minimal Cognito JWT auth guard and role guard: `CognitoAuthGuard` verifies
      the bearer token via `aws-jwt-verify` and sets
      `request.user = { sub, tenantId, role, employeeId }`; `RolesGuard` reads a
      `@Roles('hr_admin')` decorator and 403s otherwise; `@CurrentUser()` is a param
      decorator returning `request.user`.
    files:
      - services/api/src/auth/cognito-auth.guard.ts
      - services/api/src/auth/roles.guard.ts
      - services/api/src/auth/roles.decorator.ts
      - services/api/src/auth/current-user.decorator.ts
      - services/api/src/app.module.ts
    rationale: |
      AC3 (only HR Admins may create/edit), AC11/AC12 (behavior differs for the
      self-editing employee vs HR Admin) and tenant scoping (ADR-0011) all depend on
      knowing the caller's role, tenant and own employee record. No auth code exists in
      the scaffold yet even though ADR-0007 names Cognito as the identity provider, so
      this is the minimum needed to enforce RBAC — it does not implement Cognito user
      pool configuration, sign-up/sign-in flows or token refresh, which are out of scope
      for this story.
  - description: |
      Add the `employees` domain module: entities, DTOs and a service with one method
      per operation, e.g.
      `createEmployee(tenantId: string, dto: CreateEmployeeDto): Promise<Employee>`,
      `updateAsHrAdmin(tenantId: string, employeeId: string, dto: UpdateEmployeeDto): Promise<Employee>`,
      `updateOwnContact(tenantId: string, employeeId: string, dto: UpdateContactDto): Promise<Employee>`,
      `submitChangeRequest(tenantId: string, employeeId: string, dto: CreateChangeRequestDto): Promise<PendingChangeRequest>`,
      `approveChangeRequest(tenantId: string, requestId: string, approverSub: string): Promise<Employee>`,
      `rejectChangeRequest(tenantId: string, requestId: string): Promise<void>`,
      `getHistory(tenantId: string, employeeId: string): Promise<EmploymentHistoryEntry[]>`.
      `updateAsHrAdmin` requires an `effectiveDate` field alongside any of
      jobTitle/department/contractType/salary that changed, and appends one history row
      per changed core field without touching earlier rows.
    files:
      - services/api/src/employees/entities/employee.entity.ts
      - services/api/src/employees/entities/employment-history-entry.entity.ts
      - services/api/src/employees/entities/pending-change-request.entity.ts
      - services/api/src/employees/dto/create-employee.dto.ts
      - services/api/src/employees/dto/update-employee.dto.ts
      - services/api/src/employees/dto/update-contact.dto.ts
      - services/api/src/employees/dto/create-change-request.dto.ts
      - services/api/src/employees/employees.service.ts
      - services/api/src/employees/employees.service.spec.ts
    rationale: |
      `CreateEmployeeDto` marks only `fullName` and `startDate` as `@IsNotEmpty()`
      (AC7/AC8); job title/department/contract type/salary are `@IsOptional()`.
      `employeeNumber` is generated server-side from `employee_number_seq` and never
      accepted as client input (AC9/AC10).
  - description: |
      Add `EmployeesController` (`/employees`) and `PendingChangeRequestsController`
      (`/pending-change-requests`), gated by `CognitoAuthGuard` + `RolesGuard`, and
      register both plus the TypeORM feature repositories in `EmployeesModule`,
      imported from `AppModule`.
    files:
      - services/api/src/employees/employees.controller.ts
      - services/api/src/employees/pending-change-requests.controller.ts
      - services/api/src/employees/employees.module.ts
      - services/api/src/app.module.ts
      - services/api/test/employees.e2e-spec.ts
    rationale: |
      Route shape: `POST /employees` and `PATCH /employees/:id` are `@Roles('hr_admin')`
      (AC1/AC2/AC3); `GET /employees`, `GET /employees/:id`, `GET /employees/:id/history`
      are open to any authenticated role (directory/profile are read-only for
      non-admins); `PATCH /employees/me/contact` and `POST /employees/me/change-requests`
      let the signed-in employee edit their own record (AC11/AC12) — "me" is resolved
      from `@CurrentUser().employeeId`, never from a client-supplied id, so an employee
      cannot target another employee's record. No `PATCH`/`DELETE` route is ever added
      for history rows or for applying a change request directly (AC14 is enforced by
      omission, not by a guard).
  - description: |
      Import the already-approved design-system tokens and utility classes into the web
      app, and add client-side routing.
    files:
      - apps/web/src/index.css
      - apps/web/vite.config.ts
      - apps/web/package.json
      - apps/web/src/App.tsx
    rationale: |
      `design-system/tokens.css` and `design-system/prototype-utils.css` (from
      UAT-14OCT-CHORE-005) already define `.sidebar`, `.topbar`, `.card`, `.table`,
      `.chip-success`/`.chip-warning`, `.btn-primary`/`.btn-secondary`, `.field` +
      `.input`/`.select` etc. with `--color-primary: #2563eb` (blue) — these are
      imported as-is rather than re-authored. `react-router-dom` is added because the
      scaffold currently renders a single static `<App>` with no routing. `vite.config.ts`
      gets `server.fs.allow` pointed at the repo root so Vite's dev server can read the
      design-system CSS living outside `apps/web/`.
  - description: |
      Add a typed `apiClient` (fetch wrapper reading `import.meta.env.VITE_ARC_API_URL`,
      attaching the bearer token) and a minimal `useAuth()` hook exposing
      `{ role: 'hr_admin' | 'employee', employeeId, tenantId }` decoded from the current
      session token.
    files:
      - apps/web/src/lib/apiClient.ts
      - apps/web/src/lib/auth.ts
    rationale: |
      Nothing in the scaffold currently calls the API or knows the signed-in user's role;
      every page needs both to decide what to render (AC3) and which endpoint to call
      (AC11 vs AC12).
  - description: |
      Build the six screens from the approved prototype
      (`.arc/designs/UAT-14OCT-STORY-012-design.html`), reusing its exact structure and
      class names (`.app-shell`/`.sidebar`/`.topbar`/`.content`, `.card`, `.table`,
      `.active-grid`/`.active-cell`, `.readonly-row`, `.effective-date-field`, `.banner-*`,
      `.chip-success`/`.chip-warning`, `.empty-state`, `.skeleton`) but driven by
      `apiClient` instead of the in-memory `EMPLOYEE_FIXTURES`.
    files:
      - apps/web/src/routes/EmployeeDirectoryPage.tsx
      - apps/web/src/routes/NewEmployeeProfilePage.tsx
      - apps/web/src/routes/EmployeeProfileDetailPage.tsx
      - apps/web/src/routes/EditEmployeeProfilePage.tsx
      - apps/web/src/routes/MyProfilePage.tsx
      - apps/web/src/routes/PendingChangesPage.tsx
      - apps/web/src/routes/EmployeeProfileDetailPage.test.tsx
      - apps/web/src/routes/NewEmployeeProfilePage.test.tsx
      - apps/web/e2e/employee-profile.spec.ts
    rationale: |
      Screen 2 (New Employee Profile, lines ~900-956 of the prototype) only marks Full
      name and Start date with `.required-mark` — job title/department/contract
      type/salary render as plain optional inputs (AC7/AC8). Screen 3 (Employee Profile
      Detail, ~1051-1087) shows the employee ID as a `.readonly-value.mono` span with no
      input (AC10), an "Active now" `.active-grid` of only current values (AC6), and an
      employment history `.table` whose last column is literally the text "No edit or
      delete" (`.history-actions-col`, AC14) sorted oldest-to-newest (AC5, see the
      prototype's own `historyFor()` sort). Screen 4 (Edit Employee Profile, ~1101-1192)
      reveals a `.effective-date-field` per core field only once that field's value
      differs from `data-original`, and makes it required before submit — this is the
      AC13 effective-date capture. Screen 5 (My Profile, ~1257-1363) saves "Contact
      details" immediately on submit (AC11) and turns a core-field edit into a
      `.request-form` that shows a `.banner-warning` "Pending HR approval" until
      resolved (AC12). Screen 6 (Pending Changes, ~1407-1461) is the HR Admin's
      approve/reject queue; approving appends a history row and updates the active
      value (AC4/AC6/AC13), rejecting discards the request untouched.
  - description: |
      Add role-based route guarding in `App.tsx` so a non-HR-Admin hitting
      `/employees/new`, `/employees/:id/edit` or `/pending-changes` sees the
      prototype's `.access-restricted` state instead of the form, matching the
      prototype's role-switcher behavior for AC3.
    files:
      - apps/web/src/App.tsx
    rationale: |
      The prototype shows this exact state (glyph + "Access restricted" + "No profile
      was created" wording) on Screens 2 and 6 for the `employee` role — it is reused
      verbatim rather than inventing new copy.
  - description: |
      Flag and resolve a conflict between the approved prototype and the project's UI
      guidelines/design-system tokens: a `<style>` block appended to the prototype
      (comment: "PO feedback (2026-10-14): change the colour and background to pink")
      overrides `--color-primary`, backgrounds and borders to a pink palette and states
      in its own comment that this is "a scoped, named palette proposal for THIS
      prototype only — not existing design-system tokens" that "design-system-bootstrap
      should add equivalents... rather than this file redefining the canonical token
      names" if approved. UAT-14OCT-CHORE-005 (design system bootstrap) already shipped
      and `design-system/tokens.css` still defines `--color-primary: #2563eb` (blue) —
      the pink proposal was not adopted into the canonical tokens. This plan therefore
      builds against the canonical blue tokens already committed in
      `design-system/tokens.css`, not the prototype's pink overlay, and takes the
      prototype's own layout/component structure (sidebar, topbar, cards, tables,
      banners, grids) as the approved design.
    files: []
    rationale: |
      Silently picking the pink overlay would ship an unapproved, self-described
      "proposal" as production styling; silently ignoring it without comment would hide
      a real discrepancy between the two source-of-truth documents from the reviewer.
tests:
  - |
    AC1 (api e2e): POST /employees as hr_admin with all four core fields returns 201 and
    echoes them:
    const res = await request(app.getHttpServer()).post('/employees')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send({ fullName: 'Jordan Lee', startDate: '2026-01-05', jobTitle: 'Product Designer', department: 'Design', contractType: 'Full-time', salary: 95000 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ jobTitle: 'Product Designer', department: 'Design', contractType: 'Full-time', salary: 95000 });
  - |
    AC2 (api e2e): PATCH /employees/:id changing jobTitle with an effective date, then
    GET shows the new value:
    await request(app.getHttpServer()).patch(`/employees/${id}`).set('Authorization', `Bearer ${hrAdminToken}`)
      .send({ jobTitle: 'Senior Product Designer', jobTitleEffectiveDate: '2026-02-01' }).expect(200);
    const detail = await request(app.getHttpServer()).get(`/employees/${id}`).set('Authorization', `Bearer ${hrAdminToken}`);
    expect(detail.body.jobTitle).toBe('Senior Product Designer');
  - |
    AC3 (api e2e): a token with role 'employee' attempting POST /employees is rejected
    and nothing is created:
    const res = await request(app.getHttpServer()).post('/employees').set('Authorization', `Bearer ${employeeToken}`)
      .send({ fullName: 'Should Not Save', startDate: '2026-01-01' });
    expect(res.status).toBe(403);
    const list = await request(app.getHttpServer()).get('/employees').set('Authorization', `Bearer ${hrAdminToken}`);
    expect(list.body.find((e: any) => e.fullName === 'Should Not Save')).toBeUndefined();
  - |
    AC4 (api unit, employees.service.spec.ts): changing jobTitle twice appends two
    history rows and keeps the first:
    await service.updateAsHrAdmin(tenantId, id, { jobTitle: 'Product Designer', jobTitleEffectiveDate: '2026-01-05' });
    await service.updateAsHrAdmin(tenantId, id, { jobTitle: 'Senior Product Designer', jobTitleEffectiveDate: '2026-02-01' });
    const history = await service.getHistory(tenantId, id);
    expect(history.map(h => h.newValue)).toEqual(['Product Designer', 'Senior Product Designer']);
  - |
    AC5 (api e2e): GET /employees/:id/history returns entries ordered by effectiveDate
    ascending after out-of-order inserts:
    const history = await request(app.getHttpServer()).get(`/employees/${id}/history`).set('Authorization', `Bearer ${hrAdminToken}`);
    expect(history.body.map((h: any) => h.effectiveDate)).toEqual(['2026-01-05', '2026-02-01']);
  - |
    AC6 (api e2e): after changing contractType, the profile exposes exactly one active
    value for that field:
    expect(detail.body.contractType).toBe('Part-time');
  - |
    AC7 (api e2e): POST /employees missing startDate (or fullName) returns 400 and
    creates nothing:
    const res = await request(app.getHttpServer()).post('/employees').set('Authorization', `Bearer ${hrAdminToken}`)
      .send({ fullName: 'No Start Date' });
    expect(res.status).toBe(400);
  - |
    AC8 (api e2e): POST /employees with only fullName and startDate succeeds:
    const res = await request(app.getHttpServer()).post('/employees').set('Authorization', `Bearer ${hrAdminToken}`)
      .send({ fullName: 'Min Viable', startDate: '2026-01-01' });
    expect(res.status).toBe(201);
  - |
    AC9 (api e2e): the saved profile includes a system-generated employeeNumber matching
    EMP-<digits>:
    expect(res.body.employeeNumber).toMatch(/^EMP-\d+$/);
  - |
    AC10 (web RTL, EmployeeProfileDetailPage.test.tsx): the employee ID renders as text
    with no associated input/edit control:
    render(<EmployeeProfileDetailPage />, { wrapper: TestProviders });
    expect(await screen.findByText('EMP-1042')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /employee id/i })).not.toBeInTheDocument();
  - |
    AC11 (api e2e): the self-editing employee updates personalEmail directly, no
    approval step:
    const res = await request(app.getHttpServer()).patch('/employees/me/contact').set('Authorization', `Bearer ${employeeToken}`)
      .send({ personalEmail: 'new@personalmail.com' });
    expect(res.status).toBe(200);
    expect(res.body.personalEmail).toBe('new@personalmail.com');
  - |
    AC12 (api e2e): the self-editing employee requests a jobTitle change; the active
    value is unchanged until approved:
    await request(app.getHttpServer()).post('/employees/me/change-requests').set('Authorization', `Bearer ${employeeToken}`)
      .send({ field: 'jobTitle', requestedValue: 'Director of Engineering', effectiveDate: '2026-12-01' }).expect(201);
    const detail = await request(app.getHttpServer()).get(`/employees/${selfEmployeeId}`).set('Authorization', `Bearer ${hrAdminToken}`);
    expect(detail.body.jobTitle).toBe('Engineering Manager');
  - |
    AC13 (api e2e): an HR-Admin-recorded change's history entry carries both the
    entered effective date and a saved timestamp:
    expect(history.body[0]).toMatchObject({ effectiveDate: '2026-02-01' });
    expect(Number.isNaN(new Date(history.body[0].recordedAt).getTime())).toBe(false);
  - |
    AC14 (web RTL + api e2e): no edit/delete control renders for a history row, and no
    such route exists server-side:
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    await request(app.getHttpServer()).delete(`/employees/${id}/history/${historyId}`).set('Authorization', `Bearer ${hrAdminToken}`).expect(404);
assumptions_or_open_questions:
  - |
    Assumed the Cognito access token carries custom claims `tenant_id`, `role`
    ('hr_admin' | 'employee') and `employee_id` (linking the token to the signed-in
    user's own employee record for self-service). No Cognito user pool attribute
    mapping exists in this repo yet — if the real claim names differ, `CognitoAuthGuard`
    will need adjusting, but the RBAC/self-service logic built against it should not.
  - |
    Treated full Cognito user pool setup, sign-up/sign-in UI and token refresh as out of
    scope for this story — this plan only verifies and decodes already-issued tokens.
  - |
    Chose TypeORM as the ORM since no ORM choice exists yet in the scaffold and it has
    first-party NestJS integration (`@nestjs/typeorm`); this is a project-wide choice
    that future stories will also rely on, not something scoped narrowly to employees.
  - |
    Resolved the prototype-vs-design-system pink/blue conflict (see the dedicated scope
    item) by building against the canonical blue tokens in `design-system/tokens.css`,
    since the prototype's own comment describes the pink palette as an unadopted
    proposal.
  - |
    `pending_change_requests` rows are kept (status: pending/approved/rejected) rather
    than hard-deleted on resolution, unlike the prototype's in-memory array splice, so
    that an approve/reject action is reversible-by-audit rather than silently
    destructive; no AC requires surfacing that audit trail in the UI, so no screen
    exposes it.
  - |
    Assumed one HR-Admin-vs-employee role pair is sufficient for this story (matching
    the design's role switcher), with no additional roles (e.g. manager) in scope.
estimated_points: 8
package_dependencies:
  - name: "@nestjs/typeorm"
    version: ^11.0.0
    ecosystem: npm
    component_id: comp_api_service
    rationale: First-party NestJS integration for TypeORM, used to register the Postgres connection and feature repositories.
  - name: typeorm
    version: ^0.3.20
    ecosystem: npm
    component_id: comp_api_service
    rationale: ORM for the employees/employment_history_entries/pending_change_requests tables and migrations against Amazon RDS for PostgreSQL 16.
  - name: pg
    version: ^8.13.1
    ecosystem: npm
    component_id: comp_api_service
    rationale: Postgres driver required by TypeORM's postgres connection.
  - name: class-validator
    version: ^0.14.1
    ecosystem: npm
    component_id: comp_api_service
    rationale: Declarative DTO validation (AC7/AC8 required-field rules) enforced via a global ValidationPipe.
  - name: class-transformer
    version: ^0.5.1
    ecosystem: npm
    component_id: comp_api_service
    rationale: Required alongside class-validator for NestJS's ValidationPipe to transform/validate incoming payloads.
  - name: aws-jwt-verify
    version: ^4.0.1
    ecosystem: npm
    component_id: comp_api_service
    rationale: Official AWS library to verify Amazon Cognito-issued JWT access tokens in CognitoAuthGuard.
  - name: react-router-dom
    version: ^7.1.1
    ecosystem: npm
    component_id: comp_web_app
    rationale: The scaffold renders one static App component with no routing; six distinct screens/URLs are needed for this story.
notes: |
  This is the first domain feature built on top of the bare scaffolds from
  UAT-14OCT-CHORE-004/005, so it necessarily includes foundational wiring (DB
  connection, auth guard, routing, design-system import) alongside the employees
  feature itself — see the dedicated scope items and
  `assumptions_or_open_questions` above for what is deliberately treated as
  out-of-scope bootstrapping (full Cognito setup, ORM choice as a project-wide
  decision).

  ```mermaid
  flowchart TD
    classDef touched fill:#f96,color:#000
    classDef context fill:#eee,color:#000

    AppModule["AppModule\nservices/api/src/app.module.ts"]:::touched
    MainTs["main.ts\n(ValidationPipe, CORS)"]:::touched
    AuthGuard["CognitoAuthGuard"]:::touched
    RolesGuard["RolesGuard + @Roles"]:::touched
    EmployeesModule["EmployeesModule"]:::touched
    EmployeesController["EmployeesController"]:::touched
    PendingController["PendingChangeRequestsController"]:::touched
    EmployeesService["EmployeesService"]:::touched
    Entities["Employee / EmploymentHistoryEntry /\nPendingChangeRequest entities"]:::touched
    TypeOrm["TypeOrmModule + data-source.ts"]:::touched
    Postgres[("Amazon RDS Postgres 16\n(comp_relational_database)")]:::context

    AppModule --> MainTs
    AppModule --> EmployeesModule
    AppModule --> TypeOrm
    EmployeesController -->|"guarded by"| AuthGuard
    EmployeesController -->|"guarded by"| RolesGuard
    PendingController -->|"guarded by"| AuthGuard
    PendingController -->|"guarded by"| RolesGuard
    EmployeesModule --> EmployeesController
    EmployeesModule --> PendingController
    EmployeesController --> EmployeesService
    PendingController --> EmployeesService
    EmployeesService --> Entities
    Entities --> TypeOrm
    TypeOrm --> Postgres

    ApiClient["apps/web/src/lib/apiClient.ts"]:::touched
    UseAuth["apps/web/src/lib/auth.ts\n(useAuth)"]:::touched
    AppTsx["apps/web/src/App.tsx\n(routing + role guard)"]:::touched
    DirectoryPage["EmployeeDirectoryPage"]:::touched
    NewPage["NewEmployeeProfilePage"]:::touched
    DetailPage["EmployeeProfileDetailPage"]:::touched
    EditPage["EditEmployeeProfilePage"]:::touched
    SelfPage["MyProfilePage"]:::touched
    PendingPage["PendingChangesPage"]:::touched
    Tokens[("design-system/tokens.css +\nprototype-utils.css")]:::context

    AppTsx --> DirectoryPage
    AppTsx --> NewPage
    AppTsx --> DetailPage
    AppTsx --> EditPage
    AppTsx --> SelfPage
    AppTsx --> PendingPage
    DirectoryPage --> ApiClient
    NewPage --> ApiClient
    DetailPage --> ApiClient
    EditPage --> ApiClient
    SelfPage --> ApiClient
    PendingPage --> ApiClient
    AppTsx --> UseAuth
    AppTsx --> Tokens
    ApiClient -->|HTTP| EmployeesController
    ApiClient -->|HTTP| PendingController
  ```
review_focus: |
  In scope: the employees master record (create/edit with RBAC), its append-only
  employment history, the self-service contact-vs-approval split, and the six
  prototype screens wired to a real API. Out of scope and should not be flagged as
  missing: documents, org chart view, lifecycle status transitions (explicitly
  excluded by the story), and full Cognito user pool/sign-in setup (this plan only
  verifies already-issued tokens — see assumptions). The riskiest area is the
  HR-Admin-edit vs employee-self-edit branching for the four core fields (same four
  fields, opposite behavior depending on caller role: direct + history vs.
  pending-and-approve) — a reviewer should check that `PATCH /employees/:id` and
  `POST /employees/me/change-requests` cannot be confused for each other (e.g. an
  employee token must never reach the direct-update path for a core field, and an
  HR Admin editing their own record via `/employees/:id` must not accidentally be
  routed through the "me" self-service path). Also deliberate and worth flagging to
  a reviewer rather than treating as a bug: the prototype's pink color override was
  NOT adopted — this plan builds against the existing blue `design-system/tokens.css`
  instead (see the dedicated scope item explaining the conflict).

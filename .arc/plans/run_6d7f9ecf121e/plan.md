summary: |
  Adds defect creation end-to-end: a new `defects` domain in the NestJS API (entity, migration,
  DTO, service, controller, module) that lets a signed-in user with the `reporter` role submit a
  new defect with title, description, severity and steps to reproduce required, three optional
  detail fields, a severity enum restricted to Critical/High/Medium/Low, a status that always
  starts at `New`, and a 403 for any non-Reporter caller; and a new "Report a defect" page in the
  web app (built from Screen 2 of the approved prototype) that performs the same validation
  client-side for UX, posts to the new endpoint, and renders the created record's read-only
  summary. The shared `Role` type (already used across the whole API for RBAC) gains the
  `reporter` literal so the existing `CognitoAuthGuard`/`RolesGuard`/`@Roles()` machinery used by
  the employees domain can be reused as-is. Editing, the defects list/detail view and the status
  workflow are explicitly out of scope per the story description and the epic's own split between
  "creation" and "detail view/edit".

scope:
  - description: |
      Widen the shared `Role` type to include `'reporter'`, and widen `CognitoAuthGuard`'s claims
      check to accept it. Today `Role` is `'hr_admin' | 'employee'` and the guard hard-codes
      `role !== 'hr_admin' && role !== 'employee'`; both need a third literal.

      Change `employee-fields.ts`:
      ```ts
      export const ROLES = ['hr_admin', 'employee', 'reporter'] as const;
      export type Role = (typeof ROLES)[number];
      ```
      Change `cognito-auth.guard.ts`'s claim check to:
      ```ts
      if (typeof sub !== 'string' || typeof tenantId !== 'string' || !ROLES.includes(role as Role)) {
      ```
    files:
      - services/api/src/employees/employee-fields.ts
      - services/api/src/auth/cognito-auth.guard.ts
    rationale: |
      `Role`/`AuthUser`/`RolesGuard`/`@Roles()` are already the one shared RBAC mechanism for the
      whole API (not employees-specific despite the file's location); reusing it for the Reporter
      role avoids inventing a parallel auth concept for this story. Keeping `Role` in
      `employees/employee-fields.ts` is existing-structure reuse, not a new abstraction.

  - description: |
      Add the `defects` persistence layer: a `DefectSeverity` constant, the `Defect` entity, a
      migration creating the table, and registration in `data-source.ts`.

      `defects/defect-severities.ts`:
      ```ts
      export const DEFECT_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
      export type DefectSeverity = (typeof DEFECT_SEVERITIES)[number];
      ```
      `defects/entities/defect.entity.ts` (same column-naming convention as `Employee`):
      ```ts
      @Entity('defects')
      export class Defect {
        @PrimaryGeneratedColumn('uuid') id!: string;
        @Column({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
        @Column({ type: 'text' }) title!: string;
        @Column({ type: 'text' }) description!: string;
        @Column({ type: 'text' }) severity!: DefectSeverity;
        @Column({ name: 'steps_to_reproduce', type: 'text' }) stepsToReproduce!: string;
        @Column({ name: 'expected_result', type: 'text', nullable: true }) expectedResult!: string | null;
        @Column({ name: 'actual_result', type: 'text', nullable: true }) actualResult!: string | null;
        @Column({ type: 'text', nullable: true }) environment!: string | null;
        @Column({ type: 'text', default: 'New' }) status!: string;
        @Column({ name: 'reported_by', type: 'text' }) reportedBy!: string;
        @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
        @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
      }
      ```
      Migration `database/migrations/1700000000002-create-defects-schema.ts` creates `defects`
      with `severity text NOT NULL CHECK (severity IN ('Critical','High','Medium','Low'))` and
      `status text NOT NULL DEFAULT 'New'`, plus `CREATE INDEX idx_defects_tenant_status ON
      defects (tenant_id, status)`. `data-source.ts` adds `Defect` to `entities` and the new
      migration class to `migrations`.
    files:
      - services/api/src/defects/defect-severities.ts
      - services/api/src/defects/entities/defect.entity.ts
      - services/api/src/database/migrations/1700000000002-create-defects-schema.ts
      - services/api/src/database/data-source.ts
    rationale: |
      Mirrors the existing `Employee`/`employees-schema` migration pattern exactly (snake_case
      columns via `name:`, uuid PK with `gen_random_uuid()`, timestamptz audit columns,
      tenant-scoped). The DB-level severity CHECK constraint backs AC4's invariant at the
      persistence layer in addition to the DTO, matching this codebase's pattern of defending
      invariants at more than one layer (e.g. `uq_pending_change_requests_open`).

  - description: |
      Add `CreateDefectDto` with per-field required-field messages copied verbatim from the
      approved prototype's `REQUIRED_FIELDS` messages, and `DefectsService.createDefect`.

      ```ts
      export class CreateDefectDto {
        @IsString() @IsNotEmpty({ message: 'Enter a title for the defect.' })
        @Matches(/\S/, { message: 'Enter a title for the defect.' }) title!: string;

        @IsString() @IsNotEmpty({ message: 'Describe the defect.' })
        @Matches(/\S/, { message: 'Describe the defect.' }) description!: string;

        @IsIn(DEFECT_SEVERITIES, { message: 'Choose a severity.' }) severity!: DefectSeverity;

        @IsString() @IsNotEmpty({ message: 'Describe the steps to reproduce the defect.' })
        @Matches(/\S/, { message: 'Describe the steps to reproduce the defect.' }) stepsToReproduce!: string;

        @IsOptional() @IsString() expectedResult?: string;
        @IsOptional() @IsString() actualResult?: string;
        @IsOptional() @IsString() environment?: string;
      }
      ```
      `DefectsService.createDefect(tenantId: string, dto: CreateDefectDto, reportedBy: string): Promise<Defect>`
      trims required fields, converts blank optional fields to `null` (same `toText` idiom as
      `EmployeesService`), and always sets `status: 'New'`.
    files:
      - services/api/src/defects/dto/create-defect.dto.ts
      - services/api/src/defects/defects.service.ts
      - services/api/src/defects/defects.service.spec.ts
    rationale: |
      The 3-decorator combo (`IsString`+`IsNotEmpty`+`Matches(/\S/)`) is the exact pattern already
      used by `CreateEmployeeDto.fullName`, kept for consistency. Using the DTO's validation layer
      (rather than hand-rolled checks in the service) matches how every other create/update route
      in this API reports 400s.

  - description: |
      Add `DefectsController` (`POST /defects`, `@Roles('reporter')`, guarded by the same
      `CognitoAuthGuard, RolesGuard` pair every other controller uses) and `DefectsModule`, wired
      into `AppModule`.
      ```ts
      @Controller('defects')
      @UseGuards(CognitoAuthGuard, RolesGuard)
      export class DefectsController {
        constructor(private readonly defects: DefectsService) {}

        @Post()
        @Roles('reporter')
        create(@CurrentUser() user: AuthUser, @Body() dto: CreateDefectDto) {
          return this.defects.createDefect(user.tenantId, dto, user.sub);
        }
      }
      ```
    files:
      - services/api/src/defects/defects.controller.ts
      - services/api/src/defects/defects.module.ts
      - services/api/src/app.module.ts
    rationale: |
      Because guards run before pipes in Nest's request pipeline, `RolesGuard` rejects a
      non-Reporter with 403 before `CreateDefectDto` validation ever runs — satisfying AC6's
      "regardless of what they filled in" and matching the prototype's explicit note that
      authorization is checked before field validation.

  - description: |
      Add `test/defects.e2e-spec.ts` covering AC1, AC2 (parameterized over the four required
      fields), AC3, AC4, AC5 and AC6 against the real Nest pipeline (guards + `ValidationPipe`),
      using the existing `createTestApp()`/`tokenFor()`/`FakeDataSource` test harness — no new
      test infrastructure needed.
    files:
      - services/api/test/defects.e2e-spec.ts
    rationale: |
      `employees.e2e-spec.ts` already proves this harness exercises guards, DTO validation and
      the fake in-memory `DataSource` together; reusing it for defects keeps the two domains
      tested the same way.

  - description: |
      Widen the web `Role`/`Session` type to include `'reporter'` and widen the test helper
      `signIn` to accept it.
      Before: `export type Role = 'hr_admin' | 'employee'` and `readSession` rejects any other
      claim. After: add `'reporter'` to both the type and the `payload.role !== ...` guard in
      `readSession`.
    files:
      - apps/web/src/lib/auth.ts
      - apps/web/src/test/helpers.tsx
    rationale: |
      Mirrors the API-side `Role` widening; the web app decodes (but does not verify) the same
      token claims, so the two must stay in sync.

  - description: |
      Add `Defect`/`DefectSeverity` types, the severity option list + icon/class metadata, and the
      required-field message list (copied from the prototype, shared by the form's validation).
      ```ts
      export const DEFECT_SEVERITIES: DefectSeverity[] = ['Critical', 'High', 'Medium', 'Low']
      export const SEVERITY_META: Record<DefectSeverity, { icon: string; className: string }> = {
        Critical: { icon: '⛔', className: 'sev-critical' },
        High: { icon: '▲', className: 'sev-high' },
        Medium: { icon: '◆', className: 'sev-medium' },
        Low: { icon: '▽', className: 'sev-low' },
      }
      export const REQUIRED_DEFECT_FIELDS = [
        { key: 'title', label: 'Title', message: 'Enter a title for the defect.' },
        { key: 'description', label: 'Description', message: 'Describe the defect.' },
        { key: 'severity', label: 'Severity', message: 'Choose a severity.' },
        { key: 'stepsToReproduce', label: 'Steps to reproduce', message: 'Describe the steps to reproduce the defect.' },
      ] as const
      ```
    files:
      - apps/web/src/lib/types.ts
      - apps/web/src/lib/defectFields.ts
    rationale: |
      Follows the existing `lib/fields.ts` + `lib/types.ts` split used by the employees domain
      (constants/labels separate from the shared type definitions).

  - description: |
      Add `ReportDefectPage`, building Screen 2 ("Report a Defect") of the approved prototype:
      card "Defect details" with Title/Description/Severity/Steps to reproduce (each marked
      required with `required-mark`, each with its own `field-error`), a second "Additional
      details" card section with Expected result / Actual result (in a `grid-2`) and
      Environment/build version, all optional. Severity is a `.select` populated only from
      `DEFECT_SEVERITIES` (AC4). On submit: if the signed-in user's role isn't `reporter`, show a
      `Banner kind="danger"` ("You don't have permission to do that" / "Reporting a defect
      requires the Reporter role.") and stop — no request is sent (AC6). Otherwise, trim and
      check the four required fields client-side; any left blank get a `field-error` under that
      input plus a summary `Banner kind="danger"` naming the missing field(s), and nothing is
      posted (AC2). Otherwise `apiClient.post<Defect>('/defects', body)`, omitting optional keys
      left blank (same pattern as `NewEmployeeProfilePage`) (AC3), and on success render a
      read-only summary card with Defect ID (mono), a `chip-neutral` Status showing `New` (AC5),
      the severity tag, description, steps, and the three optional fields rendered via `Not set`
      when null (`readonly-value muted`), plus "View in Defects list" / "+ Report another defect"
      actions styled `btn-primary`/`btn-secondary` per the prototype.
    files:
      - apps/web/src/routes/ReportDefectPage.tsx
      - apps/web/src/routes/ReportDefectPage.test.tsx
    rationale: |
      Directly implements Screen 2 of `.arc/designs/UAT-14OCT-STORY-033-design.html`
      (`renderNewDefectScreen`/`onSubmitNewDefect`/`successStateHtml`), reusing the existing
      `Banner`, `Layout` and `Toast` components from the catalogue rather than introducing new
      ones — no new reusable component is warranted for the one-off severity tag markup.

  - description: |
      Wire the route and the sidebar entry point. `App.tsx` adds
      `<Route path="/defects/new" element={<ReportDefectPage />} />` — unlike
      `/employees/new`'s `RequireHrAdmin` wrapper, this route is NOT wrapped in a full-page
      access-restriction gate, because the approved design (Screen 2) deliberately renders the
      form for a non-Reporter and refuses only on submit; see assumptions for this explicit
      deviation from the employees-domain pattern. `Layout.tsx` adds a second sidebar section:
      ```tsx
      <div className="sidebar-section-label" style={{ marginTop: 'var(--space-3)' }}>QA Tracker</div>
      <NavLink to="/defects/new" className={linkClass}>Defects</NavLink>
      ```
    files:
      - apps/web/src/App.tsx
      - apps/web/src/components/Layout.tsx
    rationale: |
      `Layout` is the one persistent sidebar shell for the whole SPA per the UI guidelines, so the
      new "Defects" entry point is added there rather than building a second shell.

  - description: |
      Add the defect-specific page-level CSS classes the prototype introduces that don't exist in
      `index.css` yet: `.chip-neutral`, `.severity-tag` + `.sev-critical`/`.sev-high`/`.sev-medium`/
      `.sev-low`, `.field-hint`, and `white-space: pre-line` on `.readonly-value` (description and
      steps to reproduce are multi-line). Copied from the prototype's page-level style block.
    files:
      - apps/web/src/index.css
    rationale: |
      `.chip`, `.card`, `.field`, `.input`/`.select`/`.textarea` and `.banner-*` already exist in
      `design-system/prototype-utils.css`; only the handful of classes specific to this screen
      (status-neutral chip, severity tags, multi-line readonly values) are new.

tests:
  - |
    AC1 (services/api/test/defects.e2e-spec.ts): a Reporter who submits all four required fields
    gets a 201 with the new record.
    ```ts
    const res = await http().post('/defects').set('Authorization', reporter).send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: validBody.title, severity: 'Critical', status: 'New' });
    ```
  - |
    AC2 (services/api/test/defects.e2e-spec.ts): leaving any one of the four required fields empty
    is refused naming that field, and nothing is saved.
    ```ts
    it.each([
      ['title', 'Enter a title for the defect.'],
      ['description', 'Describe the defect.'],
      ['severity', 'Choose a severity.'],
      ['stepsToReproduce', 'Describe the steps to reproduce the defect.'],
    ])('AC2: refuses when %s is missing', async (field, message) => {
      const body: any = { ...validBody }; delete body[field];
      const res = await http().post('/defects').set('Authorization', reporter).send(body);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain(message);
    });
    ```
  - |
    AC3 (services/api/test/defects.e2e-spec.ts): expected result, actual result and environment
    can all be left out and the defect still saves, with those fields coming back `null`.
    ```ts
    const res = await http().post('/defects').set('Authorization', reporter).send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ expectedResult: null, actualResult: null, environment: null });
    ```
  - |
    AC4 (apps/web/src/routes/ReportDefectPage.test.tsx): the severity select offers exactly
    Critical, High, Medium and Low, in that order.
    ```ts
    renderAt(<ReportDefectPage />, '/defects/new', '/defects/new');
    const options = screen.getAllByRole('option', { name: /Critical|High|Medium|Low/ }).map((o) => o.textContent);
    expect(options).toEqual(['Critical', 'High', 'Medium', 'Low']);
    ```
    Backed server-side by `test/defects.e2e-spec.ts` rejecting an out-of-list value:
    ```ts
    const res = await http().post('/defects').set('Authorization', reporter).send({ ...validBody, severity: 'Blocker' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Choose a severity.');
    ```
  - |
    AC5 (services/api/test/defects.e2e-spec.ts and apps/web/src/routes/ReportDefectPage.test.tsx):
    a just-created defect's status is `New`.
    ```ts
    expect(res.body.status).toBe('New');
    ```
    ```ts
    fireEvent.click(screen.getByRole('button', { name: /submit defect report/i }));
    expect(await screen.findByText('New')).toBeInTheDocument()
    ```
  - |
    AC6 (services/api/test/defects.e2e-spec.ts and apps/web/src/routes/ReportDefectPage.test.tsx):
    a signed-in user without the Reporter role is refused with an authorization error, and an
    unauthenticated caller gets 401.
    ```ts
    const res = await http().post('/defects').set('Authorization', nonReporter).send(validBody);
    expect(res.status).toBe(403);
    await http().post('/defects').send(validBody).expect(401);
    ```
    ```ts
    signIn('employee')
    renderAt(<ReportDefectPage />, '/defects/new', '/defects/new')
    fireEvent.click(screen.getByRole('button', { name: /submit defect report/i }))
    expect(await screen.findByText(/reporter role/i)).toBeInTheDocument()
    expect(api.mock.calls).toHaveLength(0)
    ```

assumptions_or_open_questions:
  - |
    The prototype's Screen 1 ("Defects" list/triage table with search, loading/empty/error states)
    is read as shared navigational context, not part of this story: the epic explicitly splits
    "creation" from "detail view/edit", and the story scope line says this covers "submitting a
    new defect record and its initial fields only." This plan does not build a defects list or
    detail page. The sidebar's new "Defects" link therefore points directly at `/defects/new`
    (there is nowhere else for it to go yet) — a future list/detail story should repoint it.
  - |
    AC5 ("the defect's record is viewed") is satisfied by the read-only success panel shown
    immediately after creation on the same page (mirroring the prototype's `successStateHtml`),
    not a separate GET-backed detail route, since no detail-view route exists yet.
  - |
    The prototype's role-switcher dropdown ("Signed in as: Jordan Blake (Reporter) / Sam Ortiz (QA
    Engineer, no Reporter role)") is explicitly a design-review-only affordance per the file's own
    comments, not part of the production UI. Production role comes from the signed-in user's
    decoded Cognito token via the existing `useAuth()`/`readSession()` pattern (no in-app role
    switcher is built). Tests simulate "a signed-in user without the Reporter role" using the
    already-existing `'employee'` role rather than inventing a `qa_engineer`/`viewer` role, since
    no AC requires a specific non-Reporter role.
  - |
    The prototype's friendly `DEF-241`-style identifier is fixture-only cosmetic numbering with no
    backing AC; this plan returns the database UUID as the defect's id, same as every other
    entity id in this API. A human-readable number (like employees' `EMP-xxx`) can be added later
    if a story requires it.
  - |
    The prototype's success panel shows a "Reported by" row with the reporter's display name, but
    the current auth/session model only carries `role`/`employeeId`/`tenantId` — no display name.
    This plan omits that row rather than guessing at a name source; a future story could add it
    once a name is available (e.g. by joining the reporter's employee record).
  - |
    AC2's "a message naming the missing required field" is implemented as the prototype's
    field-specific copy (e.g. "Enter a title for the defect.") rather than a literal field-name
    string, since that copy is the approved design's wording and still unambiguously identifies
    which field is missing.
  - |
    Unlike `/employees/new`'s `RequireHrAdmin` (which blocks the entire page for the wrong role),
    `/defects/new` renders the form for a non-Reporter and only refuses on submit, per the
    prototype's explicit design (a warning banner, not a blocked page). This is a deliberate
    departure from the existing employees-domain gating convention, called out here so it isn't
    flagged as an inconsistency.

estimated_points: 5

package_dependencies: []

notes: |
  No new third-party packages are needed: `class-validator`, `typeorm`, `@nestjs/*`, `vitest`,
  `supertest`, `react-router-dom` and Tailwind are already in use by the equivalent employees
  flows this plan mirrors.

  ```mermaid
  flowchart TD
    AppModule[app.module.ts] --> DefectsModule[defects.module.ts]
    DefectsModule --> DefectsController[defects.controller.ts]
    DefectsController --> DefectsService[defects.service.ts]
    DefectsController --> CognitoAuthGuard[cognito-auth.guard.ts]
    DefectsController --> RolesGuard[roles.guard.ts]
    DefectsService --> DefectEntity[defect.entity.ts]
    CognitoAuthGuard --> RoleType["employee-fields.ts Role"]
    RolesGuard --> RoleType
    WebApp[App.tsx] --> ReportDefectPage[ReportDefectPage.tsx]
    ReportDefectPage --> Layout[Layout.tsx]
    ReportDefectPage --> ApiClient[apiClient.ts]
    ReportDefectPage --> AuthLib["lib/auth.ts"]
    ApiClient -->|"POST /defects"| DefectsController

    classDef touched fill:#f96,color:#000
    class AppModule,DefectsModule,DefectsController,DefectsService,DefectEntity,CognitoAuthGuard,RolesGuard,RoleType,WebApp,ReportDefectPage,Layout,ApiClient,AuthLib touched
  ```

review_focus: |
  In scope: the `POST /defects` endpoint (validation, RBAC, persistence) and the "Report a
  defect" web form + its success view only. Out of scope (do not flag as missing): a defects
  list/detail page, editing, and any status transition beyond the initial `New` — these are
  separate stories per the epic. Riskiest area: the `Role` widening touches the one shared
  RBAC mechanism used by the unrelated employees domain (`CognitoAuthGuard`, `RolesGuard`,
  `AuthUser`) — verify existing employees RBAC tests still pass unchanged, since only the
  *set* of valid roles grows, not any existing check. Also worth a close look: the deliberate
  choice to let a non-Reporter view and fill in the defect form (refusing only on submit)
  rather than blocking the whole page like `/employees/new` does — this is intentional, taken
  directly from the approved prototype, not an inconsistency to fix.

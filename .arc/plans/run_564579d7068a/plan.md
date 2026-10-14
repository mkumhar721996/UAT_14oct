summary: |
  This item builds the defect detail view and its role/status-gated edit flow. The codebase
  today has no defect domain at all (only the unrelated Employee Profile feature from
  UAT-14OCT-STORY-012), so this plan creates the minimal `defects` table/entity/API needed to
  view and edit an existing record (GET and PATCH only — defect creation and status-transition
  endpoints stay out of scope, owned by other stories in the epic) and broadens the API's role
  model with a new `admin` role so "Admin" vs. "Reporter" (ownership-based: `defect.reporterId
  === user.sub`, not a role) can be enforced. On the frontend it adds a Defect detail page and an
  edit page whose rendering and allowed fields branch on Reporter/Admin/neither and on whether the
  defect has entered Triaged, matching the approved prototype at
  `.arc/designs/UAT-14OCT-STORY-034-design.html`.
scope:
  - description: |
      Broaden the API's role model to add `admin` as a recognised role, and move the shared
      `Role` type out of the employees-only `employee-fields.ts` into a new `auth/role.ts` so a
      second domain (defects) can depend on it without importing from `employees`. Today
      `CognitoAuthGuard` hard-rejects any claim other than `'hr_admin' | 'employee'`:
      `if (typeof sub !== 'string' || typeof tenantId !== 'string' || (role !== 'hr_admin' &&
      role !== 'employee'))` — this must accept `'admin'` too, or every defects request with an
      admin token gets a 401 before it ever reaches a controller.
    files:
      - services/api/src/auth/role.ts
      - services/api/src/auth/auth-user.ts
      - services/api/src/auth/roles.decorator.ts
      - services/api/src/auth/roles.guard.ts
      - services/api/src/auth/cognito-auth.guard.ts
      - services/api/src/employees/employee-fields.ts
    rationale: |
      `employee-fields.ts` only ever exported `Role` for the three `auth/*.ts` files to import
      (confirmed by grep — no employees file imports `Role`), so moving it to `auth/role.ts` and
      re-exporting nothing from `employee-fields.ts` is a pure relocation, not a behavior change
      for the employees domain. "Reporter" is deliberately NOT added as a role value: the ACs
      describe it as "the defect's Reporter", i.e. an ownership relationship on a specific
      defect, not a claim issued at sign-in — any existing authenticated user can be a Reporter
      on defects they created.
  - description: |
      Create the `defects` table (migration) and the `Defect` TypeORM entity with every field the
      detail view must show (AC1) plus a `triaged_at` timestamp this story reads (not writes) to
      gate Reporter edits:
      ```ts
      @Entity('defects')
      export class Defect {
        @PrimaryGeneratedColumn('uuid') id!: string;
        @Column({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
        @Column({ name: 'defect_number', type: 'text' }) defectNumber!: string;
        @Column({ type: 'text' }) title!: string;
        @Column({ type: 'text' }) description!: string;
        @Column({ name: 'repro_steps', type: 'text' }) reproSteps!: string;
        @Column({ type: 'text' }) severity!: string;
        @Column({ type: 'text', nullable: true }) priority!: string | null;
        @Column({ type: 'text' }) type!: string;
        @Column({ type: 'text' }) status!: string;
        @Column({ name: 'triaged_at', type: 'timestamptz', nullable: true }) triagedAt!: Date | null;
        @Column({ name: 'reporter_id', type: 'text' }) reporterId!: string;
        @Column({ name: 'reporter_name', type: 'text', nullable: true }) reporterName!: string | null;
        @Column({ name: 'assignee_id', type: 'text', nullable: true }) assigneeId!: string | null;
        @Column({ name: 'assignee_name', type: 'text', nullable: true }) assigneeName!: string | null;
        @Column({ type: 'text', nullable: true }) environment!: string | null;
        @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
        @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
      }
      ```
      The migration mirrors `1700000000000-create-employees-schema.ts`'s shape: a
      `defect_number_seq` sequence (`DEF-1042` style ids, same pattern as `EMP-1001`), the table
      above in snake_case, and `down()` dropping both.
    files:
      - services/api/src/defects/entities/defect.entity.ts
      - services/api/src/database/migrations/1700000000002-create-defects-schema.ts
      - services/api/src/database/data-source.ts
    rationale: |
      No defect schema exists anywhere in the repo (confirmed: no `*defect*` files, no `projects`
      domain). `triagedAt` (not a parsed `status` enum) is the field this story's authorization
      logic reads, because whether a defect has "entered Triaged" must stay true for every status
      after Triaged (In Progress, Resolved, Closed, Reopened) without this story having to encode
      the full lifecycle the status-workflow story owns.
  - description: |
      Add the read/update API: a validated `UpdateDefectDto` (only the three fields anyone may
      ever PATCH through this endpoint — `status` is never a DTO property, so the app's global
      `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` 400s any attempt to send
      it, which is how AC8's "no status control" holds on the backend too), a `DefectsService`
      with the per-record authorization, and a thin controller:
      ```ts
      export class UpdateDefectDto {
        @IsOptional() @IsString() @IsNotEmpty() description?: string;
        @IsOptional() @IsString() @IsNotEmpty() reproSteps?: string;
        @IsOptional() @IsIn(['Critical', 'High', 'Medium', 'Low']) severity?: string;
      }

      async updateDefect(tenantId: string, id: string, user: AuthUser, dto: UpdateDefectDto): Promise<Defect> {
        const defect = await this.getDefect(tenantId, id);
        const isAdmin = user.role === 'admin';
        const isReporter = defect.reporterId === user.sub;
        if (!isAdmin && !isReporter) throw new ForbiddenException('Only the Reporter or an Admin can edit this defect');
        const allowed = new Set<'description' | 'reproSteps' | 'severity'>();
        if (isAdmin) { allowed.add('description'); allowed.add('reproSteps'); allowed.add('severity'); }
        if (isReporter && defect.triagedAt === null) { allowed.add('description'); allowed.add('reproSteps'); }
        for (const key of ['description', 'reproSteps', 'severity'] as const) {
          if (dto[key] !== undefined && !allowed.has(key)) throw new ForbiddenException(`Cannot change ${key} on this defect`);
        }
        if (dto.description !== undefined) defect.description = dto.description;
        if (dto.reproSteps !== undefined) defect.reproSteps = dto.reproSteps;
        if (dto.severity !== undefined) defect.severity = dto.severity;
        return this.dataSource.getRepository(Defect).save(defect);
      }
      ```
      `priority` is never read or written by this method under any input, which is what makes
      AC7 hold by construction rather than by a special-cased check.
    files:
      - services/api/src/defects/dto/update-defect.dto.ts
      - services/api/src/defects/defects.service.ts
      - services/api/src/defects/defects.controller.ts
      - services/api/src/defects/defects.module.ts
      - services/api/src/app.module.ts
    rationale: |
      Mirrors `EmployeesController`'s `canSeePrivate`/`requireSelf` pattern of per-record checks
      done in the controller/service rather than a blanket `@Roles()` guard, because
      authorization here depends on defect ownership and `triagedAt`, not role alone. `GET` has no
      `@Roles()` restriction: per the story's own scope note, which users can see which project's
      defects is owned by Project & Workspace Organization, so this plan only enforces
      tenant-scoping (same as `EmployeesService.loadEmployee`), not finer-grained visibility.
  - description: |
      Backend tests: a `defects.service.spec.ts` unit suite (FakeDataSource, one `it` per AC,
      mirroring `employees.service.spec.ts`'s style) and a `defects.e2e-spec.ts` supertest suite
      (mirroring `employees.e2e-spec.ts`'s `tokenFor`/`createTestApp` pattern) seeding defect rows
      directly via the repository in `beforeAll` (there is no `POST /defects` in scope to create
      them through).
    files:
      - services/api/src/defects/defects.service.spec.ts
      - services/api/test/defects.e2e-spec.ts
    rationale: |
      Matches the project's existing split: service-level unit tests for the authorization
      matrix, plus an e2e suite proving the real HTTP/guard/pipe stack enforces the same rules
      (especially AC8's DTO-level block on `status`, which only exists at the app/pipe layer).
  - description: |
      Frontend session/shared-type plumbing: broaden `Session`/`Role` in `lib/auth.ts` to include
      `admin` and expose the token's `sub` (needed to compute `isReporter` client-side), add a
      `Defect` type to `lib/types.ts`, and extend the `signIn` test helper to set `sub` and accept
      `'admin'`:
      ```ts
      export type Role = 'hr_admin' | 'employee' | 'admin'
      export interface Session { sub: string; role: Role; employeeId: string | null; tenantId: string }
      ```
      ```ts
      export function signIn(role: Role, employeeId?: string, sub = `${role}-1`) {
        const payload = btoa(JSON.stringify({ sub, role, tenant_id: 'tenant-1', employee_id: employeeId }))
        localStorage.setItem(TOKEN_KEY, `header.${payload}.signature`)
      }
      ```
    files:
      - apps/web/src/lib/auth.ts
      - apps/web/src/lib/types.ts
      - apps/web/src/test/helpers.tsx
    rationale: |
      `readSession()` currently rejects any `role` other than `'hr_admin'`/`'employee'`
      (`if (payload.role !== 'hr_admin' && payload.role !== 'employee') return null`) and never
      reads `sub`, so an admin's own session would be silently treated as signed-out and no page
      could tell "am I this defect's Reporter" without it. The `sub`/`employeeId` default keeps
      all 3 existing `signIn(...)` call sites in `App.test.tsx` and the employee test files
      working unchanged.
  - description: |
      `DefectDetailPage` (route `/defects/:id`): shows every field, current status (as a chip)
      and assignee for any signed-in user (AC1), per the "Defect Detail — View" screen in the
      design — header with id/title/status chip/assignee, a two-column `.detail-grid` (description
      + reproduction details on the left in `.readable-block`s, a `.card` of remaining fields
      — severity, priority, type, assignee, reporter, environment, created/updated — on the
      right), and an "Edit defect" primary action in the topbar. Reuses `Layout` (topbar/crumbs/
      content chrome), `Banner` (load error state, same pattern as `EmployeeProfileDetailPage`),
      and the shared `.card`/`.chip`/`.table`-family classes; no new reusable component needed.
    files:
      - apps/web/src/routes/DefectDetailPage.tsx
      - apps/web/src/routes/DefectDetailPage.test.tsx
    rationale: |
      Follows `EmployeeProfileDetailPage.tsx`'s exact shape (`useParams` + `useAsync` +
      `apiClient.get` + `Layout`/`Banner`), the only existing detail-view page in the codebase.
  - description: |
      `EditDefectPage` (route `/defects/:id/edit`) branches into the three states the design
      shows, computed from the loaded defect plus the decoded session (`isAdmin = session.role
      === 'admin'`, `isReporter = session.sub === defect.reporterId`):
      - Neither reporter nor admin: renders the "Edit refused — Unauthorized" empty-state copy
        from the design (AC6) — no PATCH is ever attempted.
      - Reporter, `defect.triagedAt === null`: editable `description`/`reproSteps` `.textarea`s,
        "Save changes" + "Cancel", a read-only `.card` for status/severity/priority/type/assignee
        (AC2), matching "Edit Defect — Reporter (Pre-Triage)".
      - Reporter, `defect.triagedAt !== null`: the same two fields rendered as disabled
        `.textarea`s with the design's lock-note banner and no save control (AC3), matching
        "Edit Defect — Reporter (Triaged)".
      - Admin: `description`/`reproSteps` `.textarea`s and a `severity` `.select` are always
        editable (AC4, and AC5 since Triaged is the status where Reporter access ends and Admin's
        is the only path left); status and priority render as plain read-only text with no form
        control at all — satisfying AC8 by construction, not by disabling a control. On save, if
        severity changed and the defect already has a non-null `priority`, the success message
        states "Priority remains ... — it isn't recalculated automatically" (AC7), matching the
        design's copy.
    files:
      - apps/web/src/routes/EditDefectPage.tsx
      - apps/web/src/routes/EditDefectPage.test.tsx
    rationale: |
      Mirrors `EditEmployeeProfilePage.tsx`'s local-`EditForm`-function structure, one file per
      route with role-branching subcomponents defined locally (no new entry needed in the shared
      component catalogue — `CoreFieldInput` is tightly coupled to the four employee core fields
      and isn't generically reusable here).
  - description: |
      Register the two new routes in `App.tsx` (no `RequireHrAdmin`-style router-level role gate,
      since authorization here depends on per-defect ownership, not a static role — the gating
      happens inside `EditDefectPage` itself), and add the page-specific CSS classes the design
      introduces that aren't yet in the shared `design-system/prototype-utils.css` (`.chip`,
      `.card`, `.textarea` already exist there and are reused as-is): `.chip-neutral`,
      `.detail-grid`, `.detail-header`, `.detail-id`, `.detail-title`, `.detail-status-row`,
      `.block-title`, `.readable-block`, `.field-readonly`(+`-label`/`-value`), `.lock-note`,
      `.input-locked`, appended to `index.css` under its existing "Page-level additions from the
      approved prototype, composed only from design-system tokens" comment, composed only from
      existing tokens exactly as the design's own inline stylesheet comments state.
    files:
      - apps/web/src/App.tsx
      - apps/web/src/index.css
    rationale: |
      Keeps the new page-specific classes in the same place (`index.css`) and under the same
      token-only constraint as the existing `.readonly-row`/`.active-grid`/etc. additions from the
      Employee Profile story, rather than inventing a second pattern for where prototype CSS goes.
tests:
  - |
    AC1 (frontend, DefectDetailPage.test.tsx): any signed-in user sees every field, status and
    assignee.
      mockApi({ 'GET /defects/d1': defect })
      renderAt(<DefectDetailPage />, '/defects/d1', '/defects/:id')
      expect(await screen.findByText(defect.title)).toBeInTheDocument()
      expect(screen.getByText(defect.status)).toBeInTheDocument()
      expect(screen.getByText(defect.assigneeName)).toBeInTheDocument()
      expect(screen.getByText(defect.severity)).toBeInTheDocument()
  - |
    AC2 (backend e2e, defects.e2e-spec.ts): the Reporter can change description/reproSteps before
    Triaged, and the new values are saved.
      const res = await http().patch(`/defects/${newDefect.id}`).set('Authorization', reporter)
        .send({ description: 'New description', reproSteps: 'New steps' })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ description: 'New description', reproSteps: 'New steps' })
  - |
    AC3 (backend e2e): once Triaged, the Reporter's attempt to change description/reproSteps is
    refused and values stay the same.
      const res = await http().patch(`/defects/${triaged.id}`).set('Authorization', reporter).send({ description: 'Hack' })
      expect(res.status).toBe(403)
      const after = await http().get(`/defects/${triaged.id}`).set('Authorization', reporter)
      expect(after.body.description).toBe(triaged.description)
  - |
    AC4 (backend e2e): an Admin can change severity at any status, including pre-Triage.
      const res = await http().patch(`/defects/${newDefect.id}`).set('Authorization', admin).send({ severity: 'Critical' })
      expect(res.status).toBe(200)
      expect(res.body.severity).toBe('Critical')
  - |
    AC5 (backend e2e): an Admin can change description once the defect has entered Triaged.
      const res = await http().patch(`/defects/${triaged.id}`).set('Authorization', admin).send({ description: 'Refined description' })
      expect(res.status).toBe(200)
      expect(res.body.description).toBe('Refined description')
  - |
    AC6 (backend e2e + frontend): a user who is neither Reporter nor Admin is refused with a 403
    for any field, and the Edit page shows the unauthorized empty-state without attempting a PATCH.
      const res = await http().patch(`/defects/${triaged.id}`).set('Authorization', other).send({ description: 'Hack' })
      expect(res.status).toBe(403)
      ---
      signIn('employee', undefined, 'other-1')
      const api = mockApi({ 'GET /defects/d1': triaged })
      renderAt(<EditDefectPage />, '/defects/d1/edit', '/defects/:id/edit')
      expect(await screen.findByText(/you don't have permission to edit this defect/i)).toBeInTheDocument()
      expect(api.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false)
  - |
    AC7 (backend e2e): changing severity on a Triaged defect that already has a priority leaves
    priority unchanged.
      const res = await http().patch(`/defects/${triagedWithPriority.id}`).set('Authorization', admin).send({ severity: 'Low' })
      expect(res.body.priority).toBe(triagedWithPriority.priority)
  - |
    AC8 (backend e2e + frontend): no status control is ever offered, and status can't be changed
    through this endpoint even if a client tries.
      const res = await http().patch(`/defects/${newDefect.id}`).set('Authorization', admin).send({ status: 'Resolved' })
      expect(res.status).toBe(400)
      ---
      signIn('admin', undefined, 'admin-1')
      mockApi({ 'GET /defects/d2': triaged })
      renderAt(<EditDefectPage />, '/defects/d2/edit', '/defects/:id/edit')
      await screen.findByText(triaged.status)
      expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument()
assumptions_or_open_questions:
  - |
    No prior story has created a defect entity, a "Report defect" endpoint, or the status
    workflow — this plan creates only the minimal `defects` schema/entity needed to view and edit
    an existing record (GET + PATCH), explicitly NOT a `POST /defects` or any status-transition
    endpoint. Tests seed rows directly via the repository rather than through the API.
  - |
    "Admin" is modeled as a new global `role: 'admin'` claim (broadening the existing
    `'hr_admin' | 'employee'` union); "Reporter" is modeled as ownership
    (`defect.reporterId === user.sub`), not a role claim, since the ACs describe it as "the
    defect's Reporter" rather than a role assigned at sign-in.
  - |
    `triagedAt` (nullable timestamp, not a parsed `status` enum) is the field this story's
    authorization reads to decide "has entered Triaged". It is set directly in test fixtures here;
    the actual status-workflow story is expected to set it when a defect transitions into Triaged.
  - |
    Visibility ("which users can see which project's defects") is explicitly out of scope per the
    story description, owned by Project & Workspace Organization. This plan enforces only
    tenant-scoping on GET (same as the existing `EmployeesService` pattern) — any authenticated
    user in the tenant can view/attempt to edit any defect in it for now.
  - |
    Design/AC conflict (flagged per instructions, not silently resolved): the approved prototype's
    "Edit Defect — Admin" screen shows editable `Title` and `Defect type` inputs in addition to
    description/reproSteps/severity, and `saveAdminEdit()` saves all five together. No acceptance
    criterion authorizes editing title or type (by Admin or anyone), so this plan renders those
    two fields read-only on the Admin edit form and limits the editable set to exactly
    description, reproSteps and severity. Recommend confirming with the reviewer whether title/type
    editing should be added as explicit scope (it would need its own AC).
  - |
    Design/AC conflict: AC5 names only "description" as Admin-editable once Triaged. This plan
    extends the same allowance to "reproduction details" too, by symmetry with the Reporter's
    paired description+reproSteps editing (AC2/AC3) and because the design's Admin form saves both
    together as one action. Flagging in case the reviewer intends reproSteps to stay Reporter-only
    pre-Triage with no one able to edit it afterward.
  - |
    Structural conflict (not an AC, flagged for awareness): the approved prototype's sidebar shows
    "Defects · Projects · Settings", but the existing `Layout` component's sidebar is hardcoded to
    the unrelated Employee Profile IA (Employees/Pending changes/My profile) and there is no
    Defects list route in scope to link a new sidebar entry to (the design's own notes say the
    list/filters are out of scope for this story). This plan reuses `Layout` for topbar/crumb/
    content chrome only and does not add or change sidebar navigation; full IA reconciliation
    across the two domains is a separate concern.
  - |
    `reporterName`/`assigneeName` are modeled as plain denormalized text columns (no user
    directory exists to join against), populated by whatever future story creates/assigns
    defects; this story only displays them.
estimated_points: 8
package_dependencies: []
notes: |
  ```mermaid
  flowchart TD
    AppModule[app.module.ts] --> DefectsModule[defects.module.ts]
    DefectsModule --> DefectsController[defects.controller.ts]
    DefectsController --> DefectsService[defects.service.ts]
    DefectsService --> DefectEntity[defect.entity.ts]
    DefectsController --> CognitoGuard[cognito-auth.guard.ts]
    CognitoGuard --> RoleType[auth/role.ts]
    AuthUser[auth-user.ts] --> RoleType

    AppTsx[App.tsx] --> DetailPage[DefectDetailPage.tsx]
    AppTsx --> EditPage[EditDefectPage.tsx]
    DetailPage --> ApiClient[lib/apiClient.ts]
    EditPage --> ApiClient
    DetailPage --> LayoutC[Layout.tsx]
    EditPage --> LayoutC
    DetailPage --> BannerC[Banner.tsx]
    EditPage --> AuthLib[lib/auth.ts]
    ApiClient --> DefectsController

    classDef touched fill:#f96,color:#000
    classDef context fill:#eee,color:#333
    class AppModule,DefectsModule,DefectsController,DefectsService,DefectEntity,CognitoGuard,RoleType,AuthUser,AppTsx,DetailPage,EditPage,AuthLib touched
    class ApiClient,LayoutC,BannerC context
  ```
  This is the first story in the "Defect Lifecycle & Tracking" epic to land any backend code —
  there is no existing defects domain, projects/workspace domain, or non-employee role in the
  codebase to build on, which is why the scope above includes schema creation and an auth-model
  change alongside the detail/edit feature itself.
review_focus: |
  In scope: GET/PATCH on an existing defect only, with authorization keyed on Admin role vs.
  Reporter ownership (`reporterId === sub`) vs. `triagedAt`. Out of scope and deliberately not
  built: defect creation, status transitions, and project/workspace visibility rules. The
  riskiest area is the field-level authorization in `DefectsService.updateDefect` — it must
  reject on first disallowed field present (not silently drop it) so AC3/AC6 hold even when a
  client sends a mix of allowed and disallowed fields in one request. Also deliberate: the Admin
  edit form renders title/type read-only even though the approved prototype shows them as
  editable inputs (see assumptions) — that's a scoping choice to flag during review, not a missed
  spec, and the same applies to extending Admin's Triaged-description allowance (AC5) to cover
  reproSteps too.

summary: |
  Add a Defect Detail view (GET /defects/:id) and an Edit flow (PATCH /defects/:id) on top of the
  existing Defect Creation work (STORY-033). The detail view shows a defect's full record, status
  and assignee to any signed-in user (visibility rules are explicitly out of scope). Editing is
  gated by identity and lifecycle: the defect's own Reporter can change description/reproduction
  details only before the defect enters Triaged; an Admin can change severity at any status and
  gains the description/reproduction-details edit once the defect is Triaged; nobody else can
  edit anything; nobody can touch status or priority from this screen (those remain workflow-only
  fields, out of this story's scope). The plan follows the approved prototype at
  `.arc/designs/UAT-14OCT-STORY-034-design.html` for layout, states and copy, adapted to this
  app's real routing (navigate-after-save instead of the prototype's in-place banner, since this
  app already uses that pattern in `EditEmployeeProfilePage.tsx`).

scope:
  - description: |
      Add `'admin'` to the shared `Role` union so the backend can recognize the Admin identity
      the ACs and design reference. Today `ROLES` only has `'hr_admin' | 'employee' | 'reporter'`
      (`services/api/src/employees/employee-fields.ts:3`) and `CognitoAuthGuard` rejects any token
      whose role isn't in that list (`services/api/src/auth/cognito-auth.guard.ts:23`), so without
      this change no Admin token could ever authenticate.
      Change: `export const ROLES = ['hr_admin', 'employee', 'reporter', 'admin'] as const;`
    files:
      - services/api/src/employees/employee-fields.ts
    rationale: |
      `Role` is the single shared RBAC axis used by `RolesGuard`/`@Roles()`/`CognitoAuthGuard`
      across domains; defects has no separate role system, so this is the minimal, consistent
      place to add the value the ACs call "Admin".
  - description: |
      New migration adding two nullable columns the detail view must display per AC1 and AC7,
      which don't exist on `defects` today: `priority` (text, nullable) and `assignee_name`
      (text, nullable). Nothing in this story sets them (assignment/triage workflows are a
      separate, not-yet-built story) — they stay null until a future story populates them, and
      tests in this plan set them directly via the repository to exercise AC1/AC7.
    files:
      - services/api/src/database/migrations/1700000000003-add-defect-priority-assignee.ts
    rationale: |
      AC1 requires showing "its assignee"; AC7 requires asserting priority is unchanged after a
      severity save. Both need a real column to read/assert against — there's no way to satisfy
      either AC against the current schema.
  - description: |
      Add the two new columns to the TypeORM entity: `priority!: string | null;` and
      `assigneeName!: string | null;` (mapped `@Column({ name: 'assignee_name', type: 'text',
      nullable: true })`).
    files:
      - services/api/src/defects/entities/defect.entity.ts
    rationale: |
      Keeps the entity in sync with the new migration so `DefectsService` can read/return the
      fields.
  - description: |
      New `UpdateDefectDto` with only the three fields any role may ever submit through this
      endpoint — `description`, `stepsToReproduce`, `severity` — all optional (a given request
      only sends what it's changing). There is deliberately no `status`, `priority` or
      `assigneeName` field on this DTO at all.

      ```ts
      export class UpdateDefectDto {
        @IsOptional() @IsString() @IsNotEmpty({ message: 'Describe the defect.' })
        @Matches(/\S/, { message: 'Describe the defect.' })
        description?: string;

        @IsOptional() @IsString() @IsNotEmpty({ message: 'Describe the steps to reproduce the defect.' })
        @Matches(/\S/, { message: 'Describe the steps to reproduce the defect.' })
        stepsToReproduce?: string;

        @IsOptional() @IsIn(DEFECT_SEVERITIES, { message: 'Choose a severity.' })
        severity?: DefectSeverity;
      }
      ```
    files:
      - services/api/src/defects/dto/update-defect.dto.ts
    rationale: |
      Because the app's global `ValidationPipe` is `{ whitelist: true, forbidNonWhitelisted: true }`
      (`services/api/test/support/create-test-app.ts:26`), omitting `status`/`priority` from the
      DTO means the API rejects any request that tries to set them with a 400 — this is what
      makes AC8 ("no status control") and the priority-is-never-written half of AC7 true at the
      API boundary itself, not just in the UI.
  - description: |
      Add `getDefect` and `updateDefect` to `DefectsService`, plus a private `loadDefect` helper
      mirroring `EmployeesService.loadEmployee`'s 404-on-missing pattern
      (`services/api/src/employees/employees.service.ts:92`).

      ```ts
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
      ```

      "Has entered Triaged" is modeled as `status !== 'New'` — see assumptions.
    files:
      - services/api/src/defects/defects.service.ts
    rationale: |
      Centralizes the Reporter/Admin + pre/post-triage matrix from AC2–AC7 in one place the
      controller just delegates to, matching how `EmployeesService.updateAsHrAdmin` keeps its
      business rules out of the controller.
  - description: |
      Add `GET /defects/:id` and `PATCH /defects/:id` to `DefectsController`. Neither carries a
      `@Roles()` decorator — the controller class already applies `RolesGuard`, which passes any
      authenticated role through when no roles are declared on the handler, matching this story's
      explicit exclusion of "who can see which project's defects." `DefectsService` itself (not
      the guard) enforces the Reporter/Admin ownership check for the PATCH.

      ```ts
      @Get(':id')
      getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
        return this.defects.getDefect(user.tenantId, id);
      }

      @Patch(':id')
      update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDefectDto) {
        return this.defects.updateDefect(user.tenantId, id, user, dto);
      }
      ```
    files:
      - services/api/src/defects/defects.controller.ts
    rationale: |
      Same `ParseUUIDPipe` convention as `EmployeesController` for `:id` params; keeps
      authorization logic in the service, not duplicated in the controller.
  - description: |
      Unit tests for the new service methods (authorization/triage matrix) and e2e tests for the
      new endpoints covering all eight ACs end to end (auth, tenant isolation, whitelist
      rejection of `status`/`priority`).
    files:
      - services/api/src/defects/defects.service.spec.ts
      - services/api/test/defects.e2e-spec.ts
    rationale: |
      Mirrors the existing split in this module: `defects.service.spec.ts` for pure business
      logic against `FakeDataSource`, `defects.e2e-spec.ts` for the full HTTP/auth/validation
      stack via supertest.
  - description: |
      Extend the frontend's `Role` union and decoded `Session` to match the backend: add
      `'admin'` to `Role`, and add `sub: string` to `Session` (decoded from the token's `sub`
      claim) since the UI needs the signed-in user's identity to decide "is this the defect's
      Reporter," not just their role.

      ```ts
      export type Role = 'hr_admin' | 'employee' | 'reporter' | 'admin'
      export interface Session {
        sub: string
        role: Role
        employeeId: string | null
        tenantId: string
      }
      ```
      `readSession` gains `payload.role !== 'admin'` to its existing role-allowlist check and
      returns `sub: payload.sub` in the parsed session.
    files:
      - apps/web/src/lib/auth.ts
    rationale: |
      `readSession` currently hard-rejects any role other than `hr_admin`/`employee`/`reporter`
      (`apps/web/src/lib/auth.ts:20`) — an Admin token would silently be treated as signed out
      without this change. `sub` is new because no existing feature needed per-user identity
      client-side; this story is the first that does (Reporter-of-this-defect is an identity
      check, not a role check).
  - description: |
      Extend the `Defect` type with the fields the detail/edit views need that aren't on it yet:
      `priority: string | null`, `assigneeName: string | null`, `reportedBy: string`,
      `updatedAt: string`.
    files:
      - apps/web/src/lib/types.ts
    rationale: |
      `reportedBy` is already returned by the API (`defects.service.ts` sets it on create) but
      missing from the frontend type; the rest are new fields from this story's migration.
  - description: |
      Add a third, optional `sub` parameter to the `signIn` test helper so defect tests can sign
      in as "the reporter of this specific fixture defect" vs. some other user.

      `export function signIn(role: Role, employeeId?: string, sub = 'test-sub') { ... }`,
      embedding `sub` into the encoded token payload alongside the existing `role`/`tenant_id`/
      `employee_id` claims.
    files:
      - apps/web/src/test/helpers.tsx
    rationale: |
      Existing calls (`signIn('employee', 'u2')`, etc.) stay valid since the new parameter is
      optional with a default; only the new defect tests need to pass a specific `sub` to match
      `reportedBy` in their fixtures.
  - description: |
      Extract `SeverityTag` (currently a private function inside `ReportDefectPage.tsx`, prototype
      lines 549-552 / `.severity-tag` + `.sev-*` classes) and a new `StatusChip` (prototype line
      553, `<span class="chip chip-neutral">`) into a shared component, since both the new detail
      page and the new edit page need them alongside the existing report page — three real call
      sites justify pulling this out rather than re-pasting the JSX a third time. Update
      `ReportDefectPage.tsx` to import from here instead of its local definition.
    files:
      - apps/web/src/components/DefectTags.tsx
      - apps/web/src/routes/ReportDefectPage.tsx
    rationale: |
      Avoids a third copy of identical severity/status-chip markup; no new visual component is
      introduced beyond what `ReportDefectPage` already renders today, so this doesn't conflict
      with the "reuse existing components" catalogue (none of the four cataloged components
      render a severity/status tag).
  - description: |
      Add the small set of CSS classes the prototype introduces that don't exist in production
      `index.css` yet, as pure additions (no edits to the shared `.readonly-row` / `.readonly-
      label` / `.readonly-value` rules that `EmployeeProfileDetailPage` and `EditEmployeeProfile
      Page` already depend on — see the deviation noted below):
      - `.readonly-hint` (prototype line 347): small muted helper text under a readonly value,
        used for "Set by the triage workflow" / "Status changes aren't made here" hints.
      - `.field-lock` (prototype line 352): small font-size for a locked field's label.
      - `.readonly-value.text-left` (prototype line 346): left-aligns and wraps long readonly
        text (description/steps/expected/actual/environment) instead of the shared default's
        right-aligned single line.
      - `.readonly-row.align-top` (new, additive, not in the prototype's class name but same
        effect as the prototype's row-level `align-items: flex-start` — see deviation note):
        opt-in vertical alignment for rows holding the long, wrapped `.text-left` values above.
    files:
      - apps/web/src/index.css
    rationale: |
      The prototype's embedded stylesheet is self-contained and restyles `.readonly-row`/
      `.readonly-label` globally (`align-items: flex-start`, a fixed 180px label width, a bigger
      row gap) — but those classes are already shared production CSS used by the Employee Profile
      pages. Applying the prototype's version verbatim would change those pages' layout as a
      side effect of this story. Instead this plan adds the net-new, purely additive classes
      above and opts individual long-text rows into top-alignment via a new modifier class,
      preserving today's Employee Profile layout exactly while matching the prototype's visual
      treatment for defects' long text fields.
  - description: |
      New `DefectDetailPage` route component implementing prototype Screen 1 ("Defect Detail"):
      loading skeleton → populated record → error-with-retry, per prototype lines 643-667. Uses
      `useAsync` (loading/error/retry, matching `EmployeeProfileDetailPage`'s pattern) to call
      `apiClient.get<Defect>('/defects/:id')`, and renders every field from prototype lines
      619-640 in a `.card`: Defect ID (mono), Status (`StatusChip`), Severity (`SeverityTag`),
      Priority (muted "Not set" + `.readonly-hint` "Set by the triage workflow" when null),
      Assignee (muted "Not assigned" when null), Reporter, Created, Last updated
      (`fmtDateTime`), Description, Steps to reproduce, Expected result, Actual result,
      Environment (the last five using `.readonly-value.text-left` + `.readonly-row.align-top`).
      The "Edit defect" primary action (prototype line 436) is always shown via `Layout`'s
      `actions` prop as a `Link` to `/defects/:id/edit`; per prototype lines 669-672, if the
      signed-in user is neither the defect's Reporter nor an Admin, clicking it also fires
      `toast("Edit refused — you don't have permission to change this defect.", true)` before
      navigating (the real authorization refusal happens server-side on save; this is the same
      UX as the prototype, not a security boundary).
    files:
      - apps/web/src/routes/DefectDetailPage.tsx
    rationale: |
      AC1. Mirrors `EmployeeProfileDetailPage.tsx`'s loading/error/card structure, which already
      follows this product's UI guidelines (data-dense single-column `.card`, `.readonly-row`
      rows, desktop-first).
  - description: |
      New `DefectEditPage` route component implementing prototype Screen 2 ("Edit Defect"),
      branching on identity/status exactly as prototype `renderEdit()` does (lines 681-799):
      1. Neither Reporter nor Admin (AC6): danger `Banner` "You don't have permission to do
         that", description/steps shown as disabled `textarea`s, a "Back to defect" secondary
         button only — no save path exists (prototype lines 687-706).
      2. Reporter, defect not yet Triaged (AC2): editable `description`/`stepsToReproduce`
         fields (required, same inline-error pattern as `ReportDefectPage`), Status/Severity/
         Priority shown read-only, Save/Cancel (prototype lines 732-761). On submit, PATCH only
         `{ description, stepsToReproduce }`.
      3. Reporter, defect Triaged (AC3): warning `Banner` "Locked after triage", both fields
         disabled with a 🔒 + `.field-lock` label and `.readonly-hint`-style helper text, no Save
         button — only "Back to defect" (prototype lines 709-730).
      4. Admin (AC4/AC5/AC7/AC8): `severity` `<select>` always editable; `description`/
         `stepsToReproduce` editable only when `status !== 'New'` (else disabled with a lock icon
         and the hint "Becomes editable for Admins once this defect is triaged."); Status shown
         read-only with the hint "Status changes aren't made here — use the defect's workflow
         actions." (AC8: no status control is ever rendered, for any role); Priority shown
         read-only with the hint "stays unchanged when you update severity" (AC7); Assignee
         read-only (prototype lines 763-799). On submit, PATCHes `{ severity }`, plus
         `{ description, stepsToReproduce }` only when triaged-and-editable.
      On a successful save in any editable branch: `toast('DEF-… updated.')` then
      `navigate('/defects/:id')` — adapted from the prototype's in-place success banner to this
      app's established pattern (`EditEmployeeProfilePage.tsx` does the same: toast + navigate to
      the detail route) since the prototype's "stay on screen" behavior was a standalone-HTML-demo
      convenience, not a routing pattern this app uses elsewhere.
    files:
      - apps/web/src/routes/DefectEditPage.tsx
    rationale: |
      Implements AC2, AC3, AC4, AC5, AC6, AC7, AC8 on the client side, with the server as the
      actual authorization boundary (service logic in `defects.service.ts` above).
  - description: |
      Register the two new routes in the router, alongside the existing `/defects/new`.
      ```tsx
      <Route path="/defects/:id" element={<DefectDetailPage />} />
      <Route path="/defects/:id/edit" element={<DefectEditPage />} />
      ```
    files:
      - apps/web/src/App.tsx
    rationale: |
      React Router v6 ranks the static `/defects/new` segment above the dynamic `/defects/:id`
      regardless of declaration order, so this doesn't disturb the existing route.
  - description: |
      Component tests for both new pages covering all eight ACs against a mocked `apiClient`
      (`mockApi` from `test/helpers.tsx`), following the `ReportDefectPage.test.tsx` pattern.
    files:
      - apps/web/src/routes/DefectDetailPage.test.tsx
      - apps/web/src/routes/DefectEditPage.test.tsx
    rationale: |
      Matches this repo's existing test-per-route convention; exercises the branching in
      `DefectEditPage` the way `ReportDefectPage.test.tsx` exercises its own role gate.

tests:
  - |
    AC1 (backend, `defects.e2e-spec.ts`): a signed-in `employee` (no ownership/role relationship
    to the defect) calls `GET /defects/:id` for a seeded defect and gets back every field,
    status and assignee:
    `expect(res.body).toMatchObject({ id, title, status: 'New', severity: 'Critical', priority: null, assigneeName: null, reportedBy: 'rep-1', description, stepsToReproduce })`.
    AC1 (frontend, `DefectDetailPage.test.tsx`): with a mocked `GET /defects/:id` response,
    `render()` then
    `expect(screen.getByText('New')).toBeInTheDocument()` (status chip) and
    `expect(screen.getByText('Not assigned')).toBeInTheDocument()` (assignee).
  - |
    AC2 (backend, `defects.service.spec.ts`): reporter editing their own `status: 'New'` defect:
    `const updated = await service().updateDefect('tenant', defect.id, { sub: 'rep-1', role: 'reporter', tenantId: 'tenant', employeeId: null }, { description: 'New desc', stepsToReproduce: 'New steps' })`
    then `expect(updated).toMatchObject({ description: 'New desc', stepsToReproduce: 'New steps' })`.
    AC2 (frontend, `DefectEditPage.test.tsx`): signed in as the reporter (`sub` matching
    `reportedBy`) on a `status: 'New'` defect, fill and submit the form, then
    `expect(JSON.parse(patches()[0][1]!.body as string)).toEqual({ description: 'New desc', stepsToReproduce: 'New steps' })`.
  - |
    AC3 (backend, `defects.service.spec.ts`): same reporter, same defect but `status: 'Triaged'`:
    `await expect(service().updateDefect('tenant', defect.id, reporterUser, { description: 'x' })).rejects.toBeInstanceOf(ForbiddenException)`,
    and a follow-up `getDefect` call shows the original description unchanged.
    AC3 (frontend, `DefectEditPage.test.tsx`): reporter + `status: 'Triaged'` renders disabled
    textareas and no Save button:
    `expect(screen.getByLabelText(/description/i)).toBeDisabled()` and
    `expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()`.
  - |
    AC4 (backend, `defects.e2e-spec.ts`): an `admin` PATCHes `{ severity: 'High' }` on defects at
    both `status: 'New'` and `status: 'Triaged'`; both return 200 with `severity: 'High'`.
    AC4 (frontend, `DefectEditPage.test.tsx`): admin form always renders an enabled severity
    `<select>`: `expect(screen.getByLabelText(/severity/i)).toBeEnabled()` regardless of status.
  - |
    AC5 (backend, `defects.e2e-spec.ts`): an `admin` PATCHes `{ description: 'Updated' }` on a
    `status: 'Triaged'` defect → 200, `GET` afterwards shows `description: 'Updated'`.
    AC5 (frontend, `DefectEditPage.test.tsx`): admin + `status: 'Triaged'` renders an enabled
    description textarea (`expect(screen.getByLabelText(/^description/i)).toBeEnabled()`); admin
    + `status: 'New'` renders it disabled.
  - |
    AC6 (backend, `defects.e2e-spec.ts`): an `employee` whose `sub` does not match `reportedBy`
    PATCHes any field on someone else's defect → `expect(res.status).toBe(403)`, and a follow-up
    `GET` shows nothing changed.
    AC6 (frontend, `DefectEditPage.test.tsx`): that same user renders the locked/unauthorized
    branch: `expect(screen.getByText(/don't have permission/i)).toBeInTheDocument()` and every
    textarea in the form is disabled.
  - |
    AC7 (backend, `defects.e2e-spec.ts`): seed a `status: 'Triaged'` defect with `priority: 'P2'`
    set directly via the repository, have an `admin` PATCH `{ severity: 'Low' }`, then `GET` it:
    `expect(res.body).toMatchObject({ severity: 'Low', priority: 'P2' })`.
    AC7 (frontend, `DefectEditPage.test.tsx`): the Priority readonly row still reads "P2" after a
    successful severity save.
  - |
    AC8 (backend, `defects.e2e-spec.ts`): `PATCH /defects/:id` with a `status` field in the body
    is rejected by the whitelist validator regardless of role:
    `expect((await http().patch(\`/defects/${id}\`).set('Authorization', admin).send({ status: 'Triaged' })).status).toBe(400)`.
    AC8 (frontend, `DefectEditPage.test.tsx`): admin edit form has no status control:
    `expect(screen.queryByRole('combobox', { name: /status/i })).not.toBeInTheDocument()` and
    `expect(screen.queryByLabelText(/^status/i)).not.toBeInTheDocument()` (only a plain readonly
    row with the text "Status" exists).

assumptions_or_open_questions:
  - |
    "Has entered Triaged" (AC3/AC5/AC7) is implemented as `status !== 'New'`, since only `New`
    and `Triaged` exist anywhere in the codebase today (the design's own status picker only
    offers those two) and no workflow story has defined the full status set yet. If a future
    workflow story introduces statuses that are *not* reachable only by passing through Triaged,
    this boundary condition will need revisiting.
  - |
    "Reporter" in AC2/AC3/AC6 is treated as an *identity* check (`user.sub === defect.reportedBy`)
    rather than a role check, since a defect's reporter is a specific person, not everyone holding
    the `reporter` role. "Admin" in AC4/AC5/AC7/AC8 is treated as a role check (`user.role ===
    'admin'`), a new role value added to the shared `Role` enum — there was no existing "Admin"
    role in the codebase before this story (only `hr_admin`, specific to the Employee domain).
  - |
    `priority` and `assignee_name` are added as plain nullable columns with no setter in this
    story (no endpoint writes them) — they exist solely so the detail/edit views have something
    real to display and so AC7 can be asserted against actual stored data. A future
    triage/assignment story is expected to populate them properly (and may want a proper FK to
    `employees` for the assignee, and a constrained value set for priority, instead of free text).
  - |
    The Reporter row on the detail view shows the raw `reportedBy` identifier (the Cognito `sub`,
    e.g. `rep-1`) as-is, the same way `POST /defects` already returns it today — there is no
    existing mechanism in this codebase to resolve that identifier to a friendly display name
    (the design prototype shows "Jordan Blake" but that's static fixture data, not a resolvable
    join). This is an inconsistency with the new `assigneeName` field (modeled as a free-text
    display name) worth flagging for a reviewer: a future story may want to standardize identity
    display across the defect record.
  - |
    Any signed-in, authenticated user (any role, any tenant membership check only) can `GET` any
    defect in their tenant — per the story's explicit scope exclusion ("does not define which
    users can see which project's defects"), no additional visibility restriction is applied
    beyond tenant isolation.
  - |
    On save, the edit page always navigates back to `/defects/:id` and shows a toast, rather than
    staying on the edit screen with an inline success banner as the prototype does — the
    prototype's "stay on screen" behavior is a standalone-HTML-demo convenience with no real
    routing; this app's equivalent existing flow (`EditEmployeeProfilePage.tsx`) navigates away
    and toasts, so this plan follows that established convention instead.

estimated_points: 8

package_dependencies: []

notes: |
  ```mermaid
  flowchart TD
    subgraph API[comp_api_service]
      RolesEnum[employee-fields.ts: ROLES]
      Migration[Migration: priority + assignee_name]
      Entity[Defect entity]
      UpdateDto[UpdateDefectDto]
      Service[DefectsService]
      Controller[DefectsController]
      Guard[CognitoAuthGuard / RolesGuard]
    end
    subgraph WEB[comp_web_app]
      AuthLib[lib/auth.ts]
      TypesLib[lib/types.ts]
      Helpers[test/helpers.tsx signIn]
      Tags[components/DefectTags.tsx]
      ReportPage[routes/ReportDefectPage.tsx]
      DetailPage[routes/DefectDetailPage.tsx]
      EditPage[routes/DefectEditPage.tsx]
      AppRoutes[App.tsx]
      ApiClient[lib/apiClient.ts]
    end

    RolesEnum -- "adds 'admin', read by" --> Guard
    Guard --> Controller
    Migration --> Entity
    UpdateDto --> Controller
    Controller --> Service
    Service --> Entity

    AppRoutes --> DetailPage
    AppRoutes --> EditPage
    DetailPage -- "GET /defects/:id" --> ApiClient
    EditPage -- "PATCH /defects/:id" --> ApiClient
    ApiClient -.->|HTTP| Controller
    DetailPage --> Tags
    EditPage --> Tags
    ReportPage -- "refactored to import" --> Tags
    DetailPage --> AuthLib
    EditPage --> AuthLib
    DetailPage --> TypesLib
    EditPage --> TypesLib
    Helpers -. "used by" .-> DetailPage
    Helpers -. "used by" .-> EditPage

    classDef touched fill:#f96,color:#000
    class RolesEnum,Migration,Entity,UpdateDto,Service,Controller,AuthLib,TypesLib,Helpers,Tags,ReportPage,DetailPage,EditPage,AppRoutes touched
  ```

review_focus: |
  In scope: GET/PATCH on a single existing defect, the Reporter-pre-triage vs. Admin-post-triage
  edit matrix for description/reproduction details, Admin-always severity edit, and the refusal
  path for everyone else. Out of scope (don't flag as missing): status transitions/workflow
  actions, who can *see* a given defect (any authenticated tenant member can view), and any real
  mechanism to set `priority`/`assignee_name` (added here only as nullable display columns).
  Riskiest area: the authorization/triage branching lives in `DefectsService.updateDefect` as a
  few boolean conditions — a sign flip there (e.g. `isAdmin && isTriaged` vs. `isAdmin ||
  isTriaged`) would silently let the wrong role edit the wrong field at the wrong status, and
  it's the kind of bug unit tests catch but a quick read of the diff might not. Also worth a close
  look: this plan deliberately does *not* apply the prototype's embedded CSS verbatim for
  `.readonly-row`/`.readonly-label` (it would have changed the Employee Profile pages' layout as
  a side effect); it adds new, additive classes instead. And `reportedBy` is shown as a raw
  identifier rather than a friendly name — flagged as a known inconsistency, not an oversight.

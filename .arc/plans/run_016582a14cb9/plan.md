summary: |
  Adds a lifecycle `status` field (`active` | `on_leave` | `terminated`) to the employee record
  already built in STORY-012, plus the state-transition rules the ACs describe: HR Admin can move
  an employee manually between active/on-leave/terminated; a terminated record becomes fully
  read-only while staying visible; and HR Admin can "rehire" a terminated employee, which creates a
  brand-new employee record linked back to the terminated one (the terminated record itself never
  changes). The Leave epic's approve/reject workflow is out of scope, but this plan exposes the
  integration point it will call (a service method on `EmployeesService`, exported from
  `EmployeesModule`) so that when that epic lands it can flip status to `on_leave` (approved) or
  leave it `active` (rejected) without needing to know anything about the Employees domain's
  internals. Everything server-side builds on the existing `services/api/src/employees` module
  (NestJS + TypeORM + the tenant-scoped, pessimistic-locking transaction pattern already used for
  core-field edits and change requests); the web side extends the existing Employee Profile Detail
  page and adds one new page for the rehire flow, reusing `Layout`, `Banner`, `Toast`,
  `CoreFieldInput` and the existing `.chip-*`/`.select`/`.readonly-row` styles rather than
  introducing new components. Beyond the 13 numbered ACs, this revision adds explicit edge-case
  coverage (idempotent transitions, tenant isolation, auth/role boundaries, double leave-decision
  events, and multiple rehires from one terminated record) so these behaviours are pinned down by
  tests rather than left to implementer judgment.
scope:
  - description: |
      Add `EMPLOYEE_STATUSES`/`EmployeeStatus` to the shared fields module so both the entity and
      DTOs reference one source of truth for the three allowed values (AC1).
    files:
      - services/api/src/employees/employee-fields.ts
    rationale: |
      Mirrors the existing `CORE_FIELDS`/`CoreField` pattern already in this file, which
      `employees.service.ts`, DTOs and `roles.decorator.ts` all import from.
  - description: |
      Add `status` (text, default `'active'`) and `rehiredFromId` (nullable uuid) columns to the
      `Employee` entity.
    files:
      - services/api/src/employees/entities/employee.entity.ts
    rationale: |
      `status` is the field the whole story tracks; `rehiredFromId` is the link AC12 requires
      between a rehire record and the terminated record it came from.
  - description: |
      New migration adding the two columns to the `employees` table with a `CHECK` constraint
      restricting `status` to the three allowed values, an FK from `rehired_from_id` to
      `employees(id)` (deliberately not unique — a terminated record may be the source of more than
      one rehire over time, see edge case below), and an index on `(tenant_id, status)` to support
      AC13's reporting read.
    files:
      - services/api/src/database/migrations/1700000000002-employee-lifecycle-status.ts
    rationale: |
      Follows the existing migration style in `1700000000000-create-employees-schema.ts` (raw
      `q.query` calls, explicit `up`/`down`).
  - description: |
      New `UpdateEmployeeStatusDto` (`status` validated with `@IsIn(EMPLOYEE_STATUSES)`) and
      `RehireEmployeeDto` (required `startDate`, optional `fullName` + the four core fields,
      mirroring `CreateEmployeeDto`'s validators).
    files:
      - services/api/src/employees/dto/update-employee-status.dto.ts
      - services/api/src/employees/dto/rehire-employee.dto.ts
    rationale: |
      Keeps validation declarative and consistent with `create-employee.dto.ts` /
      `update-employee.dto.ts`, and gives `@IsIn` a closed enum straight off AC1's exact three
      values instead of a free-text string.
  - description: |
      `EmployeesService`: set `status: 'active'` explicitly in `createEmployee`'s `repo.create`
      call (same explicit-every-field style already used there); add `setStatus(tenantId, id,
      status, recordedBy)` for AC1-4 manual transitions — allowed from `active` or `on_leave` to
      any of the three values, including a same-value no-op (idempotent, not an error) and
      `on_leave` -> `terminated` directly, and rejected with `ConflictException` only when the
      *current* status is already `terminated`; add `recordLeaveDecision(tenantId, employeeId,
      decision, recordedBy)` as the Leave epic's integration point for AC5/AC6, using the same
      terminated-guard and tolerating a repeated `'approved'` event on an already-`on_leave`
      employee as a no-op; add `rehireEmployee(tenantId, terminatedId, dto, recordedBy)` for
      AC10-12, callable more than once against the same terminated source record; add a guard at
      the top of `updateAsHrAdmin` that throws `ConflictException` when the locked employee's
      status is `'terminated'` (AC7). All three new mutating methods reuse `loadEmployee(m,
      tenantId, id, true)`, so an id from another tenant 404s the same way `getEmployee` already
      does.
    files:
      - services/api/src/employees/employees.service.ts
    rationale: |
      Follows the existing transaction/pessimistic-lock pattern (`loadEmployee(m, tenantId, id,
      true)`) used by `updateAsHrAdmin` and `approveChangeRequest`, so status transitions and
      rehire get the same race protection, tenant scoping and 404 behaviour as core-field edits.
  - description: |
      `EmployeesController`: add `PATCH /employees/:id/status` (`@Roles('hr_admin')`) calling
      `setStatus`, and `POST /employees/:id/rehire` (`@Roles('hr_admin')`) calling `rehireEmployee`.
      Both inherit the controller-level `@UseGuards(CognitoAuthGuard, RolesGuard)`, so an
      unauthenticated caller gets 401 and a non-`hr_admin` caller gets 403 with no code changes
      needed beyond the decorator.
    files:
      - services/api/src/employees/employees.controller.ts
    rationale: |
      Matches the existing `@Patch(':id')`/`@Post()` + `@Roles('hr_admin')` shape already on this
      controller; placed after the existing `:id` routes, consistent with how `:id/history` is
      declared.
  - description: |
      Export `EmployeesService` from `EmployeesModule` so a future Leave module can inject it to
      call `recordLeaveDecision` without a new HTTP surface.
    files:
      - services/api/src/employees/employees.module.ts
    rationale: |
      The story explicitly frames the Leave trigger as "automatic" and internal to this
      domain-organized monolith (per the confirmed `comp_api_service` notes: "domain-organized
      internally"); a same-process NestJS DI call needs no new auth model, unlike a new HTTP route
      would.
  - description: |
      Unit tests for all new `EmployeesService` behaviour: status default, manual transitions
      (including the idempotent no-op and `on_leave` -> `terminated`), the leave-decision
      integration point (including a repeated `'approved'` event), the terminated-record edit
      guard, tenant isolation on all three new methods, rehire linking, the guard against rehiring
      a non-terminated employee, and two separate rehires from the same terminated source.
    files:
      - services/api/src/employees/employees.service.spec.ts
    rationale: ""
  - description: |
      E2E tests for the two new routes: the role/status guards, validation errors, 401/403
      boundaries, and that `status` is present (not stripped) in both HR Admin and non-HR-Admin
      responses from `GET /employees` and `GET /employees/:id`, in the existing
      `employees.e2e-spec.ts` supertest file.
    files:
      - services/api/test/employees.e2e-spec.ts
    rationale: ""
  - description: |
      Add `EmployeeStatus` type and `status`/`rehiredFromId` fields to the web `Employee`
      interface.
    files:
      - apps/web/src/lib/types.ts
    rationale: ""
  - description: |
      Add `EMPLOYEE_STATUSES` and `EMPLOYEE_STATUS_LABELS` to the web fields module, mirroring
      `CORE_FIELDS`/`CORE_FIELD_LABELS`.
    files:
      - apps/web/src/lib/fields.ts
    rationale: ""
  - description: |
      `EmployeeProfileDetailPage`: add a status control inside the "Core profile" card — an HR
      Admin sees a `<select>` of the three statuses that PATCHes `/employees/:id/status` on change
      and reloads (AC1-4); everyone else sees the status as read-only text. Hide the "Edit profile"
      action entirely when `employee.status === 'terminated'`, replacing it with a "Create rehire"
      link to the new rehire route for HR Admins (AC7 reject is server-side; this is the AC8
      "no edit control shown" half). The existing data rendering is untouched, so AC9 (data stays
      visible) holds without extra code.
    files:
      - apps/web/src/routes/EmployeeProfileDetailPage.tsx
    rationale: |
      Reuses this story's existing detail page, `Layout`'s `actions` prop, the `readonly-row`/
      `select` CSS classes already used elsewhere on this same page, and the `reload()` returned by
      `useAsync` (already used the same way in `EmployeeDirectoryPage`'s retry button) instead of
      introducing new local state to re-fetch after the status PATCH.
  - description: |
      Add tests to the existing `EmployeeProfileDetailPage.test.tsx` for: the status `<select>`
      offers exactly Active/On leave/Terminated (AC1), choosing a new value shows the new status
      (AC2/AC3/AC4), re-selecting the employee's current status is a no-op that still succeeds
      (edge case), and a terminated employee's page has no "Edit profile" link while all fields
      stay visible (AC8/AC9).
    files:
      - apps/web/src/routes/EmployeeProfileDetailPage.test.tsx
    rationale: ""
  - description: |
      New `RehireEmployeePage`: loads the terminated employee (read-only name/ID shown), takes a
      required new start date and the optional four core fields (reusing `CoreFieldInput`), and
      POSTs to `/employees/:id/rehire`; on success, navigates to the new employee's profile and
      toasts with the new Employee ID and a reference to the original (AC10-12).
    files:
      - apps/web/src/routes/RehireEmployeePage.tsx
    rationale: |
      Mirrors `NewEmployeeProfilePage.tsx`'s form shape (same `CoreFieldInput`/`Banner`/`Toast`
      usage) rather than inventing a different form pattern, since a rehire is "create a new
      employee record" with one field (start date) pre-required and the person's name carried over.
  - description: |
      Test the rehire page: submitting with only a start date POSTs `{ startDate }` to
      `/employees/:id/rehire` and navigates to the new record; submitting with a missing start date
      shows a validation error and does not POST (edge case, mirrors the existing
      `NewEmployeeProfilePage` required-field test pattern).
    files:
      - apps/web/src/routes/RehireEmployeePage.test.tsx
    rationale: ""
  - description: |
      Register the `/employees/:id/rehire` route, gated the same way as `/employees/new` (via the
      existing `RequireHrAdmin` wrapper already defined in this file).
    files:
      - apps/web/src/App.tsx
    rationale: ""
tests:
  - |
    AC1 (service): `const e = await service.createEmployee(tenantId, { fullName: 'New', startDate: '2026-01-01' }); expect(e.status).toBe('active')` — and a dedicated web test asserting the status `<select>`'s options are exactly `['Active', 'On leave', 'Terminated']`:
    ```ts
    const select = await screen.findByLabelText(/status/i)
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Active', 'On leave', 'Terminated'])
    ```
  - |
    AC2/AC3 (service): `await service.setStatus(tenantId, id, 'on_leave')` then `await service.setStatus(tenantId, id, 'active')`, asserting `.status` after each call:
    ```ts
    expect((await service.setStatus(tenantId, id, 'on_leave')).status).toBe('on_leave')
    expect((await service.setStatus(tenantId, id, 'active')).status).toBe('active')
    ```
    Plus the e2e round trip: `PATCH /employees/:id/status` with `{ status: 'on_leave' }` then `{ status: 'active' }`, each `expect(res.status).toBe(200)`, and a follow-up `GET /employees/:id` whose body matches.
  - |
    AC4 (service + e2e): `expect((await service.setStatus(tenantId, id, 'terminated')).status).toBe('terminated')`; e2e: `await http().patch(`/employees/${e.id}/status`).set('Authorization', hr).send({ status: 'terminated' }).expect(200)`.
  - |
    AC1 validation (e2e): an invalid status value is rejected: `await http().patch(`/employees/${e.id}/status`).set('Authorization', hr).send({ status: 'bogus' }).expect(400)`.
  - |
    AC5 (service): `expect((await service.recordLeaveDecision(tenantId, id, 'approved')).status).toBe('on_leave')` — this is the method the (future, out-of-scope) Leave epic module will call on approval.
  - |
    AC6 (service): `expect((await service.recordLeaveDecision(tenantId, id, 'rejected')).status).toBe('active')`.
  - |
    AC7 (service): edits are rejected once terminated:
    ```ts
    await service.setStatus(tenantId, id, 'terminated')
    await expect(service.updateAsHrAdmin(tenantId, id, { fullName: 'New Name' })).rejects.toBeInstanceOf(ConflictException)
    ```
    Plus e2e: `await http().patch(`/employees/${e.id}`).set('Authorization', hr).send({ fullName: 'New' }).expect(409)` after terminating via the status route.
  - |
    AC8 (web): after terminating, `EmployeeProfileDetailPage` renders no edit link:
    ```ts
    renderAt(<EmployeeProfileDetailPage />, '/employees/u1', '/employees/:id')
    await screen.findByText('Alicia Gomez')
    expect(screen.queryByRole('link', { name: /edit profile/i })).not.toBeInTheDocument()
    ```
  - |
    AC9 (service + web): `getEmployee` still returns the full terminated record (`expect(e.fullName).toBe('Jordan Lee')`), and the same web test above asserts `screen.getByText('Alicia Gomez')` (the full name) is present alongside the missing edit link.
  - |
    AC10/AC11/AC12 (service):
    ```ts
    await service.setStatus(tenantId, id, 'terminated')
    const rehired = await service.rehireEmployee(tenantId, id, { startDate: '2026-06-01' })
    expect(rehired.id).not.toBe(id)
    expect(rehired.status).toBe('active')
    expect(rehired.rehiredFromId).toBe(id)
    expect((await service.getEmployee(tenantId, id)).status).toBe('terminated')
    ```
    Plus the e2e equivalent via `POST /employees/:id/rehire`, and a guard test: `await expect(service.rehireEmployee(tenantId, id, { startDate: '2026-06-01' })).rejects.toBeInstanceOf(ConflictException)` when `id` is not terminated.
  - |
    AC13 (service): `await service.setStatus(tenantId, id, 'on_leave'); expect((await service.getEmployee(tenantId, id)).status).toBe('on_leave')` — proves the saved status is immediately what any reader (including a future reporting read) gets back; the same assertion shape is reused after the terminate and rehire transitions above.
  - |
    Edge case (not a formal AC) — idempotent same-value transition: `const twice = await service.setStatus(tenantId, id, 'active'); expect(twice.status).toBe('active')` when the employee is already `active`, asserting it succeeds rather than throwing.
  - |
    Edge case — terminating directly from `on_leave` (not only from `active`, which is all AC4 literally covers):
    ```ts
    await service.setStatus(tenantId, id, 'on_leave')
    expect((await service.setStatus(tenantId, id, 'terminated')).status).toBe('terminated')
    ```
  - |
    Edge case — a repeated `'approved'` leave-decision event on an already-`on_leave` employee is tolerated, not an error: `await service.recordLeaveDecision(tenantId, id, 'approved'); expect((await service.recordLeaveDecision(tenantId, id, 'approved')).status).toBe('on_leave')`.
  - |
    Edge case — a leave decision against a terminated employee is rejected the same way a manual edit is: `await service.setStatus(tenantId, id, 'terminated'); await expect(service.recordLeaveDecision(tenantId, id, 'approved')).rejects.toBeInstanceOf(ConflictException)`.
  - |
    Edge case — tenant isolation on the two new methods, mirroring the existing `'scopes by tenant'` test: `await expect(service.setStatus(otherTenant, id, 'on_leave')).rejects.toBeInstanceOf(NotFoundException)` and the same shape for `rehireEmployee`.
  - |
    Edge case (e2e) — auth/role boundaries on both new routes:
    ```ts
    await http().patch(`/employees/${e.id}/status`).send({ status: 'on_leave' }).expect(401)
    await http().patch(`/employees/${e.id}/status`).set('Authorization', emp).send({ status: 'on_leave' }).expect(403)
    await http().post(`/employees/${e.id}/rehire`).set('Authorization', emp).send({ startDate: '2026-06-01' }).expect(403)
    ```
  - |
    Edge case (e2e) — a rehire request missing the required `startDate` is rejected: `await http().post(`/employees/${e.id}/rehire`).set('Authorization', hr).send({}).expect(400)`, and the terminated source record is unchanged afterwards.
  - |
    Edge case — two separate rehires from the same terminated record both succeed and both link back to it: `const r1 = await service.rehireEmployee(tenantId, id, { startDate: '2026-06-01' }); const r2 = await service.rehireEmployee(tenantId, id, { startDate: '2026-07-01' }); expect([r1.rehiredFromId, r2.rehiredFromId]).toEqual([id, id]); expect(r1.id).not.toBe(r2.id)`.
  - |
    Edge case — a rehire with no core fields supplied does not copy the original's job title/department/contract type/salary onto the new record: `const rehired = await service.rehireEmployee(tenantId, id, { startDate: '2026-06-01' }); expect(rehired).toMatchObject({ jobTitle: null, department: null, contractType: null, salary: null })`, confirming the new record genuinely starts fresh rather than cloning the source.
  - |
    Edge case (e2e) — `status` is visible to a non-HR-Admin viewer (it is not one of the fields `present()` strips): `const res = await http().get(`/employees/${e.id}`).set('Authorization', emp); expect(res.body.status).toBe('active')`.
assumptions_or_open_questions:
  - |
    The Leave epic's approval/rejection workflow doesn't exist in the codebase yet, so AC5/AC6 are
    implemented as a plain `EmployeesService.recordLeaveDecision(...)` method exported from
    `EmployeesModule`, callable in-process by that epic's module once it exists — not a new HTTP
    endpoint. If the Leave epic turns out to live in a separate deployable service rather than this
    same NestJS monolith, this integration point would need to become an HTTP/queue contract
    instead; please confirm this assumption still holds.
  - |
    AC7 ("HR Admin attempts to edit any field... the edit is rejected") is read literally as the
    direct HR Admin edit route (`PATCH /employees/:id`, i.e. `updateAsHrAdmin`). Self-service
    contact edits (`updateOwnContact`) and the pending-change-request flow
    (`submitChangeRequest`/`approveChangeRequest`) are not guarded against a terminated employee in
    this plan, since no AC names them and the parent description's "read-only" framing is centered
    on the HR Admin edit path. Flagging this in case the read-only intent is meant to be broader.
  - |
    A terminated employee's status is terminal from the `setStatus`/`updateAsHrAdmin`/
    `recordLeaveDecision` side — the only documented path back to `active` is the rehire flow
    creating a brand-new record (per AC10-12), so all three throw `ConflictException` once the
    current status is `terminated`, matching the AC7 "no edits at all" framing for the strongest
    reading of "retaining the record read-only."
  - |
    `setStatus` treats a same-value transition (e.g. `active` -> `active`) and `on_leave` ->
    `terminated` as allowed, since no AC restricts the *source* status for AC4's terminate
    transition or forbids a no-op — only "current status is terminated" blocks a change. Similarly
    `recordLeaveDecision('approved')` on an employee already `on_leave` is treated as an idempotent
    no-op rather than an error, since the Leave epic may emit more than one approval-adjacent event
    for the same leave request. Flagging these as a judgment call in the absence of an AC that says
    otherwise.
  - |
    `rehireEmployee` has no restriction on how many times a given terminated record can be the
    source of a rehire (`rehired_from_id` is a plain FK, not unique) — AC10-12 describe creating
    "a" rehire record, not "the one and only" rehire, so repeat rehires (e.g. someone terminated,
    rehired, terminated again, rehired again) are allowed by design rather than blocked.
  - |
    The rehire flow asks only for a new start date (required) plus the four optional core fields,
    carrying the original full name forward unless overridden; no AC specifies exactly which fields
    a rehire form must collect, so this mirrors the existing "create employee" shape as the
    simplest fit. Core fields are intentionally NOT copied from the terminated source by default
    (they come back `null` unless the HR Admin supplies them on the rehire form), consistent with
    how `createEmployee` already treats unsupplied core fields.
  - |
    The existing "Status" column on `EmployeeDirectoryPage` (today showing "Active"/"Change
    pending" based on open change requests, not lifecycle state) is left unchanged — it is a
    different, pre-existing concept from this story's lifecycle `status` field, and no AC asks for
    the directory list view to be touched.
estimated_points: 8
package_dependencies: []
notes: |
  No new third-party packages: this reuses `class-validator`, TypeORM and the existing test
  tooling (vitest/supertest/@testing-library) already in both components.

  ```mermaid
  flowchart TD
    Controller[EmployeesController] -->|PATCH :id/status, POST :id/rehire - new| Service[EmployeesService]
    Service -->|setStatus/recordLeaveDecision/rehireEmployee - new| Entity[Employee entity]
    Service --> HistoryEntity[EmploymentHistoryEntry entity]
    Module[EmployeesModule] -->|exports EmployeesService - new| Service
    Module -.->|future Leave module calls recordLeaveDecision| FutureLeave[Leave epic module - not built yet]

    DetailPage[EmployeeProfileDetailPage] -->|PATCH :id/status on select change| ApiClient[apiClient]
    RehirePage[RehireEmployeePage - new] -->|POST :id/rehire| ApiClient
    AppRoutes[App.tsx] -->|new route /employees/:id/rehire| RehirePage
    ApiClient --> Controller

    classDef touched fill:#f96,color:#000
    class Controller,Service,Entity,Module,DetailPage,RehirePage,AppRoutes touched
  ```
review_focus: |
  In scope: the `status` field, its three allowed values, manual HR Admin transitions (including
  idempotent/on_leave-to-terminated edge cases), the `recordLeaveDecision` integration point for
  the (not-yet-built) Leave epic, terminated-record read-only enforcement on the direct HR Admin
  edit route, auth/tenant/role boundaries on both new routes, and the rehire-creates-a-linked-record
  flow including repeat rehires. Out of scope (deliberately untouched): the Leave epic's own
  request/approval workflow, any HTTP/queue contract for it, `updateOwnContact`/change-request
  guards against terminated employees, and the directory page's unrelated "pending change" status
  chip. The riskiest area is the terminated-record guard placement: it only intercepts
  `updateAsHrAdmin`, `setStatus` and `recordLeaveDecision`, so a reviewer should check whether
  `submitChangeRequest`/`approveChangeRequest` against a terminated employee is an acceptable gap
  for this iteration (see assumptions) rather than assume it was missed. Two deliberate,
  non-obvious design calls worth holding this plan to rather than flagging as bugs: (1) the rehire
  flow never mutates the terminated source record — only `rehiredFromId` on the new row encodes the
  link, and the same source can be rehired more than once; (2) a rehire's core fields start out
  `null` unless explicitly supplied — they are not cloned from the terminated source.

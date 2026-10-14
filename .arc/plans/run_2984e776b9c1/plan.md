summary: |
  Adds org-structure management to the HR console: a hierarchical Department entity (name, optional
  parent, exactly one manager) and single-manager reporting lines for employees, replacing the
  flat/no-hierarchy world the product has today. Backend work is a new `departments` NestJS module
  (CRUD + validation for the 17 acceptance criteria: required manager, blank-name and duplicate-sibling
  rejection, cycle-safe re-parenting, membership-aware delete blocking) plus two new nullable
  `employees` columns (`department_id`, `manager_id`) added via migration. Frontend work builds the
  four screens shown in the approved prototype (Department Tree, Employees & Managers, Org Chart, My
  Department) against that module, reusing the existing Layout/Banner/Toast components and the app's
  existing `.modal-backdrop`/`.modal`/`.table`/`.card` classes, with new tree/org-card CSS added
  page-locally the same way prior stories did. All tree/subtree/cycle math is written as pure,
  independently unit-tested helpers so AC8/AC14/AC15 (org chart nesting, manager subtree visibility)
  are verified without needing a real backend in frontend tests.
scope:
  - description: |
      Add the `departments` table and the two new reporting-line columns on `employees` via a new
      TypeORM migration, and the `Department` entity. Schema:
        - `departments`: id uuid pk, tenant_id uuid not null, name text not null,
          parent_id uuid null references departments(id), manager_id uuid not null references
          employees(id), created_at/updated_at timestamptz.
        - `employees`: add `department_id uuid null references departments(id)` and
          `manager_id uuid null references employees(id)` (both nullable — see assumptions: there is
          no AC or approved-design control for setting an employee's department membership directly,
          and a root employee like a CEO has no manager).
      No DB-level unique/duplicate-name constraint is added (parent_id is nullable, so a plain unique
      index doesn't enforce "unique per parent" the way sibling-name rejection needs — see
      AC17 handling in the service, which does this check in application code, matching the existing
      `employees.service.ts` pattern of enforcing business rules outside the schema).
    files:
      - services/api/src/database/migrations/1700000000002-create-departments-and-reporting-lines.ts
      - services/api/src/departments/entities/department.entity.ts
      - services/api/src/employees/entities/employee.entity.ts
    rationale: |
      Mirrors the existing migration/entity style (services/api/src/database/migrations/1700000000000-create-employees-schema.ts,
      services/api/src/employees/entities/employee.entity.ts) exactly: plain `Column`/`Entity` decorators,
      snake_case db names via `{ name: '...' }`, uuid PKs via gen_random_uuid() (pgcrypto already
      enabled by the first migration, so no new extension is needed). Employee is a shared entity from
      STORY-012 — the change here is strictly additive (two new nullable columns), so existing
      employee-profile behaviour and tests are unaffected.
  - description: |
      Department DTOs, following the class-validator conventions already used in
      services/api/src/employees/dto/create-employee.dto.ts:
        - `CreateDepartmentDto`: `name` (IsString, IsNotEmpty, `@Matches(/\S/)` to catch
          whitespace-only input per AC16), `parentId?` (IsOptional, IsUUID), `managerId` (IsUUID,
          IsNotEmpty — AC4).
        - `UpdateDepartmentDto`: same three fields, all `@IsOptional()`. `parentId` stays
          `string | null` (explicit null = "move to top level", AC10); `managerId` stays
          `string` (not nullable in the type) because clearing a department's manager is never a
          valid PATCH — the service additionally rejects an explicit `managerId: null` at runtime
          since class-validator's `@IsOptional()` treats `null` as "absent" and would otherwise let it
          through silently.
        - `UpdateEmployeeManagerDto`: `managerId` is plain `@IsUUID()` with NO `@IsOptional()`, so
          omitting it or sending `managerId: null` both fail validation with a 400 — this is what
          makes AC7 ("clear the manager field and save is rejected") true at the DTO layer, before the
          request even reaches the service.
    files:
      - services/api/src/departments/dto/create-department.dto.ts
      - services/api/src/departments/dto/update-department.dto.ts
      - services/api/src/departments/dto/update-employee-manager.dto.ts
    rationale: |
      Keeping manager-required vs. manager-clearable as a DTO-level type distinction (not just a
      runtime check) makes the AC4 vs. AC7 difference visible in the type signatures, matching how
      update-employee.dto.ts already encodes "fullName can't be cleared" with `@IsNotEmpty()` even
      though the field itself is optional.
  - description: |
      `DepartmentsService` (services/api/src/departments/departments.service.ts), injected with the
      same `DataSource` used by `EmployeesService` (no cross-module import needed — `DataSource` is
      provided globally by `DatabaseModule`). Public methods:
        listDepartments(tenantId: string): Promise<Department[]>
        createDepartment(tenantId: string, dto: CreateDepartmentDto): Promise<Department>
        updateDepartment(tenantId: string, id: string, dto: UpdateDepartmentDto): Promise<Department>
        deleteDepartment(tenantId: string, id: string): Promise<void>
        updateEmployeeManager(tenantId: string, employeeId: string, managerId: string): Promise<Employee>
      Validation rules implemented here (so they also run when a test calls the service directly,
      bypassing Nest's ValidationPipe — matching how employees.service.spec.ts tests the service in
      isolation):
        - create/update: `name.trim()` non-empty (AC16), and no sibling with the same
          `parentId` (null-safe) and the same trimmed, case-insensitive name already exists
          (AC17) — e.g.
          `const dup = siblings.some((d) => d.id !== excludeId && d.name.trim().toLowerCase() === name.trim().toLowerCase())`
          throwing `ConflictException` when true.
        - create: `managerId` required and must reference an existing employee in the tenant
          (AC4), else `BadRequestException`.
        - update: if `parentId` is provided (including explicit `null`), reject it when it equals the
          department's own id or any of its descendants — `getDescendantDepartmentIds(id)` computed by
          walking `parentId` links in memory (same recursive-in-JS approach as
          `getAllReportIds`/`getDescendantDeptIds` in the approved prototype) — else moving D under Q
          just sets `department.parentId = Q.id` (AC10); existing rows that reference D by
          `parentId`/`departmentId` need no change, since they point at D's id, not a path.
        - update: an explicit `managerId: null` (possible even though the DTO type says `string`,
          since JS callers/tests can still pass it) throws `BadRequestException('Select a manager for
          this department.')`; a provided non-null `managerId` must reference an existing employee.
        - delete: count direct employees (`employees.departmentId === id`) and direct children
          (`departments.parentId === id`); if either is non-zero, throw `ConflictException` with a
          message naming the counts (AC11/AC12); otherwise delete the row (AC13).
        - updateEmployeeManager: `managerId` must reference an existing employee, must not equal
          `employeeId` itself, and must not be one of the employee's own (recursive) reports — computed
          via a `getAllReportIds(employeeId)` walk over `employees.managerId` links — else
          `BadRequestException`, preventing a reporting-line cycle that would make AC8/AC9 nonsensical.
    files:
      - services/api/src/departments/departments.service.ts
    rationale: |
      All tree/cycle logic runs in application code over arrays already loaded via
      `dataSource.getRepository(...).find(...)`, not SQL recursive CTEs — this matches
      `employees.service.ts`'s existing style and works unchanged against both the real Postgres
      `DataSource` and the in-memory `FakeDataSource` used by every existing test
      (services/api/test/support/fake-data-source.ts), so no new test infrastructure is needed.
  - description: |
      Two controllers (both guarded the same way as `EmployeesController`, `@UseGuards(CognitoAuthGuard,
      RolesGuard)`):
        - `DepartmentsController` (`@Controller('departments')`): `GET /departments` (no `@Roles` —
          any authenticated user, matching `EmployeesController`'s unrestricted `GET /employees`, since
          Org Chart/My Department need it too), `POST /departments`, `PATCH /departments/:id`,
          `DELETE /departments/:id` (all three `@Roles('hr_admin')`).
        - `EmployeeManagerController` (`@Controller('employees')`): `PATCH :id/manager`
          (`@Roles('hr_admin')`), calling `departments.updateEmployeeManager(user.tenantId, id, dto.managerId)`.
          Kept as its own controller (not added to the existing `EmployeesController`) so this story's
          code stays out of the STORY-012-owned employees module, per the "excludes employee profile
          fields" scope boundary.
      `DepartmentsModule` wires both controllers + the service (no `imports` needed beyond
      `AuthModule`, same as `EmployeesModule`), and is registered in `AppModule`.
    files:
      - services/api/src/departments/departments.controller.ts
      - services/api/src/departments/employee-manager.controller.ts
      - services/api/src/departments/departments.module.ts
      - services/api/src/app.module.ts
    rationale: |
      Matches the existing module boundary pattern (EmployeesModule owns EmployeesController +
      PendingChangeRequestsController, both backed by one EmployeesService) and the
      me/sub-resource routing style already used for `employees/me/*`.
  - description: |
      Unit tests for `DepartmentsService`, one per backend-testable AC, using the existing
      `FakeDataSource` exactly like `employees.service.spec.ts` does (`new DepartmentsService(new
      FakeDataSource() as any)`, seeding an employee row directly via the fake `Employee` repo to use
      as a manager). Representative cases (full list mirrored in `tests` below):
        it('AC11: deleting a department with member employees is blocked', async () => {
          await expect(service.deleteDepartment(tenantId, dept.id)).rejects.toBeInstanceOf(ConflictException)
          expect(await service.listDepartments(tenantId)).toContainEqual(expect.objectContaining({ id: dept.id }))
        })
        it('AC13: deleting succeeds once members and sub-departments are reassigned elsewhere', async () => {
          await service.deleteDepartment(tenantId, dept.id)
          expect(await service.listDepartments(tenantId)).not.toContainEqual(expect.objectContaining({ id: dept.id }))
        })
    files:
      - services/api/src/departments/departments.service.spec.ts
    rationale: |
      Keeps parity with the existing test layout (one `*.service.spec.ts` per service) and lets the
      cycle/duplicate/membership rules be verified without booting Nest or supertest.
  - description: |
      End-to-end HTTP tests via supertest against a real `INestApplication`, following
      services/api/test/employees.e2e-spec.ts's pattern exactly (`createTestApp()`, `tokenFor({ role,
      sub })`, `FakeDataSource` swapped in under the hood). Covers RBAC (403 for role `employee` on
      write routes, 401 unauthenticated) in addition to the service-level behavioural tests, e.g.:
        it('a non-HR-Admin cannot create, edit or delete a department', async () => {
          const emp = `Bearer ${tokenFor({ sub: 'e-1', role: 'employee' })}`
          await http().post('/departments').set('Authorization', emp).send({ name: 'X', managerId: mgrId }).expect(403)
        })
    files:
      - services/api/test/departments.e2e-spec.ts
    rationale: |
      The unit tests above cover the business rules; this file's job is only to confirm the HTTP/RBAC
      wiring (guards, route paths, status codes), matching the division of labour already established
      between employees.service.spec.ts and employees.e2e-spec.ts.
  - description: |
      Frontend types and pure tree/manager-subtree helpers, independent of any component or fetch call
      so AC8/AC14/AC15 can be unit-tested directly:
        export interface Department { id: string; name: string; parentId: string | null; managerId: string }
        // Employee gains: departmentId: string | null; managerId: string | null
        export function getChildren(depts: Department[], parentId: string | null): Department[]
        export function getDescendantDepartmentIds(depts: Department[], id: string): string[]
        export function getSubtreeDepartmentIds(depts: Department[], id: string): string[]
        export function getDirectMembers(employees: Employee[], departmentId: string): Employee[]
        export function getAllReportIds(employees: Employee[], employeeId: string): string[]
        export function buildOrgChartRoots(employees: Employee[]): OrgChartNode[]
        export function getMyDepartmentView(depts: Department[], employees: Employee[], employeeId: string):
          { department: Department; subtree: Department[]; membersByDept: Map<string, Employee[]> } | null
      `getMyDepartmentView` returns `null` when `employeeId` doesn't manage any department (drives the
      "You don't manage a department" empty state), otherwise walks `getSubtreeDepartmentIds` from the
      department the employee manages and groups `getDirectMembers` per department in that subtree.
    files:
      - apps/web/src/lib/types.ts
      - apps/web/src/lib/orgTree.ts
      - apps/web/src/lib/orgTree.test.ts
    rationale: |
      These are the exact computations the approved prototype does client-side against its fixture
      (`getChildren`/`getDescendantDeptIds`/`getSubtreeDeptIds`/`getAllReportIds`/`renderOrgNode`/
      `renderMyDepartment` in the design HTML's inline script) — porting them to typed, independently
      tested functions means AC8/AC14/AC15 don't need a real backend or mocked fetch to verify the
      nesting/visibility logic itself; the pages below just call them with API data.
  - description: |
      Three shared modal components, reusing the app's existing `.modal-backdrop`/`.modal`/
      `.modal-actions`/`.field`/`.field-error` classes (see PendingChangesPage.tsx's reject modal) rather
      than the prototype's own `.modal-overlay`/`.modal-footer` names, to stay consistent with the one
      modal convention the app already has:
        - `DepartmentFormModal` — add/edit department (name input, parent `<select>` excluding the
          department itself and its descendants when editing, manager `<select>` of all employees).
          Props: `{ departments, employees, editing: Department | null, defaultParentId, onSave, onClose }`.
          Inline `.field-error` under name (AC16) and manager (AC4) on a 400, and surfaces a 409 (AC17)
          as a `.field-error` under name too, matching the prototype's `deptNameError`/`deptManagerError`
          placement.
        - `DeleteDepartmentModal` — given `{ department, memberCount, childCount, onConfirm, onClose }`,
          renders a `banner-danger` ("Can't delete ... Reassign its N employees/sub-departments ...")
          when `memberCount || childCount` (AC11/AC12, no confirm button offered), else a plain confirm
          with a destructive "Delete department" button (AC13).
        - `EditManagerModal` — given `{ employee, employees, onSave, onClose }`, a manager `<select>`
          excluding the employee and `getAllReportIds(employees, employee.id)`, submit rejected inline
          with `.field-error` when left blank (AC7) before even calling the API.
    files:
      - apps/web/src/components/DepartmentFormModal.tsx
      - apps/web/src/components/DepartmentFormModal.test.tsx
      - apps/web/src/components/DeleteDepartmentModal.tsx
      - apps/web/src/components/DeleteDepartmentModal.test.tsx
      - apps/web/src/components/EditManagerModal.tsx
      - apps/web/src/components/EditManagerModal.test.tsx
    rationale: |
      One shared form modal for create+edit+move (AC1/AC2/AC3/AC5/AC10) matches the prototype's own
      explicit design decision ("Edit reuses the same modal for rename, manager change, and
      re-parenting — one form, one primary action").
  - description: |
      `DepartmentTreePage` (route `/org/departments`, HR-Admin-only): fetches `/departments` +
      `/employees` once, renders the nested tree from the design's "Department Tree" screen — a
      `<ul className="org-tree">` of rows (`tree-row`/`tree-name`/`tree-manager`/`tree-count`/
      `tree-actions`, new classes added to index.css — see the CSS scope item below) with "+ Add
      department" in the topbar actions (opens `DepartmentFormModal` with no parent preselected, AC1),
      and per-row "Add sub-department" (preselects that department as parent, AC2), "Edit" (AC3/AC5/AC10)
      and "Delete" (opens `DeleteDepartmentModal`, AC11/AC12/AC13) buttons, exactly as the prototype's
      `renderDeptNode`/`openAddDeptModal`/`openEditDeptModal`/`openDeleteDeptModal`.
    files:
      - apps/web/src/routes/DepartmentTreePage.tsx
      - apps/web/src/routes/DepartmentTreePage.test.tsx
    rationale: |
      Built against `apiClient`/`useAsync`/`useToast`/`Layout` exactly like the other HR-Admin pages
      (EmployeeDirectoryPage.tsx, PendingChangesPage.tsx), so loading/error/empty states follow the same
      conventions reviewers already expect.
  - description: |
      `EmployeeManagersPage` (route `/org/employees`, HR-Admin-only): fetches `/departments` +
      `/employees`, renders the "Employees & Managers" screen's `.table` (Employee, Title, Department,
      Manager, "Edit manager" button opening `EditManagerModal`) — AC6/AC7. Department column resolves
      `employee.departmentId` to a department name via the fetched `/departments` list (or an em dash
      when unset).
    files:
      - apps/web/src/routes/EmployeeManagersPage.tsx
      - apps/web/src/routes/EmployeeManagersPage.test.tsx
    rationale: |
      Matches the prototype's "Employees & Managers" screen, which exposes manager reassignment only
      (no department-membership control) — see assumptions for why department membership assignment
      itself isn't built as a UI feature in this story.
  - description: |
      `OrgChartPage` (route `/org/chart`, any authenticated user): fetches `/employees`, calls
      `buildOrgChartRoots`, renders the prototype's "Org Chart" screen — nested `.org-card` elements
      (name/title/department) under their manager, roots being employees with no `managerId` (AC8).
    files:
      - apps/web/src/routes/OrgChartPage.tsx
      - apps/web/src/routes/OrgChartPage.test.tsx
    rationale: |
      Pure rendering of `buildOrgChartRoots` output (already unit-tested in isolation above) keeps this
      component test focused on wiring (fetch → render), not re-proving the nesting logic.
  - description: |
      `MyDepartmentPage` (route `/org/my-department`, any authenticated user): fetches `/departments` +
      `/employees`, calls `getMyDepartmentView(departments, employees, auth.employeeId)`. When `null`,
      shows the prototype's fallback ("This employee doesn't manage a department" equivalent copy);
      otherwise renders one `.table` per department in the subtree under a `dept-group-heading`
      (department's own members first, "(sub-department)" suffix on the rest), covering AC14 (a nested
      sub-department's member is shown) and AC15 (an employee outside the subtree is not).
    files:
      - apps/web/src/routes/MyDepartmentPage.tsx
      - apps/web/src/routes/MyDepartmentPage.test.tsx
    rationale: |
      The prototype's "My Department" screen has a "Viewing as" dropdown purely because it's a
      no-backend demo; in production the viewer is always the signed-in user, so the dropdown is
      dropped and `auth.employeeId` (already available via `useAuth()`) drives the view directly.
  - description: |
      Wiring: add the four new routes to `App.tsx` (Department Tree and Employees & Managers wrapped in
      the existing `RequireHrAdmin`, matching how `/pending-changes` is gated; Org Chart and My
      Department unwrapped), and add an "Org Structure" sidebar group to `Layout.tsx` with the four
      links from the design (`sidebar-section-label` + `NavLink`s, Department Tree/Employees & Managers
      only shown when `isHr`, matching how the existing "Pending changes" link is conditionally
      rendered). Add the page-local CSS the four pages need (not present in index.css or the
      design-system today): `.org-tree`, `.tree-children`, `.tree-row`, `.tree-name`, `.tree-manager`,
      `.tree-count`, `.tree-actions`, `.org-card`, `.org-card-name`, `.org-card-title`, `.org-card-dept`,
      `.dept-group-heading`, `.field-help`, `.section-note` — copied from the approved prototype's own
      `<style>` block (lines 330–395 of the design HTML) with only token/variable names kept (no literal
      colors/spacing), appended under the file's existing "Page-level additions from the approved
      prototype" comment.
    files:
      - apps/web/src/App.tsx
      - apps/web/src/components/Layout.tsx
      - apps/web/src/index.css
    rationale: |
      Keeps the new screens reachable and styled using the project's established extension points
      (App.tsx route table, Layout.tsx sidebar, index.css page-local section) instead of introducing a
      parallel layout or stylesheet.
  - description: |
      Playwright e2e specs, following apps/web/e2e/employee-profile.spec.ts's pattern (`page.route(...)`
      mocks, no real backend) to exercise the full user-visible flows end to end per screen: creating a
      top-level and nested department (AC1/AC2), rename (AC3), blank-name/no-manager rejection
      (AC4/AC16), duplicate-sibling rejection (AC17), manager reassignment and clear-rejection on the
      Employees & Managers screen (AC6/AC7), re-parenting via Edit (AC10), the three delete states —
      blocked by members, blocked by sub-departments, success once reassigned (AC11/AC12/AC13, the
      "reassigned" precondition supplied directly in the mocked `GET /departments`+`GET /employees`
      fixtures, since the approved design has no UI control for employee department reassignment — see
      assumptions), the Org Chart nesting (AC8) and My Department subtree visibility (AC14/AC15). AC9
      (reload) is asserted by mocking the same `GET` fixtures again after `page.reload()` and confirming
      the same tree/manager state renders.
    files:
      - apps/web/e2e/org-structure.spec.ts
    rationale: |
      Matches the existing e2e layer's scope: UI behaviour against mocked routes, not real persistence
      (that's covered by the backend e2e/unit tests above).
tests:
  - |
    AC1 (departments.service.spec.ts): creating a department with no `parentId` puts it at the top level.
    const dept = await service.createDepartment(tenantId, { name: 'Facilities', managerId: mgrId })
    expect(dept.parentId).toBeNull()
  - |
    AC2 (departments.service.spec.ts): creating a department with an existing parent nests it underneath.
    const platform = await service.createDepartment(tenantId, { name: 'Platform', parentId: eng.id, managerId: mgrId })
    expect(platform.parentId).toBe(eng.id)
  - |
    AC3 (departments.service.spec.ts): renaming a department updates its name.
    const updated = await service.updateDepartment(tenantId, dept.id, { name: 'Engineering' })
    expect(updated.name).toBe('Engineering')
  - |
    AC4 (departments.service.spec.ts): creating without a manager is rejected and not added.
    await expect(service.createDepartment(tenantId, { name: 'Facilities' } as any)).rejects.toBeInstanceOf(BadRequestException)
    expect(await service.listDepartments(tenantId)).toHaveLength(0)
  - |
    AC5 (departments.service.spec.ts): changing a department's manager replaces the previous one as its only manager.
    const updated = await service.updateDepartment(tenantId, dept.id, { managerId: n.id })
    expect(updated.managerId).toBe(n.id)
  - |
    AC6 (departments.service.spec.ts): reassigning an employee's manager replaces the old one entirely.
    const after = await service.updateEmployeeManager(tenantId, e.id, n.id)
    expect(after.managerId).toBe(n.id)
  - |
    AC7 (departments.service.spec.ts): clearing an employee's manager is rejected and leaves it unchanged.
    await expect(service.updateEmployeeManager(tenantId, e.id, null as any)).rejects.toBeInstanceOf(BadRequestException)
    expect((await getEmployee(e.id)).managerId).toBe(m.id)
  - |
    AC8 (apps/web/src/lib/orgTree.test.ts): every employee renders as a direct report beneath their manager.
    const roots = buildOrgChartRoots([dana, priya, liam])
    expect(roots[0].reports.map((r) => r.id)).toContain('priya')
    expect(roots[0].reports.find((r) => r.id === 'priya')!.reports.map((r) => r.id)).toContain('liam')
  - |
    AC9 (departments.service.spec.ts): a fresh read reflects everything previously saved.
    await service.updateDepartment(tenantId, dept.id, { name: 'Engineering', managerId: n.id })
    const reloaded = await service.listDepartments(tenantId)
    expect(reloaded).toContainEqual(expect.objectContaining({ id: dept.id, name: 'Engineering', managerId: n.id }))
  - |
    AC10 (departments.service.spec.ts): moving a department under a new parent keeps its members and sub-departments under it.
    const moved = await service.updateDepartment(tenantId, platform.id, { parentId: product.id })
    expect(moved.parentId).toBe(product.id)
    const subtree = await service.listDepartments(tenantId)
    expect(subtree.filter((d) => d.parentId === platform.id).map((d) => d.id)).toContain(mobileSubOfPlatform.id)
  - |
    AC11 (departments.service.spec.ts): deleting a department with member employees is blocked.
    await expect(service.deleteDepartment(tenantId, dept.id)).rejects.toBeInstanceOf(ConflictException)
    expect(await service.listDepartments(tenantId)).toContainEqual(expect.objectContaining({ id: dept.id }))
  - |
    AC12 (departments.service.spec.ts): deleting a department with sub-departments is blocked.
    await expect(service.deleteDepartment(tenantId, parentDept.id)).rejects.toBeInstanceOf(ConflictException)
    expect(await service.listDepartments(tenantId)).toContainEqual(expect.objectContaining({ id: parentDept.id }))
  - |
    AC13 (departments.service.spec.ts): deleting succeeds once members and sub-departments are reassigned elsewhere.
    await service.deleteDepartment(tenantId, dept.id)
    expect(await service.listDepartments(tenantId)).not.toContainEqual(expect.objectContaining({ id: dept.id }))
  - |
    AC14 (apps/web/src/lib/orgTree.test.ts): a manager sees an employee in a nested sub-department.
    const view = getMyDepartmentView(departments, employees, 'priya')
    expect(view!.membersByDept.get('platform')!.map((e) => e.id)).toContain('chloe')
  - |
    AC15 (apps/web/src/lib/orgTree.test.ts): a manager does not see an employee outside their subtree.
    const view = getMyDepartmentView(departments, employees, 'priya')
    const shown = [...view!.membersByDept.values()].flat().map((e) => e.id)
    expect(shown).not.toContain('maya')
  - |
    AC16 (departments.service.spec.ts): creating a department with a blank name is rejected and not added.
    await expect(service.createDepartment(tenantId, { name: '   ', managerId: mgrId })).rejects.toBeInstanceOf(BadRequestException)
    expect(await service.listDepartments(tenantId)).toHaveLength(0)
  - |
    AC17 (departments.service.spec.ts): a duplicate sibling department name under the same parent is rejected.
    await service.createDepartment(tenantId, { name: 'Platform', parentId: eng.id, managerId: mgrId })
    await expect(service.createDepartment(tenantId, { name: 'Platform', parentId: eng.id, managerId: mgrId })).rejects.toBeInstanceOf(ConflictException)
assumptions_or_open_questions:
  - |
    The approved prototype's "Employees & Managers" screen only exposes "Edit manager" — there is no
    visible control anywhere in the design for assigning or reassigning which department an employee
    is a direct member of (`employee.departmentId`), even though AC11/AC12/AC13 (delete blocked/allowed
    by membership) and AC14/AC15 (manager's subtree view) depend on that membership existing and
    changing. This plan adds `departmentId` to the `Employee` entity and the delete/subtree logic that
    reads it, but does NOT add a new UI control beyond the approved design — the AC13 precondition
    ("members have been reassigned") is satisfied in backend tests via direct repository writes and in
    e2e tests via the mocked `GET` fixtures, not through a product UI action. Flagging this for the
    reviewer/product owner: a follow-up story likely needs to add an explicit "assign employee to
    department" control (maybe on the employee profile, maybe on this screen) for the feature to be
    usable end-to-end in production.
  - |
    The employee profile's existing free-text `department` field (STORY-012, a fixed string picked from
    `DEPARTMENTS` in apps/web/src/lib/fields.ts) and this story's new `departmentId` (a FK into the real
    department hierarchy) are two separate concepts that will temporarily coexist and may show different
    values for the same employee. This plan does not touch or migrate the old field — reconciling the two
    (or deprecating the free-text one) is left as a follow-up, since it falls under the excluded
    "employee profile fields" scope.
  - |
    "Manager" in AC14/AC15 is not a distinct RBAC role — the `Role` type stays `'hr_admin' | 'employee'`.
    Whether a given signed-in employee manages a department is computed per-request by comparing
    `user.employeeId` to `department.managerId`; anyone authenticated can open "My Department" and simply
    sees the empty state if they don't manage one.
  - |
    Department.managerId is NOT NULL at the database level (every department always has exactly one
    manager per AC4/AC5), while Employee.managerId is nullable (a root employee, e.g. a CEO, has none) —
    confirmed against the approved prototype's fixture data, where "Dana Whitfield" has `managerId: null`.
  - |
    Cycle prevention (a department can't be moved under its own descendant; an employee can't be assigned
    a manager who is themselves one of that employee's direct or indirect reports) is implemented even
    though no single AC names it explicitly, because it mirrors the approved prototype's own
    `populateParentSelect`/`openEditManagerModal` exclusion lists and is necessary for AC8/AC9/AC10 to
    remain well-defined (an org chart or department tree with a cycle has no sensible rendering).
  - |
    GET /departments and the Org Chart/My Department read paths are available to any authenticated role
    (hr_admin or employee), matching the existing unrestricted `GET /employees` — none of these expose
    anything more sensitive than name/title/manager, which the employees list already returns to every
    authenticated role today.
estimated_points: 8
package_dependencies: []
notes: |
  ```mermaid
  flowchart TD
    AppModule[app.module.ts] --> DepartmentsModule[departments.module.ts]
    DepartmentsModule --> DepartmentsController[departments.controller.ts]
    DepartmentsModule --> EmployeeManagerController[employee-manager.controller.ts]
    DepartmentsModule --> DepartmentsService[departments.service.ts]
    DepartmentsService --> DepartmentEntity[department.entity.ts]
    DepartmentsService --> EmployeeEntity[employee.entity.ts]
    Migration[1700000000002 migration] --> DepartmentEntity
    Migration --> EmployeeEntity

    AppTsx[App.tsx] --> DepartmentTreePage
    AppTsx --> EmployeeManagersPage
    AppTsx --> OrgChartPage
    AppTsx --> MyDepartmentPage
    LayoutTsx[Layout.tsx] --> AppTsx
    DepartmentTreePage --> DepartmentFormModal
    DepartmentTreePage --> DeleteDepartmentModal
    EmployeeManagersPage --> EditManagerModal
    DepartmentTreePage --> OrgTree[lib/orgTree.ts]
    MyDepartmentPage --> OrgTree
    OrgChartPage --> OrgTree
    DepartmentTreePage --> ApiClient[lib/apiClient.ts]
    EmployeeManagersPage --> ApiClient
    OrgChartPage --> ApiClient
    MyDepartmentPage --> ApiClient
    ApiClient --> DepartmentsController
    ApiClient --> EmployeeManagerController

    classDef touched fill:#f96,color:#000
    class AppModule,DepartmentsModule,DepartmentsController,EmployeeManagerController,DepartmentsService,DepartmentEntity,EmployeeEntity,Migration,AppTsx,LayoutTsx,DepartmentTreePage,EmployeeManagersPage,OrgChartPage,MyDepartmentPage,DepartmentFormModal,DeleteDepartmentModal,EditManagerModal,OrgTree touched
  ```

  Read the approved prototype at .arc/designs/UAT-14OCT-STORY-013-design.html in full (its inline
  fixture, CSS and render functions) before building the four screens — the scope items above cite
  specific line ranges/function names from it (e.g. tree/org-card CSS at lines 330-395, `renderDeptNode`/
  `renderOrgNode`/`renderMyDepartment` for the per-screen behaviour) rather than re-describing it, so the
  implementer should treat that file as the primary spec for layout, copy and interaction states.
review_focus: |
  In scope: the `departments` CRUD module + validation (duplicate-sibling, blank-name, required-manager,
  cycle-safe re-parenting, membership-aware delete), the `employees/:id/manager` endpoint, and the four
  read/write screens the approved prototype shows. Out of scope (flagged, not silently built): any UI or
  API for assigning/reassigning which department an employee is a direct member of — the prototype
  doesn't show one, so AC11-AC15's "member" preconditions are only satisfiable today via direct data
  writes (tests) or a future story. The riskiest area is the recursive subtree/cycle math
  (`getDescendantDepartmentIds`, `getAllReportIds`, `getMyDepartmentView`) — it's all hand-rolled JS over
  in-memory arrays (no recursive SQL), so an off-by-one in parent/child vs. ancestor/descendant handling
  would silently misplace an employee in the wrong manager's view (AC14/AC15) without an obvious error.
  Reviewers should also hold the line on DTO nuance: `UpdateEmployeeManagerDto.managerId` is intentionally
  non-optional (so omission = 400), while `UpdateDepartmentDto.managerId` is optional-but-non-nullable
  (omission = no change, explicit null = 400) — these look similar but encode different ACs (AC7 vs. the
  "a department always has a manager" invariant) and shouldn't be unified.

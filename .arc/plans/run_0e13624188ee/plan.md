summary: |
  Adds org-structure management on top of the existing employees domain: a nested Department
  tree with exactly one manager per department (create/rename/reparent/delete with
  member/sub-department deletion guards and sibling-name uniqueness), and single-manager
  reporting lines for every employee (assign/reassign, reject a cleared manager). Builds the
  four screens from the approved prototype
  (.arc/designs/UAT-14OCT-STORY-013-design.html) — Department Tree, Employees & Managers, Org
  Chart, My Department (manager subtree view) — wired into the existing comp_api_service
  (NestJS/TypeORM/Postgres) and comp_web_app (React/Vite) via a new `departments` domain module
  and two new employee-assignment endpoints, reusing the existing Layout, Banner, Toast and
  table/field/modal conventions already in the codebase.

scope:
  - description: |
      Add the `departments` table and the two new reporting-line columns on `employees` via a
      new migration, and register the corresponding TypeORM entities.
      - `departments`: id, tenant_id, name, parent_id (nullable self-FK), manager_id (FK to
        employees, not null), created_at, updated_at.
      - `employees.department_id` (nullable FK to departments) and `employees.manager_id`
        (nullable self-FK) — new columns, additive only; the existing free-text
        `employees.department` column from STORY-012 is untouched (see
        assumptions_or_open_questions).
      New entity `Department` mirrors the existing `Employee`/`EmploymentHistoryEntry` style:
      plain `@Column` ids, no TypeORM relation decorators, names not modeled in-ORM beyond
      columns.
    files:
      - services/api/src/database/migrations/1700000000002-create-departments-and-reporting-lines.ts
      - services/api/src/departments/entities/department.entity.ts
      - services/api/src/employees/entities/employee.entity.ts
      - services/api/src/database/data-source.ts
    rationale: |
      Mirrors the existing migration/entity pattern exactly (see
      services/api/src/database/migrations/1700000000000-create-employees-schema.ts and
      services/api/src/employees/entities/employee.entity.ts), so department CRUD and manager
      assignment can be persisted and survive reload (AC9) through the real Postgres-backed
      DataSource rather than any client-side storage.

  - description: |
      New DTOs, validated with class-validator exactly like the existing employee DTOs:
      - `CreateDepartmentDto { name: string (required, non-blank); parentId?: string | null
        (UUID); managerId: string (required UUID) }`
      - `UpdateDepartmentDto { name?: string (non-blank); parentId?: string | null (UUID);
        managerId?: string (UUID) }`
      - `AssignManagerDto { managerId: string (required UUID, not optional) }` — the DTO itself
        enforces AC7 (clearing/omitting is a 400) because the global
        `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` rejects a missing or
        null value for a non-optional `@IsUUID()` field.
      - `AssignDepartmentDto { departmentId: string (required UUID) }`
    files:
      - services/api/src/departments/dto/create-department.dto.ts
      - services/api/src/departments/dto/update-department.dto.ts
      - services/api/src/employees/dto/assign-manager.dto.ts
      - services/api/src/employees/dto/assign-department.dto.ts
    rationale: |
      Matches services/api/src/employees/dto/create-employee.dto.ts and
      update-employee.dto.ts (`@IsString() @IsNotEmpty() @Matches(/\S/, ...)` for required
      text, `@IsOptional()` treating both undefined and null as "skip" for optional UUIDs).

  - description: |
      New `DepartmentsService` (plain class using `DataSource.getRepository`, no cross-service
      injection — same style as `EmployeesService`):
      - `createDepartment(tenantId, dto)`: validates non-blank, trimmed, case-insensitive-unique
        name among siblings (same parentId, including top-level/null) excluding nothing on
        create (AC1, AC2, AC16, AC17), requires `managerId` to resolve to an existing employee
        (AC4), rejects a non-existent `parentId`.
      - `updateDepartment(tenantId, id, dto)`: same name/manager validation (excluding self) for
        rename (AC3) and manager change (AC5); for reparenting (AC10) rejects moving a
        department under itself or one of its own descendants (computed via a `descendantIds`
        walk over all tenant departments) — this mirrors the prototype's own
        `populateParentSelect` exclusion list (design lines 840-848) even though it isn't a
        numbered AC, so a move only ever changes `parentId`, leaving the department's own
        sub-departments' and members' rows untouched (they already point at the moved
        department, so they come along "for free").
      - `deleteDepartment(tenantId, id)`: throws `ConflictException` if any employee has
        `departmentId === id` (AC11) or any department has `parentId === id` (AC12); otherwise
        deletes (AC13).
      - `listDepartments(tenantId)`: flat, tenant-scoped list (AC9 — a fresh read after save
        returns the same data).
      - `getMyDepartment(tenantId, employeeId)`: finds the department (if any) whose
        `managerId === employeeId`, computes its subtree ids, and returns
        `{ departments, employees }` scoped to that subtree only (AC14, AC15) — scoping is by
        the authenticated user's own `employeeId` from the token, never a client-supplied id.
    files:
      - services/api/src/departments/departments.service.ts
      - services/api/src/departments/departments.controller.ts
      - services/api/src/departments/departments.module.ts
      - services/api/src/app.module.ts
    rationale: |
      Routes: `GET /departments` (any authenticated role, read-only reference data needed by
      every screen), `POST /departments` and `PATCH /departments/:id` and `DELETE
      /departments/:id` (`@Roles('hr_admin')`), `GET /departments/my` (any authenticated role
      with an `employeeId`, declared before no competing `:id` GET route exists so no
      Nest route-ordering issue). Controller follows the exact guard/decorator stack already
      used in services/api/src/employees/employees.controller.ts
      (`@UseGuards(CognitoAuthGuard, RolesGuard)`, `@Roles(...)`, `@CurrentUser()`).

  - description: |
      Extend `EmployeesService`/`EmployeesController` with the two new assignment operations
      (kept separate from the existing whitelisted `UpdateEmployeeDto` core-field route so
      org-structure assignment stays out of the explicitly-excluded employee-profile-fields
      surface):
      - `assignManager(tenantId, employeeId, managerId): Promise<Employee>` — rejects
        `managerId === employeeId` and rejects assigning one of the employee's own (direct or
        indirect) reports as their manager via a `getAllReportIds` walk, mirroring the
        prototype's `editManagerModal` exclusion list (design lines 978-985); otherwise sets
        `employee.managerId` and saves (AC6).
      - `assignDepartment(tenantId, employeeId, departmentId): Promise<Employee>` — validates
        the target department exists for the tenant, sets `employee.departmentId` and saves.
        This is the backend capability that lets an HR Admin reassign a department's members
        away before deletion (AC13); see assumptions_or_open_questions for why this ships
        without a new UI control.
      - `createEmployee` is updated to explicitly initialise `departmentId: null, managerId:
        null` alongside the other null defaults, keeping the existing explicit-null style.
      New routes: `PATCH /employees/:id/manager` and `PATCH /employees/:id/department`, both
      `@Roles('hr_admin')`.
    files:
      - services/api/src/employees/employees.service.ts
      - services/api/src/employees/employees.controller.ts
    rationale: |
      Keeps the existing `PATCH /employees/:id` route (UpdateEmployeeDto, `forbidNonWhitelisted:
      true`) exactly as-is — adding `managerId`/`departmentId` to that DTO would silently widen
      an already-shipped, tested endpoint's contract. A dedicated route per action matches the
      codebase's existing pattern (`/employees/me/contact`, `/employees/:id/history`,
      `/pending-change-requests/:id/approve`).

  - description: |
      Add `delete(where)` to the in-memory `FakeRepository` test double (filters out matching
      rows), since `DepartmentsService.deleteDepartment` calls
      `repo.delete({ tenantId, id })` and the sandbox has no real Postgres — the fake must
      mirror TypeORM's `Repository.delete` for `departments.service.spec.ts` and
      `departments.e2e-spec.ts` to run.
    files:
      - services/api/test/support/fake-data-source.ts
    rationale: |
      `FakeDataSource`/`FakeRepository` (services/api/test/support/fake-data-source.ts) today
      only implement `create`/`save`/`find`/`findOne`; this is the minimal addition needed for
      test-infrastructure parity with real TypeORM, not a new abstraction.

  - description: |
      Backend tests (vitest unit + supertest e2e) — one assertion group per numbered AC is in
      the `tests` list below; this scope item is the set of spec files that host them.
    files:
      - services/api/src/departments/departments.service.spec.ts
      - services/api/src/employees/employees.service.spec.ts
      - services/api/test/departments.e2e-spec.ts
      - services/api/test/employees.e2e-spec.ts
    rationale: |
      Matches the existing split: fast in-memory `FakeDataSource`-backed service specs for
      business-rule coverage (uniqueness, cycle prevention, subtree scoping), plus supertest
      e2e specs through `createTestApp()` for role/route/DTO-validation coverage (403s, 400s,
      401), following services/api/src/employees/employees.service.spec.ts and
      services/api/test/employees.e2e-spec.ts.

  - description: |
      Frontend data layer: extend the shared `Employee` type with `departmentId: string | null`
      and `managerId: string | null`, add a `Department` type, and add a small pure-function
      helper module porting the prototype's own tree helpers
      (`getChildren`/`getRootDepts`/`getDescendantDeptIds`/`getAllReportIds`, design lines
      748-770) to typed TS so every page builds the tree/org-chart/subtree the same way the
      approved prototype does:
      ```ts
      export function childrenOf(departments: Department[], parentId: string | null): Department[]
      export function descendantIds(departments: Department[], id: string): string[]
      export function directReports(employees: Employee[], managerId: string | null): Employee[]
      ```
    files:
      - apps/web/src/lib/types.ts
      - apps/web/src/lib/orgTree.ts
      - apps/web/src/lib/orgTree.test.ts
    rationale: |
      Keeps each page component thin (fetch + render) and the tree/sort/filter logic unit
      tested once rather than re-implemented per page, matching how apps/web/src/lib/fields.ts
      and format.ts already centralise shared presentation logic.

  - description: |
      Add an "Org Structure" sidebar section with four links (Department Tree, Employees &
      Managers, Org Chart, My Department — design lines 479-485) to the existing `Layout`
      component, gating the first two behind the signed-in user's `hr_admin` role exactly like
      the existing "Pending changes" link, and register the four new routes in `App.tsx`,
      wrapping the first two in the existing `RequireHrAdmin` wrapper.
    files:
      - apps/web/src/components/Layout.tsx
      - apps/web/src/App.tsx
    rationale: |
      Reuses the existing `Layout`/`RequireHrAdmin`/`NavLink` conventions already in
      apps/web/src/components/Layout.tsx and apps/web/src/App.tsx rather than introducing a
      second sidebar shell — the prototype's own sidebar is reviewer-only static HTML, not a
      component to port 1:1.

  - description: |
      `DepartmentTreePage` (`/org/departments`, HR-Admin-only): renders the nested tree
      (`.org-tree` / `.tree-children` / `.tree-row` with `.tree-name`, `.tree-manager`,
      `.tree-count`, `.tree-actions` — design lines 330-340, 1026-1051) from `GET
      /departments` joined with `GET /employees` for manager names and direct-member counts.
      "+ Add department" and each row's "Add sub-department"/"Edit" open one shared Add/Edit
      department modal (name, parent select excluding self+descendants, manager select) built
      with the app's existing `.modal-backdrop`/`.modal`/`.modal-actions` pattern (already used
      in apps/web/src/routes/PendingChangesPage.tsx, not the prototype's literal
      `.modal-overlay`/`.modal-footer` names — see assumptions_or_open_questions) and the
      shared `.field`/`.input`/`.select`/`.field-error` classes. Client-side validates blank
      name (AC16), duplicate sibling name (AC17) and missing manager (AC4) before submit,
      mirroring the prototype's `validateDept` (design lines 881-901), with the API's own
      validation as a second line of defence. "Delete" opens a confirm modal that shows a
      `Banner kind="danger"` blocking message instead of a confirm button when the department
      still has members or sub-departments (AC11, AC12 — design lines 934-967), or a working
      delete confirmation otherwise (AC13).
    files:
      - apps/web/src/routes/DepartmentTreePage.tsx
      - apps/web/src/routes/DepartmentTreePage.test.tsx
    rationale: |
      Reuses `Layout`, `Banner`, `useToast` and the shared `.table`/`.card`/`.field`/`.modal*`
      classes already in the catalogue; no new shared component is introduced since the
      existing ad hoc modal-in-page pattern already covers this need.

  - description: |
      `EmployeesManagersPage` (`/org/employees-managers`, HR-Admin-only): table of employees
      (Employee, Title, Department, Manager columns — design lines 548-554) each with an "Edit
      manager" action opening a modal with a manager `<select>` that excludes the employee
      themself and all of their current reports (mirrors `populateManagerSelect`/exclusion
      list, design lines 978-985). Saving with no manager selected shows an inline
      `.field-error` and does not call the API (AC7, client-side mirror of
      `AssignManagerDto`'s required field); reassigning replaces the manager entirely in the
      table on success (AC6).
    files:
      - apps/web/src/routes/EmployeesManagersPage.tsx
      - apps/web/src/routes/EmployeesManagersPage.test.tsx
    rationale: |
      Design lines 511-558, 688-708, 969-1023 are the only source for this screen's layout and
      behaviour; reuses `.table`, `.field`, `.select`, existing modal pattern and `useToast`.

  - description: |
      `OrgChartPage` (`/org/chart`, any authenticated role): read-only tree built client-side
      from the existing `GET /employees` response (no new endpoint — every employee already
      carries `managerId`), rendering `.org-card` nodes with name/title/department (design
      lines 342-351, 1068-1089) nested so each employee renders directly beneath their
      manager's card (AC8), using the new `directReports` helper.
    files:
      - apps/web/src/routes/OrgChartPage.tsx
      - apps/web/src/routes/OrgChartPage.test.tsx
    rationale: |
      Deliberately reuses the already-fetched `/employees` list rather than adding a dedicated
      org-chart endpoint, since the data (flat employees with `managerId`) is already complete
      and tenant/role-scoped by the existing route.

  - description: |
      `MyDepartmentPage` (`/org/my-department`, any authenticated role with an `employeeId`):
      calls `GET /departments/my`, groups the returned employees per department (root first,
      then nested, each with a "(sub-department)" label — design lines 1128-1142) with a
      "Reports to" column, or a "You don't manage a department" empty state when the response
      is empty. Drops the prototype's "Viewing as" selector (design lines 634-638,
      1091-1110) — that control exists only so a reviewer can preview multiple fixture
      managers in one static page; the production page is scoped to the signed-in user, so
      there is nothing to pick.
    files:
      - apps/web/src/routes/MyDepartmentPage.tsx
      - apps/web/src/routes/MyDepartmentPage.test.tsx
    rationale: |
      Satisfies AC14/AC15 using the server-computed, auth-scoped subtree from
      `DepartmentsService.getMyDepartment`, so privacy (AC15) is enforced server-side rather
      than by a client-side filter that a modified request could bypass.

  - description: |
      Add the page-specific CSS classes the four new pages need that are not already covered
      by `design-system/tokens.css`/`design-system/prototype-utils.css` or the existing
      apps/web/src/index.css: `.org-tree`, `.tree-children`, `.tree-row`, `.tree-name`,
      `.tree-manager`, `.tree-count`, `.tree-actions`, `.org-card`, `.org-card-name`,
      `.org-card-title`, `.org-card-dept`, `.dept-group-heading`, `.section-note`,
      `.table-scroll`, `.field-help`, `.btn-sm`, `.btn-danger` — ported verbatim (values only,
      referencing existing tokens) from the prototype's page-specific `<style>` block (design
      lines 330-395).
    files:
      - apps/web/src/index.css
    rationale: |
      `.field`, `.field-label`, `.input`, `.select`, `.table`, `.card`, `.chip-*` and `.btn`/
      `.btn-primary`/`.btn-secondary` already exist via
      design-system/prototype-utils.css (confirmed by reading that file); only the
      tree/org-chart/misc classes above are missing from the current app.

  - description: |
      Playwright e2e coverage for the visual/interaction behaviour that's cheapest to verify
      through the browser rather than the API: creating a top-level and a nested department
      (AC1, AC2), the blank-name/duplicate-name/missing-manager inline errors (AC16, AC17,
      AC4), the blocked-vs-successful delete dialog (AC11, AC12), reassigning an employee's
      manager and seeing the old one replaced (AC6), the cleared-manager rejection (AC7), and
      the org chart showing a direct report nested under their manager (AC8) — each test mocks
      `GET /departments` and `GET /employees` via `page.route` the same way
      apps/web/e2e/employee-profile.spec.ts mocks `/employees/u1`.
    files:
      - apps/web/e2e/org-structure.spec.ts
    rationale: |
      Mirrors the existing Playwright coverage style (route-mocked, token-seeded via
      `page.addInitScript`) rather than standing up a live backend for e2e, consistent with
      apps/web/e2e/employee-profile.spec.ts.

tests:
  - |
    AC1 (services/api/src/departments/departments.service.spec.ts):
    ```ts
    it('AC1: creates a top-level department', async () => {
      const dept = await service.createDepartment(tenantId, { name: 'Executive', managerId: mgr.id });
      expect(dept.parentId).toBeNull();
      expect((await service.listDepartments(tenantId)).map((d) => d.id)).toContain(dept.id);
    });
    ```
  - |
    AC2 (departments.service.spec.ts):
    ```ts
    it('AC2: nests a new department under an existing parent', async () => {
      const eng = await service.createDepartment(tenantId, { name: 'Engineering', managerId: mgr.id });
      const platform = await service.createDepartment(tenantId, { name: 'Platform', parentId: eng.id, managerId: mgr2.id });
      expect(platform.parentId).toBe(eng.id);
    });
    ```
  - |
    AC3 (departments.service.spec.ts):
    ```ts
    it('AC3: renames a department', async () => {
      const dept = await service.createDepartment(tenantId, { name: 'Old Name', managerId: mgr.id });
      const updated = await service.updateDepartment(tenantId, dept.id, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });
    ```
  - |
    AC4 (departments.service.spec.ts):
    ```ts
    it('AC4: rejects creating a department with no manager', async () => {
      await expect(service.createDepartment(tenantId, { name: 'No Manager' } as any)).rejects.toBeInstanceOf(BadRequestException);
      expect(await service.listDepartments(tenantId)).toHaveLength(0);
    });
    ```
  - |
    AC5 (departments.service.spec.ts):
    ```ts
    it('AC5: changing manager leaves exactly one, new, manager', async () => {
      const dept = await service.createDepartment(tenantId, { name: 'Eng', managerId: m.id });
      const updated = await service.updateDepartment(tenantId, dept.id, { managerId: n.id });
      expect(updated.managerId).toBe(n.id);
    });
    ```
  - |
    AC6 (services/api/src/employees/employees.service.spec.ts):
    ```ts
    it('AC6: reassigning a manager replaces the old one entirely', async () => {
      await service.assignManager(tenantId, e.id, m.id);
      const updated = await service.assignManager(tenantId, e.id, n.id);
      expect(updated.managerId).toBe(n.id);
      expect(updated.managerId).not.toBe(m.id);
    });
    ```
  - |
    AC7 (services/api/test/employees.e2e-spec.ts, since the rejection is the DTO/ValidationPipe
    boundary):
    ```ts
    it('AC7: clearing a manager is rejected and the manager is unchanged', async () => {
      await http().patch(`/employees/${e.id}/manager`).set('Authorization', hr).send({ managerId: null }).expect(400);
      const after = await http().get(`/employees/${e.id}`).set('Authorization', hr);
      expect(after.body.managerId).toBe(m.id);
    });
    ```
  - |
    AC8 (apps/web/src/routes/OrgChartPage.test.tsx):
    ```ts
    it('AC8: a direct report renders nested under their manager', async () => {
      mockApi({ 'GET /employees': [dana, priya] }) // priya.managerId === dana.id
      renderAt(<OrgChartPage />, '/org/chart', '/org/chart')
      const managerLi = (await screen.findByText('Dana Whitfield')).closest('li')!
      expect(within(managerLi).getByText('Priya Natarajan')).toBeInTheDocument()
    });
    ```
  - |
    AC9 (services/api/test/departments.e2e-spec.ts):
    ```ts
    it('AC9: the saved tree and managers are unchanged across two independent reads', async () => {
      await http().post('/departments').set('Authorization', hr).send({ name: 'Ops', managerId: a.id }).expect(201)
      const first = await http().get('/departments').set('Authorization', hr)
      const second = await http().get('/departments').set('Authorization', hr)
      expect(second.body).toEqual(first.body)
    });
    ```
  - |
    AC10 (departments.service.spec.ts):
    ```ts
    it('AC10: moving a department keeps its employees and sub-departments nested under it at the new position', async () => {
      const eng = await service.createDepartment(tenantId, { name: 'Engineering', managerId: priya.id });
      const platform = await service.createDepartment(tenantId, { name: 'Platform', parentId: eng.id, managerId: marcus.id });
      await employeesService.assignDepartment(tenantId, liam.id, eng.id);
      const product = await service.createDepartment(tenantId, { name: 'Product', managerId: ethan.id });
      await service.updateDepartment(tenantId, eng.id, { parentId: product.id });
      const all = await service.listDepartments(tenantId);
      expect(all.find((d) => d.id === eng.id)?.parentId).toBe(product.id);
      expect(all.find((d) => d.id === platform.id)?.parentId).toBe(eng.id);
      expect((await employeesService.getEmployee(tenantId, liam.id)).departmentId).toBe(eng.id);
    });
    ```
  - |
    AC11 (departments.service.spec.ts):
    ```ts
    it('AC11: blocks deleting a department with an unreassigned member', async () => {
      const dept = await service.createDepartment(tenantId, { name: 'HasMembers', managerId: m.id });
      await employeesService.assignDepartment(tenantId, e.id, dept.id);
      await expect(service.deleteDepartment(tenantId, dept.id)).rejects.toBeInstanceOf(ConflictException);
      expect((await service.listDepartments(tenantId)).some((d) => d.id === dept.id)).toBe(true);
    });
    ```
  - |
    AC12 (departments.service.spec.ts):
    ```ts
    it('AC12: blocks deleting a department with an unreassigned sub-department', async () => {
      const parent = await service.createDepartment(tenantId, { name: 'Parent', managerId: m.id });
      await service.createDepartment(tenantId, { name: 'Child', parentId: parent.id, managerId: m.id });
      await expect(service.deleteDepartment(tenantId, parent.id)).rejects.toBeInstanceOf(ConflictException);
    });
    ```
  - |
    AC13 (departments.service.spec.ts):
    ```ts
    it('AC13: deletes once all members and sub-departments are reassigned', async () => {
      const dept = await service.createDepartment(tenantId, { name: 'Temp', managerId: m.id });
      await employeesService.assignDepartment(tenantId, e.id, dept.id);
      await employeesService.assignDepartment(tenantId, e.id, other.id);
      await service.deleteDepartment(tenantId, dept.id);
      expect((await service.listDepartments(tenantId)).some((d) => d.id === dept.id)).toBe(false);
    });
    ```
  - |
    AC14 (departments.service.spec.ts):
    ```ts
    it('AC14: a manager sees employees in a nested sub-department', async () => {
      const { employees } = await service.getMyDepartment(tenantId, priya.id); // priya manages Engineering; chloe is in Platform, nested under it
      expect(employees.map((e) => e.id)).toContain(chloe.id);
    });
    ```
  - |
    AC15 (departments.service.spec.ts):
    ```ts
    it('AC15: a manager does not see an employee outside their subtree', async () => {
      const { employees } = await service.getMyDepartment(tenantId, priya.id); // maya is in Product, a sibling tree
      expect(employees.map((e) => e.id)).not.toContain(maya.id);
    });
    ```
  - |
    AC16 (departments.service.spec.ts):
    ```ts
    it('AC16: rejects a blank department name', async () => {
      await expect(service.createDepartment(tenantId, { name: '   ', managerId: m.id })).rejects.toBeInstanceOf(BadRequestException);
      expect(await service.listDepartments(tenantId)).toHaveLength(0);
    });
    ```
  - |
    AC17 (departments.service.spec.ts):
    ```ts
    it('AC17: rejects a duplicate sibling name under the same parent', async () => {
      const eng = await service.createDepartment(tenantId, { name: 'Engineering', managerId: m.id });
      await service.createDepartment(tenantId, { name: 'Platform', parentId: eng.id, managerId: m.id });
      await expect(
        service.createDepartment(tenantId, { name: 'Platform', parentId: eng.id, managerId: m.id }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect((await service.listDepartments(tenantId)).filter((d) => d.name === 'Platform' && d.parentId === eng.id)).toHaveLength(1);
    });
    ```

assumptions_or_open_questions:
  - |
    The project's `Role` type is `'hr_admin' | 'employee'` only (services/api/src/employees/employee-fields.ts)
    — there is no dedicated "Manager" role. AC14/AC15's "Manager" is read as any employee who
    happens to be set as a department's `managerId`, viewing `/org/my-department` as their own
    (`employee` or `hr_admin`) authenticated self via `GET /departments/my`, which is scoped by
    the token's `employeeId` and never a client-supplied id. Flagging in case a distinct RBAC
    role was actually intended.
  - |
    The approved prototype's Employees & Managers screen has no control for reassigning an
    individual employee's *department* (only "Edit manager" per row — design lines 548-558), yet
    AC10-AC13 require departments and employees to be reassignable away from a department before
    it can be deleted. This plan adds the backend capability
    (`PATCH /employees/:id/department`, `EmployeesService.assignDepartment`) and covers AC10-13
    with service/API tests, but deliberately does not invent a UI screen the prototype doesn't
    show. If a UI control for this is wanted, that's new design work and should come back through
    the design step rather than being guessed here.
  - |
    The prototype's "My Department" screen includes a "Viewing as" dropdown so a reviewer can
    preview several fixture managers from one static page (design lines 634-638, 1091-1110).
    That's reviewer-only chrome, not production behaviour — the real page has no such selector
    and is always scoped to the signed-in user.
  - |
    `employees.department` (free text, from STORY-012's core fields) and the new
    `employees.department_id` (structured FK into the new `departments` tree) are two
    deliberately separate concepts on the same entity; this story does not touch or migrate the
    former.
  - |
    The prototype's modal markup uses `.modal-overlay`/`.modal`/`.modal-footer`; production code
    reuses the app's own already-established `.modal-backdrop`/`.modal`/`.modal-actions` pattern
    (apps/web/src/routes/PendingChangesPage.tsx) instead, since that's the existing in-repo
    convention for this exact component shape — only the visual result (overlay + card + footer
    actions) is taken from the prototype, not its literal class names.
  - |
    Cycle prevention (an employee can't be assigned as their own or their own report's manager;
    a department can't be moved under itself or its own sub-department) isn't a separately
    numbered AC, but is explicitly shown in the prototype's own dropdown-exclusion logic (design
    lines 840-848, 978-985), so it's implemented and tested as part of faithfully building the
    approved design rather than as speculative extra scope.

estimated_points: 8

package_dependencies: []

notes: |
  No new third-party packages: class-validator, @nestjs/typeorm, supertest, vitest,
  @testing-library/react and @playwright/test are all already dependencies used by the existing
  employees domain and its tests.

  ```mermaid
  flowchart TD
    AppModule[AppModule] --> DepartmentsModule[DepartmentsModule new]
    AppModule --> EmployeesModule[EmployeesModule]
    DepartmentsModule --> DepartmentsController[DepartmentsController new]
    DepartmentsController --> DepartmentsService[DepartmentsService new]
    DepartmentsService --> DepartmentEntity[Department entity new]
    DepartmentsService --> EmployeeEntity[Employee entity touched]
    EmployeesModule --> EmployeesController[EmployeesController touched]
    EmployeesController --> EmployeesService[EmployeesService touched]
    EmployeesService --> EmployeeEntity
    AppTsx[App.tsx touched] --> Layout[Layout.tsx touched]
    AppTsx --> DeptTreePage[DepartmentTreePage new]
    AppTsx --> EmpMgrPage[EmployeesManagersPage new]
    AppTsx --> OrgChartPage[OrgChartPage new]
    AppTsx --> MyDeptPage[MyDepartmentPage new]
    DeptTreePage --> ApiClient[apiClient]
    EmpMgrPage --> ApiClient
    OrgChartPage --> ApiClient
    MyDeptPage --> ApiClient
    ApiClient --> DepartmentsController
    ApiClient --> EmployeesController

    classDef touched fill:#f96,color:#000
    class DepartmentsModule,DepartmentsController,DepartmentsService,DepartmentEntity,EmployeeEntity,EmployeesController,EmployeesService,AppTsx,Layout,DeptTreePage,EmpMgrPage,OrgChartPage,MyDeptPage touched
  ```

review_focus: |
  In scope: the `departments` table/entity/migration, department CRUD with name/manager/cycle
  validation and reparent/delete-guard logic, employee manager assignment (required, no clearing,
  no self/own-report cycles), employee department reassignment as a backend-only capability, and
  the four read/write screens from the approved prototype. Out of scope: any other employee
  profile field, documents, and a new UI control for reassigning an employee's department (see
  assumptions_or_open_questions — flagged, not silently added). Riskiest area: the
  subtree/descendant-id and report-chain recursion used for cycle prevention, reparenting and the
  manager's subtree view — an off-by-one there either lets a cycle form or leaks/hides the wrong
  employees in AC14/AC15. Also check that `GET /departments/my` is scoped from the authenticated
  user's own `employeeId` server-side (not a client-supplied id) — that's the actual privacy
  boundary for AC15, not any client-side filtering. Deliberate, non-obvious decision: this adds a
  second, structured "department" concept (`departmentId`/`departments` table) alongside the
  existing free-text `department` string field from STORY-012 — that's intentional, not
  duplication to clean up.

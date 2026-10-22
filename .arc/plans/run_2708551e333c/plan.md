summary: |
  Adds admin CRUD for service types (name, description, active flag) as a new `service-types`
  domain in `services/api` (entity, DTOs, service, controller, module, migration) plus a new
  admin console page in `apps/web` at `/service-types`, built from the approved prototype
  (`UAT-14OCT-STORY-055-design.html`). This is a revision pass: re-reading the current code
  turned up fresh drift since the plan was last written, on top of what the previous revision
  already fixed. `admin` is confirmed still present in both `services/api/src/auth/roles.ts`
  (`ROLES = ['hr_admin', 'employee', 'reporter', 'customer', 'admin']`) and
  `apps/web/src/lib/auth.ts` (`Role` union and `ROLES` array), so the role-plumbing work is
  still correctly out of scope. The migration-timestamp slot has moved again: the prior
  revision picked `1700000000005` after `1700000000004` was claimed by
  `AddDefectPriorityAssignee1700000000004`, but `1700000000005` is now ALSO taken, by
  `CreatePageReviewsSchema1700000000005` (landed with UAT-14OCT-STORY-050, "Page Instance
  Inventory & Tracking", confirmed present under `services/api/src/database/migrations/` and
  registered in `data-source.ts` this revision) — so the new service-types migration now moves
  to `1700000000006`, appended after that entry. `data-source.ts` also now registers a sixth
  entity (`PageReview`) and `app.module.ts` now imports a fifth module (`InventoryModule`)
  alongside `DatabaseModule`/`EmployeesModule`/`DefectsModule`/`CustomersModule` — both
  confirmed by reading the files directly this revision, and both accounted for below. A
  citation fix: `.modal`/`.modal-backdrop`/`.modal-actions` are defined directly in
  `apps/web/src/index.css` (confirmed, lines in the "Page-level additions" section), not in
  `design-system/prototype-utils.css` as an earlier draft said — `prototype-utils.css` supplies
  `.table`/`.chip-success`/`.chip-warning`/`.field`/`.field-label`/`.input`/`.select`/`.textarea`
  only (confirmed by grep). Everything else previously confirmed still holds unchanged:
  `App.tsx`'s customer branch, `RequireHrAdmin` wrapper shape, `EmployeeDirectoryPage`/
  `PendingChangesPage` UI patterns, the `FakeDataSource`/`createTestApp`/`tokenFor` test
  harness, and the design prototype's content and fixture data (re-read in full this revision).
  Admins get full CRUD including toggling active/inactive; `GET /service-types` is role-filtered
  (admin sees everything including inactive rows so they can reactivate them; customer sees only
  active rows), which is how AC4/AC6 are verified without building a separate customer-facing
  browsing screen (that surface belongs to the sibling story per the design's own header
  comment). STORY-054's `bookings` table (migration `1700000000003-create-bookings-schema.ts`,
  re-read this revision) has a `service_type` column constrained by a hardcoded Postgres
  `CHECK (service_type IN ('Faucet repair','Drain cleaning','Water heater install','AC
  tune-up'))` with no foreign key to any catalog table — the same four names as this story's
  design fixture. This plan does not touch that table or constraint. Beyond the seven stated
  ACs, this plan adds the edge cases a real multi-tenant CRUD surface needs: tenant-scoped
  404s, idempotent activate/deactivate, malformed-input and malformed-id handling, clearing a
  description back to empty, the admin search/no-matches/empty-catalog states the design shows,
  a duplicate-name conflict, and a check that user-entered text can never be interpreted as
  markup.
scope:
  - description: |
      New `ServiceType` TypeORM entity and migration: `id` (uuid pk), `tenant_id` (uuid),
      `name` (text), `description` (text, nullable), `active` (boolean, default true),
      `created_at`/`updated_at`. A case-insensitive unique index on `(tenant_id, lower(name))`
      is a database-level safety net for the duplicate-name rule under concurrent writes
      (mirrors the existing `uq_pending_change_requests_open` partial-unique-index pattern,
      confirmed in `1700000000001-unique-pending-change-request.ts`), with the service layer
      doing the real, case-insensitive, self-excluding duplicate check used for the 409 path.
      No `@IsString`-only max-length cap is added — nothing in the codebase's existing text
      columns (`Defect.title`/`description`, `Employee.fullName`) does this either.

      The migration timestamp must be `1700000000006`, not `1700000000005` — that slot is now
      taken by `services/api/src/database/migrations/1700000000005-create-page-reviews-schema.ts`
      (`CreatePageReviewsSchema1700000000005`, confirmed present by reading the migrations
      directory directly during this revision; `1700000000003` and `1700000000004` are also
      taken, by STORY-054's `CreateBookingsSchema1700000000003` and
      `AddDefectPriorityAssignee1700000000004`). `data-source.ts` is updated to list
      `ServiceType` alongside the already-registered `Employee`, `EmploymentHistoryEntry`,
      `PendingChangeRequest`, `Defect`, `Booking`, `PageReview` entities (six, confirmed by
      reading `data-source.ts` directly this revision), and the new migration last in the
      `migrations` array, after `CreatePageReviewsSchema1700000000005` (migrations run in array
      order).

      Follows the `Defect`/`defects` migration's exact shape (`PrimaryGeneratedColumn('uuid')`,
      `pgcrypto`/`gen_random_uuid()`, snake_case `@Column({ name: ... })`, confirmed by reading
      `defect.entity.ts` and `1700000000002-create-defects-schema.ts` directly) so the new
      table fits existing conventions.
    files:
      - services/api/src/service-types/entities/service-type.entity.ts
      - services/api/src/database/migrations/1700000000006-create-service-types-schema.ts
      - services/api/src/database/data-source.ts
    rationale: |
      `data-source.ts` is the single place entities/migrations are registered for both the app
      and the TypeORM CLI — confirmed by reading its current content during this revision,
      which now lists six entities and six migrations
      (`CreateEmployeesSchema1700000000000` through `CreatePageReviewsSchema1700000000005`).
  - description: |
      `ServiceTypesService` with `createServiceType`, `updateServiceType`, `setStatus`,
      `listServiceTypes(tenantId, role)`. Duplicate-name check loads all rows for the tenant
      and compares `name.trim().toLowerCase()` (excluding the row's own id on update) — same
      in-JS-filter approach as `EmployeesService.listEmployees`'s in-JS sort, so it works
      unchanged against both `FakeDataSource` (confirmed this revision to only support
      `find`/`findOne`/`save` with exact-equality `where` matching, no `ILIKE`) and real
      Postgres. `listServiceTypes` returns all rows for `role === 'admin'` and only
      `active === true` rows for `role === 'customer'`, sorted by name.

      A private, tenant-scoped loader backs both `updateServiceType` and `setStatus` so a
      wrong-tenant or unknown id 404s instead of leaking whether the row exists elsewhere —
      the same not-found behavior as `EmployeesService`'s private `loadEmployee` (that method's
      own signature additionally takes a `Manager`/`lock` for transactional field-history
      writes, which service types don't need, so this is a simpler two-argument version with
      the same tenant-scoping/`NotFoundException` behavior, not an identical signature):
      ```ts
      private async loadServiceType(tenantId: string, id: string): Promise<ServiceType> {
        const row = await this.dataSource.getRepository(ServiceType).findOne({ where: { tenantId, id } });
        if (!row) throw new NotFoundException('Service type not found');
        return row;
      }
      ```
      `setStatus` is idempotent — setting `active` to the value it already has just saves and
      returns the unchanged row rather than throwing, since a double-click or a second browser
      tab retrying the same action is a normal, non-error case:
      ```ts
      async setStatus(tenantId: string, id: string, active: boolean): Promise<ServiceType> {
        const row = await this.loadServiceType(tenantId, id);
        row.active = active;
        return this.dataSource.getRepository(ServiceType).save(row);
      }
      ```
      `listServiceTypes`:
      ```ts
      async listServiceTypes(tenantId: string, role: Role): Promise<ServiceType[]> {
        const rows = await this.dataSource.getRepository(ServiceType).find({ where: { tenantId } });
        const visible = role === 'admin' ? rows : rows.filter((r) => r.active);
        return visible.sort((a, b) => a.name.localeCompare(b.name));
      }
      ```
    files:
      - services/api/src/service-types/service-types.service.ts
      - services/api/src/service-types/service-types.service.spec.ts
    rationale: |
      Mirrors `EmployeesService`/`DefectsService`'s constructor-injected `DataSource` style (no
      repository providers) and `ConflictException`/`NotFoundException` usage already
      established for "already in use" (`submitChangeRequest`) and "not found" (`loadEmployee`)
      cases — confirmed by re-reading `employees.service.ts` directly during this revision.
      `Role` imports from `services/api/src/auth/roles.ts`, which already includes `'admin'`
      (confirmed, no change needed there).
  - description: |
      DTOs: `UpsertServiceTypeDto` (`name` required non-blank with message
      `'Enter a name for this service type.'`, `description` optional string — explicitly
      allowing `description: ''` or `description: null` on update to clear an existing
      description back to empty) shared by create and update, and
      `UpdateServiceTypeStatusDto` (`active: boolean`, `@IsBoolean()` — a non-boolean or
      missing `active` is a 400).

      Create and edit use the exact same two-field form in the approved design (one modal,
      "Save service type" vs "Save changes"), so one DTO class for both avoids a
      near-duplicate `UpdateServiceTypeDto`. Validation decorators/messages copy
      `CreateDefectDto`'s confirmed pattern:
      ```ts
      @IsString({ message: 'Enter a name for this service type.' })
      @IsNotEmpty({ message: 'Enter a name for this service type.' })
      @Matches(/\S/, { message: 'Enter a name for this service type.' })
      name!: string;
      ```
    files:
      - services/api/src/service-types/dto/upsert-service-type.dto.ts
      - services/api/src/service-types/dto/update-service-type-status.dto.ts
    rationale: |
      Same `@IsString`/`@IsNotEmpty`/`@Matches` triple-decoration pattern already used on
      `CreateDefectDto`'s text fields, so whichever validator fails first still shows the
      right user-facing message.
  - description: |
      `ServiceTypesController` at `/service-types`: `POST /` and `PATCH /:id` restricted to
      `@Roles('admin')`, `PATCH /:id/status` (body `{ active }`) restricted to
      `@Roles('admin')`, `GET /` open to `@Roles('admin', 'customer')` (service layer does the
      visibility filtering). All `:id` params use `ParseUUIDPipe` (same as
      `EmployeesController`/`DefectsController`, confirmed in `defects.controller.ts`), so a
      malformed id in the URL is a 400 before the service layer runs at all.
      `ServiceTypesModule` wires it up and is registered in `AppModule` alongside the current
      full import list — `DatabaseModule`, `EmployeesModule`, `DefectsModule`,
      `CustomersModule`, `InventoryModule` (confirmed this is the current full list, including
      `InventoryModule` which was added since the prior draft of this plan, by re-reading
      `app.module.ts` directly this revision).
    files:
      - services/api/src/service-types/service-types.controller.ts
      - services/api/src/service-types/service-types.module.ts
      - services/api/src/app.module.ts
    rationale: |
      Matches `DefectsController`/`EmployeesController`'s confirmed
      `@UseGuards(CognitoAuthGuard, RolesGuard)` + per-route `@Roles(...)` style exactly
      (confirmed by reading `defects.controller.ts` directly), including `ParseUUIDPipe` on
      `:id`, importing the same `../auth/cognito-auth.guard`, `../auth/current-user.decorator`,
      `../auth/roles.decorator`, `../auth/roles.guard`, `../auth/auth-user` modules those
      controllers already import. No auth-module changes are needed: `admin` already exists in
      `ROLES`/`Role` on both the API and web sides.
  - description: |
      `services/api/test/service-types.e2e-spec.ts`: full-stack HTTP tests against the fake
      in-memory `DataSource`, one `it` per AC plus edge cases, following
      `defects.e2e-spec.ts`'s confirmed `createTestApp()`/`tokenFor({ sub, role })` pattern
      with `admin` and `customer` tokens (and a second tenant id for the isolation test).

      `tokenFor` (in `test/support/create-test-app.ts`, re-read this revision) spreads caller
      claims over a default `{ 'custom:tenant_id': TENANT, ...claims }` — overriding the
      tenant for the isolation test therefore requires passing the literal key
      `'custom:tenant_id'`, not `tenant_id`:
      ```ts
      const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';
      const otherAdmin = `Bearer ${tokenFor({ sub: 'adm-2', role: 'admin', 'custom:tenant_id': OTHER_TENANT })}`;
      ```
    files:
      - services/api/test/service-types.e2e-spec.ts
    rationale: |
      `FakeDataSource`/`createTestApp` already support arbitrary role/tenant claims (no change
      needed) since `CognitoAuthGuard` only checks `ROLES.includes(role)` and `tokenFor`
      spreads caller-supplied claims over the default tenant id — confirmed again this
      revision by re-reading `test/support/create-test-app.ts` and
      `test/support/fake-data-source.ts` directly, both unchanged from the prior pass.
  - description: |
      New admin console page `ServiceTypesPage` at route `/service-types`: search input
      (reusing the existing `.search-row` pattern from `EmployeeDirectoryPage`, not the
      prototype's icon-in-input `.search-field` decoration, to stay consistent with the one
      search control already shipped) filtering rows by name or description substring
      case-insensitively, `.table` listing name/description/status chip
      (`.chip-success`/`.chip-warning`)/row actions (Edit + Deactivate-or-Activate), an inline
      create/edit modal and an inline deactivate-confirmation modal built from the existing
      `.modal-backdrop`/`.modal`/`.modal-actions` classes already used by
      `PendingChangesPage`'s reject-confirmation modal (confirmed this revision: these three
      classes are defined directly in `apps/web/src/index.css`, not in
      `design-system/prototype-utils.css` — that file only supplies
      `.table`/`.chip-success`/`.chip-warning`/`.field`/`.field-label`/`.input`/`.select`/
      `.textarea`, confirmed by grep this revision). No new modal component — this codebase
      builds modals inline per-page. Loading state reuses the existing
      `.skeleton-row`/`.skeleton-line` classes (`EmployeeDirectoryPage`'s pattern). Two
      distinct empty states reuse `.empty-state`, mirroring `EmployeeDirectoryPage`'s own
      no-service-types-yet vs no-search-matches split: "No service types yet" vs "No service
      types match "{query}"" with a Clear search button.

      The failed-load state reuses the existing `Banner` component (`apps/web/src/components/
      Banner.tsx`, re-read this revision — its API is exactly `kind`/`title`/`children`) with
      `kind="danger"` plus a `.btn-secondary` Retry button, matching `EmployeeDirectoryPage`'s
      exact error-state pattern — not the design prototype's bespoke `.catalog-error` block
      (confirmed present in the prototype's inline `<style>`, specific to the standalone HTML
      prototype, not how this codebase renders fetch failures elsewhere). `ServiceType` is
      added to `apps/web/src/lib/types.ts` alongside the existing interfaces there — confirmed
      this revision the current full exported set is `Employee`, `HistoryEntry`,
      `ChangeRequest`, `Booking`, `Defect`, `DefectSeverity`, `TemplateType`, `ReviewResult`,
      `InventoryEntry` (the last three landed with STORY-050 since the plan's prior draft).

      The prototype's "Viewing as" role switcher, "Simulate a failed load" button, and
      `.search-field` icon decoration (confirmed present in the design's own inline `<style>`
      and script, re-read in full this revision) are design/review-tooling artifacts, not
      production behavior, and are intentionally not built — production error state triggers
      on a real fetch failure, and the admin/customer distinction comes from the signed-in
      user's real Cognito-issued role via `useAuth()`. Name and description are rendered as
      plain React children (never `dangerouslySetInnerHTML`), so a service type whose name or
      description contains `<`/`>`/script-like text is always shown as literal text.

      Deactivate confirmation copy (lifted verbatim from the prototype's
      `#deactivate-modal` markup) and toasts:
      - Confirm dialog body: `"{name}" will no longer be listed to customers when booking. You
        can reactivate it anytime.`
      - Toasts: `Service type created`, `Service type updated`,
        `Marked inactive — customers won't see it when booking`, `Now visible to customers
        again`.

      This page does not do its own role-gating (no internal `if (auth?.role !== 'admin')`
      check) — that responsibility lives entirely in the `RequireAdmin` route wrapper in
      `App.tsx` (next scope item), matching how `NewEmployeeProfilePage`/
      `EditEmployeeProfilePage`/`PendingChangesPage` have no internal role checks of their own
      either.
    files:
      - apps/web/src/routes/ServiceTypesPage.tsx
      - apps/web/src/routes/ServiceTypesPage.test.tsx
      - apps/web/src/lib/types.ts
    rationale: |
      Follows `PendingChangesPage.tsx` (list + inline confirm modal + `useAsync` + `useToast`)
      and `NewEmployeeProfilePage.tsx` (client-side required-field check, server error
      surfaced near the field) conventions already in the codebase. The search/dual-empty-state
      behavior is carried over 1:1 from `EmployeeDirectoryPage`, which already solves exactly
      this for a sibling list page.
  - description: |
      Add a `Service Catalog` sidebar section with a `Service types` link to the shared
      `Layout.tsx` nav, inserted after the existing "QA Tracker" section and before
      "Self-service" — matching the design's sidebar order (`HR Console` → `QA Tracker` →
      `Service Catalog`; the design has no "Self-service" section since it doesn't model that
      part of the real app). Confirmed this revision the current `Layout.tsx` nav order is
      `HR Console` (Employees, Pending changes for HR) → `QA Tracker` (Defects, Page
      inventory — the latter landed with STORY-050 since the prior draft) → `Self-service` (My
      profile); the new section's insertion point is unaffected by that addition. The link is
      always rendered unconditionally, the same as the existing "Employees"/"Defects"/"Page
      inventory" links — the sidebar doesn't change by role, only the content area does.

      Gate the `/service-types` route in `App.tsx` with a new `RequireAdmin` wrapper that
      renders `AccessRestricted` for non-admin roles, copying the existing `RequireHrAdmin`
      wrapper's shape exactly (re-read and confirmed unchanged this revision):
      ```tsx
      function RequireAdmin({ title, message, children }: { title: string; message: string; children: ReactNode }) {
        const auth = useAuth()
        if (auth?.role === 'admin') return <>{children}</>
        return (
          <Layout title={title}>
            <AccessRestricted message={message} />
          </Layout>
        )
      }
      ```
      This route is registered in the non-customer branch of `App.tsx` (the branch already
      guarded by `if (auth.role === 'customer') { ... }` returning early with its own separate
      route tree, confirmed unchanged this revision) — a customer visiting `/service-types`
      never reaches `RequireAdmin` at all; they hit that branch's `*` fallback
      (`CustomerAccessDeniedPage`, "Access denied").

      Extend `App.test.tsx`'s existing parametrized tests. Re-reading `App.test.tsx` this
      revision confirms its exact current arrays:
      - the AC4 array is `it.each(['/employees', '/employees/new', '/defects/new', '/me',
        '/pending-changes', '/nowhere'])('AC4: a logged-in customer sees Access denied on
        %s...')` — add `/service-types` to it.
      - add a new test mirroring the existing AC3 array (`it.each(['/employees/new',
        '/employees/u1/edit', '/pending-changes'])`), but for `/service-types` against a
        non-admin role:
      ```ts
      it('a non-admin sees access restricted on /service-types and nothing is requested', () => {
        signIn('employee', 'u2')
        const api = mockApi({})
        renderApp('/service-types')
        expect(screen.getByText('Access restricted')).toBeInTheDocument()
        expect(api.mock.calls.filter(([, i]) => i?.method && i.method !== 'GET')).toHaveLength(0)
      })
      ```
    files:
      - apps/web/src/components/Layout.tsx
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
    rationale: |
      `RequireHrAdmin` already establishes this exact pattern for a role-gated page; copying
      it keeps `/service-types` consistent rather than inventing a parameterised generic
      version for a single new caller. Role-gating assertions belong in `App.test.tsx` because
      that's where every other role-gated route's behavior is actually tested in this codebase
      today — no individual page's own test file asserts "Access restricted"/"Access denied".
  - description: |
      CSS additions to `apps/web/src/index.css` for the two things the existing stylesheet
      doesn't already cover (confirmed absent by re-reading the file in full this revision):
      `.desc-cell`/`.desc-cell.is-empty` (muted/italic empty-description cell, per the design's
      own `.desc-cell` rule) and `.row-actions` (inline-flex gap for the Edit/
      Deactivate-or-Activate button pair, per the design's own `.row-actions` rule).
      Everything else needed (`.table`, `.chip-success`/`.chip-warning`, `.modal`/
      `.modal-backdrop`/`.modal-actions`, `.field`/`.input`/`.textarea`, `.empty-state`,
      `.skeleton-row`/`.skeleton-line`, `.search-row`) already exists in either
      `design-system/prototype-utils.css` or `apps/web/src/index.css` itself (confirmed this
      revision, split as described in the scope item above) and is reused as-is.
    files:
      - apps/web/src/index.css
    rationale: |
      Keeps new CSS to only the two classes the design introduces that have no existing
      equivalent, instead of re-adding styles (search-field icon, bespoke modal shell, bespoke
      skeleton rows, bespoke error block) the production app already solved differently.
tests:
  - "`service-types.service.spec.ts` (AC1): `createServiceType` trims the name, stores a blank/whitespace description as `null`, and defaults `active` to `true`: `expect(await service().createServiceType('t', { name: '  Faucet repair  ', description: '  ' })).toMatchObject({ tenantId: 't', name: 'Faucet repair', description: null, active: true })`."
  - "`service-types.service.spec.ts` (duplicate-name rule, create): a name already used by another row in the tenant is rejected case-insensitively: `await svc.createServiceType('t', { name: 'Drain cleaning' }); await expect(svc.createServiceType('t', { name: 'drain CLEANING' })).rejects.toThrow(ConflictException)`."
  - "`service-types.service.spec.ts` (AC2/AC3): `updateServiceType` changes name and description: `expect(await svc.updateServiceType('t', created.id, { name: 'AC tune-up (seasonal)', description: 'New' })).toMatchObject({ name: 'AC tune-up (seasonal)', description: 'New' })`."
  - "`service-types.service.spec.ts` (duplicate-name rule, update): renaming to another row's name is rejected, but keeping its own name while changing description is allowed: `await expect(svc.updateServiceType('t', a.id, { name: 'drain cleaning' })).rejects.toThrow(ConflictException)` then `await expect(svc.updateServiceType('t', a.id, { name: 'Faucet repair', description: 'x' })).resolves.toMatchObject({ description: 'x' })`."
  - "`service-types.service.spec.ts` (AC4/AC6/AC7): `setStatus` flips `active`, and `listServiceTypes` filters by role: `await svc.setStatus('t', created.id, false); expect(await svc.listServiceTypes('t', 'customer')).toEqual([])`, `expect(await svc.listServiceTypes('t', 'admin')).toMatchObject([{ active: false }])`, then `await svc.setStatus('t', created.id, true); expect(await svc.listServiceTypes('t', 'customer')).toHaveLength(1)`."
  - "`service-types.service.spec.ts` (AC7, empty catalog): with nothing created for a tenant, `expect(await svc.listServiceTypes('t', 'customer')).toEqual([])`."
  - "`service-types.service.spec.ts` (edge case — not found): updating or changing status of an unknown id throws `NotFoundException`: `await expect(svc.updateServiceType('t', 'no-such-id', { name: 'X' })).rejects.toThrow(NotFoundException)` and `await expect(svc.setStatus('t', 'no-such-id', false)).rejects.toThrow(NotFoundException)`."
  - "`service-types.service.spec.ts` (edge case — idempotent status): calling `setStatus` with the value the row already has succeeds and leaves it unchanged: `const created = await svc.createServiceType('t', { name: 'X' }); await expect(svc.setStatus('t', created.id, true)).resolves.toMatchObject({ active: true })`."
  - "`service-types.service.spec.ts` (edge case — clearing description): updating with `description: ''` clears a previously-set description back to `null`: `const created = await svc.createServiceType('t', { name: 'X', description: 'old' }); expect(await svc.updateServiceType('t', created.id, { name: 'X', description: '' })).toMatchObject({ description: null })`."
  - "`service-types.e2e-spec.ts` (AC1): `POST /service-types` as admin with name+description returns 201 and the item appears in `GET /service-types`: `expect(res.status).toBe(201); expect(list.body).toContainEqual(expect.objectContaining({ name: 'Faucet repair', description: 'Fix leaky or broken faucets.', active: true }))`."
  - "`service-types.e2e-spec.ts`: `POST /service-types` with no `description` returns 201 with `description: null` and `active: true`: `expect(res.body).toMatchObject({ description: null, active: true })`."
  - "`service-types.e2e-spec.ts` (AC2/AC3): `PATCH /service-types/:id` as admin changes name and description and the response reflects both: `expect(res.status).toBe(200); expect(res.body).toMatchObject({ name: 'Drain & pipe cleaning', description: 'New copy' })`."
  - "`service-types.e2e-spec.ts` (validation): empty/whitespace name is refused with the name-field error on both create and edit: `expect(res.status).toBe(400); expect(res.body.message).toContain('Enter a name for this service type.')`."
  - "`service-types.e2e-spec.ts` (duplicate-name rule): a name already used by another service type is refused on both create and edit, case-insensitively, with a 409: `expect(dup.status).toBe(409); expect(dup.body.message).toContain('Another service type already uses this name.')`."
  - "`service-types.e2e-spec.ts` (AC4/AC6): `PATCH /service-types/:id/status { active: false }` removes the row from a customer's `GET /service-types`, and `{ active: true }` restores it: `expect(customerList.body.find((s) => s.id === created.body.id)).toBeUndefined()` then, after reactivating, `expect(after.body.find((s) => s.id === created.body.id)).toBeTruthy()`."
  - "`service-types.e2e-spec.ts` (AC7): with nothing created, `GET /service-types` as customer returns an empty array: `expect(res.status).toBe(200); expect(res.body).toEqual([])`."
  - "`service-types.e2e-spec.ts` (AC5): a customer gets 403 on create/edit/status-change, and an unauthenticated request gets 401: `await http().post('/service-types').set('Authorization', customer).send({ name: 'Hack attempt' }).expect(403)` and `await http().get('/service-types').expect(401)`."
  - "`service-types.e2e-spec.ts` (edge case — tenant isolation): an admin token for a different tenant gets 404, not the other tenant's data, when editing or changing status of an id that belongs to tenant A: `const otherAdmin = Bearer ${tokenFor({ sub: 'adm-2', role: 'admin', 'custom:tenant_id': OTHER_TENANT })}; await http().patch(/service-types/${created.body.id}).set('Authorization', otherAdmin).send({ name: 'Stolen' }).expect(404);`"
  - "`service-types.e2e-spec.ts` (edge case — not found / malformed id): a well-formed but unknown id 404s, and a malformed (non-UUID) id 400s: `await http().patch('/service-types/00000000-0000-4000-8000-000000000000').set('Authorization', admin).send({ name: 'X' }).expect(404);` `await http().patch('/service-types/not-a-uuid').set('Authorization', admin).send({ name: 'X' }).expect(400)`."
  - "`service-types.e2e-spec.ts` (edge case — invalid status body): a non-boolean or missing `active` is refused: `await http().patch(/service-types/${created.body.id}/status).set('Authorization', admin).send({ active: 'yes' }).expect(400);` and with `{}` also `.expect(400)`."
  - "`service-types.e2e-spec.ts` (edge case — idempotent toggle): setting `active: true` on an already-active service type returns 200 unchanged rather than erroring: `expect((await http().patch(/service-types/${created.body.id}/status).set('Authorization', admin).send({ active: true })).status).toBe(200)`."
  - "`ServiceTypesPage.test.tsx` (AC1): filling name+description in the \"New service type\" modal and submitting posts the trimmed body and shows the list row: `fireEvent.click(screen.getByRole('button', { name: /save service type/i }))` then `expect(JSON.parse(posts()[0][1].body)).toEqual({ name: 'Faucet repair', description: 'Fix leaky or broken faucets.' })`."
  - "`ServiceTypesPage.test.tsx`: submitting with an empty name shows the inline error and makes no request: `expect(await screen.findByText('Enter a name for this service type.')).toBeInTheDocument(); expect(posts()).toHaveLength(0)`."
  - "`ServiceTypesPage.test.tsx`: a 409 from the API (mocked) is shown next to the name field without closing the modal: `expect(await screen.findByText('Another service type already uses this name.')).toBeInTheDocument()`."
  - "`ServiceTypesPage.test.tsx` (AC4): clicking \"Deactivate\" opens the confirmation modal with the consequence copy, and confirming calls the status endpoint and flips the chip: `expect(screen.getByText(/will no longer be listed to customers when booking/i)).toBeInTheDocument()` then after confirming, `expect(await screen.findByText('Inactive')).toBeInTheDocument()`."
  - "`ServiceTypesPage.test.tsx` (AC6): clicking \"Activate\" on an inactive row calls the status endpoint immediately (no confirmation modal) and flips the chip to Active: `expect(screen.queryByRole('dialog')).not.toBeInTheDocument()` immediately after the click, then `expect(await screen.findByText('Active')).toBeInTheDocument()`."
  - "`ServiceTypesPage.test.tsx` (edge case — search with matches and no matches): typing a substring of one row's name filters the table to just that row; typing a string matching nothing shows the \"no matches\" empty state with a working Clear search control: `fireEvent.change(screen.getByLabelText(/search service types/i), { target: { value: 'drain' } }); expect(screen.queryByText('Faucet repair')).not.toBeInTheDocument();` then `fireEvent.change(..., { target: { value: 'zzz' } }); expect(await screen.findByText(/no service types match/i)).toBeInTheDocument();` `fireEvent.click(screen.getByRole('button', { name: /clear search/i })); expect(await screen.findByText('Faucet repair')).toBeInTheDocument()`."
  - "`ServiceTypesPage.test.tsx` (AC7, empty catalog vs empty search distinguished): with `GET /service-types` mocked to return `[]`, the page shows the \"nothing created yet\" empty state, not the \"no matches\" one: `expect(await screen.findByText(/no service types yet/i)).toBeInTheDocument(); expect(screen.queryByText(/no service types match/i)).not.toBeInTheDocument()`."
  - "`ServiceTypesPage.test.tsx` (edge case — no markup injection): a service type whose name contains `<img src=x onerror=alert(1)>` renders as literal text in the table, not as an element: `expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument(); expect(document.querySelector('img[src=\"x\"]')).toBeNull()`."
  - "`App.test.tsx` (AC5): visiting `/service-types` as a `customer` falls through to the existing customer-branch wildcard and shows \"Access denied\": add `/service-types` to the existing `it.each(['/employees', '/employees/new', '/defects/new', '/me', '/pending-changes', '/nowhere'])('AC4: a logged-in customer sees Access denied on %s...')` array."
  - "`App.test.tsx` (AC5): a non-admin, non-customer role (e.g. `employee`) sees \"Access restricted\" on `/service-types` and nothing is requested: `signIn('employee', 'u2'); const api = mockApi({}); renderApp('/service-types'); expect(screen.getByText('Access restricted')).toBeInTheDocument(); expect(api.mock.calls.filter(([, i]) => i?.method && i.method !== 'GET')).toHaveLength(0)`."
assumptions_or_open_questions:
  - "`admin` is already a value in the shared `Role` type on both sides (`services/api/src/auth/roles.ts`'s `ROLES` and `apps/web/src/lib/auth.ts`'s `Role`/`ROLES`), confirmed by reading both files directly during this revision pass — so this plan makes no change to either file or to `apps/web/src/test/helpers.tsx`. Flagging in case Cognito user-pool groups are provisioned separately from this repo and need `admin` added there too (outside this plan's reach)."
  - "STORY-054 already created a `bookings` table (`services/api/src/database/migrations/1700000000003-create-bookings-schema.ts`, re-read this revision) whose `service_type` column is a free-text field restricted by a hardcoded Postgres `CHECK` constraint to exactly the four names in this story's design fixture, with no foreign key to any catalog table. This plan does not touch that table, its constraint, or reconcile it with the new admin-managed `service_types` table — that is a materially larger change with its own design questions that no AC in this story asks for."
  - "`GET /service-types` is treated as in-scope (role-filtered list) because AC4/AC6/AC7 can only be verified against something that shows what a customer currently sees — but the actual customer-facing booking/browsing screen is explicitly out of scope (the design's own comment says that surface belongs to a sibling story). This plan verifies AC4/AC6/AC7 at the API layer rather than building a second UI."
  - "The prototype's mobile hamburger nav (`mobile-nav-trigger`, sidebar collapsing below 1024px, confirmed present in the design's inline CSS/markup) is not implemented. It would be a change to the shared `Layout.tsx` affecting every existing page, not something scoped to the service-type catalog itself, and no AC calls for it."
  - "A duplicate-name conflict is implemented as an HTTP 409 (matching the codebase's existing `ConflictException` convention for 'already in use', confirmed in `employees.service.ts`) rather than a 400 validation error like the blank-name case. The frontend shows the server's message next to the name input either way, so the observable behavior is identical; flagging the status-code choice in case the reviewer expects 400 instead."
  - "The deactivate/activate toggle is modeled as a single `PATCH /service-types/:id/status` endpoint with an `{ active: boolean }` body (one idempotent control, matching the design's single toggle button) rather than two separate `/activate` and `/deactivate` routes."
  - "Only `admin` and `customer` can call `GET /service-types`; `hr_admin`/`employee`/`reporter` get 403 since they're a different domain's roles and no AC implies they need catalog access."
  - "No max-length validation is added to `name`/`description` — no AC asks for it and no existing text field in this codebase enforces one, so adding an arbitrary cap here would be an invented constraint rather than a grounded edge case."
  - "Cross-tenant access to another tenant's service type returns 404 (not 403), matching `EmployeesService`'s confirmed `loadEmployee` behavior of not distinguishing 'doesn't exist' from 'exists in a tenant you can't see.'"
  - "A real concurrent-duplicate-name race is not exercised by a test — `FakeDataSource` has no real concurrency to race against. The migration's unique index on `(tenant_id, lower(name))` is the actual safety net for that race in real Postgres."
  - "Role-gating assertions for `/service-types` (AC5) are added to `App.test.tsx`'s existing parametrized tests rather than to `ServiceTypesPage.test.tsx`, because that's where every other role-gated route's access-restricted/access-denied behavior is actually tested today — `ServiceTypesPage` itself has no internal role check."
  - "Since the prior draft of this plan, two unrelated migrations (STORY-050's `CreatePageReviewsSchema1700000000005`) and one module (`InventoryModule` in `app.module.ts`) landed in `main`/this branch. This revision re-verified both directly and moved this plan's migration to `1700000000006` accordingly. A reviewer re-checking the migrations directory right before merge should confirm no newer migration has since claimed `1700000000006` too, since this has now happened twice in a row."
estimated_points: 5
package_dependencies: []
notes: |
  The design prototype (`UAT-14OCT-STORY-055-design.html`, read in full this revision) is a
  single screen/route (`/service-types`) in the existing admin console shell (sidebar +
  topbar), with two overlays: a shared New/Edit service type modal (name + description, inline
  name-field errors for blank and duplicate) and a Deactivate-confirmation modal naming the
  consequence before hiding the type from customers. Its "Viewing as" role switcher and
  "Simulate a failed load" button are prototype-review conveniences (per the design's own
  inline comments) — real `useAuth()`-driven role instead of a dropdown; error state from a
  real fetch failure rendered via the existing `Banner` component instead of the prototype's
  bespoke `.catalog-error` markup. The design's own sidebar markup (`HR Console` → `QA Tracker`
  → `Service Catalog`, with "Service types" as the active link) matches `Layout.tsx`'s current
  section order (insertion point unaffected by the "Page inventory" link STORY-050 added under
  QA Tracker since the prior draft). The design's fixture data (`Faucet repair`, `Drain
  cleaning`, `Water heater install` with an empty description, `AC tune-up` inactive) matches
  exactly the four names hardcoded in STORY-054's `bookings.service_type` CHECK constraint.

  This is a second revision pass. The first revision fixed: (1) `admin` already present in
  `ROLES`/`Role` on both sides, dropping an earlier role-plumbing scope item entirely; (2) the
  migration timestamp moving from `1700000000004` (claimed by
  `AddDefectPriorityAssignee1700000000004`) to `1700000000005`. This second revision found that
  `1700000000005` has since ALSO been claimed (by `CreatePageReviewsSchema1700000000005`,
  STORY-050), so the migration now moves to `1700000000006`, `data-source.ts`'s entity list now
  includes `PageReview` as a sixth entity, and `app.module.ts`'s import list now includes
  `InventoryModule` as a fifth module — both accounted for in scope. It also corrected a
  citation: `.modal`/`.modal-backdrop`/`.modal-actions` live in `apps/web/src/index.css`
  itself, not `design-system/prototype-utils.css` (which supplies `.table`/`.chip-*`/`.field`/
  `.input`/`.select`/`.textarea` instead) — confirmed by grepping both files directly. Every
  other citation from the prior draft — `App.tsx`'s customer branch and `RequireHrAdmin`
  pattern, `App.test.tsx`'s exact `it.each` arrays, the `EmployeeDirectoryPage`/
  `PendingChangesPage` UI conventions, and the `FakeDataSource`/`createTestApp`/`tokenFor` test
  harness — was re-read directly during this pass and found unchanged, so those decisions
  carry forward as-is.

  Edge-case coverage beyond the seven stated ACs reasons from how the rest of this codebase
  already handles the same shape of problem rather than inventing new rules: tenant isolation
  and not-found both copy `EmployeesService.loadEmployee`'s pattern; the idempotent status
  toggle and the dual empty states copy `EmployeeDirectoryPage`'s existing no-data-yet vs
  no-search-results split; malformed-id handling copies the `ParseUUIDPipe` already used on
  every other `:id` route in this API. The one edge case deliberately left out — a max length
  on name/description — is called out as an open question rather than guessed at.

  ```mermaid
  flowchart TD
    classDef touched fill:#f96,color:#000
    AppModule["app.module.ts (now imports 5 modules incl. InventoryModule)"]:::touched --> STModule[service-types.module.ts]:::touched
    STModule --> STController[service-types.controller.ts]:::touched
    STController --> STService[service-types.service.ts]:::touched
    STService --> STEntity[service-type.entity.ts]:::touched
    STService --> DataSourceRuntime[(DataSource / Postgres)]
    STController --> CognitoGuard[auth/cognito-auth.guard.ts - unchanged]
    STController --> RolesGuard[auth/roles.guard.ts - unchanged]
    RolesGuard --> RolesTs["auth/roles.ts ROLES (admin already present, unmodified)"]
    CognitoGuard --> RolesTs
    DataSourceTs["database/data-source.ts (now 6 entities, migration moves to 1700000000006)"]:::touched --> STEntity
    DataSourceTs --> PageReview["inventory/entities/page-review.entity.ts - unchanged, added by STORY-050"]
    DataSourceTs --> PageReviewMigration["migrations/1700000000005-create-page-reviews-schema.ts (new migration appends after this)"]
    AppWeb[App.tsx]:::touched --> RequireAdmin[RequireAdmin wrapper]:::touched
    RequireAdmin --> STPage[ServiceTypesPage.tsx]:::touched
    STPage --> Layout[Layout.tsx]:::touched
    STPage --> ApiClient[apiClient.ts - unchanged]
    STPage --> Banner[Banner.tsx - existing component, unchanged]
    ApiClient --> STController
    WebAuth["lib/auth.ts Role/readSession (admin already present, unmodified)"] --> RequireAdmin
    WebAuth --> STPage
    AppTest[App.test.tsx]:::touched --> AppWeb
  ```
review_focus: |
  In scope: a new `service-types` API domain (CRUD + status toggle, role-filtered list,
  tenant-scoped not-found handling, idempotent status changes) and a new admin console
  page/route with search and dual empty states. Out of scope, deliberately: any customer-facing
  browsing/booking UI, the responsive mobile-nav collapse shown in the prototype, pricing
  fields, max-length validation on text fields, any change to the `admin`/`customer` role
  plumbing (already landed by prior work), and any change to the existing `bookings` table or
  its hardcoded `service_type` CHECK constraint from STORY-054. Riskiest area: the
  duplicate-name check runs in application code (load all of a tenant's rows, compare in JS)
  rather than a SQL `ILIKE` query, deliberately, to keep `FakeDataSource`-based unit tests
  working without real Postgres and because expected per-tenant catalog size is small — a
  reviewer should confirm that assumption holds; the real concurrent-duplicate-name race is
  covered only by the migration's DB-level unique index, not by a test, for the same reason.
  Also note: a name conflict is surfaced as HTTP 409 (not 400) and cross-tenant access 404s
  (not 403) — both deliberate convention matches with existing code, not inconsistencies to
  flag. Finally, this plan's migration timestamp (`1700000000006`) has moved twice already as
  other work landed on this slot ahead of it (`1700000000004` then `1700000000005` were both
  claimed by unrelated migrations between drafts) — a reviewer re-checking the migrations
  directory immediately before merge should confirm no newer migration has since claimed
  `1700000000006` too.

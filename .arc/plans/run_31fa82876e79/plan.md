summary: |
  Add a Page Instance Inventory feature that is the authoritative list of every published page
  across the five templates (HomePage, LandingPage, ClientWork, Partner, Services). The backend
  builds this list live at request time by querying Drupal's JSON:API node collections for the
  five content types (`home_page`, `landing_page`, `client_work`, `partner`, `services`, matching
  the machine names already used by `apps/web/src/lib/templates/resolveTemplateType.ts`), filtered
  to published, following pagination so large collections are fully covered. Each live page is
  left-joined with a persisted review record (reviewer name, review date, pass/fail) stored in a
  new `page_reviews` table, keyed by the Drupal node id. Reviewers record a result through a new
  `POST /inventory/:pageId/results` endpoint, validated so a missing reviewer name or review date
  is rejected and never saved. Because the merge always starts from the live Drupal result set, a
  page that Drupal no longer returns (unpublished/deleted) is dropped from the inventory and its
  stored review (if any) is never surfaced, so it cannot be counted done. A new internal web page
  (`/page-inventory`) lists the merged inventory and lets a reviewer record pass/fail per page.

scope:
  - description: |
      Add the shared template/content-type map used to build the live Drupal query and to tag
      each page entry with its template.
      ```ts
      export const TEMPLATE_TYPES = ['HomePage', 'LandingPage', 'ClientWork', 'Partner', 'Services'] as const;
      export type TemplateType = (typeof TEMPLATE_TYPES)[number];
      export const PAGE_CONTENT_TYPES: Record<TemplateType, string> = {
        HomePage: 'home_page',
        LandingPage: 'landing_page',
        ClientWork: 'client_work',
        Partner: 'partner',
        Services: 'services',
      };
      ```
    files:
      - services/api/src/inventory/template-type.ts
    rationale: |
      The five template-type values and their content-type machine names already exist as a map
      in `apps/web/src/lib/templates/resolveTemplateType.ts` (`TEMPLATE_TYPE_BY_VALUE`); the
      backend needs its own copy of this map (it has no dependency on the web app) to know which
      five JSON:API node collections to query and how to label each result.

  - description: |
      Add a Drupal page catalog fetcher that queries each of the five content types' published
      nodes live from JSON:API, follows `links.next.href` pagination, and maps each resource to a
      `CatalogPage`.
      ```ts
      export interface CatalogPage {
        pageId: string;
        templateType: TemplateType;
        title: string;
        path: string | null;
      }
      export async function fetchPublishedPages(env?: NodeJS.ProcessEnv): Promise<CatalogPage[]>
      ```
      Each content type is queried as `/jsonapi/node/{content_type}?filter[status]=1` via the
      existing `fetchDrupalResource` from `services/api/src/drupal/drupal-client.ts`; the loop
      follows `body.links.next.href` (an absolute URL, which `fetchDrupalResource`'s
      `new URL(path, config.baseUrl)` already handles correctly whether `path` is absolute or
      relative) until a response carries no `next` link. Each `JsonApiResource` is mapped with
      `title: resource.attributes.title ?? ''` and `path: (resource.attributes.path as { alias?: string } | undefined)?.alias ?? null`.
    files:
      - services/api/src/inventory/drupal-page-catalog.ts
      - services/api/src/inventory/drupal-page-catalog.spec.ts
    rationale: |
      AC1/AC2/AC3 require the inventory to be populated from a live JSON:API query (never manual
      entry), to include every published page, and to show which template each page uses. Reusing
      `fetchDrupalResource` keeps the single request primitive, config loading, auth header and
      error handling defined once in `drupal-client.ts`; pagination is handled here because the
      existing `createTypedFetcher`/`resource-registry` machinery (confirmed by reading both
      files) only ever fetches a single resource by id via `fetchById(id, env)`, never a
      collection, so a new fetcher is needed rather than a reuse.

  - description: |
      Add the `PageReview` TypeORM entity and its migration for persisted per-page review
      results, and register both in `services/api/src/database/data-source.ts` (its `entities`
      and `migrations` arrays are what `TypeOrmModule.forRootAsync` in
      `services/api/src/database/typeorm.module.ts` actually wires up at runtime, not just the
      CLI — confirmed by reading `typeorm.module.ts`).
      ```ts
      @Entity('page_reviews')
      export class PageReview {
        @PrimaryGeneratedColumn('uuid')
        id!: string;

        @Column({ name: 'page_id', type: 'text', unique: true })
        pageId!: string;

        @Column({ name: 'reviewer_name', type: 'text' })
        reviewerName!: string;

        @Column({ name: 'review_date', type: 'date' })
        reviewDate!: string;

        @Column({ type: 'text' })
        result!: 'pass' | 'fail';

        @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
        createdAt!: Date;

        @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
        updatedAt!: Date;
      }
      ```
      Migration SQL (file `1700000000005-create-page-reviews-schema.ts`, class
      `CreatePageReviewsSchema1700000000005` — the highest existing migration number is
      `1700000000004-add-defect-priority-assignee.ts`, confirmed by listing the migrations
      directory, so this is the next free number):
      ```sql
      CREATE TABLE page_reviews (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        page_id text NOT NULL UNIQUE,
        reviewer_name text NOT NULL,
        review_date date NOT NULL,
        result text NOT NULL CHECK (result IN ('pass','fail')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
      ```
    files:
      - services/api/src/inventory/entities/page-review.entity.ts
      - services/api/src/database/migrations/1700000000005-create-page-reviews-schema.ts
      - services/api/src/database/data-source.ts
    rationale: |
      A uuid `id` primary key (rather than `pageId` alone) mirrors every other entity in this
      codebase (`Defect`, `Employee`, ...) and is required for the `FakeDataSource` test double in
      `services/api/test/support/fake-data-source.ts`, whose `save()` only recognizes an existing
      row as an update when `row.id` is already set; using `pageId` as the sole key would make
      every recorded result in tests insert a new row instead of overwriting the prior one. The
      unique `page_id` column still enforces one current result per page at the DB level.
      `data-source.ts` must add `PageReview` to its `entities: [...]` array and the new migration
      class to its `migrations: [...]` array, following the exact pattern already used there for
      `Defect`/`AddDefectPriorityAssignee1700000000004` — skipping this file would leave the real
      Postgres-backed app unable to resolve `getRepository(PageReview)` even though the
      `FakeDataSource` used in unit/e2e tests wouldn't surface the gap.

  - description: |
      Add the `RecordPageReviewDto` with validation that rejects a missing/blank reviewer name or
      review date, or a result outside `pass`/`fail`.
      ```ts
      export class RecordPageReviewDto {
        @IsString({ message: 'Enter the reviewer name.' })
        @IsNotEmpty({ message: 'Enter the reviewer name.' })
        @Matches(/\S/, { message: 'Enter the reviewer name.' })
        reviewerName!: string;

        @IsISO8601({ strict: true }, { message: 'Enter the review date.' })
        reviewDate!: string;

        @IsIn(['pass', 'fail'], { message: 'Result must be pass or fail.' })
        result!: 'pass' | 'fail';
      }
      ```
    files:
      - services/api/src/inventory/dto/record-page-review.dto.ts
    rationale: |
      Mirrors `services/api/src/defects/dto/create-defect.dto.ts`'s `IsString`/`IsNotEmpty`/
      `Matches(/\S/)` trio for required-text fields (confirmed by reading that file), and relies
      on the already-globally-registered `ValidationPipe({ whitelist: true,
      forbidNonWhitelisted: true })` (confirmed in both `main.ts`'s pattern and
      `services/api/test/support/create-test-app.ts`) to turn a validation failure into a 400
      with no row written — directly satisfying AC9. `class-validator` is already a project
      dependency (used by `CreateDefectDto`), so no new package is needed.

  - description: |
      Add `InventoryService` with `buildInventory()` (live catalog left-joined with stored
      reviews) and `recordResult()` (validated upsert by `pageId`).
      ```ts
      async buildInventory(env?: NodeJS.ProcessEnv): Promise<InventoryEntry[]> {
        const pages = await fetchPublishedPages(env);
        const reviews = await this.dataSource.getRepository(PageReview).find();
        const byPageId = new Map(reviews.map((r) => [r.pageId, r]));
        return pages.map((p) => {
          const review = byPageId.get(p.pageId);
          return {
            pageId: p.pageId,
            templateType: p.templateType,
            title: p.title,
            path: p.path,
            reviewerName: review?.reviewerName ?? null,
            reviewDate: review?.reviewDate ?? null,
            status: (review?.result as 'pass' | 'fail' | undefined) ?? null,
          };
        });
      }

      async recordResult(pageId: string, dto: RecordPageReviewDto): Promise<PageReview> {
        const repo = this.dataSource.getRepository(PageReview);
        const existing = await repo.findOne({ where: { pageId } });
        return repo.save(
          repo.create({ ...(existing ?? {}), pageId, reviewerName: dto.reviewerName.trim(), reviewDate: dto.reviewDate, result: dto.result }),
        );
      }
      ```
      `buildInventory` iterates the live `pages` array only (never the stored `reviews` rows) when
      producing entries, so a stored review whose `pageId` is absent from the live catalog is
      silently dropped from the result — this is what makes AC11 hold. The constructor
      (`constructor(private readonly dataSource: DataSource) {}`) matches
      `services/api/src/defects/defects.service.ts`'s exact pattern.
    files:
      - services/api/src/inventory/inventory.service.ts
      - services/api/src/inventory/inventory.service.spec.ts
    rationale: |
      `repo.find()` with no `where` (rather than a TypeORM `In(...)` filter) is used deliberately
      so the in-memory merge logic is exercised identically against the real `DataSource` and
      against `FakeDataSource` in unit tests — `FakeDataSource`'s `find()` (confirmed by reading
      `services/api/test/support/fake-data-source.ts`) only does strict per-field equality and
      does not understand TypeORM operator objects like `In(...)`.

  - description: |
      Add `InventoryController` (`GET /inventory`, `POST /inventory/:pageId/results`) and
      `InventoryModule`, and register the module in `AppModule`.
      ```ts
      @Controller('inventory')
      @UseGuards(CognitoAuthGuard, RolesGuard)
      @Roles('hr_admin', 'employee', 'reporter', 'admin')
      export class InventoryController {
        constructor(private readonly inventory: InventoryService) {}

        @Get()
        list() {
          return this.inventory.buildInventory();
        }

        @Post(':pageId/results')
        recordResult(@Param('pageId') pageId: string, @Body() dto: RecordPageReviewDto) {
          return this.inventory.recordResult(pageId, dto);
        }
      }
      ```
    files:
      - services/api/src/inventory/inventory.controller.ts
      - services/api/src/inventory/inventory.module.ts
      - services/api/src/app.module.ts
    rationale: |
      `@Roles('hr_admin', 'employee', 'reporter', 'admin')` excludes only the `customer` role out
      of the full `ROLES` tuple (`['hr_admin', 'employee', 'reporter', 'customer', 'admin']`,
      confirmed in `services/api/src/auth/roles.ts`), matching the existing internal/customer
      split already enforced in `apps/web/src/App.tsx` (customers are routed to
      `CustomerAccessDeniedPage` for every internal page, while `hr_admin`/`employee`/`reporter`/
      `admin` all reach the internal routes) — this is an admin/QA surface, not a
      customer-facing one, but no AC names a specific "reviewer" role so access is not narrowed
      further than that split. `InventoryModule` only needs to import `AuthModule`
      (`services/api/src/defects/defects.module.ts` does the same, with no `TypeOrmModule`
      import) because `DatabaseModule` (`services/api/src/database/typeorm.module.ts`) registers
      `DataSource` globally for the whole app.

  - description: |
      Add the e2e test exercising the full stack (controller to service to `FakeDataSource`) with
      a mocked `global.fetch` standing in for Drupal.
    files:
      - services/api/test/inventory.e2e-spec.ts
    rationale: |
      Matches the existing `services/api/test/defects.e2e-spec.ts` style (real `createTestApp()`,
      `tokenFor()` bearer tokens, `supertest`), extended with a
      `vi.spyOn(globalThis, 'fetch')` stub (as used in
      `services/api/src/drupal/drupal-client.spec.ts`) so the live-query behavior is verified
      end-to-end without a real Drupal instance.

  - description: |
      Add the `InventoryEntry` type to the web app's shared types, and a `PageInventoryPage` route
      that lists the merged inventory and lets a signed-in reviewer record a pass/fail result per
      row, wired into routing and navigation.
      ```ts
      export type TemplateType = 'HomePage' | 'LandingPage' | 'ClientWork' | 'Partner' | 'Services'
      export interface InventoryEntry {
        pageId: string
        templateType: TemplateType
        title: string
        path: string | null
        reviewerName: string | null
        reviewDate: string | null
        status: 'pass' | 'fail' | null
      }
      ```
      `PageInventoryPage` follows the existing `apps/web/src/routes/EmployeeDirectoryPage.tsx`
      table pattern (plain `<table className="table">`, `useAsync` for the `GET /inventory` load,
      `Banner`/empty-state treatment on error) with one added per-row inline form (reviewer name
      input, date input, Pass/Fail buttons) that blocks submission client-side and shows a
      `field-error` (same class used in `ReportDefectPage.tsx`) when the name or date is blank,
      then `apiClient.post('/inventory/{pageId}/results', body)` and merges the response into
      local state so the row re-renders with the new reviewer/date/status without a full reload.
    files:
      - apps/web/src/lib/types.ts
      - apps/web/src/routes/PageInventoryPage.tsx
      - apps/web/src/routes/PageInventoryPage.test.tsx
    rationale: |
      Reuses the plain `<table>` + `useAsync` + `Banner` pattern already used by
      `EmployeeDirectoryPage.tsx`/`ReportDefectPage.tsx` (both read in full) instead of
      introducing a new generic grid component; `ActiveGrid` in the UI catalogue is a
      single-record label/value card (used for one employee's core fields) and does not fit a
      multi-row, multi-template list with inline editable rows.

  - description: |
      Wire the new page into routing and navigation.
      Add `<Route path="/page-inventory" element={<PageInventoryPage />} />` inside the existing
      internal (non-customer) `<Routes>` block in `App.tsx` (the block starting at the
      `/employees` route, after the `return (<ToastProvider>...` for signed-in non-customer
      users), and add a `NavLink` to `/page-inventory` labeled "Page inventory" under the
      existing "QA Tracker" sidebar section in `Layout.tsx`, next to the existing Defects link.
    files:
      - apps/web/src/App.tsx
      - apps/web/src/components/Layout.tsx
    rationale: |
      "QA Tracker" is the existing sidebar section (confirmed in `Layout.tsx`) already used for
      the Defects workflow; the page inventory is the companion QA artifact for the Page Template
      Renderers epic and belongs in the same section, visible to every internal role exactly like
      the Defects link is today.

tests:
  - |
    AC1/AC2 (`drupal-page-catalog.spec.ts`): mocking `globalThis.fetch`, assert
    `fetchPublishedPages` issues one request per content type with the published filter, e.g.
    `expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/jsonapi/node/home_page')`
    and `expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('filter[status]')).toBe('1')`;
    and that when the first page's body has
    `links: { next: { href: '.../home_page?page[offset]=50' } }` the fetcher issues a second
    request and `fetchPublishedPages` returns the concatenation of both pages' `data` arrays
    (`expect(pages.filter((p) => p.templateType === 'HomePage')).toHaveLength(3)` for a 2+1 split
    across two mocked pages).
  - |
    AC3 (`drupal-page-catalog.spec.ts`): parsing a `node--landing_page` resource yields
    `expect(pages.find((p) => p.pageId === 'n-1')).toMatchObject({ templateType: 'LandingPage' })`,
    and likewise one assertion per remaining content type/templateType pair.
  - |
    AC4/AC6/AC7 (`inventory.service.spec.ts` with `FakeDataSource`): after
    `await service.recordResult('page-1', { reviewerName: 'Pat', reviewDate: '2026-10-19', result: 'pass' })`,
    `buildInventory` (with `fetchPublishedPages` stubbed to return a `page-1` catalog entry)
    returns an entry
    `expect(entry).toMatchObject({ reviewerName: 'Pat', reviewDate: '2026-10-19', status: 'pass' })`.
  - |
    AC5/AC6/AC8 (`inventory.service.spec.ts`): the same flow with `result: 'fail'` yields
    `expect(entry).toMatchObject({ reviewerName: 'Pat', reviewDate: '2026-10-19', status: 'fail' })`.
  - |
    AC9 (`inventory.e2e-spec.ts`): `POST /inventory/page-1/results` with
    `{ reviewDate: '2026-10-19', result: 'pass' }` (no `reviewerName`) returns
    `expect(res.status).toBe(400)`; a following `GET /inventory` shows the `page-1` entry still
    has `expect(entry.status).toBeNull()`. The same is asserted for a request missing
    `reviewDate`.
  - |
    AC10 (`inventory.service.spec.ts`): `buildInventory` over a catalog page with no stored
    `PageReview` row returns
    `expect(entry).toMatchObject({ reviewerName: null, reviewDate: null, status: null })`, and the
    page is still present: `expect(entries).toHaveLength(1)`.
  - |
    AC11 (`inventory.service.spec.ts`): a `PageReview` row is saved for `pageId: 'ghost-1'`, but
    `fetchPublishedPages` is stubbed to return a catalog that does not include `ghost-1`;
    `expect(await service.buildInventory()).not.toEqual(expect.arrayContaining([expect.objectContaining({ pageId: 'ghost-1' })]))`.
  - |
    AC2/AC11 (`inventory.e2e-spec.ts`): with Drupal mocked to return two published pages across
    two content types, `GET /inventory` with a valid bearer token returns
    `expect(res.body).toHaveLength(2)` and each entry's `templateType` matches its content type.
  - |
    AC3 (`PageInventoryPage.test.tsx`): mocking `GET /inventory` to return one entry per template
    type,
    `expect(screen.getAllByText(/HomePage|LandingPage|ClientWork|Partner|Services/)).toHaveLength(5)`.
  - |
    AC10 (`PageInventoryPage.test.tsx`): an entry with `status: null` renders
    `expect(screen.getByText(/no result yet/i)).toBeInTheDocument()` and no Pass/Fail chip for
    that row.
  - |
    AC4/AC6/AC7 (`PageInventoryPage.test.tsx`): filling the reviewer name and date inputs for a
    row and clicking "Mark pass" POSTs
    `expect(JSON.parse(posts()[0][1]!.body as string)).toEqual({ reviewerName: 'Pat', reviewDate: '2026-10-19', result: 'pass' })`
    and the row re-renders showing `Pat` and a Pass chip.
  - |
    AC9 (`PageInventoryPage.test.tsx`): clicking "Mark pass" with the reviewer name left blank
    shows `expect(await screen.findByText(/enter the reviewer name/i)).toBeInTheDocument()` and
    `expect(posts()).toHaveLength(0)`.

assumptions_or_open_questions:
  - |
    The inventory endpoints are guarded by `@Roles('hr_admin', 'employee', 'reporter', 'admin')`
    — i.e. any authenticated non-customer role — because no acceptance criterion names a specific
    "reviewer" role; this mirrors the existing internal/customer split already enforced in
    `apps/web/src/App.tsx`.
  - |
    `page_reviews` is not tenant-scoped, unlike `Defect`/`Employee` (both confirmed to carry a
    `tenant_id uuid` column). `DrupalConfig` (`services/api/src/drupal/drupal-config.ts`) is a
    single global `DRUPAL_BASE_URL`/`DRUPAL_ACCESS_TOKEN` per deployment, not per-tenant, so the
    Drupal site being inventoried — and therefore its review records — is treated as shared
    across the product rather than isolated per tenant.
  - |
    "The reviewer's name" (AC4/AC5) is recorded as free text typed into the form, not derived
    from the authenticated caller's own identity claims — no AC ties the recorded name to the
    signed-in user, and unlike `reportedBy` on `Defect`, the review-recording endpoint does not
    stamp `user.sub`.
  - |
    A page holds exactly one current review result; recording a new pass/fail overwrites the
    prior reviewer/date/status rather than keeping a history, since every AC refers to "a page
    entry" and its (singular) reviewer/date/status, never a list of past reviews.
  - |
    Drupal's JSON:API pagination convention (`links.next.href`) is assumed to apply to the `node`
    collection endpoints exactly as it does for other JSON:API collections; `fetchPublishedPages`
    follows it to avoid silently truncating AC2's "every published page appears" when a content
    type has more entries than one page's default limit.
  - |
    The five content-type machine names (`home_page`, `landing_page`, `client_work`, `partner`,
    `services`) are assumed to be the final, stable Drupal bundle names, since they already match
    `apps/web/src/lib/templates/resolveTemplateType.ts`'s `TEMPLATE_TYPE_BY_VALUE` map exactly.
  - |
    A Drupal node resource's `path` attribute is assumed to follow the standard JSON:API `path`
    field shape (`{ alias: string | null, ... }`), read as `attributes.path?.alias ?? null`; no
    live Drupal response was available to confirm this field is enabled on all five content
    types, so a page whose `path` module field is absent will show `path: null` rather than fail.

estimated_points: 8

package_dependencies: []

notes: |
  This story builds directly on infrastructure added by prior stories in this epic:
  `services/api/src/drupal/drupal-client.ts` (`fetchDrupalResource`, config/auth/error handling)
  and `services/api/src/drupal/typed-fetcher.ts`/`resource-registry.ts` (per-id content fetchers
  used by the renderers themselves — confirmed by reading both files, `fetchById(id, env)` only
  ever resolves a single resource). This story adds the first **collection** query (list all
  published nodes of a content type), which is why it's a new file rather than a reuse of
  `createTypedFetcher`. The migration number and `data-source.ts` registration were checked
  against the current migrations directory (`1700000000000` through `1700000000004` already
  exist) and the live `entities`/`migrations` arrays in `services/api/src/database/data-source.ts`
  to avoid a filename collision or an entity that silently never resolves against the real
  Postgres-backed app.

  ```mermaid
  flowchart TD
    AppModule[app.module.ts] --> InvModule[inventory.module.ts]
    InvModule --> InvController[inventory.controller.ts]
    InvController --> InvService[inventory.service.ts]
    InvService -->|live catalog| Catalog[drupal-page-catalog.ts]
    Catalog -->|fetchDrupalResource| DrupalClient[drupal-client.ts]
    InvService -->|find/save| PageReview[page-review.entity.ts]
    PageReview -.->|schema| Migration[1700000000005-create-page-reviews-schema.ts]
    DataSource[database/data-source.ts] -->|entities + migrations arrays| PageReview
    DataSource -.-> Migration
    TypeOrmModule[database/typeorm.module.ts] -->|forRootAsync| DataSource
    InvController -->|guards| AuthModule[auth.module.ts]

    WebApp[App.tsx] --> InvPage[PageInventoryPage.tsx]
    Layout[Layout.tsx] -->|nav link| InvPage
    InvPage -->|GET/POST /inventory| ApiClient[apiClient.ts]
    ApiClient -.->|HTTP| InvController
    WebTypes[lib/types.ts] --> InvPage

    classDef touched fill:#f96,color:#000
    class InvModule,InvController,InvService,Catalog,PageReview,Migration,DataSource,AppModule,WebApp,InvPage,Layout,WebTypes touched
  ```

review_focus: |
  In scope: the live-query + persisted-review merge (`InventoryService.buildInventory`/
  `recordResult`), the two new endpoints, the `page_reviews` table (plus its registration in
  `database/data-source.ts`), and the `/page-inventory` web page. Out of scope (owned by the
  QA/Parity/Sign-off epic): actually executing the parity test plan or issuing the epic's final
  sign-off — this story only produces the tracking artifact. Riskiest area: the AC11 "orphan"
  behavior — `buildInventory` must iterate the *live* Drupal catalog array and only look up
  stored reviews by `pageId`, never iterate the stored reviews table itself, or a
  deleted/unpublished page's stale review would wrongly keep counting as an inventory entry.
  Also check the JSON:API pagination loop in `drupal-page-catalog.ts` terminates correctly (no
  `next` link) and doesn't re-fetch the first page, and that `PageReview`/the new migration are
  actually added to `data-source.ts`'s `entities`/`migrations` arrays (easy to miss since the
  `FakeDataSource` used in tests doesn't need it). Non-obvious, deliberate choices a reviewer
  shouldn't flag as bugs: `@Roles` includes `admin` alongside `hr_admin`/`employee`/`reporter` —
  i.e. every role except `customer` — matching the existing internal/customer split rather than a
  narrower "reviewer" role (no AC names one); the reviewer name is free text rather than the
  caller's own identity; and `page_reviews` is intentionally not tenant-scoped (see
  `assumptions_or_open_questions`).

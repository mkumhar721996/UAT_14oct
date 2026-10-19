summary: |
  Add a shared-secret-gated revalidation route to the NestJS API service (`services/api`) that
  this epic's five ISR renderer templates can call to mark a page's content stale, so the next
  fetch for that page is treated as needing a refresh. The route wires the already-existing,
  currently-unused `createRevalidationRegistry()` (`services/api/src/drupal/revalidation-registry.ts`)
  into a new `RevalidationModule`/`RevalidationController` guarded by a new
  `RevalidationSecretGuard`, following the exact config-loading and guard conventions already
  used for Drupal config (`services/api/src/drupal/drupal-config.ts`) and Cognito auth
  (`services/api/src/auth/cognito-auth.guard.ts`) in this service. Per the story's scope note,
  the route's final path/request shape and the Phase 2 Drupal-webhook wiring belong to the
  parent "On-Demand Content Revalidation" epic; this plan only builds the route's existence and
  the secret-token accept/refuse behavior needed for the five renderers to call it.

scope:
  - description: |
      Add `loadRevalidationConfig(env)` to read the shared secret from a new
      `REVALIDATION_SECRET` env var, throwing a named `RevalidationConfigError` when it is
      missing. Mirrors `loadDrupalConfig` in `services/api/src/drupal/drupal-config.ts`: no
      fallback value, and config is loaded lazily per call rather than at boot, so the app still
      starts without the var set.

      ```ts
      export function loadRevalidationConfig(env: NodeJS.ProcessEnv = process.env): RevalidationConfig {
        const secret = env.REVALIDATION_SECRET ?? '';
        if (!secret) throw new RevalidationConfigError('REVALIDATION_SECRET environment variable is required');
        return { secret };
      }
      ```
    files:
      - services/api/src/revalidation/revalidation-config.ts
    rationale: |
      Keeps secret loading pure, testable, and consistent with the existing Drupal config
      pattern already in this service (verified at services/api/src/drupal/drupal-config.ts).

  - description: |
      Add `RevalidationSecretGuard implements CanActivate` that reads the
      `x-revalidation-secret` request header, loads the configured secret via
      `loadRevalidationConfig(process.env)`, and throws `UnauthorizedException` when the header
      is absent or does not strictly equal the configured secret; otherwise returns `true`.
      Mirrors the structure of `services/api/src/auth/cognito-auth.guard.ts` (a guard reading
      one header off `context.switchToHttp().getRequest()` and throwing `UnauthorizedException`
      on failure).
    files:
      - services/api/src/revalidation/revalidation-secret.guard.ts
    rationale: |
      Reuses the project's existing guard-based auth pattern instead of inventing a new
      mechanism, so Phase 2 can swap in additional checks without redesigning the controller.

  - description: |
      Add `RevalidateDto` with a single required `tag: string` field, matching the DTO/
      class-validator conventions in `services/api/src/defects/dto/create-defect.dto.ts`.
      `tag` is the same string key the existing registry's `markStale`/`isStale` already key on
      (e.g. `"home-page:1"`).

      ```ts
      export class RevalidateDto {
        @IsString()
        @IsNotEmpty()
        tag!: string;
      }
      ```
    files:
      - services/api/src/revalidation/dto/revalidate.dto.ts
    rationale: |
      Validates the request body at the boundary before it reaches the registry, consistent
      with how other mutating endpoints in this service validate input. The service's global
      `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true`, set in both
      `services/api/src/main.ts` and `services/api/test/support/create-test-app.ts`) enforces
      this DTO automatically, no extra wiring needed.

  - description: |
      Add `RevalidationController` at `@Controller('revalidation')`, guarded with
      `@UseGuards(RevalidationSecretGuard)`, exposing `POST /revalidation`:

      ```ts
      @Post()
      @HttpCode(200)
      revalidate(@Body() dto: RevalidateDto): { revalidated: true; tag: string } {
        this.registry.markStale(dto.tag);
        return { revalidated: true, tag: dto.tag };
      }
      ```

      The registry is injected via a new `REVALIDATION_REGISTRY` DI token (a `Symbol`, matching
      the `CUSTOMER_IDENTITY_PROVIDER`/`TOKEN_VERIFIER` token convention already used in this
      service).
    files:
      - services/api/src/revalidation/revalidation.controller.ts
    rationale: |
      A single generic endpoint that only cares about a tag + secret, not which renderer or
      page type called it, is what lets any of the five renderers (and, later, a Drupal
      webhook) call it without a redesign.

  - description: |
      Add `RevalidationModule` that provides `REVALIDATION_REGISTRY` via
      `useFactory: () => createRevalidationRegistry()` (importing the existing, currently-
      unused factory from `services/api/src/drupal/revalidation-registry.ts`), registers
      `RevalidationSecretGuard`, and declares `RevalidationController`. Import this module into
      `AppModule`'s `imports` array alongside the existing feature modules
      (`services/api/src/app.module.ts` currently imports `DatabaseModule, EmployeesModule,
      DefectsModule, CustomersModule, InventoryModule`).
    files:
      - services/api/src/revalidation/revalidation.module.ts
      - services/api/src/app.module.ts
    rationale: |
      Wires the first real consumer of the existing `revalidation-registry.ts` utility, which
      was previously built and unit-tested (`revalidation-registry.spec.ts`) but never
      registered as a provider or reachable from any route.

  - description: |
      Add an e2e spec exercising all three ACs against the real HTTP stack via the existing
      `createTestApp()` harness (`services/api/test/support/create-test-app.ts`). No provider
      overrides needed for this route, since it touches neither the database nor Cognito/token
      verification.
    files:
      - services/api/test/revalidation.e2e-spec.ts
    rationale: |
      Matches this service's existing e2e coverage style (`test/defects.e2e-spec.ts`,
      `test/employees.e2e-spec.ts`) and proves the guard + controller + registry work together
      through a real request, not just in isolation.

  - description: |
      Add unit specs for the new pure config loader and guard, mirroring
      `services/api/src/drupal/drupal-config.spec.ts` and
      `services/api/src/auth/cognito-auth.guard.spec.ts`.
    files:
      - services/api/src/revalidation/revalidation-config.spec.ts
      - services/api/src/revalidation/revalidation-secret.guard.spec.ts
    rationale: |
      Fast, isolated coverage of the accept/refuse logic independent of the HTTP stack,
      consistent with how the Cognito guard is tested in this service today.

tests:
  - |
    AC1 (e2e, services/api/test/revalidation.e2e-spec.ts): with process.env.REVALIDATION_SECRET
    set to a known value, POST /revalidation with header
    'x-revalidation-secret: <that value>' and body { tag: 'home-page:1' } returns 200:
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ revalidated: true, tag: 'home-page:1' });
    expect(app.get(REVALIDATION_REGISTRY).isStale('home-page:1')).toBe(true);
  - |
    AC2 (e2e): POST /revalidation with no x-revalidation-secret header returns 401:
    expect((await http().post('/revalidation').send({ tag: 'landing-page:1' })).status).toBe(401);
    and with a wrong header value also returns 401:
    expect((await http().post('/revalidation').set('x-revalidation-secret', 'wrong-value').send({ tag: 'landing-page:1' })).status).toBe(401);
    then: expect(app.get(REVALIDATION_REGISTRY).isStale('landing-page:1')).toBe(false);
  - |
    AC3 (e2e): looping the five renderer tags
    ['home-page:1', 'landing-page:1', 'client-work:1', 'partner:1', 'services:1']
    (one per existing template: HomePageTemplate, LandingPageTemplate, ClientWorkTemplate,
    PartnerTemplate, ServicesTemplate), each call with the valid secret returns 200:
    for (const tag of tags) {
      expect((await http().post('/revalidation').set('x-revalidation-secret', secret).send({ tag })).status).toBe(200);
    }
    proving the single route accepts a call representing any of the five renderers without
    special-casing any of them.
  - |
    Unit (revalidation-config.spec.ts, mirrors drupal-config.spec.ts):
    expect(loadRevalidationConfig({ REVALIDATION_SECRET: 'shh' })).toEqual({ secret: 'shh' });
    expect(() => loadRevalidationConfig({})).toThrow(/REVALIDATION_SECRET/);
  - |
    Unit (revalidation-secret.guard.spec.ts, mirrors cognito-auth.guard.spec.ts): with
    vi.stubEnv('REVALIDATION_SECRET', 'shh'):
    expect(guard.canActivate(contextFor({ headers: { 'x-revalidation-secret': 'shh' } }))).toBe(true);
    expect(() => guard.canActivate(contextFor({ headers: {} }))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(contextFor({ headers: { 'x-revalidation-secret': 'nope' } }))).toThrow(UnauthorizedException);

assumptions_or_open_questions:
  - |
    The request shape is a `tag: string` field in a JSON POST body (reusing the existing
    registry's string-tag key space, e.g. "home-page:1"), read via header
    `x-revalidation-secret` for the token. The story's scope note explicitly assigns the
    route's final path/request shape to the parent "On-Demand Content Revalidation" epic, so
    this shape is a reasonable placeholder for this story's narrower ACs, not a contract Phase
    2 must preserve exactly.
  - |
    "The page's static content is refreshed" (AC1) is implemented as registry.markStale(tag) —
    marking the tag so a future read is treated as needing a refetch — since no actual page
    cache / fetch-on-stale consumer exists yet anywhere in the codebase. Wiring the five
    renderers in apps/web to check isStale/refetch on that signal is explicitly out of this
    story's scope ("Covers the route's existence and secret-token check needed for this
    epic's five ISR renderers to trigger revalidation" — not the renderers' consumption of
    it), so apps/web is not touched by this plan.
  - |
    REVALIDATION_SECRET is loaded lazily per request (mirroring loadDrupalConfig's "no
    fallback, load on use" pattern) rather than validated at boot. This means a deployment
    missing the env var returns a 500 (RevalidationConfigError) rather than a clean 401/403 on
    every call. Open question: should a missing secret configuration instead fail closed with
    a 401/403 response? I kept the existing lazy-load convention since no AC specifies this
    case.
  - |
    The secret comparison is a plain strict string equality check, not a constant-time
    comparison. The ACs only require accept-valid/refuse-invalid behavior, so I did not add
    timing-safe comparison as nothing in the ACs asks for it.

estimated_points: 3

package_dependencies: []

notes: |
  `services/api/src/drupal/revalidation-registry.ts` already exists with its own passing unit
  tests (`markStale`/`isStale`/`clearStale`, in `revalidation-registry.spec.ts`) but is
  currently unreferenced anywhere else in the codebase (confirmed via file listing of
  `services/api/src`) — it was built ahead of this story and never wired into a module or
  route. This plan's job is specifically to give it its first real caller via a guarded HTTP
  route, not to change its behavior.

  Verified against current code before writing this plan: `drupal-config.ts`'s lazy-load/no-
  fallback pattern, `cognito-auth.guard.ts`'s single-header-check structure,
  `create-defect.dto.ts`'s class-validator style, `app.module.ts`'s current imports list,
  `defects.module.ts`'s module-shape convention, and `create-test-app.ts` / `defects.e2e-spec.ts`
  for the e2e harness (confirms the global `ValidationPipe` with `whitelist`/
  `forbidNonWhitelisted` is active in tests, and that no provider overrides are needed for a
  route that touches neither the database nor Cognito).

  ```mermaid
  flowchart TD
    AppModule[AppModule] --> RevalidationModule[RevalidationModule]
    RevalidationModule --> RevalidationController[RevalidationController]
    RevalidationModule --> RevalidationSecretGuard[RevalidationSecretGuard]
    RevalidationModule --> RegistryProvider["REVALIDATION_REGISTRY provider"]
    RevalidationController -- "@UseGuards" --> RevalidationSecretGuard
    RevalidationController -- "@Body RevalidateDto" --> RevalidateDto[RevalidateDto]
    RevalidationController -- "@Inject" --> RegistryProvider
    RevalidationSecretGuard --> RevalidationConfig["loadRevalidationConfig(env)"]
    RegistryProvider --> ExistingRegistry["createRevalidationRegistry() (existing, unmodified)"]

    classDef touched fill:#f96,color:#000;
    class AppModule,RevalidationModule,RevalidationController,RevalidationSecretGuard,RevalidateDto,RegistryProvider,RevalidationConfig touched;
  ```

review_focus: |
  In scope: a new `POST /revalidation` route in `services/api` gated by a shared-secret header
  check, wired to the existing (previously unused) `createRevalidationRegistry()` via
  `registry.markStale(tag)`. Out of scope, deliberately: the route's final request shape and
  any Drupal webhook wiring (owned by the parent epic per the story's scope note), and any
  change to `apps/web`'s five renderer templates to actually consume `isStale`/refetch on this
  signal — this story only proves the route accepts/refuses calls, not that a renderer's render
  path reacts to it yet. The riskiest/most judgment-laden spot is `RevalidationSecretGuard`
  loading `REVALIDATION_SECRET` lazily per request (mirroring `loadDrupalConfig`'s existing
  "no fallback, load on use" convention) rather than validating it at boot — a reviewer could
  read a missing-env 500 as a bug, but it's a deliberate match of the existing Drupal-config
  convention in this same service, flagged as an open question above rather than silently
  resolved.

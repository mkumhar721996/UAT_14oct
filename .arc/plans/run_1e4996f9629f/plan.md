summary: |
  Adds the reusable, framework-agnostic mechanism for typed Drupal JSON:API fetching that any
  future content/paragraph-specific fetcher will be built from: a `createTypedFetcher()` factory
  (wraps the existing `services/api/src/drupal/drupal-client.ts`'s `fetchDrupalResource()`,
  attaches a configured `include` parameter list, parses the raw JSON:API resource into a typed
  shape, and carries a `cacheStrategy` tag distinguishing the ISR-style "static-revalidatable"
  path from the SSR-style "per-request" path); a `createResourceRegistry()`/`resolveResources()`
  pair implementing the one-lookup paragraph/content-type-to-fetcher(+component-key) dispatch
  that replaces Gatsby's schema plugin, including the "unresolved" outcome for an unregistered
  type; and a `createRevalidationRegistry()` tag-based staleness mechanism for on-demand
  invalidation. No concrete Drupal content type, paragraph type, or Gatsby include-parameter list
  is registered or invented here: per explicit reviewer direction, none of that content model is
  documented anywhere in this repository (no Gatsby config, no content-model doc, no ADR), so this
  plan builds and tests only the generic mechanism — proven with clearly-labeled example/fixture
  types in its tests — and defers registering real types to follow-up work once that information
  is available. Page rendering, the actual SSR/ISR hosting behavior, and any on-demand-revalidation
  HTTP route are explicitly out of scope per the reviewer's latest direction; this plan exposes
  only the metadata/mechanism a future rendering-layer story would consume.

scope:
  - description: |
      Add the JSON:API resource shape types used by every typed fetcher (AC5's "fields typed per
      its Drupal type" starts here — these are the generic JSON:API spec shapes, not any
      Drupal-specific content model).
      ```ts
      export interface JsonApiResourceIdentifier {
        type: string;
        id: string;
      }

      export interface JsonApiResource<Attributes = Record<string, unknown>> extends JsonApiResourceIdentifier {
        attributes: Attributes;
        relationships?: Record<string, { data: JsonApiResourceIdentifier | JsonApiResourceIdentifier[] | null }>;
      }
      ```
    files:
      - services/api/src/drupal/jsonapi-types.ts
    rationale: |
      A shared, generic JSON:API shape (per the public JSON:API spec, not a guessed Drupal
      content/paragraph model) is the one piece every typed fetcher and the registry below need
      to agree on, so it is factored out rather than duplicated per fetcher.

  - description: |
      Add `createTypedFetcher()`, the factory every concrete content/paragraph fetcher will be
      built from once real type/include data exists. It wraps the existing
      `fetchDrupalResource()` from `services/api/src/drupal/drupal-client.ts` (built in
      UAT-14OCT-STORY-037), appends the configured `include` list as a single query string,
      parses the response into the caller's typed shape, and exposes a `cacheStrategy` tag.
      ```ts
      export type FetchCacheStrategy = 'static-revalidatable' | 'per-request';

      export interface TypedResourceDefinition<T> {
        jsonApiType: string;
        endpoint: string;
        include: readonly string[];
        cacheStrategy: FetchCacheStrategy;
        parse: (resource: JsonApiResource) => T;
      }

      export interface TypedFetcher<T> {
        jsonApiType: string;
        cacheStrategy: FetchCacheStrategy;
        fetchById: (id: string, env?: NodeJS.ProcessEnv) => Promise<T>;
      }

      export function createTypedFetcher<T>(definition: TypedResourceDefinition<T>): TypedFetcher<T> {
        return {
          jsonApiType: definition.jsonApiType,
          cacheStrategy: definition.cacheStrategy,
          async fetchById(id, env = process.env) {
            const query = definition.include.length > 0 ? `?include=${definition.include.join(',')}` : '';
            const body = (await fetchDrupalResource(`${definition.endpoint}/${id}${query}`, env)) as { data: JsonApiResource };
            return definition.parse(body.data);
          },
        };
      }
      ```
      `include` is "ported from the existing Gatsby config" per the story description, but no
      Gatsby config or content-model document is available anywhere in this repo or the attached
      context, so no real `include` lists are hard-coded here — `include` is a parameter any
      future concrete fetcher definition supplies once that data is known; this scope item only
      proves the plumbing passes whatever list it is given straight through as the request's
      `include` query parameter (AC3), and that `cacheStrategy` is carried as inspectable metadata
      rather than enforced behavior (AC6/AC7/AC8 — see assumptions for what is and isn't proven).
    files:
      - services/api/src/drupal/typed-fetcher.ts
    rationale: |
      Centralizing include-param pass-through and response parsing here is what makes "every
      typed fetcher requests the same include set as its Gatsby equivalent" (AC3) and "every typed
      fetcher returns typed fields" (AC5) true by construction for any fetcher built on top of it,
      once concrete definitions exist, without duplicating request-building logic per type.

  - description: |
      Add `createResourceRegistry()` and `resolveResources()`, the single lookup that dispatches a
      JSON:API resource to its registered typed fetcher by `type` string, replacing Gatsby's
      schema plugin. Registering a `componentKey` is optional (paragraphs use it; plain content
      items don't need one for AC1).
      ```ts
      export interface ResourceRegistration<T> {
        jsonApiType: string;
        fetcher: TypedFetcher<T>;
        componentKey?: string;
      }

      export interface ResolvedResource<T = unknown> {
        status: 'resolved';
        jsonApiType: string;
        componentKey?: string;
        data: T;
      }

      export interface UnresolvedResource {
        status: 'unresolved';
        jsonApiType: string;
      }

      export function createResourceRegistry() {
        const entries = new Map<string, ResourceRegistration<unknown>>();
        return {
          register<T>(registration: ResourceRegistration<T>): void {
            if (entries.has(registration.jsonApiType)) {
              throw new Error(`A fetcher is already registered for JSON:API type "${registration.jsonApiType}"`);
            }
            entries.set(registration.jsonApiType, registration as ResourceRegistration<unknown>);
          },
          resolve(jsonApiType: string): ResourceRegistration<unknown> | undefined {
            return entries.get(jsonApiType);
          },
        };
      }

      export type ResourceRegistry = ReturnType<typeof createResourceRegistry>;

      export async function resolveResources(
        registry: ResourceRegistry,
        resources: readonly JsonApiResourceIdentifier[],
        env?: NodeJS.ProcessEnv,
      ): Promise<Array<ResolvedResource<unknown> | UnresolvedResource>> {
        return Promise.all(
          resources.map(async (resource) => {
            const registration = registry.resolve(resource.type);
            if (!registration) {
              return { status: 'unresolved', jsonApiType: resource.type };
            }
            const data = await registration.fetcher.fetchById(resource.id, env);
            return { status: 'resolved', jsonApiType: resource.type, componentKey: registration.componentKey, data };
          }),
        );
      }
      ```
      `componentKey` is a plain string identifier, not a React component reference, so this stays
      framework-agnostic; a future rendering-layer story (in `apps/web` or wherever templates end
      up living) is expected to map a resolved `componentKey` to an actual UI component.
    files:
      - services/api/src/drupal/resource-registry.ts
    rationale: |
      `register()` throwing on a duplicate `jsonApiType` is what makes AC4's "the single component
      registered for its type in one lookup" structurally true (never ambiguous) rather than
      something a caller must remember to check. `resolveResources()` returning a per-item
      `'unresolved'` marker instead of throwing — and resolving the rest of the array regardless —
      is what proves AC9 (a distinguishable "not found" outcome exists for a future renderer to
      show as a visible error) and AC10 (the other items in the same batch are never dropped or
      short-circuited by one unregistered type), without this plan building any actual rendering.

  - description: |
      Add `createRevalidationRegistry()`, a minimal tag-based staleness mechanism standing in for
      "the on-demand revalidation route" referenced by AC11/AC12. No HTTP route is added — that is
      page-rendering/hosting infrastructure explicitly out of scope per the reviewer's direction —
      this is only the data-layer primitive a future route and a future fetch-caching layer would
      call into.
      ```ts
      export function createRevalidationRegistry() {
        const stale = new Set<string>();
        return {
          markStale(tag: string): void {
            stale.add(tag);
          },
          isStale(tag: string): boolean {
            return stale.has(tag);
          },
          clearStale(tag: string): void {
            stale.delete(tag);
          },
        };
      }

      export type RevalidationRegistry = ReturnType<typeof createRevalidationRegistry>;
      ```
    files:
      - services/api/src/drupal/revalidation-registry.ts
    rationale: |
      Modeling invalidation as an explicit, caller-driven `markStale(tag)` with no time-based
      expiry anywhere in the implementation is what makes AC12 ("even after time passes, the page
      continues to show previously fetched data") true by construction — there is no clock-driven
      path that could ever mark something stale on its own, only an explicit call a future
      revalidation route would make (AC11).

  - description: |
      Unit tests for each module above, covering AC1-AC12 as listed in the `tests` section below,
      using only clearly-labeled example/fixture JSON:API types (e.g. `example--article`,
      `example--quote`) — never a real Drupal content or paragraph type name, since none is
      documented anywhere available to this plan.
    files:
      - services/api/src/drupal/typed-fetcher.spec.ts
      - services/api/src/drupal/resource-registry.spec.ts
      - services/api/src/drupal/revalidation-registry.spec.ts
    rationale: |
      Mirrors the existing `drupal-client.spec.ts`/`drupal-config.spec.ts` convention of mocking
      `globalThis.fetch` directly rather than mocking `fetchDrupalResource`, and of testing each
      pure module in isolation.

tests:
  - |
    AC1 (resource-registry.spec.ts): a content resource dispatches to its registered typed
    fetcher by JSON:API type.
    ```ts
    const registry = createResourceRegistry();
    registry.register({ jsonApiType: 'example--article', fetcher: fixtureFetcher('example--article', { title: 'Hi' }) });
    const [resolved] = await resolveResources(registry, [{ type: 'example--article', id: '1' }]);
    expect(resolved).toEqual({ status: 'resolved', jsonApiType: 'example--article', componentKey: undefined, data: { title: 'Hi' } });
    ```
  - |
    AC2 (resource-registry.spec.ts): a paragraph resource dispatches to its registered typed
    fetcher and component key by JSON:API type.
    ```ts
    const registry = createResourceRegistry();
    registry.register({ jsonApiType: 'example--quote', fetcher: fixtureFetcher('example--quote', { text: 'quoted' }), componentKey: 'QuoteParagraph' });
    const [resolved] = await resolveResources(registry, [{ type: 'example--quote', id: '2' }]);
    expect(resolved).toEqual({ status: 'resolved', jsonApiType: 'example--quote', componentKey: 'QuoteParagraph', data: { text: 'quoted' } });
    ```
  - |
    AC3 (typed-fetcher.spec.ts): the fetcher requests exactly the configured include set as a
    single `include` query parameter.
    ```ts
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { type: 'example--article', id: '1', attributes: { title: 'Hi' } } }), { status: 200 }),
    );
    const fetchExampleArticle = createTypedFetcher<{ title: string }>({
      jsonApiType: 'example--article', endpoint: '/jsonapi/example/article',
      include: ['field_image', 'field_author'], cacheStrategy: 'static-revalidatable',
      parse: (r) => ({ title: r.attributes.title as string }),
    });
    await fetchExampleArticle.fetchById('1', ENV);
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('include')).toBe('field_image,field_author');
    ```
  - |
    AC4 (resource-registry.spec.ts): registering a second fetcher/component for a type already
    registered is rejected, so resolution is never ambiguous.
    ```ts
    const registry = createResourceRegistry();
    registry.register({ jsonApiType: 'example--quote', fetcher: fixtureFetcher('example--quote', {}), componentKey: 'QuoteParagraph' });
    expect(() => registry.register({ jsonApiType: 'example--quote', fetcher: fixtureFetcher('example--quote', {}), componentKey: 'OtherParagraph' }))
      .toThrow(/already registered/);
    ```
  - |
    AC5 (typed-fetcher.spec.ts): the fetcher returns the resource parsed into its typed shape,
    not the raw JSON:API attributes blob.
    ```ts
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { type: 'example--article', id: '1', attributes: { title: 'Hi', body: 'unused' } } }), { status: 200 }),
    );
    const fetchExampleArticle = createTypedFetcher<{ title: string }>({
      jsonApiType: 'example--article', endpoint: '/jsonapi/example/article', include: [], cacheStrategy: 'static-revalidatable',
      parse: (r) => ({ title: r.attributes.title as string }),
    });
    await expect(fetchExampleArticle.fetchById('1', ENV)).resolves.toEqual({ title: 'Hi' });
    ```
  - |
    AC6 (typed-fetcher.spec.ts): an SSR-path (search-results/career-listings-style) definition
    exposes the `per-request` cache strategy, and issues a fresh HTTP request on every call
    rather than this layer ever serving a cached response itself.
    ```ts
    const fetcher = createTypedFetcher({ jsonApiType: 'example--search-result', endpoint: '/jsonapi/example/search-result', include: [], cacheStrategy: 'per-request', parse: (r) => r });
    expect(fetcher.cacheStrategy).toBe('per-request');
    await fetcher.fetchById('1', ENV);
    await fetcher.fetchById('1', ENV);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    ```
  - |
    AC7 (typed-fetcher.spec.ts): the same per-request definition is never invoked by any
    build-time code path in this plan — there is no pre-fetch/pre-build hook anywhere in this
    scope, only `fetchById()` called explicitly by a caller, so nothing here generates a page
    ahead of a request. Verified by inspection (no new build script/hook is added) plus the
    AC6 test above showing every call is a live request, not a replay of a cached one.
  - |
    AC8 (typed-fetcher.spec.ts): a marketing/landing-style definition exposes the
    `static-revalidatable` cache strategy, the metadata a future rendering layer would use to
    decide to serve a prebuilt copy instead of fetching per request.
    ```ts
    const fetcher = createTypedFetcher({ jsonApiType: 'example--landing-page', endpoint: '/jsonapi/example/landing-page', include: [], cacheStrategy: 'static-revalidatable', parse: (r) => r });
    expect(fetcher.cacheStrategy).toBe('static-revalidatable');
    ```
  - |
    AC9 (resource-registry.spec.ts): an unregistered paragraph type resolves to a distinguishable
    `'unresolved'` marker instead of throwing, the outcome a future renderer would show as a
    visible error in place of that paragraph.
    ```ts
    const registry = createResourceRegistry();
    const [resolved] = await resolveResources(registry, [{ type: 'example--unregistered', id: '1' }]);
    expect(resolved).toEqual({ status: 'unresolved', jsonApiType: 'example--unregistered' });
    ```
  - |
    AC10 (resource-registry.spec.ts): the other paragraphs in the same batch still resolve when
    one type is unregistered.
    ```ts
    const registry = createResourceRegistry();
    registry.register({ jsonApiType: 'example--quote', fetcher: fixtureFetcher('example--quote', { text: 'quoted' }), componentKey: 'QuoteParagraph' });
    const resolved = await resolveResources(registry, [{ type: 'example--unregistered', id: '1' }, { type: 'example--quote', id: '2' }]);
    expect(resolved).toEqual([
      { status: 'unresolved', jsonApiType: 'example--unregistered' },
      { status: 'resolved', jsonApiType: 'example--quote', componentKey: 'QuoteParagraph', data: { text: 'quoted' } },
    ]);
    ```
  - |
    AC11 (revalidation-registry.spec.ts): marking a tag stale (standing in for the on-demand
    revalidation route targeting that content) makes the next staleness check report it needs
    revalidating.
    ```ts
    const registry = createRevalidationRegistry();
    expect(registry.isStale('node:42')).toBe(false);
    registry.markStale('node:42');
    expect(registry.isStale('node:42')).toBe(true);
    ```
  - |
    AC12 (revalidation-registry.spec.ts): a tag that is never targeted by a revalidation call
    stays fresh, with no time-based path in the implementation that could ever mark it stale on
    its own.
    ```ts
    const registry = createRevalidationRegistry();
    registry.markStale('node:99');
    expect(registry.isStale('node:42')).toBe(false);
    ```

assumptions_or_open_questions:
  - |
    No verified source for the five page templates, the Drupal content types or paragraph types
    they use, or the Gatsby query include-parameter lists exists in this repository, the attached
    `events.txt` context (which only logs a `worktree_created` event), or the prior story's plan.
    Per the reviewer's explicit direction, none of this is fabricated. This plan builds only the
    generic `createTypedFetcher`/`createResourceRegistry`/`createRevalidationRegistry` mechanism
    and proves it with clearly-labeled example/fixture types (`example--article`,
    `example--quote`, `example--search-result`, `example--landing-page`) — never a real Drupal
    type name. Registering real content/paragraph types with their real include lists is
    follow-up work, blocked on access to the legacy Gatsby config and/or a Drupal content-model
    document.
  - |
    Per the reviewer's direction, the SSR/ISR page-rendering layer, the actual on-demand
    revalidation HTTP route, and any build-time static generation are out of scope for this plan.
    AC6-AC8 and AC11-AC12 are therefore only proven at the level of "the fetcher/registry exposes
    the right metadata and staleness primitive a future rendering layer would consume" — not at
    the level of an actual page being served statically, server-rendered, or revalidated. A future
    story that builds the page-rendering layer is expected to consume `cacheStrategy` and
    `createRevalidationRegistry()` to implement the real build-vs-per-request and revalidation
    behavior.
  - |
    The six legacy HTML-fragment paragraph types that the story explicitly excludes are not named
    anywhere available to this plan either; since no concrete paragraph types are registered at
    all here, there's nothing to exclude yet — noting this so a future story doesn't assume this
    plan already distinguishes "native JSON:API" paragraph types from the legacy six.
  - |
    `componentKey` is modeled as a plain string identifier rather than a real UI component
    reference (e.g. a React component), keeping `resource-registry.ts` framework-agnostic per the
    reviewer's direction. Whatever future story builds the rendering layer is expected to own the
    mapping from a resolved `componentKey` string to an actual component; no such mapping is added
    to `apps/web` by this plan, and no new entry is added to the existing UI component catalogue
    (`ActiveGrid`/`Banner`/`CoreFieldInput`/`Layout`/`Toast`) since none of them render paragraphs.
  - |
    AC9's "a visible error is shown in place of that paragraph" is satisfied at this layer by
    `resolveResources` returning a typed `{ status: 'unresolved' }` marker instead of throwing —
    the same "prove the error condition is always surfaced, not silently swallowed, even though no
    UI exists yet to render it" pattern used by UAT-14OCT-STORY-037's plan for its own "visible
    error" AC. Rendering that marker as an actual visible error is deferred to the future
    rendering-layer story.
  - |
    Continues placing all of this in `services/api` (not `apps/web`), the same reasoning
    UAT-14OCT-STORY-037's plan gave: the Drupal bearer credential must stay server-side. No new
    NestJS module/controller/provider is added — there is still no consumer (controller or
    rendering layer) to wire these into, matching STORY-037's precedent of leaving plain exported
    functions unregistered until a real caller exists.

estimated_points: 5

package_dependencies: []

notes: |
  No new third-party dependency is needed: this plan only adds plain TypeScript modules on top of
  the existing `fetchDrupalResource()`/`loadDrupalConfig()` primitive and Node's global `fetch`,
  and `vitest` (already a `services/api` devDependency) covers every test via the same
  `globalThis.fetch` mocking convention `drupal-client.spec.ts` already established.

  ```mermaid
  flowchart TD
    classDef touched fill:#f96,color:#000
    classDef context fill:#eee,color:#000

    DrupalConfig["drupal-config.ts\nloadDrupalConfig()"]:::context
    DrupalClient["drupal-client.ts\nfetchDrupalResource()"]:::context
    JsonApiTypes["jsonapi-types.ts\nJsonApiResource / Identifier"]:::touched
    TypedFetcher["typed-fetcher.ts\ncreateTypedFetcher()"]:::touched
    ResourceRegistry["resource-registry.ts\ncreateResourceRegistry() / resolveResources()"]:::touched
    RevalidationRegistry["revalidation-registry.ts\ncreateRevalidationRegistry()"]:::touched

    DrupalClient --> DrupalConfig
    TypedFetcher -->|"reuses STORY-037's shared fetch primitive"| DrupalClient
    TypedFetcher -->|"typed by"| JsonApiTypes
    ResourceRegistry -->|"dispatches to a registered"| TypedFetcher
    ResourceRegistry -->|"resource identifiers typed by"| JsonApiTypes
    RevalidationRegistry -.->|"tag mechanism; no caller yet,\nfuture rendering layer wires this in"| TypedFetcher
  ```

review_focus: |
  In scope: the generic typed-fetcher factory, the type-to-fetcher(+component-key) registry with
  its duplicate-rejection and unresolved-marker behavior, and the tag-based revalidation
  primitive — plus their unit tests, proven only against clearly-labeled example/fixture JSON:API
  types. Out of scope and not to be flagged as missing: any real Drupal content/paragraph type
  registration (no Gatsby config or content-model doc was available to this plan — see
  assumptions), the actual SSR/ISR page-rendering layer, any on-demand-revalidation HTTP route,
  and any UI that renders a resolved component or an unresolved-paragraph error (no change to the
  existing UI component catalogue is expected or warranted here). Riskiest/most deliberate
  decision to check: AC6-AC8 and AC11-AC12 are satisfied only at the metadata/mechanism level
  (`cacheStrategy` tag, `markStale`/`isStale`) rather than by any real build-time generation,
  per-request serving, or HTTP revalidation route — don't flag the absence of that runtime
  behavior as a gap in this plan, it is explicitly deferred to a future rendering-layer story.
  Also verify `resolveResources()`'s unresolved-item handling never throws and never drops
  sibling items in the same batch (AC9/AC10), and that `register()` throws before a second
  registration for the same type can ever be resolved (AC4).

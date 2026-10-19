summary: |
  Rebuilds the ClientWork page template so a published `client_work` Drupal node renders its
  real title/body/hero-image content (no placeholder), dispatches each of its paragraph
  instances through the existing shared `resource-registry` dispatch table (native component
  for modern paragraph types, a fetched HTML fragment for the legacy ones), and is served
  through a cached "composed page" layer in `comp_api_service` that behaves like static
  generation with incremental revalidation: first request composes and caches the page, a
  shared-secret-protected `/pages/revalidate` route lets an editor force the next request to
  recompose it, and an independent fallback TTL recomposes it even with no explicit call.
  `comp_web_app` is a client-rendered Vite SPA (confirmed stack) and `comp_api_service` is
  NestJS — neither is a Next.js SSG/ISR runtime, so "statically generated" and "ISR" are
  approximated as described in `notes` rather than built with a new framework. Today
  `ClientWorkTemplate` is a one-line stub (`{node.contentType}`), `TemplateRouter`/
  `resolveTemplateType` only pick which template to mount, and `resource-registry` /
  `typed-fetcher` / `revalidation-registry` (STORY-038/-044) are generic, unwired primitives
  with no HTTP route, no cache, and no paragraph/content registrations behind them yet. This
  plan wires all of that together for ClientWork specifically, including the partial-failure,
  cache-concurrency and malformed-input edge cases a real deployment will hit; the paragraph UI
  components themselves stay out of scope (Paragraph/Component Library epic).

scope:
  - description: |
      Add `fetchDrupalHtmlFragment(path, env)` to `services/api/src/drupal/drupal-client.ts`,
      alongside the existing `fetchDrupalResource`, for legacy paragraphs whose Drupal endpoint
      returns a rendered HTML string rather than a JSON:API document.

      ```ts
      export async function fetchDrupalHtmlFragment(
        path: string,
        env: NodeJS.ProcessEnv = process.env,
      ): Promise<string> {
        const config = loadDrupalConfig(env);
        const url = new URL(path, config.baseUrl).toString();
        const response = await fetch(url, { headers: { Authorization: `Bearer ${config.accessToken}` } });
        if (!response.ok) throw new DrupalFetchError(`Drupal request to ${path} failed with status ${response.status}`);
        return response.text();
      }
      ```
    files:
      - services/api/src/drupal/drupal-client.ts
      - services/api/src/drupal/drupal-client.spec.ts
    rationale: |
      `fetchDrupalResource` always calls `.json()`, which throws on a non-JSON HTML body, so the
      six legacy paragraph types need their own thin fetch primitive built on the same
      config/auth/error plumbing rather than a parallel client.

  - description: |
      Add `createHtmlFragmentFetcher(definition)` in a new `services/api/src/drupal/html-fragment-fetcher.ts`,
      mirroring `createTypedFetcher`'s shape so both can sit behind the same `ResourceRegistration`:

      ```ts
      export interface HtmlFragmentFetcher {
        jsonApiType: string;
        cacheStrategy: FetchCacheStrategy;
        fetchById: (id: string, env?: NodeJS.ProcessEnv) => Promise<{ html: string }>;
      }
      export function createHtmlFragmentFetcher(definition: {
        jsonApiType: string;
        endpoint: string;
        cacheStrategy: FetchCacheStrategy;
      }): HtmlFragmentFetcher
      ```
      A non-OK or network-failing fetch rejects with `DrupalFetchError`/the underlying error
      exactly like `fetchDrupalResource` does, so `resolveResources` isolates it into a single
      `{ status: 'failed' }` entry rather than throwing out of the whole composition.
    files:
      - services/api/src/drupal/html-fragment-fetcher.ts
      - services/api/src/drupal/html-fragment-fetcher.spec.ts
    rationale: |
      `TypedFetcher<T>.fetchById` returns a parsed JSON:API resource; a legacy paragraph has no
      typed shape to parse, only a fragment of markup, but it still needs to satisfy
      `ResourceRegistration.fetcher: TypedFetcher<T>` so `resolveResources` can dispatch it
      identically to a native-component paragraph. Wrapping the result as `{ html }` keeps the
      `ResolvedResource.data` shape uniform (always an object) for the web side to consume.

  - description: |
      Add `services/api/src/pages/page-cache.ts`: a tag-keyed cache with a fallback TTL that
      also honors `RevalidationRegistry`'s explicit stale marks, and dedupes concurrent misses
      for the same tag so a burst of requests right after expiry/revalidation triggers exactly
      one recomposition.

      ```ts
      export interface PageCache {
        getOrCompose<T>(tag: string, ttlMs: number, compose: () => Promise<T>): Promise<T>;
      }
      export function createPageCache(revalidation: RevalidationRegistry, now: () => number = Date.now): PageCache
      ```
      `getOrCompose` recomposes (calls `compose()` at most once per concurrent miss, stores
      `{ value, cachedAt: now() }` only on success, calls `revalidation.clearStale(tag)`) when
      there is no entry, `revalidation.isStale(tag)` is true, or `now() - cachedAt >= ttlMs`;
      otherwise it returns the cached value without calling `compose()`. A rejected `compose()`
      clears the in-flight marker without poisoning the cache, so the next call retries instead
      of permanently serving an error.
    files:
      - services/api/src/pages/page-cache.ts
      - services/api/src/pages/page-cache.spec.ts
    rationale: |
      `revalidation-registry.ts` is explicitly tag-based with "deliberately no time-based
      expiry" (STORY-038 decision, see `notes`); AC6 needs a fallback TTL, so this adds it as a
      layer on top of, not a change to, the existing registry. Dedup/retry-on-failure are added
      because a cache that either double-fetches on every expiry or wedges itself after one
      transient Drupal error is the two most likely real incidents for this layer — any other
      template renderer reusing this same cache/registry pair inherits both fixes for free.

  - description: |
      Add the ClientWork-specific content fetcher and paragraph registrations:
      `services/api/src/pages/client-work/client-work-page.fetcher.ts` builds a `TypedFetcher`
      for `node--client_work` (title, body, hero image, ordered paragraph references) with
      `createTypedFetcher`; `services/api/src/pages/client-work/client-work-paragraphs.ts`
      registers each paragraph type the field allows into one shared `ResourceRegistry`
      instance — native ones with `createTypedFetcher` + `componentKey`, the six legacy ones
      with `createHtmlFragmentFetcher` and no `componentKey` (its absence is the signal the web
      side uses to render the generic HTML-fragment path instead of a named component).
      `registerClientWorkParagraphs` is written to be safe to call only once per `ResourceRegistry`
      instance (it is invoked exactly once, from `pages.module.ts`'s provider factory); calling
      it twice on the same registry still surfaces `resource-registry.ts`'s existing "already
      registered" error rather than silently overwriting an entry.
    files:
      - services/api/src/pages/client-work/client-work-page.fetcher.ts
      - services/api/src/pages/client-work/client-work-page.fetcher.spec.ts
      - services/api/src/pages/client-work/client-work-paragraphs.ts
      - services/api/src/pages/client-work/client-work-paragraphs.spec.ts
    rationale: |
      This is the "shared paragraph dispatch table" named in scope: `resource-registry.ts`
      already implements dispatch generically (STORY-038); ClientWork's job is only to supply
      its own type→fetcher/componentKey registrations into it. The real Drupal machine names
      for the six legacy types are not available in this run's context — see
      `assumptions_or_open_questions`.

  - description: |
      Add `services/api/src/pages/pages.service.ts` (`PagesService.composeClientWorkPage(id,
      env?)`): fetches the node via the client-work fetcher, resolves its paragraph list via
      `resolveResources`, and returns a flat JSON shape:

      ```ts
      interface ComposedClientWorkPage {
        pageId: string;
        title: string;
        body: string;
        heroImage: { url: string; alt: string } | null;
        paragraphs: Array<
          | { status: 'component'; componentKey: string; data: unknown }
          | { status: 'html-fragment'; html: string }
          | { status: 'unresolved' | 'failed' }
        >;
      }
      ```
      A `DrupalFetchError` with a 404 status from the node fetch itself (unknown/unpublished
      `id`) propagates out of `composeClientWorkPage` as a typed `PageNotFoundError`, which
      `pages.controller.ts` maps to an HTTP 404 (not a 500, and not a cached negative result —
      a not-found response is never stored in `PageCache`, so a page published moments later is
      visible on the very next request). `pages.controller.ts` exposes `GET
      /pages/client-work/:id` (no auth guard — a published marketing page is public, matching
      the original site) backed by `pageCache.getOrCompose('node:' + id, PAGE_CACHE_TTL_MS, () =>
      composeClientWorkPage(id))`, and `POST /pages/revalidate` (body `{ tag: string }`, header
      `x-revalidate-secret`) guarded by a secret comparison against `REVALIDATION_SHARED_SECRET`,
      returning 401 on a missing/wrong secret, 400 when `tag` is missing/blank, and 200 with no
      error when `tag` names a page that was never cached (revalidation is idempotent: it only
      ever sets a flag the cache may or may not currently care about) and otherwise calling
      `revalidation.markStale(tag)`.
    files:
      - services/api/src/pages/pages.service.ts
      - services/api/src/pages/pages.controller.ts
      - services/api/src/pages/pages.module.ts
      - services/api/src/pages/revalidation-secret.guard.ts
      - services/api/src/pages/revalidation-secret.guard.spec.ts
      - services/api/src/app.module.ts
      - services/api/test/pages.e2e-spec.ts
    rationale: |
      `pages.controller.ts` is the "shared revalidation route" the epic/scope refers to: naming
      and placing it generically (not `client-work-revalidate`) lets the sibling HomePage/
      LandingPage/Partner/Services stories reuse the same route and `PageCache`/
      `RevalidationRegistry` pair, registering their own tags, without this story building their
      content fetchers too. The 404/idempotent-revalidate/no-negative-caching behaviors are the
      realistic failure modes of "a page id that doesn't currently resolve" — a 500 or a cached
      404 would both be worse than the plain 404 + no-cache response planned here.

  - description: |
      Replace the `ClientWorkTemplate` stub with real rendering of title/body/hero image, and
      add two small shared rendering primitives it (and, later, other templates) dispatch
      paragraphs through:

      ```tsx
      export function ClientWorkTemplate({ node }: { node: ClientWorkPageData }) {
        return (
          <article data-testid="client-work-template">
            <h1>{node.title}</h1>
            {node.heroImage && <img src={node.heroImage.url} alt={node.heroImage.alt} />}
            <div data-testid="client-work-body" dangerouslySetInnerHTML={{ __html: node.body }} />
            <ParagraphList paragraphs={node.paragraphs} />
          </article>
        )
      }
      ```
      `ParagraphList` looks up `componentKey` in a small injected map (empty by default — real
      entries are added by the Paragraph/Component Library epic) and falls back to
      `HtmlFragmentParagraph` (`dangerouslySetInnerHTML`) for `status: 'html-fragment'` entries.
      It renders nothing (not `null` thrown, not a crash) for a `'unresolved'`/`'failed'` entry
      and for a `'component'` entry whose `componentKey` has no matching entry in `componentMap`
      yet (the common steady state until the Paragraph/Component Library epic lands each
      component) — in every one of those cases every *other* paragraph in the list still
      renders, mirroring `resolveResources`' own per-item isolation.
    files:
      - apps/web/src/components/templates/ClientWorkTemplate.tsx
      - apps/web/src/components/templates/ClientWorkTemplate.test.tsx
      - apps/web/src/components/ParagraphList.tsx
      - apps/web/src/components/ParagraphList.test.tsx
      - apps/web/src/components/HtmlFragmentParagraph.tsx
      - apps/web/src/lib/templates/types.ts
    rationale: |
      AC1-AC3 are rendering concerns that belong in `comp_web_app`; `ParagraphList`/
      `HtmlFragmentParagraph` are the generic dispatch/fragment-render mechanism (not a specific
      paragraph's UI), so they stay in this story's scope per the epic's "native components, or
      HTML-fragment fetches" split, while any named paragraph component itself does not. Silent,
      isolated skipping of an unresolved/failed/not-yet-built paragraph is deliberate: a missing
      one paragraph must not blank the whole page for every other instance's content.

  - description: |
      Add the public page route: `apps/web/src/routes/ClientWorkPage.tsx` reads `:pageId` from
      the URL, calls `apiClient.get<ClientWorkPageData>('/pages/client-work/' + encodeURIComponent(pageId))`,
      and renders `<ClientWorkTemplate node={data} />` (loading/error states follow the existing
      `useAsync` + `Banner` pattern used by `PageInventoryPage`, including a dedicated "page not
      found" message on a 404 `ApiError` distinct from the generic failure banner). Wire
      `<Route path="/client-work/:pageId" element={<ClientWorkPage />} />` into the
      unauthenticated branch of `App.tsx` (signed-out `<Routes>` block) since a published
      marketing page must be publicly viewable, matching the original site.
    files:
      - apps/web/src/routes/ClientWorkPage.tsx
      - apps/web/src/routes/ClientWorkPage.test.tsx
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
    rationale: |
      No route currently renders any of the five templates for an end user — `TemplateRouter`
      is wired to nothing (`App.tsx` has no page-content route at all). AC1/AC2/AC3/AC4 all say
      "WHEN its page is requested", which requires an actual routable page, not just a
      component that exists in isolation. A 404 is a distinct, expected outcome (unpublished or
      mistyped id), not the same "something went wrong, retry" state as a network/API failure.

  - description: |
      Add a Playwright smoke/parity check:
      `apps/web/e2e/client-work.spec.ts` navigates to `/client-work/:pageId` against a stubbed
      API response fixture (title, body with a link, hero image, one native-style and one
      html-fragment paragraph) and asserts the rendered DOM shows that exact text, image
      `alt`/`src`, and fragment markup, with no stub/placeholder text anywhere on the page.
    files:
      - apps/web/e2e/client-work.spec.ts
    rationale: |
      AC7 ("no visible text, image, layout or interactive difference") is a human visual-parity
      judgment recorded per page instance via the existing Page Instance Inventory review flow
      (STORY-050, `POST /inventory/:pageId/results`), which is out of this story's scope. This
      Playwright check is the automatable floor under that: it proves the real route renders
      real content end-to-end, so a parity reviewer is checking actual rendered output, not a
      stub.

tests:
  - |
    AC1 (web, ClientWorkTemplate.test.tsx): render(<ClientWorkTemplate node={{ title: 'Acme
    Redesign', body: '<p>We helped Acme ship.</p>', heroImage: { url: '/h.jpg', alt: 'Acme
    hero' }, paragraphs: [] }} />); expect(screen.getByText('Acme Redesign')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Acme hero' })).toHaveAttribute('src', '/h.jpg');
    expect(screen.getByTestId('client-work-body').innerHTML).toContain('We helped Acme ship.');
    expect(screen.queryByText('client_work')).not.toBeInTheDocument() — the last assertion is
    the failing one today (the stub renders `node.contentType` verbatim).
  - |
    AC1 edge case (web, ClientWorkTemplate.test.tsx): render(<ClientWorkTemplate node={{ title:
    '', body: '', heroImage: null, paragraphs: [] }} />); expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('client-work-body').innerHTML).toBe('') — an instance with a
    genuinely empty field renders empty, never a hardcoded placeholder like "No title" or
    "Untitled".
  - |
    AC2 (web, ParagraphList.test.tsx): render(<ParagraphList paragraphs={[{ status:
    'component', componentKey: 'Quote', data: { text: 'hi' } }]} componentMap={{ Quote: ({
    data }) => <div data-testid="quote">{data.text}</div> }} />);
    expect(screen.getByTestId('quote')).toHaveTextContent('hi'); and a second case asserting
    `screen.queryByTestId('html-fragment')` is absent for a `'component'` entry.
  - |
    AC2 edge case (web, ParagraphList.test.tsx): render(<ParagraphList paragraphs={[{ status:
    'component', componentKey: 'NotYetBuilt', data: {} }, { status: 'component', componentKey:
    'Quote', data: { text: 'hi' } }]} componentMap={{ Quote: ({ data }) => <div
    data-testid="quote">{data.text}</div> }} />); expect(() => render(...)).not.toThrow();
    expect(screen.getByTestId('quote')).toBeInTheDocument() — an unmapped `componentKey` (the
    Paragraph/Component Library hasn't added it yet) is skipped without crashing or hiding its
    siblings.
  - |
    AC2 edge case (web, ParagraphList.test.tsx): render(<ParagraphList paragraphs={[{ status:
    'unresolved' }, { status: 'failed' }, { status: 'component', componentKey: 'Quote', data: {
    text: 'hi' } }]} componentMap={{ Quote: ... }} />); expect(screen.getByTestId('quote')).toBeInTheDocument();
    expect(screen.getAllByTestId(/.+/)).toHaveLength(1) — an unresolved/failed paragraph renders
    nothing but does not prevent a later sibling from rendering.
  - |
    AC2 (api, client-work-paragraphs.spec.ts): const registry = createResourceRegistry();
    registerClientWorkParagraphs(registry); const resolved = await resolveResources(registry,
    [{ type: '<native-paragraph-type>', id: '1' }]); expect(resolved[0].status).toBe('resolved');
    expect(resolved[0].componentKey).toBe('<NativeComponentKey>') — using mocked
    `fetchDrupalResource`.
  - |
    AC2 edge case (api, client-work-paragraphs.spec.ts): calling `registerClientWorkParagraphs`
    a second time on the same registry instance throws (propagates `resource-registry.ts`'s
    "already registered" error) — guards against a second accidental module-init call silently
    producing duplicate/divergent registrations.
  - |
    AC3 (web, ParagraphList.test.tsx): render(<ParagraphList paragraphs={[{ status:
    'html-fragment', html: '<blockquote>Legacy quote</blockquote>' }]} componentMap={{}} />);
    expect(screen.getByTestId('html-fragment').innerHTML).toContain('Legacy quote').
  - |
    AC3 (api, client-work-paragraphs.spec.ts): register a legacy type with
    `createHtmlFragmentFetcher`; mock `fetch` to return `new Response('<p>legacy</p>', { status:
    200 })`; `resolveResources` on that type resolves `{ status: 'resolved', componentKey:
    undefined, data: { html: '<p>legacy</p>' } }`.
  - |
    AC3 edge case (api, html-fragment-fetcher.spec.ts): mock `fetch` to resolve `new
    Response('Not Found', { status: 404 })`; `await expect(fetcher.fetchById('1',
    ENV)).rejects.toBeInstanceOf(DrupalFetchError)` — a legacy paragraph's Drupal fragment
    endpoint failing surfaces the same typed error `fetchDrupalResource` would, so it becomes a
    `{ status: 'failed' }` entry in `resolveResources` rather than an unhandled rejection.
  - |
    AC4 (api, page-cache.spec.ts): const compose = vi.fn().mockResolvedValue({ v: 1 }); const
    cache = createPageCache(createRevalidationRegistry()); await cache.getOrCompose('node:1',
    60000, compose); await cache.getOrCompose('node:1', 60000, compose);
    expect(compose).toHaveBeenCalledTimes(1) — the second "request" is served from the composed
    cache instead of recomputing, which is this stack's analogue of serving a previously
    statically-generated page.
  - |
    AC4 edge case (api, page-cache.spec.ts): a second, independent tag is unaffected by the
    first's cache state: await cache.getOrCompose('node:1', 60000, composeA); await
    cache.getOrCompose('node:2', 60000, composeB); expect(composeA).toHaveBeenCalledTimes(1);
    expect(composeB).toHaveBeenCalledTimes(1) — confirms the cache is keyed per tag, not global.
  - |
    AC4 edge case (api, page-cache.spec.ts, concurrency): let resolveCompose: () => void; const
    compose = vi.fn(() => new Promise((r) => { resolveCompose = () => r({ v: 1 }) })); const p1 =
    cache.getOrCompose('node:1', 60000, compose); const p2 = cache.getOrCompose('node:1', 60000,
    compose); resolveCompose!(); await Promise.all([p1, p2]);
    expect(compose).toHaveBeenCalledTimes(1) — two concurrent cache-miss requests for the same
    tag (e.g. right after a revalidate) dedupe into a single Drupal recomposition instead of a
    thundering herd.
  - |
    AC4 edge case (api, page-cache.spec.ts): const compose = vi.fn().mockRejectedValueOnce(new
    Error('drupal down')).mockResolvedValueOnce({ v: 1 }); await expect(cache.getOrCompose('node:1',
    60000, compose)).rejects.toThrow('drupal down'); await
    expect(cache.getOrCompose('node:1', 60000, compose)).resolves.toEqual({ v: 1 }) — a failed
    compose is not cached as the page's value, so the very next request retries instead of
    permanently serving (or caching) the error.
  - |
    AC5 (api, pages.e2e-spec.ts): mock Drupal fetch to return 'v1' content; GET
    /pages/client-work/page-1 twice, assert both return 'v1' and Drupal was called once; POST
    /pages/revalidate with `{ tag: 'node:page-1' }` and header `x-revalidate-secret` set to
    `process.env.REVALIDATION_SHARED_SECRET`, expect 200; change the mock to return 'v2'; GET
    /pages/client-work/page-1 again and expect(res.body.body).toContain('v2'). Also: POST
    /pages/revalidate with a wrong/missing secret returns 401 and a subsequent GET still
    returns 'v1' (no revalidation happened).
  - |
    AC5 edge case (api, pages.e2e-spec.ts): POST /pages/revalidate with the correct secret but
    `{}` (no `tag`) returns 400; POST /pages/revalidate with the correct secret and `{ tag:
    'node:never-requested' }` (a tag nothing has cached yet) returns 200, proving revalidation
    is a pure, idempotent "mark stale" that never errors just because there was nothing to
    invalidate.
  - |
    AC5/AC1 edge case (api, pages.e2e-spec.ts): mock Drupal fetch for `node--client_work/missing-id`
    to return `{ ok: false, status: 404 }`; GET /pages/client-work/missing-id returns 404 (not
    500); a subsequent GET after the mock is changed to return real content for that same id
    returns 200 with the real content on the very next call (the 404 was never cached).
  - |
    AC6 (api, page-cache.spec.ts, fake timers): const now = vi.fn(() => 0); const cache =
    createPageCache(createRevalidationRegistry(), now); await cache.getOrCompose('node:1',
    1000, compose); now.mockReturnValue(1500); await cache.getOrCompose('node:1', 1000,
    compose); expect(compose).toHaveBeenCalledTimes(2) — elapsed TTL recomposes with no explicit
    `markStale` call.
  - |
    AC6 edge case (api, page-cache.spec.ts, fake timers, boundary): const now = vi.fn(() => 0);
    await cache.getOrCompose('node:1', 1000, compose); now.mockReturnValue(999); await
    cache.getOrCompose('node:1', 1000, compose); expect(compose).toHaveBeenCalledTimes(1) — one
    millisecond before the TTL elapses the cached value is still served, pinning the `>=`
    boundary so it isn't off-by-one in either direction.
  - |
    AC7 (web, e2e/client-work.spec.ts, Playwright): await page.goto('/client-work/page-1');
    await expect(page.getByRole('heading', { name: 'Acme Redesign' })).toBeVisible(); await
    expect(page.getByRole('img', { name: 'Acme hero' })).toHaveAttribute('src', '/h.jpg'); await
    expect(page.getByText('client_work')).toHaveCount(0) (no stub leakage); final sign-off
    parity judgment itself is recorded via the existing `/inventory/:pageId/results` flow
    (STORY-050), out of this story's scope.
  - |
    AC7 edge case (web, ClientWorkPage.test.tsx): mockApi 404s `GET /pages/client-work/missing`;
    renderAt(<ClientWorkPage />, '/client-work/missing', '/client-work/:pageId');
    expect(await screen.findByText(/page.*not.*found/i)).toBeInTheDocument(); expect(screen.queryByTestId('client-work-template')).not.toBeInTheDocument()
    — a not-found instance shows a distinct, honest empty/not-found state rather than an empty
    or partially-stubbed template shell.

assumptions_or_open_questions:
  - |
    Biggest open question: AC4/5/6 are written in Next.js ISR/SSG vocabulary ("statically
    generated page", "on-demand revalidation", "fallback TTL"), but the confirmed stack for
    `comp_web_app` is react+vite (a client-rendered SPA with no build-time SSG) and
    `comp_api_service` is NestJS (a request/response API, not a page-render server). Per the
    stack-lock instructions I have not introduced Next.js or any SSR/SSG framework. Instead I'm
    approximating ISR as an API-side composed-page cache (`PageCache`) with a TTL and an
    explicit stale-tag override (`RevalidationRegistry`), described in `notes`. A reviewer who
    expects literal Next.js `generateStaticParams`/`revalidatePath` semantics should flag this
    explicitly rather than assume it was missed — it's a deliberate stack-fit call, not an
    oversight.
  - |
    The real Drupal machine names for the `node--client_work` content type's title/body/hero
    image fields and its paragraph reference field, and the exact six legacy paragraph JSON:API
    type names plus their fragment-rendering endpoint path shape, are not present anywhere in
    this run's context (only `TEMPLATE_TYPES`/`PAGE_CONTENT_TYPES` string identifiers exist
    today). `client-work-page.fetcher.ts`/`client-work-paragraphs.ts` are planned against
    placeholder identifiers; the implementer must confirm the real names/shapes against the
    Drupal site before this is production-correct, and tests should be written against those
    confirmed values rather than the placeholders used here.
  - |
    `GET /pages/client-work/:id` and the new `/client-work/:pageId` web route are planned as
    unauthenticated (no `CognitoAuthGuard`), on the assumption that a published marketing page
    is public, matching the original Drupal site's own public access. If this app in fact wants
    every route behind sign-in (as all current routes in `App.tsx` are), that guard and the
    route's placement in `App.tsx`'s signed-out branch would need to change.
  - |
    `PAGE_CACHE_TTL_MS` and `REVALIDATION_SHARED_SECRET` are planned as new required/defaulted
    env vars read the same way `drupal-config.ts` reads `DRUPAL_BASE_URL`; exact names/defaults
    are my choice absent any existing convention for them.
  - |
    Legacy-fragment HTML is rendered via `dangerouslySetInnerHTML` with no new sanitization
    library, mirroring that the existing codebase has no HTML-sanitization dependency today and
    the content source is the same trusted, server-authenticated Drupal instance already used
    for JSON:API fetches (not end-user input). Flagging in case security policy requires
    sanitizing CMS-sourced markup regardless of source trust.
  - |
    `PageCache.getOrCompose`'s concurrency dedupe keeps only one in-flight promise per tag in
    memory (no cross-process/cross-instance coordination). That's fine for a single API process;
    if `comp_api_service` ever runs multiple instances behind a load balancer, each instance
    dedupes its own concurrent requests but the instances don't dedupe against each other —
    flagging since nothing in the current stack docs says whether that's a real deployment
    shape.

estimated_points: 8

package_dependencies: []

notes: |
  Why "static generation + ISR" is approximated rather than built literally: `revalidation-
  registry.ts` already states the existing contract deliberately — "Explicit, caller-driven
  invalidation only: there is deliberately no time-based expiry" — and `typed-fetcher.ts`'s
  `FetchCacheStrategy` comment says "a future rendering layer decides prebuilt-vs-live serving
  from this tag", i.e. this story is that future rendering layer. `PageCache` is that layer: it
  composes once and serves the composed result on every subsequent request until either
  `RevalidationRegistry.isStale()` (explicit, via the secret-guarded route) or its own TTL says
  otherwise — the same two invalidation paths Next.js ISR exposes (`revalidatePath`/webhook, and
  a numeric `revalidate` option), built on primitives this stack actually has. The edge cases
  added in this revision (dedupe-on-concurrent-miss, no-cache-on-failure, no-cache-on-404,
  idempotent-revalidate-of-an-unknown-tag, TTL boundary, partial-paragraph-failure isolation)
  are the realistic ways that approximation breaks if left unguarded, not speculative extras.

  ```mermaid
  flowchart TD
    classDef touched fill:#f96,color:#000
    Browser[ClientWorkPage route] -->|GET pages client-work id| Controller[pages.controller.ts]
    class Browser,Controller touched
    Controller --> Service[pages.service.ts composeClientWorkPage]
    class Service touched
    Service --> Cache[page-cache.ts getOrCompose]
    class Cache touched
    Cache --> Revalidation[revalidation-registry.ts isStale/clearStale]
    Service --> ContentFetcher[client-work-page.fetcher.ts]
    class ContentFetcher touched
    Service --> Registry[resource-registry.ts resolveResources]
    Registry --> ParagraphReg[client-work-paragraphs.ts registrations]
    class ParagraphReg touched
    ContentFetcher --> TypedFetcher[typed-fetcher.ts createTypedFetcher]
    ParagraphReg --> TypedFetcher
    ParagraphReg --> FragmentFetcher[html-fragment-fetcher.ts]
    class FragmentFetcher touched
    TypedFetcher --> DrupalClient[drupal-client.ts fetchDrupalResource]
    FragmentFetcher --> DrupalClient
    class DrupalClient touched
    RevalidateCall[POST pages revalidate] --> Controller
    Controller --> Guard[revalidation-secret.guard.ts]
    class Guard touched
    Guard --> Revalidation
    class Revalidation touched
    ClientWorkPage[ClientWorkPage.tsx] --> Template[ClientWorkTemplate.tsx]
    class ClientWorkPage,Template touched
    Template --> ParagraphList[ParagraphList.tsx]
    class ParagraphList touched
    ParagraphList --> HtmlFragment[HtmlFragmentParagraph.tsx]
    class HtmlFragment touched
    App[App.tsx routes] --> ClientWorkPage
    class App touched
  ```

review_focus: |
  In scope: ClientWork's own content fetch/render, its paragraph registrations into the
  already-generic `resource-registry`, a generic page-cache/revalidation-route pair meant to be
  reused by the sibling HomePage/LandingPage/Partner/Services stories later, and the edge-case
  handling around it (partial paragraph failure, 404s, cache concurrency/failure, idempotent
  revalidation). Out of scope: any specific paragraph component's UI (Paragraph/Component
  Library epic), and the other four templates' own content fetchers/routes. Riskiest area: the
  ISR/SSG approximation (`page-cache.ts` + the shared secret-guarded `/pages/revalidate` route)
  — it's a judgment call made because the confirmed stack is a Vite SPA + NestJS API, not
  Next.js, and a reviewer should check it against that constraint rather than expecting literal
  `generateStaticParams`/`revalidatePath` behavior; the concurrency dedupe in particular is
  single-process only (see `assumptions_or_open_questions`). Second riskiest area: the six
  legacy paragraph type names, the `node--client_work` field names, and the fragment-endpoint
  path shape are all placeholders (no real Drupal schema was available in context) — the real
  names must be substituted and the fixtures/tests adjusted before this is production-correct.

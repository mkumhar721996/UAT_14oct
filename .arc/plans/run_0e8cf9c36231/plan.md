summary: |
  Replaces the placeholder `LandingPageTemplate` with a real, end-to-end renderer: a new
  `comp_api_service` `pages` module fetches a published `landing_page` Drupal node (title, body
  text, images) and routes every paragraph relationship through the existing, previously-generic
  `services/api/src/drupal` dispatch mechanism (`createTypedFetcher`/`createResourceRegistry`/
  `resolveResources`/`createRevalidationRegistry`, all built but never consumed by an earlier
  story) — natively-supported paragraph types resolve to a `componentKey` for a web-side native
  component, the six legacy paragraph types resolve via a new HTML-fragment fetch. Repeat requests
  for the same page are served from an in-memory ISR-style cache keyed by the page's Drupal node
  id, invalidated either by a new shared `POST /revalidation` route (token-protected, marks a tag
  stale) or by a fallback TTL safety net. `comp_web_app` gets a new, intentionally minimal public
  (unauthenticated) route that fetches this payload and renders it through the existing
  `TemplateRouter` -> `LandingPageTemplate`, plus a new `ParagraphDispatcher` that renders a
  registered native component or a sanitized legacy HTML fragment per paragraph. No native
  paragraph *component* is built here — that catalogue is owned by the separate Paragraph/
  Component Library epic and is deliberately left as an empty, extensible registry this plan
  proves with fixtures — and no real Drupal paragraph/media content-type machine names are
  confirmed anywhere in this repo, so this plan names them as clearly-labeled placeholders to be
  swapped once that schema is confirmed, exactly as the prior Typed Content & Paragraph Fetchers
  story already flagged.

scope:
  - description: |
      Add a small JSON:API relationship-normalizing helper used by both the landing-page node
      parser and any future node parser that reads a to-one-or-to-many relationship:
      ```ts
      export function toResourceIdentifierArray(
        data: JsonApiResourceIdentifier | JsonApiResourceIdentifier[] | null | undefined,
      ): JsonApiResourceIdentifier[] {
        if (!data) return [];
        return Array.isArray(data) ? data : [data];
      }
      ```
    files:
      - services/api/src/drupal/jsonapi-types.ts
    rationale: |
      `JsonApiResource.relationships[x].data` is typed as identifier-or-array-or-null per the
      JSON:API spec; both `field_image` and `field_paragraphs` need this normalized the same way
      before being handed to `resolveResources`, so it belongs next to the type it normalizes
      rather than being duplicated per-fetcher.

  - description: |
      Add `fetchDrupalHtmlFragment`, the raw-text sibling of the existing `fetchDrupalResource`,
      for Drupal responses that are rendered HTML rather than JSON:API (the six legacy paragraph
      types' render output):
      ```ts
      export async function fetchDrupalHtmlFragment(
        path: string,
        env: NodeJS.ProcessEnv = process.env,
      ): Promise<string> {
        const config = loadDrupalConfig(env);
        const url = new URL(path, config.baseUrl).toString();
        const response = await fetch(url, { headers: { Authorization: `Bearer ${config.accessToken}` } });
        if (!response.ok) {
          throw new DrupalFetchError(`Drupal request to ${path} failed with status ${response.status}`);
        }
        return response.text();
      }
      ```
    files:
      - services/api/src/drupal/drupal-client.ts
    rationale: |
      Mirrors `fetchDrupalResource` exactly (same config loading, same auth header, same error
      type) so both share one config/auth code path; only the response is read as `.text()`
      instead of `.json()`.

  - description: |
      Add `createLegacyFragmentFetcher`, a `TypedFetcher<{ html: string }>` factory for the six
      legacy paragraph types, built on `fetchDrupalHtmlFragment`, with the fetched markup run
      through `sanitize-html` before it ever leaves the API:
      ```ts
      export function createLegacyFragmentFetcher(definition: {
        jsonApiType: string;
        endpoint: string;
      }): TypedFetcher<{ html: string }> {
        return {
          jsonApiType: definition.jsonApiType,
          cacheStrategy: 'static-revalidatable',
          async fetchById(id, env = process.env) {
            const raw = await fetchDrupalHtmlFragment(`${definition.endpoint}/${encodeURIComponent(id)}`, env);
            return { html: sanitizeHtml(raw) };
          },
        };
      }
      ```
    files:
      - services/api/src/drupal/legacy-fragment-fetcher.ts
      - services/api/src/drupal/legacy-fragment-fetcher.spec.ts
    rationale: |
      Keeps the "fetch a fragment and sanitize it" policy in exactly one place so every legacy
      paragraph type gets the same treatment, rather than trusting each of the six registrations
      to remember to sanitize; `sanitize-html` runs server-side so unsanitized markup never
      reaches the browser bundle, matching how the bearer credential already never does.

  - description: |
      Add `createMediaImageFetcher`, a typed fetcher for the `media--image` JSON:API type used by
      a landing page's page-level images, registered once as shared infrastructure (not
      landing-page-specific, so a sibling template story can rely on it without a duplicate-
      registration error):
      ```ts
      export function createMediaImageFetcher(): TypedFetcher<{ url: string; alt: string }> {
        return createTypedFetcher({
          jsonApiType: 'media--image',
          endpoint: '/jsonapi/media/image',
          include: [],
          cacheStrategy: 'static-revalidatable',
          parse: (r) => ({ url: r.attributes.url as string, alt: (r.attributes.alt as string) ?? '' }),
        });
      }
      ```
    files:
      - services/api/src/drupal/media-fetcher.ts
      - services/api/src/drupal/media-fetcher.spec.ts
    rationale: |
      Reuses `createTypedFetcher` exactly as the prior story built it. The assumed flattened
      `{ url, alt }` attribute shape (rather than a nested `field_media_image` -> `file--file`
      hop) is a placeholder pending the real Drupal media JSON:API shape — see assumptions.

  - description: |
      Add `DrupalModule`: the shared, app-wide home for the resource/revalidation registries (as
      injectable singletons, following this codebase's existing `TOKEN_VERIFIER`/
      `CUSTOMER_IDENTITY_PROVIDER` symbol-token DI pattern) and the registration of the one
      cross-template fetcher (`media--image`); plus the shared on-demand revalidation route.
      ```ts
      export const RESOURCE_REGISTRY = Symbol('RESOURCE_REGISTRY');
      export const REVALIDATION_REGISTRY = Symbol('REVALIDATION_REGISTRY');

      @Module({
        controllers: [RevalidationController],
        providers: [
          { provide: RESOURCE_REGISTRY, useFactory: createResourceRegistry },
          { provide: REVALIDATION_REGISTRY, useFactory: createRevalidationRegistry },
        ],
        exports: [RESOURCE_REGISTRY, REVALIDATION_REGISTRY],
      })
      export class DrupalModule implements OnModuleInit {
        constructor(@Inject(RESOURCE_REGISTRY) private readonly registry: ResourceRegistry) {}
        onModuleInit() {
          this.registry.register({ jsonApiType: 'media--image', fetcher: createMediaImageFetcher() });
        }
      }
      ```
      `isValidRevalidationToken(token, env)` reads `REVALIDATION_TOKEN` the same required-env-var
      way `loadDrupalConfig` reads `DRUPAL_BASE_URL` (no default, no fallback):
      ```ts
      export function isValidRevalidationToken(token: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
        const expected = env.REVALIDATION_TOKEN ?? '';
        return expected.length > 0 && token === expected;
      }
      ```
      `RevalidateDto { @IsString() @IsNotEmpty() tag!: string }`. `RevalidationController`:
      ```ts
      @Controller('revalidation')
      export class RevalidationController {
        constructor(@Inject(REVALIDATION_REGISTRY) private readonly revalidation: RevalidationRegistry) {}
        @Post()
        revalidate(@Headers('authorization') authorization: string | undefined, @Body() dto: RevalidateDto) {
          const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
          if (!isValidRevalidationToken(token)) throw new UnauthorizedException('Invalid or missing revalidation token');
          this.revalidation.markStale(dto.tag);
          return { revalidated: true, tag: dto.tag };
        }
      }
      ```
    files:
      - services/api/src/drupal/drupal.module.ts
      - services/api/src/drupal/revalidation-token.ts
      - services/api/src/drupal/revalidation-token.spec.ts
      - services/api/src/drupal/dto/revalidate.dto.ts
      - services/api/src/drupal/revalidation.controller.ts
      - services/api/src/app.module.ts
    rationale: |
      "The shared revalidation route" (AC6's wording) only makes sense as one route any future
      HomePage/ClientWork/Partner/Services renderer story can call too, so it lives in `drupal/`
      next to the registries it mutates, not inside the landing-page-specific `pages` module. No
      `CognitoAuthGuard` is applied — like `POST /customers/signup`, this is called by an external
      system (Drupal's webhook), not a signed-in user, and is authorized by the shared secret
      token instead, per ADR-0012's "generic extensibility via... webhooks".

  - description: |
      Add `createPageCache`, the generic ISR-style cache (serve-cached-unless-stale-or-expired)
      any template-renderer's page-serving service can use — kept in `drupal/` for the same
      shared-infrastructure reason as `DrupalModule`:
      ```ts
      export function createPageCache<T>(options: { ttlMs: number }) {
        const entries = new Map<string, { data: T; renderedAt: number }>();
        return {
          async get(tag: string, revalidation: RevalidationRegistry, build: () => Promise<T>): Promise<T> {
            const cached = entries.get(tag);
            const withinTtl = !!cached && Date.now() - cached.renderedAt < options.ttlMs;
            if (cached && withinTtl && !revalidation.isStale(tag)) return cached.data;
            const data = await build();
            entries.set(tag, { data, renderedAt: Date.now() });
            revalidation.clearStale(tag);
            return data;
          },
        };
      }
      ```
    files:
      - services/api/src/drupal/page-cache.ts
      - services/api/src/drupal/page-cache.spec.ts
    rationale: |
      Implements the scope's "ISR with on-demand revalidation and a fallback TTL" as one small,
      independently-testable policy: a cache hit requires both "not explicitly marked stale" (on-
      demand revalidation, AC6) and "not past its TTL" (the fallback safety net), and a rebuild
      always clears the tag's staleness so a later explicit revalidation call is needed again
      before the next rebuild.

  - description: |
      Add the landing-page node fetcher and the (placeholder, see assumptions) paragraph dispatch
      registrations for this content type.
      ```ts
      export interface LandingPageNode {
        title: string;
        bodyHtml: string;
        imageRefs: JsonApiResourceIdentifier[];
        paragraphRefs: JsonApiResourceIdentifier[];
      }
      export function createLandingPageFetcher(): TypedFetcher<LandingPageNode> {
        return createTypedFetcher({
          jsonApiType: 'node--landing_page',
          endpoint: '/jsonapi/node/landing_page',
          include: [],
          cacheStrategy: 'static-revalidatable',
          parse: (r) => ({
            title: r.attributes.title as string,
            bodyHtml: sanitizeHtml((r.attributes.body as { processed?: string } | undefined)?.processed ?? ''),
            imageRefs: toResourceIdentifierArray(r.relationships?.field_image?.data),
            paragraphRefs: toResourceIdentifierArray(r.relationships?.field_paragraphs?.data),
          }),
        });
      }
      ```
      `registerLandingPageParagraphDispatch(registry)` registers two example natively-supported
      types (`paragraph--hero_banner` -> componentKey `HeroBanner`, `paragraph--rich_text` ->
      componentKey `RichText`) and the six example legacy types (`paragraph--legacy_promo`,
      `_cta`, `_testimonial`, `_media_embed`, `_accordion`, `_table`), each via
      `createLegacyFragmentFetcher({ jsonApiType, endpoint: '/paragraph/fragment' })` with
      `componentKey: 'LegacyHtmlFragment'`.
    files:
      - services/api/src/pages/landing-page-fetcher.ts
      - services/api/src/pages/landing-page-fetcher.spec.ts
      - services/api/src/pages/landing-page-paragraph-dispatch.ts
    rationale: |
      `relationships.field_paragraphs.data`/`field_image.data` are present on a JSON:API resource
      regardless of the `include` query param, so no `include` is needed here — each referenced
      resource is instead fetched through `resolveResources` against the shared registry, which is
      the actual "routing through the dispatch table" the scope asks for. Field/type names
      (`body`, `field_image`, `field_paragraphs`, the paragraph type machine names, and the
      `/paragraph/fragment` legacy render path) are unconfirmed against a real Drupal instance —
      `body.processed` is standard Drupal JSON:API shape and low-risk; the rest are flagged
      assumptions, same as the prior Typed Content & Paragraph Fetchers story's open question.

  - description: |
      Add `PagesModule`/`PagesController`/`PagesService` wiring the above into one public
      (unguarded) endpoint, cached via `createPageCache`, tagged `node:<pageId>` to match the
      revalidation route's tag format used by `revalidation-registry.spec.ts`'s existing fixtures:
      ```ts
      @Injectable()
      export class PagesService implements OnModuleInit {
        private readonly cache = createPageCache<LandingPageContent>({ ttlMs: LANDING_PAGE_CACHE_TTL_MS });
        private readonly landingPageFetcher = createLandingPageFetcher();
        constructor(
          @Inject(RESOURCE_REGISTRY) private readonly registry: ResourceRegistry,
          @Inject(REVALIDATION_REGISTRY) private readonly revalidation: RevalidationRegistry,
        ) {}
        onModuleInit() { registerLandingPageParagraphDispatch(this.registry); }

        getLandingPage(pageId: string, env?: NodeJS.ProcessEnv): Promise<LandingPageContent> {
          return this.cache.get(`node:${pageId}`, this.revalidation, async () => {
            const node = await this.landingPageFetcher.fetchById(pageId, env);
            const [images, paragraphs] = await Promise.all([
              resolveResources(this.registry, node.imageRefs, env),
              resolveResources(this.registry, node.paragraphRefs, env),
            ]);
            return { pageId, title: node.title, bodyHtml: node.bodyHtml, images, paragraphs };
          });
        }
      }

      @Controller('pages')
      export class PagesController {
        constructor(private readonly pages: PagesService) {}
        @Get('landing-page/:pageId')
        getLandingPage(@Param('pageId') pageId: string) { return this.pages.getLandingPage(pageId); }
      }
      ```
      `LANDING_PAGE_CACHE_TTL_MS` defaults to 5 minutes (placeholder — no TTL value is given by the
      story; see assumptions). `GET /pages/landing-page/:pageId` carries no `@UseGuards`, matching
      `POST /customers/signup`'s existing unguarded-public-endpoint precedent — a published
      marketing page must be visible to an anonymous visitor.
    files:
      - services/api/src/pages/pages.service.ts
      - services/api/src/pages/pages.controller.ts
      - services/api/src/pages/pages.module.ts
      - services/api/src/app.module.ts
    rationale: |
      One cache instance per `PagesService` (module-scoped singleton, the Nest default) gives
      exactly the "same rendered page is returned" (AC5) and "revalidation changes what the next
      request sees" (AC6) behavior `createPageCache` was built to provide.

  - description: |
      Backend unit + e2e tests for AC1-AC6 (see `tests` below) plus the TTL/token edge cases the
      scope's architecture depends on.
    files:
      - services/api/test/pages.e2e-spec.ts
      - services/api/test/revalidation.e2e-spec.ts
    rationale: Test-first coverage of every acceptance criterion against the real Nest pipeline.

  - description: |
      Add `sanitize-html` to `services/api`'s manifest (used by the legacy-fragment fetcher and
      the landing-page body parser above).
    files:
      - services/api/package.json
    rationale: |
      No HTML-sanitization library exists in this repo today; raw CMS-authored markup must not
      reach `dangerouslySetInnerHTML` on the web side unsanitized.

  - description: |
      Extend the shared web `DrupalNode` contract with the optional fields a landing page carries,
      and add the `ResolvedParagraph` type mirroring the API's resolved/unresolved/failed union:
      ```ts
      export interface DrupalNode {
        contentType: string
        templateField?: string | null
        title?: string
        bodyHtml?: string
        images?: Array<{ url: string; alt: string }>
        paragraphs?: ResolvedParagraph[]
      }
      export interface ResolvedParagraph {
        status: 'resolved' | 'unresolved' | 'failed'
        jsonApiType: string
        componentKey?: string
        data?: unknown
      }
      ```
    files:
      - apps/web/src/lib/templates/types.ts
    rationale: |
      All five fields are optional additions to the existing `DrupalNode` interface already
      consumed by `TemplateRouter`/`resolveTemplateType`/the other four placeholder templates, so
      none of their existing tests or signatures change.

  - description: |
      Rebuild `LandingPageTemplate` to render real content, and add `ParagraphDispatcher` (the
      web-side half of "routing each paragraph instance through the shared dispatch table") plus
      `LegacyParagraphFragment` for the six legacy types.
      ```tsx
      export function LandingPageTemplate({ node }: { node: DrupalNode }) {
        return (
          <article data-testid="landing-page-template">
            <h1>{node.title}</h1>
            {node.bodyHtml && <div className="landing-page-body" dangerouslySetInnerHTML={{ __html: node.bodyHtml }} />}
            {(node.images ?? []).map((img) => <img key={img.url} src={img.url} alt={img.alt} />)}
            {(node.paragraphs ?? []).map((p, i) => <ParagraphDispatcher key={i} paragraph={p} />)}
          </article>
        )
      }
      ```
      ```tsx
      export const NATIVE_PARAGRAPH_COMPONENTS: Record<string, (props: { data: unknown }) => JSX.Element> = {}

      export function ParagraphDispatcher({
        paragraph,
        registry = NATIVE_PARAGRAPH_COMPONENTS,
      }: {
        paragraph: ResolvedParagraph
        registry?: Record<string, (props: { data: unknown }) => JSX.Element>
      }) {
        if (paragraph.status !== 'resolved') return null
        if (paragraph.componentKey === 'LegacyHtmlFragment') {
          return <LegacyParagraphFragment html={(paragraph.data as { html: string }).html} />
        }
        const Component = paragraph.componentKey ? registry[paragraph.componentKey] : undefined
        return Component ? <Component data={paragraph.data} /> : null
      }
      ```
      `NATIVE_PARAGRAPH_COMPONENTS` is intentionally empty in production — populated later by the
      Paragraph/Component Library epic — and `ParagraphDispatcher` accepts an optional `registry`
      override so this story's tests can prove the dispatch mechanism with a fixture component
      instead of inventing a "real" one.
    files:
      - apps/web/src/components/templates/LandingPageTemplate.tsx
      - apps/web/src/components/templates/LandingPageTemplate.test.tsx
      - apps/web/src/components/paragraphs/ParagraphDispatcher.tsx
      - apps/web/src/components/paragraphs/ParagraphDispatcher.test.tsx
      - apps/web/src/components/paragraphs/LegacyParagraphFragment.tsx
    rationale: |
      No existing cataloged component (`ActiveGrid`, `Banner`, `CoreFieldInput`, `Layout`,
      `Toast`) fits either a CMS page body or a per-paragraph-type switch, so these are new,
      narrowly-scoped components rather than a reuse of an unrelated one.

  - description: |
      Add a public `LandingPageRoute` that fetches a landing page's resolved content by Drupal
      node id and renders it through the existing `TemplateRouter` (no `Layout` sidebar chrome —
      this is public marketing content, not an internal console page):
      ```tsx
      export default function LandingPageRoute() {
        const { pageId = '' } = useParams()
        const { data, error, loading } = useAsync(() => apiClient.get<DrupalNode>(`/pages/landing-page/${pageId}`))
        if (loading) return <p>Loading…</p>
        if (error || !data) return <p>This page couldn't be loaded.</p>
        return <TemplateRouter node={data} />
      }
      ```
      Wire it into `App.tsx` as a route reachable regardless of sign-in state — today every route
      is nested inside an `if (!auth) {...}` / `if (auth.role === 'customer') {...}` / internal-
      console branch, none of which a signed-out marketing-site visitor should have to pass
      through. The existing three-branch body is extracted unchanged into an `InternalApp`
      component; `ToastProvider` is hoisted to wrap a new top-level `<Routes>` so it wraps both
      branches instead of being duplicated three times:
      ```tsx
      function App() {
        const auth = useAuth()
        return (
          <ToastProvider>
            <Routes>
              <Route path="/pages/landing-page/:pageId" element={<LandingPageRoute />} />
              <Route path="*" element={<InternalApp auth={auth} />} />
            </Routes>
          </ToastProvider>
        )
      }
      ```
    files:
      - apps/web/src/routes/LandingPageRoute.tsx
      - apps/web/src/routes/LandingPageRoute.test.tsx
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
    rationale: |
      Without this, "a page is requested" (every AC's GIVEN/WHEN) has no reachable URL in the
      browser at all — `TemplateRouter`/the five renderers exist but nothing feeds them a fetched
      node. The route is deliberately generic (`/pages/landing-page/:pageId`, matching the
      `pages/landing-page/:pageId` API shape) so a sibling HomePage/ClientWork/Partner/Services
      story can add `/pages/home-page/:pageId` etc. alongside it without reworking this one.

tests:
  - |
    AC1 (services/api/test/pages.e2e-spec.ts): a published landing page's real title/body/images
    come back, not placeholder content.
    ```ts
    it('AC1: returns the real Drupal text and images for a published landing page', async () => {
      mockLandingPageNode('lp-1', { title: 'Autumn Sale', body: '<p>Save big</p>', images: ['media-1'] });
      mockMediaImage('media-1', { url: 'https://cdn.test/sale.jpg', alt: 'Sale banner' });
      const res = await http().get('/pages/landing-page/lp-1');
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Autumn Sale');
      expect(res.body.bodyHtml).toContain('Save big');
      expect(res.body.images).toEqual([{ url: 'https://cdn.test/sale.jpg', alt: 'Sale banner' }]);
    });
    ```
    Web `LandingPageTemplate.test.tsx`:
    ```tsx
    it('AC1: shows the Drupal text and images', () => {
      render(<LandingPageTemplate node={{ contentType: 'landing_page', title: 'Autumn Sale', bodyHtml: '<p>Save big</p>', images: [{ url: '/s.jpg', alt: 'Sale' }] }} />)
      expect(screen.getByText('Autumn Sale')).toBeInTheDocument()
      expect(screen.getByText('Save big')).toBeInTheDocument()
      expect(screen.getByAltText('Sale')).toHaveAttribute('src', '/s.jpg')
    })
    ```
  - |
    AC2 (apps/web/src/components/paragraphs/ParagraphDispatcher.test.tsx): a natively-supported
    paragraph renders through its registered native component with its Drupal content.
    ```tsx
    it('AC2: dispatches a resolved native paragraph to its registered component', () => {
      const Fixture = ({ data }: { data: unknown }) => <div data-testid="native">{(data as { text: string }).text}</div>
      render(<ParagraphDispatcher paragraph={{ status: 'resolved', jsonApiType: 'paragraph--rich_text', componentKey: 'RichText', data: { text: 'Hello' } }} registry={{ RichText: Fixture }} />)
      expect(screen.getByTestId('native')).toHaveTextContent('Hello')
    })
    ```
    Backed by the API's dispatch at `services/api/src/pages/landing-page-fetcher.spec.ts`:
    ```ts
    it('AC2: a native paragraph type resolves with its componentKey', async () => {
      const registry = createResourceRegistry();
      registerLandingPageParagraphDispatch(registry);
      mockParagraph('paragraph--rich_text', 'p-1', { text: 'Hello' });
      const [resolved] = await resolveResources(registry, [{ type: 'paragraph--rich_text', id: 'p-1' }]);
      expect(resolved).toMatchObject({ status: 'resolved', componentKey: 'RichText' });
    });
    ```
  - |
    AC3 (services/api/test/pages.e2e-spec.ts): every paragraph on the node appears in the
    response, including one of an unregistered type (none silently dropped).
    ```ts
    it('AC3: every paragraph instance on the node is present in the response', async () => {
      mockLandingPageNode('lp-2', { paragraphs: [['paragraph--rich_text', 'p-1'], ['paragraph--unregistered', 'p-2']] });
      const res = await http().get('/pages/landing-page/lp-2');
      expect(res.body.paragraphs).toHaveLength(2);
      expect(res.body.paragraphs.map((p: any) => p.status)).toEqual(['resolved', 'unresolved']);
    });
    ```
  - |
    AC4 (services/api/test/pages.e2e-spec.ts and ParagraphDispatcher.test.tsx): a legacy paragraph
    type's content comes from its HTML fragment.
    ```ts
    it('AC4: a legacy paragraph type resolves via its HTML fragment', async () => {
      mockLandingPageNode('lp-3', { paragraphs: [['paragraph--legacy_promo', 'p-9']] });
      mockFragment('/paragraph/fragment/p-9', '<div class="promo">50% off</div>');
      const res = await http().get('/pages/landing-page/lp-3');
      expect(res.body.paragraphs[0]).toMatchObject({ status: 'resolved', componentKey: 'LegacyHtmlFragment' });
      expect(res.body.paragraphs[0].data.html).toContain('50% off');
    });
    ```
    ```tsx
    it('AC4: renders a legacy paragraph from its HTML fragment', () => {
      render(<ParagraphDispatcher paragraph={{ status: 'resolved', jsonApiType: 'paragraph--legacy_promo', componentKey: 'LegacyHtmlFragment', data: { html: '<p>50% off</p>' } }} />)
      expect(screen.getByText('50% off')).toBeInTheDocument()
    })
    ```
  - |
    AC5 (services/api/test/pages.e2e-spec.ts): an unchanged page returns the same rendered result
    on a second request, and Drupal is not re-fetched.
    ```ts
    it('AC5: an unchanged page returns the same result without re-fetching Drupal', async () => {
      mockLandingPageNode('lp-4', { title: 'Original' });
      const first = await http().get('/pages/landing-page/lp-4');
      const callsAfterFirst = fetchMock.mock.calls.length;
      const second = await http().get('/pages/landing-page/lp-4');
      expect(second.body).toEqual(first.body);
      expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
    });
    ```
  - |
    AC6 (services/api/test/revalidation.e2e-spec.ts): revalidating with a valid token makes the
    next request show the changed content; an invalid token is refused and changes nothing.
    ```ts
    it('AC6: revalidation with a valid token picks up changed Drupal content on the next request', async () => {
      mockLandingPageNode('lp-5', { title: 'Before' });
      await http().get('/pages/landing-page/lp-5');
      mockLandingPageNode('lp-5', { title: 'After' });
      await http().post('/revalidation').set('Authorization', 'Bearer test-revalidation-token').send({ tag: 'node:lp-5' }).expect(201);
      const res = await http().get('/pages/landing-page/lp-5');
      expect(res.body.title).toBe('After');
    });
    it('AC6: an invalid token is refused and does not revalidate', async () => {
      await http().post('/revalidation').set('Authorization', 'Bearer wrong').send({ tag: 'node:lp-5' }).expect(401);
    });
    ```

assumptions_or_open_questions:
  - |
    This repo's Drupal/paragraph content model is still entirely undocumented (no Gatsby config,
    no content-model doc, no ADR — reconfirmed by grepping for "paragraph"/"legacy" across the
    repo), exactly the gap the prior Typed Content & Paragraph Fetchers story's plan already
    flagged and deliberately deferred. This plan therefore uses clearly-labeled example/placeholder
    names for: the two "natively supported" paragraph JSON:API types (`paragraph--hero_banner`,
    `paragraph--rich_text`), the six legacy paragraph types (`paragraph--legacy_promo/_cta/
    _testimonial/_media_embed/_accordion/_table`), and the legacy HTML-fragment render path
    (`/paragraph/fragment/:id`). All of these must be swapped for the real Drupal machine
    names/path once that schema is confirmed; the dispatch *mechanism* (native vs. legacy,
    resolved/unresolved/failed) is what this plan guarantees, not these specific names.
  - |
    `node--landing_page`'s `body` field is assumed to be Drupal's standard text-with-format field
    (`attributes.body.processed` holding server-rendered HTML) and `field_image`/`field_paragraphs`
    are assumed relationship field machine names — these are lower-risk, standard-Drupal-shape
    assumptions than the paragraph/media ones above, but still unconfirmed against a live site.
  - |
    `media--image`'s attributes are assumed to already be a flattened `{ url, alt }` shape (e.g.
    via a computed field or the `jsonapi_image_styles` module) rather than requiring a second hop
    through a `field_media_image` -> `file--file` relationship. If the real API nests a file
    entity, `createMediaImageFetcher`'s `parse` needs an extra fetch, which this plan's `resolveResources`-based
    dispatch can absorb without changing the registry's shape.
  - |
    No real native paragraph React component exists in this codebase (confirmed: no
    `apps/web/src/components/paragraphs` directory existed before this plan). Per the story's own
    scope note ("Does not cover the paragraph component implementations themselves, owned by the
    Paragraph/Component Library epic"), `NATIVE_PARAGRAPH_COMPONENTS` ships empty; AC2 is proven at
    the dispatch-mechanism level (a fixture component via `ParagraphDispatcher`'s `registry` prop)
    rather than against a real production component, which only exists once that separate epic
    registers one into this same map.
  - |
    `LANDING_PAGE_CACHE_TTL_MS` (fallback TTL) is set to 5 minutes as a placeholder — neither the
    story nor any ADR gives a specific value. Tune once a real SLA for "how stale can content be
    without an explicit revalidation call" is confirmed.
  - |
    The shared `POST /revalidation` route is authorized by a single static shared-secret
    (`REVALIDATION_TOKEN` env var) compared as a plain string equality, mirroring
    `DRUPAL_ACCESS_TOKEN`'s existing required-env-var pattern. This assumes Drupal (or whatever
    calls this webhook) can be configured to send that same secret as a bearer token; no token
    rotation/expiry is implemented, matching how `DRUPAL_ACCESS_TOKEN` itself has none either.
  - |
    `GET /pages/landing-page/:pageId` and `POST /revalidation` are both deliberately unguarded
    (no `CognitoAuthGuard`) because they serve/mutate public marketing content and an external
    webhook caller respectively — neither is a signed-in-user action. This mirrors the existing
    unguarded `POST /customers/signup`/`/login` precedent in this same API.
  - |
    Chose the Drupal node UUID (`pageId`, the same identifier `services/api/src/inventory` already
    uses) as the lookup key for `/pages/landing-page/:pageId` rather than a URL path alias, since
    no path-alias JSON:API filter syntax is confirmed and this avoids guessing one. A future,
    separate "public URL routing" story would be needed to map a real marketing URL
    (e.g. `/promotions/autumn-sale`) to this pageId-keyed endpoint.
  - |
    A landing page whose Drupal fetch fails outright (network error, 5xx) is not given any special
    handling beyond the default NestJS error response — no AC describes this case, so none is
    engineered. The web route's generic "This page couldn't be loaded." message covers it instead.
  - |
    `apps/web`'s existing routes are entirely behind `useAuth()`; this plan adds the one new
    public route needed to exercise the ACs without re-architecting the rest of the SPA's RBAC
    structure or adding a shared public-site "shell" (header/footer/layout) — no design exists for
    one, and none is required by any AC.

estimated_points: 8

package_dependencies:
  - name: sanitize-html
    version: ^2.14.0
    ecosystem: npm
    component_id: comp_api_service
    rationale: |
      Both the landing page's rich-text body and the six legacy paragraphs' fetched HTML fragments
      are CMS-authored markup that gets rendered via `dangerouslySetInnerHTML` on the web client;
      sanitizing it server-side, before it ever leaves the API, is the defensive layer this plan
      relies on rather than trusting the web app to sanitize untrusted-origin markup itself.

notes: |
  Verified no Drupal/pages/paragraph code existed anywhere in `services/api` beyond the generic,
  not-yet-consumed `drupal/` primitives (`drupal-client.ts`, `drupal-config.ts`, `typed-fetcher.ts`,
  `resource-registry.ts`, `revalidation-registry.ts`, `jsonapi-types.ts`) and the already-shipped
  `inventory/drupal-page-catalog.ts` (which this plan reuses the `landing_page` content-type name
  and `pageId`/JSON:API-pagination conventions from, but does not modify). Verified
  `apps/web/src/components/templates/{TemplateRouter,LandingPageTemplate}.tsx` are still the
  placeholder shapes the Template Type Resolution story left them in, and that no
  `apps/web/src/components/paragraphs` directory exists yet.

  ```mermaid
  flowchart TD
    classDef touched fill:#f96,color:#000
    classDef existing fill:#e2e8f0,color:#1e293b

    DrupalClient["drupal/drupal-client.ts"]:::touched
    JsonApiTypes["drupal/jsonapi-types.ts"]:::touched
    LegacyFetcher["drupal/legacy-fragment-fetcher.ts (new)"]:::touched
    MediaFetcher["drupal/media-fetcher.ts (new)"]:::touched
    DrupalModule["drupal/drupal.module.ts (new)"]:::touched
    RevalCtrl["drupal/revalidation.controller.ts (new)"]:::touched
    PageCache["drupal/page-cache.ts (new)"]:::touched
    TypedFetcher["drupal/typed-fetcher.ts"]:::existing
    ResourceRegistry["drupal/resource-registry.ts"]:::existing
    RevalRegistry["drupal/revalidation-registry.ts"]:::existing

    LandingFetcher["pages/landing-page-fetcher.ts (new)"]:::touched
    ParagraphDispatchReg["pages/landing-page-paragraph-dispatch.ts (new)"]:::touched
    PagesService["pages/pages.service.ts (new)"]:::touched
    PagesController["pages/pages.controller.ts (new)"]:::touched
    AppModule["app.module.ts"]:::touched

    LegacyFetcher --> DrupalClient
    LandingFetcher --> TypedFetcher
    LandingFetcher --> JsonApiTypes
    MediaFetcher --> TypedFetcher
    DrupalModule --> ResourceRegistry
    DrupalModule --> RevalRegistry
    DrupalModule --> MediaFetcher
    RevalCtrl --> RevalRegistry
    PagesService -- "resolveResources(registry, paragraphRefs/imageRefs)" --> ResourceRegistry
    PagesService --> RevalRegistry
    PagesService --> PageCache
    PagesService --> LandingFetcher
    PagesService --> ParagraphDispatchReg
    ParagraphDispatchReg --> LegacyFetcher
    PagesController --> PagesService
    AppModule --> DrupalModule
    AppModule --> PagesController

    LandingPageRoute["web routes/LandingPageRoute.tsx (new)"]:::touched
    AppTsx["web App.tsx"]:::touched
    TemplateRouter["web components/templates/TemplateRouter.tsx"]:::existing
    LandingPageTemplate["web components/templates/LandingPageTemplate.tsx"]:::touched
    ParagraphDispatcher["web components/paragraphs/ParagraphDispatcher.tsx (new)"]:::touched
    LegacyFragment["web components/paragraphs/LegacyParagraphFragment.tsx (new)"]:::touched
    ApiClient["web lib/apiClient.ts"]:::existing

    AppTsx --> LandingPageRoute
    LandingPageRoute -- "GET /pages/landing-page/:pageId" --> ApiClient
    ApiClient -.-> PagesController
    LandingPageRoute --> TemplateRouter
    TemplateRouter --> LandingPageTemplate
    LandingPageTemplate --> ParagraphDispatcher
    ParagraphDispatcher --> LegacyFragment
  ```

review_focus: |
  In scope: fetching+rendering a landing page's real page-level content, routing its paragraphs
  through the (pre-existing, previously-unconsumed) dispatch mechanism, ISR-style caching with
  on-demand revalidation plus a fallback TTL, and the minimal public web route needed to reach any
  of this. Explicitly out of scope — do not flag as missing: any real native paragraph React
  component (owned by the Paragraph/Component Library epic; `NATIVE_PARAGRAPH_COMPONENTS` is
  deliberately empty and proven only via test fixtures), a public marketing-site header/footer
  shell, and URL-path-alias-based routing (this uses the Drupal node id directly, same as the
  existing Page Inventory feature). Riskiest/most load-bearing guess in this plan: the Drupal
  paragraph/media content-type machine names and the legacy-fragment render path are all
  placeholders — no real Drupal schema is documented anywhere in this repo (confirmed by grep), so
  judge the *mechanism* (native-vs-legacy dispatch, resolved/unresolved/failed handling, cache/
  revalidation behavior) rather than these specific string values. Also worth a close look: the
  `App.tsx` refactor that hoists `ToastProvider` above the auth branches and adds an unguarded
  route — this is a deliberate, minimal change to let an unauthenticated visitor reach a landing
  page at all, not a loosening of the existing RBAC for any internal route.

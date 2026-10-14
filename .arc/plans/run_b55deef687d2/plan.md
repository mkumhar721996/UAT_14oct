summary: |
  Add the environment-driven configuration plumbing that every future Drupal fetcher in
  `comp_api_service` will sit on top of: a `loadDrupalConfig(env)` reader that pulls the target
  base URL and a single opaque credential purely from `process.env` (no hard-coded host or
  secret anywhere in the fetch layer), a `createDrupalClient` wrapper that turns that config into
  an HTTP client which injects the credential as an `Authorization: Bearer <token>` header and
  refuses to call out when either value is missing, and two small demonstrative fetchers built on
  top of that client so every acceptance criterion ("any fetcher requests published content") has
  something concrete to exercise, and so the "no fetcher needs code changes" claim is actually
  proven by a second fetcher rather than asserted. This is greenfield code — no Drupal fetch layer
  exists in the repo yet — scoped to exactly the base-URL/credential plumbing the story describes,
  not to the full JSON:API data layer (node typing, path-alias resolution, listing every content
  type) the parent epic will add later. Beyond the six formal ACs, this revision adds edge-case
  coverage for blank env values, non-2xx Drupal responses, base-URL trailing-slash joining, and
  credential rotation.
scope:
  - description: |
      Add `loadDrupalConfig(env)`, a pure reader of `DRUPAL_BASE_URL` and `DRUPAL_API_TOKEN` from
      `process.env`, re-read on every call (never cached at module scope) so a changed env var is
      picked up with zero code change. Blank values are treated as unset:
      `env.DRUPAL_BASE_URL?.trim() || undefined` (same for the token) — a `DRUPAL_BASE_URL=""` or
      whitespace-only value must behave exactly like an absent one (AC3's "not set" case), not like
      a valid empty host.
    files:
      - services/api/src/drupal/drupal-config.ts
      - services/api/src/drupal/drupal-config.spec.ts
    rationale: |
      Mirrors the existing `loadConfig(env: NodeJS.ProcessEnv = process.env)` pattern already used
      in `services/worker/src/config.ts` (and the plain `process.env.X` reads in
      `services/api/src/auth/token-verifier.ts` / `services/api/src/database/data-source.ts`) so
      this fits the service's existing convention instead of introducing `@nestjs/config`, which
      is not used anywhere in `comp_api_service` today. The blank-string case is a common deploy
      mistake (an env var declared but left empty in a manifest) that would otherwise silently
      pass an empty string through as a "set" base URL.
  - description: |
      Add typed errors `MissingDrupalBaseUrlError`, `MissingDrupalCredentialError`, and
      `DrupalRequestError` (constructed as `new DrupalRequestError(status: number, statusText:
      string)`, exposing both as readonly fields) thrown by the client before/after the network
      call respectively.
    files:
      - services/api/src/drupal/errors.ts
    rationale: |
      `MissingDrupalBaseUrlError`/`MissingDrupalCredentialError` give AC3 and AC6 a single visible,
      typed failure mode instead of silently falling back to an empty-string host or an
      unauthenticated request. `DrupalRequestError` is the edge case for when the base URL and
      credential are both present but Drupal itself rejects the request (expired/invalid token,
      missing JSON:API permission, 5xx) — without it a non-2xx response would otherwise be returned
      as "content" since `fetch` does not reject on HTTP error statuses.
  - description: |
      Add `createDrupalClient(config, fetchImpl?)` returning a small `DrupalClient` with one
      method, `getJson<T>(path: string): Promise<T>`, that resolves `path` against
      `config.baseUrl` via `new URL(path, config.baseUrl)` (so a trailing slash on `baseUrl` never
      produces a doubled `//` before `jsonapi`), sets `Authorization: Bearer <config.bearerToken>`
      and `Accept: application/vnd.api+json`, throws the two config errors above before calling
      `fetchImpl` when `baseUrl`/`bearerToken` is missing, and throws `DrupalRequestError` when
      `!response.ok`.
    files:
      - services/api/src/drupal/drupal-client.ts
      - services/api/src/drupal/drupal-client.spec.ts
    rationale: |
      This is the one seam where host-resolution, auth-header construction, and error-surfacing
      happen. Every current and future fetcher calls through here, so once the exact auth scheme is
      confirmed (the story notes it still might change), only this file needs to change — no
      fetcher does. `fetchImpl` is an injectable parameter (defaulting to the global `fetch`,
      available on Node >=20 per this service's `engines` field) purely so tests can assert on
      calls without a real network dependency.
  - description: |
      Add `fetchPublishedContent(contentType, client?)`, a thin fetcher calling
      `client.getJson(\`/jsonapi/node/${contentType}?filter[status]=1\`)`, to give every AC's "any
      fetcher requests published content" wording a concrete function to exercise.
    files:
      - services/api/src/drupal/published-content.fetcher.ts
      - services/api/src/drupal/published-content.fetcher.spec.ts
    rationale: |
      `/jsonapi/node/{type}?filter[status]=1` is Drupal JSON:API's standard published-content
      filter. Later epic stories (listing every content type, resolving path aliases) are expected
      to add more fetchers that call `createDrupalClient` directly rather than duplicate this one.
  - description: |
      Add a second, independent fetcher, `fetchPublishedTaxonomyTerms(vocabulary, client?)`, calling
      `client.getJson(\`/jsonapi/taxonomy_term/${vocabulary}?filter[status]=1\`)`.
    files:
      - services/api/src/drupal/published-taxonomy-terms.fetcher.ts
      - services/api/src/drupal/published-taxonomy-terms.fetcher.spec.ts
    rationale: |
      The story's scope claims "no fetcher needs code changes once [auth] is confirmed" — a single
      fetcher can't prove that claim, since there's nothing to compare it against. A second fetcher
      that reuses `createDrupalClient` unchanged, and hits the same typed errors with no
      fetcher-specific branching, is the concrete evidence for that scope statement rather than an
      assertion of it.
  - description: |
      Add a source-scan test asserting the fetch-layer directory's non-spec `.ts` files contain no
      literal `http(s)://` URL and no literal copy of the fake bearer-token/host values used by the
      other specs.
    files:
      - services/api/src/drupal/no-hardcoded-host.spec.ts
    rationale: |
      Operationalizes AC5 ("searched for any Drupal host name or credential value... none is
      found") as a repeatable check instead of relying on manual review alone. Scanning the whole
      directory at test time (not a fixed file list) means it automatically covers the new
      taxonomy-terms fetcher and any future fetcher added to this directory without the test itself
      needing an update.
tests:
  - |
    AC1 — local Docksal base URL: a fetcher requesting published content returns content from
    that instance.
    ```ts
    it('AC1: requests published content from the configured local Docksal base URL', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: ['local-article'] }), { status: 200 }));
      const client = createDrupalClient({ baseUrl: 'http://drupal.docksal.site', bearerToken: 'secret-token' }, fetchMock);
      const result = await fetchPublishedContent('article', client);
      expect(fetchMock).toHaveBeenCalledWith('http://drupal.docksal.site/jsonapi/node/article?filter[status]=1', expect.any(Object));
      expect(result).toEqual({ data: ['local-article'] });
    });
    ```
  - |
    AC2 — changing the base URL env var with no code change redirects the same fetcher to a
    remote dev/test instance.
    ```ts
    it('AC2: loadDrupalConfig picks up a changed DRUPAL_BASE_URL with no code change', () => {
      expect(loadDrupalConfig({ DRUPAL_BASE_URL: 'http://drupal.docksal.site' } as NodeJS.ProcessEnv).baseUrl)
        .toBe('http://drupal.docksal.site');
      expect(loadDrupalConfig({ DRUPAL_BASE_URL: 'https://dev.example-remote.test' } as NodeJS.ProcessEnv).baseUrl)
        .toBe('https://dev.example-remote.test');
    });
    ```
    plus a client-level assertion that the same `fetchPublishedContent` call targets whichever
    `baseUrl` the client was built with, proving no fetcher code path changes between targets.
  - |
    AC3 — base URL unset: no content is returned from any default host; no network call is made.
    ```ts
    it('AC3: throws MissingDrupalBaseUrlError and makes no request when DRUPAL_BASE_URL is unset', async () => {
      const fetchMock = vi.fn();
      const client = createDrupalClient({ bearerToken: 'secret-token' }, fetchMock);
      await expect(fetchPublishedContent('article', client)).rejects.toBeInstanceOf(MissingDrupalBaseUrlError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
    ```
  - |
    AC4 — the credential is carried as an OAuth2 bearer token in the Authorization header.
    ```ts
    it('AC4: sends the credential as an OAuth2 bearer token in the Authorization header', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
      const client = createDrupalClient({ baseUrl: 'http://drupal.docksal.site', bearerToken: 'secret-token' }, fetchMock);
      await fetchPublishedContent('article', client);
      const [, init] = fetchMock.mock.calls[0];
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
    });
    ```
  - |
    AC5 — the fetch layer source contains no Drupal host name or credential value.
    ```ts
    it('AC5: fetch layer source contains no literal host or credential value', () => {
      const dir = __dirname;
      const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
      for (const file of files) {
        const content = readFileSync(join(dir, file), 'utf8');
        expect(content).not.toMatch(/https?:\/\/[^'"`\s]+/);
        expect(content).not.toContain('secret-token');
      }
    });
    ```
  - |
    AC6 — the credential env var is unset: a visible error is thrown in place of content, with no
    request attempted.
    ```ts
    it('AC6: throws MissingDrupalCredentialError and makes no request when the credential is unset', async () => {
      const fetchMock = vi.fn();
      const client = createDrupalClient({ baseUrl: 'http://drupal.docksal.site' }, fetchMock);
      await expect(fetchPublishedContent('article', client)).rejects.toBeInstanceOf(MissingDrupalCredentialError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
    ```
  - |
    Edge case — a blank/whitespace-only base URL or credential env var is treated as unset, not as
    a valid empty value (guards a common deploy mistake: the var declared but left empty).
    ```ts
    it('treats a whitespace-only DRUPAL_BASE_URL as unset', () => {
      expect(loadDrupalConfig({ DRUPAL_BASE_URL: '   ' } as NodeJS.ProcessEnv).baseUrl).toBeUndefined();
    });
    it('treats an empty-string DRUPAL_API_TOKEN as unset', () => {
      expect(loadDrupalConfig({ DRUPAL_API_TOKEN: '' } as NodeJS.ProcessEnv).bearerToken).toBeUndefined();
    });
    ```
  - |
    Edge case — Drupal responds with a non-2xx status (expired token, missing permission, 5xx):
    the client must surface a typed error instead of returning the error body as if it were
    content.
    ```ts
    it('throws DrupalRequestError and does not return content when Drupal responds non-2xx', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('Forbidden', { status: 403, statusText: 'Forbidden' }));
      const client = createDrupalClient({ baseUrl: 'http://drupal.docksal.site', bearerToken: 'secret-token' }, fetchMock);
      await expect(fetchPublishedContent('article', client)).rejects.toMatchObject({ status: 403, statusText: 'Forbidden' });
    });
    ```
  - |
    Edge case — a base URL with a trailing slash still joins to a single `/` before `jsonapi`
    (no doubled or dropped slash).
    ```ts
    it('joins a base URL with a trailing slash without a doubled slash', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
      const client = createDrupalClient({ baseUrl: 'http://drupal.docksal.site/', bearerToken: 'secret-token' }, fetchMock);
      await fetchPublishedContent('article', client);
      expect(fetchMock).toHaveBeenCalledWith('http://drupal.docksal.site/jsonapi/node/article?filter[status]=1', expect.any(Object));
    });
    ```
  - |
    Edge case — rotating the credential value between two calls (e.g. a secret-manager rotation)
    is picked up with no code change, mirroring AC2 but for the credential rather than the host.
    ```ts
    it('sends whichever credential is current with no code change between calls', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
      await fetchPublishedContent('article', createDrupalClient({ baseUrl: 'http://drupal.docksal.site', bearerToken: 'token-a' }, fetchMock));
      await fetchPublishedContent('article', createDrupalClient({ baseUrl: 'http://drupal.docksal.site', bearerToken: 'token-b' }, fetchMock));
      expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer token-a');
      expect((fetchMock.mock.calls[1][1].headers as Record<string, string>).Authorization).toBe('Bearer token-b');
    });
    ```
  - |
    Edge case — a second, independent fetcher (`fetchPublishedTaxonomyTerms`) hits the same typed
    config errors with no fetcher-specific code, proving the "no fetcher needs code changes" claim
    rather than just asserting it.
    ```ts
    it('a second fetcher (taxonomy terms) throws the same typed error as the content fetcher when config is missing', async () => {
      const client = createDrupalClient({}, vi.fn());
      await expect(fetchPublishedTaxonomyTerms('tags', client)).rejects.toBeInstanceOf(MissingDrupalBaseUrlError);
    });
    ```
assumptions_or_open_questions:
  - |
    Env var names (`DRUPAL_BASE_URL`, `DRUPAL_API_TOKEN`) are not specified by the story; chosen to
    match the flat, unprefixed `SCREAMING_SNAKE_CASE` style already used for `DATABASE_URL`,
    `COGNITO_USER_POOL_ID`, and `JOB_QUEUE_URL` elsewhere in this repo. Confirm or rename before
    merge.
  - |
    "the credential environment variable" is treated as one opaque string used directly as the
    bearer token value (AC4 literally says "that credential as an OAuth2 bearer token"), not a
    client-id/secret pair requiring a token-exchange call — the story itself says the exact auth
    scheme is still to be confirmed, so a full OAuth2 client-credentials grant/refresh flow is
    explicitly out of scope here; only the single seam (`createDrupalClient`) that would need to
    change to add one is in scope.
  - |
    "a visible error is shown in place of content" (AC6) is implemented at the fetch-layer boundary
    as a thrown, typed error that the caller must handle — there is no controller/route or UI
    surface in scope for this story to literally render that error to an end user; a later story
    in the same epic is expected to translate it into an HTTP response or UI state.
  - |
    `DrupalRequestError` and the blank-env-var/trailing-slash/credential-rotation edge cases are
    not named by any of the story's six ACs; they're added because a plumbing layer that only
    handles the literal AC wording (present/absent) but mishandles "present but blank" or "present
    but Drupal rejects it" would still fail in practice. Flagging these as additions beyond the
    formal ACs in case the reviewer wants any trimmed.
  - |
    No `.env.example` exists anywhere in this repo today (checked `services/api` and
    `services/worker`), so none is added here; the two env var names are documented only in code
    and tests.
estimated_points: 5
package_dependencies: []
notes: |
  No existing Drupal fetch layer, gatsby-source-drupal reference, or prior ADR exists in this
  repo — this is genuinely greenfield code under `services/api/src/drupal/`. Node 20 (this
  service's declared `engines.node`) has a global `fetch`/`Response`/`URL`, so no new HTTP client
  package is needed.

  ```mermaid
  flowchart TD
    A[published-content.fetcher.ts<br/>fetchPublishedContent] --> C[drupal-client.ts<br/>createDrupalClient]
    F[published-taxonomy-terms.fetcher.ts<br/>fetchPublishedTaxonomyTerms] --> C
    C --> D[drupal-config.ts<br/>loadDrupalConfig]
    C --> E[errors.ts<br/>Missing*Error / DrupalRequestError]
    C -. "fetchImpl param, defaults to global fetch" .-> G[global fetch]

    classDef touched fill:#f96,color:#000
    class A,F,C,D,E touched
  ```
review_focus: |
  In scope: an env-driven config reader, a `DrupalClient` seam that injects the bearer-token
  Authorization header and surfaces non-2xx responses as a typed error, two demonstrative fetchers
  (published content + taxonomy terms, the second existing specifically to prove reuse rather than
  assert it), and a source-scan test guarding AC5. Out of scope (deliberately): any NestJS
  module/controller/route wiring this into an HTTP endpoint, real Drupal entity/field typing,
  path-alias resolution, and any OAuth2 grant/refresh flow beyond treating the credential as a
  ready-made bearer token.

  Riskiest area: the AC5 guard (`no-hardcoded-host.spec.ts`) is a blunt regex over non-spec `.ts`
  files in the directory — it will also fire on any future legitimate literal URL fragment added
  to that directory, which is intentional (mechanical enforcement over relying on review alone),
  not a bug. The edge cases beyond the six formal ACs (blank env values, non-2xx responses,
  trailing-slash joining, credential rotation) were added because they're realistic failure modes
  for this plumbing, not because any AC names them — flag to the reviewer as candidates to trim if
  out of appetite for this story.

  Non-obvious decision: `loadDrupalConfig` re-reads `process.env` on every call rather than
  caching a module-level config object — that's what makes AC2 ("no code change" to retarget)
  true; don't read the lack of caching as an oversight.

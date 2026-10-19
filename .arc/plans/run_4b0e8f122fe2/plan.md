summary: |
  Adds the environment-driven configuration and HTTP plumbing that every future Drupal
  JSON:API fetcher will share: a `loadDrupalConfig()` that reads the target base URL and
  bearer credential purely from environment variables (no hard-coded host or secret, and no
  fallback default host), and a `fetchDrupalResource()` primitive that resolves a request
  path against that base URL and attaches the credential as an `Authorization: Bearer <token>`
  header. This lands in `services/api` (comp_api_service) rather than the web SPA because the
  bearer credential must never reach the browser bundle. No concrete content fetchers
  (articles, pages, etc.) exist in this codebase yet — those are future stories under the same
  "JSON:API Data-Fetching Layer" epic — so this plan builds only the shared low-level fetch
  primitive they will all call, proven by tests that exercise it directly as "the" fetcher.

scope:
  - description: |
      Add `DrupalConfig`/`loadDrupalConfig()`, mirroring the existing `services/worker/src/config.ts`
      convention (read from an injectable `env` map defaulting to `process.env`, throw a clear
      error naming the missing variable instead of silently defaulting).
      ```ts
      export interface DrupalConfig {
        baseUrl: string;
        accessToken: string;
      }

      export class DrupalConfigError extends Error {}

      export function loadDrupalConfig(env: NodeJS.ProcessEnv = process.env): DrupalConfig {
        const baseUrl = env.DRUPAL_BASE_URL ?? '';
        if (!baseUrl) {
          throw new DrupalConfigError('DRUPAL_BASE_URL environment variable is required');
        }
        const accessToken = env.DRUPAL_ACCESS_TOKEN ?? '';
        if (!accessToken) {
          throw new DrupalConfigError('DRUPAL_ACCESS_TOKEN environment variable is required');
        }
        return { baseUrl, accessToken };
      }
      ```
      No default/fallback value is ever assigned to `baseUrl` (unlike `AWS_REGION` in the
      worker's config, which does default) — AC3 requires that an unset base URL never resolves
      to any host, local or otherwise.
    files:
      - services/api/src/drupal/drupal-config.ts
    rationale: |
      Reuses the one config-loading idiom already established in this monorepo
      (`services/worker/src/config.ts`'s `loadConfig`) instead of inventing a second pattern.
      Keeping `baseUrl` and `accessToken` as plain required strings (not optional with a
      default) is what makes AC3's "no content returned from any default host" structurally
      true rather than something a caller must remember to check.

  - description: |
      Add `fetchDrupalResource()`, the shared low-level request primitive every future
      content-specific fetcher will call.
      ```ts
      import { loadDrupalConfig } from './drupal-config.js';

      export class DrupalFetchError extends Error {}

      export async function fetchDrupalResource(
        path: string,
        env: NodeJS.ProcessEnv = process.env,
      ): Promise<unknown> {
        const config = loadDrupalConfig(env);
        const url = new URL(path, config.baseUrl).toString();
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${config.accessToken}` },
        });
        if (!response.ok) {
          throw new DrupalFetchError(`Drupal request to ${path} failed with status ${response.status}`);
        }
        return response.json();
      }
      ```
      Uses Node's built-in global `fetch` (available on the project's required Node >=20
      runtime) rather than adding an HTTP client dependency. `loadDrupalConfig` is called
      first and allowed to throw before any network call is attempted, so a missing base URL
      or credential never reaches `fetch` at all.
    files:
      - services/api/src/drupal/drupal-client.ts
    rationale: |
      Centralizing the URL-joining and `Authorization` header construction here is what lets
      "no fetcher needs code changes" once concrete content fetchers are added later — they
      will call `fetchDrupalResource(path)` and inherit the environment-driven base
      URL/credential behavior for free. Calling `loadDrupalConfig` before `fetch` is what
      proves AC3/AC6 ("no content returned"/"visible error ... in place of the content") as a
      request that never leaves the process, not just an error surfaced after a bad call.

  - description: |
      Unit tests for the config loader, covering the "missing variable" half of AC3 and AC6 at
      the config layer directly (in addition to the end-to-end fetch-level tests below).
      ```ts
      it('throws naming DRUPAL_BASE_URL when it is not set', () => {
        expect(() => loadDrupalConfig({ DRUPAL_ACCESS_TOKEN: 'tok' })).toThrow(/DRUPAL_BASE_URL/);
      });
      it('throws naming DRUPAL_ACCESS_TOKEN when it is not set', () => {
        expect(() => loadDrupalConfig({ DRUPAL_BASE_URL: 'http://local.docksal.site' })).toThrow(/DRUPAL_ACCESS_TOKEN/);
      });
      ```
    files:
      - services/api/src/drupal/drupal-config.spec.ts
    rationale: |
      Matches the existing `services/worker/src/config.test.ts` pattern of testing the pure
      config loader in isolation from anything that uses it.

  - description: |
      Unit tests for `fetchDrupalResource`, covering AC1, AC2, AC4, AC3, AC6 and AC5 against a
      mocked global `fetch` (see the `tests` section below for the literal assertions).
    files:
      - services/api/src/drupal/drupal-client.spec.ts
    rationale: |
      This is the only "fetcher" that exists in the codebase today, so it is the concrete
      target the story's acceptance criteria are tested against; any future content-specific
      fetcher built on top of `fetchDrupalResource` inherits this behavior unchanged.

tests:
  - |
    AC1/AC2 (services/api/src/drupal/drupal-client.spec.ts): the request target follows the
    configured base URL, and changing only the env var (no code change) changes where the next
    call goes.
    ```ts
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"data":[]}', { status: 200 }));

    await fetchDrupalResource('/jsonapi/node/article', { DRUPAL_BASE_URL: 'http://local.docksal.site', DRUPAL_ACCESS_TOKEN: 'tok' });
    expect(fetchMock).toHaveBeenCalledWith('http://local.docksal.site/jsonapi/node/article', expect.anything());

    fetchMock.mockClear();
    await fetchDrupalResource('/jsonapi/node/article', { DRUPAL_BASE_URL: 'https://dev.example-drupal.test', DRUPAL_ACCESS_TOKEN: 'tok' });
    expect(fetchMock).toHaveBeenCalledWith('https://dev.example-drupal.test/jsonapi/node/article', expect.anything());
    ```
  - |
    AC3 (services/api/src/drupal/drupal-client.spec.ts): with no base URL configured, the call
    rejects and no request is ever made to any host.
    ```ts
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(fetchDrupalResource('/jsonapi/node/article', { DRUPAL_ACCESS_TOKEN: 'tok' }))
      .rejects.toThrow(/DRUPAL_BASE_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
    ```
  - |
    AC4 (services/api/src/drupal/drupal-client.spec.ts): the configured credential is sent as
    an OAuth2 bearer token.
    ```ts
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    await fetchDrupalResource('/jsonapi/node/article', { DRUPAL_BASE_URL: 'http://local.docksal.site', DRUPAL_ACCESS_TOKEN: 'secret-token' });
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer secret-token');
    ```
  - |
    AC5 (services/api/src/drupal/drupal-client.spec.ts): the fetch layer's own source contains
    no literal Drupal host or credential value.
    ```ts
    import { readFileSync } from 'node:fs';
    const source = readFileSync(new URL('./drupal-client.ts', import.meta.url), 'utf8')
      + readFileSync(new URL('./drupal-config.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/:\/\//);
    ```
  - |
    AC6 (services/api/src/drupal/drupal-client.spec.ts): with no credential configured, the
    call rejects with a descriptive, nameable error and no request is made (the visible error
    this plan's layer is responsible for producing; surfacing it in a rendered UI is deferred
    to the future story that adds an actual content screen).
    ```ts
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(fetchDrupalResource('/jsonapi/node/article', { DRUPAL_BASE_URL: 'http://local.docksal.site' }))
      .rejects.toThrow(/DRUPAL_ACCESS_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
    ```

assumptions_or_open_questions:
  - |
    No concrete Drupal content fetcher (articles, pages, menus, etc.) exists anywhere in this
    codebase yet, and the story's own scope line says "the exact auth scheme is still to be
    confirmed, but the plumbing exists so no fetcher needs code changes once it is." This plan
    therefore builds only `loadDrupalConfig`/`fetchDrupalResource` as the shared primitive and
    tests it directly as "the" fetcher; it does not invent a speculative articles/pages domain
    to exercise it through.
  - |
    Chose the env var names `DRUPAL_BASE_URL` and `DRUPAL_ACCESS_TOKEN` since the story does not
    name them explicitly beyond "the base URL environment variable" / "the credential
    environment variable". These are the two names assumed throughout.
  - |
    Placed this in `services/api` (comp_api_service), not `apps/web` (comp_web_app): the bearer
    credential must never ship to the browser bundle, so the fetch must happen server-side.
    comp_api_service is the only backend component in the stack suited to hold it.
  - |
    AC6's "a visible error is shown in place of the content" is implemented at this layer as a
    thrown, descriptively-named `DrupalConfigError` rather than a rendered UI element, because
    no content-display screen exists yet to render it in. A future fetcher/controller/UI story
    is expected to catch this error and render it; this plan's job is to guarantee the error is
    always thrown (never a silent empty result) when the credential is missing.
  - |
    Not registered as a NestJS module/provider and not wired into `AppModule`: there is no
    consumer (controller or service) yet to inject it into, so adding DI scaffolding ahead of
    need would be speculative. `loadDrupalConfig`/`fetchDrupalResource` are plain exported
    functions, matching the existing `services/worker/src/config.ts` convention for
    environment-driven config in this monorepo.
  - |
    Uses Node's built-in global `fetch` (Node >=20, already the engines requirement for both
    `services/api` and `services/worker`) rather than adding an HTTP client dependency such as
    `axios` or `node-fetch`.

estimated_points: 3

package_dependencies: []

notes: |
  No mermaid diagram: this plan is purely additive (two new source files plus their two spec
  files, all in a brand-new `services/api/src/drupal/` directory) with no existing caller or
  module to wire into yet — a diagram would show only disconnected new nodes and no real call
  graph worth drawing.

  No new third-party dependency is needed: Node 20's global `fetch`/`Headers`/`Response` cover
  the HTTP client, and `vitest` (already a `services/api` devDependency) covers mocking
  `globalThis.fetch` in tests, the same way `services/worker`'s existing `config.test.ts`
  exercises its own `loadConfig` in isolation.

review_focus: |
  In scope: only the environment-driven base-URL/credential config loader and the single shared
  `fetchDrupalResource` HTTP primitive, plus their unit tests — proven directly, not through any
  real content fetcher, since none exists in this codebase yet. Out of scope and not to be
  flagged as missing: any NestJS controller/module wiring, any specific Drupal content-type
  fetcher (articles/pages/menus), and any UI that renders fetched content or its errors — those
  are later stories under the same epic. Riskiest/most deliberate decision to check: AC6's
  "visible error" is satisfied here by throwing a descriptive `DrupalConfigError`, not by
  rendering anything, because there is no content screen yet for an error to replace; don't flag
  the absence of a UI banner as a gap in this plan. Also verify the AC3/AC6 tests assert
  `fetch` was never called (not just that the promise rejects) — that's what proves "no content
  returned from any default host" rather than merely an eventual error after a real request.

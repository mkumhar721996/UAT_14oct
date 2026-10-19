summary: |
  Adds the single paragraph-type-to-rendering-path dispatch table that all five page template
  renderers (`HomePageTemplate`, `LandingPageTemplate`, `ClientWorkTemplate`, `PartnerTemplate`,
  `ServicesTemplate` in `apps/web/src/components/templates`) share to decide, for each paragraph
  instance on a page, whether it renders via its native React component or via a fetched legacy
  HTML fragment. This mirrors the `componentKey`-on-a-registry pattern `services/api`'s
  `resource-registry.ts` (UAT-14OCT-STORY-038) already established for the backend JSON:API
  dispatch, but lives in `apps/web` because template rendering is a frontend concern and
  UAT-14OCT-STORY-038's plan explicitly deferred "map a resolved identifier to an actual UI
  component" to whichever story builds the rendering layer. Only the generic dispatch mechanism is
  built and wired into all five templates; no real paragraph type name or Drupal content model is
  invented (per that same prior story's reviewer-confirmed constraint), and no paragraph
  component's actual visual implementation is built (owned by the Paragraph/Component Library
  epic) — both proven here with clearly-labeled fixture paragraph types the same way
  UAT-14OCT-STORY-038's tests used `example--quote`/`example--article`.
scope:
  - description: |
      Add the shared paragraph types: a `ParagraphInstance` identifying one paragraph on a page by
      its Drupal paragraph type and id, and a `ParagraphRenderPath` discriminated union naming
      exactly one of the two rendering paths (AC1 is enforced structurally by this union — a
      caller can never construct an entry that is both or neither).
      ```ts
      export interface ParagraphInstance {
        type: string
        id: string
      }

      export type ParagraphRenderPath =
        | { kind: 'component'; Component: (props: { paragraph: ParagraphInstance }) => JSX.Element }
        | { kind: 'html-fragment'; fetchHtml: (paragraph: ParagraphInstance) => Promise<string> }
      ```
    files:
      - apps/web/src/lib/paragraphs/types.ts
    rationale: |
      A shared contract keeps the dispatch table, the renderer, and the five templates from
      drifting independently, and makes "exactly one path" a type-level guarantee rather than a
      runtime check someone has to remember to add.
  - description: |
      Add `createParagraphDispatchTable()`, the single lookup/dispatch structure itself: a
      `register`/`resolve` pair keyed by paragraph type, rejecting a duplicate registration for an
      already-listed type (mirrors `services/api/src/drupal/resource-registry.ts`'s
      `createResourceRegistry()` precedent for "never ambiguous" dispatch). A module-level
      singleton (`paragraphDispatchTable`) is exported as the one table every template uses in the
      real app; it starts empty since no real paragraph type is named yet (six legacy types are
      pending the live inventory per this story's explicit scope note).
      ```ts
      export interface ParagraphDispatchRegistration {
        paragraphType: string
        renderPath: ParagraphRenderPath
      }

      export function createParagraphDispatchTable() {
        const entries = new Map<string, ParagraphRenderPath>()
        return {
          register(registration: ParagraphDispatchRegistration): void {
            if (entries.has(registration.paragraphType)) {
              throw new Error(`A rendering path is already registered for paragraph type "${registration.paragraphType}"`)
            }
            entries.set(registration.paragraphType, registration.renderPath)
          },
          resolve(paragraphType: string): ParagraphRenderPath | undefined {
            return entries.get(paragraphType)
          },
        }
      }

      export type ParagraphDispatchTable = ReturnType<typeof createParagraphDispatchTable>
      export const paragraphDispatchTable = createParagraphDispatchTable()
      ```
    files:
      - apps/web/src/lib/paragraphs/paragraphDispatchTable.ts
    rationale: |
      `register()` throwing on a duplicate `paragraphType` makes AC1's "names exactly one
      rendering path" true for the table as a whole (a type can never end up with two competing
      entries), not just per-entry via the union type. Exporting `createParagraphDispatchTable()`
      as a factory (not just the singleton) is what lets tests build isolated tables to prove AC4
      and AC5 without mutating shared state between test cases.
  - description: |
      Add `ParagraphRenderer`, the one component every template calls per paragraph instance: it
      resolves the instance's type in the table and renders the matched path — the native
      `Component` for `'component'`, or a small internal `HtmlFragmentParagraph` that calls
      `fetchHtml(paragraph)` and renders the resolved markup for `'html-fragment'`. An unlisted
      type or a table with no entry renders nothing (no fabricated fallback UI). A `table` prop
      defaults to the shared singleton so production call sites need not pass one, while tests can
      inject an isolated table. `ParagraphList` is a thin wrapper mapping an array of instances
      through `ParagraphRenderer`, used by each template.
      ```tsx
      export function ParagraphRenderer({
        paragraph,
        table = paragraphDispatchTable,
      }: {
        paragraph: ParagraphInstance
        table?: ParagraphDispatchTable
      }) {
        const entry = table.resolve(paragraph.type)
        if (!entry) return null
        if (entry.kind === 'component') {
          const { Component } = entry
          return <Component paragraph={paragraph} />
        }
        return <HtmlFragmentParagraph paragraph={paragraph} fetchHtml={entry.fetchHtml} />
      }

      export function ParagraphList({ paragraphs, table }: { paragraphs: ParagraphInstance[]; table?: ParagraphDispatchTable }) {
        return (
          <>
            {paragraphs.map((paragraph) => (
              <ParagraphRenderer key={paragraph.id} paragraph={paragraph} table={table} />
            ))}
          </>
        )
      }
      ```
      `HtmlFragmentParagraph` holds the fetched HTML in local state (`useState<string | null>`),
      kicks off `fetchHtml` in a `useEffect` keyed on the paragraph, and renders
      `<div data-testid="paragraph-html-fragment" dangerouslySetInnerHTML={{ __html: html }} />`
      once resolved (renders nothing while pending, matching the "no fabricated UI" rule above —
      a loading state is not required by any AC).
    files:
      - apps/web/src/components/paragraphs/ParagraphRenderer.tsx
    rationale: |
      Centralizing the per-paragraph dispatch in one component (rather than duplicating the
      lookup in each of the five templates) is what makes AC4 ("uses the rendering path its type
      maps to... on any of the five templates") and AC5 ("the changed path on every one of the
      five templates") true by construction: all five templates call the same function, so a
      change to the table's entry for a type is visible to every one of them simultaneously with
      no per-template code to keep in sync.
  - description: |
      Extend `DrupalNode` with an optional `paragraphs` field, and wire `ParagraphList` into each
      of the five templates so a page of any template type renders its paragraphs through the
      shared dispatch table. Each template additionally accepts an optional `paragraphDispatchTable`
      pass-through prop (defaults to the shared singleton) purely so tests can inject an isolated
      table per the AC4/AC5 tests below; production call sites pass only `node`.
      ```ts
      export interface DrupalNode {
        contentType: string
        templateField?: string | null
        paragraphs?: ParagraphInstance[]
      }
      ```
      ```tsx
      export function HomePageTemplate({
        node,
        paragraphDispatchTable: table,
      }: {
        node: DrupalNode
        paragraphDispatchTable?: ParagraphDispatchTable
      }) {
        return (
          <div data-testid="home-page-template">
            {node.contentType}
            <ParagraphList paragraphs={node.paragraphs ?? []} table={table} />
          </div>
        )
      }
      ```
      The same change (new optional prop, same `ParagraphList` call) is applied identically to
      `LandingPageTemplate`, `ClientWorkTemplate`, `PartnerTemplate`, and `ServicesTemplate` — each
      currently an identical one-line stub differing only in its `data-testid` and own name.
    files:
      - apps/web/src/lib/templates/types.ts
      - apps/web/src/components/templates/HomePageTemplate.tsx
      - apps/web/src/components/templates/LandingPageTemplate.tsx
      - apps/web/src/components/templates/ClientWorkTemplate.tsx
      - apps/web/src/components/templates/PartnerTemplate.tsx
      - apps/web/src/components/templates/ServicesTemplate.tsx
    rationale: |
      This is the minimal wiring that makes the dispatch table actually "shared by all five
      template renderers" (the story's own framing) rather than a structure that exists but no
      renderer consumes — without building any real paragraph content, which the story explicitly
      places elsewhere (Paragraph/Component Library epic) and which `TemplateRouter`'s own prior
      plan (UAT-14OCT-STORY-044) already deferred to each template's own future story. The new
      prop is optional and additive, so `TemplateRouter`'s existing
      `Record<TemplateType, (props: { node: DrupalNode }) => JSX.Element>` map
      (`apps/web/src/components/templates/TemplateRouter.tsx`) keeps type-checking unchanged and
      is not touched by this plan.
  - description: |
      Unit/component tests for each module above, using only clearly-labeled fixture paragraph
      types (e.g. `example--quote`, `example--legacy-banner`) — never a real Drupal paragraph type
      name, since the six legacy types are explicitly pending the live inventory per this story's
      scope note.
    files:
      - apps/web/src/lib/paragraphs/paragraphDispatchTable.test.ts
      - apps/web/src/components/paragraphs/ParagraphRenderer.test.tsx
      - apps/web/src/components/templates/paragraphDispatch.test.tsx
    rationale: |
      Mirrors the existing convention in `apps/web/src/lib/templates/resolveTemplateType.test.ts`
      and `apps/web/src/components/templates/TemplateRouter.test.tsx` of pairing a pure-logic test
      file with a component-level test file, and `services/api`'s
      `resource-registry.spec.ts` convention of proving registry behavior with example/fixture
      types rather than real content-model names.
tests:
  - |
    paragraphDispatchTable.test.ts (AC1) — a registered type's entry names exactly one path, and
    an unlisted type resolves to no entry at all:
    ```ts
    const table = createParagraphDispatchTable()
    table.register({ paragraphType: 'example--quote', renderPath: { kind: 'component', Component: () => null } })
    table.register({ paragraphType: 'example--legacy-banner', renderPath: { kind: 'html-fragment', fetchHtml: async () => '' } })
    expect(table.resolve('example--quote')?.kind).toBe('component')
    expect(table.resolve('example--legacy-banner')?.kind).toBe('html-fragment')
    expect(table.resolve('example--unlisted')).toBeUndefined()
    ```
  - |
    paragraphDispatchTable.test.ts (AC1) — registering a second path for an already-listed type is
    rejected, so a type can never end up naming more than one path:
    ```ts
    const table = createParagraphDispatchTable()
    table.register({ paragraphType: 'example--quote', renderPath: { kind: 'component', Component: () => null } })
    expect(() =>
      table.register({ paragraphType: 'example--quote', renderPath: { kind: 'html-fragment', fetchHtml: async () => '' } }),
    ).toThrow(/already registered/)
    ```
  - |
    ParagraphRenderer.test.tsx (AC2) — a paragraph instance whose type maps to the component path
    is rendered by that native component, receiving the paragraph instance:
    ```tsx
    const table = createParagraphDispatchTable()
    const Fixture = ({ paragraph }: { paragraph: ParagraphInstance }) => <div data-testid="fixture">{paragraph.id}</div>
    table.register({ paragraphType: 'example--quote', renderPath: { kind: 'component', Component: Fixture } })
    render(<ParagraphRenderer paragraph={{ type: 'example--quote', id: '7' }} table={table} />)
    expect(screen.getByTestId('fixture')).toHaveTextContent('7')
    ```
  - |
    ParagraphRenderer.test.tsx (AC3) — a paragraph instance whose type maps to the html-fragment
    path is rendered from the HTML fetched for it:
    ```tsx
    const table = createParagraphDispatchTable()
    const fetchHtml = vi.fn().mockResolvedValue('<p>Legacy content</p>')
    table.register({ paragraphType: 'example--legacy-banner', renderPath: { kind: 'html-fragment', fetchHtml } })
    render(<ParagraphRenderer paragraph={{ type: 'example--legacy-banner', id: '9' }} table={table} />)
    expect(await screen.findByTestId('paragraph-html-fragment')).toHaveTextContent('Legacy content')
    expect(fetchHtml).toHaveBeenCalledWith({ type: 'example--legacy-banner', id: '9' })
    ```
  - |
    paragraphDispatch.test.tsx (AC4) — parameterized across all five templates: a paragraph
    instance of a listed type renders via the path its type maps to, on every template:
    ```tsx
    it.each([
      ['HomePage', HomePageTemplate],
      ['LandingPage', LandingPageTemplate],
      ['ClientWork', ClientWorkTemplate],
      ['Partner', PartnerTemplate],
      ['Services', ServicesTemplate],
    ])('%s renders a listed paragraph via its dispatch-table-mapped path', (_, Template) => {
      const table = createParagraphDispatchTable()
      const Fixture = ({ paragraph }: { paragraph: ParagraphInstance }) => <div data-testid="fixture">{paragraph.id}</div>
      table.register({ paragraphType: 'example--quote', renderPath: { kind: 'component', Component: Fixture } })
      render(<Template node={{ contentType: 'x', paragraphs: [{ type: 'example--quote', id: '1' }] }} paragraphDispatchTable={table} />)
      expect(screen.getByTestId('fixture')).toBeInTheDocument()
    })
    ```
  - |
    paragraphDispatch.test.tsx (AC5) — parameterized across all five templates: changing a type's
    mapped path in the table changes which path every template uses for it, with no per-template
    change required:
    ```tsx
    it.each([
      ['HomePage', HomePageTemplate],
      ['LandingPage', LandingPageTemplate],
      ['ClientWork', ClientWorkTemplate],
      ['Partner', PartnerTemplate],
      ['Services', ServicesTemplate],
    ])('%s switches to the html-fragment path once the table remaps that type', async (_, Template) => {
      const fetchHtml = vi.fn().mockResolvedValue('<p>fragment</p>')
      const table = createParagraphDispatchTable()
      table.register({ paragraphType: 'example--quote', renderPath: { kind: 'html-fragment', fetchHtml } })
      render(<Template node={{ contentType: 'x', paragraphs: [{ type: 'example--quote', id: '1' }] }} paragraphDispatchTable={table} />)
      expect(await screen.findByTestId('paragraph-html-fragment')).toHaveTextContent('fragment')
    })
    ```
assumptions_or_open_questions:
  - |
    No real Drupal paragraph type name, and none of the six legacy HTML-fragment types, is
    documented anywhere available to this plan (checked the repo, `events.txt`, and prior stories'
    plans) — the story's own scope note says the six legacy types are "pending the live
    inventory." Per the precedent UAT-14OCT-STORY-038 set for the equivalent backend registry,
    this plan builds and proves only the generic dispatch mechanism with clearly-labeled fixture
    types (`example--quote`, `example--legacy-banner`); registering real paragraph types is
    follow-up work for whichever story is unblocked by that inventory.
  - |
    `DrupalNode.paragraphs` and each template's `paragraphDispatchTable` prop are new, minimal,
    additive surface needed only to prove AC4/AC5 against all five real template components rather
    than a stand-in. No route or page in the app currently constructs a `DrupalNode` with
    paragraphs (there is no Drupal fetching anywhere in `apps/web` yet, confirmed by
    UAT-14OCT-STORY-044's plan and a fresh grep), so this has no effect on any existing page today.
  - |
    `fetchHtml` is modeled as a function supplied per-registration (like `TypedFetcher.fetchById`
    in `services/api/src/drupal/typed-fetcher.ts`), not a single app-wide HTTP call, since the six
    legacy types' actual fetch mechanism/endpoint is unknown and may differ per type. This plan
    does not add any real `fetchHtml` implementation or wire it to `apiClient`/`services/api` —
    only the shape a future legacy-type registration would supply.
  - |
    This plan does not touch `TemplateRouter.tsx`: its existing
    `Record<TemplateType, (props: { node: DrupalNode }) => JSX.Element>` map still type-checks
    against each template's new (optional, additive) `paragraphDispatchTable` prop, so dispatch
    continues to work unchanged through the router; the AC4/AC5 tests render each template
    directly (as `resolveTemplateType.test.ts` does for the resolver) to inject an isolated table
    without needing router-level plumbing this story doesn't ask for.
  - |
    Reviewed the existing UI component catalogue (ActiveGrid, Banner, CoreFieldInput,
    CustomerHeader, Layout, PasswordField, Toast, and the five templates) — none render paragraphs
    today, so `ParagraphRenderer`/`ParagraphList` are new components, not a duplicate of one
    already in the catalogue.
estimated_points: 5
package_dependencies: []
notes: |
  No new third-party dependency is needed: `@testing-library/react`, `jsdom`, and `vitest` are
  already `apps/web` devDependencies and already cover this style of component test (see
  `TemplateRouter.test.tsx`).

  ```mermaid
  flowchart TD
    classDef touched fill:#f96,color:#000
    classDef context fill:#eee,color:#000

    Types["lib/paragraphs/types.ts\nParagraphInstance / ParagraphRenderPath"]:::touched
    Table["lib/paragraphs/paragraphDispatchTable.ts\ncreateParagraphDispatchTable()"]:::touched
    Renderer["components/paragraphs/ParagraphRenderer.tsx\nParagraphRenderer / ParagraphList"]:::touched
    NodeTypes["lib/templates/types.ts\nDrupalNode"]:::touched
    HP["HomePageTemplate.tsx"]:::touched
    LP["LandingPageTemplate.tsx"]:::touched
    CW["ClientWorkTemplate.tsx"]:::touched
    PT["PartnerTemplate.tsx"]:::touched
    SV["ServicesTemplate.tsx"]:::touched
    TR["TemplateRouter.tsx\n(unchanged)"]:::context
    ResolveTT["resolveTemplateType.ts\n(unchanged)"]:::context

    Table -->|typed by| Types
    Renderer -->|resolves path via shared table| Table
    Renderer -->|typed by| Types
    NodeTypes -->|paragraphs field typed by| Types
    HP -->|renders paragraphs via| Renderer
    LP -->|renders paragraphs via| Renderer
    CW -->|renders paragraphs via| Renderer
    PT -->|renders paragraphs via| Renderer
    SV -->|renders paragraphs via| Renderer
    TR -->|dispatches node to, map unchanged| HP
    TR -->|dispatches node to, map unchanged| LP
    TR -->|dispatches node to, map unchanged| CW
    TR -->|dispatches node to, map unchanged| PT
    TR -->|dispatches node to, map unchanged| SV
    TR -->|uses| ResolveTT
  ```
review_focus: |
  In scope: the `ParagraphInstance`/`ParagraphRenderPath` contract, the
  `createParagraphDispatchTable()` register/resolve structure with duplicate-registration
  rejection, the shared `ParagraphRenderer`/`ParagraphList` consumed identically by all five
  templates, and the minimal additive wiring (`DrupalNode.paragraphs`, each template's optional
  `paragraphDispatchTable` prop) needed to prove AC4/AC5 against the real templates. Out of scope
  and not to be flagged as missing: any real Drupal paragraph type registration or naming of the
  six legacy types (pending inventory per the story), any actual paragraph component's visual
  implementation (Paragraph/Component Library epic), any real `fetchHtml` HTTP implementation or
  `services/api` wiring, and any change to `TemplateRouter.tsx` or route-level node fetching.
  Riskiest area: `HtmlFragmentParagraph`'s fetch-on-mount/render-nothing-while-pending behavior in
  `ParagraphRenderer.tsx` — there's no loading-state AC, so rendering nothing until `fetchHtml`
  resolves is a deliberate minimal choice, not an oversight to flag. Also worth double-checking:
  the new `paragraphDispatchTable` prop on each template is optional and defaults to the shared
  singleton purely to make the dispatch table injectable in tests — production call sites (once
  they exist) are expected to pass only `node`.

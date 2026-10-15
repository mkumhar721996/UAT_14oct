summary: |
  Adds a pure template-resolution function and a dispatch component to `comp_web_app` (react+vite)
  that, given a published Drupal node, decide which of the five page templates (HomePage,
  LandingPage, ClientWork, Partner, Services) applies and render that template's renderer — with
  a single static, global mapping (no per-page configuration) — or render nothing when the node's
  template value is unmapped or ambiguous. This plan covers only resolution + dispatch, as scoped;
  it does not add Drupal/node fetching, route-level wiring, or any real template content, all of
  which the story explicitly places elsewhere.
scope:
  - description: |
      Add the shared type contract used by the resolver, the router, and their tests: a
      `TemplateType` union for the five known templates, and a `DrupalNode` shape representing an
      already-fetched, already-published node with the two candidate resolution bases (template
      field vs content type).

      ```ts
      export type TemplateType = 'HomePage' | 'LandingPage' | 'ClientWork' | 'Partner' | 'Services'

      export interface DrupalNode {
        contentType: string
        templateField?: string | null
      }
      ```
    files:
      - apps/web/src/lib/templates/types.ts
    rationale: |
      A single shared contract keeps the resolver (lib) and the router/renderers (components) from
      drifting independently, and gives the test files one import to assert against.
  - description: |
      Implement `resolveTemplateType(node: DrupalNode): TemplateType | null` as a pure function.
      It checks `templateField` first when present, falls back to `contentType`, and treats a
      disagreement between the two (when both are present and both map to a known template) as
      ambiguous:

      ```ts
      export function resolveTemplateType(node: DrupalNode): TemplateType | null {
        const fromTemplateField = node.templateField
          ? TEMPLATE_TYPE_BY_VALUE[node.templateField.trim().toLowerCase()]
          : undefined
        const fromContentType = TEMPLATE_TYPE_BY_VALUE[node.contentType.trim().toLowerCase()]
        if (fromTemplateField && fromContentType && fromTemplateField !== fromContentType) return null
        return fromTemplateField ?? fromContentType ?? null
      }
      ```
    files:
      - apps/web/src/lib/templates/resolveTemplateType.ts
      - apps/web/src/lib/templates/resolveTemplateType.test.ts
    rationale: |
      Keeping the mapping logic as a pure function (no React) makes the unmapped/ambiguous rule
      independently testable without rendering, and isolates the one part of this plan whose
      exact business rule is explicitly unconfirmed (see assumptions).
  - description: |
      Add five minimal placeholder renderer components, one per template, each rendering only a
      `data-testid` marker so dispatch can be proven without building real content (real content
      is each template's own story per the AC scope note):

      ```tsx
      export function HomePageTemplate({ node }: { node: DrupalNode }) {
        return <div data-testid="home-page-template">{node.contentType}</div>
      }
      ```
    files:
      - apps/web/src/components/templates/HomePageTemplate.tsx
      - apps/web/src/components/templates/LandingPageTemplate.tsx
      - apps/web/src/components/templates/ClientWorkTemplate.tsx
      - apps/web/src/components/templates/PartnerTemplate.tsx
      - apps/web/src/components/templates/ServicesTemplate.tsx
    rationale: |
      The dispatch mechanism must point at concrete components to be testable end-to-end; these
      are deliberately empty beyond a test marker so the renderer stories can fill them in later
      without needing to change the router's map or signature.
  - description: |
      Add `TemplateRouter`, the dispatch component: a single module-level, static map from
      `TemplateType` to its renderer (the "no per-page mapping configured" requirement), that
      calls `resolveTemplateType` and either renders the matched component or renders nothing.

      ```tsx
      const TEMPLATE_RENDERERS: Record<TemplateType, (props: { node: DrupalNode }) => JSX.Element> = {
        HomePage: HomePageTemplate,
        LandingPage: LandingPageTemplate,
        ClientWork: ClientWorkTemplate,
        Partner: PartnerTemplate,
        Services: ServicesTemplate,
      }

      export function TemplateRouter({ node }: { node: DrupalNode }) {
        const templateType = resolveTemplateType(node)
        if (!templateType) return null
        const Renderer = TEMPLATE_RENDERERS[templateType]
        return <Renderer node={node} />
      }
      ```
    files:
      - apps/web/src/components/templates/TemplateRouter.tsx
      - apps/web/src/components/templates/TemplateRouter.test.tsx
    rationale: |
      A single fixed map satisfies AC1's "no per-page mapping configured" directly — there is
      exactly one map for the whole app, not one per route/page — and returning `null` on failed
      resolution satisfies AC2 without inventing a fallback UI the ACs don't ask for.
tests:
  - |
    resolveTemplateType.test.ts — known templateField value resolves directly:
    ```ts
    expect(resolveTemplateType({ contentType: 'page', templateField: 'home_page' })).toBe('HomePage')
    ```
  - |
    resolveTemplateType.test.ts — falls back to contentType when templateField is absent/null:
    ```ts
    expect(resolveTemplateType({ contentType: 'services', templateField: null })).toBe('Services')
    ```
  - |
    resolveTemplateType.test.ts — unmapped value (AC2) returns null:
    ```ts
    expect(resolveTemplateType({ contentType: 'blog_post', templateField: 'blog_post' })).toBeNull()
    ```
  - |
    resolveTemplateType.test.ts — ambiguous value (AC2): templateField and contentType map to
    different templates:
    ```ts
    expect(resolveTemplateType({ contentType: 'partner', templateField: 'services' })).toBeNull()
    ```
  - |
    TemplateRouter.test.tsx — AC1, parameterized over all five templates, each renders only its
    own renderer with no per-page mapping configured:
    ```tsx
    it.each([
      ['home_page', 'home-page-template'],
      ['landing_page', 'landing-page-template'],
      ['client_work', 'client-work-template'],
      ['partner', 'partner-template'],
      ['services', 'services-template'],
    ])('renders the matching renderer for %s', (templateField, testId) => {
      render(<TemplateRouter node={{ contentType: templateField, templateField }} />)
      expect(screen.getByTestId(testId)).toBeInTheDocument()
    })
    ```
  - |
    TemplateRouter.test.tsx — AC2, unmapped template value renders none of the five renderers:
    ```tsx
    it('renders nothing for an unmapped template value', () => {
      render(<TemplateRouter node={{ contentType: 'blog_post', templateField: 'blog_post' }} />)
      for (const id of ['home-page-template', 'landing-page-template', 'client-work-template', 'partner-template', 'services-template']) {
        expect(screen.queryByTestId(id)).not.toBeInTheDocument()
      }
    })
    ```
  - |
    TemplateRouter.test.tsx — AC2, ambiguous template value renders none of the five renderers:
    ```tsx
    it('renders nothing when templateField and contentType disagree', () => {
      render(<TemplateRouter node={{ contentType: 'partner', templateField: 'services' }} />)
      expect(screen.queryByTestId('partner-template')).not.toBeInTheDocument()
      expect(screen.queryByTestId('services-template')).not.toBeInTheDocument()
    })
    ```
assumptions_or_open_questions:
  - |
    The epic text names "Next.js" renderers, but the confirmed per-component stack lists
    `comp_web_app` as react+vite with react-router-dom (confirmed by apps/web/package.json and
    App.tsx) — this plan follows the confirmed stack (react+vite), not Next.js.
  - |
    No Drupal integration or node-fetching code exists anywhere in this repo today (checked
    services/api and apps/web). This plan treats the "published node" as an already-fetched plain
    object passed into `TemplateRouter`; fetching a node by route/slug and filtering by published
    status are not part of this story's description and are left out of scope.
  - |
    The story itself states the exact resolution basis (template field vs content type) is "to be
    confirmed from the live Drupal structure at kickoff." This plan implements a best-guess
    mapping (machine names `home_page`, `landing_page`, `client_work`, `partner`, `services`) and
    a precedence/ambiguity rule (templateField wins when present alone; disagreement between
    templateField and contentType is ambiguous) as a placeholder policy to revise once the live
    structure is confirmed.
  - |
    The five renderer components created here are intentionally empty beyond a `data-testid`
    marker — real content belongs to each template renderer's own story per the AC scope note.
  - |
    AC2 ("not rendered by any of the five renderers") is implemented as `TemplateRouter` returning
    `null`. No specific fallback/404 UI is specified by the ACs, so none is added here.
  - |
    Reviewed the existing UI component catalogue (ActiveGrid, Banner, CoreFieldInput, Layout,
    Toast) — none overlap with template dispatch, so no existing component is reused here.
estimated_points: 3
package_dependencies: []
notes: |
  This work item's domain (Drupal CMS nodes, five marketing-site page templates) has no existing
  code or precedent anywhere in this repo, which is otherwise an HR/employee-profile SPA on
  `comp_web_app` (react-router routes under `apps/web/src/routes`, NestJS API under
  `services/api`). Confirmed via `Grep` for "drupal" (no matches) and a read of `App.tsx`,
  `lib/types.ts`, and the existing route/test conventions. This plan therefore introduces a new,
  self-contained `templates/` area under both `lib/` and `components/` rather than extending any
  existing employee/defect code, and keeps the surface area to exactly what the two ACs require.

  ```mermaid
  flowchart TD
    RTT[resolveTemplateType.ts]
    TR[TemplateRouter.tsx]
    HP[HomePageTemplate.tsx]
    LP[LandingPageTemplate.tsx]
    CW[ClientWorkTemplate.tsx]
    PT[PartnerTemplate.tsx]
    SV[ServicesTemplate.tsx]
    RTT -->|resolves TemplateType, used by router| TR
    TR -->|dispatches when resolved| HP
    TR -->|dispatches when resolved| LP
    TR -->|dispatches when resolved| CW
    TR -->|dispatches when resolved| PT
    TR -->|dispatches when resolved| SV
    classDef touched fill:#f96,color:#000
    class RTT,TR,HP,LP,CW,PT,SV touched
  ```
review_focus: |
  In scope: a pure `resolveTemplateType` function, a `TemplateRouter` dispatch component backed by
  one static global map, and five intentionally-empty placeholder renderers — all new, isolated
  files under `apps/web/src/lib/templates` and `apps/web/src/components/templates`. Explicitly out
  of scope: any Drupal/API node fetching, route wiring in `App.tsx`, and real template content —
  don't flag their absence as incomplete. The riskiest/least-certain part is the
  precedence/ambiguity rule inside `resolveTemplateType` (templateField vs contentType, and what
  counts as "ambiguous") — the story itself says this basis needs confirming against the live
  Drupal structure, so treat it as a reasonable placeholder policy to be revisited, not a final
  business rule to hold the PR to.

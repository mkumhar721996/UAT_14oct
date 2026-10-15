summary: |
  Add a "Shop" page to the existing SPA (`comp_web_app`) with a Register control that is
  always visible in the page's top bar, satisfying the single authored acceptance criterion
  for this story (AC1). The control is reachable via a new sidebar entry and reuses the
  existing `Layout` component's `title`/`actions` pattern exactly as every other page in this
  codebase does, so no new layout primitives or CSS are introduced. Per the approved
  prototype's own intake note, the registration form itself remains out of scope; this plan
  therefore makes the control visible but does not wire it to any registration flow.

scope:
  - description: |
      Add a `Shop` link to the app's persistent sidebar in `Layout` so the new shopping page
      is reachable. Mirrors the existing `NavLink` entries already in this file (e.g. the
      `Defects` link under the "QA Tracker" section).
    files:
      - apps/web/src/components/Layout.tsx
    rationale: |
      `Layout.tsx` is the single source of the app's sidebar (`.sidebar`) per the UI
      guidelines ("persistent left sidebar... stays visible"). AC1's GIVEN clause ("a user is
      on the shopping page") requires the page to exist and be reachable; the current sidebar
      has no entry for it (confirmed by reading `Layout.tsx:35-58` — sections are "HR
      Console", "QA Tracker", "Self-service", none related to shopping).

  - description: |
      Create `ShoppingPage`, a new route component that renders `Layout` with
      `title="Shop"` and an `actions` prop containing the Register control, matching the
      existing convention used by `EmployeeDirectoryPage` (`actions={<Link className="btn
      btn-primary" ...>+ New employee</Link>}`) and `Layout`'s `.topbar-actions` slot, which
      is exactly where the approved prototype places its `#register-btn` (`btn btn-primary`)
      inside `.topbar-actions`, alongside the page's `<strong>` app name.
      The Register control itself is rendered as a plain, un-wired button:
      `<button className="btn btn-primary" type="button">Register</button>`.
    files:
      - apps/web/src/routes/ShoppingPage.tsx
    rationale: |
      This is the minimal code to pass AC1. The prototype's Shopping screen (`.topbar` with
      `#register-btn`) is the only prototype element this AC requires; the prototype's
      product grid, loading/empty/error listing states, and the "Registration — coming soon"
      screen reached by clicking Register are explicitly out of this AC's scope (see
      `assumptions_or_open_questions`) and are not built here.

  - description: |
      Register the new page at `/shop` in the router, following the existing flat
      `<Routes>` list in `App.tsx` (no role gate, matching the un-gated `/defects/new` and
      `/me` routes since AC1 does not restrict visibility by role).
    files:
      - apps/web/src/App.tsx
    rationale: |
      `App.tsx:35-69` is the single place routes are declared; every existing page is wired
      here the same way.

tests:
  - |
    AC1 (control visible on page display), parametrized across every role this app supports,
    since the AC says "a user" with no role qualifier:
    ```tsx
    // apps/web/src/routes/ShoppingPage.test.tsx
    it.each(['hr_admin', 'employee', 'reporter'] as const)(
      'AC1: a control to start registration is visible on the shopping page for %s',
      (role) => {
        signIn(role)
        renderAt(<ShoppingPage />, '/shop', '/shop')
        expect(screen.getByRole('button', { name: /^register$/i })).toBeVisible()
      },
    )
    ```
    This test fails first against the current codebase because neither `ShoppingPage` nor the
    `/shop` route exist yet (`apps/web/src/routes/ShoppingPage.tsx` is not present — confirmed
    via the `apps/web/src/**/*` glob).
  - |
    Supporting test that the page is actually reachable from the sidebar (so AC1's "a user is
    on the shopping page" GIVEN clause is satisfiable in the running app, not just directly
    routable in a test harness):
    ```tsx
    it('AC1: the sidebar links to the shopping page', () => {
      signIn('employee')
      renderAt(<ShoppingPage />, '/shop', '/shop')
      expect(screen.getByRole('link', { name: 'Shop' })).toHaveClass('is-active')
    })
    ```

assumptions_or_open_questions:
  - |
    MAJOR MISMATCH BETWEEN DESIGN AND CODEBASE: the approved prototype
    (`UAT-14OCT-STORY-043-design.html`) depicts an entirely different product — a consumer
    storefront called "Northbridge Goods" with sidebar sections Shop/Categories/Orders/Account,
    a product catalog with cart icon, and per-item "Add to cart" actions. The actual codebase
    (`apps/web`) is an internal HR/Employee-profile and QA-defect console (sidebar sections
    "HR Console", "QA Tracker", "Self-service"; auth roles `hr_admin`/`employee`/`reporter`;
    routes `/employees`, `/defects/new`, `/me`, `/pending-changes`) with no shopping, product,
    or cart concept anywhere in the frontend, backend, or confirmed stack. I did not rebrand
    the app or replace its real sidebar/nav with the prototype's Shop/Categories/Orders/Account
    structure — doing so would break the existing Employee Profile and Defect Creation
    features already merged to `main`. Instead I took only the one prototype element AC1
    actually needs (a `btn btn-primary` "Register" control, always visible in `.topbar-actions`)
    and added it to this app's real `Layout`/routing conventions. Please confirm this is the
    intended interpretation, or clarify whether "the shopping page" is meant to replace/extend
    this app into an actual storefront (which would be a much larger, separate initiative).
  - |
    Per "stay strictly within the ACs", the prototype's product grid and its loading/empty/
    error/success listing states are NOT built — the prototype's own CSS comment labels the
    state-switcher as "(prototype aid, not app UI)", and no acceptance criterion, backend
    endpoint, or stack entry exists for a product catalog domain.
  - |
    Per "stay strictly within the ACs", the Register control is rendered but left un-wired
    (no onClick, no navigation to the prototype's "Registration — coming soon" screen). The
    original intake explicitly struck out the registration-form scenarios as out of scope, and
    AC1 only asserts visibility, not behavior on click. Wiring it to a future registration flow
    is deferred to that (not-yet-authored) story.
  - |
    Assumed the shopping page should be accessible to any signed-in user regardless of role
    (no `RequireHrAdmin`-style gate), since AC1's GIVEN clause says "a user" with no role
    qualifier and no AC restricts visibility.
  - |
    Assumed the new sidebar entry is labeled "Shop" (matching the prototype's active sidebar
    link text "Shop" on its Shopping-page screen) rather than "Shopping", for brevity
    consistent with the existing short sidebar labels ("Defects", "Employees").

estimated_points: 2

package_dependencies: []

notes: |
  No mermaid diagram included: this is a small, additive change (one new route file, one new
  route registration, one new sidebar link) that doesn't cross a layer boundary — `ShoppingPage`
  follows the exact same `Layout`-wrapped, prop-driven pattern already used by every other page
  in `apps/web/src/routes/`.

  Design fidelity: the only prototype element implemented is the Shopping-page screen's
  `.topbar` → `.topbar-actions` → `#register-btn` (`class="btn btn-primary"`), reusing classes
  already defined in `design-system/prototype-utils.css` (confirmed present: `.btn-primary`,
  `.sidebar-link`, `.topbar`). No new CSS is required.

review_focus: |
  Scope is intentionally limited to AC1 (control visibility) — do not flag the absence of a
  product catalog, cart, search, or a working registration form/flow as missing; those are
  explicitly out of scope per the original intake and this plan's assumptions. The riskiest/
  most judgment-laden part of this plan is the decision NOT to adopt the prototype's
  Shop/Categories/Orders/Account sidebar or "Northbridge Goods" branding, since the prototype
  was clearly designed for a different (storefront) product than this app's actual HR/defect
  console — flag this plan for reviewer confirmation rather than treating the sidebar/branding
  mismatch as an implementation bug.

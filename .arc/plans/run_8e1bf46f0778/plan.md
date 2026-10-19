summary: |
  Adds a Customer identity to the existing unified API/SPA: self-service signup and login that
  create and authenticate a distinct `customer` role (alongside the existing `hr_admin`,
  `employee`, `reporter` roles used by the HR/QA console), plus just enough of a minimal booking
  record so a customer's submitted booking is provably tied to their account and survives a
  logout/login round trip. Backend auth already flows through Cognito-issued access tokens
  (`CognitoAuthGuard`/`RolesGuard`/`AuthUser`), so customer signup/login are implemented as new
  calls into Cognito (via a swappable `CustomerIdentityProvider`, mirroring the existing
  `TokenVerifier` DI pattern) rather than a parallel auth system. On the web side this adds the
  four customer-facing screens from the approved design (Sign Up, Log In, My Account, Access
  Denied), served by a new minimal top-header shell distinct from the existing HR Console sidebar,
  and wires a logged-in customer to be denied every existing internal/HR page (which stands in for
  "admin or technician-only" access, since no literal admin/technician role exists in this
  codebase today).

scope:
  - description: |
      Extract the shared `Role`/`ROLES` enum out of the employees domain into `auth` (it is
      already imported by four files under `src/auth/`, not just employees) and add `'customer'`
      to it. `services/api/src/auth/roles.ts` becomes the single source of truth:
      `export const ROLES = ['hr_admin', 'employee', 'reporter', 'customer'] as const` /
      `export type Role = (typeof ROLES)[number]`. `employee-fields.ts` keeps only
      `CORE_FIELDS`/`CoreField`. This is what makes `RolesGuard` deny a `customer` on every route
      that doesn't list `'customer'` in `@Roles(...)` — the mechanism AC4 relies on, with no new
      guard logic needed.
    files:
      - services/api/src/auth/roles.ts
      - services/api/src/employees/employee-fields.ts
      - services/api/src/auth/auth-user.ts
      - services/api/src/auth/roles.decorator.ts
      - services/api/src/auth/roles.guard.ts
      - services/api/src/auth/cognito-auth.guard.ts
    rationale: |
      `AuthUser`, `@Roles`, `RolesGuard` and `CognitoAuthGuard` all import `Role`/`ROLES` from
      `../employees/employee-fields` today, which is a pre-existing coupling, not something this
      story invented; moving it to `auth/roles.ts` is the minimal fix needed to add a role that
      has nothing to do with employees.
  - description: |
      Add a minimal `bookings` table/entity under a new `customers` domain module — just enough to
      prove AC5/AC6 (a submitted booking is recorded against the account and still there after
      logout/login). Service types are hardcoded to the four values the approved design's fixture
      uses (`Faucet repair`, `Drain cleaning`, `Water heater install`, `AC tune-up`); a real
      service catalog is the separate "Service Catalog" slice of the parent epic.
    files:
      - services/api/src/customers/entities/booking.entity.ts
      - services/api/src/customers/service-types.ts
      - services/api/src/database/migrations/1700000000003-create-bookings-schema.ts
      - services/api/src/database/data-source.ts
    rationale: |
      Follows the existing `Defect`/`Employee` entity + migration + `dataSourceOptions()`
      registration pattern exactly (tenant-scoped uuid PK, `pgcrypto` default, a composite index
      for the lookup this story needs: `(tenant_id, customer_sub)`).
  - description: |
      Add a `CustomerIdentityProvider` interface (`signUp`, `login`) with a Cognito-backed
      implementation, following the same DI-swap shape as `TOKEN_VERIFIER`/`CognitoTokenVerifier`
      so e2e tests can fake it instead of hitting AWS:
      ```ts
      export const CUSTOMER_IDENTITY_PROVIDER = Symbol('CUSTOMER_IDENTITY_PROVIDER');
      export class EmailAlreadyRegisteredError extends Error {}
      export interface CustomerIdentityProvider {
        signUp(email: string, password: string): Promise<void>;
        login(email: string, password: string): Promise<{ accessToken: string } | null>;
      }
      ```
      `CognitoCustomerIdentityProvider.signUp` calls `AdminCreateUserCommand` (email verified,
      `custom:role=customer`, `custom:tenant_id=<CUSTOMER_TENANT_ID>`, `MessageAction: SUPPRESS`)
      then `AdminSetUserPasswordCommand` (`Permanent: true`) — no email-verification step, matching
      the design's immediate "Account created" success state. `.login` calls
      `AdminInitiateAuthCommand` (`ADMIN_USER_PASSWORD_AUTH`) and returns `null` on
      `NotAuthorizedException`/`UserNotFoundException` so the controller can answer both with the
      same generic 401 (AC3; the design explicitly never reveals which part was wrong).
    files:
      - services/api/src/customers/customer-identity.provider.ts
      - services/api/package.json
    rationale: |
      Reuses the existing `token-verifier.ts` pattern (interface + injectable token + lazily-built
      AWS client) instead of inventing a second auth mechanism, and keeps Cognito calls behind an
      interface the same way the rest of the auth module already does.
  - description: |
      Add the customer-facing API surface: `POST /customers/signup`, `POST /customers/login`
      (both unguarded, like any other public auth endpoint — no `@UseGuards` at class level), and
      `GET`/`POST /customers/me/bookings` (guarded, `@Roles('customer')`, resolving the owner from
      `@CurrentUser()` the same way `employees/me/*` resolves from the token, never from client
      input).
      ```ts
      @Controller('customers')
      export class CustomersController {
        @Post('signup') signUp(@Body() dto: SignUpDto) { return this.customers.signUp(dto); }
        @Post('login') logIn(@Body() dto: LogInDto) { return this.customers.logIn(dto); }

        @Get('me/bookings') @UseGuards(CognitoAuthGuard, RolesGuard) @Roles('customer')
        myBookings(@CurrentUser() user: AuthUser) { return this.customers.listBookings(user.tenantId, user.sub); }

        @Post('me/bookings') @UseGuards(CognitoAuthGuard, RolesGuard) @Roles('customer')
        submitBooking(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
          return this.customers.createBooking(user.tenantId, user.sub, dto);
        }
      }
      ```
    files:
      - services/api/src/customers/dto/sign-up.dto.ts
      - services/api/src/customers/dto/log-in.dto.ts
      - services/api/src/customers/dto/create-booking.dto.ts
      - services/api/src/customers/customers.service.ts
      - services/api/src/customers/customers.controller.ts
      - services/api/src/customers/customers.module.ts
      - services/api/src/app.module.ts
    rationale: |
      Mirrors `EmployeesController`/`DefectsController` conventions (DTO validation messages,
      `@CurrentUser()`/`@Roles()` usage, service layer doing the tenant-scoped persistence).
  - description: |
      Extend the e2e test harness with a `FakeCustomerIdentityProvider` (an in-memory
      email->password/sub map) overriding `CUSTOMER_IDENTITY_PROVIDER`, exactly like
      `create-test-app.ts` already overrides `TOKEN_VERIFIER` and `DataSource`. Its `login`
      returns `tokenFor({ sub, role: 'customer', employee_id: null })` so the token round-trips
      through the already-faked token verifier.
    files:
      - services/api/test/support/fake-customer-identity-provider.ts
      - services/api/test/support/create-test-app.ts
    rationale: |
      Keeps customer e2e tests fully offline (no real Cognito/Postgres), consistent with how
      `employees.e2e-spec.ts`/`defects.e2e-spec.ts` already run.
  - description: Backend unit + e2e tests for AC1-AC6 (see `tests` below for the concrete cases).
    files:
      - services/api/test/customers.e2e-spec.ts
      - services/api/src/customers/customers.service.spec.ts
    rationale: Test-first coverage of every acceptance criterion at the API layer.
  - description: |
      Extend the web session model to recognise `'customer'` and add token read/write helpers so
      pages don't poke `localStorage` directly:
      `export type Role = 'hr_admin' | 'employee' | 'reporter' | 'customer'`,
      `readSession()`'s role allow-list gains `'customer'`, and new
      `storeToken(token: string): void` / `clearToken(): void` exports. The shared test helper
      `signIn(role, employeeId?)` widens its `role` union the same way so new page tests can
      simulate a signed-in customer.
    files:
      - apps/web/src/lib/auth.ts
      - apps/web/src/test/helpers.tsx
      - apps/web/src/lib/types.ts
    rationale: |
      `apiClient`/`useAuth` already decode whatever is in `localStorage['arc.accessToken']`
      without re-verifying it (the API does that) — this only widens the role union and adds the
      write side that was previously only done ad hoc in tests.
  - description: |
      Add a `Booking` web type and a small `mockApi` test-helper extension,
      `errorResponse(status, message)`, so page tests can simulate a non-2xx response (needed for
      AC3's 401 and the signup email-taken 409) — today `mockApi` always answers 200.
      ```ts
      export function errorResponse(status: number, message: string) {
        return { __mockStatus: status, message }
      }
      // in mockApi's handler: the body produced by the route handler controls the status code
      // this way, so existing 200-only handlers are unaffected.
      ```
    files:
      - apps/web/src/lib/types.ts
      - apps/web/src/test/helpers.tsx
    rationale: |
      Minimal, additive change to shared test infra — existing handlers that return a plain object
      keep returning 200; only a handler that returns `errorResponse(...)` changes the status.
  - description: |
      Add a shared minimal top-header shell for the customer-facing surface
      (brand "HomeServe" + either "Log in"/"Sign up" links or "Signed in as … " + "Log out"),
      taken from the design's `.site-header`/`.brand`/`.header-auth` markup, which is explicitly
      *not* the existing `Layout.tsx` sidebar shell ("distinct from the operator console's sidebar
      shell ... nav here is a minimal top header only"). Also ports the design's second `<style>`
      block (`.site-header`, `.auth-page`, `.auth-card`, `.form-alert`, `.field-error`,
      `.password-field`/`.password-toggle`, `.auth-switch`, `.success-card`/`.success-icon`,
      `.account-page`, `.bookings-empty`, `.quick-booking-row`, `.admin-preview-card`,
      `.denied-page`/`.denied-card`/`.denied-icon`) plus the prototype kit's `svg.icon` rule, into
      `index.css`, composed only from the existing design-system tokens already imported there —
      same approach as the rest of `index.css`'s "page-level additions from the approved
      prototype" comment.
    files:
      - apps/web/src/components/CustomerHeader.tsx
      - apps/web/src/index.css
    rationale: |
      No existing cataloged component (`ActiveGrid`, `Banner`, `CoreFieldInput`, `Layout`,
      `Toast`) fits a brand+auth-state-only header; `Banner` was considered for the `.form-alert`
      error box but the design calls that out explicitly as new, differently-shaped feature CSS
      (single-line + icon, no title), not a `Banner` reuse. `Toast` *is* reused as-is for the
      success toasts the design shows ("Account created", "Logged in", "Booking requested",
      "Logged out").
  - description: |
      Sign Up screen (design screen 1, `data-ac="1"`): card with email/password/confirm fields,
      client-side validation (email format, password ≥ 8 chars via the design's hint text "At
      least 8 characters", confirm-match) before calling `POST /customers/signup`; a 409 shows the
      design's `.form-alert` copy "An account with {email} already exists. Log in instead."; on
      success shows the design's second card state (`success-icon` check + "Account created" +
      "Continue to log in" button) instead of the form.
    files:
      - apps/web/src/routes/SignUpPage.tsx
      - apps/web/src/routes/SignUpPage.test.tsx
    rationale: Implements AC1 and the design's documented validation/success states for it.
  - description: |
      Log In screen (design screen 2, `data-ac="2 3"`): email/password fields, `POST
      /customers/login`; a 401 shows the design's exact generic copy "That email and password
      don't match. Check your details and try again." (never which part was wrong, per the
      design's note); success stores the token via `storeToken()` and navigates to `/account`.
    files:
      - apps/web/src/routes/LogInPage.tsx
      - apps/web/src/routes/LogInPage.test.tsx
    rationale: Implements AC2 and AC3 on the web side.
  - description: |
      My Account screen (design screen 3, `data-ac="5 6"`): "Signed in as {email}" card; bookings
      `.table` (`Service`/`Submitted`/`Status` columns, chip colour by status) or the
      `.bookings-empty` state, loaded from `GET /customers/me/bookings`; the design's intentionally
      small "Request a service" quick-booking form (service-type `.select` + submit) posting to
      `POST /customers/me/bookings` — explicitly a stand-in for the full booking flow, which the
      design notes is "STORY-057's"; an "Admin dashboard ... Try an admin page" card linking to an
      existing internal route (`/employees`); and a "Log out" button that clears the token and
      navigates to `/login` (purely client-side — no server call, matching the design).
    files:
      - apps/web/src/routes/AccountPage.tsx
      - apps/web/src/routes/AccountPage.test.tsx
    rationale: Implements AC5 and AC6 on the web side.
  - description: |
      Access Denied screen (design screen 4, `data-ac="4"`: alert icon, "Access denied", "This
      page is for admin and technician accounts only. Your customer account doesn't have access to
      it.", "Back to my account") and the `App.tsx` routing change that makes it real rather than a
      static demo screen: a signed-in `customer` is routed to `/account` and sees this page for
      every other existing path (`/employees`, `/employees/new`, `/defects/new`, `/me`,
      `/pending-changes`, any unknown path) — i.e. the entire existing internal HR/QA console
      stands in for "admin or technician-only" here, since this codebase has no literal `admin` or
      `technician` role (see assumptions). `hr_admin`/`employee`/`reporter` behaviour is unchanged.
      Before → after shape of the relevant check in `App()`:
      ```tsx
      // before: if (!auth) { ...sign-in-required... } return <Routes>{...hr console routes...}</Routes>
      // after:
      if (auth?.role === 'customer') {
        return <Routes>
          <Route path="/account" element={<AccountPage />} />
          <Route path="*" element={<CustomerAccessDeniedPage />} />
        </Routes>
      }
      ```
      `/signup` and `/login` are added as routes reachable without a session.
    files:
      - apps/web/src/routes/CustomerAccessDeniedPage.tsx
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
    rationale: Implements AC4 on the web side using the existing RBAC surface, not a new one.

tests:
  - |
    AC1 (signup creates the account, and it can then log in) — `services/api/test/customers.e2e-spec.ts`:
    ```ts
    it('AC1: signup creates a customer account that can then log in', async () => {
      await http().post('/customers/signup').send({ email: 'dana@example.com', password: 'password123' }).expect(201);
      const res = await http().post('/customers/login').send({ email: 'dana@example.com', password: 'password123' });
      expect(res.status).toBe(200);
      expect(typeof res.body.accessToken).toBe('string');
    });
    it('AC1: signing up twice with the same email is rejected', async () => {
      await http().post('/customers/signup').send({ email: 'dup@example.com', password: 'password123' }).expect(201);
      const res = await http().post('/customers/signup').send({ email: 'dup@example.com', password: 'password123' });
      expect(res.status).toBe(409);
    });
    ```
    Web `SignUpPage.test.tsx`:
    ```tsx
    it('AC1: submits email+password and shows the success state', async () => {
      const api = mockApi({ 'POST /customers/signup': {} })
      render()
      fill('dana@example.com', 'password123', 'password123')
      submit()
      expect(await screen.findByText('Account created')).toBeInTheDocument()
      expect(JSON.parse(api.mock.calls[0][1]!.body as string)).toEqual({ email: 'dana@example.com', password: 'password123' })
    })
    ```
  - |
    AC2 (correct credentials log the customer in) — `services/api/test/customers.e2e-spec.ts`:
    ```ts
    it('AC2: logging in with correct credentials grants access to the customer account', async () => {
      await http().post('/customers/signup').send({ email: 'ac2@example.com', password: 'password123' });
      const { body } = await http().post('/customers/login').send({ email: 'ac2@example.com', password: 'password123' }).expect(200);
      const res = await http().get('/customers/me/bookings').set('Authorization', `Bearer ${body.accessToken}`);
      expect(res.status).toBe(200);
    });
    ```
    Web `LogInPage.test.tsx`:
    ```tsx
    it('AC2: a successful login stores the token and navigates to My account', async () => {
      mockApi({ 'POST /customers/login': { accessToken: 'tok-1' } })
      render()
      fill('dana@example.com', 'password123')
      submit()
      await waitFor(() => expect(localStorage.getItem(TOKEN_KEY)).toBe('tok-1'))
    })
    ```
  - |
    AC3 (wrong password is refused, generic message, not logged in) — `customers.e2e-spec.ts`:
    ```ts
    it("AC3: a wrong password is refused with a generic message", async () => {
      await http().post('/customers/signup').send({ email: 'ac3@example.com', password: 'password123' });
      const res = await http().post('/customers/login').send({ email: 'ac3@example.com', password: 'wrongpass' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("That email and password don't match. Check your details and try again.");
    });
    ```
    Web `LogInPage.test.tsx`:
    ```tsx
    it("AC3: wrong credentials show the generic error and store no token", async () => {
      mockApi({ 'POST /customers/login': errorResponse(401, "That email and password don't match. Check your details and try again.") })
      render()
      fill('dana@example.com', 'wrongpass')
      submit()
      expect(await screen.findByText(/that email and password don't match/i)).toBeInTheDocument()
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    })
    ```
  - |
    AC4 (a logged-in customer is denied an admin/technician-only page) — `customers.e2e-spec.ts`:
    ```ts
    it('AC4: a logged-in customer is denied an hr_admin-only route', async () => {
      await http().post('/customers/signup').send({ email: 'ac4@example.com', password: 'password123' });
      const { body } = await http().post('/customers/login').send({ email: 'ac4@example.com', password: 'password123' });
      const res = await http().post('/employees').set('Authorization', `Bearer ${body.accessToken}`).send({ fullName: 'x', startDate: '2026-01-01' });
      expect(res.status).toBe(403);
    });
    ```
    Web `App.test.tsx`:
    ```tsx
    it('AC4: a logged-in customer sees Access denied on an internal page', () => {
      signIn('customer')
      renderApp('/employees')
      expect(screen.getByText('Access denied')).toBeInTheDocument()
    })
    ```
  - |
    AC5 (a submitted booking is recorded against the account) — `customers.e2e-spec.ts`:
    ```ts
    it('AC5: a submitted booking is recorded against the logged-in customer', async () => {
      await http().post('/customers/signup').send({ email: 'ac5@example.com', password: 'password123' });
      const { body } = await http().post('/customers/login').send({ email: 'ac5@example.com', password: 'password123' });
      const auth = `Bearer ${body.accessToken}`;
      await http().post('/customers/me/bookings').set('Authorization', auth).send({ serviceType: 'Faucet repair' }).expect(201);
      const res = await http().get('/customers/me/bookings').set('Authorization', auth);
      expect(res.body).toMatchObject([{ serviceType: 'Faucet repair', status: 'Requested' }]);
    });
    ```
    Web `AccountPage.test.tsx`:
    ```tsx
    it('AC5: submitting a booking records it against the signed-in account', async () => {
      signIn('customer')
      const api = mockApi({ 'GET /customers/me/bookings': [], 'POST /customers/me/bookings': { id: 'bk-1', serviceType: 'Faucet repair', status: 'Requested', submittedAt: '2026-10-19' } })
      renderAt(<AccountPage />, '/account', '/account')
      fireEvent.change(await screen.findByLabelText(/service type/i), { target: { value: 'Faucet repair' } })
      fireEvent.click(screen.getByRole('button', { name: /request service/i }))
      expect(await screen.findByText('Faucet repair')).toBeInTheDocument()
    })
    ```
  - |
    AC6 (a booking made before logout is still listed after logging back in) — `customers.e2e-spec.ts`:
    ```ts
    it('AC6: a booking made before logging out is still listed after logging back in', async () => {
      await http().post('/customers/signup').send({ email: 'ac6@example.com', password: 'password123' });
      const first = await http().post('/customers/login').send({ email: 'ac6@example.com', password: 'password123' });
      await http().post('/customers/me/bookings').set('Authorization', `Bearer ${first.body.accessToken}`).send({ serviceType: 'Drain cleaning' }).expect(201);
      const second = await http().post('/customers/login').send({ email: 'ac6@example.com', password: 'password123' });
      const res = await http().get('/customers/me/bookings').set('Authorization', `Bearer ${second.body.accessToken}`);
      expect(res.body.map((b: any) => b.serviceType)).toContain('Drain cleaning');
    });
    ```
    Web `AccountPage.test.tsx`:
    ```tsx
    it('AC6: a booking already on the account is listed on load (post logout/login)', async () => {
      signIn('customer')
      mockApi({ 'GET /customers/me/bookings': [{ id: 'bk-0', serviceType: 'Drain cleaning', status: 'Requested', submittedAt: '2026-10-12' }] })
      renderAt(<AccountPage />, '/account', '/account')
      expect(await screen.findByText('Drain cleaning')).toBeInTheDocument()
    })
    ```

assumptions_or_open_questions:
  - |
    This codebase has no literal `admin` or `technician` role today (only `hr_admin`, `employee`,
    `reporter`, used by an internal HR/QA console that is a different bounded context from the
    "HomeServe" customer booking surface the design shows). The story's own scope note calls
    admin/technician auth "existing/separate", but it does not actually exist under those names.
    This plan treats AC4 as satisfied by denying a `customer` every existing internal page/route
    (the whole HR/QA console), via the existing generic `RolesGuard` deny-by-default behaviour —
    no new `admin`/`technician` role or page is invented. Please confirm this is the intended
    reading, or point to where a literal `technician` role should come from.
  - |
    Customers need a `tenantId` claim (required by `CognitoAuthGuard`), but there is no
    company/tenant selection step in the design and no `tenants` table in the schema — `tenant_id`
    is just a plain column used for isolation. This plan assumes a single fixed tenant for all
    self-service customers, set via a new `CUSTOMER_TENANT_ID` env var and written to
    `custom:tenant_id` at signup. If customers are meant to be scoped per-business/tenant, that
    needs a selection step this story doesn't have a design for.
  - |
    Assumes the Cognito User Pool already projects `custom:role`/`custom:tenant_id`/`custom:employee_id`
    into the **access** token's claims (e.g. via a Pre Token Generation Lambda) — this is a
    precondition `token-verifier.ts`/`cognito-auth.guard.ts` already rely on for the existing
    employee/HR login, and this plan does not touch that infra, only the application code that
    calls Cognito's Admin APIs. Also assumes the app client has `ALLOW_ADMIN_USER_PASSWORD_AUTH`
    enabled so `AdminInitiateAuthCommand` works.
  - |
    No email verification step: signup uses `AdminCreateUser` + `AdminSetUserPassword(Permanent:
    true)` with `email_verified: true`, matching the design's immediate "Account created" success
    state (no OTP/verification screen is shown anywhere in the prototype). `comp_email_delivery`
    (SES) is not used by this story.
  - |
    Service types are hardcoded to the four values in the design's fixture (Faucet repair, Drain
    cleaning, Water heater install, AC tune-up). Managing a real service catalog is a separate
    slice of the "Customer Booking & Service Catalog" epic.
  - |
    "Log out" is purely client-side (clears the stored token) with no server-side revocation
    endpoint, matching the design (the Log out button makes no API call) and Cognito's stateless
    access tokens.
  - |
    Booking status is fixed at `'Requested'` on creation; status transitions (the full booking
    lifecycle) belong to a separate story. The web table still maps status to a chip colour the
    same way the design does, for forward compatibility.
  - |
    Emails are normalised (trimmed + lower-cased) before being used as the Cognito username/lookup
    key, so "Dana@Example.com" and "dana@example.com" are treated as the same account.

estimated_points: 8

package_dependencies:
  - name: "@aws-sdk/client-cognito-identity-provider"
    version: "^3.700.0"
    ecosystem: npm
    component_id: comp_api_service
    rationale: |
      Customer signup/login call Cognito's Admin APIs directly (AdminCreateUser,
      AdminSetUserPassword, AdminInitiateAuth) to create accounts and authenticate credentials.
      The existing `aws-jwt-verify` dependency only verifies tokens already issued — it has no
      client for creating users or initiating auth.

notes: |
  Architecture fit: `comp_api_service` is already described as the unified API's "auth/RBAC"
  surface, and `comp_web_app` is already "SPA client for all user types, RBAC-driven views" — so
  this plan adds a new role and a new domain module into the existing single API/SPA rather than
  standing up anything separate.

  ```mermaid
  flowchart TD
    classDef touched fill:#f96,color:#000
    classDef existing fill:#e2e8f0,color:#1e293b

    Roles["auth/roles.ts (new)"]:::touched
    AuthUser["auth/auth-user.ts"]:::touched
    RolesDec["auth/roles.decorator.ts"]:::touched
    RolesGuard["auth/roles.guard.ts"]:::touched
    CognitoGuard["auth/cognito-auth.guard.ts"]:::touched
    EmpFields["employees/employee-fields.ts"]:::touched
    IdentityProvider["customers/customer-identity.provider.ts (new)"]:::touched
    CustCtrl["customers/customers.controller.ts (new)"]:::touched
    CustSvc["customers/customers.service.ts (new)"]:::touched
    Booking["customers/entities/booking.entity.ts (new)"]:::touched
    EmpCtrl["employees/employees.controller.ts"]:::existing

    Roles --> AuthUser
    Roles --> RolesDec
    Roles --> RolesGuard
    Roles --> CognitoGuard
    EmpFields -. "no longer owns Role/ROLES" .-> Roles
    CustCtrl -- "@UseGuards on /me/bookings only" --> CognitoGuard
    CognitoGuard --> RolesGuard
    CustCtrl --> CustSvc
    CustSvc -- "signUp/login" --> IdentityProvider
    CustSvc -- "create/list" --> Booking
    EmpCtrl -- "unaffected: still @Roles('hr_admin')" --> RolesGuard

    App["web/App.tsx"]:::touched
    SignUp["routes/SignUpPage.tsx (new)"]:::touched
    LogIn["routes/LogInPage.tsx (new)"]:::touched
    Account["routes/AccountPage.tsx (new)"]:::touched
    Denied["routes/CustomerAccessDeniedPage.tsx (new)"]:::touched
    Header["components/CustomerHeader.tsx (new)"]:::touched
    Auth["lib/auth.ts"]:::touched
    ApiClient["lib/apiClient.ts"]:::existing

    App -- "role === customer -> /account, else AccessDenied" --> Denied
    App --> Account
    App --> SignUp
    App --> LogIn
    SignUp --> Header
    LogIn --> Header
    Account --> Header
    Denied --> Header
    SignUp --> ApiClient
    LogIn -- "storeToken() on success" --> Auth
    Account --> ApiClient
    App -- "useAuth()" --> Auth
  ```

review_focus: |
  In scope: the `customer` role, Cognito-backed signup/login, a minimal `bookings` record tied to
  the account, and the four design screens with a logged-in customer denied every existing
  internal page. Out of scope (do not flag as missing): a real `admin`/`technician` role or page
  (none exists in this codebase — AC4 is satisfied via the existing HR/QA console's
  deny-by-default RBAC, see assumptions), the full booking workflow/status lifecycle and service
  catalog (separate epic slices), email verification, and server-side logout/token revocation.
  Riskiest area: the Cognito integration (`CognitoCustomerIdentityProvider`) and the
  `CUSTOMER_TENANT_ID` assumption — both depend on identity-provider/infra configuration this plan
  doesn't control, so review the `CustomerIdentityProvider` interface boundary carefully rather
  than assuming the Cognito calls are exercised by the (deliberately offline) e2e tests. Also check
  that extracting `Role`/`ROLES` out of `employee-fields.ts` didn't change any existing
  `hr_admin`/`employee`/`reporter` behaviour — it should be a pure move, not a logic change.

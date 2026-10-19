summary: |
  Adds the defect status state machine and its role-gated transitions on top of the existing
  `defects` module (STORY-033/034 gave it `New`→`Triaged` creation/edit only). A new
  `POST /defects/:id/transitions` endpoint drives a defect through
  `New → Triaged → Assigned → In Progress → Resolved → Verified → (Reopened) → Closed`, with each
  action (`triage`, `assign`, `start`, `resolve`, `verify`, `reopen`) gated server-side to the
  right role or identity (QA/Verifier, Admin, or the specific assigned Developer), independent of
  any UI. Two new roles (`developer`, `qa_verifier`) are added to the shared `Role` enum used by
  both the API and the web app, since neither exists in the codebase today. The web app's existing
  `DefectDetailPage` (STORY-034) gets a "Workflow actions" card plus four small action modals
  (Triage/Assign/Resolve/Reopen) so every valid action for the current status is visible to every
  role — an unauthorized attempt is refused by the API and shown as a banner, not hidden by
  disabling the button — matching the approved design's core device. Resolution notes and reopen
  reasons are persisted (new nullable columns) since the story explicitly covers them.

scope:
  - description: |
      Add two new role values the defect workflow needs — `developer` and `qa_verifier` — to the
      single shared `Role` enum. Neither exists today (the enum only has `hr_admin`, `employee`,
      `reporter`, `customer`, `admin`, confirmed by reading `roles.ts` and the web app's own copy
      of it in `auth.ts`).
    files:
      - services/api/src/auth/roles.ts
      - apps/web/src/lib/auth.ts
    rationale: |
      `RolesGuard`/`CognitoAuthGuard` and the web app's `readSession()` both reject any role value
      outside this list, so a QA/Verifier or Developer couldn't even sign in without this change.
      `roles.ts`: `export const ROLES = ['hr_admin', 'employee', 'reporter', 'customer', 'admin', 'developer', 'qa_verifier'] as const;`.
      `auth.ts` mirrors the same list and the `Role` union type (it's a separate, hand-kept copy,
      not an import — confirmed no shared package between `services/api` and `apps/web`).

  - description: |
      New `DEFECT_PRIORITIES` constant (`['P1', 'P2', 'P3', 'P4']`), mirroring the existing
      `defect-severities.ts` pattern, used by the triage transition's validation. Values come
      directly from the approved design's Triage modal `<select>` (`P1 — Critical` … `P4 — Low`).
    files:
      - services/api/src/defects/defect-priorities.ts
    rationale: |
      No priority enum exists anywhere in the codebase yet (today `priority` is an untyped
      nullable `text` column with no writer). `IsIn(DEFECT_PRIORITIES)` on the transition DTO is
      what AC1/AC14 rely on to reject an empty/invalid priority.

  - description: |
      New nullable `resolution_note` and `reopen_reason` text columns on `defects`, plus the
      matching `Defect` entity fields. The scope description explicitly names "resolution notes"
      and "reopening" as covered by this story, and the design's status-summary card displays
      both when present, so they need to be persisted, not just validated-and-discarded.
    files:
      - services/api/src/database/migrations/1700000000006-add-defect-workflow-notes.ts
      - services/api/src/database/data-source.ts
      - services/api/src/defects/entities/defect.entity.ts
    rationale: |
      Migration body: `ALTER TABLE defects ADD COLUMN resolution_note text, ADD COLUMN reopen_reason text;`
      (down: drop both), registered in `data-source.ts`'s `migrations` array after
      `AddDefectPriorityAssignee1700000000004` as `1700000000006`, following the existing
      numbering/registration pattern exactly (`1700000000005-create-page-reviews-schema` is the
      latest today). Entity gets
      `@Column({ name: 'resolution_note', type: 'text', nullable: true }) resolutionNote!: string | null;`
      and the equivalent `reopenReason`/`reopen_reason` pair.

  - description: |
      New `TransitionDefectDto` validating the one body shape `POST /defects/:id/transitions`
      accepts: `{ action: 'triage'|'assign'|'start'|'resolve'|'verify'|'reopen', priority?, assigneeId?, resolutionNote?, reopenReason? }`,
      with each extra field required only for the action that needs it (`ValidateIf`).
    files:
      - services/api/src/defects/dto/transition-defect.dto.ts
    rationale: |
      Required-field messages are taken verbatim from the approved design's own inline validation
      copy so API and UI never disagree: priority — `"Priority can't be empty."`; resolution note —
      `"Resolution note can't be empty."` (AC6 requires the refusal message to name "the resolution
      note" — this string does); reopen reason — `"Reopen reason can't be empty."` (AC10, same
      reasoning). `assigneeId` (a free-text identifier, see assumptions) is only required
      non-empty, message `"Choose an assignee."` (not asserted by any AC). Class-validator shape:
      ```ts
      export const TRANSITION_ACTIONS = ['triage', 'assign', 'start', 'resolve', 'verify', 'reopen'] as const;
      export type TransitionAction = (typeof TRANSITION_ACTIONS)[number];

      export class TransitionDefectDto {
        @IsIn(TRANSITION_ACTIONS, { message: 'Choose a valid workflow action.' })
        action!: TransitionAction;

        @ValidateIf((o) => o.action === 'triage')
        @IsIn(DEFECT_PRIORITIES, { message: "Priority can't be empty." })
        priority?: DefectPriority;

        @ValidateIf((o) => o.action === 'assign')
        @IsString({ message: 'Choose an assignee.' })
        @IsNotEmpty({ message: 'Choose an assignee.' })
        assigneeId?: string;

        @ValidateIf((o) => o.action === 'resolve')
        @IsString({ message: "Resolution note can't be empty." })
        @IsNotEmpty({ message: "Resolution note can't be empty." })
        @Matches(/\S/, { message: "Resolution note can't be empty." })
        resolutionNote?: string;

        @ValidateIf((o) => o.action === 'reopen')
        @IsString({ message: "Reopen reason can't be empty." })
        @IsNotEmpty({ message: "Reopen reason can't be empty." })
        @Matches(/\S/, { message: "Reopen reason can't be empty." })
        reopenReason?: string;
      }
      ```

  - description: |
      New `DefectsService.transitionDefect()` implementing the full state machine: which `from`
      status(es) each action accepts, which `to` status it produces, and who is authorized.
    files:
      - services/api/src/defects/defects.service.ts
    rationale: |
      Signature: `async transitionDefect(tenantId: string, id: string, user: AuthUser, dto: TransitionDefectDto): Promise<Defect>`.
      Rules (role names are this story's new `developer`/`qa_verifier` plus the existing `admin`;
      identity checks compare `user.sub` against `defect.assigneeName`, see assumptions):
      | action | from | to | authorized | refusal message |
      |---|---|---|---|---|
      | triage | New | Triaged | qa_verifier, admin | "Triaging a defect is limited to QA/Verifier or Admin." |
      | assign | Triaged, Reopened | Assigned | admin | "Assigning a defect is limited to Admin." |
      | assign | Assigned | Assigned (new assigneeName) | admin | "Reassigning a defect is limited to Admin." |
      | start | Assigned | In Progress | user.sub === assigneeName | "Starting work is limited to the assigned Developer." |
      | resolve | In Progress | Resolved | user.sub === assigneeName | "Marking this resolved is limited to the assigned Developer." |
      | verify | Resolved | Verified | qa_verifier | "Verifying a defect is limited to QA/Verifier." |
      | reopen | Verified | Reopened | qa_verifier, admin | "Reopening a defect is limited to QA/Verifier or Admin." |
      | reopen | Resolved, Closed | Reopened | qa_verifier | "Reopening a defect is limited to QA/Verifier." |
      A `from` status outside the action's accepted set throws `ConflictException` (e.g.
      `"Can't triage a defect that's Triaged."`) — not asserted by a specific AC, but required to
      implement "the state machine" the scope names explicitly. Wrong role/identity throws
      `ForbiddenException` with the message above (AC2, AC8, AC15, and the implicit
      Resolved/Closed-reopen-by-Admin case). `triage` sets `priority`; `assign` sets
      `assigneeName = dto.assigneeId`; `resolve` sets `resolutionNote`; `reopen` sets
      `reopenReason`; every branch sets `status` and saves via the same `repo.save(defect)` pattern
      `updateDefect` already uses.

  - description: |
      New `POST /defects/:id/transitions` route on the existing controller, guarded the same way
      as the other two routes (no static `@Roles()` — the required role depends on the defect's
      current status and the action, so it's resolved inside the service).
    files:
      - services/api/src/defects/defects.controller.ts
    rationale: |
      ```ts
      @Post(':id/transitions')
      transition(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionDefectDto) {
        return this.defects.transitionDefect(user.tenantId, id, user, dto);
      }
      ```
      `CognitoAuthGuard` still requires a valid bearer token (AC15's "direct to the transition API"
      call still needs to authenticate as *someone* — it's the role check that must fail, not
      authentication).

  - description: |
      Unit tests for `transitionDefect()` covering the role/identity/state-machine side of every
      AC except the two validation-error ACs (6, 10) and the direct-API AC (15), which are
      e2e-only (see below) since they depend on the real HTTP + `ValidationPipe` boundary.
    files:
      - services/api/src/defects/defects.service.spec.ts
    rationale: |
      Extends the existing `seed(status, extra?)` helper (already seeds a defect at a given status
      via `ds.getRepository(Defect).save(...)`) to also accept `assigneeName`/`resolutionNote`
      seed values where a test needs them.

  - description: |
      E2E tests for the transition endpoint, covering the two validation-error ACs, the
      direct-API authorization AC, and one end-to-end happy path proving the whole guard/pipe/
      controller/service stack is wired.
    files:
      - services/api/test/defects.e2e-spec.ts
    rationale: |
      Mirrors the existing `describe('detail and edit', ...)` block's `seed`/`get` helpers.

  - description: |
      `StatusChip` gets real per-status color coding instead of always rendering `.chip-neutral`.
      The design's own comment calls this out explicitly: "the status chip now carries real
      semantic color (034 left it neutral on purpose, out of its scope)".
    files:
      - apps/web/src/components/DefectTags.tsx
    rationale: |
      Mapping taken verbatim from the design's `STATUS_META`: New/Closed → `chip-neutral`,
      Triaged/Assigned/In Progress → `chip-warning`, Resolved/Verified → `chip-success`,
      Reopened → `chip-danger`. `.chip-warning`/`.chip-success`/`.chip-danger`/`.chip-neutral` all
      already exist in `index.css` (confirmed by reading it) — no new CSS.
      ```ts
      const STATUS_CHIP_CLASS: Record<string, string> = {
        New: 'chip-neutral', Triaged: 'chip-warning', Assigned: 'chip-warning', 'In Progress': 'chip-warning',
        Resolved: 'chip-success', Verified: 'chip-success', Closed: 'chip-neutral', Reopened: 'chip-danger',
      };
      export function StatusChip({ status }: { status: string }) {
        return <span className={`chip ${STATUS_CHIP_CLASS[status] ?? 'chip-neutral'}`}>{status}</span>;
      }
      ```

  - description: |
      Extend the `Defect` type with the two new fields the API now returns.
    files:
      - apps/web/src/lib/types.ts
    rationale: |
      `resolutionNote: string | null` and `reopenReason: string | null` added alongside the
      existing `priority`/`assigneeName` fields.

  - description: |
      Extend `DefectDetailPage` with: (a) two more readonly rows ("Resolution note", "Reopen
      reason"), shown only when set, matching the design's status-summary card; (b) a "Workflow
      actions" card below the existing record card showing the one or two actions valid for the
      current status, always visible regardless of the signed-in role (so an unauthorized attempt
      is visible, per AC2/AC8/AC15 and the design's stated principle), with a banner area for a
      refused/validation-error attempt; (c) four small modals (Triage, Assign/Reassign, Resolve,
      Reopen), styled with the existing `.modal`/`.modal-backdrop`/`.field`/`.textarea`/`.select`
      classes already in `index.css` and already used inline (no shared component) by
      `PendingChangesPage.tsx` — this plan follows that same established convention rather than
      introducing a new `Modal` component (none of the catalogued components fit a modal).
    files:
      - apps/web/src/routes/DefectDetailPage.tsx
    rationale: |
      Buttons/labels per status, taken verbatim from the design's `renderActions()`:
      New → "Triage" (`.btn-primary`); Triaged/Reopened → "Assign" (`.btn-primary`); Assigned →
      "Reassign" (`.btn-secondary`) + "Start progress" (`.btn-primary`); In Progress → "Mark
      resolved" (`.btn-primary`); Resolved → "Verify" (`.btn-primary`) + "Reopen"
      (`.btn-secondary`); Verified/Closed → "Reopen" (`.btn-secondary`) — exactly one
      `.btn-primary` per status, per the UI guideline. "Start progress" and "Verify" call
      `POST /defects/:id/transitions` directly (no extra input, no modal, matching the design's
      `btn-start`/`btn-verify` which have no modal either); the other four open a modal collecting
      the one required field. Each modal does its own client-side required-field check before
      calling the API (mirroring `DefectEditPage`'s existing pre-validation pattern, and matching
      the design's own validation-error state) using the identical copy named in the DTO above, so
      a blank submit never round-trips to the server. On a 403/409, the caught `ApiError`'s message
      is shown in a `.banner-danger` above the Workflow actions card (status stays visibly
      unchanged, since the local `defect` state is only replaced by the server's response on
      success); on success the returned `Defect` body replaces local state directly (no reload
      round-trip) and a success toast fires, mirroring the design's `showToast(...)` copy style
      (e.g. "DEF-241 triaged — priority P2.").

  - description: |
      Tests for the new Workflow actions card: visibility of an action regardless of role, a
      refused attempt leaving status unchanged, a validation error kept local (no network call),
      and a successful transition updating the visible status.
    files:
      - apps/web/src/routes/DefectDetailPage.test.tsx
    rationale: |
      Extends the existing `defect` fixture and `mockApi`/`signIn` helpers already used in this
      file.

tests:
  - |
    AC1 (service): `svc.transitionDefect('tenant', id, { sub: 'qa-1', role: 'qa_verifier', tenantId: 'tenant', employeeId: null }, { action: 'triage', priority: 'P2' })`
    on a defect seeded at `New` resolves with
    `expect(d).toMatchObject({ status: 'Triaged', priority: 'P2' })`.
  - |
    AC2 (service): the same call with `role: 'developer'` instead:
    `await expect(svc.transitionDefect(...)).rejects.toBeInstanceOf(ForbiddenException)` and
    `expect((await svc.getDefect('tenant', id)).status).toBe('New')`.
    AC2 (web, `DefectDetailPage.test.tsx`): signed in as `developer`, with the defect at `New`,
    `expect(screen.getByRole('button', { name: /^triage$/i })).toBeInTheDocument()` (visible),
    then submitting the Triage modal with `mockApi` answering 403 asserts
    `expect(await screen.findByText(/triaging a defect is limited to qa\/verifier or admin/i)).toBeInTheDocument()`
    and `expect(screen.getByText('New')).toBeInTheDocument()` (status chip unchanged).
  - |
    AC3 (service): seeding `Triaged` and calling `transitionDefect(..., { sub: 'adm-1', role: 'admin', ... }, { action: 'assign', assigneeId: 'dev-1' })`
    asserts `expect(d).toMatchObject({ status: 'Assigned', assigneeName: 'dev-1' })`.
  - |
    AC4 (service): seeding `Assigned` with `assigneeName: 'dev-1'`, an Admin reassigning to
    `assigneeId: 'dev-2'` asserts `expect(d).toMatchObject({ status: 'Assigned', assigneeName: 'dev-2' })`.
  - |
    AC5 (service): seeding `In Progress` with `assigneeName: 'dev-1'`, the assigned Developer
    (`sub: 'dev-1', role: 'developer'`) calling `{ action: 'resolve', resolutionNote: 'Fixed the null check.' }`
    asserts `expect(d).toMatchObject({ status: 'Resolved', resolutionNote: 'Fixed the null check.' })`.
  - |
    AC6 (e2e, `defects.e2e-spec.ts`): seeding `In Progress` with `assigneeName: 'dev-1'`, the
    assigned Developer POSTing `{ action: 'resolve' }` (no note) asserts
    `expect(res.status).toBe(400)`, `expect(res.body.message).toContain('Resolution note')`, and a
    follow-up GET shows `expect(body.status).toBe('In Progress')`.
    AC6 (web): submitting the Resolve modal with a blank note asserts
    `expect(screen.getByText("Resolution note can't be empty.")).toBeInTheDocument()` with zero
    `fetch` calls recorded (`expect(api).not.toHaveBeenCalledWith(expect.stringContaining('/transitions'), ...)`).
  - |
    AC7 (service): seeding `Resolved`, a QA/Verifier calling `{ action: 'verify' }` asserts
    `expect(d.status).toBe('Verified')`.
  - |
    AC8 (service): seeding `Verified`, a Developer calling `{ action: 'reopen', reopenReason: 'Still broken' }`
    asserts `rejects.toBeInstanceOf(ForbiddenException)` and the defect is still
    `expect((await svc.getDefect('tenant', id)).status).toBe('Verified')`.
  - |
    AC9 (service): seeding `Verified`, a QA/Verifier calling `{ action: 'reopen', reopenReason: 'Regression found' }`
    asserts `expect(d).toMatchObject({ status: 'Reopened', reopenReason: 'Regression found' })`.
  - |
    AC10 (e2e): seeding `Verified`, a QA/Verifier POSTing `{ action: 'reopen' }` (no reason)
    asserts `expect(res.status).toBe(400)`, `expect(res.body.message).toContain('Reopen reason')`,
    and a follow-up GET shows `expect(body.status).toBe('Verified')`.
  - |
    AC11 (service): seeding `Closed`, a QA/Verifier calling `{ action: 'reopen', reopenReason: 'Found again' }`
    asserts `expect(d.status).toBe('Reopened')`.
  - |
    AC12 (service): seeding `Resolved`, a QA/Verifier calling `{ action: 'reopen', reopenReason: 'Not actually fixed' }`
    asserts `expect(d.status).toBe('Reopened')`.
  - |
    AC13 (service): seeding `Verified`, an Admin calling `{ action: 'reopen', reopenReason: 'Customer still sees it' }`
    asserts `expect(d.status).toBe('Reopened')`. A companion (unnumbered but required by the
    state-machine table above) test seeds `Resolved` and asserts an Admin's same call
    `rejects.toBeInstanceOf(ForbiddenException)`, pinning that the Verified-only "or Admin" rule
    doesn't leak into Resolved/Closed.
  - |
    AC14 (service): seeding `New`, an Admin calling `{ action: 'triage', priority: 'P1' }` asserts
    `expect(d).toMatchObject({ status: 'Triaged', priority: 'P1' })`.
  - |
    AC15 (e2e): seeding `New`, a Developer POSTing `{ action: 'triage', priority: 'P2' }` straight
    to `/defects/:id/transitions` asserts `expect(res.status).toBe(403)` and a follow-up GET shows
    `expect(body.status).toBe('New')`.
  - |
    Supporting (not independently numbered, required plumbing for AC5/AC6's "In Progress"
    premise): seeding `Assigned` with `assigneeName: 'dev-1'`, that same Developer calling
    `{ action: 'start' }` asserts `expect(d.status).toBe('In Progress')`; a different Developer
    (`sub: 'dev-2'`) calling the same asserts `rejects.toBeInstanceOf(ForbiddenException)`.

assumptions_or_open_questions:
  - |
    `developer` and `qa_verifier` don't exist in the shared `Role` enum yet (confirmed by reading
    `services/api/src/auth/roles.ts` and its hand-kept copy in `apps/web/src/lib/auth.ts` — there's
    no shared package between the two). Adding them is treated as in-scope plumbing for this
    story's role-gated transitions, not a separate concern.
  - |
    There is no user-directory/employee-linkage for a defect's assignee. A prior story
    (`run_b7589f9dba7e`'s plan, already merged) added `assignee_name` as a plain nullable text
    column with no writer, explicitly flagging "a future triage/assignment story... may want a
    proper FK to `employees` for the assignee... instead of free text" — this is that story, and
    this plan does *not* add that FK (no employee/developer directory exists to join against, and
    building one is out of this story's stated scope). Instead, the `assign` action's `assigneeId`
    is stored directly into the existing `assigneeName` column and compared by identity
    (`user.sub === defect.assigneeName`) to authorize `start`/`resolve`, the same way `reportedBy`
    already stores a raw Cognito `sub` with no name resolution. This is a deliberate departure from
    the design's `<select>` of two fixture names ("Marcus Webb"/"Priya Nair") — populating a real
    dropdown would need a developer-listing endpoint this story doesn't define, so the Assign
    modal instead takes a free-text identifier with the hint "Enter the developer's sign-in ID."
    A reviewer should treat this the same inconsistency the prior plan already flagged for
    `reportedBy`, not a new one.
  - |
    No AC or design action transitions a defect *into* `Closed` — only reopening *from* `Closed`
    (AC11) is in scope. This plan adds no `close` action; `Closed`-status defects for AC11's test
    are seeded directly at that status, the same way every other status is already seeded in both
    `defects.service.spec.ts` and `defects.e2e-spec.ts` today.
  - |
    The design's "Transition API" panel (a "Send request" button that simulates a raw POST,
    explicitly described in its own comment as showing "a script or integration signed in as the
    current user") is a reviewer-facing device to visualize AC15, not a production feature — no
    real user of a QA tracker needs a UI button that fires a raw API request. This plan implements
    AC15 purely as the backend authorization check on the real `POST /defects/:id/transitions`
    endpoint (provable by any HTTP client, which is what the AC actually requires) and does not
    build that demo panel into `DefectDetailPage`, the same treatment already given to the design's
    other explicitly-marked "Design-review only" controls (the role/status switchers).
  - |
    Authorization-failure messages drop the design's dynamic "(assignee name)" interpolation
    (e.g. design: "Starting work is limited to Marcus Webb." → this plan: "Starting work is
    limited to the assigned Developer.") since `assigneeName` now holds a raw identifier, not a
    display name, and surfacing an internal id in user-facing copy would be worse than the
    simplified fallback the design itself already uses when no assignee is set.
  - |
    Priority values (`P1`–`P4`) and their "P1 — Critical" … "P4 — Low" labels come from the
    design's Triage modal `<select>`, since no priority enum exists in the codebase today.

estimated_points: 8

package_dependencies: []

notes: |
  ```mermaid
  flowchart TD
    subgraph API[comp_api_service]
      RolesEnum[roles.ts: ROLES]
      Priorities[defect-priorities.ts]
      TransitionDto[TransitionDefectDto]
      Migration[Migration: resolution_note + reopen_reason]
      Entity[Defect entity]
      Service[DefectsService.transitionDefect]
      Controller[DefectsController: POST /:id/transitions]
      Guards[CognitoAuthGuard / RolesGuard]
    end
    subgraph WEB[comp_web_app]
      WebRole[auth.ts: Role]
      Types[types.ts: Defect]
      Tags[DefectTags.tsx: StatusChip]
      DetailPage[DefectDetailPage.tsx]
      ApiClient[apiClient.ts]
    end

    Guards -->|authenticates, no static role| Controller
    Controller -->|validates body| TransitionDto
    Controller --> Service
    Service -->|role/identity rules read| RolesEnum
    Service -->|loads/saves| Entity
    Migration -->|adds columns to| Entity
    TransitionDto -->|validates against| Priorities

    DetailPage -->|signed-in role from| WebRole
    DetailPage -->|renders| Tags
    DetailPage -->|POST /defects/:id/transitions| ApiClient
    ApiClient --> Controller
    DetailPage -->|reads/writes| Types

    classDef touched fill:#f96,color:#000
    class RolesEnum,Priorities,TransitionDto,Migration,Entity,Service,Controller,WebRole,Types,Tags,DetailPage touched
  ```

review_focus: |
  In scope: the transition state machine and its role/identity gating (`DefectsService.transitionDefect`),
  the two new role values, the new `POST /defects/:id/transitions` endpoint, persisting resolution
  notes/reopen reasons, and the Workflow actions UI on `DefectDetailPage`. Out of scope (don't flag
  as missing): any transition *into* `Closed`, a real developer directory/assignee picker, and the
  design's "Transition API" demo panel — see assumptions for why each is deliberately excluded.
  Riskiest area: the `assign`/`start`/`resolve` identity check reuses `assigneeName` (a plain text
  column, no FK) to hold a raw user identifier instead of a display name — this is a continuation
  of an inconsistency a prior story's plan already flagged for `reportedBy`, not new sloppiness,
  but a reviewer should confirm the comparison (`user.sub === defect.assigneeName`) is exact-match
  and tenant-scoped (via the existing `loadDefect(tenantId, id)`), since a loose match here would
  let the wrong Developer resolve someone else's defect. Also confirm the Resolved/Closed-reopen
  role set (`qa_verifier` only) is never accidentally widened to match Verified's
  (`qa_verifier` + `admin`) — the design is explicit that only Verified gets the broader rule.

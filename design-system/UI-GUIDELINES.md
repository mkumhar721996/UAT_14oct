# UI Guidelines

## Navigation & information architecture
- Persistent left **sidebar** (`.sidebar`) lists top-level sections (e.g. Jobs, Queues, Settings); it stays visible so operators always know where they are in a multi-service console.
- A **top bar** (`.topbar`) holds page title and contextual actions only — it does not duplicate navigation, keeping one source of truth for "where am I."
- No bottom navigation and no nested flyout menus — this is an internal/operator tool, not a consumer app, so a flat two-level hierarchy (sidebar section → page) is enough.

## Layout & density
- Default to a **data-dense** layout (compact `space-2`/`space-3` paddings) since this product's primary users are engineers monitoring jobs and queues, not casual browsers.
- Content area (`.content`) uses a single scrolling column per page, max content handled by tables/cards rather than multi-column dashboards, so operators can scan top-to-bottom without losing their place.
- Design for desktop widths first (≥1024px); below that, collapse the sidebar into the top bar, because this tool is used from engineer workstations, not phones.

## Component usage
- Use `.card` for a single entity's summary or a settings group — anything read as one cohesive unit.
- Use `.table` for any list of records a user compares or scans across rows (jobs, queue messages) — tables communicate "many similar things" better than stacked cards.
- Use `.chip-success` / `.chip-warning` / `.chip-danger` for job/queue status only — status is the one thing worth color-coding; overusing chips elsewhere dilutes the signal.
- Use `.btn-primary` for exactly one primary action per view (e.g. "Retry job"); every other action is `.btn-secondary`, so users always know the one recommended next step.
- Use `.field` + `.input`/`.select`/`.textarea` for all form entry so keyboard focus and spacing stay consistent across settings and filter forms.

## Theme
- **Light theme only, by default.** Operators work in bright office/monitoring environments and this keeps the token set small; dark mode can be added later if requested, but is not a current requirement.

## Voice & tone
- Copy is plain and operational: short imperative labels ("Retry job", "View logs") over cleverness, since users are triaging issues and need the fastest path to the next action.
- Error and status text states what happened and what to do next in one sentence — no blame, no jargon beyond terms the service itself uses (queue, job, worker).

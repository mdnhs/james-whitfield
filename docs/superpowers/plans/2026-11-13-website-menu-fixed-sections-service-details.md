# Website menu, fixed sections and service detail pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One "Website" admin menu with a screen per public page, page sections locked (content-only editing, enforced on the server), shared collection items edited inside the page sections that show them, and a fixed-template service detail page per service at `/services/<slug>`.

**Architecture:** A pure `structureOf()`/`assertSameStructure()` pair locks each page's block list (type, anchor, order, hidden) on every server write. The admin nav registry gets a `website` item whose children open a `/admin/website/[key]` route that resolves a page by `systemKey` and renders the existing `PageBuilder` minus structure controls. Service detail pages are ordinary `pages` rows linked by a new `pages.service_id` column and built from a fixed template of four new inline-data blocks plus `hero.page`, `journey` and `band`.

**Tech Stack:** Next.js (repo's patched version — read `node_modules/next/dist/docs/` before route code), React 19, TypeScript, Hono API (`server/api`), Drizzle + Postgres, zod, TanStack Query, Vitest (unit + integration projects), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-website-menu-fixed-sections-service-details-design.md`

## Global Constraints

- Structure lock compares, per block: `type`, `anchor`, order, `hidden`; and the block count. Block `id`, `chapter`, `joinPrevious` and `data` are not locked.
- Refused structure change → `ApiError("VALIDATION_FAILED", ...)`. Restore refusal message, verbatim: `This version has a different layout and can't be restored`.
- Shared collection items edited from a page need `page:update` **and** `collection:update`/`create`/`delete` for the respective action; with `page` only they are read-only.
- Service detail page: create needs `collection:create`, delete needs `collection:delete`; editing content needs `page:update` (existing builder rules).
- Service detail URL is `/services/<service.slug>`. Slug change moves it and records a redirect (`recordPathChange`). Hidden service (`isVisible=false`) → its page 404s and is absent from sitemap, `llms.txt`, JSON-LD and the route table.
- Each service page's FAQ, steps and plans are inline in its own blocks (not collection rows). The CTA band reuses the shared `band` block.
- New public sections use `Container` (`components/layout/container.tsx`), `Eyebrow`, the `<section id aria-labelledby data-motion="rise">` + `<h2 id="${id}-heading" data-motion="words" className="font-display …">` pattern. Model benefits on `ApproachSection`, intro on `FitSection`.
- All new admin copy goes in the existing microcopy/label files used by neighbouring code (`admin/modules/*/…-ui.ts`, `lib/content/global-access.ts` labels).
- Do not touch the other session's uncommitted files (chat schema, migration `0015_*`) in the main checkout; work happens on branch `feat/website-menu` in a worktree.
- Migrations via `pnpm drizzle-kit generate` (never hand-numbered). Existing published pages and revisions must keep parsing.

The AI assistant has no page-writing tools (all read-only, `server/modules/ai/tools.ts`), so the spec's AI clause needs no code; Task 1's server lock covers any future writer.

## Review Focus

1. **Old revisions** written before this change whose block list differs from today's (e.g. a block added later) — restore must be refused with the exact message, not crash or silently reshape. Test in Task 1.
2. **Discard draft on a page whose published doc predates the lock** — `discardDraft` must refuse if published structure ≠ draft structure rather than write it. Test in Task 1.
3. **Service with no CTA band in the library** — turning on its details page must answer 409 with a clear message (`Add a call-to-action band first`), not 500. Test in Task 6.
4. **Two services whose slug change targets a path already used by another page** — must answer 409 `CONFLICT`, leaving both pages untouched. Test in Task 6.
5. **Deep links into removed screens** (`/admin/pages`, `/admin/collections/faqs`, `/admin/appearance`) from emails and the dashboard QA list must land on the right Website/Settings screen. Test in Task 3.

---

## File Structure

| File | Responsibility |
|---|---|
| `blocks/structure.ts` (new) | `structureOf`, `sameStructure`, `assertSameStructure` |
| `server/modules/pages/service.ts` | apply lock in `saveDraft`, `restoreRevision`, `discardDraft`; export `insertPage`/`movePage` internals for service pages |
| `server/modules/pages/routes.ts` | drop `POST /` |
| `lib/admin/nav.ts` | `website` item + children; Settings gains Appearance; Pages/Collections gone |
| `app/(admin)/admin/(panel)/website/[key]/page.tsx` (new) | resolve page by key → `PageBuilder` |
| `app/(admin)/admin/(panel)/website/legal/page.tsx` (new) | list legal + other custom pages |
| `app/(admin)/admin/(panel)/website/header-footer/page.tsx` (new) | `GlobalEditor` for navigation + footer |
| `lib/admin/website.ts` (new) | `WEBSITE_PAGES` key ↔ systemKey ↔ label; `COLLECTION_HOME` redirect map |
| `admin/modules/pages/*` | remove structure controls |
| `admin/modules/collections/items-panel.tsx` (new) | inline items list for a section (edit/add/remove/reorder, "Also shown on") |
| `blocks/service.ts` (new) | `service.intro`, `service.benefits`, `service.formats`, `service.faq` |
| `blocks/about.ts` | `hero.page` gains optional `cta` |
| `blocks/service-template.ts` (new) | `serviceTemplate(service, bandId): PageDocument` |
| `features/service-detail/components/*.tsx` (new) | `ServiceIntroSection`, `ServiceBenefitsSection` |
| `server/db/schema/pages.ts` + migration | `serviceId` column |
| `server/modules/service-pages/{service,routes}.ts` (new) | create/delete details page; slug/visibility/delete hooks |
| `admin/modules/website/services-panel.tsx` (new) | services list with Details switch |

---

### Task 1: Server-side structure lock

**Files:**
- Create: `blocks/structure.ts`, `blocks/structure.test.ts`
- Modify: `server/modules/pages/service.ts` (`saveDraft` L116, `discardDraft` L179, `restoreRevision` L203), `server/modules/pages/routes.ts` (remove `POST /` L27), `tests/integration/api/pages.test.ts`

**Interfaces:**
- Produces: `type BlockShape = { type: string; anchor: string; hidden: boolean }`; `structureOf(doc: { blocks: readonly { type: string; anchor: string; hidden: boolean }[] }): BlockShape[]`; `sameStructure(a, b): boolean`; `assertSameStructure(current, next, message?: string): void` (throws `ApiError("VALIDATION_FAILED", message ?? "Sections are fixed on this page")`).
- Produces: `createPage` stays exported from `service.ts` but loses its route; add `insertPage(tx, { path, title, document, serviceId? , actor })` used by Task 6.

- [ ] **Step 1: Write failing unit tests** in `blocks/structure.test.ts`: `sameStructure` true when only `id`, `chapter`, `joinPrevious`, `data` differ; false for added block, removed block, swapped order, changed `anchor`, changed `type`, flipped `hidden`; `assertSameStructure` throws `ApiError` with code `VALIDATION_FAILED`.
- [ ] **Step 2: Run** `pnpm vitest run blocks/structure.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `blocks/structure.ts` (import `ApiError` from `@/server/api/errors` only if `blocks/` may import server code — otherwise throw from a small server wrapper `server/modules/pages/structure-guard.ts`; check existing `blocks/*` imports and follow them).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Write failing integration tests** in `tests/integration/api/pages.test.ts`:
  - `PATCH /:id/draft` with an extra block → 400 `VALIDATION_FAILED`; with reordered blocks → 400; with only data changed → 200.
  - `POST /:id/revisions/:rev/restore` where the revision snapshot has a different block list → 400 and message exactly `This version has a different layout and can't be restored`; draft unchanged.
  - `POST /:id/discard` when published structure ≠ draft structure → 400, draft unchanged.
  - `POST /` (create page) → 404/405 (route gone).
  - Replace "creates and deletes custom pages, never system ones" (L211) and "reserves /og…" (L237) so they insert the custom page through the test DB helper instead of `POST /`; delete behaviour assertions stay.
- [ ] **Step 6: Run** `pnpm vitest run --project integration tests/integration/api/pages.test.ts` → new tests FAIL.
- [ ] **Step 7: Implement**: in `saveDraft` read the row's current `draft`, `assertSameStructure(current, input.document)` inside the same transaction as `writeIfVersion`; in `restoreRevision` assert snapshot vs current draft with the verbatim message; in `discardDraft` assert published vs draft; remove the `POST /` route; extract the insert body of `createPage` into `insertPage`.
- [ ] **Step 8: Run** integration + `pnpm vitest run --project unit` → PASS (if the local integration DB is broken with `accounts_user_id_users_id_fk`, recreate it: stop other test runs, `docker compose up -d` the test db, rerun; report if still broken).
- [ ] **Step 9: Commit** `feat(pages): lock page structure on save, restore and discard`.

### Task 2: Content-only page editor

**Files:**
- Modify: `admin/modules/pages/page-builder.tsx` (Add block L463–472, L538–546; `BlockLibrary` L570–579; outline handlers L444–463), `block-outline.tsx`, `block-meta.tsx`, `builder-state.ts`, `builder-state.test.ts`, `pages-view.tsx` (New page button + `NewPageDialog`)
- Delete: `admin/modules/pages/block-library.tsx` (and its uses)
- Test: `admin/modules/pages/builder-state.test.ts`, new `admin/modules/pages/block-outline.test.tsx`

**Interfaces:**
- Produces: `BlockOutline({ blocks, selectedId, onSelect, readOnly })` — no `onMove`/`onToggleHidden`/`onRemove`; hidden blocks are filtered out. `DocAction` becomes `data | meta`; `BlockMetaPatch` becomes `{ chapter }`.

- [ ] **Step 1: Failing tests**: `block-outline.test.tsx` — renders one button per non-hidden block, no element named `/^(Reorder|Hide|Show|Remove) /`, a hidden block is absent; `builder-state.test.ts` — drop the add/move/remove tests (L17, L29, L38) and add "applies data and chapter edits only".
- [ ] **Step 2: Run** `pnpm vitest run admin/modules/pages` → FAIL.
- [ ] **Step 3: Implement**: strip dnd-kit from the outline; remove hidden/joinPrevious/anchor controls from `BlockMeta` (keep Journey rail label); remove Add block buttons, `BlockLibrary`, `newBlock`, `addableTypes`; remove New page button and dialog from `PagesView`.
- [ ] **Step 4: Run** unit tests + `pnpm tsc --noEmit` + `pnpm eslint admin/modules/pages` → PASS.
- [ ] **Step 5: Commit** `feat(admin): page editor edits section content only`.

### Task 3: Website menu, routes and redirects

**Files:**
- Create: `lib/admin/website.ts`, `lib/admin/website.test.ts`, `app/(admin)/admin/(panel)/website/[key]/page.tsx`, `website/legal/page.tsx`, `website/header-footer/page.tsx`, `admin/modules/insights/insights-tabs.tsx`
- Modify: `lib/admin/nav.ts`, `lib/admin/nav.test.ts`, `admin/components/shell/nav-icons.ts`, `app/(admin)/admin/(panel)/pages/page.tsx`, `pages/[id]/page.tsx`, `collections/page.tsx`, `collections/[name]/page.tsx`, `appearance/page.tsx`, `server/modules/dashboard/content-qa.ts:61,72`, `server/modules/seo/health.ts:63`, `lib/content/qa.ts:104`, `admin/modules/pages/page-builder.tsx:288` (back link)

**Interfaces:**
- Produces in `lib/admin/website.ts`:
  - `WEBSITE_PAGES = [{ key: "home", systemKey: "home", label: "Home" }, { key: "about", … "About" }, { key: "services", … "Services" }, { key: "how-it-works", … "How it works" }, { key: "contact", … "Contact" }, { key: "insights", systemKey: "insights", label: "Insights page" }] as const`; `type WebsiteKey`.
  - `websiteHref(key: WebsiteKey): string` → `/admin/website/${key}`.
  - `adminHrefForPage(page: { id: string; systemKey: string | null }): string` → website href for system pages, else `/admin/pages/${id}`.
  - `COLLECTION_HOME: Record<CollectionSlug, WebsiteKey>` = `{ services: "services", plans: "services", testimonials: "home", faqs: "home", steps: "how-it-works", "cta-bands": "home" }`.
- Nav: `website` item (group `menu`, href `/admin/website/home`, permission `{ page: ["read"] }`) with children Home, About, Services, How it works, Contact (each `websiteHref`), Insights (`/admin/insights`, permission `{ page: ["read"] }`), Legal pages (`/admin/website/legal`), Header & footer (`/admin/website/header-footer`, `{ globals: ["read"] }`). Remove items `pages`, `insights`, `collections`, `appearance`; Settings children gain Appearance (`/admin/appearance`, `{ appearance: ["read"] }`) and lose Navigation and Footer.
- Add to `NavLink` an optional `match?: readonly string[]`; `isActivePath` treats a child as active when the path is under `href` or any `match` prefix. Insights child `match: ["/admin/insights", "/admin/website/insights"]`; Services child `match: ["/admin/pages"]` is NOT added (service pages show under Services via Task 7's back link only).

- [ ] **Step 1: Failing tests**: `nav.test.ts` — update per-role top-level id lists (replace `pages`, `collections`, `insights` with `website`; `appearance` gone from top level); a test that Website children labels are exactly `["Home","About","Services","How it works","Contact","Insights","Legal pages","Header & footer"]` for owner; `isActivePath("/admin/insights/categories", websiteInsightsChild)` true; `permissionFor("/admin/website/legal")` is `{ page: ["read"] }`. `website.test.ts` — `adminHrefForPage({ id: "x", systemKey: "about" })` = `/admin/website/about`, custom → `/admin/pages/x`; `COLLECTION_HOME.faqs` = `"home"`.
- [ ] **Step 2: Run** `pnpm vitest run lib/admin` → FAIL.
- [ ] **Step 3: Implement** registry + helpers; `website/[key]/page.tsx`: `requirePermission(permissionFor(websiteHref(key)))`, look up the page id by `systemKey` (add `findPageIdBySystemKey(systemKey): Promise<string | null>` to `server/modules/pages/service.ts`), `notFound()` when unknown, render `<PageBuilder id />` (wrap in Suspense like `pages/[id]`). `legal/page.tsx` lists non-system pages whose path is not under `/services/` (title, path, status, link to `/admin/pages/[id]`). `header-footer/page.tsx` renders `GlobalEditor` with the Navigation + Footer keys exactly as `settings/[slug]` does today. Redirects with `redirect()` inside a Suspense'd async component (existing pattern): `/admin/pages` → `/admin/website/home`; `/admin/collections` and `/admin/collections/[name]` → `websiteHref(COLLECTION_HOME[name])`; `/admin/settings/navigation|footer` → `/admin/website/header-footer`. `pages/[id]` guards with `{ page: ["read"] }` literal (no nav lookup) and its back link uses the referrer page's website href (system page → its website key, service page → `/admin/website/services`, else `/admin/website/legal`). Replace hard-coded `/admin/pages/${id}` and `/admin/collections/${name}` links with `adminHrefForPage` / `websiteHref(COLLECTION_HOME[...])`. Insights screens render `InsightsTabs` (Articles, Categories, Authors, Page sections → `/admin/website/insights`).
- [ ] **Step 4: Run** `pnpm vitest run lib/admin app/(admin) admin/components/command` + `guarded-pages.test.ts` + tsc + eslint → PASS. Add an e2e in `tests/e2e/admin/navigation/website-menu.spec.ts`: visiting `/admin/pages`, `/admin/collections/faqs`, `/admin/settings/footer` lands on `/admin/website/home`, `/admin/website/home`, `/admin/website/header-footer`; sidebar shows "Website" and no "Pages"/"Collections".
- [ ] **Step 5: Commit** `feat(admin): Website menu with a screen per public page`.

### Task 4: Shared items edited inside the section

**Files:**
- Create: `admin/modules/collections/items-panel.tsx`, `items-panel.test.tsx`, `lib/content/block-collections.ts`, `lib/content/block-collections.test.ts`
- Modify: `admin/modules/pages/block-form.tsx` (render panel under the form), `admin/modules/collections/collection-view.tsx` (delete; move list logic into the panel), `server/modules/collections/service.ts` (`listItems` `usedOn` unchanged)

**Interfaces:**
- Consumes: Task 2's `BlockForm` props; Task 3 removed the collections route.
- Produces: `collectionsOf(type: BlockType): CollectionSlug[]` (from `BLOCK_BY_TYPE[type].uses`, mapping tag `bands` → `cta-bands`, ignoring `media`); `ItemsPanel({ name: CollectionSlug, pageTitle: string, readOnly: boolean })`.

- [ ] **Step 1: Failing tests**: `collectionsOf("faq")` = `["faqs"]`, `("band")` = `["cta-bands"]`, `("process")` = `["steps"]`, `("hero.page")` = `[]`. `items-panel.test.tsx`: lists items from a mocked `collectionListQuery`; shows `Also shown on: Contact` for an item whose `usedOn` is `["Home","Contact"]` when `pageTitle="Home"`; with `readOnly` there is no Add/Edit/Remove; Add opens `ItemSheet` with `item="new"`; Remove on an item answering 409 shows the server message in a toast.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** panel reusing `ItemSheet` and the existing collections API (list, create, update, order, delete); `readOnly` = `!(canEditPage && hasPermission(collection:update))`, Add gated by `collection:create`, Remove by `collection:delete`. The block's own Selection widget stays (choosing which items show).
- [ ] **Step 4: Run** unit tests, tsc, eslint → PASS.
- [ ] **Step 5: Commit** `feat(admin): edit a section's shared items in place`.

### Task 5: Service detail blocks, renderers and template

**Files:**
- Create: `blocks/service.ts`, `blocks/service-template.ts`, `blocks/service-template.test.ts`, `features/service-detail/components/service-intro-section.tsx`, `service-benefits-section.tsx`, `*.test.tsx`
- Modify: `blocks/about.ts` (`hero.page` + `cta`), `components/page-hero.tsx`, `blocks/registry.ts` (BLOCKS + union), `app/(site)/_cms/resolve-block.tsx`, `admin/modules/pages/block-icons.ts`, `admin/modules/pages/block-ui.ts`, `server/db/schema/pages.ts` + generated migration, `blocks/registry.test.ts`

**Interfaces:**
- Produces block types (all `allowedOn: ["custom"]`, `max: 1`, `uses: []`):
  - `service.intro`: `{ eyebrow: text(40), title: text(80), body: text(1200), forYouHeading: text(60), forYou: z.array(text(120)).min(2).max(6) }` → `ServiceIntroSection({ id, content })` (two-column: body left, "this is for you if" check list right, model `FitSection`).
  - `service.benefits`: `{ eyebrow, title: text(80), items: z.array({ icon: IconField, title: text(60), body: text(200) }).min(3).max(6) }` → `ServiceBenefitsSection` (icon cards, model `ApproachSection`).
  - `service.formats`: `{ eyebrow, title, subtitle: text(200), featuredTag: text(24), plans: z.array({ name: text(40), priceLabel: text(24), unit: text(24), summary: text(200), features: z.array(text(80)).max(6), ctaLabel: text(30), featured: z.boolean() }).min(1).max(4) }` → existing `FormatsSection` with `plans` mapped to `PlanView` (`id: \`${blockId}-${i}\``, `slug` same, `priceCents: null`).
  - `service.faq`: `{ title: text(80), subtitle: text(200), items: z.array({ question: text(200), answer: text(1500) }).min(1).max(12), initiallyOpen: z.number().int().min(0).nullable() }` → existing `FaqSection` with `FaqView` ids `${blockId}-${i}` and `variant: "page"`.
  - `hero.page` gains `cta: LinkValue.nullable().default(null)`; `PageHero` renders a primary pill button when present (same classes as the home hero CTA).
  - Ensure `journey` and `band` allow `"custom"` (extend `allowedOn` if not).
- Produces: `serviceTemplate(service: { slug: string; title: string; body: string }, bandId: string): PageDocument` — 7 blocks in order `hero.page`(anchor `top`), `service.intro`(`about`), `service.benefits`(`benefits`), `journey`(`sessions`), `service.formats`(`formats`), `service.faq`(`faq`), `band`(`book`); chapters `Overview, Benefits, Sessions, Formats, FAQ` on 2–6; hero `cta = { label: "Book a discovery call", href: "/contact" }`; placeholder copy derived from `service.title`/`service.body`; result parses with `pageDocumentFor("custom")`.
- Produces schema: `pages.serviceId: uuid().unique().references(() => services.id, { onDelete: "set null" })`.

- [ ] **Step 1: Failing tests**: `service-template.test.ts` — 7 blocks, anchors/types in the order above, parses with `pageDocumentFor("custom")`, hero title equals service title; registry test includes the four new types; render tests: `ServiceIntroSection` renders heading + every `forYou` item, `ServiceBenefitsSection` renders N cards, `PageHero` renders the CTA link only when `cta` set; an old `hero.page` payload without `cta` still parses.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** blocks, renderers (read `features/about-page/components/approach-section.tsx` and `features/how-it-works/components/fit-section.tsx` first and match spacing/typography/tokens), resolve-block cases, admin icons/field UI, schema column; `pnpm drizzle-kit generate` → commit the generated SQL + snapshot.
- [ ] **Step 4: Run** unit tests, tsc, eslint, `pnpm build` (Cache Components build must succeed without DB) → PASS.
- [ ] **Step 5: Commit** `feat(services): service detail sections and page template`.

### Task 6: Service details lifecycle (server)

**Files:**
- Create: `server/modules/service-pages/service.ts`, `routes.ts`, `tests/integration/api/service-pages.test.ts`
- Modify: `server/api/routes/admin.ts` (mount `/service-pages`), `server/modules/collections/service.ts` (`updateItem`/`deleteItem` hooks for `services`), `server/modules/content/queries.ts` (`getPublishedPage`), `server/modules/seo/live.ts` (`listLiveEntities`), `server/modules/redirects/queries.ts` (`getRouteTable`), `lib/content/collections.ts` (services `pagePath` no longer user-editable: keep column, drop from form overrides)

**Interfaces:**
- Consumes: Task 1 `insertPage`; Task 5 `serviceTemplate`, `pages.serviceId`.
- Produces:
  - `enableServicePage(actor, serviceId): Promise<{ pageId: string; path: string }>` — 404 unknown service; 409 `CONFLICT` if it already has one or the path is taken; 409 `Add a call-to-action band first` when no visible band; inserts page (`status: "draft"`), sets `services.page_path = path`, `invalidate([tags.routes, tags.collection("services")])`.
  - `disableServicePage(actor, serviceId): Promise<void>` — deletes the linked page via the same internals as `deletePage` (revisions + redirects), clears `page_path`, invalidates.
  - Hooks: services `updateItem` with a changed slug and a linked page → `recordPathChange` + update `pages.path` + `page_path` (409 if target taken); `deleteItem` on a service with a linked page → `disableServicePage` in the same transaction.
  - Visibility: `getPublishedPage`, `listLiveEntities` and `getRouteTable().live` exclude pages whose `serviceId` points at a service with `isVisible=false`; the services `updateItem` hook invalidates `tags.page(pageId)` + `tags.routes` when `isVisible` changes.
  - Routes: `POST /service-pages/:serviceId` (`collection:create`) → 201 `{ pageId, path }`; `DELETE /service-pages/:serviceId` (`collection:delete`) → 204.

- [ ] **Step 1: Failing integration tests** (`service-pages.test.ts`): enable → 201, page row has 7 blocks and `serviceId`; enable twice → 409; enable with no band → 409 message exact; editor can enable, author gets 403; slug rename moves `/services/a` → `/services/b` and a redirect `a→b` exists; slug rename onto an existing page path → 409 and nothing moved; hiding the service → `GET /services/b` 404 and absent from `/sitemap.xml` and `/llms.txt`; deleting the service deletes the page and its revisions; disable → page gone, `page_path` empty.
- [ ] **Step 2: Run** `pnpm vitest run --project integration tests/integration/api/service-pages.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the integration project for `service-pages`, `pages`, `collections`, `seo` tests → PASS.
- [ ] **Step 5: Commit** `feat(services): create, move, hide and delete service detail pages`.

### Task 7: Website → Services screen

**Files:**
- Create: `admin/modules/website/services-panel.tsx`, `services-panel.test.tsx`
- Modify: `app/(admin)/admin/(panel)/website/[key]/page.tsx` (render panel below the builder when `key === "services"`), `admin/modules/collections/collection-ui.ts` (drop `pagePath` field UI), `admin/lib/api.ts` (`servicePagesApi`)

**Interfaces:**
- Consumes: Task 6 routes; Task 4 `ItemsPanel` (services items editing).
- Produces: `ServicesPanel()` — per service row: title, status, a `Switch` "Details page" (on when `pagePath` set), "Edit page" link to `/admin/pages/{pageId}` when on. `pageId` comes from the page whose `serviceId` matches, else (legacy hand-linked services) the page whose `path` equals the service's `pagePath` (from `pagesListQuery()`). Turning off asks for confirmation in a `Dialog` (no `window.confirm`): "Delete the details page for {title}? Its content can't be recovered."

- [ ] **Step 1: Failing tests**: switch on calls `POST /service-pages/:id` and then shows "Edit page"; switch off opens the dialog, confirm calls `DELETE`; without `collection:create` the switch is disabled; a 409 shows its message.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** unit + tsc + eslint → PASS.
- [ ] **Step 5: Commit** `feat(admin): turn a service's details page on and off`.

### Task 8: JSON-LD and the services grid

**Files:**
- Modify: `app/(site)/_cms/page-json-ld.tsx` (L87–100), its test; `app/(site)/_cms/resolve-block.tsx` services.grid case (L112–124) unchanged behaviour verified by test

**Interfaces:**
- Consumes: Task 5 block types.
- [ ] **Step 1: Failing test**: a service page with `service.faq` emits an `FAQPage` node with its inline questions; with `service.formats` emits offer/plan nodes from inline plans; grid "Learn more" points to `/services/<slug>` only when that page is published and the service visible.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(seo): JSON-LD from service page FAQ and formats`.

### Task 9: E2E migration and service-page flow

**Files:**
- Modify: `tests/e2e/support/api.ts` (`createPublishedPage` L48 → create a service via the collections API, `POST /service-pages/:id`, PATCH draft keeping structure, publish), specs using it (csp, editing — replace `heroDoc` block-adding with editing the template's hero data, preview, conflict, wrong-record — replace "New page" flow L73 with opening a service page, rbac — drop the meaningless "Add block" count check)
- Create: `tests/e2e/admin/content/service-page.spec.ts`

- [ ] **Step 1:** Write `service-page.spec.ts`: editor turns on a service's details page from Website → Services, edits the hero title, publishes; `/services/<slug>` shows the title, the 7 section headings and the "Book a discovery call" link; outline has no Add/Remove/Hide/Reorder controls.
- [ ] **Step 2:** Run `pnpm exec playwright test tests/e2e/admin --project admin-desktop` and `tests/e2e/navigation --project desktop` → fix specs until PASS.
- [ ] **Step 3: Commit** `test(e2e): service pages and content-only editing`.

---

## Execution waves (parallel where files don't overlap)

- Wave A (parallel): Task 1, Task 3, Task 5
- Wave B (parallel): Task 2, Task 6, Task 8
- Wave C (parallel): Task 4, Task 7
- Wave D: Task 9, then whole-branch review and full `pnpm vitest run`, `pnpm build`, Playwright desktop + admin-desktop.

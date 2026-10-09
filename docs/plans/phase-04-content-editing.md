# Phase 4: Content Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editors change the site from the admin: a page builder with draft/publish/revisions and live preview, generic collection editors, globals editors with rollback, and a media library with a privacy-safe upload pipeline. Every write is validated, authorised, version-guarded, audited and invalidates exactly the cache tags the public site reads.

**Architecture:** Hono sub-apps under `/api/v1/admin` (`pages`, `preview`, `globals`, `collections`, `media`) validate with Zod, authorise with `can()` and call services. Services own `audit()`, optimistic locking (`version`) and `invalidate()`. The public site reads drafts only when Next draft mode is on **and** the request carries a session with `page.read` (`isPreviewing()`); cached queries take `draft` as an argument instead of reading `draftMode()` themselves. The admin UI builds on Phase 2's `SchemaForm` (Zod → JSON Schema → widgets), extended with media, link, icon, stat, rich text, collection, colour, focal and frame widgets.

**Tech Stack:** Next.js 16.3.8 (Cache Components, draft mode) · Hono 4.13.13 + `@hono/zod-validator` 0.9.1 · Better Auth 1.7.7 · Drizzle 0.45.4 · Zod 4.6.5 · TanStack Query 5.104.1 · react-hook-form 7.89.0 · sharp 0.35 · new: `@aws-sdk/client-s3`, TipTap 3, dnd-kit, react-easy-crop (exact pins below).

**Spec:** [`docs/brief.md`](../brief.md) (§5.6, §6, §7.2, §8, §9, §14, §15) and the Phase 4 contract in [`docs/plan.md`](../plan.md) ("### Phase 4: Content editing"). Read both first.

## Global Constraints

Copied verbatim from `docs/plan.md` (lines 19–62); every task implicitly includes them.

- Next.js `16.3.x` App Router with `cacheComponents: true`, on the Node runtime only. Do not upgrade to 16.4 inside this plan.
- `proxy.ts` sits at the repo root (no `src/`). It does optimistic cookie checks only and **never touches the database**.
- Hono `4.13.x` with `@hono/vercel` `1.0.x` and `@hono/zod-validator` `0.9.x`. **No Hono v5**, and never import `hono/vercel`.
- Drizzle ORM `0.45.x`, drizzle-kit `0.31.x`, `pg` `8.x`. Use the 0.45 APIs (`relations()`, `migrate(db, { migrationsFolder })`). Drizzle's website documents the v1 RC by default, so `defineRelations` and `drizzle-orm/zod` **do not exist** for us.
- Zod `4.6.x`, always imported as `import * as z from "zod"`.
- Database casing is `snake_case`, primary keys are `uuid`, and timestamps are `timestamptz`.
- **No database access at build time.** Every DB read is a `'use cache'` query called after `await io()` inside a `<Suspense>` boundary. Never read env or the DB at module scope. CI builds with an unreachable `DATABASE_URL`.
- Never use `NEXT_PUBLIC_*` env vars. Client-visible values are passed down from the server as props.
- Every `server/**` module begins with `import "server-only"`, and client components never import it. Node scripts that load server modules run with `NODE_OPTIONS=--conditions=react-server`.
- Public pages never `fetch` our own `/api/*`. Hono serves only the admin, the forms and cron.
- Hono route handlers do three things: validate (Zod), authorise (`can()`), call a service. Services own the audit log and cache invalidation.
- Client code never queries `document` for page content. It uses `findTarget()` and `activePageRoot()` from `lib/page-root.ts`, because Cache Components keeps hidden routes in the DOM through `<Activity>`.
- shadcn `base-nova` is built on Base UI. Compose with the `render` prop (never `asChild`), and pass `nativeButton={false}` when rendering a non-button.
- The public site is light-only. The admin supports light, dark and system. No single-key hotkeys.
- Every public site section aligns to `components/layout/container.tsx` (max width 1440px, 66px gutter).
- Prettier: no semicolons, double quotes, `trailingComma: "es5"`, width 80.
- File names are kebab-case.
- Use named exports. Default exports are only for `page`, `layout` and `route` files and configs.
- Comments explain *why*.
- Any task that touches the public site must pass `pnpm test:parity` at ≤ 0.1% pixel difference per page.
- Every task ends green on `pnpm lint`, `pnpm typecheck`, its tests and `pnpm build`, then makes one Conventional Commit.

Phase-4 values from the spec (verbatim):

- "`updateTag` works **only in Server Actions**. Route Handlers (and therefore Hono) use `revalidateTag(tag, profile)`." (§5.6) → always `invalidate()` from `server/lib/cache.ts`.
- "**Autosave** writes the draft, debounced at about 1.2 s, guarded by `version`." · "Every publish writes a **revision** snapshot (the last 50 are kept)." · "globals keep 20 revisions for one-click rollback." · "A mismatch returns **409** with the current version" (§6.5).
- "`/v1/admin/*` → `session` → `signedIn` → `sameOrigin` → `bodyLimit(1 MB)`. The media upload route alone allows 20 MB." (§8.1)
- "An allowlist (JPEG, PNG, WebP, AVIF, PDF) verified by magic bytes. **SVG is rejected**" · "auto-orient; **strip EXIF/GPS**; downscale anything over 4000 px" · key `media/2026/10/<hash>-<slug>.<ext>` (§14).
- "the `s3` driver targets the R2 EU endpoint `https://<account>.eu.r2.cloudflarestorage.com` with `requestChecksumCalculation: "WHEN_REQUIRED"`" (plan.md Phase 4.7).
- "URL fields only accept `https:`, `mailto:`, `tel:` and relative URLs" (§15) → reuse `Href` / `LinkValue` / `HttpsUrl` from `blocks/fields.ts`.

**New dependencies (exact pins, all published ≥ 2 weeks before 2026‑10‑10; installed by the task that needs them):**

| Package | Version | Task |
| --- | --- | --- |
| `@aws-sdk/client-s3` | `3.1141.0` | 5 |
| `@tiptap/core`, `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit` | `3.31.3` (all four identical) | 6 |
| `@dnd-kit/core` | `6.3.1` | 7 |
| `@dnd-kit/sortable` | `10.0.0` | 7 |
| `@dnd-kit/utilities` | `3.2.2` | 7 |
| `react-easy-crop` | `6.2.3` | 9 |

No `nanoid` (block ids use `crypto.randomUUID()`, which `BlockId` accepts) and no `file-type` (a 20-line magic-byte sniffer covers the five allowed types).

## Review Focus

1. **Publish/save leaves the public site stale.** After any successful write the next public request must show it: page publish expires `page:<id>` **and** `routes` (a path first visited while unpublished was cached as a miss under `routes` only); `cta-bands` writes expire `collection:bands` (the tag `getCtaBand` reads, not the URL slug); media writes expire `media`; globals expire `settings:<key>`. → Task 1 `pages.test.ts` "publish invalidates…", Task 3 `globals.test.ts`, Task 4 `collections.test.ts` "cta-bands invalidate collection:bands", Task 5 `media.test.ts`.
2. **Authors and marketers writing what they may not.** An author gets 403 on every page write and on publish; an author may edit only media they uploaded; a marketer may PATCH page SEO but gets 403 when the same request changes the title. → Task 1 RBAC block, Task 5 "author edits only own media", Task 7 E2E `rbac.spec.ts`.
3. **Concurrent edits silently overwrite.** A write carrying a stale `version` returns 409 with `details.current.version` and leaves the row untouched (page draft, publish, globals, collections); the builder shows "Changed by someone else" and never autosaves over it until the editor picks Review or Overwrite. → Task 1 "stale version → 409", Task 3, Task 4, Task 7 `use-autosave.test.tsx` + E2E `conflict.spec.ts`.
4. **Drafts leak to the public.** Draft content is served only to a request in draft mode with a valid `page.read` session; the preview endpoint only redirects to internal paths (`//evil.example`, `https://evil.example`, `/\evil` → 400); an anonymous visitor sees the published page while an editor's draft differs. → Task 2 `preview.test.ts`, `preview.test.ts` (unit, `isPreviewing`), E2E `preview.spec.ts`.
5. **An invalid block reaches the published site.** Unknown block types are refused on draft save; a draft with invalid data saves (autosave) but publish returns 400 with `fieldErrors["blocks.<i>.data.<field>"]`, keeps `published` unchanged; publish also refuses duplicate block ids and references to missing or soft-deleted media. → Task 1 "publish rejects invalid drafts".

## Decisions taken for the ledger CARRY items

| Carry (source) | Decision | Task |
| --- | --- | --- |
| Routing for editor-created custom pages (P3 Task 9) | One-segment custom pages via `app/(site)/[page]/page.tsx` with sentinel `generateStaticParams` (`__page`), like `/insights/[slug]`. Named routes still win. **Cost:** an unknown *one-segment* URL becomes the soft 404 (200 + noindex) instead of a real 404; multi-segment unknown URLs stay real 404s. `cms.spec.ts` is updated to say so. | 2 |
| globals safeParse + defaults (P3 final) | `parseGlobal` uses `safeParse`, warns and falls back to the schema defaults. | 3 |
| cta/link writes validated with `LinkValue` (P3 final) | Collection schemas use `LinkValue`/`Href`; globals already use `Href`. | 4 |
| `ArticleSlug` reuse on writes (P3 Task 9) | New `lib/content/slug.ts` `Slug`; `ArticleSlug = Slug`; collections use `Slug`. | 1, 4 |
| Block ids `${kind}-${anchor}` vs uuid (P3 Task 7) | Keep seeded ids; new blocks get `crypto.randomUUID()`; `pageDocumentFor` now rejects duplicate ids. | 1 |
| Soft delete vs seed resurrection (P3 Task 7) | Pages/collections hard-delete; media soft-deletes. `seedContent()` skips when `pages` is non-empty (`--force` to override), so a re-run never resurrects deleted rows. | 4 |
| Collection rows not schema-validated pre-insert (P3 Task 7) | Test: every seeded row parses against its collection schema. | 4 |
| Media delete guard (P3 Task 7, §14) | `GET /media/:id/usage` scans pages, settings, collections, authors, articles; `DELETE` is 409 while used; publish refuses missing media. | 1, 5 |
| "Preview drafts" on the website card (P2 Task 2.5) | Link to `/api/v1/admin/preview?path=/` for `page.read`. | 2 |
| `can()` matrix rows per new route (P1 Task 1.5) | Each API task has an `it.each(ROLE_NAMES)` RBAC block written from §7.2 by hand. | 1, 3, 4, 5 |
| Server Actions must call `requireActor` (P1 Task 1.9/1.11) | Phase 4 adds **no** Server Actions; all writes go through Hono. | — |
| Rate limit for `/admin/search` if DB-backed (P2 Task 2.6) | Phase 4 adds no DB-backed ⌘K source, so no limiter yet; the carry stays open for Phase 5/11. | — |
| Author "own" rule (P1 Task 1.1) | Phase 4 owns media: authors update only rows they created. Articles stay Phase 5. | 5 |
| Clinic photo single source (P3 Task 7) | Unchanged: the `contact.clinic` block's photo; the `contact` global's `clinic.photo` stays unused in the editor (field shown with a note). | 8 |

Other decisions: draft autosaves are **not** audited (one row per 1.2 s would drown the log; publish, discard, restore, create, delete and SEO are); page SEO/title/settings go live on save via `PATCH /:id/seo`, merge per field and do **not** bump `version` (so a marketer's SEO edit never 409s an editor's builder session); media has no `version` column and PATCHes are last-write-wins (no migration this phase); globals with dedicated endpoints (`tracking`, `consent`, `scripts`, `theme`) answer 404 on the generic route; `seo` is served by the generic route now (Phase 7 builds its screen). No migration is needed: `pages.version`, `revisions`, `settings.version`, collection `version` and `media.deleted_at` already exist.

---

## File structure

| Path | Responsibility | Task |
| --- | --- | --- |
| `server/api/errors.ts` (modify) | `details` on `ApiError`/envelope; `invalid()` with dotted field paths | 1 |
| `server/lib/conflict.ts` | `conflictError()` (409 with current version + editor name), `isUniqueViolation()`, `topLevelDiff()` | 1 |
| `server/lib/revisions.ts` | write + prune (50 pages / 20 settings), list, find, delete revisions | 1 |
| `server/db/client.ts`, `server/lib/audit.ts` (modify) | `Tx`/`DbLike` so services audit inside transactions | 1 |
| `lib/content/slug.ts`, `lib/content/article-slug.ts` (modify) | shared `Slug` | 1 |
| `lib/content/page-path.ts` | `CustomPagePath`, `PreviewPath`, `NewPageInput`, reserved segments, shell sentinel | 1 |
| `blocks/registry.ts`, `blocks/page.ts` (modify) | `BlockId`, duplicate-id rule, `DraftDocument`, `PageMetaPatch`, `kindOf` | 1 |
| `server/modules/pages/{schema,service,routes}.ts` | Pages API | 1 |
| `server/modules/preview/routes.ts` | enable/exit draft mode | 2 |
| `server/modules/content/preview.ts` | `isPreviewing()` | 2 |
| `server/modules/content/queries.ts`, `app/(site)/_cms/{cms-page,site-frame}.tsx` (modify) | draft as an argument; preview bar | 2 |
| `app/(site)/[page]/page.tsx`, `components/preview-bar.tsx` | custom pages; preview bar | 2 |
| `lib/content/global-access.ts` | editable keys, per-key permissions, settings pages map | 3 |
| `server/modules/globals/{service,routes}.ts` | Globals API | 3 |
| `lib/content/collections.ts` | collection names + Zod schemas (isomorphic) | 4 |
| `server/modules/collections/{registry,usage,service,routes}.ts` | Collections API | 4 |
| `server/db/seed/index.ts`, `scripts/seed.ts` (modify) | skip when seeded | 4 |
| `server/lib/media/{sniff,process,storage}.ts`, `server/modules/media/{usage,service,routes}.ts` | upload pipeline, drivers, Media API | 5 |
| `app/uploads/[...key]/route.ts` | serves the `local` driver | 5 |
| `server/env.ts`, `next.config.ts`, `server/api/app.ts` (modify) | media env, image patterns, 20 MB upload limit | 5 |
| `admin/components/schema-form/*` (modify + `field-ui.ts`, `widgets/*`) | new widgets, nullable/union handling, object lists, `emptyValue` | 6 |
| `admin/lib/{api,api-error,query-keys}.ts` (modify) | clients, `details`, keys | 1, 3–7 |
| `admin/modules/{pages,media,collections}/queries.ts` | query options used by widgets and screens | 6 |
| `admin/modules/pages/*`, `app/(admin)/admin/(panel)/pages/**` | pages list + builder | 7 |
| `admin/modules/{collections,globals}/*`, `app/(admin)/admin/(panel)/{collections,settings}/**` | collection and settings screens | 8 |
| `admin/modules/media/*`, `app/(admin)/admin/(panel)/media/page.tsx`, `lib/content/frame.ts` (modify) | media library, focal picker, frame cropper | 9 |
| `tests/integration/helpers/{auth,content}.ts`, `tests/support/gps-jpeg.ts`, `tests/e2e/support/api.ts` | shared test helpers | 1, 2, 5 |

## Conventions for executing this plan

- Code blocks are written compactly to keep the plan short. Run `pnpm prettier --write <touched files>` before every commit; the Prettier rules above are the source of truth.
- Where a step gives a component as a spec (props, API call, labels) rather than code, the quoted labels are load-bearing: E2E specs select by them.

## Integration-test conventions (every API task)

- `invalidate()` calls `revalidateTag`, which needs a Next request store. Mock it per file, keeping the rest of `next/cache`:

```ts
const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))
const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
```

- Requests go through `adminRequest(path, cookie, { method, body })` (`tests/integration/helpers/auth.ts`); cookies come from `cookieFor(role)` (added in Task 1).
- `beforeEach(resetDb)`, `afterAll(closeDb)`, and `next.revalidateTag.mockReset()` in `beforeEach`.

---
### Task 1: Write-path foundation and the Pages API

**Files:**
- Modify: `server/api/errors.ts`, `admin/lib/api-error.ts`, `admin/lib/api.ts` (envelope `details`), `server/db/client.ts`, `server/lib/audit.ts`, `blocks/registry.ts`, `blocks/page.ts`, `lib/content/article-slug.ts`, `server/api/routes/admin.ts`, `tests/integration/helpers/auth.ts`
- Create: `server/lib/conflict.ts`, `server/lib/revisions.ts`, `lib/content/slug.ts`, `lib/content/page-path.ts`, `server/modules/pages/schema.ts`, `server/modules/pages/service.ts`, `server/modules/pages/routes.ts`, `tests/integration/helpers/content.ts`
- Test: `blocks/page.test.ts` (extend), `tests/content/page-path.test.ts`, `server/api/errors.test.ts` (extend), `tests/integration/api/pages.test.ts`

**Interfaces:**
- Consumes: `can()`, `validationHook`, `audit()`, `invalidate()`/`tags`, `pageDocumentFor`, `collectMediaIds`.
- Produces:
  - `new ApiError(code, message, fieldErrors?, details?)`; `invalid(error: z.core.$ZodError, message?)`.
  - `conflictError(db: DbLike, current: { version: number; updatedAt: Date | null; updatedBy: string | null }): Promise<ApiError>` → 409 envelope `error.details.current = { version, updatedAt: string | null, updatedBy: string | null }` (editor name).
  - `isUniqueViolation(error: unknown): boolean`, `topLevelDiff(before: unknown, after: unknown)`.
  - `writeRevision(db, { entityType: "page" | "setting"; entityId; version; snapshot; createdBy; note? })`, `listRevisions(db, type, id) → { items: { id, version, note, createdAt, createdBy: string | null }[] }`, `findRevision(db, type, id, revisionId)`, `deleteRevisions(db, type, id)`.
  - `type Tx`, `type DbLike = Db | Tx` (from `server/db/client.ts`).
  - `Slug`, `CustomPagePath`, `PreviewPath`, `NewPageInput`, `RESERVED_SEGMENTS`, `PAGE_SHELL_SEGMENT = "__page"`.
  - `BlockId`, `DraftBlock`, `DraftDocument`, `PageMetaPatch`, `kindOf(systemKey)`.
  - `PagesRoutes` (mounted at `/api/v1/admin/pages`): `GET /` → `{ items: PageSummary[], page, pageSize, total }` where `PageSummary = { id, path, title, status, systemKey, updatedAt, publishedAt, hasUnpublishedChanges, anchors: string[], needsReview }`; `POST /` `{ path, title }` → 201 `{ id, path }`; `GET /:id` → `{ id, path, title, status, systemKey, kind, draft, seo, settings, version, updatedAt, publishedAt, hasUnpublishedChanges, updatedBy }`; `PATCH /:id/draft` `{ version, document }` → `{ version, updatedAt }`; `PATCH /:id/seo` `PageMetaPatch` → `{ title, seo, settings }`; `POST /:id/publish` `{ version }` → `{ version, publishedAt }`; `POST /:id/discard` `{ version }` → `{ version }`; `GET /:id/revisions`; `POST /:id/revisions/:rev/restore` `{ version }` → `{ version }`; `DELETE /:id` → `{ ok: true }`.
  - Test helpers: `cookieFor(role, email?)`, `insertMedia(overrides?)`, `insertPage({ path, systemKey?, document, published? })`, `heroDocument(mediaId, title?)`.

- [ ] **Step 1: Write the failing unit tests**

Append to `blocks/page.test.ts` (merge the import into the file's import block):

```ts
import { DraftDocument, kindOf, PageMetaPatch, pageDocumentFor } from "./page"

const hero = (id: string) => ({ id, type: "hero.page", anchor: "home", chapter: "Welcome", hidden: false,
  joinPrevious: false, data: { title: "T", subtitle: "S",
    image: { mediaId: "00000000-0000-4000-8000-000000000001" }, focal: null, tint: 0.3, mirror: false } })

describe("page documents (Phase 4)", () => {
  it("rejects two blocks with the same id", () => {
    const badges = { ...hero("dup-1"), type: "credibility", anchor: "trust", data: {
        badges: [1, 2, 3].map((n) => ({ title: `B${n}`, subtitle: "S", icon: "shield" })) } }
    const result = pageDocumentFor("custom").safeParse({ blocks: [hero("dup-1"), badges] })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.path.join("."))).toContain("blocks.1.id") })
  it("lets a draft hold half-finished data but not unknown block types", () => {
    const draft = { blocks: [{ ...hero("abcd"), data: { title: "" } }] }
    expect(DraftDocument.safeParse(draft).success).toBe(true)
    expect(DraftDocument.safeParse({ blocks: [{ ...hero("abcd"), type: "x" }] })
        .success
    ).toBe(false) })
  it("maps system keys to page kinds", () => {
    expect(kindOf("about")).toBe("about")
    expect(kindOf(null)).toBe("custom")
    expect(kindOf("nope")).toBe("custom") })
  it("needs at least one change in a meta patch", () => {
    expect(PageMetaPatch.safeParse({}).success).toBe(false)
    expect(PageMetaPatch.safeParse({ seo: { noindex: true } }).success).toBe(true) }) })
```

Create `tests/content/page-path.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { CustomPagePath, PreviewPath } from "@/lib/content/page-path"

describe("page paths", () => {
  it.each(["/privacy-policy", "/team"])("accepts custom page %s", (p) =>
    expect(CustomPagePath.safeParse(p).success).toBe(true))
  it.each(["/admin", "/api", "/uploads", "/insights", "/a/b", "/__page", "/Team", "/"])(
    "refuses custom page %s", (p) => expect(CustomPagePath.safeParse(p).success).toBe(false))
  it.each(["/", "/about", "/insights/calm-is-a-skill"])("previews internal path %s",
    (p) => expect(PreviewPath.safeParse(p).success).toBe(true))
  it.each(["//evil.example", "/\\evil", "https://evil.example", "/a?b=1", "about"])(
    "refuses preview target %s", (p) => expect(PreviewPath.safeParse(p).success).toBe(false)) })
```

Append to `server/api/errors.test.ts` (merge `ApiError, errorBody` into its existing import):

```ts
describe("error details", () => {
  it("carries machine-readable details in the envelope", () => {
    const error = new ApiError("CONFLICT", "Changed", undefined, { current: { version: 3 } })
    expect(errorBody(error.code, error.message, "r1", undefined, error.details)
    ).toEqual({ error: { code: "CONFLICT", message: "Changed", requestId: "r1",
        details: { current: { version: 3 } } } }) }) })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run --project unit blocks/page.test.ts tests/content/page-path.test.ts server/api/errors.test.ts`
Expected: FAIL (`DraftDocument`/`kindOf` not exported, `lib/content/page-path` missing, `errorBody` takes 4 args).

- [ ] **Step 3: Implement the shared pieces**

`server/api/errors.ts` — change the class, `errorBody` and `handleError`, and add `invalid()`:

```ts
export class ApiError extends Error {
  constructor(readonly code: ErrorCode, message: string, readonly fieldErrors?: Record<string, string[]>,
    // Machine-readable context, e.g. a 409's current version (§8.2).
    readonly details?: Record<string, unknown>
  ) {
    super(message)
  }

  get status() {
    return STATUS[this.code]
  }
}

export function errorBody(code: ErrorCode, message: string, requestId: string,
  fieldErrors?: Record<string, string[]>, details?: Record<string, unknown>
) {
  return { error: { code, message, requestId, ...(fieldErrors && { fieldErrors }),
      ...(details && { details }) } }
}

// In handleError, the ApiError branch becomes:
//   errorBody(error.code, error.message, requestId, error.fieldErrors, error.details)

// Dotted paths ("blocks.3.data.title") so the builder can find the block and
// the field; flattenError only keeps the first segment.
export function invalid(error: z.core.$ZodError, message = "Some fields need attention"
) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_"
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return new ApiError("VALIDATION_FAILED", message, fieldErrors)
}
```

`admin/lib/api-error.ts` — add a sixth constructor parameter `readonly details: Record<string, unknown> | null = null`. In `admin/lib/api.ts` add `details?: unknown` to `Envelope["error"]`, and in `fromStatus` compute

```ts
const details =
  known && typeof envelope?.details === "object" && envelope.details !== null
    ? (envelope.details as Record<string, unknown>)
    : null
return new ApiError(code, message, status, requestId, fieldErrors, details)
```

`server/db/client.ts` — append:

```ts
// What a callback of db.transaction() receives. Services pass either one to
// helpers (audit, revisions) so a write and its audit row commit together.
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]
export type DbLike = Db | Tx
```

`server/lib/audit.ts` — import `type DbLike` instead of `type Db` and type the parameter `db: DbLike = getDb()`.

`server/lib/conflict.ts`:

```ts
import "server-only"

import { eq } from "drizzle-orm"

import { ApiError } from "@/server/api/errors"
import type { DbLike } from "@/server/db/client"
import { users } from "@/server/db/schema"

export async function userName(db: DbLike, id: string | null) {
  if (!id) return null
  const [row] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  return row?.name ?? null
}

// docs/brief.md §6.5: a stale version gets 409 with the current state, so
// the UI can offer "review / overwrite".
export async function conflictError(db: DbLike,
  current: { version: number; updatedAt: Date | null; updatedBy: string | null }
) {
  return new ApiError("CONFLICT", "Someone else changed this after you opened it", undefined, { current: {
        version: current.version, updatedAt: current.updatedAt?.toISOString() ?? null,
        updatedBy: await userName(db, current.updatedBy) } })
}

// Postgres 23505, possibly wrapped by the driver or Drizzle.
export function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error, i = 0;
    e && i < 5;
    i++, e = (e as { cause?: unknown }).cause
  ) {
    if ((e as { code?: unknown }).code === "23505") return true
  }
  return false
}

// Audit diffs at the first level: enough to see what moved, small enough
// to keep in the log.
export function topLevelDiff(before: unknown, after: unknown) {
  const a = (before ?? {}) as Record<string, unknown>
  const b = (after ?? {}) as Record<string, unknown>
  const diff: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      diff[key] = { from: a[key] ?? null, to: b[key] ?? null }
    }
  }
  return diff
}
```

`server/lib/revisions.ts`:

```ts
import "server-only"

import { and, desc, eq, notInArray } from "drizzle-orm"

import type { DbLike } from "@/server/db/client"
import { revisions, users } from "@/server/db/schema"

// docs/brief.md §6.5: 50 publish snapshots per page, 20 per global.
export const REVISION_LIMITS = { page: 50, setting: 20 } as const
export type RevisionEntity = keyof typeof REVISION_LIMITS

const of = (entityType: RevisionEntity, entityId: string) =>
  and(eq(revisions.entityType, entityType), eq(revisions.entityId, entityId))

// Rows written in one transaction share created_at, so version breaks ties.
const newestFirst = [desc(revisions.createdAt), desc(revisions.version)]

export async function writeRevision(db: DbLike, entry: { entityType: RevisionEntity
    entityId: string
    version: number
    snapshot: unknown
    createdBy: string
    note?: string | null
  }
) {
  await db.insert(revisions).values({ ...entry, note: entry.note ?? null })
  const keep = db
    .select({ id: revisions.id })
    .from(revisions)
    .where(of(entry.entityType, entry.entityId))
    .orderBy(...newestFirst)
    .limit(REVISION_LIMITS[entry.entityType])
  await db
    .delete(revisions)
    .where(and(of(entry.entityType, entry.entityId), notInArray(revisions.id, keep)))
}

export async function listRevisions(db: DbLike, entityType: RevisionEntity, entityId: string
) {
  const items = await db
    .select({ id: revisions.id, version: revisions.version, note: revisions.note,
      createdAt: revisions.createdAt, createdBy: users.name })
    .from(revisions)
    .leftJoin(users, eq(revisions.createdBy, users.id))
    .where(of(entityType, entityId))
    .orderBy(...newestFirst)
  return { items }
}

export async function findRevision(db: DbLike, entityType: RevisionEntity, entityId: string, id: string
) {
  const [row] = await db
    .select()
    .from(revisions)
    .where(and(of(entityType, entityId), eq(revisions.id, id)))
    .limit(1)
  return row ?? null
}

export async function deleteRevisions(db: DbLike, entityType: RevisionEntity, entityId: string
) {
  await db.delete(revisions).where(of(entityType, entityId))
}
```

`lib/content/slug.ts`:

```ts
import * as z from "zod"

// docs/brief.md §8.2: slugs match ^[a-z0-9]+(-[a-z0-9]+)*$ in every table.
export const Slug = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case kebab-case, e.g. calm-is-a-skill")
```

`lib/content/article-slug.ts` — keep `ARTICLE_SHELL_SLUG`; replace the schema with `export const ArticleSlug = Slug` (import from `./slug`).

`lib/content/page-path.ts`:

```ts
import * as z from "zod"

// First segments the platform or a named route already owns. Custom pages
// live one segment deep (app/(site)/[page]); system pages keep their routes.
export const RESERVED_SEGMENTS = ["admin", "api", "uploads", "images", "insights"] as const

// The [page] route's build shell. The pattern below cannot produce it.
export const PAGE_SHELL_SEGMENT = "__page"

export const CustomPagePath = z
  .string()
  .trim()
  .max(61)
  .regex(/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use one lower-case segment, e.g. /team")
  .refine((path) => !(RESERVED_SEGMENTS as readonly string[]).includes(path.slice(1)),
    "That address is reserved")

// Where the preview endpoint may send a browser: a site path, never another
// origin ("//x", "/\x", "https://x") and no query string.
export const PreviewPath = z
  .string()
  .max(200)
  .regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/,
    "Use an internal path, e.g. /about")

export const NewPageInput = z.object({ path: CustomPagePath, title: z.string().trim().min(1).max(80) })
export type NewPageInput = z.infer<typeof NewPageInput>
```

`blocks/registry.ts` — export the id schema and use it in `base`:

```ts
// Stable across edits so the editor can follow a block. Seeded ids are
// "<page>-<anchor>"; the builder mints crypto.randomUUID() (36 characters),
// which this pattern accepts.
export const BlockId = z.string().regex(/^[A-Za-z0-9_-]{4,48}$/)
```

…and `id: BlockId,` inside `base`.

`blocks/page.ts` — change the imports to `import { PAGE_KINDS, type PageKind } from "./define-block"` and `import { BLOCKS, BLOCK_BY_TYPE, BlockId, BlockInstance, type BlockType } from "./registry"`; inside `pageDocumentFor`'s `superRefine` add a `const ids = new Set<string>()` next to `seen`, and as the first check in the loop:

```ts
      if (ids.has(block.id)) issue("Two blocks share this id", "id")
      ids.add(block.id)
```

Append:

```ts
export function kindOf(systemKey: string | null): PageKind {
  return systemKey !== null &&
    (PAGE_KINDS as readonly string[]).includes(systemKey)
    ? (systemKey as PageKind)
    : "custom"
}

const BLOCK_TYPES = BLOCKS.map((block) => block.type) as [BlockType, ...BlockType[]]

// The working copy autosave writes (docs/brief.md §6.5): known block types
// with any data object, so half-finished edits save. Publish is where
// pageDocumentFor applies the full schema; the site's draft reader drops
// blocks that do not parse.
export const DraftBlock = z.object({ id: BlockId, type: z.enum(BLOCK_TYPES), anchor: z.string().max(40),
  chapter: z.string().max(24).nullable(), hidden: z.boolean(), joinPrevious: z.boolean(),
  data: z.record(z.string(), z.unknown()) })
export type DraftBlock = z.infer<typeof DraftBlock>
export const DraftDocument = z.object({ blocks: z.array(DraftBlock).max(40) })
export type DraftDocument = z.infer<typeof DraftDocument>

// Live on save (docs/brief.md §6.5): merged field by field.
export const PageMetaPatch = z
  .object({ title: z.string().trim().min(1).max(80).optional(), seo: z
      .object({ title: z.string().trim().max(70).nullable().optional(),
        description: z.string().trim().max(200).nullable().optional(),
        ogImage: MediaRef.nullable().optional(), noindex: z.boolean().optional() })
      .strict()
      .optional(), settings: z
      .object({ showContactChapter: z.boolean().optional() })
      .strict()
      .optional() })
  .refine((v) => v.title !== undefined || v.seo !== undefined || v.settings !== undefined, "Nothing to change"
  )
export type PageMetaPatch = z.infer<typeof PageMetaPatch>
```

- [ ] **Step 4: Run the unit tests**

Run: `pnpm vitest run --project unit blocks tests/content server/api`
Expected: PASS (existing `ArticleSlug` tests still pass: same pattern and message).

- [ ] **Step 5: Write the failing integration test**

`tests/integration/helpers/auth.ts` — append:

```ts
// A signed-in user of `role`; owners and admins get past the 2FA gate.
export async function cookieFor(role: RoleName, email = `${role}@example.com`) {
  await createUser(role, email)
  return role === "owner" || role === "admin"
    ? signInWithTwoFactor(email)
    : signIn(email)
}
```

`tests/integration/helpers/content.ts`:

```ts
import { getDb } from "@/server/db/client"
import { media, pages } from "@/server/db/schema"

export async function insertMedia(overrides: Partial<typeof media.$inferInsert> = {}
) {
  const [row] = await getDb()
    .insert(media)
    .values({ driver: "static", key: `/images/test-${crypto.randomUUID()}.png`,
      url: "/images/hero/hero-bg.png", filename: "test.png", mimeType: "image/png", sizeBytes: 1, width: 10,
      height: 10, ...overrides })
    .returning()
  return row!
}

export const heroDocument = (mediaId: string, title = "Hello") => ({ blocks: [{ id: "custom-home",
      type: "hero.page" as const, anchor: "home", chapter: "Welcome", hidden: false, joinPrevious: false,
      data: { title, subtitle: "Sub", image: { mediaId }, focal: null, tint: 0.3, mirror: false } }] })

type Doc = (typeof pages.$inferInsert)["draft"]

export async function insertPage(values: { path: string
  systemKey?: string | null
  document: unknown
  published?: boolean
}) {
  const document = values.document as Doc
  const [row] = await getDb()
    .insert(pages)
    .values({ path: values.path, title: "Test page", systemKey: values.systemKey ?? null,
      status: values.published ? "published" : "draft", draft: document,
      published: values.published ? document : null })
    .returning()
  return row!
}
```

`tests/integration/api/pages.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag }))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { media, pages, revisions } from "@/server/db/schema"
import { writeRevision } from "@/server/lib/revisions"

import { adminRequest, cookieFor } from "../helpers/auth"
import { heroDocument, insertMedia, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset() })
afterAll(closeDb)

const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const json = (r: Response) => r.json()

async function aboutPage() {
  const asset = await insertMedia()
  const page = await insertPage({ path: "/about", systemKey: "about",
    document: heroDocument(asset.id, "Published"), published: true })
  return { asset, page }
}

// Written from docs/brief.md §7.2, not derived from the role definitions.
const MATRIX: Record<RoleName, { read: number; publish: number }> = { owner: { read: 200, publish: 200 },
  admin: { read: 200, publish: 200 }, editor: { read: 200, publish: 200 },
  author: { read: 200, publish: 403 }, marketer: { read: 200, publish: 403 },
  intake: { read: 403, publish: 403 }, viewer: { read: 200, publish: 403 } }

describe.each(ROLE_NAMES)("pages RBAC for %s", (role) => {
  it(`GET /pages → ${MATRIX[role].read}, publish → ${MATRIX[role].publish}`, async () => {
    const { page } = await aboutPage()
    const cookie = await cookieFor(role)
    expect((await adminRequest("/pages", cookie)).status).toBe(MATRIX[role].read)
    const publish = await adminRequest(`/pages/${page.id}/publish`, cookie, { method: "POST",
      body: { version: page.version } })
    expect(publish.status).toBe(MATRIX[role].publish) }) })

describe("pages API", () => {
  it("autosaves a draft and 409s a stale version, keeping the newer draft", async () => {
    const { asset, page } = await aboutPage()
    const cookie = await cookieFor("editor")
    const first = await adminRequest(`/pages/${page.id}/draft`, cookie, { method: "PATCH",
      body: { version: 1, document: heroDocument(asset.id, "Mine") } })
    expect(first.status).toBe(200)
    expect((await json(first)).version).toBe(2)

    const stale = await adminRequest(`/pages/${page.id}/draft`, cookie, { method: "PATCH",
      body: { version: 1, document: heroDocument(asset.id, "Theirs") } })
    expect(stale.status).toBe(409)
    const body = await json(stale)
    expect(body.error.code).toBe("CONFLICT")
    expect(body.error.details.current).toMatchObject({ version: 2, updatedBy: "editor" })
    const [row] = await getDb().select().from(pages).where(eq(pages.id, page.id))
    expect(JSON.stringify(row!.draft)).toContain("Mine")
    // Drafts are not public: nothing to expire.
    expect(expired()).toEqual([]) })

  it("refuses unknown block types on save", async () => {
    const { page } = await aboutPage()
    const response = await adminRequest(`/pages/${page.id}/draft`, await cookieFor("editor"), {
      method: "PATCH",
      body: { version: 1, document: { blocks: [{ ...heroDocument("x").blocks[0], type: "evil" }] } } })
    expect(response.status).toBe(400) })

  it("publish rejects invalid drafts and keeps the published copy", async () => {
    const { asset, page } = await aboutPage()
    const cookie = await cookieFor("editor")
    await adminRequest(`/pages/${page.id}/draft`, cookie, { method: "PATCH",
      body: { version: 1, document: heroDocument(asset.id, "") } })
    const response = await adminRequest(`/pages/${page.id}/publish`, cookie, { method: "POST",
      body: { version: 2 } })
    expect(response.status).toBe(400)
    expect((await json(response)).error.fieldErrors).toHaveProperty(["blocks.0.data.title"])
    const [row] = await getDb().select().from(pages).where(eq(pages.id, page.id))
    expect(JSON.stringify(row!.published)).toContain("Published")
    expect(expired()).toEqual([]) })

  it("publish refuses images that were deleted", async () => {
    const { asset, page } = await aboutPage()
    await getDb().update(media).set({ deletedAt: new Date() }).where(eq(media.id, asset.id))
    const response = await adminRequest(`/pages/${page.id}/publish`, await cookieFor("editor"), {
      method: "POST", body: { version: 1 } })
    expect(response.status).toBe(400) })

  it("publish invalidates the page and routes, snapshots, and restore loads a snapshot", async () => {
    const { asset, page } = await aboutPage()
    const cookie = await cookieFor("editor")
    const publish = (version: number) =>
      adminRequest(`/pages/${page.id}/publish`, cookie, { method: "POST", body: { version } })
    expect((await publish(1)).status).toBe(200)
    expect(expired()).toEqual(expect.arrayContaining([`page:${page.id}`, "routes"]))

    await adminRequest(`/pages/${page.id}/draft`, cookie, { method: "PATCH",
      body: { version: 2, document: heroDocument(asset.id, "Second") } })
    expect((await publish(3)).status).toBe(200)

    const list = await json(await adminRequest(`/pages/${page.id}/revisions`, cookie))
    expect(list.items).toHaveLength(2)
    const oldest = list.items.at(-1)
    const restored = await adminRequest(`/pages/${page.id}/revisions/${oldest.id}/restore`, cookie,
      { method: "POST", body: { version: 4 } })
    expect(restored.status).toBe(200)
    const detail = await json(await adminRequest(`/pages/${page.id}`, cookie))
    expect(JSON.stringify(detail.draft)).toContain("Published")
    expect(detail.hasUnpublishedChanges).toBe(true) })

  it("keeps the newest 50 page revisions", async () => {
    const { page } = await aboutPage()
    const { id: userId } = (await json(await adminRequest("/me", await cookieFor("editor")))).user
    for (let v = 1; v <= 52; v++) {
      await writeRevision(getDb(), { entityType: "page", entityId: page.id, version: v, snapshot: {}, createdBy: userId })
    }
    const rows = await getDb().select().from(revisions).where(eq(revisions.entityId, page.id))
    expect(rows).toHaveLength(50)
    expect(Math.min(...rows.map((r) => r.version))).toBe(3) })

  it("creates and deletes custom pages, never system ones", async () => {
    const { page: about } = await aboutPage()
    const cookie = await cookieFor("editor")
    const create = (path: string) =>
      adminRequest("/pages", cookie, { method: "POST", body: { path, title: "Team" } })
    expect((await create("/admin")).status).toBe(400)
    const created = await create("/team")
    expect(created.status).toBe(201)
    expect(expired()).toContain("routes")
    expect((await create("/team")).status).toBe(409)

    const { id } = await json(created)
    expect((await adminRequest(`/pages/${about.id}`, cookie, { method: "DELETE" })).status).toBe(403)
    next.revalidateTag.mockReset()
    expect((await adminRequest(`/pages/${id}`, cookie, { method: "DELETE" })).status).toBe(200)
    expect(expired()).toEqual(expect.arrayContaining([`page:${id}`, "routes"])) })

  it("lets a marketer change SEO but not the title", async () => {
    const { page } = await aboutPage()
    const cookie = await cookieFor("marketer")
    const seo = await adminRequest(`/pages/${page.id}/seo`, cookie, { method: "PATCH",
      body: { seo: { description: "New description" } } })
    expect(seo.status).toBe(200)
    expect((await json(seo)).seo.description).toBe("New description")
    expect(expired()).toContain(`page:${page.id}`)
    const title = await adminRequest(`/pages/${page.id}/seo`, cookie, { method: "PATCH",
      body: { title: "Hijacked", seo: { noindex: true } } })
    expect(title.status).toBe(403) }) })
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm test:integration tests/integration/api/pages.test.ts`
Expected: FAIL (404 for `/pages`).

- [ ] **Step 7: Implement the pages module**

`server/modules/pages/schema.ts`:

```ts
import "server-only"

import * as z from "zod"

import { DraftDocument } from "@/blocks/page"

export { NewPageInput as CreatePageInput } from "@/lib/content/page-path"
export { PageMetaPatch } from "@/blocks/page"

export const PageIdParam = z.object({ id: z.uuid() })
export const RevisionParam = z.object({ id: z.uuid(), rev: z.uuid() })
export const VersionInput = z.object({ version: z.number().int().min(1) })
export const DraftInput = VersionInput.extend({ document: DraftDocument })
```

`server/modules/pages/service.ts`:

```ts
import "server-only"

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm"

import { collectMediaIds } from "@/blocks/media-refs"
import { kindOf, pageDocumentFor, type DraftDocument, type PageDocument, type PageMetaPatch,
} from "@/blocks/page"
import { hasPermission } from "@/lib/auth/permissions"
import type { NewPageInput } from "@/lib/content/page-path"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { media, pages } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { conflictError, userName } from "@/server/lib/conflict"
import { deleteRevisions, findRevision, listRevisions, writeRevision } from "@/server/lib/revisions"

const changedSincePublish = sql<boolean>`${pages.draft} is distinct from ${pages.published}`
// Section ids in the working copy, for the link widget's anchor picker.
const draftAnchors = sql<string[]>`coalesce((select jsonb_agg(b->>'anchor') from jsonb_array_elements(${pages.draft}->'blocks') as b), '[]'::jsonb)`

export async function listPages() {
  const rows = await getDb()
    .select({ id: pages.id, path: pages.path, title: pages.title, status: pages.status,
      systemKey: pages.systemKey, updatedAt: pages.updatedAt, publishedAt: pages.publishedAt,
      settings: pages.settings, hasUnpublishedChanges: changedSincePublish, anchors: draftAnchors })
    .from(pages)
    .orderBy(asc(pages.path))
  const items = rows.map(({ settings, ...row }) => ({ ...row, needsReview: settings.needsReview === true }))
  return { items, page: 1, pageSize: items.length, total: items.length }
}

async function findPage(db: DbLike, id: string, lock = false) {
  const query = db.select().from(pages).where(eq(pages.id, id)).limit(1)
  const [row] = lock ? await query.for("update") : await query
  if (!row) throw new ApiError("NOT_FOUND", "That page doesn't exist")
  return row
}

// Optimistic lock (docs/brief.md §6.5): the write lands only on the version
// the editor started from; otherwise 409 with the current one.
async function writeIfVersion(db: DbLike, id: string, version: number, set: Partial<typeof pages.$inferInsert>
) {
  const [row] = await db
    .update(pages)
    .set({ ...set, version: sql`${pages.version} + 1` })
    .where(and(eq(pages.id, id), eq(pages.version, version)))
    .returning()
  if (row) return row
  throw await conflictError(db, await findPage(db, id))
}

export async function getPage(id: string) {
  const db = getDb()
  const row = await findPage(db, id)
  return { id: row.id, path: row.path, title: row.title, status: row.status, systemKey: row.systemKey,
    kind: kindOf(row.systemKey), draft: row.draft, seo: row.seo, settings: row.settings, version: row.version,
    updatedAt: row.updatedAt, publishedAt: row.publishedAt,
    // Both sides come from jsonb, so key order is canonical.
    hasUnpublishedChanges:
      JSON.stringify(row.draft) !== JSON.stringify(row.published),
    updatedBy: await userName(db, row.updatedBy) }
}

// Autosave runs every ~1.2 s, so it is not audited: publish, discard,
// restore, create, delete and SEO changes are the audited events.
export async function saveDraft(actor: Actor, id: string, input: { version: number; document: DraftDocument }
) {
  const row = await writeIfVersion(getDb(), id, input.version, {
    // A draft may be half-finished; publish validates it fully.
    draft: input.document as unknown as PageDocument, updatedBy: actor.userId })
  return { version: row.version, updatedAt: row.updatedAt }
}

async function assertMediaExists(db: DbLike, ids: string[]) {
  if (ids.length === 0) return
  const found = await db
    .select({ id: media.id })
    .from(media)
    .where(and(inArray(media.id, ids), isNull(media.deletedAt)))
  const missing = ids.filter((id) => !found.some((row) => row.id === id))
  if (missing.length > 0) {
    throw new ApiError("VALIDATION_FAILED", "Some images were deleted. Choose new ones before publishing.",
      { _media: missing.map((id) => `Image ${id} no longer exists`) })
  }
}

export async function publishPage(actor: Actor, id: string, version: number) {
  const saved = await getDb().transaction(async (tx) => {
    const row = await findPage(tx, id, true)
    if (row.version !== version) throw await conflictError(tx, row)
    const parsed = pageDocumentFor(kindOf(row.systemKey)).safeParse(row.draft)
    if (!parsed.success) {
      throw invalid(parsed.error, "Fix the highlighted blocks before publishing")
    }
    await assertMediaExists(tx, collectMediaIds(parsed.data))
    const [next] = await tx
      .update(pages)
      .set({ draft: parsed.data, published: parsed.data, status: "published", publishedAt: new Date(),
        publishedBy: actor.userId, updatedBy: actor.userId, settings: { ...row.settings, needsReview: false },
        version: sql`${pages.version} + 1` })
      .where(eq(pages.id, id))
      .returning()
    await writeRevision(tx, { entityType: "page", entityId: id, version: next!.version, snapshot: parsed.data,
      createdBy: actor.userId })
    await audit(actor, { action: "page.publish", entityType: "page", entityId: id,
        summary: `Published ${row.path}` }, tx)
    return next! })
  // `routes` too: a visit while unpublished cached a miss under routes only.
  invalidate([tags.page(id), tags.routes])
  return { version: saved.version, publishedAt: saved.publishedAt }
}

export async function discardDraft(actor: Actor, id: string, version: number) {
  const db = getDb()
  const current = await findPage(db, id)
  if (!current.published) {
    throw new ApiError("BAD_REQUEST", "This page has never been published")
  }
  const row = await writeIfVersion(db, id, version, { draft: current.published, updatedBy: actor.userId })
  await audit(actor, { action: "page.discard", entityType: "page", entityId: id,
    summary: `Discarded unpublished changes on ${row.path}` })
  return { version: row.version }
}

export async function restoreRevision(actor: Actor, id: string, revisionId: string, version: number
) {
  const db = getDb()
  const revision = await findRevision(db, "page", id, revisionId)
  if (!revision) throw new ApiError("NOT_FOUND", "That version doesn't exist")
  const row = await writeIfVersion(db, id, version, { draft: revision.snapshot as PageDocument,
    updatedBy: actor.userId })
  await audit(actor, { action: "page.restore", entityType: "page", entityId: id,
    summary: `Loaded version ${revision.version} of ${row.path} into the draft` })
  return { version: row.version }
}

export async function updateMeta(actor: Actor, id: string, patch: PageMetaPatch) {
  if (patch.seo && !hasPermission(actor.roles, { seo: ["update"] })) {
    throw new ApiError("FORBIDDEN", "You can't change SEO settings")
  }
  if ((patch.title !== undefined || patch.settings) &&
    !hasPermission(actor.roles, { page: ["update"] })
  ) {
    throw new ApiError("FORBIDDEN", "You can't change this page")
  }
  const db = getDb()
  const before = await findPage(db, id)
  const merge = (column: typeof pages.seo | typeof pages.settings, value?: object) =>
    value ? sql`${column} || ${JSON.stringify(value)}::jsonb` : undefined
  // Field-level merge, no version bump: SEO edits never conflict with an
  // editor's builder session.
  const [row] = await db
    .update(pages)
    .set({ title: patch.title, seo: merge(pages.seo, patch.seo),
      settings: merge(pages.settings, patch.settings), updatedBy: actor.userId })
    .where(eq(pages.id, id))
    .returning()
  const diff: Record<string, { from: unknown; to: unknown }> = {}
  if (patch.title !== undefined) diff.title = { from: before.title, to: patch.title }
  for (const [key, to] of Object.entries(patch.seo ?? {})) {
    diff[`seo.${key}`] = { from: (before.seo as Record<string, unknown>)[key] ?? null, to }
  }
  for (const [key, to] of Object.entries(patch.settings ?? {})) {
    diff[`settings.${key}`] = { from: (before.settings as Record<string, unknown>)[key] ?? null, to }
  }
  await audit(actor, { action: "page.meta", entityType: "page", entityId: id,
    summary: `Updated SEO and settings of ${before.path}`, diff })
  invalidate([tags.page(id)])
  return { title: row!.title, seo: row!.seo, settings: row!.settings }
}

export async function createPage(actor: Actor, input: NewPageInput) {
  const document: PageDocument = { blocks: [{ id: crypto.randomUUID(), type: "richtext", anchor: "content",
        chapter: null, hidden: false, joinPrevious: false,
        data: { doc: { type: "doc", content: [{ type: "paragraph" }] }, width: "narrow" } }] }
  const [row] = await getDb()
    .insert(pages)
    .values({ path: input.path, title: input.title, status: "draft", draft: document,
      settings: { showContactChapter: true, needsReview: false }, createdBy: actor.userId,
      updatedBy: actor.userId })
    .onConflictDoNothing({ target: pages.path })
    .returning()
  if (!row) {
    throw new ApiError("CONFLICT", "A page already lives at that address", {
      path: ["A page already lives at that address"] })
  }
  await audit(actor, { action: "page.create", entityType: "page", entityId: row.id,
    summary: `Created ${row.path}` })
  // A visit before creation cached "no page here" under routes.
  invalidate([tags.routes])
  return { id: row.id, path: row.path }
}

export async function deletePage(actor: Actor, id: string) {
  const db = getDb()
  const row = await findPage(db, id)
  if (row.systemKey) {
    throw new ApiError("FORBIDDEN", "System pages can't be deleted")
  }
  await db.transaction(async (tx) => {
    await deleteRevisions(tx, "page", id)
    await tx.delete(pages).where(eq(pages.id, id))
    await audit(actor,
      { action: "page.delete", entityType: "page", entityId: id, summary: `Deleted ${row.path}` }, tx) })
  invalidate([tags.page(id), tags.routes])
  return { ok: true as const }
}

export const pageRevisions = (id: string) => listRevisions(getDb(), "page", id)
```

`server/modules/pages/routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { CreatePageInput, DraftInput, PageIdParam, PageMetaPatch, RevisionParam, VersionInput,
} from "./schema"
import * as pagesService from "./service"

const read = can({ page: ["read"] })
const id = zValidator("param", PageIdParam, validationHook)
const version = zValidator("json", VersionInput, validationHook)

export const pagesRoutes = new Hono<AppEnv>()
  .get("/", read, async (c) => c.json(await pagesService.listPages()))
  .post("/", can({ page: ["create"] }), zValidator("json", CreatePageInput, validationHook), async (c) =>
      c.json(await pagesService.createPage(c.get("actor")!, c.req.valid("json")), 201))
  .get("/:id", read, id, async (c) =>
    c.json(await pagesService.getPage(c.req.valid("param").id)))
  .patch("/:id/draft", can({ page: ["update"] }), id, zValidator("json", DraftInput, validationHook),
    async (c) =>
      c.json(await pagesService.saveDraft(c.get("actor")!, c.req.valid("param").id, c.req.valid("json"))))
  // seo.update or page.update, depending on the fields: decided in the service.
  .patch("/:id/seo", read, id, zValidator("json", PageMetaPatch, validationHook), async (c) =>
      c.json(await pagesService.updateMeta(c.get("actor")!, c.req.valid("param").id, c.req.valid("json"))))
  .post("/:id/publish", can({ page: ["publish"] }), id, version, async (c) =>
    c.json(
      await pagesService.publishPage(c.get("actor")!, c.req.valid("param").id, c.req.valid("json").version)))
  .post("/:id/discard", can({ page: ["update"] }), id, version, async (c) =>
    c.json(
      await pagesService.discardDraft(c.get("actor")!, c.req.valid("param").id, c.req.valid("json").version)))
  .get("/:id/revisions", read, id, async (c) =>
    c.json(await pagesService.pageRevisions(c.req.valid("param").id)))
  .post("/:id/revisions/:rev/restore", can({ page: ["update"] }),
    zValidator("param", RevisionParam, validationHook), version, async (c) => {
      const { id, rev } = c.req.valid("param")
      return c.json(await pagesService.restoreRevision(c.get("actor")!, id, rev, c.req.valid("json").version))
    })
  .delete("/:id", can({ page: ["delete"] }), id, async (c) =>
    c.json(await pagesService.deletePage(c.get("actor")!, c.req.valid("param").id)))

export type PagesRoutes = typeof pagesRoutes
```

`server/api/routes/admin.ts` — import `pagesRoutes` and add `.route("/pages", pagesRoutes)` after `.use(twoFactorComplete)`. `admin/lib/api.ts` — add `import type { PagesRoutes } from "@/server/modules/pages/routes"` and `export const pagesApi = hc<PagesRoutes>("/api/v1/admin/pages")`.

- [ ] **Step 8: Run the tests and gates**

Run: `pnpm test:integration tests/integration/api/pages.test.ts && pnpm test:unit && pnpm lint && pnpm typecheck`
Expected: PASS. If `typecheck` rejects passing `tx` where `DbLike` is expected, the `Tx` alias is wrong for drizzle 0.45 — print the inferred type with `type _ = Tx` hover / `tsc --noEmit` message and fix the alias (do not widen to `any`).

- [ ] **Step 9: Commit**

```bash
git add server/api/errors.ts server/api/errors.test.ts admin/lib/api-error.ts admin/lib/api.ts server/db/client.ts server/lib/audit.ts server/lib/conflict.ts server/lib/revisions.ts lib/content/slug.ts lib/content/article-slug.ts lib/content/page-path.ts blocks/registry.ts blocks/page.ts blocks/page.test.ts tests/content/page-path.test.ts server/modules/pages server/api/routes/admin.ts tests/integration/helpers tests/integration/api/pages.test.ts
git commit -m "feat(content): pages API with drafts, publish, revisions and conflicts"
```

---
### Task 2: Preview (draft mode) and custom-page routing

**Files:**
- Create: `server/modules/preview/routes.ts`, `server/modules/content/preview.ts`, `components/preview-bar.tsx`, `app/(site)/[page]/page.tsx`, `tests/e2e/support/api.ts`, `tests/e2e/admin/content/preview.spec.ts`
- Modify: `server/modules/content/queries.ts`, `server/modules/content/queries.test.ts`, `app/(site)/_cms/cms-page.tsx`, `app/(site)/_cms/cms-page.test.ts`, `app/(site)/_cms/site-frame.tsx`, `server/api/routes/admin.ts`, `admin/components/shell/website-card.tsx`, `admin/components/shell/app-sidebar.tsx`, `tests/e2e/navigation/cms.spec.ts`, `playwright.config.ts`
- Test: `tests/integration/api/preview.test.ts`, `server/modules/content/preview.test.ts`

**Interfaces:**
- Consumes: `PreviewPath`, `CustomPagePath`, `PAGE_SHELL_SEGMENT` (Task 1), `getSession()` (`server/auth/session.ts`), `pagesApi` routes for the E2E helper.
- Produces:
  - `GET /api/v1/admin/preview?path=/x` (needs `page.read`) → 307 to `/x` with the draft-mode cookie; `GET /api/v1/admin/preview/exit?path=/x` → 307, cookie cleared. `PreviewRoutes`.
  - `isPreviewing(): Promise<boolean>`.
  - `getPublishedPage(path: string, draft = false)`; `getSetting(key)` no longer reads draft mode.
  - E2E helpers: `api<T>(request, method, path, data?)`, `richTextDocument(text)`, `createPublishedPage(request, text) → { id, path, version }`.

- [ ] **Step 1: Write the failing tests**

`server/modules/content/preview.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ draft: false, role: null as string | null }))
vi.mock("next/headers", () => ({ draftMode: async () => ({ isEnabled: state.draft }) }))
const getSession = vi.hoisted(() => vi.fn())
vi.mock("@/server/auth/session", () => ({ getSession }))

import { isPreviewing } from "./preview"

beforeEach(() => {
  getSession.mockReset()
  getSession.mockImplementation(async () =>
    state.role
      ? { user: { id: "u", email: "e@x.ie", name: "E", role: state.role }, session: { id: "s" } }
      : null) })

// Review Focus 4: the bypass cookie alone never shows drafts.
describe("isPreviewing", () => {
  it("is off without draft mode, and never reads the session", async () => {
    Object.assign(state, { draft: false, role: "editor" })
    expect(await isPreviewing()).toBe(false)
    expect(getSession).not.toHaveBeenCalled() })
  it.each([[null, false], ["intake", false], ["viewer", true], ["editor", true],
  ])("in draft mode with role %s → %s", async (role, expected) => {
    Object.assign(state, { draft: true, role })
    expect(await isPreviewing()).toBe(expected) }) })
```

`tests/integration/api/preview.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const draft = vi.hoisted(() => ({ enable: vi.fn(), disable: vi.fn(), isEnabled: false }))
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()), draftMode: async () => draft }))

import { closeDb } from "@/server/db/client"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  draft.enable.mockReset()
  draft.disable.mockReset() })
afterAll(closeDb)

describe("preview", () => {
  it("enables draft mode and redirects to an internal path", async () => {
    const response = await adminRequest("/preview?path=/about", await cookieFor("viewer"))
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("/about")
    expect(draft.enable).toHaveBeenCalledOnce() })
  it("refuses roles without page.read", async () => {
    const response = await adminRequest("/preview?path=/about", await cookieFor("intake"))
    expect(response.status).toBe(403)
    expect(draft.enable).not.toHaveBeenCalled() })
  it.each(["//evil.example", "https://evil.example", "/%5Cevil", "/a?b=1"])(
    "refuses the open-redirect target %s", async (target) => {
      const response = await adminRequest(`/preview?path=${encodeURIComponent(target)}`,
        await cookieFor("editor"))
      expect(response.status).toBe(400)
      expect(draft.enable).not.toHaveBeenCalled() })
  it("needs a session", async () => {
    expect((await adminRequest("/preview?path=/", "")).status).toBe(401) })
  it("exits to the page, falling back to / for odd paths", async () => {
    const cookie = await cookieFor("editor")
    const exit = await adminRequest("/preview/exit?path=//evil.example", cookie)
    expect(exit.status).toBe(307)
    expect(exit.headers.get("location")).toBe("/")
    expect(draft.disable).toHaveBeenCalledOnce() }) })
```

In `server/modules/content/queries.test.ts` add (and delete the `next/headers` mock, which the module no longer needs):

```ts
  it("reads the draft only when asked", async () => {
    repo.findPageByPath.mockResolvedValue(null)
    await getPublishedPage("/about", true)
    expect(repo.findPageByPath).toHaveBeenCalledWith("/about", { draft: true })
    await getPublishedPage("/about")
    expect(repo.findPageByPath).toHaveBeenLastCalledWith("/about", { draft: false }) })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run --project unit server/modules/content && pnpm test:integration tests/integration/api/preview.test.ts`
Expected: FAIL (`./preview` missing; `/preview` 404; `findPageByPath` called with `{ draft: false }` regardless).

- [ ] **Step 3: Implement**

`server/modules/content/preview.ts`:

```ts
import "server-only"

import { draftMode } from "next/headers"

import { hasPermission } from "@/lib/auth/permissions"
import { toActor } from "@/server/auth/actor"
import { getSession } from "@/server/auth/session"

// Drafts need both: Next's draft-mode cookie (set only by our preview
// endpoint) and a live session that may read pages. The cookie outlives a
// sign-out, so it is never enough on its own. Public requests stop at the
// first check and never touch the session.
export async function isPreviewing(): Promise<boolean> {
  if (!(await draftMode()).isEnabled) return false
  const session = await getSession()
  return (session !== null &&
    hasPermission(toActor(session).roles, { page: ["read"] }))
}
```

`server/modules/content/queries.ts` — remove the `draftMode` import and change the two functions:

```ts
// `draft` comes from isPreviewing(): a cache scope must not decide on its
// own whether this request may see drafts. In draft mode Next re-runs the
// scope on every request and stores nothing.
export async function getPublishedPage(path: string, draft = false) {
  "use cache"
  cacheTag(tags.routes)
  const page = await repo.findPageByPath(path, { draft })
  if (page) cacheTag(tags.page(page.id))
  lifetime(page !== null)
  return page
}

// Globals go live on save; the theme's draft (Phase 9) will pass it in.
export async function getSetting<K extends PublicGlobalKey>(key: K
): Promise<GlobalValue<K>> {
  "use cache"
  cacheTag(tags.setting(key))
  const row = await repo.findSetting(key)
  lifetime(row !== null)
  return parseGlobal(key, row?.value)
}
```

`app/(site)/_cms/cms-page.tsx` — import `isPreviewing` from `@/server/modules/content/preview`; in `CmsPage` after `await io()`: `const draft = await isPreviewing()` and call `getPublishedPage(path, draft)`; in `cmsMetadata` likewise. In `cms-page.test.ts` add `vi.mock("@/server/modules/content/preview", () => ({ isPreviewing: vi.fn(async () => false) }))`.

`components/preview-bar.tsx`:

```tsx
"use client"

import { usePathname } from "next/navigation"

// Rendered by SiteFrame only while isPreviewing(). Leaving preview is a
// plain navigation (the exit endpoint clears the cookie and redirects back),
// so the public site never fetches /api.
export function PreviewBar() {
  const pathname = usePathname()
  return (
    <div role="status"
      className="fixed inset-x-0 bottom-4 z-[100] mx-auto flex w-fit items-center gap-3 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg"
    >
      <span>Previewing unpublished changes</span>
      <a href={`/api/v1/admin/preview/exit?path=${encodeURIComponent(pathname)}`}
        className="font-semibold underline underline-offset-4"
      >
        Exit preview
      </a>
    </div>)
}
```

`app/(site)/_cms/site-frame.tsx` — add `isPreviewing()` to the `Promise.all` (as `preview`) and render `{preview ? <PreviewBar /> : null}` after `</SmoothScroll>`.

`server/modules/preview/routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { draftMode } from "next/headers"
import * as z from "zod"

import { PreviewPath } from "@/lib/content/page-path"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

// Hono runs inside the Next Route Handler, so draftMode() has its request
// store and Next merges the cookie it sets into our redirect.
export const previewRoutes = new Hono<AppEnv>()
  .get("/", can({ page: ["read"] }),
    zValidator("query", z.object({ path: PreviewPath.default("/") }), validationHook), async (c) => {
      ;(await draftMode()).enable()
      return c.redirect(c.req.valid("query").path, 307) })
  // Leaving must always work, so an odd path falls back to the home page.
  .get("/exit", zValidator("query", z.object({ path: PreviewPath.catch("/") }), validationHook),
    async (c) => {
      ;(await draftMode()).disable()
      return c.redirect(c.req.valid("query").path, 307) })

export type PreviewRoutes = typeof previewRoutes
```

Mount: `server/api/routes/admin.ts` → `.route("/preview", previewRoutes)` after `twoFactorComplete`.

`app/(site)/[page]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { io } from "next/cache"
import { notFound } from "next/navigation"

import { CustomPagePath, PAGE_SHELL_SEGMENT } from "@/lib/content/page-path"

import { CmsPage, cmsMetadata } from "../_cms/cms-page"

// Editor-created pages (POST /admin/pages) live one segment deep; named
// routes (about, privacy, …) win over this one. As on the article route, a
// sentinel param gives Cache Components a build shell without the database,
// and CustomPagePath can never produce it. An unknown segment renders the
// soft 404 (200 + noindex) inside the streamed shell; deeper unknown URLs
// still get global-not-found's real 404.
export function generateStaticParams() {
  return [{ page: PAGE_SHELL_SEGMENT }]
}

async function pathOf(params: PageProps<"/[page]">["params"]) {
  const path = `/${(await params).page}`
  return CustomPagePath.safeParse(path).success ? path : null
}

export async function generateMetadata({ params }: PageProps<"/[page]">): Promise<Metadata> {
  await io()
  const path = await pathOf(params)
  if (!path) notFound()
  return cmsMetadata(path)
}

export default async function CustomPage({ params }: PageProps<"/[page]">) {
  await io()
  const path = await pathOf(params)
  if (!path) notFound()
  return <CmsPage path={path} />
}
```

`admin/components/shell/website-card.tsx` — add prop `canPreview: boolean` and, under "Open site", when true:

```tsx
      {canPreview ? (
        <a href="/api/v1/admin/preview?path=/" target="_blank" rel="noreferrer"
          className="mt-2 block text-center text-sm font-semibold underline-offset-4 hover:underline"
        >
          Preview drafts
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : null}
```

`admin/components/shell/app-sidebar.tsx` — `const canPreview = usePermission({ page: ["read"] })` (import from `@/admin/lib/actor-context`) and `<WebsiteCard siteUrl={siteUrl} canPreview={canPreview} />`.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project unit server/modules/content app && pnpm test:integration tests/integration/api/preview.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the E2E specs**

`tests/e2e/support/api.ts`:

```ts
import type { APIRequestContext } from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

// Admin API calls from a signed-in storage state. sameOrigin() needs Origin.
export async function api<T>(request: APIRequestContext, method: Method, path: string, data?: unknown
): Promise<T> {
  const response = await request.fetch(`/api/v1/admin${path}`, { method, data,
    headers: { origin: E2E_ORIGIN } })
  if (!response.ok()) {
    throw new Error(`${method} ${path} → ${response.status()} ${await response.text()}`)
  }
  return (await response.json()) as T
}

export const richTextDocument = (text: string) => ({ blocks: [{ id: "e2e-content", type: "richtext",
      anchor: "content", chapter: null, hidden: false, joinPrevious: false, data: {
        doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
        width: "narrow" } }] })

// A fresh custom page per test, so specs never touch seeded pages (parity).
export async function createPublishedPage(request: APIRequestContext, text: string,
  document: unknown = richTextDocument(text)
) {
  const path = `/e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}`
  const { id } = await api<{ id: string }>(request, "POST", "/pages", { path, title: "E2E page" })
  const page = await api<{ version: number }>(request, "GET", `/pages/${id}`)
  const saved = await api<{ version: number }>(request, "PATCH", `/pages/${id}/draft`, {
    version: page.version, document })
  const published = await api<{ version: number }>(request, "POST", `/pages/${id}/publish`, {
    version: saved.version })
  return { id, path, version: published.version }
}
```

`tests/e2e/admin/content/preview.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { api, createPublishedPage, richTextDocument } from "../../support/api"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

// Review Focus 4.
test("drafts show in preview only, never to the public", async ({ page, browser }) => {
  const { id, path, version } = await createPublishedPage(page.request, "Published words")
  await api(page.request, "PATCH", `/pages/${id}/draft`, { version, document: richTextDocument("Draft words"),
  })

  const anonymous = await (await browser.newContext()).newPage()
  await anonymous.goto(path)
  await expect(anonymous.getByText("Published words")).toBeVisible()
  await expect(anonymous.getByText("Draft words")).toHaveCount(0)

  await page.goto(`/api/v1/admin/preview?path=${encodeURIComponent(path)}`)
  await expect(page).toHaveURL(path)
  await expect(page.getByText("Draft words")).toBeVisible()
  await expect(page.getByText("Previewing unpublished changes")).toBeVisible()

  await page.getByRole("link", { name: "Exit preview" }).click()
  await expect(page.getByText("Published words")).toBeVisible()

  await anonymous.reload()
  await expect(anonymous.getByText("Draft words")).toHaveCount(0) })
```

`playwright.config.ts` — add `"**/admin/content/**"` to `DESKTOP_ONLY` (these specs create data; one viewport is enough).

`tests/e2e/navigation/cms.spec.ts` — the real-404 list becomes `["/about/extra", "/no/such/page"]`, and `"/no-such-page"` joins the soft-404 list (`["/no-such-page", "/privacy", "/insights/nope", "/insights/__shell", "/__page"]`); update the comment above the first loop to: "A URL no route matches (two or more unknown segments) is a real 404 … one unknown segment reaches the custom-page route and renders the soft 404."

- [ ] **Step 6: Run E2E, parity and gates**

Run: `pnpm build && E2E_SKIP_BUILD=1 pnpm test:e2e tests/e2e/navigation/cms.spec.ts tests/e2e/admin/content/preview.spec.ts && E2E_SKIP_BUILD=1 pnpm test:parity && pnpm lint && pnpm typecheck`
Expected: PASS; parity unchanged (the bar only renders in draft mode). `pnpm build` must not prerender anything but `/__page` for the new route.

- [ ] **Step 7: Commit**

```bash
git add server/modules/preview server/modules/content app/(site) components/preview-bar.tsx server/api/routes/admin.ts admin/components/shell tests/e2e playwright.config.ts tests/integration/api/preview.test.ts
git commit -m "feat(site): draft-mode preview for editors and custom page routes"
```

---

### Task 3: Globals API with per-key permissions and rollback

**Files:**
- Create: `lib/content/global-access.ts`, `server/modules/globals/service.ts`, `server/modules/globals/routes.ts`
- Modify: `lib/content/globals.ts` (`parseGlobal`), `lib/content/globals.test.ts`, `server/api/routes/admin.ts`, `admin/lib/api.ts`
- Test: `tests/integration/api/globals.test.ts`

**Interfaces:**
- Consumes: `writeRevision`/`listRevisions`/`findRevision`, `conflictError`, `topLevelDiff`, `invalid`, `cookieFor`.
- Produces:
  - `EDITABLE_GLOBAL_KEYS`, `type EditableGlobalKey`, `GLOBAL_ACCESS: Record<EditableGlobalKey, { read: Permissions; update: Permissions }>`, `SETTINGS_PAGES: Record<"identity" | "contact" | "navigation" | "footer" | "forms" | "notifications" | "privacy", readonly EditableGlobalKey[]>`, `SETTINGS_PAGE_LABELS`.
  - `GlobalsRoutes` at `/api/v1/admin/globals`: `GET /:key` → `{ key, value, version, updatedAt }` (version 0 = never saved); `PUT /:key` `{ version, value }` → same shape; `GET /:key/revisions`; `POST /:key/revisions/:rev/restore` `{ version }` → same shape. `globalsApi` client.

- [ ] **Step 1: Write the failing tests**

Append to `lib/content/globals.test.ts` (merge imports; add `vi` to the vitest import):

```ts
import { GLOBALS, parseGlobal, type GlobalKey } from "./globals"

describe("parseGlobal fallbacks", () => {
  it.each(Object.keys(GLOBALS) as GlobalKey[])("%s has complete defaults", (key) => {
    expect(GLOBALS[key].safeParse({}).success).toBe(true) })
  // One hand-edited row must not take the whole site down (P3 carry).
  it("falls back to the defaults for an invalid stored value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(parseGlobal("navigation", { links: "nope" })).toEqual(GLOBALS.navigation.parse({}))
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore() }) })
```

`tests/integration/api/globals.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag }))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb } from "@/server/db/client"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset() })
afterAll(closeDb)

const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const nav = (label: string, href = "/about") => ({ links: [{ label, href }], cta: { label: "Book", href: "/contact" } })
const put = (cookie: string, key: string, version: number, value: unknown) =>
  adminRequest(`/globals/${key}`, cookie, { method: "PUT", body: { version, value } })

// docs/brief.md §6.4/§7.2: [GET contact, PUT navigation, PUT site].
const MATRIX: Record<RoleName, [number, number, number]> = { owner: [200, 200, 200], admin: [200, 200, 200],
  editor: [200, 200, 403], author: [403, 403, 403], marketer: [200, 403, 403], intake: [403, 403, 403],
  viewer: [200, 403, 403] }

describe.each(ROLE_NAMES)("globals RBAC for %s", (role) => {
  it(`GET contact, PUT navigation, PUT site → ${MATRIX[role].join(", ")}`, async () => {
    const cookie = await cookieFor(role)
    expect((await adminRequest("/globals/contact", cookie)).status).toBe(MATRIX[role][0])
    expect((await put(cookie, "navigation", 0, nav("About"))).status).toBe(MATRIX[role][1])
    expect((await put(cookie, "site", 0, { name: "Magda" })).status).toBe(MATRIX[role][2]) }) })

describe("globals API", () => {
  it("saves, invalidates its tag, and 409s a stale version", async () => {
    const cookie = await cookieFor("editor")
    const first = await put(cookie, "navigation", 0, nav("About"))
    expect(first.status).toBe(200)
    expect((await first.json()).version).toBe(1)
    expect(expired()).toEqual(["settings:navigation"])

    const stale = await put(cookie, "navigation", 0, nav("Other"))
    expect(stale.status).toBe(409)
    expect((await stale.json()).error.details.current.version).toBe(1)
    const current = await (await adminRequest("/globals/navigation", cookie)).json()
    expect(current.value.links[0].label).toBe("About") })

  it("refuses unsafe links with a field path", async () => {
    const response = await put(await cookieFor("editor"), "navigation", 0, nav("X", "javascript:alert(1)"))
    expect(response.status).toBe(400)
    expect((await response.json()).error.fieldErrors).toHaveProperty(["links.0.href"]) })

  it("keeps 20 revisions and rolls back", async () => {
    const cookie = await cookieFor("editor")
    let version = 0
    for (let i = 1; i <= 22; i++) {
      version = (await (await put(cookie, "footer", version, { blurb: `Blurb ${i}` })).json()).version
    }
    const { items } = await (await adminRequest("/globals/footer/revisions", cookie)).json()
    expect(items).toHaveLength(20)
    const oldest = items.at(-1)
    expect(oldest.version).toBe(3)
    const restored = await adminRequest(`/globals/footer/revisions/${oldest.id}/restore`, cookie, {
      method: "POST", body: { version } })
    expect(restored.status).toBe(200)
    expect((await restored.json()).value.blurb).toBe("Blurb 3") })

  it.each(["tracking", "consent", "scripts", "theme", "nope"])("%s is not served by the generic route",
    async (key) => {
      expect((await adminRequest(`/globals/${key}`, await cookieFor("owner"))).status).toBe(404)
    }) })
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run --project unit lib/content && pnpm test:integration tests/integration/api/globals.test.ts`
Expected: FAIL (`parseGlobal` throws; `/globals` 404).

- [ ] **Step 3: Implement**

`lib/content/globals.ts` — replace `parseGlobal`:

```ts
export function parseGlobal<K extends GlobalKey>(key: K, value: unknown
): GlobalValue<K> {
  const parsed = GLOBALS[key].safeParse(value ?? {})
  if (parsed.success) return parsed.data as GlobalValue<K>
  // Writes are validated, so this is drift (a hand edit, a schema change).
  // Defaults keep the site up; the admin shows them and the next save heals.
  console.warn(`[content] global "${key}" is invalid; using defaults`, z.prettifyError(parsed.error))
  return GLOBALS[key].parse({}) as GlobalValue<K>
}
```

`lib/content/global-access.ts`:

```ts
import type { Permissions } from "@/lib/auth/permissions"

import type { GlobalKey } from "./globals"

// The keys the generic globals API edits (docs/brief.md §6.4). tracking,
// consent, scripts and theme have dedicated endpoints (Phases 8–9).
export const EDITABLE_GLOBAL_KEYS = ["site", "contact", "navigation", "footer", "newsletter", "contactForm",
  "microcopy", "seo", "notifications", "privacy"] as const satisfies readonly GlobalKey[]
export type EditableGlobalKey = (typeof EDITABLE_GLOBAL_KEYS)[number]

type Access = { read: Permissions; update: Permissions }
const settingsAccess = { read: { settings: ["read"] }, update: { settings: ["update"] } } satisfies Access
const globalsAccess = { read: { globals: ["read"] }, update: { globals: ["update"] } } satisfies Access

export const GLOBAL_ACCESS: Record<EditableGlobalKey, Access> = { site: settingsAccess,
  notifications: settingsAccess, privacy: settingsAccess, contact: globalsAccess, navigation: globalsAccess,
  footer: globalsAccess, newsletter: globalsAccess, contactForm: globalsAccess, microcopy: globalsAccess,
  seo: { read: { seo: ["read"] }, update: { seo: ["update"] } } }

// /admin/settings/<slug> (lib/admin/nav.ts) → the documents it edits.
export const SETTINGS_PAGES = { identity: ["site"], contact: ["contact"], navigation: ["navigation"],
  footer: ["footer"], forms: ["contactForm", "newsletter", "microcopy"], notifications: ["notifications"],
  privacy: ["privacy"] } as const satisfies Record<string, readonly EditableGlobalKey[]>
export type SettingsPage = keyof typeof SETTINGS_PAGES

export const GLOBAL_LABELS: Record<EditableGlobalKey, string> = { site: "Identity",
  contact: "Contact & clinic", navigation: "Navigation", footer: "Footer", newsletter: "Newsletter band",
  contactForm: "Contact form", microcopy: "Microcopy", seo: "SEO defaults", notifications: "Notifications",
  privacy: "Privacy" }
```

`server/modules/globals/service.ts`:

```ts
import "server-only"

import { eq } from "drizzle-orm"

import type { EditableGlobalKey } from "@/lib/content/global-access"
import { GLOBALS, parseGlobal } from "@/lib/content/globals"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { conflictError, topLevelDiff } from "@/server/lib/conflict"
import { findRevision, listRevisions, writeRevision } from "@/server/lib/revisions"

async function findRow(db: DbLike, key: string, lock = false) {
  const query = db.select().from(settings).where(eq(settings.key, key)).limit(1)
  const [row] = lock ? await query.for("update") : await query
  return row ?? null
}

export async function getGlobal(key: EditableGlobalKey) {
  const row = await findRow(getDb(), key)
  return { key, value: parseGlobal(key, row?.value), version: row?.version ?? 0,
    updatedAt: row?.updatedAt ?? null }
}

// Globals go live on save (docs/brief.md §6.5): validate, version-guard,
// snapshot (20 kept), audit with a field diff, expire the one tag.
export async function saveGlobal(actor: Actor, key: EditableGlobalKey,
  input: { version: number; value: unknown }, note?: string
) {
  const parsed = GLOBALS[key].safeParse(input.value)
  if (!parsed.success) throw invalid(parsed.error)
  const value = parsed.data
  const saved = await getDb().transaction(async (tx) => {
    const before = await findRow(tx, key, true)
    if ((before?.version ?? 0) !== input.version) {
      throw await conflictError(tx, { version: before?.version ?? 0, updatedAt: before?.updatedAt ?? null,
        updatedBy: before?.updatedBy ?? null })
    }
    const [row] = before
      ? await tx
          .update(settings)
          .set({ value, version: before.version + 1, updatedBy: actor.userId, updatedAt: new Date() })
          .where(eq(settings.key, key))
          .returning()
      : await tx.insert(settings).values({ key, value, version: 1, updatedBy: actor.userId }).returning()
    await writeRevision(tx, { entityType: "setting", entityId: key, version: row!.version, snapshot: value,
      createdBy: actor.userId, note })
    await audit(actor, { action: "globals.update", entityType: "setting", entityId: key,
        summary: note ?? `Updated ${key}`, diff: topLevelDiff(before?.value, value) }, tx)
    return row! })
  invalidate([tags.setting(key)])
  return { key, value, version: saved.version, updatedAt: saved.updatedAt }
}

export const globalRevisions = (key: EditableGlobalKey) =>
  listRevisions(getDb(), "setting", key)

export async function restoreGlobal(actor: Actor, key: EditableGlobalKey, revisionId: string, version: number
) {
  const revision = await findRevision(getDb(), "setting", key, revisionId)
  if (!revision) throw new ApiError("NOT_FOUND", "That version doesn't exist")
  // Re-validated by saveGlobal: an old snapshot may predate a schema change.
  return saveGlobal(actor, key, { version, value: revision.snapshot }, `Restored version ${revision.version} of ${key}`)
}
```

`server/modules/globals/routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { createMiddleware } from "hono/factory"
import * as z from "zod"

import { EDITABLE_GLOBAL_KEYS, GLOBAL_ACCESS } from "@/lib/content/global-access"
import { ApiError, validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { getGlobal, globalRevisions, restoreGlobal, saveGlobal } from "./service"

const KeyParam = z.object({ key: z.enum(EDITABLE_GLOBAL_KEYS) })
const RevisionParam = KeyParam.extend({ rev: z.uuid() })
const SaveInput = z.object({ version: z.number().int().min(0), value: z.unknown() })
const VersionInput = z.object({ version: z.number().int().min(0) })

// The permission depends on the key (docs/brief.md §6.4), so can() runs once
// the key is known. Unknown keys, and those with dedicated endpoints, 404.
const canGlobal = (mode: "read" | "update") =>
  createMiddleware<AppEnv>(async (c, next) => {
    const parsed = KeyParam.safeParse({ key: c.req.param("key") })
    if (!parsed.success) throw new ApiError("NOT_FOUND", "No such settings document")
    await can(GLOBAL_ACCESS[parsed.data.key][mode])(c, next) })

export const globalsRoutes = new Hono<AppEnv>()
  .get("/:key", canGlobal("read"), zValidator("param", KeyParam, validationHook), async (c) =>
    c.json(await getGlobal(c.req.valid("param").key)))
  .put("/:key", canGlobal("update"), zValidator("param", KeyParam, validationHook),
    zValidator("json", SaveInput, validationHook), async (c) =>
      c.json(await saveGlobal(c.get("actor")!, c.req.valid("param").key, c.req.valid("json"))))
  .get("/:key/revisions", canGlobal("read"), zValidator("param", KeyParam, validationHook), async (c) =>
    c.json(await globalRevisions(c.req.valid("param").key)))
  .post("/:key/revisions/:rev/restore", canGlobal("update"),
    zValidator("param", RevisionParam, validationHook), zValidator("json", VersionInput, validationHook),
    async (c) => {
      const { key, rev } = c.req.valid("param")
      return c.json(await restoreGlobal(c.get("actor")!, key, rev, c.req.valid("json").version)) })

export type GlobalsRoutes = typeof globalsRoutes
```

Mount `.route("/globals", globalsRoutes)` in `server/api/routes/admin.ts`; add `export const globalsApi = hc<GlobalsRoutes>("/api/v1/admin/globals")` to `admin/lib/api.ts`.

- [ ] **Step 4: Run tests and gates**

Run: `pnpm vitest run --project unit lib/content && pnpm test:integration tests/integration/api/globals.test.ts tests/integration/content && pnpm lint && pnpm typecheck`
Expected: PASS. If a key's `safeParse({})` fails, give the offending field a `.default()` in `lib/content/globals.ts` (never drop the test).

- [ ] **Step 5: Commit**

```bash
git add lib/content server/modules/globals server/api/routes/admin.ts admin/lib/api.ts tests/integration/api/globals.test.ts
git commit -m "feat(content): globals API with per-key permissions and rollback"
```

---
### Task 4: Generic Collections API and seed guard

**Files:**
- Create: `lib/content/collections.ts`, `server/modules/collections/registry.ts`, `server/modules/collections/usage.ts`, `server/modules/collections/service.ts`, `server/modules/collections/routes.ts`
- Modify: `server/db/seed/index.ts`, `scripts/seed.ts`, `server/api/routes/admin.ts`, `admin/lib/api.ts`, `tests/integration/seed/seed.test.ts`
- Test: `tests/integration/api/collections.test.ts`

**Interfaces:**
- Consumes: `Slug`, `LinkValue`, `MediaRef`, `IconField`, `Tint`, `text` (`blocks/fields.ts`), `conflictError`, `isUniqueViolation`, `topLevelDiff`, `invalid`, `tags.collection`.
- Produces:
  - `COLLECTION_NAMES = ["services","plans","testimonials","faqs","steps","cta-bands"]`, `type CollectionSlug`, `COLLECTION_SCHEMAS: Record<CollectionSlug, z.ZodObject>`, `COLLECTION_LABELS`, `type OptionSource = CollectionSlug | "articles"`.
  - `CollectionsRoutes` at `/api/v1/admin/collections`: `GET /:name` → `{ items: { id, sort, version, updatedAt, title, values, usedOn: string[] }[], page, pageSize, total }`; `POST /:name` `{ values }` → 201 item; `PATCH /:name/order` `{ ids }` → `{ ok }`; `PATCH /:name/:id` `{ version, values }` (partial values, merged) → item; `DELETE /:name/:id` → `{ ok }` or 409 `details.usedOn`; `GET /:name/options` (also `articles`) → `{ items: { id, label }[] }`. `collectionsApi` client.
  - `seedContent({ db?, force? })` → `{ skipped: true } | { skipped: false, media, pages, globals }` (all current callers pass nothing).

- [ ] **Step 1: Write the failing test**

`tests/integration/api/collections.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag }))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { COLLECTION_NAMES, COLLECTION_SCHEMAS } from "@/lib/content/collections"
import { closeDb, getDb } from "@/server/db/client"
import { faqs } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { listItems } from "@/server/modules/collections/service"

import { adminRequest, cookieFor } from "../helpers/auth"
import { insertMedia, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset() })
afterAll(closeDb)

const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const faq = (question: string) => ({ question, answer: "An answer.", isVisible: true })
const create = (cookie: string, name: string, values: unknown) =>
  adminRequest(`/collections/${name}`, cookie, { method: "POST", body: { values } })

const MATRIX: Record<RoleName, { read: number; write: number }> = { owner: { read: 200, write: 201 },
  admin: { read: 200, write: 201 }, editor: { read: 200, write: 201 }, author: { read: 200, write: 403 },
  marketer: { read: 200, write: 403 }, intake: { read: 403, write: 403 }, viewer: { read: 200, write: 403 } }

describe.each(ROLE_NAMES)("collections RBAC for %s", (role) => {
  it(`GET → ${MATRIX[role].read}, POST → ${MATRIX[role].write}`, async () => {
    const cookie = await cookieFor(role)
    expect((await adminRequest("/collections/faqs", cookie)).status).toBe(MATRIX[role].read)
    expect((await create(cookie, "faqs", faq("Q?"))).status).toBe(MATRIX[role].write) }) })

describe("collections API", () => {
  it("creates, updates with a version, and 409s a stale one", async () => {
    const cookie = await cookieFor("editor")
    const item = await (await create(cookie, "faqs", faq("First?"))).json()
    expect(expired()).toEqual(["collection:faqs"])
    const patch = (version: number, question: string) =>
      adminRequest(`/collections/faqs/${item.id}`, cookie, { method: "PATCH",
        body: { version, values: { question } } })
    expect((await patch(1, "Second?")).status).toBe(200)
    const stale = await patch(1, "Third?")
    expect(stale.status).toBe(409)
    expect((await stale.json()).error.details.current.version).toBe(2) })

  // Review Focus 1: the slug is "cta-bands", the tag getCtaBand reads is
  // collection:bands.
  it("cta-bands writes expire collection:bands and validate the CTA link", async () => {
    const cookie = await cookieFor("editor")
    const asset = await insertMedia()
    const band = { name: "Next step", eyebrow: "Work with me", title: "Ready?", bullets: ["One"],
      cta: { label: "Book", href: "javascript:alert(1)" }, image: { mediaId: asset.id }, tint: 0.9,
      isVisible: true }
    expect((await create(cookie, "cta-bands", band)).status).toBe(400)
    const ok = await create(cookie, "cta-bands", { ...band, cta: { label: "Book", href: "/contact" } })
    expect(ok.status).toBe(201)
    expect(expired()).toEqual(["collection:bands"]) })

  it("reorders only with the complete id list", async () => {
    const cookie = await cookieFor("editor")
    const a = await (await create(cookie, "faqs", faq("A?"))).json()
    const b = await (await create(cookie, "faqs", faq("B?"))).json()
    const order = (ids: string[]) =>
      adminRequest("/collections/faqs/order", cookie, { method: "PATCH", body: { ids } })
    expect((await order([b.id])).status).toBe(400)
    expect((await order([b.id, a.id])).status).toBe(200)
    const { items } = await (await adminRequest("/collections/faqs", cookie)).json()
    expect(items.map((i: { id: string }) => i.id)).toEqual([b.id, a.id]) })

  it("blocks deleting a row a page names, and says where", async () => {
    const cookie = await cookieFor("editor")
    const used = await (await create(cookie, "faqs", faq("Used?"))).json()
    const free = await (await create(cookie, "faqs", faq("Free?"))).json()
    await insertPage({ path: "/team", document: { blocks: [{ id: "team-faq", type: "faq", anchor: "faq",
            chapter: null, hidden: false, joinPrevious: false,
            data: { variant: "page", title: "T", subtitle: "S", selection: { mode: "chosen", ids: [used.id] }, initiallyOpen: null },
          }] } })
    const blocked = await adminRequest(`/collections/faqs/${used.id}`, cookie, { method: "DELETE" })
    expect(blocked.status).toBe(409)
    expect((await blocked.json()).error.details.usedOn).toEqual(["Test page"])
    expect((await adminRequest(`/collections/faqs/${free.id}`, cookie, { method: "DELETE" })).status).toBe(200)
  })

  // P3 carries: seeded rows obey the write schemas, and a re-seed never
  // resurrects what an editor deleted.
  it("validates every seeded row and never re-seeds a seeded database", async () => {
    await seedContent()
    for (const name of COLLECTION_NAMES) {
      for (const item of (await listItems(name)).items) {
        const result = COLLECTION_SCHEMAS[name].safeParse(item.values)
        expect(result.success, `${name} ${item.title}`).toBe(true)
      }
    }
    const cookie = await cookieFor("editor")
    const { items } = await (await adminRequest("/collections/faqs", cookie)).json()
    const unused = items.find((i: { usedOn: string[] }) => i.usedOn.length === 0) ?? items[0]
    await getDb().delete(faqs).where(eq(faqs.id, unused.id))
    expect(await seedContent()).toEqual({ skipped: true })
    const after = await (await adminRequest("/collections/faqs", cookie)).json()
    expect(after.items).toHaveLength(items.length - 1) }) })
```

In `tests/integration/seed/seed.test.ts`, the second-run assertions pass unchanged (the second run is skipped). Add to the first test, after the counts comparison: `expect(await seedContent({ force: true })).toMatchObject({ skipped: false })` and re-assert `expect(await counts()).toEqual(first)` (forced runs stay idempotent).

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:integration tests/integration/api/collections.test.ts`
Expected: FAIL (module `@/lib/content/collections` missing).

- [ ] **Step 3: Implement the schemas and registry**

`lib/content/collections.ts`:

```ts
import * as z from "zod"

import { IconField, LinkValue, MediaRef, Tint, text } from "@/blocks/fields"

import { Slug } from "./slug"

// The collections the generic API edits (docs/brief.md §6.3, §8.3); slugs
// are the admin URLs (lib/admin/nav.ts). Articles, categories and authors
// get their own API in Phase 5.
export const COLLECTION_NAMES = ["services", "plans", "testimonials", "faqs", "steps", "cta-bands"] as const
export type CollectionSlug = (typeof COLLECTION_NAMES)[number]
// Read-only choices for the collection picker.
export type OptionSource = CollectionSlug | "articles"

// The image box relative to the step's media slot, as fractions; a crop can
// push it past the slot's edges (lib/content/frame.ts).
const Frame = z.object({ x: z.number().min(-4).max(1), y: z.number().min(-4).max(1),
  w: z.number().gt(0).max(5), h: z.number().gt(0).max(5) })
const isVisible = z.boolean()

export const COLLECTION_SCHEMAS = {
  services: z.object({ slug: Slug, title: text(60), body: text(400), icon: IconField, isVisible }),
  plans: z.object({ slug: Slug, name: text(40), priceLabel: text(20),
    priceCents: z.number().int().min(0).max(10_000_000).nullable(), unit: text(40), summary: text(300),
    features: z.array(text(120)).max(8), ctaLabel: text(30), featured: z.boolean(), isVisible }),
  testimonials: z.object({ quote: text(600), authorName: text(60), authorRole: text(80), avatar: MediaRef,
    isVisible }), faqs: z.object({ question: text(200), answer: text(1500), isVisible }),
  steps: z.object({ title: text(60), description: text(300), image: MediaRef, frame: Frame, isVisible }),
  "cta-bands": z.object({ name: text(60), eyebrow: text(40), title: text(160),
    bullets: z.array(text(120)).min(1).max(6), cta: LinkValue, image: MediaRef, tint: Tint, isVisible }),
} as const

export const COLLECTION_LABELS: Record<CollectionSlug, string> = { services: "Services", plans: "Plans",
  testimonials: "Testimonials", faqs: "FAQs", steps: "Steps", "cta-bands": "CTA bands" }
```

If the seeded-rows test reports a row over a limit, raise that limit to fit today's content (the design already carries it) rather than editing fixtures. If it reports a missing key, the schema key and the column name differ: rename the schema key to the column name.

`server/modules/collections/registry.ts`:

```ts
import "server-only"

import { COLLECTION_SCHEMAS, type CollectionSlug } from "@/lib/content/collections"
import * as t from "@/server/db/schema"
import type { CollectionName } from "@/server/lib/cache"

// One generic router (docs/brief.md §8.3). Schema keys are the column names
// (camelCase), except images: the API speaks { mediaId } (the media widget),
// the table stores <column>Id. The shared columns (id, sort, is_visible,
// version, stamps) are typed through faqs; each collection's own shape is
// enforced by its Zod schema, and the seeded-rows test proves the mapping.
type Shared = typeof t.faqs
export type SharedInsert = Shared["$inferInsert"]
type Row = Record<string, unknown>
type Entry = { table: Shared
  // The cache tag the site's queries read (server/modules/content/queries.ts).
  tag: CollectionName
  titleKey: string
  image?: { field: string; column: string }
}
const as = (table: unknown) => table as Shared

const REGISTRY: Record<CollectionSlug, Entry> = {
  services: { table: as(t.services), tag: "services", titleKey: "title" },
  plans: { table: as(t.plans), tag: "plans", titleKey: "name" },
  testimonials: { table: as(t.testimonials), tag: "testimonials", titleKey: "authorName", image: { field: "avatar", column: "avatarId" } },
  faqs: { table: t.faqs, tag: "faqs", titleKey: "question" },
  steps: { table: as(t.processSteps), tag: "steps", titleKey: "title", image: { field: "image", column: "imageId" } },
  "cta-bands": { table: as(t.ctaBands), tag: "bands", titleKey: "name", image: { field: "image", column: "imageId" } },
}

export const entryFor = (name: CollectionSlug) => REGISTRY[name]

export function toRow(name: CollectionSlug, values: Row): Row {
  const { image } = REGISTRY[name]
  if (!image) return values
  const { [image.field]: ref, ...rest } = values
  return { ...rest, [image.column]: (ref as { mediaId: string }).mediaId }
}

export function fromRow(name: CollectionSlug, row: Row): Row {
  const { image } = REGISTRY[name]
  return Object.fromEntries(Object.keys(COLLECTION_SCHEMAS[name].shape).map((key) => [key,
      key === image?.field ? { mediaId: row[image.column] } : row[key]]))
}

export const titleOf = (name: CollectionSlug, row: Row) =>
  String(row[REGISTRY[name].titleKey] ?? "")
```

`server/modules/collections/usage.ts`:

```ts
import "server-only"

import { asc } from "drizzle-orm"

import { BLOCK_BY_TYPE, type BlockType } from "@/blocks/registry"
import type { DbLike } from "@/server/db/client"
import { pages } from "@/server/db/schema"
import type { CollectionName } from "@/server/lib/cache"

type BlockLike = { type?: unknown; data?: unknown }
const blocksOf = (...documents: unknown[]): BlockLike[] =>
  documents.flatMap((doc) => {
    const blocks = (doc as { blocks?: unknown } | null)?.blocks
    return Array.isArray(blocks) ? (blocks as BlockLike[]) : [] })

// "Used on" hints and the delete guard (docs/brief.md §9.3). A block that
// names a row (chosen ids, a band id) depends on it; an "all" block shows
// every row but survives one being deleted.
export async function collectionUsage(db: DbLike) {
  const rows = await db
    .select({ title: pages.title, draft: pages.draft, published: pages.published })
    .from(pages)
    .orderBy(asc(pages.path))
  return (tag: CollectionName, id: string) => {
    const named = new Set<string>()
    const shown = new Set<string>()
    for (const page of rows) {
      for (const block of blocksOf(page.draft, page.published)) {
        const def = BLOCK_BY_TYPE[block.type as BlockType]
        if (!def || !def.uses.includes(`collection:${tag}`)) continue
        const data = (block.data ?? {}) as {
          bandId?: unknown
          selection?: { mode?: unknown; ids?: unknown }
        }
        const chosen =
          data.selection?.mode === "chosen" && Array.isArray(data.selection.ids)
            ? data.selection.ids
            : null
        const names = data.bandId === id || (chosen?.includes(id) ?? false)
        if (names) named.add(page.title)
        if (names || (data.bandId === undefined && chosen === null)) shown.add(page.title)
      }
    }
    return { named: [...named], shown: [...shown] }
  }
}
```

- [ ] **Step 4: Implement the service and routes**

`server/modules/collections/service.ts`:

```ts
import "server-only"

import { and, asc, desc, eq, sql } from "drizzle-orm"

import { hasPermission } from "@/lib/auth/permissions"
import { COLLECTION_SCHEMAS, type CollectionSlug, type OptionSource } from "@/lib/content/collections"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb } from "@/server/db/client"
import { articles } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { conflictError, isUniqueViolation, topLevelDiff } from "@/server/lib/conflict"

import { entryFor, fromRow, titleOf, toRow, type SharedInsert } from "./registry"
import { collectionUsage } from "./usage"

type Row = Record<string, unknown> & {
  id: string
  sort: number
  version: number
  updatedAt: Date
}

const toItem = (name: CollectionSlug, row: Row, usedOn: string[]) => ({ id: row.id, sort: row.sort,
  version: row.version, updatedAt: row.updatedAt, title: titleOf(name, row), values: fromRow(name, row),
  usedOn })

export async function listItems(name: CollectionSlug) {
  const e = entryFor(name)
  const db = getDb()
  const [rows, usage] = await Promise.all([db.select().from(e.table).orderBy(asc(e.table.sort)),
    collectionUsage(db)])
  const items = rows.map((row) => toItem(name, row, usage(e.tag, row.id).shown))
  return { items, page: 1, pageSize: items.length, total: items.length }
}

function parseValues(name: CollectionSlug, values: unknown) {
  const parsed = COLLECTION_SCHEMAS[name].safeParse(values)
  if (!parsed.success) throw invalid(parsed.error)
  return toRow(name, parsed.data as Record<string, unknown>)
}

const slugTaken = () =>
  new ApiError("CONFLICT", "That slug is already used", { slug: ["That slug is already used"] })

export async function createItem(actor: Actor, name: CollectionSlug, values: unknown) {
  const e = entryFor(name)
  const db = getDb()
  const row = parseValues(name, values)
  const [last] = await db
    .select({ next: sql<number>`coalesce(max(${e.table.sort}), -1) + 1` })
    .from(e.table)
  try {
    const [created] = await db
      .insert(e.table)
      .values({ ...(row as SharedInsert), sort: last?.next ?? 0, createdBy: actor.userId, updatedBy: actor.userId })
      .returning()
    await audit(actor, { action: "collection.create", entityType: name, entityId: created!.id, summary: `Added "${titleOf(name, created!)}" to ${name}` })
    invalidate([tags.collection(e.tag)])
    return toItem(name, created!, [])
  } catch (error) {
    if (isUniqueViolation(error)) throw slugTaken()
    throw error
  }
}

async function findItem(name: CollectionSlug, id: string) {
  const e = entryFor(name)
  const [row] = await getDb().select().from(e.table).where(eq(e.table.id, id)).limit(1)
  if (!row) throw new ApiError("NOT_FOUND", "That item doesn't exist")
  return row
}

// PATCH sends only what changed (a visibility toggle sends one field); the
// merged result must still pass the full schema.
export async function updateItem(actor: Actor, name: CollectionSlug, id: string,
  input: { version: number; values: Record<string, unknown> }
) {
  const e = entryFor(name)
  const db = getDb()
  const current = await findItem(name, id)
  const before = fromRow(name, current)
  const row = parseValues(name, { ...before, ...input.values })
  let updated
  try {
    ;[updated] = await db
      .update(e.table)
      .set({ ...(row as Partial<SharedInsert>), updatedBy: actor.userId, version: sql`${e.table.version} + 1` })
      .where(and(eq(e.table.id, id), eq(e.table.version, input.version)))
      .returning()
  } catch (error) {
    if (isUniqueViolation(error)) throw slugTaken()
    throw error
  }
  if (!updated) throw await conflictError(db, await findItem(name, id))
  await audit(actor, { action: "collection.update", entityType: name, entityId: id,
    summary: `Updated "${titleOf(name, updated)}" in ${name}`,
    diff: topLevelDiff(before, fromRow(name, updated)) })
  invalidate([tags.collection(e.tag)])
  return toItem(name, updated, [])
}

export async function deleteItem(actor: Actor, name: CollectionSlug, id: string) {
  const e = entryFor(name)
  const db = getDb()
  const row = await findItem(name, id)
  const { named } = (await collectionUsage(db))(e.tag, id)
  if (named.length > 0) {
    throw new ApiError("CONFLICT", `Still used on ${named.join(", ")}`, undefined, { usedOn: named })
  }
  await db.delete(e.table).where(eq(e.table.id, id))
  await audit(actor, { action: "collection.delete", entityType: name, entityId: id, summary: `Deleted "${titleOf(name, row)}" from ${name}` })
  invalidate([tags.collection(e.tag)])
  return { ok: true as const }
}

export async function reorderItems(actor: Actor, name: CollectionSlug, ids: string[]) {
  const e = entryFor(name)
  const db = getDb()
  const known = new Set((await db.select({ id: e.table.id }).from(e.table)).map((r) => r.id))
  const complete =
    ids.length === known.size && new Set(ids).size === ids.length && ids.every((id) => known.has(id))
  if (!complete) {
    throw new ApiError("VALIDATION_FAILED", "Send every item exactly once", { ids: ["Send every item exactly once"] })
  }
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx.update(e.table).set({ sort: index }).where(eq(e.table.id, id))
    }
    await audit(actor, { action: "collection.reorder", entityType: name, summary: `Reordered ${name}` }, tx)
  })
  invalidate([tags.collection(e.tag)])
  return { ok: true as const }
}

export async function itemOptions(actor: Actor, source: OptionSource) {
  if (source === "articles") {
    if (!hasPermission(actor.roles, { article: ["read"] })) {
      throw new ApiError("FORBIDDEN", "You don't have permission to do that")
    }
    const rows = await getDb()
      .select({ id: articles.id, label: articles.title })
      .from(articles)
      .orderBy(desc(articles.publishedAt))
    return { items: rows }
  }
  const e = entryFor(source)
  const rows = await getDb().select().from(e.table).orderBy(asc(e.table.sort))
  return { items: rows.map((row) => ({ id: row.id, label: titleOf(source, row) })) }
}
```

`server/modules/collections/routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { COLLECTION_NAMES } from "@/lib/content/collections"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import * as service from "./service"

const Name = z.object({ name: z.enum(COLLECTION_NAMES) })
const Item = Name.extend({ id: z.uuid() })
const Source = z.object({ name: z.enum([...COLLECTION_NAMES, "articles"] as const) })
const hook = validationHook

export const collectionsRoutes = new Hono<AppEnv>()
  .get("/:name/options", can({ collection: ["read"] }), zValidator("param", Source, hook), async (c) =>
    c.json(await service.itemOptions(c.get("actor")!, c.req.valid("param").name)))
  .get("/:name", can({ collection: ["read"] }), zValidator("param", Name, hook), async (c) =>
    c.json(await service.listItems(c.req.valid("param").name)))
  .post("/:name", can({ collection: ["create"] }), zValidator("param", Name, hook),
    zValidator("json", z.object({ values: z.record(z.string(), z.unknown()) }), hook), async (c) =>
      c.json(await service.createItem(c.get("actor")!, c.req.valid("param").name, c.req.valid("json").values), 201)
  )
  // Registered before /:name/:id so "order" never reads as an id.
  .patch("/:name/order", can({ collection: ["update"] }), zValidator("param", Name, hook),
    zValidator("json", z.object({ ids: z.array(z.uuid()).max(500) }), hook), async (c) =>
      c.json(await service.reorderItems(c.get("actor")!, c.req.valid("param").name, c.req.valid("json").ids)))
  .patch("/:name/:id", can({ collection: ["update"] }), zValidator("param", Item, hook),
    zValidator("json", z.object({ version: z.number().int().min(1), values: z.record(z.string(), z.unknown()) }), hook),
    async (c) => {
      const { name, id } = c.req.valid("param")
      return c.json(await service.updateItem(c.get("actor")!, name, id, c.req.valid("json"))) })
  .delete("/:name/:id", can({ collection: ["delete"] }), zValidator("param", Item, hook), async (c) => {
    const { name, id } = c.req.valid("param")
    return c.json(await service.deleteItem(c.get("actor")!, name, id)) })

export type CollectionsRoutes = typeof collectionsRoutes
```

Mount `.route("/collections", collectionsRoutes)`; add `collectionsApi = hc<CollectionsRoutes>("/api/v1/admin/collections")`.

`server/db/seed/index.ts`:

```ts
// docs/brief.md §6.7. Media first: every other table references it.
// A seeded database is left alone: re-running would resurrect rows an editor
// deleted (inserts are by stable id). System pages can't be deleted, so a
// non-empty pages table means "seeded". --force re-runs the idempotent
// inserts anyway (new fixtures in development).
export async function seedContent({ db = getDb(), force = false }: { db?: Db; force?: boolean } = {}) {
  if (!force && (await db.$count(pages)) > 0) return { skipped: true as const }
  const media = await seedMedia(db)
  await seedCollections(db)
  const pageCount = await seedPages(db)
  const globals = await seedGlobals(db)
  return { skipped: false as const, media, pages: pageCount, globals }
}
```

(import `pages` from `@/server/db/schema`). `scripts/seed.ts` passes `{ force: process.argv.includes("--force") }`.

- [ ] **Step 5: Run tests and gates**

Run: `pnpm test:integration tests/integration/api/collections.test.ts tests/integration/seed && pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/content/collections.ts server/modules/collections server/db/seed/index.ts scripts/seed.ts server/api/routes/admin.ts admin/lib/api.ts tests/integration
git commit -m "feat(content): generic collections API with usage guard and seed lock"
```

---

### Task 5: Media upload pipeline, storage drivers and Media API

**Files:**
- Install: `pnpm add @aws-sdk/client-s3@3.1141.0`
- Create: `server/lib/media/sniff.ts`, `server/lib/media/process.ts`, `server/lib/media/storage.ts`, `server/modules/media/usage.ts`, `server/modules/media/service.ts`, `server/modules/media/routes.ts`, `app/uploads/[...key]/route.ts`, `tests/support/gps-jpeg.ts`
- Modify: `server/env.ts`, `.env.example`, `next.config.ts`, `server/api/app.ts`, `server/api/routes/admin.ts`, `admin/lib/api.ts`, `vitest.config.ts` (only if `tests/support` is outside the unit include — it is not; nothing to change)
- Test: `server/lib/media/sniff.test.ts`, `server/lib/media/storage.test.ts`, `tests/integration/api/media.test.ts`

**Interfaces:**
- Consumes: `probeImage` (`server/lib/media/probe.ts`), `slugify`, `conflictError`, `tags.media`.
- Produces:
  - `sniff(bytes) → { mime, ext } | null`; `processUpload(buffer, filename, now?) → ProcessedUpload`; `MAX_UPLOAD_BYTES`; `getStorage() → { name, put, urlFor }`; `s3Config(env)`; `localFile(key) → { path, mimeType } | null`; `MEDIA_KEY` regex.
  - `MediaRoutes` at `/api/v1/admin/media`: `GET /` `?page&pageSize&q&type=image|pdf&missingAlt=1&ids=a,b` → `{ items: MediaItem[], page, pageSize, total }`; `POST /` multipart `file` → 201 `MediaItem`; `PATCH /:id` `{ alt?, caption?, focalX?, focalY?, isDecorative? }` → `MediaItem`; `POST /:id/replace` multipart → `MediaItem` (same id); `GET /:id/usage` → `{ items: { kind, id, label }[] }`; `DELETE /:id` → `{ ok }` or 409 `details.usage`. `MediaItem = { id, url, filename, mimeType, sizeBytes, width, height, blurDataUrl, dominantColor, alt, caption, focalX, focalY, isDecorative, needsAlt, createdAt, createdBy }`. `mediaApi` client.
  - `gpsJpeg(targetBytes?) → Promise<Buffer>` (shared by integration and E2E).

- [ ] **Step 1: Write the failing tests**

`tests/support/gps-jpeg.ts`:

```ts
import { randomFillSync } from "node:crypto"

import sharp from "sharp"

// A camera-like JPEG: GPS EXIF and noise, so it stays large after encoding.
export async function gpsJpeg(targetBytes = 15 * 1024 * 1024) {
  const width = 4000
  const height = 3000
  const noise = randomFillSync(Buffer.alloc(width * height * 3))
  for (const quality of [85, 90, 93, 96, 100]) {
    const out = await sharp(noise, { raw: { width, height, channels: 3 } })
      .withExif({ IFD0: { Make: "Test", Model: "Camera" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "53/1 20/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "6/1 15/1 0/1" },
      })
      .jpeg({ quality })
      .toBuffer()
    if (out.length >= targetBytes) return out
  }
  throw new Error("gpsJpeg: could not reach the target size")
}
```

`server/lib/media/sniff.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { sniff } from "./sniff"

const bytes = (...parts: (number[] | string)[]) =>
  Buffer.concat(parts.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : Buffer.from(p))))

describe("sniff", () => {
  it.each([[bytes([0xff, 0xd8, 0xff, 0xe0]), "jpg"],
    [bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "png"],
    [bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "), "webp"], [bytes([0, 0, 0, 0x1c], "ftypavif"), "avif"],
    [bytes("%PDF-1.7"), "pdf"]])("recognises %#", (input, ext) => expect(sniff(input)?.ext).toBe(ext))
  // §14: SVG is script, whatever its extension says.
  it.each([bytes("<svg xmlns='http://www.w3.org/2000/svg'/>"), bytes("GIF89a"), bytes("")])(
    "refuses %#", (input) => expect(sniff(input)).toBeNull()) })
```

`server/lib/media/storage.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { localFile, s3Config } from "./storage"

describe("media storage", () => {
  it("targets the R2 EU endpoint and only checksums when required", () => {
    const config = s3Config({ S3_ACCOUNT_ID: "acct", S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s" })
    expect(config).toMatchObject({ endpoint: "https://acct.eu.r2.cloudflarestorage.com",
      region: "auto", requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED", forcePathStyle: false }) })
  it("uses an explicit endpoint (S3 or a local emulator) with path-style URLs", () => {
    expect(s3Config({ S3_ENDPOINT: "http://localhost:9000", S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s" })).toMatchObject({
      endpoint: "http://localhost:9000",
      forcePathStyle: true }) })
  it.each(["../etc/passwd", "media/2026/10/../../x.jpg", "media/2026/10/abc.svg", "/etc/passwd"])(
    "never resolves %s", (key) => expect(localFile(key, "/srv/storage")).toBeNull())
  it("resolves a well-formed key inside the directory", () => {
    expect(localFile("media/2026/10/0123456789abcdef-photo.jpg", "/srv/storage")).toEqual({
      path: "/srv/storage/media/2026/10/0123456789abcdef-photo.jpg", mimeType: "image/jpeg" }) }) })
```

`tests/integration/api/media.test.ts`:

```ts
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import sharp from "sharp"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag }))

import { app } from "@/server/api/app"
import { closeDb } from "@/server/db/client"
import { resetEnvForTests } from "@/server/env"
import { resetStorageForTests } from "@/server/lib/media/storage"

import { gpsJpeg } from "../../support/gps-jpeg"
import { adminRequest, cookieFor, ORIGIN } from "../helpers/auth"
import { heroDocument, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

let dir = ""
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "mk-media-"))
  process.env.MEDIA_DRIVER = "local"
  process.env.MEDIA_LOCAL_DIR = dir
  resetEnvForTests()
  resetStorageForTests() })
beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset() })
afterAll(closeDb)

const upload = (cookie: string, body: Buffer, filename: string, path = "/media") => {
  const form = new FormData()
  form.set("file", new File([new Uint8Array(body)], filename))
  return app.request(`/api/v1/admin${path}`, { method: "POST", headers: { cookie, origin: ORIGIN }, body: form })
}
const png = () => sharp({ create: { width: 64, height: 48, channels: 3, background: "#3366aa" } }).png().toBuffer()

describe("media API", () => {
  // Acceptance: a 15 MB camera JPEG with GPS uploads, and the stored file
  // carries no EXIF at all.
  it("strips GPS and every other EXIF tag on upload", async () => {
    const input = await gpsJpeg()
    expect(input.length).toBeGreaterThanOrEqual(15 * 1024 * 1024)
    expect(input.length).toBeLessThan(20 * 1024 * 1024)
    expect((await sharp(input).metadata()).exif).toBeDefined()

    const response = await upload(await cookieFor("editor"), input, "IMG_0001.JPG")
    expect(response.status).toBe(201)
    const item = await response.json()
    expect(item).toMatchObject({ mimeType: "image/jpeg", width: 4000, height: 3000 })
    expect(item.url).toMatch(/^\/uploads\/media\/\d{4}\/\d{2}\/[a-f0-9]{16}-img-0001\.jpg$/)
    const stored = await readFile(join(dir, item.url.replace("/uploads/", "")))
    expect((await sharp(stored).metadata()).exif).toBeUndefined()
    expect(next.revalidateTag.mock.calls.map(([t]) => t)).toContain("media") })

  it("refuses SVG and oversize files", async () => {
    const cookie = await cookieFor("editor")
    const svg = await upload(cookie, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "x.jpg")
    expect(svg.status).toBe(400)
    const huge = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(22 * 1024 * 1024)])
    expect((await upload(cookie, huge, "huge.jpg")).status).toBe(413) })

  // Review Focus 2: authors edit only what they uploaded.
  it("lets an author edit only their own media", async () => {
    const editor = await cookieFor("editor")
    const author = await cookieFor("author")
    const theirs = await (await upload(editor, await png(), "a.png")).json()
    const mine = await (await upload(author, await png(), "b-different.png")).json()
    const patch = (cookie: string, id: string) =>
      adminRequest(`/media/${id}`, cookie, { method: "PATCH", body: { alt: "A calm room" } })
    expect((await patch(author, mine.id)).status).toBe(200)
    expect((await patch(author, theirs.id)).status).toBe(403)
    expect((await patch(await cookieFor("marketer"), theirs.id)).status).toBe(200) })

  it("replaces the file but keeps the id", async () => {
    const cookie = await cookieFor("editor")
    const item = await (await upload(cookie, await png(), "a.png")).json()
    const other = await sharp({ create: { width: 80, height: 40, channels: 3, background: "#aa3366" } }).png().toBuffer()
    const replaced = await (await upload(cookie, other, "new.png", `/media/${item.id}/replace`)).json()
    expect(replaced.id).toBe(item.id)
    expect(replaced.url).not.toBe(item.url)
    expect(replaced.width).toBe(80) })

  it("guards deletion while the image is in use", async () => {
    const cookie = await cookieFor("editor")
    const used = await (await upload(cookie, await png(), "used.png")).json()
    await insertPage({ path: "/team", document: heroDocument(used.id) })
    const blocked = await adminRequest(`/media/${used.id}`, cookie, { method: "DELETE" })
    expect(blocked.status).toBe(409)
    expect((await blocked.json()).error.details.usage[0]).toMatchObject({ kind: "page", label: "Test page" })
    const usage = await (await adminRequest(`/media/${used.id}/usage`, cookie)).json()
    expect(usage.items).toHaveLength(1) })

  it.each([["viewer", 403], ["intake", 403], ["author", 200]] as const)("GET /media as %s → %i",
    async (role, status) => {
      expect((await adminRequest("/media", await cookieFor(role))).status).toBe(status)
    }) })
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run --project unit server/lib/media && pnpm test:integration tests/integration/api/media.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the pipeline**

`server/env.ts` — add to the object:

```ts
    // docs/brief.md §14. "local" writes to a mounted directory served by
    // app/uploads; "s3" is Cloudflare R2 (EU) or any S3 endpoint.
    MEDIA_DRIVER: z.enum(["local", "s3"]).default("local"),
    MEDIA_LOCAL_DIR: z.string().min(1).default("./storage"), MEDIA_PUBLIC_URL: z.url().optional(),
    S3_ACCOUNT_ID: z.string().optional(), S3_ENDPOINT: z.url().optional(), S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(), S3_SECRET_ACCESS_KEY: z.string().optional(),
```

and to `superRefine`:

```ts
    if (env.MEDIA_DRIVER === "s3") {
      for (const name of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "MEDIA_PUBLIC_URL"] as const) {
        if (!env[name]) ctx.addIssue({ code: "custom", path: [name], message: `${name} is required when MEDIA_DRIVER is "s3"` })
      }
      if (!env.S3_ACCOUNT_ID && !env.S3_ENDPOINT) {
        ctx.addIssue({ code: "custom", path: ["S3_ACCOUNT_ID"], message: "Set S3_ACCOUNT_ID (R2) or S3_ENDPOINT" })
      }
    }
```

Document the same variables (commented, with the R2 note) in `.env.example`.

`server/lib/media/sniff.ts`:

```ts
import "server-only"

// docs/brief.md §14: the allowlist is checked against the bytes, never the
// filename or the browser's Content-Type. SVG is not on it (script).
export type Sniffed =
  | { mime: "image/jpeg"; ext: "jpg" }
  | { mime: "image/png"; ext: "png" }
  | { mime: "image/webp"; ext: "webp" }
  | { mime: "image/avif"; ext: "avif" }
  | { mime: "application/pdf"; ext: "pdf" }

export function sniff(bytes: Uint8Array): Sniffed | null {
  const at = (offset: number, signature: readonly number[]) =>
    signature.every((byte, i) => bytes[offset + i] === byte)
  const ascii = (offset: number, text: string) =>
    at(offset, [...text].map((ch) => ch.charCodeAt(0)))
  if (at(0, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" }
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" }
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return { mime: "image/webp", ext: "webp" }
  if (ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) return { mime: "image/avif", ext: "avif" }
  if (ascii(0, "%PDF-")) return { mime: "application/pdf", ext: "pdf" }
  return null
}
```

`server/lib/media/process.ts`:

```ts
import "server-only"

import { createHash } from "node:crypto"

import sharp from "sharp"

import { slugify } from "@/lib/utils"
import { ApiError } from "@/server/api/errors"

import { probeImage } from "./probe"
import { sniff, type Sniffed } from "./sniff"

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const MAX_EDGE = 4000

export type ProcessedUpload = { body: Buffer
  key: string
  mimeType: Sniffed["mime"]
  sizeBytes: number
  width: number | null
  height: number | null
  blurDataUrl: string | null
  dominantColor: string | null
}

// autoOrient bakes the EXIF rotation into the pixels; sharp writes no
// metadata unless asked, so EXIF (GPS included), XMP and IPTC go here.
async function normalise(input: Buffer, type: Sniffed) {
  const image = sharp(input, { failOn: "error" })
    .autoOrient()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
  switch (type.ext) {
    case "jpg":
      return image.jpeg({ quality: 88, mozjpeg: true }).toBuffer()
    case "png":
      return image.png({ compressionLevel: 9 }).toBuffer()
    case "webp":
      return image.webp({ quality: 88 }).toBuffer()
    case "avif":
      return image.avif({ quality: 60 }).toBuffer()
    default:
      throw new Error(`normalise: ${type.ext} is not an image`)
  }
}

export async function processUpload(input: Buffer, filename: string, now = new Date()
): Promise<ProcessedUpload> {
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "Files can be up to 20 MB")
  }
  const type = sniff(input)
  if (!type) {
    throw new ApiError("VALIDATION_FAILED", "Upload a JPEG, PNG, WebP, AVIF or PDF", {
      file: ["Upload a JPEG, PNG, WebP, AVIF or PDF"] })
  }
  let body = input
  let probe = { width: null as number | null, height: null as number | null, blurDataUrl: null as string | null, dominantColor: null as string | null }
  if (type.ext !== "pdf") {
    try {
      body = await normalise(input, type)
    } catch {
      throw new ApiError("VALIDATION_FAILED", "That image could not be read", { file: ["That image could not be read"] })
    }
    probe = await probeImage(body)
  }
  // Content-hashed and immutable (docs/brief.md §14): a replace gets a new key.
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 16)
  const slug = slugify(filename.replace(/\.[^.]*$/, "")).slice(0, 60) || "file"
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return { body, key: `media/${now.getUTCFullYear()}/${month}/${hash}-${slug}.${type.ext}`,
    mimeType: type.mime, sizeBytes: body.length, ...probe }
}
```

`server/lib/media/storage.ts`:

```ts
import "server-only"

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { getEnv, type Env } from "@/server/env"

export const MEDIA_KEY =
  /^media\/\d{4}\/\d{2}\/[a-f0-9]{16}-[a-z0-9-]{1,60}\.(jpg|png|webp|avif|pdf)$/

const MIME_BY_EXT = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif",
  pdf: "application/pdf" } as const

export type StorageDriver = { name: "local" | "s3"
  put(key: string, body: Buffer, mimeType: string): Promise<void>
  urlFor(key: string): string
}

// A key that passes MEDIA_KEY cannot climb out of the directory; the prefix
// check is a second lock.
export function localFile(key: string, dir = getEnv().MEDIA_LOCAL_DIR) {
  const match = MEDIA_KEY.exec(key)
  if (!match) return null
  const root = path.resolve(dir)
  const file = path.resolve(root, key)
  if (!file.startsWith(root + path.sep)) return null
  return { path: file, mimeType: MIME_BY_EXT[match[1] as keyof typeof MIME_BY_EXT] }
}

type S3Env = Pick<Env, "S3_ACCOUNT_ID" | "S3_ENDPOINT" | "S3_ACCESS_KEY_ID" | "S3_SECRET_ACCESS_KEY">

// R2's EU jurisdiction endpoint unless an explicit one is given (S3, or a
// local RustFS emulator). R2 rejects the SDK's default CRC checksums, hence
// WHEN_REQUIRED (docs/plan.md Phase 4.7).
export function s3Config(env: S3Env) {
  return { region: "auto",
    endpoint: env.S3_ENDPOINT ?? `https://${env.S3_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "" },
    requestChecksumCalculation: "WHEN_REQUIRED" as const,
    responseChecksumValidation: "WHEN_REQUIRED" as const }
}

const CACHE = "public, max-age=31536000, immutable"

let cached: StorageDriver | undefined

export function getStorage(): StorageDriver {
  if (cached) return cached
  const env = getEnv()
  if (env.MEDIA_DRIVER === "s3") {
    const base = env.MEDIA_PUBLIC_URL!.replace(/\/$/, "")
    cached = { name: "s3",
      // Loaded on first upload, so the local driver never pulls in the SDK.
      async put(key, body, mimeType) {
        const { PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3")
        const client = new S3Client(s3Config(env))
        await client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: mimeType, CacheControl: CACHE }))
      }, urlFor: (key) => `${base}/${key}` }
  } else {
    cached = { name: "local", async put(key, body) {
        const file = localFile(key, env.MEDIA_LOCAL_DIR)
        if (!file) throw new Error(`Refusing media key ${key}`)
        await mkdir(path.dirname(file.path), { recursive: true })
        // Same key = same bytes (content hash): an existing file is fine.
        await writeFile(file.path, body, { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "EEXIST") throw error })
      }, urlFor: (key) => `/uploads/${key}` }
  }
  return cached
}

// Tests switch drivers through env.
export function resetStorageForTests() {
  cached = undefined
}
```

`app/uploads/[...key]/route.ts`:

```ts
import { readFile } from "node:fs/promises"

import { localFile } from "@/server/lib/media/storage"

// Serves the `local` driver (docs/brief.md §14). Keys are content-hashed,
// so responses are immutable. The CSP sandbox keeps a crafted PDF inert.
export async function GET(_request: Request, ctx: RouteContext<"/uploads/[...key]">) {
  const { key } = await ctx.params
  const file = localFile(key.join("/"))
  if (!file) return new Response("Not found", { status: 404 })
  try {
    return new Response(new Uint8Array(await readFile(file.path)), { headers: { "Content-Type": file.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox" } })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
```

`next.config.ts` — inside `images` add (computed at build from the Docker build arg; absent in CI):

```ts
    qualities: [75, 90],
    // Static assets and the local driver; anything else is refused.
    localPatterns: [{ pathname: "/images/**", search: "" }, { pathname: "/uploads/**", search: "" }],
    remotePatterns: mediaRemotePatterns(),
```

with, above `nextConfig`:

```ts
// The s3 driver's public host (docs/brief.md §14). Read at build: Dokploy
// passes MEDIA_PUBLIC_URL as a build arg when the s3 driver is used.
function mediaRemotePatterns() {
  const raw = process.env.MEDIA_PUBLIC_URL
  if (!raw) return []
  const url = new URL(raw)
  return [{ protocol: "https" as const, hostname: url.hostname, pathname: `${url.pathname.replace(/\/$/, "")}/**` }]
}
```

First run `grep -rn "quality=" components features app` — if any component passes a quality other than 75 or 90, add it to `qualities`.

`server/api/app.ts` — replace the single `bodyLimit` use:

```ts
const ADMIN_BODY_LIMIT = 1024 * 1024
// The upload routes take a 20 MB file plus multipart framing (§8.1).
const UPLOAD_BODY_LIMIT = 21 * 1024 * 1024
const UPLOAD_PATH = /^\/api\/v1\/admin\/media(?:\/[^/]+\/replace)?$/

const tooLarge = (c: Context) =>
  c.json(errorBody("PAYLOAD_TOO_LARGE", "Request body is too large", c.get("requestId")), 413)
const adminLimit = bodyLimit({ maxSize: ADMIN_BODY_LIMIT, onError: tooLarge })
const uploadLimit = bodyLimit({ maxSize: UPLOAD_BODY_LIMIT, onError: tooLarge })
```

and in the chain `.use("/v1/admin/*", (c, next) => c.req.method === "POST" && UPLOAD_PATH.test(c.req.path) ? uploadLimit(c, next) : adminLimit(c, next))` (`import type { Context } from "hono"`).

- [ ] **Step 4: Implement the service and routes**

`server/modules/media/usage.ts`:

```ts
import "server-only"

import { eq, or, sql, type AnyColumn } from "drizzle-orm"

import type { DbLike } from "@/server/db/client"
import * as t from "@/server/db/schema"

export type MediaUse = { kind: "page" | "setting" | "collection" | "author" | "article"; id: string; label: string }

// docs/brief.md §14: usage is found by scanning documents for the id (JSON
// documents) and the image foreign keys. It feeds the drawer and the delete
// guard.
export async function mediaUsage(db: DbLike, id: string): Promise<MediaUse[]> {
  const like = `%${id}%`
  const text = (column: AnyColumn) => sql`${column}::text like ${like}`
  const [pageRows, settingRows, testimonialRows, stepRows, bandRows, authorRows, articleRows] = await Promise.all([
    db.select({ id: t.pages.id, label: t.pages.title }).from(t.pages)
      .where(or(text(t.pages.draft), text(t.pages.published), text(t.pages.seo))),
    db.select({ id: t.settings.key, label: t.settings.key }).from(t.settings)
      .where(or(text(t.settings.value), text(t.settings.draft))),
    db.select({ id: t.testimonials.id, label: t.testimonials.authorName }).from(t.testimonials).where(eq(t.testimonials.avatarId, id)),
    db.select({ id: t.processSteps.id, label: t.processSteps.title }).from(t.processSteps).where(eq(t.processSteps.imageId, id)),
    db.select({ id: t.ctaBands.id, label: t.ctaBands.name }).from(t.ctaBands).where(eq(t.ctaBands.imageId, id)),
    db.select({ id: t.authors.id, label: t.authors.name }).from(t.authors).where(eq(t.authors.avatarId, id)),
    db.select({ id: t.articles.id, label: t.articles.title }).from(t.articles)
      .where(or(eq(t.articles.coverId, id), text(t.articles.draft), text(t.articles.seo)))])
  return [...pageRows.map((r) => ({ kind: "page" as const, ...r })),
    ...settingRows.map((r) => ({ kind: "setting" as const, ...r })),
    ...[...testimonialRows, ...stepRows, ...bandRows].map((r) => ({ kind: "collection" as const, ...r })),
    ...authorRows.map((r) => ({ kind: "author" as const, ...r })),
    ...articleRows.map((r) => ({ kind: "article" as const, ...r }))]
}
```

`server/modules/media/service.ts`:

```ts
import "server-only"

import { and, count, desc, eq, ilike, inArray, isNull, like, or, type SQL } from "drizzle-orm"
import * as z from "zod"

import { hasPermission, type RoleName } from "@/lib/auth/permissions"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb } from "@/server/db/client"
import { media } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { isUniqueViolation, topLevelDiff } from "@/server/lib/conflict"
import { processUpload } from "@/server/lib/media/process"
import { getStorage } from "@/server/lib/media/storage"

import { mediaUsage } from "./usage"

type MediaRow = typeof media.$inferSelect

export const MediaListQuery = z.object({ page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(40), q: z.string().trim().max(80).optional(),
  type: z.enum(["image", "pdf"]).optional(), missingAlt: z.literal("1").optional(),
  // The picker resolves its current value(s) by id.
  ids: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",") : undefined))
    .pipe(z.array(z.uuid()).max(100).optional()) })
export const MediaPatch = z
  .object({ alt: z.string().trim().max(300), caption: z.string().trim().max(500).nullable(),
    focalX: z.number().min(0).max(1), focalY: z.number().min(0).max(1), isDecorative: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change")

const toItem = (row: MediaRow) => ({ id: row.id, url: row.url, filename: row.filename, mimeType: row.mimeType,
  sizeBytes: row.sizeBytes, width: row.width, height: row.height, blurDataUrl: row.blurDataUrl,
  dominantColor: row.dominantColor, alt: row.alt, caption: row.caption, focalX: row.focalX,
  focalY: row.focalY, isDecorative: row.isDecorative, needsAlt: row.needsAlt, createdAt: row.createdAt,
  createdBy: row.createdBy })

export async function listMedia(query: z.output<typeof MediaListQuery>) {
  const filters: SQL[] = [isNull(media.deletedAt)]
  if (query.q) filters.push(or(ilike(media.filename, `%${query.q}%`), ilike(media.alt, `%${query.q}%`))!)
  if (query.type === "image") filters.push(like(media.mimeType, "image/%"))
  if (query.type === "pdf") filters.push(eq(media.mimeType, "application/pdf"))
  if (query.missingAlt) filters.push(and(eq(media.alt, ""), eq(media.isDecorative, false), like(media.mimeType, "image/%"))!)
  if (query.ids) filters.push(inArray(media.id, query.ids))
  const where = and(...filters)
  const db = getDb()
  const [rows, [total]] = await Promise.all([
    db.select().from(media).where(where).orderBy(desc(media.createdAt))
      .limit(query.pageSize).offset((query.page - 1) * query.pageSize),
    db.select({ n: count() }).from(media).where(where)])
  return { items: rows.map(toItem), page: query.page, pageSize: query.pageSize, total: total?.n ?? 0 }
}

async function findLive(id: string) {
  const [row] = await getDb().select().from(media).where(and(eq(media.id, id), isNull(media.deletedAt))).limit(1)
  if (!row) throw new ApiError("NOT_FOUND", "That file doesn't exist")
  return row
}

// docs/brief.md §7.2: media.update is "own" for authors. Any other role that
// holds it may edit every file.
const OWN_ONLY: readonly RoleName[] = ["author"]
function assertMayEdit(actor: Actor, row: MediaRow) {
  const anyFile = hasPermission(actor.roles.filter((r) => !OWN_ONLY.includes(r)), { media: ["update"] })
  if (!anyFile && row.createdBy !== actor.userId) {
    throw new ApiError("FORBIDDEN", "You can only edit files you uploaded")
  }
}

const duplicate = () => new ApiError("CONFLICT", "That file is already in the library")

export async function uploadMedia(actor: Actor, file: File) {
  const processed = await processUpload(Buffer.from(await file.arrayBuffer()), file.name)
  const storage = getStorage()
  await storage.put(processed.key, processed.body, processed.mimeType)
  const values = { driver: storage.name, key: processed.key, url: storage.urlFor(processed.key),
    filename: file.name.slice(0, 200), mimeType: processed.mimeType, sizeBytes: processed.sizeBytes,
    width: processed.width, height: processed.height, blurDataUrl: processed.blurDataUrl,
    dominantColor: processed.dominantColor, createdBy: actor.userId }
  // The same bytes twice: bring the existing row back instead of failing.
  const [row] = await getDb()
    .insert(media)
    .values(values)
    .onConflictDoUpdate({ target: media.key, set: { deletedAt: null } })
    .returning()
  await audit(actor, { action: "media.upload", entityType: "media", entityId: row!.id, summary: `Uploaded ${row!.filename}` })
  invalidate([tags.media])
  return toItem(row!)
}

export async function updateMedia(actor: Actor, id: string, patch: z.output<typeof MediaPatch>) {
  const before = await findLive(id)
  assertMayEdit(actor, before)
  const [row] = await getDb()
    .update(media)
    .set({ ...patch, ...(patch.alt !== undefined && { needsAlt: false }) })
    .where(eq(media.id, id))
    .returning()
  await audit(actor, { action: "media.update", entityType: "media", entityId: id,
    summary: `Updated ${before.filename}`, diff: topLevelDiff(
      Object.fromEntries(Object.keys(patch).map((k) => [k, before[k as keyof MediaRow]])), patch) })
  invalidate([tags.media])
  return toItem(row!)
}

// docs/brief.md §14: replace keeps the id (and so every reference) and
// uploads under a new immutable key.
export async function replaceMedia(actor: Actor, id: string, file: File) {
  const before = await findLive(id)
  assertMayEdit(actor, before)
  const processed = await processUpload(Buffer.from(await file.arrayBuffer()), file.name)
  if ((before.mimeType === "application/pdf") !== (processed.mimeType === "application/pdf")) {
    throw new ApiError("VALIDATION_FAILED", "Replace an image with an image, a PDF with a PDF", {
      file: ["Replace an image with an image, a PDF with a PDF"] })
  }
  const storage = getStorage()
  await storage.put(processed.key, processed.body, processed.mimeType)
  let row
  try {
    ;[row] = await getDb()
      .update(media)
      .set({ driver: storage.name, key: processed.key, url: storage.urlFor(processed.key),
        filename: file.name.slice(0, 200), mimeType: processed.mimeType, sizeBytes: processed.sizeBytes,
        width: processed.width, height: processed.height, blurDataUrl: processed.blurDataUrl,
        dominantColor: processed.dominantColor })
      .where(eq(media.id, id))
      .returning()
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicate()
    throw error
  }
  await audit(actor, { action: "media.replace", entityType: "media", entityId: id, summary: `Replaced ${before.filename} with ${file.name}` })
  invalidate([tags.media])
  return toItem(row!)
}

export async function usageOf(id: string) {
  await findLive(id)
  return { items: await mediaUsage(getDb(), id) }
}

export async function deleteMedia(actor: Actor, id: string) {
  const row = await findLive(id)
  const usage = await mediaUsage(getDb(), id)
  if (usage.length > 0) {
    throw new ApiError("CONFLICT", "This file is still in use", undefined, { usage })
  }
  // Soft delete: old revisions may still name it, and publish refuses
  // deleted media (server/modules/pages/service.ts).
  await getDb().update(media).set({ deletedAt: new Date() }).where(eq(media.id, id))
  await audit(actor, { action: "media.delete", entityType: "media", entityId: id, summary: `Deleted ${row.filename}` })
  invalidate([tags.media])
  return { ok: true as const }
}
```

`server/modules/media/routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono, type Context } from "hono"
import * as z from "zod"

import { ApiError, validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import * as service from "./service"

const Id = z.object({ id: z.uuid() })
const hook = validationHook

async function fileFrom(c: Context<AppEnv>) {
  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) {
    throw new ApiError("VALIDATION_FAILED", "Choose a file to upload", { file: ["Choose a file to upload"] })
  }
  return file
}

export const mediaRoutes = new Hono<AppEnv>()
  .get("/", can({ media: ["read"] }), zValidator("query", service.MediaListQuery, hook), async (c) =>
    c.json(await service.listMedia(c.req.valid("query"))))
  .post("/", can({ media: ["upload"] }), async (c) =>
    c.json(await service.uploadMedia(c.get("actor")!, await fileFrom(c)), 201))
  .patch("/:id", can({ media: ["update"] }), zValidator("param", Id, hook), zValidator("json", service.MediaPatch, hook), async (c) =>
    c.json(await service.updateMedia(c.get("actor")!, c.req.valid("param").id, c.req.valid("json"))))
  .post("/:id/replace", can({ media: ["update"] }), zValidator("param", Id, hook), async (c) =>
    c.json(await service.replaceMedia(c.get("actor")!, c.req.valid("param").id, await fileFrom(c))))
  .get("/:id/usage", can({ media: ["read"] }), zValidator("param", Id, hook), async (c) =>
    c.json(await service.usageOf(c.req.valid("param").id)))
  .delete("/:id", can({ media: ["delete"] }), zValidator("param", Id, hook), async (c) =>
    c.json(await service.deleteMedia(c.get("actor")!, c.req.valid("param").id)))

export type MediaRoutes = typeof mediaRoutes
```

Mount `.route("/media", mediaRoutes)`; add `mediaApi = hc<MediaRoutes>("/api/v1/admin/media")`.

- [ ] **Step 5: Run tests and gates**

Run: `pnpm vitest run --project unit server/lib/media && pnpm test:integration tests/integration/api/media.test.ts && pnpm lint && pnpm typecheck && pnpm build`
Expected: PASS. If the 413 case returns 400, the multipart framing pushed the request past 21 MB before the sniff — that is the intended path (`bodyLimit` answers 413); a 400 means the body limit is not applied to `/media`: check `UPLOAD_PATH` against `c.req.path`.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml server/env.ts .env.example next.config.ts server/api/app.ts server/lib/media server/modules/media app/uploads server/api/routes/admin.ts admin/lib/api.ts tests/support tests/integration/api/media.test.ts
git commit -m "feat(media): upload pipeline that strips EXIF, local and R2 drivers"
```

---
### Task 6: SchemaForm widgets for content

**Files:**
- Install: `pnpm add @tiptap/core@3.31.3 @tiptap/pm@3.31.3 @tiptap/react@3.31.3 @tiptap/starter-kit@3.31.3`
- Modify: `admin/components/schema-form/registry.ts`, `admin/components/schema-form/to-fields.ts`, `admin/components/schema-form/widgets.tsx`, `admin/components/schema-form/schema-form.tsx`, `admin/lib/query-keys.ts`
- Create: `admin/components/schema-form/field-ui.ts`, `admin/components/schema-form/widgets/{shell,media-widget,link-widget,icon-widget,stat-widget,rich-text-widget,collection-widget,colour-widget,focal-widget}.tsx`, `admin/modules/media/queries.ts`, `admin/modules/pages/queries.ts`, `admin/modules/collections/queries.ts`, `admin/modules/pages/block-ui.ts`
- Test: `admin/components/schema-form/to-fields.test.ts` (extend), `admin/components/schema-form/schema-form.test.tsx` (extend), `admin/modules/pages/block-ui.test.ts`

**Interfaces:**
- Consumes: `pagesApi` (`GET /` with `anchors`), `mediaApi` (`GET /?ids=`), `collectionsApi` (`GET /:name/options`), `OptionSource`, `CONTENT_ICONS`, `RichTextDoc`, `Href`.
- Produces:
  - `Widget` adds `"media" | "link" | "icon" | "stat" | "richtext" | "collection" | "colour" | "focal"`; `UiMeta.label` becomes optional; `UiMeta` gains `step?: number`, `collection?: OptionSource`.
  - `toFields(schema, overrides?: FieldOverrides)`; `FormField` gains `nullable?`, `minimum?`, `maximum?`, `step?`, `collection?`, `node: JsonNode`; list items are named `<list>.$…` and rendered via `rebase(field, from, to)`.
  - `emptyValue(node)`, `emptyValueFor(schema)`: a structurally complete starting value (used by "Add" buttons and new blocks).
  - `SchemaForm` prop `overrides?: FieldOverrides`; `FieldWidget({ field, control })` renders every widget.
  - `WidgetProps<T> = { field: FormField; value: T; onChange(value: T): void; onBlur?(): void; error?: string }`.
  - Queries: `mediaListQuery(params: MediaListParams)`, types `MediaItem`; `pagesListQuery()`, type `PageSummary`; `collectionOptionsQuery(source)`.
  - `BLOCK_FIELD_UI: Partial<Record<BlockType, FieldOverrides>>`.
  - Query keys: `pages.{all,list,detail(id),revisions(id)}`, `media.{all,list(p),usage(id)}`, `collections.{all,list(name),options(source)}`, `globals.{detail(key),revisions(key)}`.

**Per-block widget checklist** (what `block-ui.test.ts` asserts; everything else is inferred text/textarea/number/toggle/select/list/group):

| Block | Field → widget |
| --- | --- |
| `hero.home` | `primaryCta`, `secondaryCta` → link · `members.count` → stat · `members.avatars` → list of media (exactly 3) |
| `hero.page` | `image` → media · `focal` → focal (nullable) · `tint` → number step 0.01 |
| `credibility` | `badges` → list of group, `badges.$.icon` → icon |
| `about.intro` | `paragraphs` → list of textarea · `stats` → list of group with `value` → stat · `cta` → link |
| `process` | `cta` → link |
| `testimonials` | `selection` → collection `testimonials` |
| `band` | `bandId` → collection `cta-bands` (single) · `tint` → number (nullable) |
| `insights.latest` | `cta` → link · `selection` → collection `articles` |
| `faq` | `selection` → collection `faqs` · `initiallyOpen` → number (nullable) |
| `about.story` | `paragraphs` → list of textarea · `badge.value` → stat · `photo` → media |
| `about.stats` | `stats` → list of group, `value` → stat |
| `about.approach` | `principles` → list of group (exactly 3), `icon` → icon |
| `about.credentials` | `cta` → link · `items.$.url` → text (nullable) |
| `services.grid` | `more` → link |
| `newsletter` | `override` → group (nullable, toggled) |
| `contact.clinic` | `photo` → media |
| `richtext` | `doc` → richtext · `width` → select |

- [ ] **Step 1: Write the failing tests**

Append to `admin/components/schema-form/to-fields.test.ts` (merge imports):

```ts
import * as z from "zod"

import { MediaRef, Selection, Stat, StatValue } from "@/blocks/fields"
import { BLOCKS } from "@/blocks/registry"

import { emptyValueFor, rebase, toFields } from "./to-fields"

describe("content fields", () => {
  it("unwraps nullable fields and keeps their widget", () => {
    const [field] = toFields(z.object({ image: MediaRef.nullable() }))
    expect(field).toMatchObject({ name: "image", widget: "media", nullable: true, required: false }) })
  it("names list items with a placeholder that rebase replaces", () => {
    const [list] = toFields(z.object({ stats: z.array(Stat).min(1).max(4) }))
    expect(list!.item!.widget).toBe("group")
    expect(list!.item!.fields!.map((f) => f.name)).toEqual(["stats.$.value", "stats.$.label"])
    expect(list!.item!.fields![0]!.widget).toBe("stat")
    const second = rebase(list!.item!, "stats.$", "stats.1")
    expect(second.fields!.map((f) => f.name)).toEqual(["stats.1.value", "stats.1.label"]) })
  it("applies overrides by dotted path", () => {
    const [field] = toFields(z.object({ bandId: z.uuid() }), {
      bandId: { widget: "collection", collection: "cta-bands", label: "Band" } })
    expect(field).toMatchObject({ widget: "collection", collection: "cta-bands", label: "Band" }) })
  it("builds structurally complete starting values", () => {
    expect(emptyValueFor(z.object({ s: Selection }))).toEqual({ s: { mode: "all" } })
    expect(emptyValueFor(z.object({ v: StatValue }))).toEqual({
      v: { kind: "count", value: 0, decimals: 0, prefix: "", suffix: "" } })
    for (const block of BLOCKS) {
      const value = emptyValueFor(block.schema) as Record<string, unknown>
      expect(Object.keys(value), block.type).toEqual(Object.keys(block.schema.shape))
    } }) })
```

`admin/modules/pages/block-ui.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import type { FormField } from "@/admin/components/schema-form/to-fields"
import { toFields } from "@/admin/components/schema-form/to-fields"
import { BLOCK_BY_TYPE, BLOCKS, type BlockType } from "@/blocks/registry"

import { BLOCK_FIELD_UI } from "./block-ui"

const all = (fields: FormField[]): FormField[] =>
  fields.flatMap((f) => [f, ...all(f.fields ?? []), ...(f.item ? all([f.item]) : [])])
const fieldsOf = (type: BlockType) =>
  all(toFields(BLOCK_BY_TYPE[type].schema, BLOCK_FIELD_UI[type]))
const at = (type: BlockType, name: string) => {
  const field = fieldsOf(type).find((f) => f.name === name)
  if (!field) throw new Error(`${type}: no field ${name}`)
  return field
}

describe("block widgets (the checklist in the plan)", () => {
  it.each([["hero.home", "primaryCta", "link"], ["hero.home", "members.count", "stat"],
    ["hero.home", "members.avatars.$", "media"], ["hero.page", "image", "media"],
    ["hero.page", "focal", "focal"], ["credibility", "badges.$.icon", "icon"],
    ["about.intro", "paragraphs.$", "textarea"], ["about.intro", "stats.$.value", "stat"],
    ["about.story", "badge.value", "stat"], ["about.approach", "principles.$.icon", "icon"],
    ["testimonials", "selection", "collection"], ["band", "bandId", "collection"],
    ["insights.latest", "selection", "collection"], ["faq", "selection", "collection"],
    ["richtext", "doc", "richtext"], ["contact.clinic", "photo", "media"],
  ] as const)("%s %s → %s", (type, name, widget) => {
    expect(at(type, name).widget).toBe(widget) })
  it("names the source of every collection picker", () => {
    expect(at("testimonials", "selection").collection).toBe("testimonials")
    expect(at("band", "bandId").collection).toBe("cta-bands")
    expect(at("insights.latest", "selection").collection).toBe("articles")
    expect(at("faq", "selection").collection).toBe("faqs")
    for (const block of BLOCKS) {
      for (const field of fieldsOf(block.type)) {
        if (field.widget === "collection") expect(field.collection, `${block.type} ${field.name}`).toBeDefined()
      }
    } })
  it("marks the optional parts nullable", () => {
    expect(at("hero.page", "focal").nullable).toBe(true)
    expect(at("band", "tint").nullable).toBe(true)
    expect(at("newsletter", "override").nullable).toBe(true)
    expect(at("about.credentials", "items.$.url").nullable).toBe(true) }) })
```

Append to `admin/components/schema-form/schema-form.test.tsx` (merge imports; it already renders `SchemaForm`):

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { LinkValue, Stat } from "@/blocks/fields"

describe("content widgets", () => {
  it("adds an object item to a list and renders link fields", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [], page: 1, pageSize: 0, total: 0 })))
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SchemaForm schema={z.object({ cta: LinkValue, stats: z.array(Stat).max(4) })}
          defaultValues={{ cta: { label: "", href: "" }, stats: [] }}
          onSubmit={() => {}}
          submitLabel="Save"
        />
      </QueryClientProvider>)
    expect(screen.getByLabelText("Link text")).toBeTruthy()
    expect(screen.getByLabelText("Link target")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Add to stats" }))
    expect(screen.getByRole("group", { name: "Stats 1" })).toBeTruthy()
    vi.unstubAllGlobals() }) })
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run --project unit admin/components/schema-form admin/modules/pages`
Expected: FAIL (`rebase`, `emptyValueFor`, `block-ui` missing; MediaRef renders as a group).

- [ ] **Step 3: Extend the registry and the JSON-Schema walk**

`admin/components/schema-form/registry.ts`:

```ts
import * as z from "zod"

import type { OptionSource } from "@/lib/content/collections"

export type Widget =
  | "text"
  | "textarea"
  | "number"
  | "toggle"
  | "select"
  | "radio"
  | "list"
  | "group"
  | "media"
  | "link"
  | "icon"
  | "stat"
  | "richtext"
  | "collection"
  | "colour"
  | "focal"

export type UiMeta = {
  // Optional: shared field schemas (field-ui.ts) take the field's own name.
  label?: string
  description?: string
  placeholder?: string
  widget?: Widget
  options?: readonly { value: string; label: string }[]
  inputType?: "text" | "email" | "password" | "url" | "tel"
  autoComplete?: string
  step?: number
  collection?: OptionSource
}

export const ui = z.registry<UiMeta>()
```

`admin/components/schema-form/field-ui.ts`:

```ts
import { Focal, IconField, LinkValue, MediaRef, Selection, StatValue, Tint } from "@/blocks/fields"
import { RichTextDoc } from "@/blocks/rich-text"

import { ui } from "./registry"

// Shared field schemas → widgets, once for every form (blocks, globals,
// collections reuse the same instances). Labels come from the field name.
ui.add(MediaRef, { widget: "media" })
ui.add(LinkValue, { widget: "link" })
ui.add(IconField, { widget: "icon" })
ui.add(StatValue, { widget: "stat" })
ui.add(Focal, { widget: "focal" })
ui.add(RichTextDoc, { widget: "richtext" })
ui.add(Selection, { widget: "collection" })
ui.add(Tint, { widget: "number", step: 0.05 })
```

`admin/components/schema-form/to-fields.ts` — replace the file:

```ts
import * as z from "zod"

import type { OptionSource } from "@/lib/content/collections"

import "./field-ui"
import { ui, type UiMeta, type Widget } from "./registry"

export type FieldOverrides = Readonly<Record<string, Partial<UiMeta>>>

export type JsonNode = { type?: string | string[]
  properties?: Record<string, JsonNode>
  required?: string[]
  items?: JsonNode
  enum?: unknown[]
  const?: unknown
  default?: unknown
  anyOf?: JsonNode[]
  oneOf?: JsonNode[]
  maxLength?: number
  minItems?: number
  maxItems?: number
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  "x-ui"?: UiMeta
}

export type FormField = { name: string
  label: string
  widget: Widget
  required: boolean
  nullable?: boolean
  description?: string
  placeholder?: string
  inputType?: UiMeta["inputType"]
  autoComplete?: string
  maxLength?: number
  minItems?: number
  maxItems?: number
  minimum?: number
  maximum?: number
  step?: number
  options?: { value: string; label: string }[]
  fields?: FormField[]
  item?: FormField
  collection?: OptionSource
  // The field's JSON Schema, for widgets that build values.
  node: JsonNode
}

// Input shape (defaults make fields optional). Refinements are not
// representable and are dropped here; validation uses the Zod schema itself.
export function toJsonSchema(schema: z.ZodType): JsonNode {
  return z.toJSONSchema(schema, { io: "input", unrepresentable: "any",
    override: ({ zodSchema, jsonSchema }) => {
      const meta = ui.get(zodSchema)
      if (meta) (jsonSchema as Record<string, unknown>)["x-ui"] = meta
    } }) as JsonNode
}

// `X | null` arrives as anyOf [X, null]. A union with its own widget (stat,
// collection) stays whole.
function unwrap(node: JsonNode): { node: JsonNode; nullable: boolean } {
  const options = node.anyOf ?? node.oneOf
  if (!options || node["x-ui"]) return { node, nullable: false }
  const rest = options.filter((option) => option.type !== "null")
  if (rest.length === 1 && rest.length < options.length) {
    return { node: { ...rest[0]!, default: node.default ?? rest[0]!.default }, nullable: true }
  }
  return { node, nullable: false }
}

const humanise = (name: string) => {
  const last = name.split(".").filter((part) => part !== "$").at(-1) ?? ""
  const words = last.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ")
  return words ? words[0]!.toUpperCase() + words.slice(1).toLowerCase() : ""
}

const typeOf = (node: JsonNode) =>
  Array.isArray(node.type) ? node.type.find((t) => t !== "null") : node.type

function inferWidget(node: JsonNode): Widget {
  if (node.enum) return "select"
  switch (typeOf(node)) {
    case "boolean":
      return "toggle"
    case "number":
    case "integer":
      return "number"
    case "object":
      return "group"
    case "array":
      return "list"
    default:
      return (node.maxLength ?? 0) > 160 ? "textarea" : "text"
  }
}

function toField(raw: JsonNode, name: string, required: boolean, overrides: FieldOverrides): FormField {
  const { node, nullable } = unwrap(raw)
  const meta: Partial<UiMeta> = { ...node["x-ui"], ...overrides[name] }
  const widget = meta.widget ?? inferWidget(node)
  const base: FormField = { name, widget, required: required && !nullable, nullable,
    label: meta.label ?? humanise(name), description: meta.description, placeholder: meta.placeholder,
    inputType: meta.inputType, autoComplete: meta.autoComplete, collection: meta.collection, node }
  if (widget === "group") return { ...base, fields: fieldsOf(node, name, overrides) }
  if (widget === "list") {
    return { ...base, minItems: node.minItems, maxItems: node.maxItems,
      item: toField(node.items ?? {}, `${name}.$`, true, overrides) }
  }
  if (widget === "select" || widget === "radio" || widget === "icon") {
    return { ...base, options:
        meta.options?.map((option) => ({ ...option })) ??
        (node.enum ?? []).map((value) => ({ value: String(value), label: humanise(String(value)) })) }
  }
  if (widget === "number") {
    return { ...base, minimum: node.minimum ?? node.exclusiveMinimum, maximum: node.maximum,
      step: meta.step ?? (typeOf(node) === "integer" ? 1 : undefined) }
  }
  return { ...base, maxLength: node.maxLength }
}

function fieldsOf(node: JsonNode, prefix: string, overrides: FieldOverrides): FormField[] {
  const required = new Set(node.required ?? [])
  return Object.entries(node.properties ?? {}).map(([key, child]) =>
    toField(child, prefix ? `${prefix}.${key}` : key, required.has(key), overrides))
}

export function toFields(schema: z.ZodObject, overrides: FieldOverrides = {}): FormField[] {
  return fieldsOf(toJsonSchema(schema), "", overrides)
}

// A list item template is named "<list>.$…"; each rendered item swaps the
// placeholder for its index.
export function rebase(field: FormField, from: string, to: string): FormField {
  const swap = (name: string) => (name.startsWith(from) ? to + name.slice(from.length) : name)
  return { ...field, name: swap(field.name), fields: field.fields?.map((child) => rebase(child, from, to)),
    item: field.item && rebase(field.item, from, to) }
}

// A value with every key present, for "Add" buttons and new blocks. It is a
// starting point, not a valid value (required text is empty, images unset).
export function emptyValue(raw: JsonNode): unknown {
  if (raw.default !== undefined) return structuredClone(raw.default)
  const { node, nullable } = unwrap(raw)
  if (nullable) return null
  const options = node.anyOf ?? node.oneOf
  if (options?.length) return emptyValue(options[0]!)
  if (node.const !== undefined) return node.const
  if (node.enum) return node.enum[0]
  switch (typeOf(node)) {
    case "object":
      return Object.fromEntries(
        Object.entries(node.properties ?? {}).map(([key, child]) => [key, emptyValue(child)]))
    case "array":
      return Array.from({ length: node.minItems ?? 0 }, () => emptyValue(node.items ?? {}))
    case "number":
    case "integer":
      return node.minimum ?? 0
    case "boolean":
      return false
    case "string":
      return ""
    default:
      return null
  }
}

export const emptyValueFor = (schema: z.ZodType) => emptyValue(toJsonSchema(schema))
```

If the `Selection`/`StatValue` assertions fail, print `JSON.stringify(toJsonSchema(z.object({ s: Selection })), null, 2)` and adapt `unwrap`/`emptyValue` to the shape Zod 4.6 emits (`oneOf` vs `anyOf`, `const` vs single-value `enum`) — do not special-case by field name.

`admin/components/schema-form/schema-form.tsx` — add prop `overrides?: FieldOverrides` and pass it: `useMemo(() => toFields(schema, overrides), [schema, overrides])`.

- [ ] **Step 4: Implement the widgets**

`admin/components/schema-form/widgets/shell.tsx`:

```tsx
"use client"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"

import type { FormField } from "../to-fields"

export type WidgetProps<T> = { field: FormField
  value: T
  onChange: (value: T) => void
  onBlur?: () => void
  error?: string
}

// Label, description and error around one control (ids wire aria).
export function WidgetShell({ id, field, error, children }: { id: string
  field: FormField
  error?: string
  children: React.ReactNode
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      {children}
      {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>)
}
```

The four small widgets follow one pattern — `"use client"`, `WidgetProps<T>`, `useId()`, `WidgetShell` (or a `FieldSet` + `FieldLegend variant="label"` for multi-input widgets), `aria-invalid` on the control when `error`:

- `widgets/colour-widget.tsx` — `WidgetProps<string | undefined>`: `<input type="color" aria-label="{label} picker">` (value `#000000` until the text is a valid `#rrggbb`) beside an `Input` (id, placeholder `#157d38`); both call `onChange(hex)`.

- `widgets/icon-widget.tsx` — `WidgetProps<IconName | undefined>`: the `Select` markup of `ScalarWidget` over `field.options` (to-fields fills them from `ICON_NAMES`), each `SelectItem` prefixed with `const { Svg } = CONTENT_ICONS[value]` rendered `aria-hidden className="size-4"`; placeholder "Choose an icon". (Content icons come from the code registry; docs/brief.md §14 forbids uploaded SVG.)

- `widgets/focal-widget.tsx` — `WidgetProps<{ x: number; y: number } | null>`: two number inputs "Across (0–1)" and "Down (0–1)" (`min 0`, `max 1`, `step 0.05`; NaN → 0.5) inside a `FieldSet`; `onChange({ ...focal, [axis]: n })`, starting from `{ x: 0.5, y: 0.5 }`. (The click picker lives in the media library, Task 9.)

- `widgets/stat-widget.tsx` — `WidgetProps<StatValue | undefined>` (`StatValue` from `@/lib/count`): a `RadioGroup` "Number (counts up)" / "Text"; switching sends `{ kind: "count", value: 0, decimals: 0, prefix: "", suffix: "" }` or `{ kind: "text", text: "" }`. Count shows inputs Value (number, NaN → 0), Decimals (number clamped 0–2), Prefix, Suffix; text shows one "Text" input. Every input sends the whole object (`onChange({ ...stat, [key]: parsed })`).

`widgets/link-widget.tsx` (two Controllers, so each half shows its own error):

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { useId, useMemo } from "react"
import { Controller, type Control, type FieldValues } from "react-hook-form"

import { pagesListQuery } from "@/admin/modules/pages/queries"
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import type { FormField } from "../to-fields"

// docs/brief.md §9.4: internal pages and their section anchors are offered,
// any /path, #anchor, https:, mailto: or tel: is accepted (Href).
export function LinkWidget({ field, control }: { field: FormField; control: Control<FieldValues> }) {
  const id = useId()
  const pages = useQuery(pagesListQuery())
  const suggestions = useMemo(() =>
      (pages.data?.items ?? []).flatMap((page) => [page.path,
        ...page.anchors.filter((anchor) => anchor !== "home").map((anchor) => `${page.path}#${anchor}`)]),
    [pages.data])
  const part = (key: "label" | "href", label: string) => (
    <Controller name={`${field.name}.${key}`} control={control} render={({ field: input, fieldState }) => (
        <Field data-invalid={fieldState.error ? true : undefined}>
          <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
          <Input id={`${id}-${key}`} name={input.name} ref={input.ref} value={input.value ?? ""}
            onBlur={input.onBlur}
            onChange={(event) => input.onChange(event.target.value)}
            list={key === "href" ? `${id}-pages` : undefined}
            placeholder={key === "href" ? "/contact, #faq or https://…" : undefined}
            aria-invalid={fieldState.error ? true : undefined}
          />
          {fieldState.error ? <FieldError>{fieldState.error.message}</FieldError> : null}
        </Field>
      )}
    />)
  return (
    <FieldSet>
      <FieldLegend variant="label">{field.label}</FieldLegend>
      <div className="grid gap-3 sm:grid-cols-2">
        {part("label", "Link text")}
        {part("href", "Link target")}
      </div>
      <datalist id={`${id}-pages`}>
        {suggestions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
    </FieldSet>)
}
```

`widgets/media-widget.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { FileTextIcon, ImageIcon } from "lucide-react"
import Image from "next/image"
import { useId, useState } from "react"

import { mediaListQuery, type MediaItem } from "@/admin/modules/media/queries"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

import { WidgetShell, type WidgetProps } from "./shell"

type Ref = { mediaId: string }

function Thumb({ item }: { item: MediaItem }) {
  return item.mimeType.startsWith("image/") ? (
    <Image src={item.url} alt={item.alt} width={item.width ?? 160} height={item.height ?? 120} sizes="160px"
      className="aspect-[4/3] w-full rounded-lg object-cover"
      style={{ objectPosition: `${item.focalX * 100}% ${item.focalY * 100}%` }}
    />
  ) : (
    <FileTextIcon aria-hidden className="m-auto size-8" />)
}

export function MediaWidget({ field, value, onChange, error }: WidgetProps<Ref | null | undefined>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const selectedId = value?.mediaId || null
  const selected = useQuery({ ...mediaListQuery({ ids: selectedId ? [selectedId] : [] }), enabled: Boolean(selectedId) })
  const library = useQuery({ ...mediaListQuery({ q, type: "image" }), enabled: open })
  const current = selected.data?.items[0]
  return (
    <WidgetShell id={id} field={field} error={error}>
      <div className="flex items-center gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {current ? <Thumb item={current} /> : <ImageIcon aria-hidden className="size-6 text-muted-foreground" />}
        </div>
        <div className="flex flex-col gap-2">
          <Button id={id} type="button" variant="outline" onClick={() => setOpen(true)}>
            {current ? "Change image" : "Choose image"}
          </Button>
          {field.nullable && current ? (
            <Button type="button" variant="ghost" onClick={() => onChange(null)}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose an image</DialogTitle>
          </DialogHeader>
          <Input aria-label="Search the library" placeholder="Search by name or alt text" value={q} onChange={(event) => setQ(event.target.value)} />
          <ul className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
            {(library.data?.items ?? []).map((item) => (
              <li key={item.id}>
                <button type="button"
                  className="w-full rounded-xl border p-1 text-left focus-visible:ring-2 focus-visible:ring-ring"
                  aria-pressed={item.id === selectedId}
                  onClick={() => {
                    onChange({ mediaId: item.id })
                    setOpen(false)
                  }}
                >
                  <Thumb item={item} />
                  <span className="mt-1 block truncate text-xs">{item.alt || item.filename}</span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </WidgetShell>)
}
```

`widgets/collection-widget.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { useId } from "react"

import { collectionOptionsQuery } from "@/admin/modules/collections/queries"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldError, FieldLegend, FieldSet } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { WidgetShell, type WidgetProps } from "./shell"

type Selection = { mode: "all" } | { mode: "chosen"; ids: string[] }

// A single row id (a band) or a Selection: "all" in collection order, or
// chosen rows in the order the editor picks them.
export function CollectionWidget({ field, value, onChange, error }: WidgetProps<Selection | string | undefined>) {
  const id = useId()
  const options = useQuery({ ...collectionOptionsQuery(field.collection!), enabled: Boolean(field.collection) })
  const items = options.data?.items ?? []
  if (field.node.type === "string") {
    const list = items.map((item) => ({ value: item.id, label: item.label }))
    return (
      <WidgetShell id={id} field={field} error={error}>
        <Select items={list} value={typeof value === "string" ? value : null} onValueChange={(next) => onChange(next as string)}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {list.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </WidgetShell>)
  }
  const selection: Selection = typeof value === "object" && value ? value : { mode: "all" }
  const chosen = selection.mode === "chosen" ? selection.ids : []
  const toggle = (itemId: string, on: boolean) => {
    const ids = on ? [...chosen, itemId] : chosen.filter((x) => x !== itemId)
    onChange(ids.length ? { mode: "chosen", ids } : { mode: "all" })
  }
  return (
    <FieldSet data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">{field.label}</FieldLegend>
      <RadioGroup value={selection.mode}
        onValueChange={(mode) => onChange(mode === "all" ? { mode: "all" } : { mode: "chosen", ids: items.slice(0, 1).map((i) => i.id) })}
        className="flex gap-4"
      >
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="all" /> All, in collection order
        </label>
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="chosen" /> Only these
        </label>
      </RadioGroup>
      {selection.mode === "chosen" ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const position = chosen.indexOf(item.id)
            return (
              <li key={item.id}>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={position >= 0} onCheckedChange={(on) => toggle(item.id, on === true)} />
                  <span className="w-5 text-muted-foreground tabular-nums">{position >= 0 ? position + 1 : ""}</span>
                  {item.label}
                </label>
              </li>)
          })}
        </ul>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>)
}
```

`widgets/rich-text-widget.tsx`:

```tsx
"use client"

import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { BoldIcon, Heading2Icon, Heading3Icon, ItalicIcon, LinkIcon, ListIcon, QuoteIcon } from "lucide-react"
import { useId, useState } from "react"

import { Href } from "@/blocks/fields"
import { RichTextDoc } from "@/blocks/rich-text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toggle } from "@/components/ui/toggle"

import { WidgetShell, type WidgetProps } from "./shell"

const EMPTY = { type: "doc", content: [{ type: "paragraph" }] }

// Only what blocks/rich-text.ts renders: paragraphs, h2/h3, bullet lists,
// quotes, bold, italic and links. The site renders the JSON statically
// (docs/brief.md §15), never as HTML.
const extensions = [StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false,
    strike: false, underline: false, horizontalRule: false, orderedList: false, hardBreak: false,
    link: { openOnClick: false, autolink: false } })]

function Toolbar({ editor }: { editor: Editor }) {
  const [href, setHref] = useState<string | null>(null)
  const mark = (label: string, Icon: typeof BoldIcon, active: boolean, run: () => void) => (
    <Toggle size="sm" aria-label={label} pressed={active} onPressedChange={run}>
      <Icon aria-hidden />
    </Toggle>)
  const chain = () => editor.chain().focus()
  return (
    <div className="flex flex-wrap items-center gap-1 border-b p-1">
      {mark("Bold", BoldIcon, editor.isActive("bold"), () => chain().toggleBold().run())}
      {mark("Italic", ItalicIcon, editor.isActive("italic"), () => chain().toggleItalic().run())}
      {mark("Heading 2", Heading2Icon, editor.isActive("heading", { level: 2 }), () => chain().toggleHeading({ level: 2 }).run())}
      {mark("Heading 3", Heading3Icon, editor.isActive("heading", { level: 3 }), () => chain().toggleHeading({ level: 3 }).run())}
      {mark("Bullet list", ListIcon, editor.isActive("bulletList"), () => chain().toggleBulletList().run())}
      {mark("Quote", QuoteIcon, editor.isActive("blockquote"), () => chain().toggleBlockquote().run())}
      {mark("Link", LinkIcon, editor.isActive("link"), () => setHref(editor.getAttributes("link").href ?? ""))}
      {href !== null ? (
        // Not a <form>: this sits inside the SchemaForm's form.
        <div className="flex items-center gap-1">
          <Input aria-label="Link target" className="h-8 w-56" value={href} onChange={(e) => setHref(e.target.value)} placeholder="/contact or https://…" aria-invalid={href !== "" && !Href.safeParse(href).success ? true : undefined} />
          <Button type="button" size="sm" variant="outline" onClick={() => {
              if (href === "") chain().unsetLink().run()
              else if (Href.safeParse(href).success) chain().extendMarkRange("link").setLink({ href }).run()
              else return
              setHref(null)
            }}
          >
            Apply
          </Button>
        </div>
      ) : null}
    </div>)
}

export function RichTextWidget({ field, value, onChange, error }: WidgetProps<unknown>) {
  const id = useId()
  const editor = useEditor({ extensions, content: (value as object | undefined) ?? EMPTY,
    // Server rendering has no DOM; the admin renders this on the client.
    immediatelyRender: false, editorProps: { attributes: { id, role: "textbox", "aria-multiline": "true",
        "aria-label": field.label, class: "prose prose-sm min-h-40 max-w-none p-3 focus:outline-none" } },
    // Unknown attrs (target, rel, class) are stripped by the schema; an
    // invalid document is passed through so the form shows the error.
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON()
      const parsed = RichTextDoc.safeParse(json)
      onChange(parsed.success ? parsed.data : json)
    } })
  return (
    <WidgetShell id={id} field={field} error={error}>
      <div className="rounded-xl border">
        {editor ? <Toolbar editor={editor} /> : null}
        <EditorContent editor={editor} />
      </div>
    </WidgetShell>)
}
```

After installing, open `node_modules/@tiptap/starter-kit/dist/index.d.ts` and check `StarterKitOptions` has exactly the keys used above (`heading`, `code`, `codeBlock`, `strike`, `underline`, `horizontalRule`, `orderedList`, `hardBreak`, `link`); rename any that differ, never cast.

`admin/components/schema-form/widgets.tsx` — replace `FieldWidget` and `ListWidget`; keep `ScalarWidget`, with two edits: for `field.nullable`, the text input maps `""` → `null` (`input.onChange(event.target.value === "" && field.nullable ? null : event.target.value)`) and the number input maps NaN → `field.nullable ? null : undefined`; the number `<Input>` gets `min={field.minimum} max={field.maximum} step={field.step ?? "any"}`.

```tsx
import { get, useController, type Control, type FieldValues } from "react-hook-form"

import { CollectionWidget } from "./widgets/collection-widget"
import { ColourWidget } from "./widgets/colour-widget"
import { FocalWidget } from "./widgets/focal-widget"
import { IconWidget } from "./widgets/icon-widget"
import { LinkWidget } from "./widgets/link-widget"
import { MediaWidget } from "./widgets/media-widget"
import { RichTextWidget } from "./widgets/rich-text-widget"
import { StatWidget } from "./widgets/stat-widget"
import { emptyValue, rebase, type FormField } from "./to-fields"

type Props = { field: FormField; control: Control<FieldValues> }

// Object-valued fields that may be null get an explicit on/off switch.
const TOGGLED: ReadonlySet<FormField["widget"]> = new Set(["group", "link", "stat", "focal"])

export function FieldWidget({ field, control }: Props) {
  if (field.nullable && TOGGLED.has(field.widget)) return <NullableField field={field} control={control} />
  switch (field.widget) {
    case "group":
      return <GroupWidget field={field} control={control} />
    case "list":
      return <ListWidget field={field} control={control} />
    case "link":
      return <LinkWidget field={field} control={control} />
    default:
      return <LeafWidget field={field} control={control} />
  }
}

function GroupWidget({ field, control }: Props) {
  return (
    <FieldSet>
      <FieldLegend>{field.label}</FieldLegend>
      {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
      <FieldGroup>
        {(field.fields ?? []).map((child) => (
          <FieldWidget key={child.name} field={child} control={control} />
        ))}
      </FieldGroup>
    </FieldSet>)
}

function NullableField({ field, control }: Props) {
  const id = useId()
  const { field: input } = useController({ name: field.name, control })
  const on = input.value !== null && input.value !== undefined
  return (
    <div className="flex flex-col gap-3">
      <Field orientation="horizontal">
        <Switch id={id} checked={on}
          onCheckedChange={(checked) => input.onChange(checked ? emptyValue(field.node) : null)}
        />
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      </Field>
      {on ? <FieldWidget field={{ ...field, nullable: false }} control={control} /> : null}
    </div>)
}

// The first message under a field (objects nest their errors).
function firstMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  const { message } = error as { message?: unknown }
  if (typeof message === "string") return message
  for (const child of Object.values(error)) {
    const found = firstMessage(child)
    if (found) return found
  }
  return undefined
}

function LeafWidget({ field, control }: Props) {
  return (
    <Controller name={field.name} control={control}
      render={({ field: { ref, ...input }, fieldState, formState }) => {
        const error = fieldState.error?.message ?? firstMessage(get(formState.errors, field.name))
        const props = { field, value: input.value, onChange: input.onChange, onBlur: input.onBlur, error }
        switch (field.widget) {
          case "media":
            return <MediaWidget {...props} />
          case "icon":
            return <IconWidget {...props} />
          case "stat":
            return <StatWidget {...props} />
          case "richtext":
            return <RichTextWidget {...props} />
          case "collection":
            return <CollectionWidget {...props} />
          case "colour":
            return <ColourWidget {...props} />
          case "focal":
            return <FocalWidget {...props} />
          default:
            return <ScalarWidget field={field} input={input} inputRef={ref} error={error} />
        }
      }}
    />)
}

// Text items keep the Phase 2 inline row (input + up/down/remove). Any other
// item (objects, images, textareas) renders as its own fieldset.
function ListWidget({ field, control }: Props) {
  const id = useId()
  const { field: input, fieldState } = useController({ name: field.name, control })
  const items: unknown[] = Array.isArray(input.value) ? input.value : []
  const item = field.item!
  const min = field.minItems ?? 0
  const max = field.maxItems ?? Number.POSITIVE_INFINITY
  const set = (next: unknown[]) => input.onChange(next)
  const move = (from: number, to: number) => {
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    set(next)
  }
  const error = fieldState.error?.message ?? (fieldState.error as { root?: { message?: string } } | undefined)?.root?.message
  const controls = (index: number) => (
    <div className="flex gap-1">
      <Button type="button" variant="outline" size="icon" aria-label={`Move ${field.label} ${index + 1} up`} disabled={index === 0} onClick={() => move(index, index - 1)}>
        <ChevronUpIcon aria-hidden />
      </Button>
      <Button type="button" variant="outline" size="icon" aria-label={`Move ${field.label} ${index + 1} down`} disabled={index === items.length - 1} onClick={() => move(index, index + 1)}>
        <ChevronDownIcon aria-hidden />
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${field.label} ${index + 1}`} disabled={items.length <= min} onClick={() => set(items.filter((_, i) => i !== index))}>
        <TrashIcon aria-hidden />
      </Button>
    </div>)
  const inline = item.widget === "text"
  return (
    <FieldSet data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">{field.label}</FieldLegend>
      <ol className="flex flex-col gap-3">
        {items.map((value, index) => {
          const child = { ...rebase(item, `${field.name}.$`, `${field.name}.${index}`), label: `${field.label} ${index + 1}` }
          return (
            <li key={index}>
              {inline ? (
                <InlineTextItem field={child} control={control} listId={id} index={index} value={value} actions={controls(index)} />
              ) : (
                <fieldset aria-label={child.label} className="flex flex-col gap-3 rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{child.label}</span>
                    {controls(index)}
                  </div>
                  <FieldWidget field={child} control={control} />
                </fieldset>
              )}
            </li>)
        })}
      </ol>
      <div>
        <Button type="button" variant="outline" disabled={items.length >= max} onClick={() => set([...items, inline ? "" : emptyValue(item.node)])}>
          <PlusIcon data-icon="inline-start" />
          Add to {field.label.toLowerCase()}
        </Button>
      </div>
      {Number.isFinite(max) ? (
        <FieldDescription>{min > 0 ? `Between ${min} and ${max} items.` : `Up to ${max} items.`}</FieldDescription>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>)
}
```

`InlineTextItem` is the Phase 2 row body moved into its own component (a `Controller` on `field.name` rendering the existing `<Input aria-label={field.label} …>` with its per-item error), followed by `actions`. Keep the old markup and aria labels so the existing schema-form tests still pass.

- [ ] **Step 5: Queries, keys and block overrides**

`admin/lib/query-keys.ts` — add to `queryKeys` (params objects are part of the key, as for audit):

```ts
  pages: { all: ["pages"] as const, list: ["pages", "list"] as const,
    detail: (id: string) => ["pages", "detail", id] as const,
    revisions: (id: string) => ["pages", "revisions", id] as const }, media: { all: ["media"] as const,
    list: (params: object) => ["media", "list", params] as const,
    usage: (id: string) => ["media", "usage", id] as const }, collections: { all: ["collections"] as const,
    list: (name: string) => ["collections", name, "list"] as const,
    options: (source: string) => ["collections", source, "options"] as const }, globals: {
    detail: (key: string) => ["globals", key] as const,
    revisions: (key: string) => ["globals", key, "revisions"] as const },
```

`admin/modules/media/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { mediaApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"

export type MediaPage = InferResponseType<typeof mediaApi.index.$get, 200>
export type MediaItem = MediaPage["items"][number]
export type MediaListParams = { page?: number; q?: string; type?: "image" | "pdf"; missingAlt?: boolean; ids?: string[] }

const toQuery = (p: MediaListParams) => ({ pageSize: "40", ...(p.page ? { page: String(p.page) } : {}),
  ...(p.q ? { q: p.q } : {}), ...(p.type ? { type: p.type } : {}),
  ...(p.missingAlt ? { missingAlt: "1" as const } : {}), ...(p.ids?.length ? { ids: p.ids.join(",") } : {}) })

export const mediaListQuery = (params: MediaListParams) =>
  queryOptions({ queryKey: queryKeys.media.list(params),
    queryFn: () => parseResponse(mediaApi.index.$get({ query: toQuery(params) })) })
```

`admin/modules/pages/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { pagesApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"

export type PageSummary = InferResponseType<typeof pagesApi.index.$get, 200>["items"][number]

export const pagesListQuery = () =>
  queryOptions({ queryKey: queryKeys.pages.list, queryFn: () => parseResponse(pagesApi.index.$get()),
    staleTime: 30_000 })
```

`admin/modules/collections/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query"

import { collectionsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import type { OptionSource } from "@/lib/content/collections"

export const collectionOptionsQuery = (source: OptionSource) =>
  queryOptions({ queryKey: queryKeys.collections.options(source),
    queryFn: () => parseResponse(collectionsApi[":name"].options.$get({ param: { name: source } })),
    staleTime: 60_000 })
```

`admin/modules/pages/block-ui.ts`:

```ts
import type { FieldOverrides } from "@/admin/components/schema-form/to-fields"
import type { BlockType } from "@/blocks/registry"

// Per-block hints the shared field widgets (field-ui.ts) cannot know: which
// collection a picker reads, and labels that explain an optional override.
export const BLOCK_FIELD_UI: Partial<Record<BlockType, FieldOverrides>> = {
  testimonials: { selection: { widget: "collection", collection: "testimonials", label: "Testimonials to show" } },
  faq: { selection: { widget: "collection", collection: "faqs", label: "Questions to show" },
    initiallyOpen: { label: "Open on load", description: "Position of the question to open (0 = first); empty keeps all closed." },
  },
  "insights.latest": { selection: { widget: "collection", collection: "articles", label: "Articles to show" } },
  band: { bandId: { widget: "collection", collection: "cta-bands", label: "Band" },
    tint: { label: "Tint override", description: "Leave empty to use the band's own tint." } },
  "hero.page": { tint: { step: 0.01 }, focal: { label: "Focal point override" } },
  newsletter: { override: { label: "Custom copy for this page" } } }
```

- [ ] **Step 6: Run tests and gates**

Run: `pnpm vitest run --project unit admin && pnpm lint && pnpm typecheck && pnpm build`
Expected: PASS (account forms still pass their tests: their schemas register full `label`s).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml admin/components/schema-form admin/lib/query-keys.ts admin/modules/media/queries.ts admin/modules/pages admin/modules/collections/queries.ts
git commit -m "feat(admin): content widgets for schema forms"
```

---
### Task 7: Pages list and the page builder

**Files:**
- Install: `pnpm add @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2`
- Create: `admin/modules/pages/{builder-state,use-autosave}.ts`, `admin/modules/pages/block-icons.ts`, `admin/modules/pages/{pages-view,page-builder,block-outline,block-library,block-form,block-meta,preview-pane,history-sheet,seo-form,conflict-dialog,save-indicator}.tsx`, `app/(admin)/admin/(panel)/pages/page.tsx`, `app/(admin)/admin/(panel)/pages/[id]/page.tsx`, `tests/e2e/admin/content/{editing,conflict,rbac}.spec.ts`
- Modify: `admin/modules/pages/queries.ts`, `admin/modules/pages/block-ui.ts` (`richtext: { doc: { label: "Text" } }`), `tests/e2e/fixtures/users.ts`, `tests/e2e/support/storage.ts`, `tests/e2e/admin/auth.setup.ts`
- Test: `admin/modules/pages/builder-state.test.ts`, `admin/modules/pages/use-autosave.test.tsx`

**Interfaces:**
- Consumes: `pagesApi` (Task 1), preview endpoint (Task 2), `toFields`/`FieldWidget`/`emptyValueFor`/`BLOCK_FIELD_UI`/`pagesListQuery` (Task 6), `SchemaForm`, `usePermission`, `StatusPill`, `PageHeader`, `CardSkeleton`, `toast`.
- Produces:
  - `docReducer(doc, action: DocAction)`, `newBlock(type, doc)`, `addableTypes(kind, doc)`, `errorsByBlock(fieldErrors, doc) → Map<blockId, Record<string, string[]>>` (data paths unprefixed, meta paths as `$anchor` etc.).
  - `useAutosave<T>({ version, save, delay? }) → { state: AutosaveState, schedule, flush(): Promise<boolean>, overwrite(), reset(version), markConflict(conflict), setVersion(v), getVersion() }`; `conflictOf(error) → Conflict | null`.
  - `pageDetailQuery(id)`, `pageRevisionsQuery(id)`, type `PageDetail`.
  - Screens `/admin/pages` and `/admin/pages/:id`; E2E user `author@e2e.test` with `STORAGE.author`.

- [ ] **Step 1: Write the failing unit tests**

`admin/modules/pages/builder-state.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import type { DraftDocument } from "@/blocks/page"

import { addableTypes, docReducer, errorsByBlock, newBlock } from "./builder-state"

const empty: DraftDocument = { blocks: [] }

describe("builder state", () => {
  it("adds heroes first, others last, with unique anchors and fresh ids", () => {
    let doc = docReducer(empty, { type: "add", blockType: "faq" })
    doc = docReducer(doc, { type: "add", blockType: "faq" })
    doc = docReducer(doc, { type: "add", blockType: "hero.page" })
    expect(doc.blocks.map((b) => [b.type, b.anchor])).toEqual([["hero.page", "home"], ["faq", "faq"],
      ["faq", "faq-2"]])
    expect(new Set(doc.blocks.map((b) => b.id)).size).toBe(3)
    expect(doc.blocks[1]!.data).toMatchObject({ selection: { mode: "all" } }) })
  it("offers only blocks that can publish on this page", () => {
    const home = addableTypes("home", empty)
    expect(home).toContain("hero.home")
    expect(home).not.toContain("richtext")
    expect(home).not.toContain("services.grid")
    const withHero = { blocks: [newBlock("hero.page", empty)] }
    expect(addableTypes("custom", withHero)).not.toContain("hero.page")
    expect(addableTypes("custom", withHero)).toContain("richtext") })
  it("moves, edits and removes", () => {
    let doc = docReducer(empty, { type: "add", blockType: "faq" })
    doc = docReducer(doc, { type: "add", blockType: "fit" })
    doc = docReducer(doc, { type: "move", from: 1, to: 0 })
    expect(doc.blocks.map((b) => b.type)).toEqual(["fit", "faq"])
    const id = doc.blocks[0]!.id
    doc = docReducer(doc, { type: "meta", id, patch: { hidden: true } })
    doc = docReducer(doc, { type: "data", id, data: { title: "T" } })
    expect(doc.blocks[0]).toMatchObject({ hidden: true, data: { title: "T" } })
    expect(docReducer(doc, { type: "remove", id }).blocks).toHaveLength(1) })
  it("maps publish errors onto blocks", () => {
    const doc = docReducer(docReducer(empty, { type: "add", blockType: "faq" }), { type: "add", blockType: "fit" })
    const map = errorsByBlock({ "blocks.1.data.title": ["Required"], "blocks.0.anchor": ["Taken"], _media: ["x"] }, doc)
    expect(map.get(doc.blocks[1]!.id)).toEqual({ title: ["Required"] })
    expect(map.get(doc.blocks[0]!.id)).toEqual({ $anchor: ["Taken"] }) }) })
```

`admin/modules/pages/use-autosave.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/admin/lib/api-error"

import { useAutosave } from "./use-autosave"

afterEach(() => vi.useRealTimers())

const bump = async (_value: string, version: number) => ({ version: version + 1 })

describe("useAutosave", () => {
  it("debounces and sends the latest value with the current version", async () => {
    vi.useFakeTimers()
    const save = vi.fn(bump)
    const { result } = renderHook(() => useAutosave({ version: 1, save }))
    act(() => {
      result.current.schedule("a")
      result.current.schedule("b") })
    await act(() => vi.advanceTimersByTimeAsync(1200))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith("b", 1)
    act(() => result.current.schedule("c"))
    await act(() => vi.advanceTimersByTimeAsync(1200))
    expect(save).toHaveBeenLastCalledWith("c", 2)
    expect(result.current.state.status).toBe("saved") })

  // Review Focus 3: nothing is sent over someone else's change.
  it("stops on a conflict until the editor overwrites", async () => {
    vi.useFakeTimers()
    const conflict = new ApiError("CONFLICT", "Changed", 409, null, {}, {
      current: { version: 7, updatedAt: null, updatedBy: "Eve" } })
    const save = vi.fn(bump).mockRejectedValueOnce(conflict)
    const { result } = renderHook(() => useAutosave({ version: 1, save }))
    act(() => result.current.schedule("a"))
    await act(() => vi.advanceTimersByTimeAsync(1200))
    expect(result.current.state).toMatchObject({ status: "conflict", conflict: { updatedBy: "Eve" } })
    act(() => result.current.schedule("b"))
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(save).toHaveBeenCalledTimes(1)
    await act(() => result.current.overwrite())
    expect(save).toHaveBeenLastCalledWith("b", 7)
    expect(result.current.state.status).toBe("saved") })

  it("flush reports whether everything is saved", async () => {
    const save = vi.fn(bump).mockRejectedValueOnce(new TypeError("offline"))
    const { result } = renderHook(() => useAutosave({ version: 1, save }))
    act(() => result.current.schedule("a"))
    let ok = true
    await act(async () => {
      ok = await result.current.flush() })
    expect(ok).toBe(false)
    await act(async () => {
      ok = await result.current.flush() })
    expect(ok).toBe(true)
    expect(result.current.getVersion()).toBe(2) }) })
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run --project unit admin/modules/pages`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement state and autosave**

`admin/modules/pages/builder-state.ts`:

```ts
import { emptyValueFor } from "@/admin/components/schema-form/to-fields"
import type { PageKind } from "@/blocks/define-block"
import type { DraftBlock, DraftDocument } from "@/blocks/page"
import { BLOCK_BY_TYPE, BLOCKS, type BlockType } from "@/blocks/registry"

export type DocAction =
  | { type: "add"; blockType: BlockType }
  | { type: "remove"; id: string }
  | { type: "move"; from: number; to: number }
  | { type: "data"; id: string; data: Record<string, unknown> }
  | { type: "meta"; id: string; patch: Partial<Pick<DraftBlock, "anchor" | "chapter" | "hidden" | "joinPrevious">> }

const isHero = (type: BlockType) => type === "hero.home" || type === "hero.page"

function uniqueAnchor(base: string, doc: DraftDocument) {
  const taken = new Set(doc.blocks.map((block) => block.anchor))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

// New blocks get a uuid id (BlockId accepts it) and a structurally complete,
// not yet valid, data object; the form then shows what is missing.
export function newBlock(type: BlockType, doc: DraftDocument): DraftBlock {
  return { id: crypto.randomUUID(), type,
    anchor: isHero(type) ? "home" : uniqueAnchor(type.replace(/\./g, "-"), doc), chapter: null, hidden: false,
    joinPrevious: false, data: emptyValueFor(BLOCK_BY_TYPE[type].schema) as Record<string, unknown> }
}

// The placement rules of pageDocumentFor, so the library only offers blocks
// that can be published here.
export function addableTypes(kind: PageKind, doc: DraftDocument): BlockType[] {
  return BLOCKS.filter((def) => {
    if (def.allowedOn !== "*" && !def.allowedOn.includes(kind)) return false
    const count = doc.blocks.filter((block) => block.type === def.type).length
    if (def.max !== undefined && count >= def.max) return false
    if (def.first && doc.blocks.some((block) => BLOCK_BY_TYPE[block.type].first)) return false
    return true
  }).map((def) => def.type)
}

export function docReducer(doc: DraftDocument, action: DocAction): DraftDocument {
  switch (action.type) {
    case "add": { const block = newBlock(action.blockType, doc)
      return { blocks: BLOCK_BY_TYPE[action.blockType].first ? [block, ...doc.blocks] : [...doc.blocks, block] }
    }
    case "remove":
      return { blocks: doc.blocks.filter((block) => block.id !== action.id) }
    case "move": { const blocks = [...doc.blocks]
      const [moved] = blocks.splice(action.from, 1)
      if (!moved) return doc
      blocks.splice(action.to, 0, moved)
      return { blocks }
    }
    case "data":
      return { blocks: doc.blocks.map((block) => (block.id === action.id ? { ...block, data: action.data } : block)) }
    case "meta":
      return { blocks: doc.blocks.map((block) => (block.id === action.id ? { ...block, ...action.patch } : block)) }
  }
}

// Publish errors arrive as "blocks.<i>.<path>" (server/api/errors.ts).
export function errorsByBlock(fieldErrors: Record<string, string[]>, doc: DraftDocument) {
  const out = new Map<string, Record<string, string[]>>()
  for (const [path, messages] of Object.entries(fieldErrors)) {
    const match = /^blocks\.(\d+)\.(.+)$/.exec(path)
    const block = match ? doc.blocks[Number(match[1])] : undefined
    if (!match || !block) continue
    const rest = match[2]!
    const key = rest.startsWith("data.") ? rest.slice("data.".length) : `$${rest}`
    out.set(block.id, { ...out.get(block.id), [key]: messages })
  }
  return out
}
```

`admin/modules/pages/use-autosave.ts`:

```ts
"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { ApiError } from "@/admin/lib/api-error"

export type Conflict = { version: number; updatedAt: string | null; updatedBy: string | null }
export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error" | "conflict"
export type AutosaveState = { status: SaveStatus
  savedAt: number | null
  error: string | null
  conflict: Conflict | null
}

export function conflictOf(error: unknown): Conflict | null {
  if (!(error instanceof ApiError) || error.code !== "CONFLICT") return null
  const current = (error.details as { current?: Conflict } | null)?.current
  return current && typeof current.version === "number" ? current : null
}

const IDLE: AutosaveState = { status: "idle", savedAt: null, error: null, conflict: null }

// docs/brief.md §6.5: ~1.2 s debounce, one request at a time, the newest
// value wins, and after a 409 nothing is sent until the editor chooses
// Overwrite (resend on their version) or Review (reset to the server copy).
export function useAutosave<T>({ version: initialVersion, save, delay = 1200 }: { version: number
  save: (value: T, version: number) => Promise<{ version: number }>
  delay?: number
}) {
  const [state, setState] = useState<AutosaveState>(IDLE)
  const version = useRef(initialVersion)
  const pending = useRef<{ value: T } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const running = useRef<Promise<void> | null>(null)
  const conflict = useRef<Conflict | null>(null)
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save })

  const run = useCallback(async (): Promise<void> => {
    while (running.current) await running.current
    const next = pending.current
    if (!next || conflict.current) return
    pending.current = null
    setState((s) => ({ ...s, status: "saving", error: null }))
    const attempt = (async () => {
      try {
        const result = await saveRef.current(next.value, version.current)
        version.current = result.version
        setState({ status: pending.current ? "pending" : "saved", savedAt: Date.now(), error: null, conflict: null })
      } catch (error) {
        // Keep the unsaved edit unless a newer one already replaced it.
        pending.current ??= next
        conflict.current = conflictOf(error)
        setState((s) => ({ ...s, status: conflict.current ? "conflict" : "error", conflict: conflict.current,
          error: error instanceof Error ? error.message : "Couldn't save" }))
      }
    })()
    running.current = attempt
    await attempt
    running.current = null
  }, [])

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const schedule = useCallback((value: T) => {
      pending.current = { value }
      if (conflict.current) return
      setState((s) => ({ ...s, status: "pending" }))
      clearTimer()
      timer.current = setTimeout(() => {
        timer.current = null
        void run()
      }, delay)
    }, [delay, run])

  // For Publish and ⌘S: true when nothing is left unsaved.
  const flush = useCallback(async () => {
    clearTimer()
    await run()
    return pending.current === null && conflict.current === null
  }, [run])

  const overwrite = useCallback(async () => {
    if (!conflict.current) return
    version.current = conflict.current.version
    conflict.current = null
    await run()
  }, [run])

  const reset = useCallback((nextVersion: number) => {
    clearTimer()
    pending.current = null
    conflict.current = null
    version.current = nextVersion
    setState(IDLE)
  }, [])

  const markConflict = useCallback((current: Conflict) => {
    conflict.current = current
    setState((s) => ({ ...s, status: "conflict", conflict: current }))
  }, [])

  const setVersion = useCallback((next: number) => {
    version.current = next
  }, [])
  const getVersion = useCallback(() => version.current, [])

  useEffect(() => clearTimer, [])

  // Unsaved-changes guard (docs/brief.md §9.4).
  const unsafe = state.status !== "idle" && state.status !== "saved"
  useEffect(() => {
    if (!unsafe) return
    const guard = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [unsafe])

  return { state, schedule, flush, overwrite, reset, markConflict, setVersion, getVersion }
}
```

- [ ] **Step 4: Run the unit tests**

Run: `pnpm vitest run --project unit admin/modules/pages`
Expected: PASS.

- [ ] **Step 5: Implement the screens**

`admin/modules/pages/queries.ts` — append:

```ts
export type PageDetail = InferResponseType<(typeof pagesApi)[":id"]["$get"], 200>

export const pageDetailQuery = (id: string) =>
  queryOptions({ queryKey: queryKeys.pages.detail(id),
    queryFn: () => parseResponse(pagesApi[":id"].$get({ param: { id } })),
    // The builder owns the working copy once loaded; refetching would not
    // replace it (Builder is keyed by its generation).
    staleTime: Number.POSITIVE_INFINITY })

export const pageRevisionsQuery = (id: string) =>
  queryOptions({ queryKey: queryKeys.pages.revisions(id),
    queryFn: () => parseResponse(pagesApi[":id"].revisions.$get({ param: { id } })) })
```

`app/(admin)/admin/(panel)/pages/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { PagesView } from "@/admin/modules/pages/pages-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Pages" }

export default function PagesPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate />
    </Suspense>)
}

async function Gate() {
  await requirePermission(permissionFor("/admin/pages"))
  return <PagesView />
}
```

`app/(admin)/admin/(panel)/pages/[id]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import * as z from "zod"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { PageBuilder } from "@/admin/modules/pages/page-builder"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Edit page" }

export default function EditPage({ params }: PageProps<"/admin/pages/[id]">) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate params={params} />
    </Suspense>)
}

async function Gate({ params }: { params: PageProps<"/admin/pages/[id]">["params"] }) {
  await requirePermission(permissionFor("/admin/pages"))
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <PageBuilder id={id} />
}
```

`admin/modules/pages/pages-view.tsx` (client) — spec:
- `useQuery(pagesListQuery())`; `PageHeader` title "Pages", description "Every page of the site. Changes stay in a draft until you publish."; action button **"New page"** (`PRIMARY_ACTION`) only with `usePermission({ page: ["create"] })`.
- `Table` columns Title (a `next/link` to `/admin/pages/{id}`), Address (`font-mono`), Status (`StatusPill` success "Published" / neutral "Draft"; plus warning "Unpublished changes" when `hasUnpublishedChanges && status === "published"`; danger "Needs review" when `needsReview`), Updated (`formatDistanceToNow(new Date(updatedAt), { addSuffix: true })`).
- "New page" opens a `Dialog` titled "New page" holding `<SchemaForm schema={NewPageInput} defaultValues={{ path: "/", title: "" }} submitLabel="Create page" />`; submit → `parseResponse(pagesApi.index.$post({ json: values }))`, then `invalidateQueries({ queryKey: queryKeys.pages.all })` and `router.push(\`/admin/pages/${id}\`)`; an `ApiError` returns `{ formError: error.message, fieldErrors: error.fieldErrors }` (409 "A page already lives at that address" lands on `path`).


`admin/modules/pages/block-icons.ts`:

```ts
import {
  BadgeCheckIcon, BookOpenIcon, ChartNoAxesColumnIcon, CircleHelpIcon, ClockIcon, CompassIcon, FootprintsIcon,
  GraduationCapIcon, LayoutGridIcon, LibraryBigIcon, MailIcon, MapPinIcon, MegaphoneIcon, MessageSquareTextIcon,
  NewspaperIcon, PanelTopIcon, PilcrowIcon, QuoteIcon, ScaleIcon, SparklesIcon, TagsIcon, UserRoundIcon,
  type LucideIcon } from "lucide-react"

// defineBlock's `icon` names (blocks/*.ts), imported one by one so the
// admin bundle carries 22 icons, not all of lucide.
export const BLOCK_ICONS: Record<string, LucideIcon> = {
  Sparkles: SparklesIcon, PanelTop: PanelTopIcon, BadgeCheck: BadgeCheckIcon, UserRound: UserRoundIcon,
  Footprints: FootprintsIcon, Quote: QuoteIcon, Megaphone: MegaphoneIcon, Newspaper: NewspaperIcon,
  CircleHelp: CircleHelpIcon, BookOpen: BookOpenIcon, ChartNoAxesColumn: ChartNoAxesColumnIcon, Compass: CompassIcon,
  GraduationCap: GraduationCapIcon, LayoutGrid: LayoutGridIcon, Tags: TagsIcon, Clock: ClockIcon, Scale: ScaleIcon,
  LibraryBig: LibraryBigIcon, Mail: MailIcon, MessageSquareText: MessageSquareTextIcon, MapPin: MapPinIcon, Pilcrow: PilcrowIcon,
}
```

Add to `builder-state.test.ts`: `it("has an icon for every block", () => { for (const b of BLOCKS) expect(BLOCK_ICONS[b.icon], b.type).toBeDefined() })` (import `BLOCKS` and `BLOCK_ICONS`).

`admin/modules/pages/block-outline.tsx`:

```tsx
"use client"

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { EyeIcon, EyeOffIcon, GripVerticalIcon, TrashIcon } from "lucide-react"

import { StatusPill } from "@/admin/components/dashboard/status-pill"
import type { DraftBlock, DraftDocument } from "@/blocks/page"
import { BLOCK_BY_TYPE } from "@/blocks/registry"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { BLOCK_ICONS } from "./block-icons"

type Props = { doc: DraftDocument
  selectedId: string | null
  invalidIds: ReadonlySet<string>
  readOnly: boolean
  onSelect(id: string): void
  onMove(from: number, to: number): void
  onToggleHidden(block: DraftBlock): void
  onRemove(id: string): void
}

// Drag with the handle or the keyboard (space, arrows, space): docs/brief.md
// §9.4 asks for keyboard drag-and-drop.
export function BlockOutline({ doc, onMove, ...rest }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = doc.blocks.findIndex((b) => b.id === active.id)
    const to = doc.blocks.findIndex((b) => b.id === over.id)
    if (from >= 0 && to >= 0) onMove(from, to)
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={doc.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ol aria-label="Blocks" className="flex flex-col gap-2">
          {doc.blocks.map((block) => (
            <OutlineItem key={block.id} block={block} {...rest} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>)
}

function OutlineItem({ block, selectedId, invalidIds, readOnly, onSelect, onToggleHidden, onRemove }: Omit<Props, "doc" | "onMove"> & { block: DraftBlock }) {
  const def = BLOCK_BY_TYPE[block.type]
  const Icon = BLOCK_ICONS[def.icon]
  const selected = block.id === selectedId
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: readOnly })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-1 rounded-xl border bg-card p-1.5", selected && "border-primary ring-1 ring-primary", isDragging && "opacity-60", block.hidden && "opacity-70")}
    >
      <button type="button" aria-label={`Reorder ${def.label}`} className="cursor-grab rounded-md p-1 text-muted-foreground" {...attributes} {...listeners}>
        <GripVerticalIcon aria-hidden className="size-4" />
      </button>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-current={selected ? "true" : undefined} onClick={() => onSelect(block.id)}>
        {Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{def.label}</span>
          <span className="truncate text-xs text-muted-foreground">
            #{block.anchor}
            {block.joinPrevious ? " · same card" : ""}
          </span>
        </span>
      </button>
      {invalidIds.has(block.id) ? <StatusPill tone="danger">Fix</StatusPill> : null}
      <Button type="button" variant="ghost" size="icon" disabled={readOnly} aria-label={block.hidden ? `Show ${def.label}` : `Hide ${def.label}`} onClick={() => onToggleHidden(block)}>
        {block.hidden ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
      </Button>
      <Button type="button" variant="ghost" size="icon" disabled={readOnly} aria-label={`Remove ${def.label}`} onClick={() => onRemove(block.id)}>
        <TrashIcon aria-hidden />
      </Button>
    </li>)
}
```

`admin/modules/pages/block-library.tsx` (client) — props `{ open, onOpenChange, kind: PageKind, doc: DraftDocument, onAdd(type: BlockType) }`: a `Dialog` titled "Add a block" (description "Only blocks this page can publish are listed.") with a grid of buttons, one per `addableTypes(kind, doc)`, each showing `BLOCK_ICONS[def.icon]` and `def.label`; clicking calls `onAdd(type)` then `onOpenChange(false)`.


`admin/modules/pages/block-form.tsx`:

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo } from "react"
import { useForm, type FieldValues, type Resolver } from "react-hook-form"
import type * as z from "zod"

import { toFields } from "@/admin/components/schema-form/to-fields"
import { FieldWidget } from "@/admin/components/schema-form/widgets"
import type { DraftBlock } from "@/blocks/page"
import { BLOCK_BY_TYPE } from "@/blocks/registry"
import { FieldGroup } from "@/components/ui/field"

import { BLOCK_FIELD_UI } from "./block-ui"

// A live form: every change goes to the builder (and so to autosave), valid
// or not; errors show inline and publish re-checks on the server. Keyed by
// block id by the caller, so switching blocks starts a fresh form.
export function BlockForm({ block, errors, readOnly, onChange }: { block: DraftBlock; errors?: Record<string, string[]>; readOnly: boolean; onChange(data: Record<string, unknown>): void }) {
  const def = BLOCK_BY_TYPE[block.type]
  const overrides = BLOCK_FIELD_UI[block.type]
  const fields = useMemo(() => toFields(def.schema, overrides), [def, overrides])
  const form = useForm<FieldValues, unknown, FieldValues>({
    resolver: zodResolver(def.schema as unknown as z.ZodType<FieldValues, FieldValues>) as Resolver<FieldValues, unknown, FieldValues>,
    defaultValues: block.data, mode: "onChange" })
  useEffect(() => {
    void form.trigger()
  }, [form])
  useEffect(() => {
    const subscription = form.watch((values) => onChange(structuredClone(values) as Record<string, unknown>))
    return () => subscription.unsubscribe()
  }, [form, onChange])
  useEffect(() => {
    for (const [name, messages] of Object.entries(errors ?? {})) {
      if (!name.startsWith("$") && messages[0]) form.setError(name, { type: "server", message: messages[0] })
    }
  }, [errors, form])
  return (
    <fieldset disabled={readOnly} className="min-w-0">
      <legend className="sr-only">{def.label}</legend>
      <FieldGroup>
        {fields.map((field) => (
          <FieldWidget key={field.name} field={field} control={form.control} />
        ))}
      </FieldGroup>
    </fieldset>)
}
```

`admin/modules/pages/block-meta.tsx` (client) — props `{ block, first: boolean, errors?: Record<string, string[]>, readOnly, onChange(patch: Partial<Pick<DraftBlock, "anchor" | "chapter" | "hidden" | "joinPrevious">>) }`, built from `Field`/`FieldLabel`/`FieldError`/`FieldDescription`/`Input`/`Switch`:
- "Section id" input bound to `anchor`; error from `errors?.$anchor?.[0]`, else description `Used in links like /about#{anchor}`.
- "Journey rail label" input bound to `chapter` (`maxLength={24}`, `""` → `null`), description "Empty keeps this section out of the rail."
- Switches "Hidden" (`hidden`) and "Same card as the previous block" (`joinPrevious`, disabled when `first`). Everything disabled when `readOnly`.


`admin/modules/pages/history-sheet.tsx` (client) — props `{ open, onOpenChange, pageId, getVersion(): number, canRestore, onRestored(), onConflict(conflict: Conflict) }`: a `Sheet` titled "History" listing `useQuery({ ...pageRevisionsQuery(pageId), enabled: open })` items as `Version {version} · {createdBy ?? "Someone"} · {formatDistanceToNow(createdAt)}`, empty state "Nothing published yet.". With `canRestore`, each row has **"Load into draft"** → `parseResponse(pagesApi[":id"].revisions[":rev"].restore.$post({ param: { id: pageId, rev }, json: { version: getVersion() } }))` → close + `onRestored()`; a 409 → `onConflict(conflictOf(error)!)`; other errors → `toast.error(message)`.


`admin/modules/pages/preview-pane.tsx`:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const DEVICES = { desktop: 1440, tablet: 834, phone: 390 } as const
type Device = keyof typeof DEVICES

// The site in draft mode (Task 2), scaled to the pane. `refreshKey` changes
// after each autosave; a same-origin reload keeps the iframe's scroll.
export function PreviewPane({ path, refreshKey }: { path: string; refreshKey: number | null }) {
  const [device, setDevice] = useState<Device>("desktop")
  const [scale, setScale] = useState(1)
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const width = DEVICES[device]
  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, (entry?.contentRect.width ?? width) / width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [width])
  useEffect(() => {
    if (refreshKey) frame.current?.contentWindow?.location.reload()
  }, [refreshKey])
  return (
    <section aria-label="Live preview" className="flex min-h-[70vh] flex-col gap-3">
      <ToggleGroup value={[device]} onValueChange={(value) => value[0] && setDevice(value[0] as Device)} aria-label="Preview size">
        <ToggleGroupItem value="desktop">Desktop</ToggleGroupItem>
        <ToggleGroupItem value="tablet">Tablet</ToggleGroupItem>
        <ToggleGroupItem value="phone">Phone</ToggleGroupItem>
      </ToggleGroup>
      <div ref={box} className="relative flex-1 overflow-hidden rounded-2xl border bg-muted">
        <iframe ref={frame} title="Page preview"
          src={`/api/v1/admin/preview?path=${encodeURIComponent(path)}`}
          className="absolute top-0 left-0 border-0 bg-white"
          style={{ width, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: "top left" }}
        />
      </div>
    </section>)
}
```

`admin/modules/pages/save-indicator.tsx` (client) — `SaveIndicator({ state: AutosaveState })` renders `<p aria-live="polite">` with: idle "No changes yet", pending "Unsaved changes", saving "Saving…", saved `Saved {n} s ago` (n from `state.savedAt`, re-rendered by a 5 s `setInterval` that updates a `now` state), error `Couldn't save: {state.error}`, conflict "Changed by someone else". The E2E waits for `/^Saved \d+ s ago$/`.


`admin/modules/pages/conflict-dialog.tsx` (client) — `ConflictDialog({ conflict: Conflict | null, onReview, onOverwrite })`: `<Dialog open={conflict !== null}>` (no `onOpenChange`, `showCloseButton={false}`, so it cannot be dismissed without a choice), title **"Changed by someone else"**, description `{updatedBy ?? "Someone"} saved this page at {time, en-IE, Europe/Dublin}. Review loads their version and drops your unsaved edits; Overwrite saves yours over theirs.`, buttons **"Review changes"** (outline → `onReview`) and **"Overwrite"** (→ `onOverwrite`).


`admin/modules/pages/seo-form.tsx` (client) — `SeoForm({ page: PageDetail, onSaved() })`: a two-column layout, `SchemaForm` on the left, a search-result preview card on the right (`page.path`, `seo.title || title`, `seo.description || "No description yet."`). The schema and the payload are the part that matters:

```tsx
const MetaForm = z.object({
  title: z.string().trim().min(1).max(80).register(ui, { label: "Page title", description: "Used in the admin, and as the SEO title when that is empty." }),
  seoTitle: z.string().trim().max(70).register(ui, { label: "SEO title" }),
  description: z.string().trim().max(200).register(ui, { label: "Meta description", widget: "textarea" }),
  ogImage: MediaRef.nullable(), noindex: z.boolean().register(ui, { label: "Hide from search engines" }),
  showContactChapter: z.boolean().register(ui, { label: "Show the footer's Contact chapter in the journey rail" }),
})

// Live on save (docs/brief.md §6.5). Only the fields the actor may change
// are sent, so a marketer's save never trips the page.update check.
const payload = (v: z.output<typeof MetaForm>, canPage: boolean, canSeo: boolean) => ({
  ...(canPage ? { title: v.title, settings: { showContactChapter: v.showContactChapter } } : {}),
  ...(canSeo ? { seo: { title: v.seoTitle || null, description: v.description || null, ogImage: v.ogImage, noindex: v.noindex } } : {}),
})
```

Defaults come from `page.title`, `page.seo.{title,description,ogImage,noindex}` (`?? ""`/`null`/`false`) and `page.settings.showContactChapter ?? true`; `overrides={{ ogImage: { label: "Social share image" } }}`; submit → `parseResponse(pagesApi[":id"].seo.$patch({ param: { id: page.id }, json: payload(v, canPage, canSeo) }))`, `toast.success("SEO saved")`, `onSaved()`; `ApiError` → `{ formError, fieldErrors }`. `canPage = usePermission({ page: ["update"] })`, `canSeo = usePermission({ seo: ["update"] })`.


`admin/modules/pages/page-builder.tsx`:

```tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { HistoryIcon, PlusIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { PageHeader, PRIMARY_ACTION, SECONDARY_ACTION } from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { usePermission } from "@/admin/lib/actor-context"
import { pagesApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { DraftDocument, type DraftBlock } from "@/blocks/page"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { BlockForm } from "./block-form"
import { BlockLibrary } from "./block-library"
import { BlockMeta } from "./block-meta"
import { BlockOutline } from "./block-outline"
import { docReducer, errorsByBlock, type DocAction } from "./builder-state"
import { ConflictDialog } from "./conflict-dialog"
import { HistorySheet } from "./history-sheet"
import { PreviewPane } from "./preview-pane"
import { pageDetailQuery, type PageDetail } from "./queries"
import { SaveIndicator } from "./save-indicator"
import { SeoForm } from "./seo-form"
import { conflictOf, useAutosave } from "./use-autosave"

export function PageBuilder({ id }: { id: string }) {
  const query = useQuery(pageDetailQuery(id))
  // Review / restore / discard load the server copy into a fresh builder.
  const [generation, setGeneration] = useState(0)
  const reload = useCallback(async () => {
    await query.refetch()
    setGeneration((g) => g + 1)
  }, [query])
  if (query.isPending) return <CardSkeleton />
  if (query.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{query.error.message}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>Try again</Button>
      </div>)
  }
  return <Builder key={generation} page={query.data} reload={reload} />
}

const toDraft = (value: unknown): DraftDocument => {
  const parsed = DraftDocument.safeParse(value)
  return parsed.success ? parsed.data : { blocks: [] }
}

function Builder({ page, reload }: { page: PageDetail; reload(): Promise<void> }) {
  const queryClient = useQueryClient()
  const canEdit = usePermission({ page: ["update"] })
  const canPublish = usePermission({ page: ["publish"] })
  const readOnly = !canEdit
  const [doc, setDoc] = useState(() => toDraft(page.draft))
  const docRef = useRef(doc)
  const [selectedId, setSelectedId] = useState<string | null>(doc.blocks[0]?.id ?? null)
  const [publishErrors, setPublishErrors] = useState<Record<string, string[]>>({})
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const { state, schedule, flush, overwrite, markConflict, setVersion, getVersion } = useAutosave<DraftDocument>({
    version: page.version, save: (document, version) =>
      parseResponse(pagesApi[":id"].draft.$patch({ param: { id: page.id }, json: { version, document } })) })

  const apply = useCallback((action: DocAction) => {
      const next = docReducer(docRef.current, action)
      docRef.current = next
      setDoc(next)
      schedule(next)
      return next
    }, [schedule])

  const selected = doc.blocks.find((block) => block.id === selectedId) ?? null
  const blockErrors = useMemo(() => errorsByBlock(publishErrors, doc), [publishErrors, doc])
  const onData = useCallback((data: Record<string, unknown>) => {
      if (selectedId) apply({ type: "data", id: selectedId, data })
    }, [apply, selectedId])

  // ⌘S / Ctrl+S saves now (a modifier shortcut, not a single-key hotkey).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void flush()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [flush])

  const handleError = (error: Error) => {
    const conflict = conflictOf(error)
    if (conflict) return markConflict(conflict)
    if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
      setPublishErrors(error.fieldErrors)
      const [first] = errorsByBlock(error.fieldErrors, docRef.current).keys()
      if (first) setSelectedId(first)
    }
    toast.error(error.message)
  }

  const publish = useMutation({ mutationFn: async () => {
      if (!(await flush())) throw new Error("Your latest changes are not saved yet")
      return parseResponse(pagesApi[":id"].publish.$post({ param: { id: page.id }, json: { version: getVersion() } }))
    }, onSuccess: (result) => {
      setVersion(result.version)
      setPublishErrors({})
      toast.success("Published")
      void queryClient.invalidateQueries({ queryKey: queryKeys.pages.list })
    }, onError: handleError })

  const discard = useMutation({ mutationFn: async () => {
      await flush()
      return parseResponse(pagesApi[":id"].discard.$post({ param: { id: page.id }, json: { version: getVersion() } }))
    }, onSuccess: () => void reload(), onError: handleError })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={page.title} description={<span className="font-mono text-xs">{page.path}</span>}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone={page.status === "published" ? "success" : "neutral"}>{page.status === "published" ? "Published" : "Draft"}</StatusPill>
            <SaveIndicator state={state} />
            <Button variant="outline" onClick={() => setHistoryOpen(true)}>
              <HistoryIcon data-icon="inline-start" />
              History
            </Button>
            {canEdit && page.status === "published" ? (
              <Button variant="outline" className={SECONDARY_ACTION} disabled={discard.isPending} onClick={() => window.confirm("Throw away every unpublished change?") && discard.mutate()}>
                Discard
              </Button>
            ) : null}
            {canPublish ? (
              <Button className={PRIMARY_ACTION} disabled={publish.isPending} onClick={() => publish.mutate()}>
                Publish
              </Button>
            ) : null}
          </div>
        }
      />
      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>
        <TabsContent value="content">
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_minmax(0,1.1fr)]">
            <nav aria-label="Page outline" className="flex flex-col gap-3">
              <BlockOutline doc={doc} selectedId={selectedId} invalidIds={new Set(blockErrors.keys())}
                readOnly={readOnly}
                onSelect={setSelectedId}
                onMove={(from, to) => apply({ type: "move", from, to })}
                onToggleHidden={(block: DraftBlock) => apply({ type: "meta", id: block.id, patch: { hidden: !block.hidden } })}
                onRemove={(id) => {
                  if (window.confirm("Remove this block?")) apply({ type: "remove", id })
                }}
              />
              {canEdit ? (
                <Button variant="outline" onClick={() => setLibraryOpen(true)}>
                  <PlusIcon data-icon="inline-start" />
                  Add block
                </Button>
              ) : null}
            </nav>
            <section aria-label="Block settings" className="flex min-w-0 flex-col gap-6">
              {selected ? (
                <>
                  <BlockMeta block={selected} first={doc.blocks[0]?.id === selected.id}
                    errors={blockErrors.get(selected.id)}
                    readOnly={readOnly}
                    onChange={(patch) => apply({ type: "meta", id: selected.id, patch })}
                  />
                  <BlockForm key={selected.id} block={selected} errors={blockErrors.get(selected.id)} readOnly={readOnly} onChange={onData} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Choose a block to edit it.</p>
              )}
            </section>
            <PreviewPane path={page.path} refreshKey={state.savedAt} />
          </div>
        </TabsContent>
        <TabsContent value="seo">
          <SeoForm page={page} onSaved={() => void queryClient.invalidateQueries({ queryKey: queryKeys.pages.detail(page.id) })} />
        </TabsContent>
      </Tabs>
      <BlockLibrary open={libraryOpen} onOpenChange={setLibraryOpen} kind={page.kind} doc={doc}
        onAdd={(type) => {
          const before = new Set(docRef.current.blocks.map((b) => b.id))
          const next = apply({ type: "add", blockType: type })
          setSelectedId(next.blocks.find((b) => !before.has(b.id))?.id ?? null)
        }}
      />
      <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} pageId={page.id} getVersion={getVersion} canRestore={canEdit} onRestored={() => void reload()} onConflict={markConflict} />
      <ConflictDialog conflict={state.status === "conflict" ? state.conflict : null} onReview={() => void reload()} onOverwrite={() => void overwrite()} />
    </div>)
}
```

(`window.confirm` keeps this task small; Task 11 polish may swap it for an `AlertDialog`. `PageDetail["kind"]` is the `PageKind` union from `kindOf`.)

- [ ] **Step 6: E2E specs and the author account**

`tests/e2e/fixtures/users.ts` — add `author: { email: "author@e2e.test", name: "Abe Author", role: "author" },`. `tests/e2e/support/storage.ts` — add `author: path.join(dir, "author.json")`. `tests/e2e/admin/auth.setup.ts` — add `["author", E2E_USERS.author]` to `PLAIN`.

`tests/e2e/admin/content/editing.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { api, createPublishedPage, richTextDocument } from "../../support/api"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

const heroDoc = (mediaId: string, title: string) => ({ blocks: [{ id: "e2e-home", type: "hero.page",
      anchor: "home", chapter: "Welcome", hidden: false, joinPrevious: false,
      data: { title, subtitle: "Subtitle", image: { mediaId }, focal: null, tint: 0.3, mirror: false } },
    richTextDocument("Body").blocks[0]] })

// Acceptance: edit the hero → preview shows the draft → publish → the
// public page updates on the next request.
test("edit, preview, publish", async ({ page, browser }) => {
  const { items } = await api<{ items: { id: string }[] }>(page.request, "GET", "/media?pageSize=1&type=image")
  const { id, path } = await createPublishedPage(page.request, "", heroDoc(items[0]!.id, "Old title"))
  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto(path)
  await expect(visitor.getByRole("heading", { name: "Old title" })).toBeVisible()

  await page.goto(`/admin/pages/${id}`)
  await page.getByRole("button", { name: /^Page hero/ }).click()
  await page.getByRole("group", { name: "Page hero" }).getByLabel("Title", { exact: true }).fill("New title")
  await expect(page.getByText(/^Saved \d+ s ago$/)).toBeVisible({ timeout: 10_000 })
  await expect(page.frameLocator('iframe[title="Page preview"]').getByRole("heading", { name: "New title" })).toBeVisible()

  await visitor.reload()
  await expect(visitor.getByRole("heading", { name: "Old title" })).toBeVisible()

  const published = page.waitForResponse((r) => r.url().endsWith(`/pages/${id}/publish`) && r.ok())
  await page.getByRole("button", { name: "Publish" }).click()
  await published
  await visitor.reload()
  await expect(visitor.getByRole("heading", { name: "New title" })).toBeVisible() })
```

`tests/e2e/admin/content/conflict.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test"

import { createPublishedPage } from "../../support/api"
import { STORAGE } from "../../support/storage"

async function type(page: Page, text: string) {
  const box = page.getByRole("textbox", { name: "Text" })
  await box.click()
  await page.keyboard.press("End")
  await page.keyboard.type(text)
}

// Acceptance: concurrent edits produce the 409 dialog.
test("a second tab gets the conflict dialog", async ({ browser }) => {
  const context = await browser.newContext({ storageState: STORAGE.editor })
  const [a, b] = [await context.newPage(), await context.newPage()]
  const { id } = await createPublishedPage(a.request, "Shared words")
  for (const tab of [a, b]) await tab.goto(`/admin/pages/${id}`)

  await type(a, " from A")
  await expect(a.getByText(/^Saved \d+ s ago$/)).toBeVisible({ timeout: 10_000 })
  await type(b, " from B")
  const dialog = b.getByRole("dialog", { name: "Changed by someone else" })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByRole("button", { name: "Review changes" }).click()
  await expect(b.getByText("Shared words from A")).toBeVisible() })
```

`tests/e2e/admin/content/rbac.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { E2E_ORIGIN } from "../../fixtures/env"
import { createPublishedPage } from "../../support/api"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.author })

// Acceptance: an author gets 403 on publish.
test("an author cannot publish", async ({ page, browser }) => {
  const editor = await browser.newContext({ storageState: STORAGE.editor })
  const { id, version } = await createPublishedPage(editor.request, "Words")
  const response = await page.request.post(`/api/v1/admin/pages/${id}/publish`, { data: { version },
    headers: { origin: E2E_ORIGIN } })
  expect(response.status()).toBe(403)
  expect((await response.json()).error.code).toBe("FORBIDDEN")
  await page.goto(`/admin/pages/${id}`)
  await expect(page.getByRole("heading", { name: "E2E page" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0) })
```

- [ ] **Step 7: Run everything**

Run: `pnpm vitest run --project unit admin && pnpm lint && pnpm typecheck && pnpm build && E2E_SKIP_BUILD=1 pnpm test:e2e tests/e2e/admin/content`
Expected: PASS. If `pnpm e2e:seed` has not run since `author` was added, run it first. If the iframe heading is not found, confirm `PageHero` renders the title as a heading; if it renders a `<p>`, assert with `getByText("New title")` inside the frame instead.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml admin/modules/pages "app/(admin)/admin/(panel)/pages" tests/e2e
git commit -m "feat(admin): page builder with autosave, live preview and history"
```

---
### Task 8: Collection and settings screens

**Files:**
- Create: `app/(admin)/admin/(panel)/collections/page.tsx`, `app/(admin)/admin/(panel)/collections/[name]/page.tsx`, `app/(admin)/admin/(panel)/settings/page.tsx`, `app/(admin)/admin/(panel)/settings/[slug]/page.tsx`, `admin/modules/collections/{collection-ui.ts,collection-view.tsx,item-sheet.tsx}`, `admin/modules/globals/{queries.ts,global-ui.ts,global-editor.tsx}`, `tests/e2e/admin/content/{collections,settings}.spec.ts`
- Modify: `admin/modules/collections/queries.ts`
- Test: E2E specs above; `admin/modules/globals/global-ui.test.ts`

**Interfaces:**
- Consumes: `collectionsApi`, `globalsApi`, `COLLECTION_SCHEMAS`/`COLLECTION_NAMES`/`COLLECTION_LABELS`, `GLOBALS`, `GLOBAL_ACCESS`, `SETTINGS_PAGES`, `GLOBAL_LABELS`, `SchemaForm` (+`overrides`), `emptyValueFor`, `conflictOf`, `visibleNav`, `permissionFor`, dnd-kit (Task 7).
- Produces: `collectionListQuery(name)`, `globalQuery(key)`, `globalRevisionsQuery(key)`, `COLLECTION_FIELD_UI`, `GLOBAL_FIELD_UI`; screens `/admin/collections/:name` and `/admin/settings/:slug`.

- [ ] **Step 1: Write the failing tests**

`admin/modules/globals/global-ui.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { toFields } from "@/admin/components/schema-form/to-fields"
import { SETTINGS_PAGES } from "@/lib/content/global-access"
import { GLOBALS } from "@/lib/content/globals"

import { GLOBAL_FIELD_UI } from "./global-ui"

// Every settings document must render: no field without a widget, no group
// without children (a schema change that toFields cannot draw fails here).
describe("settings forms", () => {
  it.each(Object.values(SETTINGS_PAGES).flat())("%s renders", (key) => {
    const walk = (fields: ReturnType<typeof toFields>): void => {
      for (const field of fields) {
        expect(field.widget, field.name).toBeTruthy()
        if (field.widget === "group") expect(field.fields?.length, field.name).toBeGreaterThan(0)
        walk(field.fields ?? [])
        if (field.item) walk([field.item])
      }
    }
    walk(toFields(GLOBALS[key], GLOBAL_FIELD_UI[key])) })
  it("explains the unused clinic photo (P3 carry)", () => {
    const fields = toFields(GLOBALS.contact, GLOBAL_FIELD_UI.contact)
    const clinic = fields.find((f) => f.name === "clinic")!
    expect(clinic.fields!.find((f) => f.name === "clinic.photo")!.description).toMatch(/Clinic block/) }) })
```

`tests/e2e/admin/content/collections.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

// A hidden row never reaches the public site, so parity is untouched.
test("add a hidden FAQ, see where FAQs are used, delete it", async ({ page }) => {
  const question = `E2E question ${Date.now()}?`
  await page.goto("/admin/collections/faqs")
  await page.getByRole("button", { name: "Add FAQ" }).click()
  const sheet = page.getByRole("dialog")
  await sheet.getByLabel("Question").fill(question)
  await sheet.getByLabel("Answer").fill("An answer written by the E2E suite.")
  await sheet.getByLabel("Visible on the site").click()
  await sheet.getByRole("button", { name: "Save" }).click()
  const row = page.getByRole("row", { name: new RegExp(question.replace("?", "\\?")) })
  await expect(row).toBeVisible()
  await expect(row).toContainText("Hidden")
  // FAQ blocks in "all" mode show every row, so the hint names their pages.
  await expect(row).not.toContainText("Not used")

  await row.getByRole("button", { name: "Delete" }).click()
  await page.getByRole("button", { name: "Delete for good" }).click()
  await expect(row).toHaveCount(0) })
```

`tests/e2e/admin/content/settings.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test"

import { STORAGE } from "../../support/storage"

// Notifications are not public, so editing them cannot disturb parity.
test.use({ storageState: STORAGE.owner })

const recipients = (page: Page) =>
  page.getByLabel(/^Recipients \d+$/).evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).value))

test("save a setting twice, then roll back to the first save", async ({ page }) => {
  await page.goto("/admin/settings/notifications")
  const [first, second] = [`a-${Date.now()}@example.com`, `b-${Date.now()}@example.com`]
  for (const email of [first, second]) {
    await page.getByRole("button", { name: "Add to recipients" }).click()
    await page.getByLabel(/^Recipients \d+$/).last().fill(email)
    await page.getByRole("button", { name: "Save notifications" }).click()
    await expect(page.getByText("Notifications saved").last()).toBeVisible()
  }
  expect(await recipients(page)).toEqual(expect.arrayContaining([first, second]))

  await page.getByRole("button", { name: "History" }).click()
  // Newest first: index 1 is the first save.
  await page.getByRole("button", { name: "Restore" }).nth(1).click()
  await expect(page.getByText("Restored")).toBeVisible()
  await expect.poll(() => recipients(page)).not.toContain(second)
  expect(await recipients(page)).toContain(first) })
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run --project unit admin/modules/globals`
Expected: FAIL (`./global-ui` missing).

- [ ] **Step 3: Implement queries and field hints**

`admin/modules/collections/queries.ts` — append:

```ts
import type { CollectionSlug } from "@/lib/content/collections"

export const collectionListQuery = (name: CollectionSlug) =>
  queryOptions({ queryKey: queryKeys.collections.list(name),
    queryFn: () => parseResponse(collectionsApi[":name"].$get({ param: { name } })) })
```

`admin/modules/collections/collection-ui.ts`:

```ts
import type { FieldOverrides } from "@/admin/components/schema-form/to-fields"
import type { CollectionSlug } from "@/lib/content/collections"

const visible = { isVisible: { label: "Visible on the site", description: "Hidden rows stay here but leave every page." } }

export const COLLECTION_FIELD_UI: Record<CollectionSlug, FieldOverrides> = {
  services: { ...visible, slug: { description: "Used in contact links (?topic=); changing it breaks old links." } },
  plans: { ...visible, priceCents: { label: "Price in cents", description: "For search engines only; the label is what visitors see." } },
  testimonials: { ...visible, avatar: { label: "Photo" } },
  faqs: { ...visible, answer: { widget: "textarea" } }, steps: { ...visible, frame: { label: "Image crop" } },
  "cta-bands": { ...visible, cta: { label: "Button" } } }

export const ITEM_NOUN: Record<CollectionSlug, string> = { services: "service", plans: "plan",
  testimonials: "testimonial", faqs: "FAQ", steps: "step", "cta-bands": "band" }
```

`admin/modules/globals/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { globalsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import type { EditableGlobalKey } from "@/lib/content/global-access"

export type GlobalDoc = InferResponseType<(typeof globalsApi)[":key"]["$get"], 200>

export const globalQuery = (key: EditableGlobalKey) =>
  queryOptions({ queryKey: queryKeys.globals.detail(key),
    queryFn: () => parseResponse(globalsApi[":key"].$get({ param: { key } })) })

export const globalRevisionsQuery = (key: EditableGlobalKey) =>
  queryOptions({ queryKey: queryKeys.globals.revisions(key),
    queryFn: () => parseResponse(globalsApi[":key"].revisions.$get({ param: { key } })) })
```

`admin/modules/globals/global-ui.ts`:

```ts
import type { FieldOverrides } from "@/admin/components/schema-form/to-fields"
import type { EditableGlobalKey } from "@/lib/content/global-access"

export const GLOBAL_FIELD_UI: Partial<Record<EditableGlobalKey, FieldOverrides>> = {
  site: { logo: { label: "Logo" }, icon: { label: "Favicon" }, social: { label: "Social profiles" } },
  contact: { "phone.e164": { label: "Phone for links (E.164)", placeholder: "+35312345678" },
    "hours.weekly": { label: "Opening hours" },
    "hours.weekly.$.days": { label: "Days (1 = Monday … 7 = Sunday)" },
    "hours.summary": { description: "How the site prints the hours." },
    // Phase 3 ruling: the Clinic block's own photo is the single source.
    "clinic.photo": { description: "Not shown on the site: the Clinic block's photo is used." } },
  footer: { "columns.$.source": { label: "Links", description: '"Navigation" appends the header links (auto sitemap).' } },
  contactForm: { planMessage: { description: '"{name}", "{price}" and "{unit}" come from the chosen plan.' } },
  microcopy: { readTime: { description: '"{minutes}" is replaced.' }, showing: { description: '"{shown}" and "{total}" are replaced.' } },
  notifications: { recipients: { label: "Recipients" } } }
```

- [ ] **Step 4: Implement the screens**

`app/(admin)/admin/(panel)/collections/page.tsx`:

```tsx
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export default function CollectionsIndex() {
  return (
    <Suspense>
      <Go />
    </Suspense>)
}

async function Go() {
  await requirePermission(permissionFor("/admin/collections"))
  redirect("/admin/collections/services")
}
```

`app/(admin)/admin/(panel)/collections/[name]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { CollectionView } from "@/admin/modules/collections/collection-view"
import { permissionFor } from "@/lib/admin/nav"
import { COLLECTION_NAMES, type CollectionSlug } from "@/lib/content/collections"
import { requireActor, requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Collections" }

export default function CollectionPage({ params }: PageProps<"/admin/collections/[name]">) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate params={params} />
    </Suspense>)
}

// Signed in before the 404, so a stranger never learns which paths exist;
// permissionFor throws for unregistered paths, so the name is checked first.
async function Gate({ params }: { params: PageProps<"/admin/collections/[name]">["params"] }) {
  const { name } = await params
  const path = `/admin/collections/${name}`
  await requireActor(path)
  if (!(COLLECTION_NAMES as readonly string[]).includes(name)) notFound()
  await requirePermission(permissionFor(path), path)
  return <CollectionView name={name as CollectionSlug} />
}
```

`app/(admin)/admin/(panel)/settings/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { visibleNav } from "@/lib/admin/nav"
import { requireActor } from "@/server/auth/session"

export default function SettingsIndex() {
  return (
    <Suspense>
      <Go />
    </Suspense>)
}

// The first settings page this person may open (nav gates each child).
async function Go() {
  const actor = await requireActor("/admin/settings")
  const first = visibleNav(actor.roles).find((item) => item.id === "settings")?.children?.[0]
  if (!first) notFound()
  redirect(first.href)
}
```

`app/(admin)/admin/(panel)/settings/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { GlobalEditor } from "@/admin/modules/globals/global-editor"
import { linkForPath } from "@/lib/admin/nav"
import { SETTINGS_PAGES, type SettingsPage } from "@/lib/content/global-access"
import { requireActor, requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Site settings" }

export default function SettingsSlugPage({ params }: PageProps<"/admin/settings/[slug]">) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate params={params} />
    </Suspense>)
}

async function Gate({ params }: { params: PageProps<"/admin/settings/[slug]">["params"] }) {
  const { slug } = await params
  const path = `/admin/settings/${slug}`
  await requireActor(path)
  const link = linkForPath(path)
  if (!link || !Object.hasOwn(SETTINGS_PAGES, slug)) notFound()
  await requirePermission(link.permission, path)
  return <GlobalEditor title={link.label} keys={SETTINGS_PAGES[slug as SettingsPage]} />
}
```

`admin/modules/globals/global-editor.tsx` (client) — `GlobalEditor({ title, keys })`: `PageHeader` (title, "Changes go live as soon as you save."); one key renders one `GlobalForm`, several render `Tabs` labelled by `GLOBAL_LABELS`. The form wiring:

```tsx
// Globals go live on save (docs/brief.md §6.5), guarded by version; keyed by
// version so a save, a restore or a reload shows the stored values.
function GlobalForm({ settingKey }: { settingKey: EditableGlobalKey }) {
  const queryClient = useQueryClient()
  const doc = useQuery(globalQuery(settingKey))
  const canUpdate = usePermission(GLOBAL_ACCESS[settingKey].update)
  const [historyOpen, setHistoryOpen] = useState(false)
  const label = GLOBAL_LABELS[settingKey]
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.globals.detail(settingKey) })
  if (!doc.data) return <CardSkeleton />
  const { version, value } = doc.data
  return (
    <section aria-label={label} className="flex flex-col gap-4">
      <Button variant="outline" className="self-end" onClick={() => setHistoryOpen(true)}>History</Button>
      <fieldset disabled={!canUpdate} className="min-w-0">
        <SchemaForm key={version} schema={GLOBALS[settingKey]} overrides={GLOBAL_FIELD_UI[settingKey]}
          defaultValues={value}
          submitLabel={`Save ${label.toLowerCase()}`}
          onSubmit={async (next) => {
            try {
              await parseResponse(globalsApi[":key"].$put({ param: { key: settingKey }, json: { version, value: next } }))
              toast.success(`${label} saved`)
              await refresh()
            } catch (error) {
              if (conflictOf(error)) {
                await refresh()
                return { formError: "Someone else saved this a moment ago. Their version is loaded; make your change again." }
              }
              if (error instanceof ApiError) return { formError: error.message, fieldErrors: error.fieldErrors }
              throw error
            }
          }}
        />
      </fieldset>
      <GlobalHistory settingKey={settingKey} open={historyOpen} onOpenChange={setHistoryOpen} version={version} canRestore={canUpdate} onRestored={refresh} />
    </section>)
}
```

`GlobalHistory` is the page `HistorySheet` shape (Task 7) over `globalRevisionsQuery(key)`: title `{label} history`, rows `Version {n} · {createdBy} · {ago}`, button **"Restore"** → `parseResponse(globalsApi[":key"].revisions[":rev"].restore.$post({ param: { key, rev }, json: { version } }))` → `toast.success("Restored")`, close, `onRestored()`; errors → `toast.error`.


`admin/modules/collections/item-sheet.tsx`:

```tsx
"use client"

import { toast } from "sonner"

import { emptyValueFor } from "@/admin/components/schema-form/to-fields"
import { SchemaForm } from "@/admin/components/schema-form/schema-form"
import { collectionsApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { conflictOf } from "@/admin/modules/pages/use-autosave"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { COLLECTION_SCHEMAS, type CollectionSlug } from "@/lib/content/collections"

import { COLLECTION_FIELD_UI, ITEM_NOUN } from "./collection-ui"

export type EditableItem = { id: string; version: number; values: Record<string, unknown> }

// Create (item = "new") or edit, from the collection's own schema. Saves go
// live (docs/brief.md §6.3); a stale version reloads the list.
export function ItemSheet({ name, item, onClose, onSaved }: { name: CollectionSlug; item: EditableItem | "new" | null; onClose(): void; onSaved(): Promise<unknown> }) {
  const schema = COLLECTION_SCHEMAS[name]
  const isNew = item === "new"
  const defaults = isNew ? { ...(emptyValueFor(schema) as Record<string, unknown>), isVisible: true } : item?.values
  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isNew ? `Add ${ITEM_NOUN[name]}` : `Edit ${ITEM_NOUN[name]}`}</SheetTitle>
        </SheetHeader>
        {defaults ? (
          <div className="p-4">
            <SchemaForm key={isNew ? "new" : `${item!.id}:${item!.version}`} schema={schema}
              overrides={COLLECTION_FIELD_UI[name]}
              defaultValues={defaults}
              submitLabel="Save"
              onSubmit={async (values) => {
                try {
                  if (isNew) await parseResponse(collectionsApi[":name"].$post({ param: { name }, json: { values } }))
                  else
                    await parseResponse(
                      collectionsApi[":name"][":id"].$patch({ param: { name, id: item!.id }, json: { version: item!.version, values } })
                    )
                  toast.success("Saved")
                  await onSaved()
                  onClose()
                } catch (error) {
                  if (conflictOf(error)) {
                    await onSaved()
                    onClose()
                    toast.error("Someone else changed this item. The list now shows their version.")
                    return
                  }
                  if (error instanceof ApiError) return { formError: error.message, fieldErrors: error.fieldErrors }
                  throw error
                }
              }}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>)
}
```

`admin/modules/collections/collection-view.tsx` (client) — `CollectionView({ name })`:
- `useQuery(collectionListQuery(name))`; `PageHeader` title `COLLECTION_LABELS[name]`, description "Saved changes are live straight away. Drag rows to change the order on the site.", action **`Add {ITEM_NOUN[name]}`** (with `collection.create`) → `ItemSheet` with `"new"`.
- `Table` rows sortable with the same `DndContext`/`SortableContext`/`useSortable` + `KeyboardSensor` setup as `block-outline.tsx`; the handle is a button `Reorder {title}`. `onDragEnd` computes `arrayMove(ids, from, to)`, sets it optimistically with `queryClient.setQueryData(queryKeys.collections.list(name), …)`, calls `parseResponse(collectionsApi[":name"].order.$patch({ param: { name }, json: { ids } }))`, toasts on failure, then invalidates (which also rolls back a refused order).
- Columns: Title · Used on (`usedOn.join(", ") || "Not used"`) · Visible (`Switch` `aria-label="Show {title}"` → `$patch({ param: { name, id }, json: { version, values: { isVisible } } })`, plus `StatusPill` neutral "Hidden" when off) · actions **"Edit"**/"View" (→ `ItemSheet`) and **"Delete"** (with `collection.delete`).
- Delete opens a `Dialog` "Delete “{title}”?" (description: "Items a page names (chosen FAQs, a band) can't be deleted until the page stops using them.") with **"Delete for good"** → `$delete({ param: { name, id } })`; the 409 message ("Still used on Home, About") is shown with `toast.error`.


- [ ] **Step 5: Run tests and gates**

Run: `pnpm vitest run --project unit admin && pnpm lint && pnpm typecheck && pnpm build && E2E_SKIP_BUILD=1 pnpm test:e2e tests/e2e/admin/content/collections.spec.ts tests/e2e/admin/content/settings.spec.ts tests/e2e/admin/shell/navigation.spec.ts`
Expected: PASS. `navigation.spec.ts` proves the new real routes still respect per-role visibility.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/admin/(panel)/collections" "app/(admin)/admin/(panel)/settings" admin/modules/collections admin/modules/globals tests/e2e/admin/content
git commit -m "feat(admin): collection tables and settings editors with history"
```

---

### Task 9: Media library, focal picker and step-frame cropper

**Files:**
- Install: `pnpm add react-easy-crop@6.2.3`
- Create: `app/(admin)/admin/(panel)/media/page.tsx`, `admin/modules/media/{upload.ts,media-view.tsx,media-details.tsx,focal-picker.tsx}`, `admin/components/schema-form/widgets/frame-widget.tsx`, `tests/e2e/admin/content/media.spec.ts`
- Modify: `admin/lib/api.ts` (export `apiErrorFrom`), `lib/content/frame.ts`, `lib/content/frame.test.ts`, `admin/components/schema-form/registry.ts` (`"frame"` widget), `admin/components/schema-form/widgets.tsx` (`case "frame"`), `admin/modules/collections/collection-ui.ts` (`steps.frame: { widget: "frame", label: "Image crop" }`)
- Test: `lib/content/frame.test.ts`, `admin/modules/media/upload.test.ts`, E2E `media.spec.ts`

**Interfaces:**
- Consumes: `mediaApi`, `mediaListQuery`, `queryKeys.media`, `gpsJpeg` (Task 5), `frameStyle`/`cropToFrame` (existing).
- Produces: `uploadFile(url, file, onProgress) → Promise<MediaItem>`; `apiErrorFrom(status, body) → ApiError`; `cropAreaToFrame(area)`, `frameToCropArea(frame)`, `STEP_SLOT_ASPECT`; widget `"frame"`; screen `/admin/media`.

- [ ] **Step 1: Write the failing tests**

Append to `lib/content/frame.test.ts` (merge into its `./frame` import):

```ts
import { cropAreaToFrame, frameToCropArea } from "./frame"

describe("cropper ↔ frame", () => {
  // react-easy-crop reports the visible part of the image in percent; the
  // site places the whole image relative to the slot.
  it("turns a centred half crop into a doubled, shifted image box", () => {
    expect(cropAreaToFrame({ x: 25, y: 25, width: 50, height: 50 })).toEqual({ x: -0.5, y: -0.5, w: 2, h: 2 })
  })
  it("round-trips a seeded frame", () => {
    const frame = { x: -0.11, y: -0.2593, w: 1.3517, h: 1.5926 }
    const back = cropAreaToFrame(frameToCropArea(frame))
    for (const key of ["x", "y", "w", "h"] as const) expect(back[key]).toBeCloseTo(frame[key], 4) }) })
```

`admin/modules/media/upload.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import { uploadFile } from "./upload"

class FakeXhr {
  static last: FakeXhr
  upload = { onprogress: null as ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  status = 0
  response: unknown = null
  responseType = ""
  open = vi.fn()
  send = vi.fn(() => {
    FakeXhr.last = this })
}

describe("uploadFile", () => {
  it("reports progress and resolves the stored item", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr)
    const progress = vi.fn()
    const done = uploadFile("/api/v1/admin/media", new File(["x"], "a.png"), progress)
    FakeXhr.last.upload.onprogress!({ lengthComputable: true, loaded: 5, total: 10 })
    Object.assign(FakeXhr.last, { status: 201, response: { id: "m1" } })
    FakeXhr.last.onload!()
    await expect(done).resolves.toEqual({ id: "m1" })
    expect(progress).toHaveBeenCalledWith(0.5)
    vi.unstubAllGlobals() })
  it("turns the error envelope into an ApiError", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr)
    const done = uploadFile("/api/v1/admin/media", new File(["x"], "a.svg"), () => {})
    Object.assign(FakeXhr.last, { status: 400, response: { error: { code: "VALIDATION_FAILED", message: "Upload a JPEG", requestId: "r", fieldErrors: { file: ["Upload a JPEG"] } } } })
    FakeXhr.last.onload!()
    await expect(done).rejects.toMatchObject({ code: "VALIDATION_FAILED", message: "Upload a JPEG" })
    vi.unstubAllGlobals() }) })
```

`tests/e2e/admin/content/media.spec.ts`:

```ts
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import { gpsJpeg } from "../../../support/gps-jpeg"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

// Acceptance: a 15 MB JPEG with GPS EXIF uploads, and the stored file has
// no GPS tags.
test("upload strips GPS; in-use files can't be deleted", async ({ page }) => {
  test.setTimeout(120_000)
  const buffer = await gpsJpeg()
  const name = `e2e-${Date.now()}.jpg`
  await page.goto("/admin/media")
  await page.getByLabel("Upload files").setInputFiles({ name, mimeType: "image/jpeg", buffer })
  const card = page.getByRole("button", { name: new RegExp(name.replace(".jpg", "")) })
  await expect(card).toBeVisible({ timeout: 60_000 })
  await card.click()
  const url = await page.getByRole("link", { name: "Open file" }).getAttribute("href")
  const stored = await page.request.get(url!)
  expect(stored.ok()).toBe(true)
  expect((await sharp(await stored.body()).metadata()).exif).toBeUndefined()

  await page.getByLabel("Alt text").fill("A calm consulting room")
  await page.getByRole("button", { name: "Save details" }).click()
  await expect(page.getByText("Details saved")).toBeVisible()
  await page.keyboard.press("Escape")

  // The legal pages' hero uses hero-bg.png (seeded), so it is in use.
  await page.getByLabel("Search the library").fill("hero-bg")
  await page.getByRole("button", { name: /hero-bg/ }).first().click()
  page.once("dialog", (dialog) => void dialog.accept())
  await page.getByRole("button", { name: "Delete file" }).click()
  await expect(page.getByText("This file is still in use")).toBeVisible() })
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run --project unit lib/content/frame.test.ts admin/modules/media`
Expected: FAIL.

- [ ] **Step 3: Implement the frame math, upload helper and frame widget**

`lib/content/frame.ts` — append:

```ts
// The step media slot's shape (the design's 381.75 × 216 box).
export const STEP_SLOT_ASPECT = 381.75 / 216

type CropArea = { x: number; y: number; width: number; height: number }

// react-easy-crop gives the visible part of the image in percent of the
// image; the site stores where the whole image sits relative to the slot.
export const cropAreaToFrame = (area: CropArea): StepFrame => {
  const w = 100 / area.width
  const h = 100 / area.height
  return { x: (-area.x / 100) * w, y: (-area.y / 100) * h, w, h }
}

export const frameToCropArea = (frame: StepFrame): CropArea => ({ x: (-frame.x / frame.w) * 100,
  y: (-frame.y / frame.h) * 100, width: 100 / frame.w, height: 100 / frame.h })
```

(`-0` vs `0`: if `toEqual` trips on `-0` in the first test, normalise with `+ 0` in `cropAreaToFrame`.)

`admin/lib/api.ts` — export the envelope parser for non-`hc` requests:

```ts
// For XMLHttpRequest uploads (progress events), which hc cannot make.
export function apiErrorFrom(status: number, body: unknown) {
  return fromStatus(status, (body as Envelope | null)?.error)
}
```

`admin/modules/media/upload.ts`:

```ts
import { apiErrorFrom } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"

import type { MediaItem } from "./queries"

// fetch() has no upload progress; XMLHttpRequest does. Same origin, so the
// session cookie and Origin header (sameOrigin) come with it.
export function uploadFile(url: string, file: File, onProgress: (fraction: number) => void): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    xhr.responseType = "json"
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.response as MediaItem) : reject(apiErrorFrom(xhr.status, xhr.response))
    xhr.onerror = () => reject(new ApiError("NETWORK", "Couldn't reach the server. Check your connection and try again.", 0))
    const form = new FormData()
    form.set("file", file)
    xhr.send(form) })
}
```

`admin/components/schema-form/registry.ts` — add `| "frame"` to `Widget`. `widgets.tsx` — in `FieldWidget`'s switch add `case "frame": return <FrameWidget field={field} control={control} />`.

`admin/components/schema-form/widgets/frame-widget.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import { useController, useWatch, type Control, type FieldValues } from "react-hook-form"

import { mediaListQuery } from "@/admin/modules/media/queries"
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field"
import { cropAreaToFrame, frameToCropArea, STEP_SLOT_ASPECT } from "@/lib/content/frame"
import type { StepFrame } from "@/lib/content/types"

import type { FormField } from "../to-fields"

// docs/brief.md §6.3: step frames are crop rectangles edited visually. The
// image is the sibling `image` field of the same row.
export function FrameWidget({ field, control }: { field: FormField; control: Control<FieldValues> }) {
  const { field: input } = useController({ name: field.name, control })
  const imageName = field.name.replace(/frame$/, "image")
  const image = useWatch({ control, name: imageName }) as { mediaId?: string } | undefined
  const media = useQuery({ ...mediaListQuery({ ids: image?.mediaId ? [image.mediaId] : [] }), enabled: Boolean(image?.mediaId) })
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const src = media.data?.items[0]?.url
  return (
    <FieldSet>
      <FieldLegend variant="label">{field.label}</FieldLegend>
      {src ? (
        <div className="relative h-64 overflow-hidden rounded-xl bg-muted">
          <Cropper image={src} crop={crop} zoom={zoom} aspect={STEP_SLOT_ASPECT}
            initialCroppedAreaPercentages={input.value ? frameToCropArea(input.value as StepFrame) : undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(area: Area) => input.onChange(cropAreaToFrame(area))}
          />
        </div>
      ) : (
        <FieldDescription>Choose the image first.</FieldDescription>
      )}
      <FieldDescription>Drag to move, scroll or pinch to zoom. The box is the shape the site shows.</FieldDescription>
    </FieldSet>)
}
```

After installing, check `node_modules/react-easy-crop/index.d.ts` (or `dist/types`) for the `initialCroppedAreaPercentages` and `onCropComplete(croppedArea, croppedAreaPixels)` names; `croppedArea` is in percent.

- [ ] **Step 4: Implement the library screens**

`app/(admin)/admin/(panel)/media/page.tsx` — same shape as `pages/page.tsx`: `metadata.title = "Media"`, gate on `permissionFor("/admin/media")`, render `<MediaView />`.

`admin/modules/media/focal-picker.tsx` (client) — `FocalPicker({ item, value: { x, y }, onChange })`: one `<button type="button">` wrapping the `next/image`, with `aria-label="Focal point {x%} across, {y%} down. Click the image or use the arrow keys."`; click sets `{ x, y }` from the pointer position over `getBoundingClientRect()`; ArrowLeft/Right/Up/Down move by 0.05 (`preventDefault`); values clamp to 0–1 and round to 0.01; a ring marker sits at `left: x%`, `top: y%`.


`admin/modules/media/media-details.tsx` (client) — `MediaDetails({ item: MediaItem | null, onClose })`: a `Sheet`; its body is keyed by `${id}:${url}` (a replace shows fresh state) and holds:
- `FocalPicker` (images only) and a link **"Open file"** (`href={item.url}`, new tab).
- Textarea labelled **"Alt text"** with a `{length}/300` counter (disabled when decorative), switch "Decorative (screen readers skip it)", input "Caption"; button **"Save details"** → `parseResponse(mediaApi[":id"].$patch({ param: { id }, json: { alt, caption: caption || null, isDecorative, focalX, focalY } }))` → `toast.success("Details saved")`, invalidate `queryKeys.media.all`.
- "Used on" list from `mediaApi[":id"].usage.$get` (`{label} ({kind})`, or "Not used anywhere").
- File input "Replace file (keeps every reference)" → `uploadFile(\`/api/v1/admin/media/${id}/replace\`, file, () => {})`, toast, invalidate, close.
- With `media.delete`: **"Delete file"** → `window.confirm` → `$delete`; an `ApiError` message (409: "This file is still in use") renders in `<p role="alert">`.


`admin/modules/media/media-view.tsx` (client) — `MediaView()`:
- URL state (docs/brief.md §8.4) via `useQueryStates({ q: parseAsString.withDefault(""), type: parseAsStringLiteral(["image", "pdf"] as const), missingAlt: parseAsBoolean.withDefault(false), page: parseAsInteger.withDefault(1) })` from `nuqs`, fed to `mediaListQuery`.
- With `media.upload`: a drop zone `<label>` ("Drop files here or choose them" / "JPEG, PNG, WebP, AVIF or PDF, up to 20 MB each") containing `<input type="file" multiple aria-label="Upload files" accept="image/jpeg,image/png,image/webp,image/avif,application/pdf" className="sr-only">`; `onDrop` and `onChange` call `upload(files)`, which uploads **one file at a time** with `uploadFile("/api/v1/admin/media", file, onProgress)`, shows `Uploading {name}: {pct}%` lines (`role="status"`), toasts per-file errors, then invalidates `queryKeys.media.all`.
- Filters: input `aria-label="Search the library"`, buttons All/Images/PDFs, switch "Missing alt text" (each resets `page` to 1).
- Grid of buttons (one per item; accessible name = filename) with a `next/image` thumbnail using `objectPosition` from the focal point (PDFs show `FileTextIcon`), the filename, and "Needs alt text" for images with empty alt that are not decorative; clicking opens `MediaDetails`. "Next page" when `total > page * pageSize`.


- [ ] **Step 5: Run tests and gates**

Run: `pnpm vitest run --project unit lib/content admin && pnpm lint && pnpm typecheck && pnpm build && E2E_SKIP_BUILD=1 pnpm test:e2e tests/e2e/admin/content/media.spec.ts`
Expected: PASS. If the 15 MB upload exceeds the default action timeout, keep `test.setTimeout(120_000)` and raise the card's `toBeVisible` timeout; never shrink the file below 15 MB.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml "app/(admin)/admin/(panel)/media" admin/modules/media admin/components/schema-form admin/modules/collections/collection-ui.ts admin/lib/api.ts lib/content/frame.ts lib/content/frame.test.ts tests/e2e/admin/content/media.spec.ts
git commit -m "feat(admin): media library with focal points, replace and crop"
```

---
## Phase exit

- [ ] `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm build` green; a CI-style build with `DATABASE_URL=postgres://x@127.0.0.1:1/x` still passes (no new build-time reads: the only new prerendered shell is `/__page`).
- [ ] `pnpm e2e:seed && pnpm test:e2e` green (parity 21/21 unchanged, content specs, shell specs).
- [ ] Append the Phase 4 entries and remaining carries (search rate limit; `window.confirm` → AlertDialog; media `version` column) to `.superpowers/sdd/plan/progress.md`.

## Spec coverage map

| Contract item (docs/plan.md Phase 4) | Where |
| --- | --- |
| 1. Pages API: list, get, draft PATCH with `version`, publish, discard, revisions, restore, `seo` PATCH, custom create/delete; tests for RBAC, 409, snapshots, invalidation | Task 1 |
| 2. Preview: enable/exit draft mode for validated internal paths; preview bar | Task 2 |
| 3. SchemaForm widgets: media, link (page + anchor), icon, stat, mini rich text, collection, colour, character counters (existing, kept), limit hints (list min/max, number min/max) | Task 6 (+ frame widget Task 9) |
| 4. Page builder: dnd-kit outline + add-block library; block form; live preview iframe desktop/tablet/phone refreshed on autosave; toolbar status, "Saved n s ago", Publish, Discard, History; basic SEO tab | Task 7 |
| 5. Collections: generic registry-driven API with `order`; sortable tables, drawer forms, visibility toggles, "used on" hints | Tasks 4, 8 |
| 6. Globals editors per §6.4 key with revisions/rollback and per-key permission | Tasks 3, 8 (site, contact, navigation, footer, newsletter, contactForm, microcopy, notifications, privacy; `seo` API now, screen Phase 7; tracking/consent/scripts/theme stay with Phases 8–9 as §8.3 assigns them dedicated endpoints) |
| 7. Media library: multipart 20 MB → sharp (orient, strip EXIF/GPS, ≤ 4000 px, blur, dominant colour) → content-hashed key → `local`/`s3` (R2 EU, `WHEN_REQUIRED`); grid, search, filters, details (alt, caption, focal), replace keeping id, usage scan + delete guard, step-frame cropper | Tasks 5, 9 |
| Acceptance: edit hero → preview → publish → public updates | Task 7 `editing.spec.ts` (preview isolation also Task 2 `preview.spec.ts`) |
| Acceptance: author 403 on publish | Task 1 RBAC block, Task 7 `rbac.spec.ts` |
| Acceptance: concurrent edits → 409 dialog | Task 1, Task 7 `use-autosave.test.tsx` + `conflict.spec.ts` |
| Acceptance: 15 MB GPS JPEG uploads, stored file has no GPS | Task 5 `media.test.ts`, Task 9 `media.spec.ts` |
| §9.4 autosave indicator, unsaved-changes guard, ⌘S, keyboard drag-and-drop | Task 7 (`useAutosave`, `SaveIndicator`, `KeyboardSensor`) |
| §15 URL fields https/mailto/tel/relative; SVG rejected | Tasks 3, 4 (`Href`/`LinkValue`), 5 (`sniff`) |
| Ledger carries | "Decisions taken for the ledger CARRY items" table |

## Self-check against the installed code (done while writing this plan)

Verified in `node_modules` and the repo at `1ad5a0b`:

- **Next 16.3.8.** `draftMode()` is async; `enable()`/`disable()` work in Route Handlers and set `__prerender_bypass` (`node_modules/next/dist/server/async-storage/draft-mode-provider.js`); cookies set during a Route Handler are merged into a returned `Response` (`app-route/module.js` → `appendMutableCookies`), so Hono's `c.redirect()` carries it. `isEnabled` is readable in `'use cache'` but this plan passes `draft` explicitly. `RouteContext<…>` and `PageProps<…>` are global after `next typegen` (already part of `pnpm typecheck`). `images.localPatterns[].search` is required for query strings in 16 (`version-16.md`). `revalidateTag` stays behind `invalidate()`; no `updateTag` (Hono is a Route Handler).
- **Hono 4.13.13.** `c.req.parseBody()` returns `Record<string, string | File>`; `bodyLimit` instances are plain middleware, so the per-path switch in `app.ts` composes; `createMiddleware`, `c.req.param()` inside route-level middleware, `c.redirect(path, 307)`.
- **Drizzle 0.45.4.** `select().for("update")` (`pg-core/query-builders/select.d.ts:586`), `db.transaction(cb)`, `db.$count(table)`, `notInArray(column, subquery)`, `onConflictDoNothing({ target })`, `onConflictDoUpdate`, `count()`. `NodePgDatabase` is not the transaction type, hence `Tx`/`DbLike`.
- **Zod 4.6.5.** `z.enum(readonlyTuple)`, `.strict()`, `.catch()`, `.prefault()`, `z.toJSONSchema(schema, { io, override, unrepresentable })`, `z.core.$ZodError`, issue `path: PropertyKey[]`.
- **sharp 0.35.** `autoOrient()`, `withExif({ IFD3 })`, `metadata().exif?: Buffer`, metadata stripped unless `keepMetadata`/`withMetadata`; `failOn`.
- **Better Auth 1.7.7.** Unchanged; sessions come from the existing `session` middleware (`getFreshSession`, cookie cache bypassed). View-as sessions may edit content (audited with `impersonatedBy`); only account self-service blocks them.
- **Repo.** `ApiError(code, message, fieldErrors?)` (extended, compatible), `errorBody` (extended, compatible), `invalidate`/`tags` (`bands`, `steps` tag names), `findPageByPath(path, { draft })`, `parseGlobal`, `GLOBALS`, `PUBLIC_GLOBAL_KEYS`, `BLOCKS`/`BLOCK_BY_TYPE`/`BlockInstance`, `pageDocumentFor`, `collectMediaIds`, `MediaRef`/`LinkValue`/`Href`/`IconField`/`StatValue`/`Selection`/`Focal`/`Tint`, `probeImage`, `slugify`, `CONTENT_ICONS`, `permissionFor` (throws for unregistered paths), `linkForPath`, `visibleNav`, `requireActor`/`requirePermission`/`getSession`, `usePermission`, `StatusPill`/`PageHeader`/`CardSkeleton`, `DialogContent.showCloseButton`, nav slugs (`cta-bands`, settings `identity/contact/navigation/footer/forms/notifications/privacy`), integration helpers (`createUser`, `signIn`, `signInWithTwoFactor`, `adminRequest`, `ORIGIN`, `resetDb`), E2E helpers (`STORAGE`, `E2E_USERS`, `E2E_ORIGIN`, `auth.setup.ts` `PLAIN`). No migration needed (columns verified in `server/db/schema/{pages,media,settings,content}.ts`).
- **Not compiled here (flagged in the owning step with what to check):** the `Tx` alias (Task 1 Step 8), `entry()` generic inference in the collections registry (Task 4), Zod's JSON-Schema shape for discriminated unions (Task 6 Step 3), TipTap `StarterKitOptions` keys (Task 6), react-easy-crop prop names (Task 9), `PageHero` heading role in the E2E (Task 7 Step 7).

## Execution handoff

Plan complete and saved to `docs/plans/phase-04-content-editing.md`. Recommended: **subagent-driven**, because Tasks 1–5 are independent server slices with sharp RBAC/locking edges a fresh reviewer should gate one by one, while Tasks 6–9 depend on their interfaces in order (6 → 7 → 8 → 9).

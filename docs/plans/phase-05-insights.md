# Phase 5: Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editors and authors write, schedule and publish articles from the admin: a TipTap 3 editor with images from the library, categories and authors, draft → publish/schedule → unpublish/archive with revisions, author ownership with "Submit for review", a minute-by-minute scheduler, Postgres full-text search, and automatic 301s when a published article's slug changes. The public article page renders the stored TipTap JSON through `@tiptap/static-renderer` with no visual change.

**Architecture:** A new Hono sub-app `/api/v1/admin/articles` (plus `/categories` and `/authors`) validates with Zod, authorises with `can()` and calls services that own audit, optimistic locking (`version`) and `invalidate()`. Articles keep the editor's working copy in `draft` (JSONB) and the published copy in typed columns (§6.5); publish validates the draft (`ArticleContent`) and copies it across in one transaction, writing a revision and, when a once-published slug changes, a row in the new `redirects` table. `instrumentation.ts` ticks every 60 s → `POST /api/v1/cron/tick` (bearer `CRON_SECRET`) → advisory lock → publish due articles → invalidate. Old article URLs answer a real 301 from `proxy.ts`, which asks a cached internal resolver (`GET /api/v1/redirects?path=`) and never touches the database itself.

**Tech Stack:** Next.js 16.3.8 (Cache Components, `instrumentation.ts`, Node-runtime `proxy.ts`) · Hono 4.13.13 + `@hono/zod-validator` 0.9.1 · Drizzle 0.45.4 · Zod 4.6.5 · TanStack Query 5.104.1 · TipTap 3.31.3 · `@date-fns/tz` 1.5.0 · new: `@tiptap/static-renderer`, `@tiptap/extension-image`, `@tiptap/extensions`, `@tiptap/extension-bubble-menu` (exact pins below).

**Spec:** [`docs/brief.md`](../brief.md) (§5.5(f), §5.6, §6.3, §6.5, §6.6, §7.2, §8.1, §8.3, §9.3, §9.4, §11 "Redirects", §15) and the Phase 5 contract in [`docs/plan.md`](../plan.md) ("### Phase 5: Insights"). Read both first.

## Global Constraints

Copied verbatim from `docs/plan.md` (lines 19–62); every task implicitly includes them.

- Next.js `16.3.x` App Router with `cacheComponents: true`, on the Node runtime only. Do not upgrade to 16.4 inside this plan.
- `proxy.ts` sits at the repo root (no `src/`). It does optimistic cookie checks only and **never touches the database**.
- Hono `4.13.x` with `@hono/vercel` `1.0.x` and `@hono/zod-validator` `0.9.x`. **No Hono v5**, and never import `hono/vercel`.
- Better Auth `1.7.x`. The CLI is the `auth` package (`pnpm dlx auth@1.7.7 …`), not `@better-auth/cli`.
- Drizzle ORM `0.45.x`, drizzle-kit `0.31.x`, `pg` `8.x`. Use the 0.45 APIs (`relations()`, `migrate(db, { migrationsFolder })`). Drizzle's website documents the v1 RC by default, so `defineRelations` and `drizzle-orm/zod` **do not exist** for us.
- Better Auth settings: `usePlural: true`, `advanced.database.generateId: "uuid"`, `advanced.cookiePrefix: "mk"`.
- Every `server/**` module begins with `import "server-only"`, and client components never import it. Node scripts that load server modules run with `NODE_OPTIONS=--conditions=react-server`.
- Public pages never `fetch` our own `/api/*`. Hono serves only the admin, the forms and cron.
- Hono route handlers do three things: validate (Zod), authorise (`can()`), call a service. Services own the audit log and cache invalidation.
- Client code never queries `document` for page content. It uses `findTarget()` and `activePageRoot()` from `lib/page-root.ts`, because Cache Components keeps hidden routes in the DOM through `<Activity>`.
- Every public site section aligns to `components/layout/container.tsx` (max width 1440px, 66px gutter).
- Prettier: no semicolons, double quotes, `trailingComma: "es5"`, width 80.
- Any task that touches the public site must pass `pnpm test:parity` at ≤ 0.1% pixel difference per page.

**Amendment proposed by this plan (Ruling R1, needs the user's OK before Task 6):** `proxy.ts` may additionally answer `/insights/:slug` with a 301 by asking the internal redirect resolver over HTTP. It still never imports server modules and never touches the database.

Phase-5 values from the spec (verbatim):

- "`instrumentation.ts` starts a 60-second interval that calls `POST /api/v1/cron/tick` on localhost with `CRON_SECRET`. It goes through HTTP so that `revalidateTag` runs inside a request context." · "The tick takes a Postgres advisory lock, publishes due articles, purges expired data and invalidates tags." (§5.5(f))
- "`/v1/cron/*` → bearer `CRON_SECRET`." (§8.1)
- "**Articles** keep their working copy in `draft` (JSONB, same Zod schema). Publish copies the validated values into typed, indexed columns, which is what the site reads and searches. Scheduling sets `status = scheduled` and `scheduled_for`, and the scheduler tick publishes the article." · "**Unpublish** or **archive** turns the article URL into a 404. In the same dialog the admin offers to create a 301 to `/insights` or to a chosen article." (§6.5)
- "Authors can only touch articles they created or that list them as author." · author: "article.create · update: own", "article.publish: — (submits)", "article.delete: own drafts" (§7.2)
- "`redirects` | source_path (unique), destination, status_code (301/302/307/308), is_active, hit_count, last_hit_at, note" (§6.6)
- "Articles | Filterable table and a TipTap editor: headings, lists, quote, links, images from the library, bubble menu, live reading time. Side panel: status, schedule, category, author, cover with focal point, excerpt counter, featured flag, slug with an auto-redirect notice. SEO panel. Authors can "Submit for review"" (§9.3)
- "Dates are ISO 8601 UTC and are displayed in Europe/Dublin." (§8.2)
- "`updateTag` works **only in Server Actions**. Route Handlers (and therefore Hono) use `revalidateTag(tag, profile)`." (§5.6) → always `invalidate()` from `server/lib/cache.ts`.

**New dependencies (exact pins; all published 2026‑09‑04, ≥ 2 weeks before 2026‑10‑10; peer `@tiptap/core`/`@tiptap/pm` `3.31.3` match the installed TipTap; installed by the task that needs them):**

| Package | Version | Task |
| --- | --- | --- |
| `@tiptap/static-renderer` | `3.31.3` | 2 |
| `@tiptap/extension-image` | `3.31.3` | 2 |
| `@tiptap/extensions` (Placeholder) | `3.31.3` | 7 |
| `@tiptap/extension-bubble-menu` (for `@tiptap/react/menus`) | `3.31.3` | 7 |

Link already ships in `@tiptap/starter-kit` 3.31.3 (`@tiptap/extension-link` is a dependency); do not add it separately.

## Review Focus

1. **Slug renames create loops or dead chains.** Renaming a published article A→B→C must leave `/insights/A` and `/insights/B` both 301ing straight to `/insights/C`; renaming back C→A must remove the A row (A is live again) and never produce A→A; a different article published at a previously redirected path must reclaim it. → Task 4 `articles-publish.test.ts` "slug renames…".
2. **Authors escalate.** An author must get 403 when editing another writer's article, crediting another author, publishing, scheduling, unpublishing, or deleting an article that was ever published; they may edit their own and submit it for review. → Task 3 `articles.test.ts` "ownership", Task 4 RBAC block, Task 8 `insights.spec.ts`.
3. **The public site goes stale after a lifecycle change.** Publish, scheduled publish, unpublish, archive and delete expire `articles` and `article:<id>`; a slug change or unpublish-with-redirect also expires `redirects`; category and author edits expire `categories` / `authors`. → Tasks 1, 3, 4, 5 tests asserting `expired()`.
4. **Overlapping or failing ticks.** Two ticks at once publish an article exactly once; a scheduled article whose draft no longer validates goes back to draft with an audit entry instead of blocking the others or retrying every minute. → Task 5 `cron.test.ts`.
5. **Schedule times drift by an hour.** An editor in Dublin picking 10:00 on a summer date schedules 09:00 UTC; on a winter date 10:00 UTC; the dialog shows stored times back in Dublin time. → Task 8 `schedule-time.test.ts`.

## Rulings (decisions this plan takes; one line each in the hand-off)

| Topic | Ruling | Task |
| --- | --- | --- |
| R1 Slug change → 301 | Create the full §6.6 `redirects` table now (+ `article_id` FK, `on delete set null`). The articles service writes `301` rows when a **once-published** article's slug changes (chains flattened, the new path reclaimed) and when unpublish/archive asks for one. Resolution: `proxy.ts` matches `/insights/:slug` and asks `GET /api/v1/redirects?path=` (Hono, public, `'use cache'` map tagged `redirects`) over loopback; fail-open on error/timeout. **Why not route-level:** under Cache Components the article route streams its shell first, so `permanentRedirect()` there becomes a 200 + meta refresh (`tests/e2e/navigation/cms.spec.ts` already proves `notFound()` stays 200), which fails the "301" acceptance. Phase 7 adds the redirects manager, hit counts (`after()`), `[...slug]` resolution and other status codes on top of this table and resolver. | 1, 4, 6 |
| R2 Author avatar (P3 ledger) | `authors.avatar_id` becomes nullable; a missing or deleted avatar renders the byline without a photo instead of hiding the article. | 2 |
| R3 Categories/authors permissions | Read with `article.read`; create/update/delete with `article.publish` (owner, admin, editor). Delete is 409 while any article uses the row. | 1 |
| R4 Author ↔ user link | An author-role user's first article creates (or reuses) their `authors` row (`user_id` = them, name = their name). Editors pick any author. A UI for linking users to authors is left to Phase 10. | 3 |
| R5 Schedule rules | Only `draft` or `archived` articles can be scheduled (a live article's edits publish immediately). The tick publishes whatever the draft is at that moment; if it no longer validates, the article returns to `draft` and `article.schedule_failed` is audited. | 4, 5 |
| R6 Republish date | Republishing keeps the original `published_at` (the date readers see); `updated_at` moves. | 4 |
| R7 Search | Admin list and ⌘K use `search @@ websearch_to_tsquery('english', q)` on the published copy **or** `draft->>'title' ILIKE` (so never-published drafts are findable); ranked by `ts_rank`. ⌘K is now DB-backed, so the P2 carry closes with an in-memory per-user limiter (30 requests / 10 s → 429), fine for the single replica (§5.6 rule 8). | 3 |
| R8 Body images | Article bodies use a new `ArticleBodyDoc` (= the existing rich-text nodes + `image`); page `richtext` blocks keep `RichTextDoc` unchanged. Images are stored as `attrs: { mediaId, src, alt }`, so `collectMediaIds`, `assertMediaExists` and the media usage scan (`articles.body/draft::text like`) cover them with no change. | 1, 2 |
| R9 Article preview | Not in the Phase 5 contract; deferred (carry). The editor has no Preview button. | — |
| R10 Scheduler in tests/E2E | `SCHEDULER=off` disables the interval (E2E sets it); integration tests call the tick route with a controlled clock; E2E triggers the tick route directly. | 5, 8 |
| R11 Seeded articles have `draft = null` | The service treats a null draft as "draft equals the published columns" (`draftOf(row)`); no backfill migration. | 3 |

No new Server Actions: all writes go through Hono (the P1 `requireActor` carry stays satisfied).

## File structure

| Path | Responsibility | Task |
| --- | --- | --- |
| `server/db/schema/content.ts` (modify), `server/db/schema/redirects.ts`, `server/db/schema/index.ts` (modify) | nullable cover, schedule/review columns, featured/scheduled indexes, `redirects` table | 1 |
| `server/db/migrations/0005_insights.sql`, `0006_author_avatar_optional.sql` (generated) | migrations | 1, 2 |
| `blocks/rich-text.ts` (modify) | `ImageNode`, `ArticleBodyDoc` | 1 |
| `lib/content/article.ts` | `ArticleContent`, `ArticleDraft`, `NewArticleInput`, `ArticleSeoPatch`, `ScheduleInput`, `UnpublishInput`, `ARTICLE_STATUSES`, `EMPTY_BODY` | 1 |
| `lib/content/reading-time.ts`, `server/db/seed/tiptap.ts` (modify) | `plainText`, `readingMinutes` (isomorphic; seed re-exports) | 1 |
| `lib/content/taxonomy.ts`, `server/modules/taxonomy/{service,routes}.ts` | categories/authors API | 1 |
| `server/env.ts`, `.env.example`, `tests/test-env.mjs`, `tests/e2e/fixtures/env.ts` (modify) | `CRON_SECRET`, `SCHEDULER` | 1 |
| `server/lib/revisions.ts` (modify) | `article: 50` | 1 |
| `lib/rich-text/extensions.ts` | shared TipTap extension list (editor + static renderer) | 2 |
| `features/insights/components/{rich-text,article-body,article-card,article-hero,post-card}.tsx`, `lib/content/types.ts`, `server/modules/content/repo.ts` (modify) | static renderer, body images, optional avatar | 2 |
| `server/modules/articles/{schema,access,service,routes}.ts` | Articles API core | 3 |
| `server/lib/rate-limit.ts`, `server/modules/search/{service,routes}.ts` (modify) | ⌘K article hits + limiter | 3 |
| `server/modules/articles/publish.ts`, `server/modules/redirects/service.ts` | lifecycle, revisions, automatic redirects | 4 |
| `server/api/middleware/cron.ts`, `server/modules/scheduler/{service,routes}.ts`, `server/api/app.ts` (modify) | cron tick | 5 |
| `instrumentation.ts`, `instrumentation.node.ts`, `lib/internal-origin.ts` | 60 s interval | 5 |
| `server/modules/redirects/{queries,routes}.ts`, `proxy.ts` (modify) | resolver + 301 | 6 |
| `admin/components/schema-form/widgets/{rich-text-toolbar,media-picker-dialog}.tsx` (extracted), `admin/modules/insights/article-body-editor.tsx` | TipTap article editor | 7 |
| `admin/modules/insights/*`, `admin/modules/pages/{history-sheet,page-builder}.tsx` (modify), `app/(admin)/admin/(panel)/insights/**` | list, editor screen, dialogs, SEO, categories/authors screens | 8 |
| `tests/integration/helpers/articles.ts`, `tests/e2e/support/{api,db}.ts` (modify) | shared test helpers | 1, 6, 8 |

## Conventions for executing this plan

- Code blocks are written compactly to keep the plan short. Run `pnpm prettier --write <touched files>` before every commit; the Prettier rules above are the source of truth.
- Where a step gives a component as a spec (props, API call, labels) rather than code, the quoted labels are load-bearing: E2E specs select by them.
- Next-specific APIs used here were checked in `node_modules/next/dist/docs/` (see "Self-check" at the end). Re-read the cited doc before changing how any of them is used.

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

- Requests go through `adminRequest(path, cookie, { method, body })` and cookies from `cookieFor(role)` (`tests/integration/helpers/auth.ts`). Note `cookieFor` creates the user: call it once per role per test.
- `beforeEach(resetDb)` + `next.revalidateTag.mockReset()`, `afterAll(closeDb)`.

---

### Task 1: Insights schema, article domain and the categories/authors API

**Files:**
- Create: `server/db/schema/redirects.ts`, `lib/content/article.ts`, `lib/content/reading-time.ts`, `lib/content/taxonomy.ts`, `server/modules/taxonomy/service.ts`, `server/modules/taxonomy/routes.ts`, `tests/integration/helpers/articles.ts`
- Modify: `server/db/schema/content.ts`, `server/db/schema/index.ts`, `blocks/rich-text.ts`, `server/db/seed/tiptap.ts`, `server/lib/revisions.ts`, `server/env.ts`, `server/env.test.ts`, `.env.example`, `tests/test-env.mjs`, `tests/e2e/fixtures/env.ts`, `server/api/routes/admin.ts`, `admin/lib/api.ts`, `server/modules/content/repo.ts` (nullable cover only)
- Generated: `server/db/migrations/0005_insights.sql` (+ snapshot, journal)
- Test: `lib/content/article.test.ts`, `lib/content/reading-time.test.ts`, `tests/integration/db/content-schema.test.ts` (append), `tests/integration/api/taxonomy.test.ts`

**Interfaces:**
- Consumes: `Slug`/`ArticleSlug`, `MediaRef`/`text`/`optionalText` (`blocks/fields.ts`), `audit`, `invalidate`/`tags`, `conflictError`/`isUniqueViolation`/`topLevelDiff`, `assertMediaExists`, `collectMediaIds`, `insertMedia`.
- Produces:
  - Schema: `redirects` table (`sourcePath`, `destination`, `statusCode`, `isActive`, `hitCount`, `lastHitAt`, `note`, `articleId`, `createdBy`, stamps); `articles.coverId` nullable; `articles.scheduledBy`, `reviewRequestedAt`, `reviewRequestedBy`; unique partial index on `featured = true`.
  - `blocks/rich-text.ts`: `ArticleBodyDoc`, `type ArticleBodyDoc`, `type ArticleBodyNode`.
  - `lib/content/article.ts`: `ARTICLE_STATUSES`, `type ArticleStatus`, `EMPTY_BODY`, `ArticleContent` / `type ArticleContent`, `ArticleDraft` / `type ArticleDraft`, `NewArticleInput`, `ArticleSeoPatch`, `ScheduleInput`, `UnpublishInput`, `ARTICLE_PATH_RE`.
  - `lib/content/reading-time.ts`: `plainText(doc: unknown): string`, `readingMinutes(text: string): number`.
  - `lib/content/taxonomy.ts`: `TAXONOMIES`, `type Taxonomy`, `CategoryInput`, `AuthorInput`.
  - `CategoriesRoutes`/`AuthorsRoutes` at `/api/v1/admin/{categories,authors}`: `GET /` → `{ items: (row & { articleCount: number })[] }` (authors expose `avatar: { mediaId } | null`, not `avatarId`); `POST /` (fields) → row, 201; `PATCH /:id` `{ version, values }` → row; `DELETE /:id` → `{ ok: true }`. Clients `categoriesApi`, `authorsApi`.
  - `REVISION_LIMITS.article = 50`; `getEnv().CRON_SECRET?: string`.
  - Test helpers: `bodyDoc(text?)`, `insertTaxonomy(suffix?)` → `{ media, category, author }`, `insertArticle(values)`, `content(refs, overrides?)`.

- [ ] **Step 1: Write the failing tests**

`lib/content/reading-time.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { ARTICLE_BODIES } from "@/server/db/seed/fixtures/article-bodies"
import { toTipTap } from "@/server/db/seed/tiptap"

import { plainText, readingMinutes } from "./reading-time"

// The Phase 3 helper, frozen here: the new walker must count the same words.
const inline = (c?: { text: string }[]) => (c ?? []).map((t) => t.text).join("")
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacy = (doc: any): string => doc.content.flatMap((n: any) => n.type === "bulletList"
  ? n.content.map((i: any) => inline(i.content[0].content))
  : n.type === "blockquote" ? n.content.map((p: any) => inline(p.content)) : [inline(n.content)]).join(" ")

describe("plainText", () => {
  it.each(Object.keys(ARTICLE_BODIES))("matches the seed's count for %s", (slug) => {
    const doc = toTipTap(ARTICLE_BODIES[slug]!)
    expect(plainText(doc)).toBe(legacy(doc))
    expect(readingMinutes(plainText(doc))).toBe(readingMinutes(legacy(doc))) })
  it("tolerates half-typed drafts and images", () => {
    expect(plainText({ type: "doc", content: [{ type: "image", attrs: { mediaId: "x" } },
      { type: "paragraph" }, { type: "heading", content: [{ type: "text", text: "Hi" }] }] })).toBe(" Hi")
    expect(plainText(null)).toBe("")
    expect(readingMinutes("")).toBe(1) }) })
```

`lib/content/article.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { ArticleBodyDoc, RichTextDoc } from "@/blocks/rich-text"

import { ArticleContent, ArticleDraft, EMPTY_BODY, UnpublishInput } from "./article"

const id = "00000000-0000-4000-8000-000000000001"
const valid = { title: "Calm", slug: "calm", excerpt: "Short.", cover: { mediaId: id }, categoryId: id,
  authorId: id, featured: false, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }] } }
const image = { type: "image", attrs: { mediaId: id, src: "/x.png", alt: "", title: null, width: null } }

describe("article schemas", () => {
  it("accepts a complete article and strips editor-only image attrs", () => {
    const body = { type: "doc", content: [image] }
    const parsed = ArticleContent.parse({ ...valid, body })
    expect(parsed.body.content[0]).toEqual({ type: "image", attrs: { mediaId: id, src: "/x.png", alt: "" } }) })
  it("keeps images out of page rich text", () => {
    expect(RichTextDoc.safeParse({ type: "doc", content: [image] }).success).toBe(false)
    expect(ArticleBodyDoc.safeParse({ type: "doc", content: [image] }).success).toBe(true) })
  it.each([["slug", "Not A Slug"], ["slug", "__shell"], ["excerpt", ""], ["cover", null], ["title", " "]])(
    "rejects %s = %j on publish", (key, value) => {
      expect(ArticleContent.safeParse({ ...valid, [key]: value }).success).toBe(false) })
  it("lets a draft be half-finished", () => {
    expect(ArticleDraft.safeParse({ title: "", slug: "", excerpt: "", cover: null, categoryId: null,
      authorId: null, featured: false, body: EMPTY_BODY }).success).toBe(true) })
  it("only redirects to /insights or another article", () => {
    expect(UnpublishInput.safeParse({ version: 1, redirectTo: "/insights" }).success).toBe(true)
    expect(UnpublishInput.safeParse({ version: 1, redirectTo: "/insights/other-one" }).success).toBe(true)
    for (const bad of ["https://evil.example", "//evil.example", "/about", "/insights/../x"])
      expect(UnpublishInput.safeParse({ version: 1, redirectTo: bad }).success).toBe(false) }) })
```

Append to `server/env.test.ts` (follow the file's existing pattern for setting `process.env` and calling `resetEnvForTests()`):

```ts
it("requires CRON_SECRET outside development", () => {
  Object.assign(process.env, { SITE_ENV: "staging", BETTER_AUTH_URL: "https://x.example", CRON_SECRET: "" })
  delete process.env.CRON_SECRET
  resetEnvForTests()
  expect(() => getEnv()).toThrow(/CRON_SECRET/) })
```

Append to `tests/integration/db/content-schema.test.ts` (reuse its imports; add `insertTaxonomy`, `insertArticle` from `../helpers/articles` and `redirects` from the schema):

```ts
describe("insights schema", () => {
  it("allows one featured article", async () => {
    const { category, author, media } = await insertTaxonomy()
    const refs = { categoryId: category.id, authorId: author.id, coverId: media.id }
    await insertArticle({ ...refs, slug: "one", featured: true })
    await expect(insertArticle({ ...refs, slug: "two", featured: true })).rejects.toThrow() })
  it("allows a draft without a cover", async () => {
    const { category, author } = await insertTaxonomy()
    await expect(getDb().insert(articles).values({ slug: "nocover", title: "T", excerpt: "", categoryId: category.id,
      authorId: author.id, body: { type: "doc", content: [] } })).resolves.toBeDefined() })
  it("refuses odd redirect codes and self-redirects", async () => {
    await expect(getDb().insert(redirects).values({ sourcePath: "/a", destination: "/b", statusCode: 200 })).rejects.toThrow()
    await expect(getDb().insert(redirects).values({ sourcePath: "/a", destination: "/a" })).rejects.toThrow() }) })
```

`tests/integration/api/taxonomy.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag }))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { media as mediaTable } from "@/server/db/schema"

import { insertArticle, insertTaxonomy } from "../helpers/articles"
import { adminRequest, cookieFor } from "../helpers/auth"
import { insertMedia } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeEach(async () => { await resetDb(); next.revalidateTag.mockReset() })
afterAll(closeDb)
const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const category = (slug = "anxiety") => ({ slug, name: "Anxiety", description: "", relatedServiceId: null, isVisible: true })

// Ruling R3: read = article.read, write = article.publish. [GET, POST]
const MATRIX: Record<RoleName, [number, number]> = { owner: [200, 201], admin: [200, 201], editor: [200, 201],
  author: [200, 403], marketer: [200, 403], intake: [403, 403], viewer: [200, 403] }

describe.each(ROLE_NAMES)("taxonomy RBAC for %s", (role) => {
  it(`GET, POST categories → ${MATRIX[role].join(", ")}`, async () => {
    const cookie = await cookieFor(role)
    expect((await adminRequest("/categories", cookie)).status).toBe(MATRIX[role][0])
    expect((await adminRequest("/categories", cookie, { method: "POST", body: category() })).status).toBe(MATRIX[role][1]) }) })

describe("taxonomy API", () => {
  it("creates, updates with a version, 409s stale and duplicate slugs, invalidates", async () => {
    const cookie = await cookieFor("editor")
    const created = await (await adminRequest("/categories", cookie, { method: "POST", body: category() })).json()
    expect(created.version).toBe(1)
    expect(expired()).toEqual(["categories"])
    const dup = await adminRequest("/categories", cookie, { method: "POST", body: category() })
    expect(dup.status).toBe(409)
    expect((await dup.json()).error.fieldErrors).toHaveProperty("slug")
    const patch = (version: number) => adminRequest(`/categories/${created.id}`, cookie, { method: "PATCH",
      body: { version, values: { ...category(), name: "Stress" } } })
    expect((await (await patch(1)).json()).name).toBe("Stress")
    expect((await patch(1)).status).toBe(409) })

  it("refuses to delete a category or author in use, and lists usage", async () => {
    const cookie = await cookieFor("editor")
    const { category: cat, author, media } = await insertTaxonomy()
    await insertArticle({ slug: "used", categoryId: cat.id, authorId: author.id, coverId: media.id })
    const list = await (await adminRequest("/categories", cookie)).json()
    expect(list.items[0].articleCount).toBe(1)
    expect((await adminRequest(`/categories/${cat.id}`, cookie, { method: "DELETE" })).status).toBe(409)
    expect((await adminRequest(`/authors/${author.id}`, cookie, { method: "DELETE" })).status).toBe(409) })

  it("speaks { mediaId } for author avatars and rejects deleted images", async () => {
    const cookie = await cookieFor("editor")
    const asset = await insertMedia()
    const author = { slug: "magda", name: "Magda", roleTitle: "", bio: "", avatar: { mediaId: asset.id }, isVisible: true }
    const created = await (await adminRequest("/authors", cookie, { method: "POST", body: author })).json()
    expect(created.avatar).toEqual({ mediaId: asset.id })
    expect(created).not.toHaveProperty("avatarId")
    expect(expired()).toEqual(["authors"])
    await getDb().update(mediaTable).set({ deletedAt: new Date() })
    const bad = await adminRequest("/authors", cookie, { method: "POST", body: { ...author, slug: "other" } })
    expect(bad.status).toBe(400) }) })
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run --project unit lib/content server/env.test.ts && pnpm test:integration tests/integration/db/content-schema.test.ts tests/integration/api/taxonomy.test.ts`
Expected: FAIL (`./article`, `./reading-time`, `../helpers/articles` not found; `/categories` 404).

- [ ] **Step 3: Schema and migration**

`server/db/schema/content.ts` — in `articles`: replace `coverId: image(),` with the nullable column below, add the three columns after `scheduledFor`, add the two indexes, and add `uniqueIndex` to the pg-core import:

```ts
    // Nullable: a new draft has no cover yet. Publish requires one (ArticleContent).
    coverId: uuid().references(() => media.id, { onDelete: "restrict" }),
    // …existing columns…
    scheduledBy: uuid().references(() => users.id, { onDelete: "set null" }),
    // "Submit for review" (docs/brief.md §9.3); publishing clears it.
    reviewRequestedAt: timestamp({ withTimezone: true }),
    reviewRequestedBy: uuid().references(() => users.id, { onDelete: "set null" }),
```

```ts
    // docs/plan.md Phase 5: the featured flag allows a single article.
    uniqueIndex("articles_one_featured_idx").on(table.featured).where(sql`featured = true`),
    index("articles_scheduled_idx").on(table.scheduledFor).where(sql`status = 'scheduled'`),
```

`server/db/schema/redirects.ts`:

```ts
import { sql } from "drizzle-orm"
import { boolean, check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { users } from "./auth"
import { articles } from "./content"

// docs/brief.md §6.6. Phase 5 writes the automatic rows (article slug changes,
// unpublish with a redirect); Phase 7 adds the manager, hit counts and
// site-wide resolution on the same table.
export const redirects = pgTable("redirects", {
  id: uuid().primaryKey().defaultRandom(),
  sourcePath: text().notNull().unique(),
  destination: text().notNull(),
  statusCode: integer().notNull().default(301),
  isActive: boolean().notNull().default(true),
  hitCount: integer().notNull().default(0),
  lastHitAt: timestamp({ withTimezone: true }),
  note: text().notNull().default(""),
  // Set on rows the articles service made; Phase 7 shows them as automatic.
  articleId: uuid().references(() => articles.id, { onDelete: "set null" }),
  createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  check("redirects_status_code_check", sql`${table.statusCode} in (301, 302, 307, 308)`),
  check("redirects_not_self_check", sql`${table.sourcePath} <> ${table.destination}`),
])
```

Add `export * from "./redirects"` to `server/db/schema/index.ts`. Then:

Run: `pnpm db:generate --name insights`
Expected: `server/db/migrations/0005_insights.sql` containing `CREATE TABLE "redirects"`, `ALTER TABLE "articles" ALTER COLUMN "cover_id" DROP NOT NULL`, the three `ADD COLUMN`s, `CREATE UNIQUE INDEX "articles_one_featured_idx" … WHERE featured = true` and both `CHECK`s. Read the SQL; do not hand-edit it.

`server/modules/content/repo.ts` — `coverId` is now nullable; in `toSummary` replace `const image = need(assets, r.a.coverId)` with `const image = r.a.coverId ? need(assets, r.a.coverId) : null`, and in `mediaOf` filter nulls: `rows.flatMap((r) => [r.a.coverId, r.author.avatarId]).filter((id): id is string => id !== null)`.

- [ ] **Step 4: Article domain**

`blocks/rich-text.ts` — export the node schemas (`export const Paragraph …` etc.; `RichTextDoc` unchanged) and append:

```ts
// Article bodies only (Phase 5): an image from the media library, stored as
// { mediaId } inside attrs so the media usage scan and delete guard see it.
// src/alt are the editor's display copy; the site renders the library asset.
// Other TipTap image attrs (title, width, height) are stripped.
export const ImageNode = z.object({
  type: z.literal("image"),
  attrs: z.object({ mediaId: z.uuid(), src: z.string().max(2048).nullish(), alt: z.string().max(300).nullish() }),
})
export const ArticleBodyDoc = z.object({
  type: z.literal("doc"),
  content: z.array(z.discriminatedUnion("type", [Paragraph, Heading, BulletList, Blockquote, ImageNode])).max(400),
})
export type ArticleBodyDoc = z.infer<typeof ArticleBodyDoc>
export type ArticleBodyNode = ArticleBodyDoc["content"][number]
```

`lib/content/reading-time.ts`:

```ts
// One string per text block (paragraph, heading), joined by spaces: the same
// words the Phase 3 helper counted, so reading times do not move. Tolerant of
// half-typed drafts: the editor shows it live (docs/brief.md §9.3).
type Json = { type?: string; text?: string; content?: unknown[] }
const TEXT_BLOCKS = new Set(["paragraph", "heading"])

export function plainText(doc: unknown): string {
  const blocks: string[] = []
  const inline = (node: Json): string =>
    node.type === "text" ? (node.text ?? "") : (node.content ?? []).map((c) => inline(c as Json)).join("")
  const walk = (node: Json) => {
    if (node.type && TEXT_BLOCKS.has(node.type)) blocks.push(inline(node))
    else for (const child of node.content ?? []) walk(child as Json)
  }
  if (doc && typeof doc === "object") walk(doc as Json)
  return blocks.join(" ")
}

export const readingMinutes = (value: string) => Math.max(1, Math.round(value.split(/\s+/).length / 220))
```

`server/db/seed/tiptap.ts` — delete its `plainText` and `readingMinutes` and add `export { plainText, readingMinutes } from "@/lib/content/reading-time"`.

`lib/content/article.ts`:

```ts
import * as z from "zod"

import { MediaRef } from "@/blocks/fields"
import { ArticleBodyDoc } from "@/blocks/rich-text"

import { ArticleSlug } from "./article-slug"

export const ARTICLE_STATUSES = ["draft", "scheduled", "published", "archived"] as const
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]
export const EMPTY_BODY = { type: "doc" as const, content: [{ type: "paragraph" as const }] }
export const ARTICLE_PATH_RE = /^\/insights\/[a-z0-9]+(?:-[a-z0-9]+)*$/

// What publish copies into the typed columns (docs/brief.md §6.5).
export const ArticleContent = z.object({
  title: z.string().trim().min(1).max(120),
  slug: ArticleSlug,
  excerpt: z.string().trim().min(1).max(240),
  cover: MediaRef,
  categoryId: z.uuid(),
  authorId: z.uuid(),
  featured: z.boolean(),
  body: ArticleBodyDoc,
})
export type ArticleContent = z.infer<typeof ArticleContent>

// Autosave: any half-finished state of the same shape, bounded in size.
export const ArticleDraft = z.object({
  title: z.string().max(200),
  slug: z.string().max(80),
  excerpt: z.string().max(400),
  cover: MediaRef.nullable(),
  categoryId: z.uuid().nullable(),
  authorId: z.uuid().nullable(),
  featured: z.boolean(),
  body: z.object({ type: z.literal("doc"), content: z.array(z.unknown()).max(400) }),
})
export type ArticleDraft = z.infer<typeof ArticleDraft>

export const NewArticleInput = z.object({
  title: z.string().trim().min(1).max(120),
  categoryId: z.uuid(),
  authorId: z.uuid().optional(),
})

// Live on save, merged per field (docs/brief.md §6.5), like pages.
export const ArticleSeoPatch = z.object({
  title: z.string().trim().max(70).nullable().optional(),
  description: z.string().trim().max(200).nullable().optional(),
  ogImage: MediaRef.nullable().optional(),
  noindex: z.boolean().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, "Nothing to change")

const Version = z.number().int().min(1)
export const ScheduleInput = z.object({ version: Version, at: z.iso.datetime({ offset: true }) })
export const UnpublishInput = z.object({
  version: Version,
  archive: z.boolean().default(false),
  // docs/brief.md §6.5: a 301 to /insights or to a chosen article.
  redirectTo: z.union([z.literal("/insights"), z.string().regex(ARTICLE_PATH_RE)]).nullable().default(null),
})
```

`server/lib/revisions.ts`: `export const REVISION_LIMITS = { page: 50, setting: 20, article: 50 } as const`.

`server/env.ts` — add to the object `CRON_SECRET: z.string().min(32).optional(),` and to `superRefine`:

```ts
    // docs/brief.md §8.1: /v1/cron/* takes a bearer secret.
    if (env.SITE_ENV !== "development" && !env.CRON_SECRET) {
      ctx.addIssue({ code: "custom", path: ["CRON_SECRET"],
        message: `CRON_SECRET is required when SITE_ENV is "${env.SITE_ENV}"` })
    }
```

`tests/test-env.mjs` → add `CRON_SECRET: "test-cron-secret-0123456789-abcdefghij"` to `TEST_ENV`. `tests/e2e/fixtures/env.ts` → add `CRON_SECRET: "e2e-cron-secret-0123456789-abcdefghij"` and `SCHEDULER: "off"` to `E2E_ENV` (Ruling R10). `.env.example` → add `CRON_SECRET=` under a comment `# Scheduler tick bearer (≥ 32 chars). openssl rand -hex 32` and add `CRON_SECRET` to the "Required in production" comment line.

- [ ] **Step 5: Categories and authors API**

`lib/content/taxonomy.ts`:

```ts
import * as z from "zod"

import { MediaRef, optionalText, text } from "@/blocks/fields"

import { Slug } from "./slug"

export const TAXONOMIES = ["categories", "authors"] as const
export type Taxonomy = (typeof TAXONOMIES)[number]

export const CategoryInput = z.object({ slug: Slug, name: text(60), description: optionalText(300),
  relatedServiceId: z.uuid().nullable(), isVisible: z.boolean() })
// The avatar becomes optional with its migration in Task 2 (Ruling R2).
export const AuthorInput = z.object({ slug: Slug, name: text(80), roleTitle: optionalText(80),
  bio: optionalText(600), avatar: MediaRef, isVisible: z.boolean() })
```

`server/modules/taxonomy/service.ts`:

```ts
import "server-only"

import { asc, count, eq, sql } from "drizzle-orm"

import { collectMediaIds } from "@/blocks/media-refs"
import { AuthorInput, CategoryInput, type Taxonomy } from "@/lib/content/taxonomy"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { articleCategories, articles, authors } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { conflictError, isUniqueViolation, topLevelDiff } from "@/server/lib/conflict"
import { assertMediaExists } from "@/server/modules/media/assert-media"

// Both tables share id, slug, name, sort, is_visible and the stamps; typed
// through categories (like the collections registry), each one's own fields
// are enforced by its Zod schema. user_id on authors is never written here.
type Table = typeof articleCategories
type Row = Record<string, unknown>
const CONFIG = {
  categories: { table: articleCategories, tag: tags.categories, schema: CategoryInput, fk: articles.categoryId, noun: "category" },
  authors: { table: authors as unknown as Table, tag: tags.authors, schema: AuthorInput, fk: articles.authorId, noun: "author" },
} as const

const toRow = (name: Taxonomy, values: Row): Row => {
  if (name !== "authors") return values
  const { avatar, ...rest } = values
  return { ...rest, avatarId: (avatar as { mediaId: string } | null)?.mediaId ?? null }
}
const fromRow = (name: Taxonomy, row: Row): Row => {
  if (name !== "authors") return row
  const { avatarId, ...rest } = row
  return { ...rest, avatar: avatarId ? { mediaId: avatarId } : null }
}
const slugTaken = () => new ApiError("CONFLICT", "That slug is already used", { slug: ["That slug is already used"] })

function parse(name: Taxonomy, input: unknown) {
  const parsed = CONFIG[name].schema.safeParse(input)
  if (!parsed.success) throw invalid(parsed.error)
  return parsed.data as Row
}

async function findLocked(db: DbLike, name: Taxonomy, id: string) {
  const { table, noun } = CONFIG[name]
  const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1).for("update")
  if (!row) throw new ApiError("NOT_FOUND", `That ${noun} doesn't exist`)
  return row
}

export async function listTaxonomy(name: Taxonomy) {
  const { table, fk } = CONFIG[name]
  const db = getDb()
  const rows = await db.select().from(table).orderBy(asc(table.sort), asc(table.name))
  const uses = await db.select({ id: fk, n: count() }).from(articles).groupBy(fk)
  const used = new Map(uses.map((u) => [u.id, u.n]))
  return { items: rows.map((row) => ({ ...fromRow(name, row), articleCount: used.get(row.id) ?? 0 })) }
}

export async function createTaxonomy(actor: Actor, name: Taxonomy, input: unknown) {
  const { table, tag, noun } = CONFIG[name]
  const values = parse(name, input)
  try {
    const row = await getDb().transaction(async (tx) => {
      await assertMediaExists(tx, collectMediaIds(values))
      const [row] = await tx.insert(table)
        .values({ ...toRow(name, values), createdBy: actor.userId, updatedBy: actor.userId } as Table["$inferInsert"])
        .returning()
      await audit(actor, { action: `${noun}.create`, entityType: noun, entityId: row!.id,
        summary: `Created ${noun} ${row!.name}` }, tx)
      return row!
    })
    invalidate([tag])
    return fromRow(name, row)
  } catch (error) {
    if (isUniqueViolation(error)) throw slugTaken()
    throw error
  }
}

export async function updateTaxonomy(actor: Actor, name: Taxonomy, id: string,
  input: { version: number; values: unknown }
) {
  const { table, tag, noun } = CONFIG[name]
  const values = parse(name, input.values)
  try {
    const row = await getDb().transaction(async (tx) => {
      const before = await findLocked(tx, name, id)
      if (before.version !== input.version) throw await conflictError(tx, before)
      await assertMediaExists(tx, collectMediaIds(values))
      const [row] = await tx.update(table)
        .set({ ...toRow(name, values), updatedBy: actor.userId, version: sql`${table.version} + 1` } as Partial<Table["$inferInsert"]>)
        .where(eq(table.id, id)).returning()
      await audit(actor, { action: `${noun}.update`, entityType: noun, entityId: id,
        summary: `Updated ${noun} ${row!.name}`, diff: topLevelDiff(fromRow(name, before), fromRow(name, row!)) }, tx)
      return row!
    })
    invalidate([tag])
    return fromRow(name, row)
  } catch (error) {
    if (isUniqueViolation(error)) throw slugTaken()
    throw error
  }
}

export async function deleteTaxonomy(actor: Actor, name: Taxonomy, id: string) {
  const { table, tag, fk, noun } = CONFIG[name]
  await getDb().transaction(async (tx) => {
    const row = await findLocked(tx, name, id)
    const [{ n }] = await tx.select({ n: count() }).from(articles).where(eq(fk, id))
    if (n > 0) throw new ApiError("CONFLICT", `This ${noun} is used by ${n} article${n === 1 ? "" : "s"}. Move them first.`)
    await tx.delete(table).where(eq(table.id, id))
    await audit(actor, { action: `${noun}.delete`, entityType: noun, entityId: id, summary: `Deleted ${noun} ${row.name}` }, tx)
  })
  invalidate([tag])
  return { ok: true as const }
}
```

`server/modules/taxonomy/routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import type { Taxonomy } from "@/lib/content/taxonomy"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import * as service from "./service"

const IdParam = z.object({ id: z.uuid() })
const Fields = z.record(z.string(), z.unknown())
const UpdateInput = z.object({ version: z.number().int().min(1), values: Fields })
// Ruling R3: everyone who reads articles reads these; editors and up manage them.
const read = can({ article: ["read"] })
const manage = can({ article: ["publish"] })

const routesFor = (name: Taxonomy) =>
  new Hono<AppEnv>()
    .get("/", read, async (c) => c.json(await service.listTaxonomy(name)))
    .post("/", manage, zValidator("json", Fields, validationHook), async (c) =>
      c.json(await service.createTaxonomy(c.get("actor")!, name, c.req.valid("json")), 201))
    .patch("/:id", manage, zValidator("param", IdParam, validationHook), zValidator("json", UpdateInput, validationHook),
      async (c) => c.json(await service.updateTaxonomy(c.get("actor")!, name, c.req.valid("param").id, c.req.valid("json"))))
    .delete("/:id", manage, zValidator("param", IdParam, validationHook), async (c) =>
      c.json(await service.deleteTaxonomy(c.get("actor")!, name, c.req.valid("param").id)))

export const categoriesRoutes = routesFor("categories")
export const authorsRoutes = routesFor("authors")
export type TaxonomyRoutes = typeof categoriesRoutes
```

Mount `.route("/categories", categoriesRoutes).route("/authors", authorsRoutes)` in `server/api/routes/admin.ts` (after `/media`); in `admin/lib/api.ts` add `export const categoriesApi = hc<TaxonomyRoutes>("/api/v1/admin/categories")` and `export const authorsApi = hc<TaxonomyRoutes>("/api/v1/admin/authors")`.

`tests/integration/helpers/articles.ts`:

```ts
import { getDb } from "@/server/db/client"
import { articleCategories, articles, authors } from "@/server/db/schema"

import { insertMedia } from "./content"

export const bodyDoc = (text = "A calm lead paragraph.") => ({ type: "doc" as const,
  content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text }] }] })

export async function insertTaxonomy(suffix = "a") {
  const media = await insertMedia()
  const [category] = await getDb().insert(articleCategories).values({ slug: `cat-${suffix}`, name: `Category ${suffix}` }).returning()
  const [author] = await getDb().insert(authors).values({ slug: `author-${suffix}`, name: `Author ${suffix}`, avatarId: media.id }).returning()
  return { media, category: category!, author: author! }
}

type Status = "draft" | "scheduled" | "published" | "archived"
export async function insertArticle(values: { slug: string; categoryId: string; authorId: string; coverId: string;
  status?: Status; featured?: boolean; createdBy?: string | null }
) {
  const status = values.status ?? "published"
  const [row] = await getDb().insert(articles).values({ title: `Title ${values.slug}`, excerpt: "Excerpt", body: bodyDoc(),
    publishedAt: status === "draft" ? null : new Date(), ...values, status }).returning()
  return row!
}

// A complete, publishable draft (ArticleContent).
export const content = (refs: { categoryId: string; authorId: string; coverId: string },
  overrides: Record<string, unknown> = {}
) => ({ title: "Calm is a skill", slug: "calm-test", excerpt: "Short excerpt.", cover: { mediaId: refs.coverId },
  categoryId: refs.categoryId, authorId: refs.authorId, featured: false, body: bodyDoc(), ...overrides })
```

- [ ] **Step 6: Run tests and gates**

Run: `pnpm vitest run --project unit lib/content server && pnpm test:integration tests/integration/db tests/integration/api/taxonomy.test.ts tests/integration/content tests/integration/seed && pnpm lint && pnpm typecheck`
Expected: PASS. `tests/integration/seed/seed.test.ts` still passes (the seed imports `plainText`/`readingMinutes` through the re-export).

- [ ] **Step 7: Commit**

```bash
git add server/db blocks/rich-text.ts lib/content server/lib/revisions.ts server/env.ts server/env.test.ts .env.example tests/test-env.mjs tests/e2e/fixtures/env.ts server/modules/taxonomy server/modules/content/repo.ts server/api/routes/admin.ts admin/lib/api.ts tests/integration
git commit -m "feat(insights): article schema, redirects table and categories/authors API"
```

---

### Task 2: Article rendering — static renderer, body images, optional author avatar

**Files:**
- Create: `lib/rich-text/extensions.ts`, `tests/content/rich-text-seed.test.tsx` (+ `tests/content/__snapshots__/seed/*.html`)
- Modify: `package.json`/`pnpm-lock.yaml`, `server/db/schema/content.ts` (`authors.avatarId` nullable; `articles.body` type), `lib/content/types.ts`, `lib/content/taxonomy.ts`, `server/modules/content/repo.ts`, `features/insights/components/{rich-text,article-body,article-card,article-hero,post-card}.tsx`, `features/insights/components/rich-text.test.tsx`
- Generated: `server/db/migrations/0006_author_avatar_optional.sql`
- Test: `features/insights/components/rich-text.test.tsx`, `tests/content/rich-text-seed.test.tsx`, `tests/integration/content/repo.test.ts` (append)

**Interfaces:**
- Consumes: `ArticleBodyDoc` (Task 1), `Href`, `MediaImage`, `findMedia`, `collectMediaIds`.
- Produces:
  - `lib/rich-text/extensions.ts`: `richTextStarterKit` (the StarterKit config Phase 4's widget uses), `ArticleImage` (TipTap `image` node with a `mediaId` attr), `articleExtensions: Extensions`.
  - `RichText({ doc, media? }: { doc: RichTextDoc | ArticleBodyDoc; media?: readonly MediaAsset[] })`.
  - `ArticleSummary.author.avatar: MediaAsset | null`; `ArticleDetail.body: ArticleBodyDoc`; `ArticleDetail.media: MediaAsset[]` (assets used by body images).

- [ ] **Step 1: Freeze today's rendering**

Before touching the renderer, write `tests/content/rich-text-seed.test.tsx` and run it once on the **current** implementation so the snapshots record today's markup:

```tsx
// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { expect, it } from "vitest"

import { RichText } from "@/features/insights/components/rich-text"
import { ARTICLE_BODIES } from "@/server/db/seed/fixtures/article-bodies"
import { toTipTap } from "@/server/db/seed/tiptap"

// Every seeded article body. Recorded from the hand-written Phase 3 renderer;
// the static renderer must reproduce it byte for byte (the article parity
// baseline depends on it).
it.each(Object.keys(ARTICLE_BODIES))("%s renders as before", async (slug) => {
  const { container } = render(<RichText doc={toTipTap(ARTICLE_BODIES[slug]!)} />)
  await expect(container.innerHTML).toMatchFileSnapshot(`./__snapshots__/seed/${slug}.html`)
})
```

Run: `pnpm vitest run --project unit tests/content/rich-text-seed.test.tsx`
Expected: PASS, writing one `.html` file per article. Open one and confirm it has the lead `<p data-motion="words" …>`, `<h2 data-motion="words" …>` and the clay `<blockquote>`.

- [ ] **Step 2: Write the failing tests**

Append to `features/insights/components/rich-text.test.tsx` (add `import type { ArticleBodyDoc } from "@/blocks/rich-text"` and `import type { MediaAsset } from "@/lib/media"`):

```tsx
const asset: MediaAsset = { id: "00000000-0000-4000-8000-0000000000aa", src: "/images/hero/hero-bg.png", width: 800,
  height: 600, blurDataURL: null, alt: "A calm room", focal: { x: 0.5, y: 0.5 } }
const withImage = (mediaId: string): ArticleBodyDoc => ({ type: "doc", content: [
  { type: "paragraph", content: [{ type: "text", text: "Lead" }] },
  { type: "image", attrs: { mediaId, src: "/stale.png", alt: "stale" } }] })

describe("RichText article extras", () => {
  it("renders body images from the library asset, not the stored src", () => {
    const { container } = render(<RichText doc={withImage(asset.id)} media={[asset]} />)
    const img = container.querySelector("figure img")
    expect(img?.getAttribute("alt")).toBe("A calm room")
    expect(img?.getAttribute("src")).toContain(encodeURIComponent("/images/hero/hero-bg.png")) })
  it("drops an image whose asset is gone instead of failing the article", () => {
    const { container } = render(<RichText doc={withImage(asset.id)} media={[]} />)
    expect(container.querySelector("figure")).toBeNull()
    expect(container.textContent).toContain("Lead") })
  it("renders level-3 headings as h3", () => {
    const { container } = render(<RichText doc={{ type: "doc", content: [{ type: "heading", attrs: { level: 3 },
      content: [{ type: "text", text: "Small" }] }] } as RichTextDoc} />)
    expect(container.querySelector("h3")?.textContent).toBe("Small") })
  it("skips node types the schema does not know instead of failing the article", () => {
    const { container } = render(<RichText doc={{ type: "doc", content: [{ type: "video" },
      { type: "paragraph", content: [{ type: "text", text: "Still here" }] }] } as unknown as RichTextDoc} />)
    expect(container.querySelector("video")).toBeNull()
    expect(container.textContent).toBe("Still here") }) })
```

Append to `tests/integration/content/repo.test.ts` (reuse its imports; add `insertTaxonomy`, `insertArticle`, `bodyDoc` from `../helpers/articles`, `authors`, `articles`, `media` from the schema, `eq` from drizzle):

```ts
describe("articles without an author photo (Ruling R2)", () => {
  it("still lists an article whose author has no or a deleted avatar", async () => {
    const { category, author, media: cover } = await insertTaxonomy()
    await insertArticle({ slug: "no-photo", categoryId: category.id, authorId: author.id, coverId: cover.id })
    await getDb().update(authors).set({ avatarId: null })
    const [summary] = await listArticleSummaries()
    expect(summary?.slug).toBe("no-photo")
    expect(summary?.author.avatar).toBeNull() })
  it("resolves body images into detail.media", async () => {
    const { category, author, media: cover } = await insertTaxonomy()
    const art = await insertArticle({ slug: "with-image", categoryId: category.id, authorId: author.id, coverId: cover.id })
    await getDb().update(articles).set({ body: { type: "doc", content: [...bodyDoc().content,
      { type: "image", attrs: { mediaId: cover.id } }] } }).where(eq(articles.id, art.id))
    const detail = await findArticleBySlug("with-image")
    expect(detail?.media.map((m) => m.id)).toEqual([cover.id]) }) })
```

Run: `pnpm vitest run --project unit features/insights tests/content && pnpm test:integration tests/integration/content/repo.test.ts`
Expected: FAIL (no `media` prop / `figure`; avatar is required; `detail.media` undefined).

- [ ] **Step 3: Install and share the extension list**

Run: `pnpm add @tiptap/static-renderer@3.31.3 @tiptap/extension-image@3.31.3`

`lib/rich-text/extensions.ts` (isomorphic; no `"use client"`, no `server-only`):

```ts
import type { Extensions } from "@tiptap/core"
import Image from "@tiptap/extension-image"
import StarterKit from "@tiptap/starter-kit"

// Only what blocks/rich-text.ts accepts: paragraphs, h2/h3, bullet lists,
// quotes, bold, italic and links (docs/brief.md §15: rendered statically,
// never as HTML). Shared by the admin editors and the site's renderer, so
// both read the same schema.
export const richTextStarterKit = StarterKit.configure({
  heading: { levels: [2, 3] }, code: false, codeBlock: false, strike: false, underline: false,
  horizontalRule: false, orderedList: false, hardBreak: false, link: { openOnClick: false, autolink: false },
})

// Images from the media library (Ruling R8): the library id travels in attrs.
export const ArticleImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), mediaId: { default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute("data-media-id"),
      renderHTML: (attrs: { mediaId?: string | null }) => (attrs.mediaId ? { "data-media-id": attrs.mediaId } : {}) } }
  },
}).configure({ inline: false, allowBase64: false })

export const articleExtensions: Extensions = [richTextStarterKit, ArticleImage]
```

Point `admin/components/schema-form/widgets/rich-text-widget.tsx` at it: replace its local `extensions` array with `const extensions = [richTextStarterKit]` (import from `@/lib/rich-text/extensions`).

- [ ] **Step 4: Swap the renderer**

`features/insights/components/rich-text.tsx` — replace the file:

```tsx
import type { Mark as PmMark, Node as PmNode } from "@tiptap/pm/model"
import { renderToReactElement } from "@tiptap/static-renderer/pm/react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Href } from "@/blocks/fields"
import type { ArticleBodyDoc, RichTextDoc } from "@/blocks/rich-text"
import { MediaImage } from "@/components/media-image"
import type { MediaAsset } from "@/lib/media"
import { articleExtensions } from "@/lib/rich-text/extensions"

type NodeProps = { node: PmNode; parent?: PmNode; children?: ReactNode }
type MarkProps = { mark: PmMark; children?: ReactNode }

const DISPLAY = "[font-variation-settings:'SOFT'_0,'WONK'_1]"

// The Phase 3 markup, node for node (tests/content/__snapshots__/seed): the
// first top-level paragraph is the lead; list items are a bullet + a span
// of inline text; quotes are clay-ruled display paragraphs.
function nodeMapping(media: ReadonlyMap<string, MediaAsset>) {
  return {
    paragraph: ({ node, parent, children }: NodeProps) => {
      const within = parent?.type.name
      if (within === "listItem") return <>{children}</>
      if (within === "blockquote") return (
        <p data-motion="words" className={`font-display text-[24px] leading-[1.35] font-semibold text-pine ${DISPLAY} sm:text-[30px]`}>{children}</p>)
      if (within === "doc" && parent?.firstChild === node) return (
        <p data-motion="words" className="pb-2 text-[21px] leading-[1.6] text-ink sm:text-[23px]">{children}</p>)
      return <p data-motion="rise">{children}</p>
    },
    heading: ({ node, children }: NodeProps) => node.attrs.level === 3
      ? <h3 data-motion="words" className="pt-4 text-[21px] leading-[1.3] font-semibold text-ink sm:text-[24px]">{children}</h3>
      : <h2 data-motion="words" className="pt-6 text-[26px] leading-[1.25] font-semibold tracking-[-0.5px] text-ink sm:text-[32px]">{children}</h2>,
    blockquote: ({ children }: NodeProps) => (
      <blockquote className="relative my-4 py-1 pl-6 sm:pl-8">
        <span aria-hidden data-motion="grow" className="absolute inset-y-0 left-0 w-0.5 bg-clay" />
        {children}
      </blockquote>),
    bulletList: ({ children }: NodeProps) => <ul data-motion="stagger" className="flex flex-col gap-4">{children}</ul>,
    listItem: ({ children }: NodeProps) => (
      <li className="flex gap-4">
        <span aria-hidden className="mt-2.75 size-1.5 shrink-0 rounded-full bg-clay" />
        <span>{children}</span>
      </li>),
    image: ({ node }: NodeProps) => {
      const asset = media.get(node.attrs.mediaId as string)
      if (!asset) return null
      return (
        <figure data-motion="rise" className="my-4 overflow-hidden rounded-3xl">
          <MediaImage media={asset} sizes="(min-width: 1024px) 720px, 100vw" className="h-auto w-full object-cover" />
        </figure>)
    },
  }
}

// A link whose href fails the editor's rules (blocks/fields Href) renders as
// plain text. Text is a React child, so it is always escaped.
const markMapping = {
  bold: ({ children }: MarkProps) => <strong className="font-semibold text-ink">{children}</strong>,
  italic: ({ children }: MarkProps) => <em>{children}</em>,
  link: ({ mark, children }: MarkProps) => {
    const href = Href.safeParse(mark.attrs.href)
    return href.success
      ? <Link href={href.data} className="text-clay underline underline-offset-4">{children}</Link>
      : <>{children}</>
  },
}

export function RichText({ doc, media = [] }: { doc: RichTextDoc | ArticleBodyDoc; media?: readonly MediaAsset[] }) {
  try {
    return renderToReactElement({ content: doc, extensions: articleExtensions,
      options: { nodeMapping: nodeMapping(new Map(media.map((m) => [m.id, m]))), markMapping,
        // A hand-edited or future node type renders nothing; its siblings stay.
        unhandledNode: () => null, unhandledMark: ({ children }: MarkProps) => <>{children}</> } })
  } catch (error) {
    // Bodies are validated on publish; a hand-edited row must not take the
    // whole article down.
    console.warn("[content] rich text could not be rendered", error)
    return null
  }
}
```

If the static renderer's `nodeMapping`/`markMapping` value types reject these props (check `node_modules/@tiptap/static-renderer/dist/pm/react/index.d.ts`: `NodeProps<Node, ReactNode>` has `node`, `parent?`, `children?`), keep the functions and annotate the objects as `Record<string, (props: any) => ReactNode>` with an eslint-disable line — do not change the markup.

Run: `pnpm vitest run --project unit tests/content/rich-text-seed.test.tsx features/insights`
Expected: PASS. If a seed snapshot differs, fix the mapping until it matches (never update the snapshot). Mark order is the likely culprit: the old renderer wrapped marks in array order (bold inside link when `marks: [bold, link]`).

- [ ] **Step 5: Optional avatar and body media**

`server/db/schema/content.ts` — authors: `avatarId: uuid().references(() => media.id, { onDelete: "restrict" }),` (nullable; comment `// Optional (Phase 5 Ruling R2): no photo renders the byline without one.`); articles: `body: jsonb().$type<ArticleBodyDoc>().notNull(),` (import the type from `@/blocks/rich-text`).

Run: `pnpm db:generate --name author_avatar_optional`
Expected: `0006_author_avatar_optional.sql` with only `ALTER TABLE "authors" ALTER COLUMN "avatar_id" DROP NOT NULL`.

`lib/content/taxonomy.ts`: `avatar: MediaRef.nullable(),` (drop the Task 1 comment).

`lib/content/types.ts`: `author: { name: string; avatar: MediaAsset | null }` in `ArticleSummary`; in `ArticleDetail` `body: ArticleBodyDoc` (import from `@/blocks/rich-text`) and add `// Assets of the body's images, for RichText.` `media: MediaAsset[]`.

`server/modules/content/repo.ts` — in `toSummary`:

```ts
  const image = r.a.coverId ? need(assets, r.a.coverId) : null
  if (!image) return null
  // A missing photo no longer hides the article (Ruling R2).
  const avatar = r.author.avatarId ? (assets.get(r.author.avatarId) ?? null) : null
```

and return `author: { name: r.author.name, avatar }`. In `findArticleBySlug`, after loading `body`:

```ts
  const bodyMedia = await findMedia(collectMediaIds(body), db)
  return { ...summary, body, media: [...bodyMedia.values()], topicSlug: r.topic }
```

(import `collectMediaIds` from `@/blocks/media-refs`).

`features/insights/components/article-body.tsx`: `<RichText doc={article.body} media={article.media} />`, and wrap the author `<MediaImage media={author.avatar} …/>` in `{author.avatar && (…)}`. Do the same guard in `article-card.tsx`, `article-hero.tsx` and `post-card.tsx` around their `media={author.avatar}` images (render nothing in its place).

- [ ] **Step 6: Run tests and gates**

Run: `pnpm vitest run --project unit && pnpm test:integration tests/integration/content tests/integration/db tests/integration/api/taxonomy.test.ts && pnpm lint && pnpm typecheck && pnpm e2e:seed && pnpm test:parity`
Expected: PASS; parity 21/21 at ≤ 0.1% (the article baseline included).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml lib/rich-text lib/content server/db server/modules/content/repo.ts features/insights admin/components/schema-form/widgets/rich-text-widget.tsx tests/content tests/integration/content
git commit -m "feat(insights): static TipTap renderer, body images and optional author photo"
```

---

### Task 3: Articles API — CRUD, ownership, search

**Files:**
- Create: `server/modules/articles/schema.ts`, `server/modules/articles/access.ts`, `server/modules/articles/service.ts`, `server/modules/articles/routes.ts`, `server/lib/rate-limit.ts`
- Modify: `server/modules/search/service.ts`, `server/modules/search/routes.ts`, `server/api/routes/admin.ts`, `admin/lib/api.ts`
- Test: `tests/integration/api/articles.test.ts`, `tests/integration/api/search.test.ts` (append), `server/lib/rate-limit.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas/helpers, `conflictError`, `userName`, `audit`, `slugify` (`lib/utils.ts`), `hasPermission`.
- Produces:
  - `access.ts`: `canPublish(actor): boolean`, `ownAuthorId(db, actor): Promise<string>` (creates the author row, Ruling R4), `assertCanEdit(db, actor, row)`, `assertCanDelete(actor, row)`.
  - `service.ts`: `type ArticleRow`, `findArticle(db, id, lock?)`, `writeIfVersion(db, id, version, set)`, `draftOf(row): ArticleDraft`, `listArticles(query)`, `getArticle(actor, id)`, `createArticle(actor, input)`, `saveArticleDraft(actor, id, { version, draft })`, `updateArticleSeo(actor, id, patch)`, `submitForReview(actor, id)`, `deleteArticle(actor, id)`, `searchArticleHits(q, limit?)`, `articleTags(id, extra?)`.
  - `ArticlesRoutes` at `/api/v1/admin/articles`: `GET /` (`ArticleListQuery`) → `{ items, page, pageSize, total }`; `POST /` → `{ id, version }` 201; `GET /:id`; `PATCH /:id/draft` `{ version, draft }` → `{ version, updatedAt }`; `PATCH /:id/seo` → `{ seo }`; `POST /:id/submit` → `{ reviewRequestedAt }`; `DELETE /:id` → `{ ok: true }`. Client `articlesApi`.
  - `SearchHit.kind: "page" | "article"`; `takeToken(key, { limit, windowMs }, now?)`.

- [ ] **Step 1: Write the failing tests**

`server/lib/rate-limit.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { takeToken } from "./rate-limit"

describe("takeToken", () => {
  it("allows `limit` calls per window and resets after it", () => {
    const opts = { limit: 3, windowMs: 1000 }
    expect([1, 2, 3, 4].map(() => takeToken("k", opts, 0))).toEqual([true, true, true, false])
    expect(takeToken("other", opts, 0)).toBe(true)
    expect(takeToken("k", opts, 1000)).toBe(true) }) })
```

`tests/integration/api/articles.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag }))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { articles, authors, users } from "@/server/db/schema"

import { content, insertArticle, insertTaxonomy } from "../helpers/articles"
import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => { await resetDb(); next.revalidateTag.mockReset() })
afterAll(closeDb)
const json = (r: Response) => r.json()
const create = (cookie: string, body: object) => adminRequest("/articles", cookie, { method: "POST", body })
const saveDraft = (cookie: string, id: string, version: number, draft: object) =>
  adminRequest(`/articles/${id}/draft`, cookie, { method: "PATCH", body: { version, draft } })
const userId = async (email: string) =>
  (await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)))[0]!.id

// docs/brief.md §7.2. [GET list, POST create]
const MATRIX: Record<RoleName, [number, number]> = { owner: [200, 201], admin: [200, 201], editor: [200, 201],
  author: [200, 201], marketer: [200, 403], intake: [403, 403], viewer: [200, 403] }

describe.each(ROLE_NAMES)("articles RBAC for %s", (role) => {
  it(`GET /articles → ${MATRIX[role][0]}, POST → ${MATRIX[role][1]}`, async () => {
    const { category } = await insertTaxonomy()
    const cookie = await cookieFor(role)
    expect((await adminRequest("/articles", cookie)).status).toBe(MATRIX[role][0])
    expect((await create(cookie, { title: "Hello", categoryId: category.id })).status).toBe(MATRIX[role][1]) }) })

describe("articles API", () => {
  it("creates a draft with a unique slug and the writer's own author row", async () => {
    const { category } = await insertTaxonomy()
    const cookie = await cookieFor("author")
    const a = await json(await create(cookie, { title: "Calm Is A Skill", categoryId: category.id }))
    const b = await json(await create(cookie, { title: "Calm is a skill", categoryId: category.id }))
    const one = await json(await adminRequest(`/articles/${a.id}`, cookie))
    const two = await json(await adminRequest(`/articles/${b.id}`, cookie))
    expect(one.draft.slug).toBe("calm-is-a-skill")
    expect(two.draft.slug).toBe("calm-is-a-skill-2")
    expect(one.status).toBe("draft")
    const [mine] = await getDb().select().from(authors).where(eq(authors.userId, await userId("author@example.com")))
    expect(one.draft.authorId).toBe(mine!.id)
    expect(two.draft.authorId).toBe(mine!.id)
    expect(next.revalidateTag).not.toHaveBeenCalled() })

  it("autosaves with a version and 409s a stale one", async () => {
    const refs = await insertTaxonomy()
    const cookie = await cookieFor("editor")
    const { id } = await json(await create(cookie, { title: "Draft", categoryId: refs.category.id, authorId: refs.author.id }))
    const draft = content({ categoryId: refs.category.id, authorId: refs.author.id, coverId: refs.media.id })
    const first = await saveDraft(cookie, id, 1, draft)
    expect((await json(first)).version).toBe(2)
    const stale = await saveDraft(cookie, id, 1, draft)
    expect(stale.status).toBe(409)
    expect((await json(stale)).error.details.current.version).toBe(2) })

  it("enforces ownership for authors (Review Focus 2)", async () => {
    const refs = await insertTaxonomy()
    const writer = await cookieFor("author", "writer@example.com")
    const other = await cookieFor("author", "other@example.com")
    const editor = await cookieFor("editor")
    const { id } = await json(await create(writer, { title: "Mine", categoryId: refs.category.id }))
    const draft = (await json(await adminRequest(`/articles/${id}`, writer))).draft
    expect((await saveDraft(other, id, 1, draft)).status).toBe(403)
    expect((await adminRequest(`/articles/${id}`, other)).status).toBe(200) // read is everyone's
    // Crediting someone else is an editor's call.
    expect((await saveDraft(writer, id, 1, { ...draft, authorId: refs.author.id })).status).toBe(403)
    expect((await saveDraft(editor, id, 1, { ...draft, title: "Edited" })).status).toBe(200)
    // An article that lists the writer as author is theirs too.
    const theirs = await insertArticle({ slug: "listed", categoryId: refs.category.id, authorId: draft.authorId,
      coverId: refs.media.id, status: "draft" })
    const got = await json(await adminRequest(`/articles/${theirs.id}`, writer))
    expect(got.canEdit).toBe(true)
    expect((await saveDraft(writer, theirs.id, theirs.version, got.draft)).status).toBe(200) })

  it("lets an author delete only drafts that were never published", async () => {
    const refs = await insertTaxonomy()
    const writer = await cookieFor("author")
    const { id } = await json(await create(writer, { title: "Mine", categoryId: refs.category.id }))
    await getDb().update(articles).set({ publishedAt: new Date(), status: "archived" }).where(eq(articles.id, id))
    expect((await adminRequest(`/articles/${id}`, writer, { method: "DELETE" })).status).toBe(403)
    await getDb().update(articles).set({ publishedAt: null, status: "draft" }).where(eq(articles.id, id))
    expect((await adminRequest(`/articles/${id}`, writer, { method: "DELETE" })).status).toBe(200) })

  it("deleting a published article expires the public tags", async () => {
    const refs = await insertTaxonomy()
    const art = await insertArticle({ slug: "live", categoryId: refs.category.id, authorId: refs.author.id, coverId: refs.media.id })
    await adminRequest(`/articles/${art.id}`, await cookieFor("editor"), { method: "DELETE" })
    expect(next.revalidateTag.mock.calls.map(([t]) => t)).toEqual(["articles", `article:${art.id}`]) })

  it("submits for review and SEO saves live for seo.update holders only", async () => {
    const refs = await insertTaxonomy()
    const writer = await cookieFor("author")
    const { id } = await json(await create(writer, { title: "Mine", categoryId: refs.category.id }))
    const submitted = await adminRequest(`/articles/${id}/submit`, writer, { method: "POST" })
    expect((await json(submitted)).reviewRequestedAt).toBeTruthy()
    const list = await json(await adminRequest("/articles?review=requested", writer))
    expect(list.items.map((i: { id: string }) => i.id)).toEqual([id])
    expect((await adminRequest(`/articles/${id}/seo`, writer, { method: "PATCH", body: { title: "X" } })).status).toBe(403)
    const seo = await adminRequest(`/articles/${id}/seo`, await cookieFor("marketer"), { method: "PATCH", body: { title: "SEO title" } })
    expect((await json(seo)).seo.title).toBe("SEO title") })

  it("filters and searches the list (Ruling R7)", async () => {
    const refs = await insertTaxonomy()
    await insertArticle({ slug: "breathing", categoryId: refs.category.id, authorId: refs.author.id, coverId: refs.media.id })
    await getDb().update(articles).set({ bodyText: "Box breathing calms the nervous system" })
    const cookie = await cookieFor("editor")
    await create(cookie, { title: "Sleep hygiene draft", categoryId: refs.category.id, authorId: refs.author.id })
    const q = async (s: string) => (await json(await adminRequest(`/articles?${s}`, cookie))).items.map((i: { slug: string }) => i.slug)
    expect(await q("q=nervous")).toEqual(["breathing"])
    expect(await q("q=sleep")).toEqual(["sleep-hygiene-draft"])
    expect(await q("status=draft")).toEqual(["sleep-hygiene-draft"])
    expect(await q("q=%22unbalanced")).toEqual([]) }) })
```

Append to `tests/integration/api/search.test.ts` (reuse its imports; add the articles helpers; if the file does not mock `next/cache`, none is needed — search does not invalidate):

```ts
describe("⌘K article hits", () => {
  it("finds articles for article.read holders and none for intake", async () => {
    const refs = await insertTaxonomy()
    await insertArticle({ slug: "box-breathing", categoryId: refs.category.id, authorId: refs.author.id, coverId: refs.media.id })
    const editor = await adminRequest("/search?q=box", await cookieFor("editor"))
    expect((await editor.json()).items).toContainEqual(expect.objectContaining({ kind: "article", label: "Title box-breathing" }))
    const intake = await adminRequest("/search?q=box", await cookieFor("intake"))
    expect((await intake.json()).items.some((i: { kind: string }) => i.kind === "article")).toBe(false) })
  it("rate-limits a user to 30 searches per 10 seconds", async () => {
    const cookie = await cookieFor("viewer")
    const statuses = []
    for (let i = 0; i < 31; i++) statuses.push((await adminRequest("/search?q=a", cookie)).status)
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true)
    expect(statuses[30]).toBe(429) }) })
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run --project unit server/lib/rate-limit.test.ts && pnpm test:integration tests/integration/api/articles.test.ts tests/integration/api/search.test.ts`
Expected: FAIL (`/articles` 404, `./rate-limit` missing).

- [ ] **Step 3: Access rules**

`server/modules/articles/access.ts`:

```ts
import "server-only"

import { eq } from "drizzle-orm"

import { hasPermission } from "@/lib/auth/permissions"
import { slugify } from "@/lib/utils"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import type { DbLike } from "@/server/db/client"
import { articles, authors } from "@/server/db/schema"

type Row = Pick<typeof articles.$inferSelect, "createdBy" | "authorId" | "status" | "publishedAt">

// Editors and up (article.publish) work on any article; everyone else only
// on articles they created or that list them as author (docs/brief.md §7.2).
export const canPublish = (actor: Actor) => hasPermission(actor.roles, { article: ["publish"] })

async function linkedUser(db: DbLike, authorId: string | null) {
  if (!authorId) return null
  const [row] = await db.select({ userId: authors.userId }).from(authors).where(eq(authors.id, authorId)).limit(1)
  return row?.userId ?? null
}

export async function isOwn(db: DbLike, actor: Actor, row: Row, draftAuthorId: string | null = null) {
  if (row.createdBy === actor.userId) return true
  if ((await linkedUser(db, row.authorId)) === actor.userId) return true
  return draftAuthorId !== null && (await linkedUser(db, draftAuthorId)) === actor.userId
}

export async function assertCanEdit(db: DbLike, actor: Actor, row: Row, draftAuthorId: string | null = null) {
  if (canPublish(actor) || (await isOwn(db, actor, row, draftAuthorId))) return
  throw new ApiError("FORBIDDEN", "You can only edit your own articles")
}

// "own drafts" (§7.2): never published, still a draft.
export function assertCanDelete(actor: Actor, row: Row) {
  if (canPublish(actor)) return
  if (row.status === "draft" && row.publishedAt === null) return
  throw new ApiError("FORBIDDEN", "Only drafts that were never published can be deleted")
}

// Ruling R4: a writer's byline is their own authors row, made on first use.
export async function ownAuthorId(db: DbLike, actor: Actor) {
  const [mine] = await db.select({ id: authors.id }).from(authors).where(eq(authors.userId, actor.userId)).limit(1)
  if (mine) return mine.id
  const base = slugify(actor.name) || "author"
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    const [row] = await db.insert(authors).values({ slug, name: actor.name, userId: actor.userId,
      createdBy: actor.userId, updatedBy: actor.userId }).onConflictDoNothing({ target: authors.slug }).returning({ id: authors.id })
    if (row) return row.id
  }
}
```

- [ ] **Step 4: Service and routes**

`server/modules/articles/schema.ts`:

```ts
import "server-only"

import * as z from "zod"

import { ARTICLE_STATUSES, ArticleDraft } from "@/lib/content/article"

export { ArticleSeoPatch, NewArticleInput, ScheduleInput, UnpublishInput } from "@/lib/content/article"

export const ArticleIdParam = z.object({ id: z.uuid() })
export const ArticleRevisionParam = z.object({ id: z.uuid(), rev: z.uuid() })
export const VersionInput = z.object({ version: z.number().int().min(1) })
export const DraftInput = VersionInput.extend({ draft: ArticleDraft })
export const ArticleListQuery = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(ARTICLE_STATUSES).optional(),
  categoryId: z.uuid().optional(),
  authorId: z.uuid().optional(),
  review: z.literal("requested").optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})
export type ArticleListQuery = z.infer<typeof ArticleListQuery>
```

`server/modules/articles/service.ts`:

```ts
import "server-only"

import { and, count, desc, eq, ilike, isNotNull, or, sql, type SQL } from "drizzle-orm"
import { isDeepStrictEqual } from "node:util"

import { collectMediaIds } from "@/blocks/media-refs"
import { PageSeo } from "@/blocks/page"
import { EMPTY_BODY, type ArticleDraft } from "@/lib/content/article"
import { slugify } from "@/lib/utils"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { articleCategories, articles, authors } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { conflictError, userName } from "@/server/lib/conflict"
import { deleteRevisions } from "@/server/lib/revisions"
import { assertMediaExists } from "@/server/modules/media/assert-media"

import { assertCanDelete, assertCanEdit, canPublish, isOwn, ownAuthorId } from "./access"
import type { ArticleListQuery } from "./schema"

export type ArticleRow = typeof articles.$inferSelect

export const articleTags = (id: string, extra: string[] = []) => [tags.articles, tags.article(id), ...extra]

export async function findArticle(db: DbLike, id: string, lock = false) {
  const query = db.select().from(articles).where(eq(articles.id, id)).limit(1)
  const [row] = lock ? await query.for("update") : await query
  if (!row) throw new ApiError("NOT_FOUND", "That article doesn't exist")
  return row
}

// Optimistic lock (docs/brief.md §6.5).
export async function writeIfVersion(db: DbLike, id: string, version: number, set: Partial<typeof articles.$inferInsert>) {
  const [row] = await db.update(articles).set({ ...set, version: sql`${articles.version} + 1` })
    .where(and(eq(articles.id, id), eq(articles.version, version))).returning()
  if (row) return row
  throw await conflictError(db, await findArticle(db, id))
}

// The published copy in draft shape; Ruling R11: seeded rows have no draft.
export function publishedAsDraft(row: ArticleRow): ArticleDraft {
  return { title: row.title, slug: row.slug, excerpt: row.excerpt, cover: row.coverId ? { mediaId: row.coverId } : null,
    categoryId: row.categoryId, authorId: row.authorId, featured: row.featured, body: row.body }
}
export const draftOf = (row: ArticleRow) => (row.draft as ArticleDraft | null) ?? publishedAsDraft(row)

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`)
const tsQuery = (q: string) => sql`websearch_to_tsquery('english', ${q})`
// Ruling R7: the published copy's tsvector, or the working title.
const matches = (q: string) => or(sql`${articles.search} @@ ${tsQuery(q)}`,
  ilike(sql`${articles.draft}->>'title'`, `%${escapeLike(q)}%`))
const workingTitle = sql<string>`coalesce(${articles.draft}->>'title', ${articles.title})`
const workingSlug = sql<string>`coalesce(${articles.draft}->>'slug', ${articles.slug})`

export async function listArticles(query: ArticleListQuery) {
  const filters: (SQL | undefined)[] = [
    query.q ? matches(query.q) : undefined,
    query.status ? eq(articles.status, query.status) : undefined,
    query.categoryId ? eq(articles.categoryId, query.categoryId) : undefined,
    query.authorId ? eq(articles.authorId, query.authorId) : undefined,
    query.review ? isNotNull(articles.reviewRequestedAt) : undefined,
  ]
  const where = and(...filters)
  const db = getDb()
  const rows = await db.select({
    id: articles.id, title: workingTitle, slug: workingSlug, status: articles.status, featured: articles.featured,
    category: articleCategories.name, author: authors.name, updatedAt: articles.updatedAt,
    publishedAt: articles.publishedAt, scheduledFor: articles.scheduledFor, reviewRequestedAt: articles.reviewRequestedAt,
  }).from(articles)
    .innerJoin(articleCategories, eq(articles.categoryId, articleCategories.id))
    .innerJoin(authors, eq(articles.authorId, authors.id))
    .where(where)
    .orderBy(...(query.q ? [desc(sql`ts_rank(${articles.search}, ${tsQuery(query.q)})`)] : []), desc(articles.updatedAt))
    .limit(query.pageSize).offset((query.page - 1) * query.pageSize)
  const [{ total }] = await db.select({ total: count() }).from(articles).where(where)
  return { items: rows, page: query.page, pageSize: query.pageSize, total }
}

export async function getArticle(actor: Actor, id: string) {
  const db = getDb()
  const row = await findArticle(db, id)
  const draft = draftOf(row)
  return {
    id: row.id, status: row.status, slug: row.slug, draft, seo: PageSeo.parse(row.seo), version: row.version,
    updatedAt: row.updatedAt, publishedAt: row.publishedAt, scheduledFor: row.scheduledFor,
    reviewRequestedAt: row.reviewRequestedAt, updatedBy: await userName(db, row.updatedBy),
    // isDeepStrictEqual ignores key order (jsonb reorders keys).
    hasUnpublishedChanges: row.status === "published" && !isDeepStrictEqual(draft, publishedAsDraft(row)),
    canEdit: canPublish(actor) || (await isOwn(db, actor, row, draft.authorId)),
  }
}

async function uniqueSlug(db: DbLike, title: string) {
  const base = slugify(title).slice(0, 70) || "article"
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    const [taken] = await db.select({ id: articles.id }).from(articles)
      .where(or(eq(articles.slug, slug), sql`${articles.draft}->>'slug' = ${slug}`)).limit(1)
    if (!taken) return slug
  }
}

async function assertExists(db: DbLike, categoryId: string, authorId: string) {
  const [cat] = await db.select({ id: articleCategories.id }).from(articleCategories).where(eq(articleCategories.id, categoryId))
  const [author] = await db.select({ id: authors.id }).from(authors).where(eq(authors.id, authorId))
  if (!cat) throw new ApiError("VALIDATION_FAILED", "Choose a category", { categoryId: ["That category doesn't exist"] })
  if (!author) throw new ApiError("VALIDATION_FAILED", "Choose an author", { authorId: ["That author doesn't exist"] })
}

export async function createArticle(actor: Actor, input: { title: string; categoryId: string; authorId?: string }) {
  return getDb().transaction(async (tx) => {
    const own = await ownAuthorId(tx, actor)
    const authorId = input.authorId ?? own
    if (authorId !== own && !canPublish(actor)) throw new ApiError("FORBIDDEN", "You can't credit another author")
    await assertExists(tx, input.categoryId, authorId)
    const slug = await uniqueSlug(tx, input.title)
    const draft: ArticleDraft = { title: input.title, slug, excerpt: "", cover: null, categoryId: input.categoryId,
      authorId, featured: false, body: EMPTY_BODY }
    // The typed columns hold the published copy; until the first publish they
    // only reserve the slug (status draft is never served).
    const [row] = await tx.insert(articles).values({ slug, title: input.title, excerpt: "", categoryId: input.categoryId,
      authorId, body: EMPTY_BODY, draft, createdBy: actor.userId, updatedBy: actor.userId }).returning()
    await audit(actor, { action: "article.create", entityType: "article", entityId: row!.id,
      summary: `Created article “${input.title}”` }, tx)
    return { id: row!.id, version: row!.version }
  })
}

// Autosave (~1.2 s): not audited, like pages.
export async function saveArticleDraft(actor: Actor, id: string, input: { version: number; draft: ArticleDraft }) {
  return getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    const current = draftOf(row)
    await assertCanEdit(tx, actor, row, current.authorId)
    if (!canPublish(actor) && input.draft.authorId !== current.authorId && input.draft.authorId !== (await ownAuthorId(tx, actor))) {
      throw new ApiError("FORBIDDEN", "You can't credit another author")
    }
    if (row.version !== input.version) throw await conflictError(tx, row)
    const saved = await writeIfVersion(tx, id, input.version, { draft: input.draft, updatedBy: actor.userId })
    return { version: saved.version, updatedAt: saved.updatedAt }
  })
}

// Live on save, no version bump (docs/brief.md §6.5), like pages.
export async function updateArticleSeo(actor: Actor, id: string, patch: Record<string, unknown>) {
  if (!hasPermission(actor.roles, { seo: ["update"] })) throw new ApiError("FORBIDDEN", "You can't change SEO settings")
  const saved = await getDb().transaction(async (tx) => {
    const before = await findArticle(tx, id, true)
    await assertMediaExists(tx, collectMediaIds(patch))
    const [row] = await tx.update(articles).set({ seo: sql`${articles.seo} || ${JSON.stringify(patch)}::jsonb`,
      updatedBy: actor.userId }).where(eq(articles.id, id)).returning()
    const diff = Object.fromEntries(Object.entries(patch).map(([k, to]) =>
      [`seo.${k}`, { from: (before.seo as Record<string, unknown>)[k] ?? null, to }]))
    await audit(actor, { action: "article.seo", entityType: "article", entityId: id,
      summary: `Updated SEO of “${before.title}”`, diff }, tx)
    return row!
  })
  if (saved.status === "published") invalidate(articleTags(id))
  return { seo: PageSeo.parse(saved.seo) }
}

export async function submitForReview(actor: Actor, id: string) {
  return getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    await assertCanEdit(tx, actor, row, draftOf(row).authorId)
    const [saved] = await tx.update(articles).set({ reviewRequestedAt: new Date(), reviewRequestedBy: actor.userId })
      .where(eq(articles.id, id)).returning()
    await audit(actor, { action: "article.submit", entityType: "article", entityId: id,
      summary: `Submitted “${draftOf(row).title}” for review` }, tx)
    return { reviewRequestedAt: saved!.reviewRequestedAt }
  })
}

export async function deleteArticle(actor: Actor, id: string) {
  const row = await getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    await assertCanEdit(tx, actor, row, draftOf(row).authorId)
    assertCanDelete(actor, row)
    await deleteRevisions(tx, "article", id)
    await tx.delete(articles).where(eq(articles.id, id))
    await audit(actor, { action: "article.delete", entityType: "article", entityId: id,
      summary: `Deleted article “${draftOf(row).title}”` }, tx)
    return row
  })
  if (row.status === "published") invalidate(articleTags(id))
  return { ok: true as const }
}

export async function searchArticleHits(q: string, limit = 5) {
  const term = q.trim()
  if (term.length < 2) return []
  const rows = await getDb().select({ id: articles.id, title: workingTitle }).from(articles).where(matches(term))
    .orderBy(desc(sql`ts_rank(${articles.search}, ${tsQuery(term)})`), desc(articles.updatedAt)).limit(limit)
  return rows.map((r) => ({ id: `article:${r.id}`, kind: "article" as const, label: r.title, href: `/admin/insights/${r.id}` }))
}
```

Also add `import { hasPermission } from "@/lib/auth/permissions"` to the service's imports (used by `updateArticleSeo`).

`server/modules/articles/routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { ArticleIdParam, ArticleListQuery, ArticleSeoPatch, DraftInput, NewArticleInput } from "./schema"
import * as service from "./service"

const read = can({ article: ["read"] })
const update = can({ article: ["update"] })
const id = zValidator("param", ArticleIdParam, validationHook)

export const articlesRoutes = new Hono<AppEnv>()
  .get("/", read, zValidator("query", ArticleListQuery, validationHook), async (c) =>
    c.json(await service.listArticles(c.req.valid("query"))))
  .post("/", can({ article: ["create"] }), zValidator("json", NewArticleInput, validationHook), async (c) =>
    c.json(await service.createArticle(c.get("actor")!, c.req.valid("json")), 201))
  .get("/:id", read, id, async (c) => c.json(await service.getArticle(c.get("actor")!, c.req.valid("param").id)))
  .patch("/:id/draft", update, id, zValidator("json", DraftInput, validationHook), async (c) =>
    c.json(await service.saveArticleDraft(c.get("actor")!, c.req.valid("param").id, c.req.valid("json"))))
  // seo.update decided in the service, like pages.
  .patch("/:id/seo", read, id, zValidator("json", ArticleSeoPatch, validationHook), async (c) =>
    c.json(await service.updateArticleSeo(c.get("actor")!, c.req.valid("param").id, c.req.valid("json"))))
  .post("/:id/submit", update, id, async (c) =>
    c.json(await service.submitForReview(c.get("actor")!, c.req.valid("param").id)))
  .delete("/:id", can({ article: ["delete"] }), id, async (c) =>
    c.json(await service.deleteArticle(c.get("actor")!, c.req.valid("param").id)))

export type ArticlesRoutes = typeof articlesRoutes
```

Mount `.route("/articles", articlesRoutes)` in `server/api/routes/admin.ts` (before `/categories`); add `export const articlesApi = hc<ArticlesRoutes>("/api/v1/admin/articles")` to `admin/lib/api.ts`.

- [ ] **Step 5: ⌘K source and limiter**

`server/lib/rate-limit.ts`:

```ts
import "server-only"

// Fixed window per key, in memory: right for the single replica (docs/brief.md
// §5.6 rule 8). Public endpoints get the database-backed limiter in Phase 6.
const windows = new Map<string, { count: number; resetAt: number }>()

export function takeToken(key: string, { limit, windowMs }: { limit: number; windowMs: number }, now = Date.now()) {
  const current = windows.get(key)
  if (!current || current.resetAt <= now) {
    if (windows.size > 5000) for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k)
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (current.count >= limit) return false
  current.count++
  return true
}
```

`server/modules/search/service.ts`: change `kind: "page"` in `SearchHit` to `kind: "page" | "article"` and update the comment ("Navigation and articles; enquiries and media join in later phases").

`server/modules/search/routes.ts` handler becomes:

```ts
  async (c) => {
    const actor = c.get("actor")!
    // DB-backed since Phase 5 (Ruling R7): closes the Phase 2 limiter carry.
    if (!takeToken(`search:${actor.userId}`, { limit: 30, windowMs: 10_000 })) {
      throw new ApiError("RATE_LIMITED", "Too many searches. Wait a moment and try again.")
    }
    const { q } = c.req.valid("query")
    const articles = hasPermission(actor.roles, { article: ["read"] }) ? await searchArticleHits(q) : []
    return c.json({ items: [...searchNavigation(actor.roles, q), ...articles] })
  }
```

(imports: `ApiError` from `@/server/api/errors`, `hasPermission` from `@/lib/auth/permissions`, `takeToken` from `@/server/lib/rate-limit`, `searchArticleHits` from `@/server/modules/articles/service`.) The palette lists hits as they come; if `admin/components/command/command-palette.tsx` switches on `kind`, add an `"article"` case using lucide's `NewspaperIcon` under a group heading "Articles".

- [ ] **Step 6: Run tests and gates**

Run: `pnpm vitest run --project unit server admin/components/command && pnpm test:integration tests/integration/api/articles.test.ts tests/integration/api/search.test.ts tests/integration/api/permission-matrix.test.ts && pnpm lint && pnpm typecheck`
Expected: PASS. If `permission-matrix.test.ts` enumerates admin routes, add the new `/articles`, `/categories`, `/authors` rows the way its existing rows are written.

- [ ] **Step 7: Commit**

```bash
git add server/modules/articles server/modules/search server/lib/rate-limit.ts server/lib/rate-limit.test.ts server/api/routes/admin.ts admin/lib/api.ts admin/components/command tests/integration/api
git commit -m "feat(insights): articles API with author ownership and full-text search"
```

---

### Task 4: Publishing lifecycle, revisions and automatic redirects

**Files:**
- Create: `server/modules/articles/publish.ts`, `server/modules/redirects/service.ts`
- Modify: `server/modules/articles/service.ts`, `server/modules/articles/routes.ts`
- Test: `tests/integration/api/articles-publish.test.ts`

**Interfaces:**
- Consumes: Task 3 (`findArticle`, `writeIfVersion`, `draftOf`, `articleTags`, `assertCanEdit`, `canPublish`), `writeRevision`/`listRevisions`/`findRevision`, `assertMediaExists`, `isUniqueViolation`.
- Produces:
  - `publish.ts`: `articlePath(slug)`, `parseContent(draft)`, `publishLocked(tx, row, actor: Actor | null): Promise<{ row: ArticleRow; slugChanged: boolean }>` (used by the scheduler).
  - `redirects/service.ts`: `releasePath(db, path)`, `recordSlugChange(db, { articleId, from, to, createdBy })`, `createRedirect(db, { from, to, articleId, note, createdBy })`.
  - Service: `publishArticle(actor, id, version)`, `scheduleArticle(actor, id, { version, at })`, `unpublishArticle(actor, id, { version, archive, redirectTo })`, `articleRevisions(id)`, `restoreArticleRevision(actor, id, rev, version)`.
  - Routes: `POST /:id/publish` `{ version }` → `{ version, publishedAt, slug }`; `POST /:id/schedule` `{ version, at }` → `{ version, scheduledFor }`; `POST /:id/unpublish` `{ version, archive?, redirectTo? }` → `{ version, status }`; `GET /:id/revisions` → `{ items }`; `POST /:id/revisions/:rev/restore` `{ version }` → `{ version }`.

- [ ] **Step 1: Write the failing tests**

`tests/integration/api/articles-publish.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag }))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { articles, redirects, revisions } from "@/server/db/schema"
import { findArticleBySlug } from "@/server/modules/content/repo"

import { content, insertArticle, insertTaxonomy } from "../helpers/articles"
import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => { await resetDb(); next.revalidateTag.mockReset() })
afterAll(closeDb)
const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const json = (r: Response) => r.json()
const post = (cookie: string, path: string, body: object) => adminRequest(path, cookie, { method: "POST", body })

// A drafted article ready to publish, written by `cookie`.
async function drafted(cookie: string, overrides: Record<string, unknown> = {}) {
  const refs = await insertTaxonomy(Math.random().toString(36).slice(2, 8))
  const { id } = await json(await post(cookie, "/articles", { title: "Calm", categoryId: refs.category.id, authorId: refs.author.id }))
  const draft = content({ categoryId: refs.category.id, authorId: refs.author.id, coverId: refs.media.id }, overrides)
  const { version } = await json(await adminRequest(`/articles/${id}/draft`, cookie, { method: "PATCH", body: { version: 1, draft } }))
  return { id, version, draft, refs }
}
async function rename(cookie: string, id: string, version: number, draft: object, slug: string) {
  const saved = await json(await adminRequest(`/articles/${id}/draft`, cookie, { method: "PATCH", body: { version, draft: { ...draft, slug } } }))
  return json(await post(cookie, `/articles/${id}/publish`, { version: saved.version }))
}
const redirectMap = async () => Object.fromEntries((await getDb().select().from(redirects)).map((r) => [r.sourcePath, r.destination]))

// docs/brief.md §7.2: [publish, schedule, unpublish]
const MATRIX: Record<RoleName, number> = { owner: 200, admin: 200, editor: 200, author: 403, marketer: 403, intake: 403, viewer: 403 }

describe.each(ROLE_NAMES)("publishing RBAC for %s", (role) => {
  it(`publish, schedule, unpublish → ${MATRIX[role]}`, async () => {
    const editor = await cookieFor("editor", "setup-editor@example.com")
    const { id, version } = await drafted(editor)
    const cookie = await cookieFor(role)
    expect((await post(cookie, `/articles/${id}/schedule`, { version, at: new Date(Date.now() + 3_600_000).toISOString() })).status)
      .toBe(MATRIX[role])
    const v = (await getDb().select().from(articles).where(eq(articles.id, id)))[0]!.version
    expect((await post(cookie, `/articles/${id}/unpublish`, { version: v })).status).toBe(MATRIX[role])
    const v2 = (await getDb().select().from(articles).where(eq(articles.id, id)))[0]!.version
    expect((await post(cookie, `/articles/${id}/publish`, { version: v2 })).status).toBe(MATRIX[role]) }) })

describe("publishing", () => {
  it("copies the draft into the typed columns, snapshots it and expires the public tags", async () => {
    const editor = await cookieFor("editor")
    const { id, version } = await drafted(editor)
    const res = await post(editor, `/articles/${id}/publish`, { version })
    expect(res.status).toBe(200)
    const [row] = await getDb().select().from(articles).where(eq(articles.id, id))
    expect(row).toMatchObject({ status: "published", slug: "calm-test", excerpt: "Short excerpt.", readingMinutes: 1,
      bodyText: "A calm lead paragraph." })
    expect(row!.publishedAt).not.toBeNull()
    expect(await getDb().select().from(revisions).where(eq(revisions.entityId, id))).toHaveLength(1)
    expect(expired()).toEqual(["articles", `article:${id}`])
    expect((await findArticleBySlug("calm-test"))?.title).toBe("Calm is a skill") })

  it("refuses an incomplete draft with field errors", async () => {
    const editor = await cookieFor("editor")
    const { id, version } = await drafted(editor, { excerpt: "", cover: null })
    const res = await post(editor, `/articles/${id}/publish`, { version })
    expect(res.status).toBe(400)
    expect(Object.keys((await json(res)).error.fieldErrors)).toEqual(expect.arrayContaining(["excerpt", "cover"])) })

  it("keeps a single featured article", async () => {
    const editor = await cookieFor("editor")
    const a = await drafted(editor, { featured: true, slug: "first" })
    await post(editor, `/articles/${a.id}/publish`, { version: a.version })
    const b = await drafted(editor, { featured: true, slug: "second" })
    await post(editor, `/articles/${b.id}/publish`, { version: b.version })
    const featured = await getDb().select({ slug: articles.slug }).from(articles).where(eq(articles.featured, true))
    expect(featured).toEqual([{ slug: "second" }]) })

  it("409s a slug another article holds", async () => {
    const editor = await cookieFor("editor")
    const a = await drafted(editor, { slug: "taken" })
    await post(editor, `/articles/${a.id}/publish`, { version: a.version })
    const b = await drafted(editor, { slug: "taken" })
    expect((await post(editor, `/articles/${b.id}/publish`, { version: b.version })).status).toBe(409) })

  it("slug renames flatten chains, never loop, and reclaim paths (Review Focus 1)", async () => {
    const editor = await cookieFor("editor")
    const { id, version, draft } = await drafted(editor, { slug: "alpha" })
    let v = (await json(await post(editor, `/articles/${id}/publish`, { version }))).version
    // First publish under a never-live slug makes no redirect.
    expect(await redirectMap()).toEqual({})
    v = (await rename(editor, id, v, draft, "beta")).version
    expect(expired()).toContain("redirects")
    v = (await rename(editor, id, v, draft, "gamma")).version
    expect(await redirectMap()).toEqual({ "/insights/alpha": "/insights/gamma", "/insights/beta": "/insights/gamma" })
    v = (await rename(editor, id, v, draft, "alpha")).version
    expect(await redirectMap()).toEqual({ "/insights/beta": "/insights/alpha", "/insights/gamma": "/insights/alpha" })
    // Another article published at a redirected path takes it back.
    const other = await drafted(editor, { slug: "beta" })
    await post(editor, `/articles/${other.id}/publish`, { version: other.version })
    expect(await redirectMap()).toEqual({ "/insights/gamma": "/insights/alpha" }) })

  it("republishing keeps the original date (Ruling R6)", async () => {
    const editor = await cookieFor("editor")
    const { id, version, draft } = await drafted(editor)
    const first = await json(await post(editor, `/articles/${id}/publish`, { version }))
    const again = await rename(editor, id, first.version, draft, "calm-test")
    expect(again.publishedAt).toBe(first.publishedAt) }) })

describe("scheduling and unpublishing", () => {
  it("schedules only a valid draft in the future", async () => {
    const editor = await cookieFor("editor")
    const { id, version } = await drafted(editor)
    const past = await post(editor, `/articles/${id}/schedule`, { version, at: new Date(Date.now() - 60_000).toISOString() })
    expect(past.status).toBe(400)
    expect((await json(past)).error.fieldErrors).toHaveProperty("at")
    const at = new Date(Date.now() + 3_600_000).toISOString()
    const ok = await json(await post(editor, `/articles/${id}/schedule`, { version, at }))
    expect(new Date(ok.scheduledFor).toISOString()).toBe(at)
    const [row] = await getDb().select().from(articles).where(eq(articles.id, id))
    expect(row!.status).toBe("scheduled")
    expect(expired()).toEqual([]) })

  it("will not schedule a live article (Ruling R5)", async () => {
    const editor = await cookieFor("editor")
    const { id, version } = await drafted(editor)
    const { version: v } = await json(await post(editor, `/articles/${id}/publish`, { version }))
    const res = await post(editor, `/articles/${id}/schedule`, { version: v, at: new Date(Date.now() + 3_600_000).toISOString() })
    expect(res.status).toBe(400) })

  it("unpublishes with a redirect to /insights, and archives", async () => {
    const editor = await cookieFor("editor")
    const { id, version } = await drafted(editor)
    const { version: v } = await json(await post(editor, `/articles/${id}/publish`, { version }))
    next.revalidateTag.mockReset()
    const res = await json(await post(editor, `/articles/${id}/unpublish`, { version: v, redirectTo: "/insights" }))
    expect(res.status).toBe("draft")
    expect(await redirectMap()).toEqual({ "/insights/calm-test": "/insights" })
    expect(expired()).toEqual(["articles", `article:${id}`, "redirects"])
    expect(await findArticleBySlug("calm-test")).toBeNull()
    const { version: v2 } = await json(await post(editor, `/articles/${id}/publish`, { version: res.version }))
    expect(await redirectMap()).toEqual({}) // live again: the path is reclaimed
    const archived = await json(await post(editor, `/articles/${id}/unpublish`, { version: v2, archive: true }))
    expect(archived.status).toBe("archived") })

  it("refuses a redirect to an article that is not live", async () => {
    const editor = await cookieFor("editor")
    const { id, version } = await drafted(editor)
    const { version: v } = await json(await post(editor, `/articles/${id}/publish`, { version }))
    expect((await post(editor, `/articles/${id}/unpublish`, { version: v, redirectTo: "/insights/nowhere" })).status).toBe(400) }) })

describe("revisions", () => {
  it("lists one snapshot per publish and restores one into the draft", async () => {
    const editor = await cookieFor("editor")
    const { id, version, draft } = await drafted(editor)
    const first = await json(await post(editor, `/articles/${id}/publish`, { version }))
    const second = await rename(editor, id, first.version, { ...draft, title: "Second title" }, "calm-test")
    const { items } = await json(await adminRequest(`/articles/${id}/revisions`, editor))
    expect(items).toHaveLength(2)
    const oldest = items.at(-1)
    const restored = await post(editor, `/articles/${id}/revisions/${oldest.id}/restore`, { version: second.version })
    expect(restored.status).toBe(200)
    const got = await json(await adminRequest(`/articles/${id}`, editor))
    expect(got.draft.title).toBe("Calm is a skill")
    expect(got.hasUnpublishedChanges).toBe(true) }) })
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:integration tests/integration/api/articles-publish.test.ts`
Expected: FAIL (`/publish`, `/schedule`, `/unpublish`, `/revisions` 404).

- [ ] **Step 3: Redirect writes**

`server/modules/redirects/service.ts`:

```ts
import "server-only"

import { eq } from "drizzle-orm"

import type { DbLike } from "@/server/db/client"
import { redirects } from "@/server/db/schema"

// A path that is live again must not redirect away (Review Focus 1).
export async function releasePath(db: DbLike, path: string) {
  await db.delete(redirects).where(eq(redirects.sourcePath, path))
}

export async function createRedirect(db: DbLike, entry: { from: string; to: string; articleId: string | null;
  note: string; createdBy: string | null }
) {
  if (entry.from === entry.to) return
  await db.insert(redirects).values({ sourcePath: entry.from, destination: entry.to, statusCode: 301,
    articleId: entry.articleId, note: entry.note, createdBy: entry.createdBy })
    .onConflictDoUpdate({ target: redirects.sourcePath,
      set: { destination: entry.to, statusCode: 301, isActive: true, articleId: entry.articleId, note: entry.note } })
}

// docs/brief.md §11: "created automatically when a slug changes". Order
// matters: free the new path first, then point every chain that ended at the
// old path straight at the new one, then add old → new.
export async function recordSlugChange(db: DbLike, change: { articleId: string; from: string; to: string;
  createdBy: string | null }
) {
  if (change.from === change.to) return
  await releasePath(db, change.to)
  await db.update(redirects).set({ destination: change.to }).where(eq(redirects.destination, change.from))
  await createRedirect(db, { from: change.from, to: change.to, articleId: change.articleId,
    note: "Automatic: the article's slug changed", createdBy: change.createdBy })
}
```

- [ ] **Step 4: Publish, schedule, unpublish, revisions**

`server/modules/articles/publish.ts`:

```ts
import "server-only"

import { and, eq, ne, sql } from "drizzle-orm"

import { collectMediaIds } from "@/blocks/media-refs"
import { ArticleContent } from "@/lib/content/article"
import { plainText, readingMinutes } from "@/lib/content/reading-time"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import type { Tx } from "@/server/db/client"
import { articleCategories, articles, authors } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { isUniqueViolation } from "@/server/lib/conflict"
import { writeRevision } from "@/server/lib/revisions"
import { assertMediaExists } from "@/server/modules/media/assert-media"
import { recordSlugChange, releasePath } from "@/server/modules/redirects/service"

import type { ArticleRow } from "./service"

export const articlePath = (slug: string) => `/insights/${slug}`
const slugTaken = () => new ApiError("CONFLICT", "Another article already uses that slug", { slug: ["Already used"] })

export function parseContent(draft: unknown) {
  const parsed = ArticleContent.safeParse(draft)
  if (!parsed.success) throw invalid(parsed.error, "Fix the highlighted fields before publishing")
  return parsed.data
}

async function assertRefs(tx: Tx, c: ArticleContent, id: string) {
  await assertMediaExists(tx, collectMediaIds({ cover: c.cover, body: c.body }))
  const [cat] = await tx.select({ id: articleCategories.id }).from(articleCategories).where(eq(articleCategories.id, c.categoryId))
  const [author] = await tx.select({ id: authors.id }).from(authors).where(eq(authors.id, c.authorId))
  const fieldErrors: Record<string, string[]> = {}
  if (!cat) fieldErrors.categoryId = ["That category no longer exists"]
  if (!author) fieldErrors.authorId = ["That author no longer exists"]
  if (Object.keys(fieldErrors).length) throw new ApiError("VALIDATION_FAILED", "Fix the highlighted fields before publishing", fieldErrors)
  const [holder] = await tx.select({ id: articles.id }).from(articles).where(and(eq(articles.slug, c.slug), ne(articles.id, id)))
  if (holder) throw slugTaken()
}

// The one publish path: the API (actor) and the scheduler (null). Runs in
// the caller's transaction on a row it has locked; the caller invalidates.
export async function publishLocked(tx: Tx, row: ArticleRow, actor: Actor | null) {
  const content = parseContent(row.draft ?? null)
  await assertRefs(tx, content, row.id)
  const by = actor?.userId ?? row.scheduledBy
  // Only a slug readers have seen needs a redirect.
  const slugChanged = row.publishedAt !== null && row.slug !== content.slug
  if (content.featured) {
    await tx.update(articles).set({ featured: false }).where(and(eq(articles.featured, true), ne(articles.id, row.id)))
  }
  const text = plainText(content.body)
  let next: ArticleRow | undefined
  try {
    ;[next] = await tx.update(articles).set({
      slug: content.slug, title: content.title, excerpt: content.excerpt, coverId: content.cover.mediaId,
      categoryId: content.categoryId, authorId: content.authorId, featured: content.featured, body: content.body,
      bodyText: text, readingMinutes: readingMinutes(text), draft: content, status: "published",
      publishedAt: row.publishedAt ?? new Date(), scheduledFor: null, scheduledBy: null,
      reviewRequestedAt: null, reviewRequestedBy: null, updatedBy: by, version: sql`${articles.version} + 1`,
    }).where(eq(articles.id, row.id)).returning()
  } catch (error) {
    if (isUniqueViolation(error)) throw slugTaken()
    throw error
  }
  await releasePath(tx, articlePath(content.slug))
  if (slugChanged) {
    await recordSlugChange(tx, { articleId: row.id, from: articlePath(row.slug), to: articlePath(content.slug), createdBy: by })
  }
  await writeRevision(tx, { entityType: "article", entityId: row.id, version: next!.version, snapshot: content,
    createdBy: by ?? null })
  await audit(actor, { action: "article.publish", entityType: "article", entityId: row.id,
    summary: actor ? `Published “${content.title}”` : `Published “${content.title}” on schedule`,
    diff: slugChanged ? { slug: { from: row.slug, to: content.slug } } : null }, tx)
  return { row: next!, slugChanged }
}
```

`writeRevision`'s `createdBy` is typed `string`; widen it to `string | null` in `server/lib/revisions.ts` (the column is nullable).

Append to `server/modules/articles/service.ts` (merge imports: `listRevisions`, `findRevision` from revisions; `ScheduleInput`-shaped types inline; `publishLocked`, `parseContent`, `articlePath` from `./publish`; `createRedirect` from `@/server/modules/redirects/service`):

```ts
export async function publishArticle(actor: Actor, id: string, version: number) {
  const { row, slugChanged } = await getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    if (row.version !== version) throw await conflictError(tx, row)
    return publishLocked(tx, row, actor)
  })
  invalidate(articleTags(id, slugChanged ? [tags.redirects] : []))
  return { version: row.version, publishedAt: row.publishedAt, slug: row.slug }
}

export async function scheduleArticle(actor: Actor, id: string, input: { version: number; at: string }) {
  const at = new Date(input.at)
  if (at.getTime() <= Date.now() + 30_000) {
    throw new ApiError("VALIDATION_FAILED", "Pick a time in the future", { at: ["Pick a time at least a minute ahead"] })
  }
  return getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    if (row.version !== input.version) throw await conflictError(tx, row)
    if (row.status !== "draft" && row.status !== "archived") {
      throw new ApiError("BAD_REQUEST", "This article is live or already scheduled. Publish the changes instead.")
    }
    // Validate now so the tick rarely meets a broken draft (Ruling R5).
    const content = parseContent(row.draft ?? null)
    const saved = await writeIfVersion(tx, id, input.version, { status: "scheduled", scheduledFor: at,
      scheduledBy: actor.userId, updatedBy: actor.userId })
    await audit(actor, { action: "article.schedule", entityType: "article", entityId: id,
      summary: `Scheduled “${content.title}” for ${at.toISOString()}` }, tx)
    return { version: saved.version, scheduledFor: saved.scheduledFor }
  })
}

export async function unpublishArticle(actor: Actor, id: string,
  input: { version: number; archive: boolean; redirectTo: string | null }
) {
  const result = await getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    if (row.version !== input.version) throw await conflictError(tx, row)
    const wasLive = row.status === "published"
    if (!wasLive && row.status !== "scheduled") throw new ApiError("BAD_REQUEST", "This article isn't published or scheduled")
    const status = input.archive ? ("archived" as const) : ("draft" as const)
    let redirected = false
    if (wasLive && input.redirectTo) {
      const from = articlePath(row.slug)
      if (input.redirectTo === from) throw new ApiError("VALIDATION_FAILED", "Choose another page", { redirectTo: ["That is this article"] })
      if (input.redirectTo !== "/insights") {
        const [target] = await tx.select({ id: articles.id }).from(articles)
          .where(and(eq(articles.slug, input.redirectTo.slice("/insights/".length)), eq(articles.status, "published")))
        if (!target) throw new ApiError("VALIDATION_FAILED", "Choose a published article", { redirectTo: ["That article isn't live"] })
      }
      await createRedirect(tx, { from, to: input.redirectTo, articleId: id, note: "Automatic: the article was unpublished",
        createdBy: actor.userId })
      redirected = true
    }
    const saved = await writeIfVersion(tx, id, input.version, { status, scheduledFor: null, scheduledBy: null,
      updatedBy: actor.userId })
    await audit(actor, { action: input.archive ? "article.archive" : "article.unpublish", entityType: "article",
      entityId: id, summary: `${input.archive ? "Archived" : "Unpublished"} “${row.title}”` }, tx)
    return { version: saved.version, status, wasLive, redirected }
  })
  if (result.wasLive) invalidate(articleTags(id, result.redirected ? [tags.redirects] : []))
  return { version: result.version, status: result.status }
}

export const articleRevisions = (id: string) => listRevisions(getDb(), "article", id)

export async function restoreArticleRevision(actor: Actor, id: string, revisionId: string, version: number) {
  return getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    await assertCanEdit(tx, actor, row, draftOf(row).authorId)
    const revision = await findRevision(tx, "article", id, revisionId)
    if (!revision) throw new ApiError("NOT_FOUND", "That version doesn't exist")
    const saved = await writeIfVersion(tx, id, version, { draft: revision.snapshot as ArticleDraft, updatedBy: actor.userId })
    await audit(actor, { action: "article.restore", entityType: "article", entityId: id,
      summary: `Loaded version ${revision.version} of “${row.title}” into the draft` }, tx)
    return { version: saved.version }
  })
}
```

Insert into the route chain in `server/modules/articles/routes.ts`, after `.post("/:id/submit", …)` (add `ArticleRevisionParam`, `ScheduleInput`, `UnpublishInput`, `VersionInput` to the schema import):

```ts
  .post("/:id/publish", can({ article: ["publish"] }), id, zValidator("json", VersionInput, validationHook), async (c) =>
    c.json(await service.publishArticle(c.get("actor")!, c.req.valid("param").id, c.req.valid("json").version)))
  .post("/:id/schedule", can({ article: ["publish"] }), id, zValidator("json", ScheduleInput, validationHook), async (c) =>
    c.json(await service.scheduleArticle(c.get("actor")!, c.req.valid("param").id, c.req.valid("json"))))
  .post("/:id/unpublish", can({ article: ["publish"] }), id, zValidator("json", UnpublishInput, validationHook), async (c) =>
    c.json(await service.unpublishArticle(c.get("actor")!, c.req.valid("param").id, c.req.valid("json"))))
  .get("/:id/revisions", read, id, async (c) => c.json(await service.articleRevisions(c.req.valid("param").id)))
  .post("/:id/revisions/:rev/restore", update, zValidator("param", ArticleRevisionParam, validationHook),
    zValidator("json", VersionInput, validationHook), async (c) => {
      const { id: articleId, rev } = c.req.valid("param")
      return c.json(await service.restoreArticleRevision(c.get("actor")!, articleId, rev, c.req.valid("json").version))
    })
```

- [ ] **Step 5: Run tests and gates**

Run: `pnpm test:integration tests/integration/api/articles-publish.test.ts tests/integration/api/articles.test.ts tests/integration/api/pages.test.ts && pnpm lint && pnpm typecheck`
Expected: PASS. `pages.test.ts` guards the `writeRevision` signature change.

- [ ] **Step 6: Commit**

```bash
git add server/modules/articles server/modules/redirects server/lib/revisions.ts tests/integration/api/articles-publish.test.ts
git commit -m "feat(insights): publish, schedule, unpublish, revisions and automatic redirects"
```

---

### Task 5: Scheduler — cron tick and instrumentation

**Files:**
- Create: `server/api/middleware/cron.ts`, `server/modules/scheduler/service.ts`, `server/modules/scheduler/routes.ts`, `instrumentation.ts`, `instrumentation.node.ts`, `lib/internal-origin.ts`
- Modify: `server/api/app.ts`
- Test: `tests/integration/api/cron.test.ts`, `instrumentation.node.test.ts`

**Interfaces:**
- Consumes: `publishLocked`, `articleTags`, `ArticleRow` (Task 4), `audit`, `invalidate`, `getEnv().CRON_SECRET`.
- Produces:
  - `POST /api/v1/cron/tick` (bearer `CRON_SECRET`) → `{ skipped: boolean; published: string[]; failed: string[] }`.
  - `runTick(now?: Date)`, `TICK_LOCK_KEY`.
  - `internalOrigin(): string` (`INTERNAL_ORIGIN` or `http://127.0.0.1:${PORT ?? 3000}`), `startScheduler(): void`.

- [ ] **Step 1: Write the failing tests**

`tests/integration/api/cron.test.ts`:

```ts
import { eq, sql } from "drizzle-orm"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag }))

import { app } from "@/server/api/app"
import { closeDb, getDb } from "@/server/db/client"
import { articles, auditLogs } from "@/server/db/schema"
import { findArticleBySlug } from "@/server/modules/content/repo"
import { TICK_LOCK_KEY } from "@/server/modules/scheduler/service"

import { content, insertTaxonomy } from "../helpers/articles"
import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => { await resetDb(); next.revalidateTag.mockReset() })
afterEach(() => vi.useRealTimers())
afterAll(closeDb)
const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const tick = (secret = process.env.CRON_SECRET) =>
  app.request("/api/v1/cron/tick", { method: "POST", headers: secret ? { authorization: `Bearer ${secret}` } : {} })

async function scheduled(cookie: string, minutesAhead: number, overrides: Record<string, unknown> = {}) {
  const refs = await insertTaxonomy(Math.random().toString(36).slice(2, 8))
  const created = await (await adminRequest("/articles", cookie, { method: "POST",
    body: { title: "Later", categoryId: refs.category.id, authorId: refs.author.id } })).json()
  const draft = content({ categoryId: refs.category.id, authorId: refs.author.id, coverId: refs.media.id }, overrides)
  const { version } = await (await adminRequest(`/articles/${created.id}/draft`, cookie, { method: "PATCH",
    body: { version: 1, draft } })).json()
  const at = new Date(Date.now() + minutesAhead * 60_000).toISOString()
  const res = await adminRequest(`/articles/${created.id}/schedule`, cookie, { method: "POST", body: { version, at } })
  expect(res.status).toBe(200)
  return created.id as string
}

describe("cron tick", () => {
  it("refuses a missing or wrong secret", async () => {
    expect((await tick("")).status).toBe(401)
    expect((await tick("nope-nope-nope-nope-nope-nope-nope-nope")).status).toBe(401) })

  // Acceptance: an article scheduled 2 minutes ahead appears after the tick.
  it("publishes an article scheduled 2 minutes ahead once its time has come", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date() })
    const cookie = await cookieFor("editor")
    const id = await scheduled(cookie, 2, { slug: "later-today" })
    expect(await (await tick()).json()).toEqual({ skipped: false, published: [], failed: [] })
    expect(await findArticleBySlug("later-today")).toBeNull()
    vi.setSystemTime(new Date(Date.now() + 2 * 60_000 + 1_000))
    expect(await (await tick()).json()).toEqual({ skipped: false, published: [id], failed: [] })
    expect(expired()).toEqual(["articles", `article:${id}`])
    expect((await findArticleBySlug("later-today"))?.title).toBe("Calm is a skill")
    const [entry] = await getDb().select().from(auditLogs).where(eq(auditLogs.action, "article.publish"))
    expect(entry).toMatchObject({ actorId: null, summary: "Published “Calm is a skill” on schedule" }) })

  it("does nothing while another tick holds the lock (Review Focus 4)", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date() })
    await scheduled(await cookieFor("editor"), 2)
    vi.setSystemTime(new Date(Date.now() + 3 * 60_000))
    await getDb().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${TICK_LOCK_KEY})`)
      expect(await (await tick()).json()).toEqual({ skipped: true, published: [], failed: [] })
    })
    expect((await (await tick()).json()).published).toHaveLength(1) })

  it("returns a broken scheduled draft to draft and still publishes the rest (Ruling R5)", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date() })
    const cookie = await cookieFor("editor")
    const broken = await scheduled(cookie, 2, { slug: "broken" })
    const fine = await scheduled(cookie, 2, { slug: "fine" })
    await getDb().update(articles).set({ draft: sql`jsonb_set(draft, '{excerpt}', '""')` }).where(eq(articles.id, broken))
    vi.setSystemTime(new Date(Date.now() + 3 * 60_000))
    expect(await (await tick()).json()).toEqual({ skipped: false, published: [fine], failed: [broken] })
    const [row] = await getDb().select().from(articles).where(eq(articles.id, broken))
    expect(row).toMatchObject({ status: "draft", scheduledFor: null })
    expect(await getDb().select().from(auditLogs).where(eq(auditLogs.action, "article.schedule_failed"))).toHaveLength(1)
    expect((await (await tick()).json()).failed).toEqual([]) }) })
```

`instrumentation.node.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { startScheduler } from "./instrumentation.node"

const g = globalThis as { __mkScheduler?: ReturnType<typeof setInterval> }

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn(async () => new Response("{}"))) })
afterEach(() => { if (g.__mkScheduler) clearInterval(g.__mkScheduler); delete g.__mkScheduler
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("startScheduler", () => {
  it("posts the tick every 60 s with the bearer secret, once per process", async () => {
    vi.stubEnv("CRON_SECRET", "s".repeat(32)); vi.stubEnv("PORT", "4000")
    startScheduler(); startScheduler()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:4000/api/v1/cron/tick",
      expect.objectContaining({ method: "POST", headers: { authorization: `Bearer ${"s".repeat(32)}` } })) })
  // TEST_ENV sets CRON_SECRET, so "no secret" blanks it explicitly.
  it.each([["no secret", { CRON_SECRET: "" }], ["SCHEDULER=off", { CRON_SECRET: "s".repeat(32), SCHEDULER: "off" }]])(
    "stays off with %s", async (_, env) => {
      for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string)
      vi.spyOn(console, "warn").mockImplementation(() => {})
      startScheduler()
      await vi.advanceTimersByTimeAsync(120_000)
      expect(fetch).not.toHaveBeenCalled() }) })
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run --project unit instrumentation.node.test.ts && pnpm test:integration tests/integration/api/cron.test.ts`
Expected: FAIL (modules missing; `/cron/tick` 404).

- [ ] **Step 3: Tick route and service**

`server/api/middleware/cron.ts`:

```ts
import "server-only"

import { createHash, timingSafeEqual } from "node:crypto"
import { createMiddleware } from "hono/factory"

import { ApiError } from "@/server/api/errors"
import type { AppEnv } from "@/server/api/types"
import { getEnv } from "@/server/env"

const digest = (value: string) => createHash("sha256").update(value).digest()

// docs/brief.md §8.1: /v1/cron/* → bearer CRON_SECRET. Hashing first makes
// the comparison constant-time whatever the lengths.
export const cronAuth = createMiddleware<AppEnv>(async (c, next) => {
  const secret = getEnv().CRON_SECRET
  const given = c.req.header("authorization")?.replace(/^Bearer /, "") ?? ""
  if (!secret || !timingSafeEqual(digest(given), digest(secret))) {
    throw new ApiError("UNAUTHENTICATED", "Invalid cron credentials")
  }
  await next()
})
```

`server/modules/scheduler/service.ts`:

```ts
import "server-only"

import { and, asc, eq, lte, sql } from "drizzle-orm"

import { getDb } from "@/server/db/client"
import { articles } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { publishLocked } from "@/server/modules/articles/publish"
import { articleTags } from "@/server/modules/articles/service"

// pg advisory lock key for the tick ("mkti").
export const TICK_LOCK_KEY = 0x6d6b7469

// docs/brief.md §5.5(f). One transaction holds the lock; each article
// publishes in its own savepoint so one broken draft cannot block the rest.
// Retention purges (Phase 6) join here.
export async function runTick(now = new Date()) {
  const toExpire: string[] = []
  const result = await getDb().transaction(async (tx) => {
    const { rows } = await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(${TICK_LOCK_KEY}) as locked`)
    if (!rows[0]?.locked) return { skipped: true, published: [] as string[], failed: [] as string[] }
    const due = await tx.select().from(articles)
      .where(and(eq(articles.status, "scheduled"), lte(articles.scheduledFor, now)))
      .orderBy(asc(articles.scheduledFor)).for("update", { skipLocked: true })
    const published: string[] = []
    const failed: string[] = []
    for (const row of due) {
      try {
        const { slugChanged } = await tx.transaction((sp) => publishLocked(sp, row, null))
        published.push(row.id)
        toExpire.push(...articleTags(row.id, slugChanged ? [tags.redirects] : []))
      } catch (error) {
        // Ruling R5: back to draft so it is fixed by a person, not retried.
        console.error(`[scheduler] article ${row.id} could not be published`, error)
        await tx.update(articles).set({ status: "draft", scheduledFor: null, scheduledBy: null }).where(eq(articles.id, row.id))
        await audit(null, { action: "article.schedule_failed", entityType: "article", entityId: row.id,
          summary: `“${row.title}” was not published on schedule: its draft has errors` }, tx)
        failed.push(row.id)
      }
    }
    return { skipped: false, published, failed }
  })
  if (toExpire.length) invalidate(toExpire)
  return result
}
```

`server/modules/scheduler/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { cronAuth } from "@/server/api/middleware/cron"
import type { AppEnv } from "@/server/api/types"

import { runTick } from "./service"

export const cronRoutes = new Hono<AppEnv>().use(cronAuth).post("/tick", async (c) => c.json(await runTick()))
```

`server/api/app.ts` — chain `.route("/v1/cron", cronRoutes)` after `.route("/v1/health", health)`.

`invalidate()` merges duplicate tags (`new Set`), so publishing several articles expires `articles` once.

- [ ] **Step 4: The 60-second interval**

`lib/internal-origin.ts`:

```ts
// The server talking to itself over loopback (scheduler tick, redirect
// resolver), never through the public proxy. Read at call time: no secrets.
export const internalOrigin = () => process.env.INTERNAL_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`
```

`instrumentation.node.ts`:

```ts
import { internalOrigin } from "./lib/internal-origin"

const INTERVAL_MS = 60_000
const g = globalThis as { __mkScheduler?: ReturnType<typeof setInterval> }

// docs/brief.md §5.5(f): HTTP, so revalidateTag runs in a request context.
// No server modules here: instrumentation is bundled outside the RSC graph.
export function startScheduler() {
  const secret = process.env.CRON_SECRET
  if (process.env.SCHEDULER === "off") return
  if (!secret) { console.warn("[scheduler] CRON_SECRET is not set; scheduled publishing is off"); return }
  if (g.__mkScheduler) return // dev re-registers on reload
  const url = `${internalOrigin()}/api/v1/cron/tick`
  g.__mkScheduler = setInterval(() => {
    fetch(url, { method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(30_000) })
      .then((res) => { if (!res.ok) console.error(`[scheduler] tick answered ${res.status}`) })
      .catch((error: unknown) => console.error("[scheduler] tick failed", error))
  }, INTERVAL_MS)
  g.__mkScheduler.unref?.()
}
```

`instrumentation.ts` (repo root, next to `proxy.ts`; `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`):

```ts
// Called once per server instance, before it takes requests.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  // `next build` has no server to tick (docs/brief.md §5.6).
  if (process.env.NEXT_PHASE === "phase-production-build") return
  const { startScheduler } = await import("./instrumentation.node")
  startScheduler()
}
```

- [ ] **Step 5: Run tests and gates**

Run: `pnpm vitest run --project unit instrumentation.node.test.ts && pnpm test:integration tests/integration/api/cron.test.ts tests/integration/api/health.test.ts && pnpm lint && pnpm typecheck && DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build`
Expected: PASS; the closed-port build still passes (register returns early during the build).

- [ ] **Step 6: Commit**

```bash
git add server/api/middleware/cron.ts server/modules/scheduler server/api/app.ts instrumentation.ts instrumentation.node.ts instrumentation.node.test.ts lib/internal-origin.ts tests/integration/api/cron.test.ts
git commit -m "feat(insights): scheduler tick with advisory lock and instrumentation interval"
```

---

### Task 6: Old-slug 301s — redirect resolver and proxy

> Needs the user's OK on Ruling R1 (Global Constraint amendment) before starting. If refused, stop and report: the fallback is a route-level `permanentRedirect()` that serves 200 + meta refresh, which does not meet the "301" acceptance.

**Files:**
- Create: `server/modules/redirects/queries.ts`, `server/modules/redirects/routes.ts`, `tests/e2e/admin/content/insights-redirect.spec.ts`
- Modify: `server/api/app.ts`, `proxy.ts`, `proxy.test.ts`, `tests/e2e/support/api.ts`
- Test: `tests/integration/api/redirects.test.ts`, `proxy.test.ts`, the E2E spec

**Interfaces:**
- Consumes: `redirects` table, `tags.redirects`, `internalOrigin()` (Task 5), `ARTICLE_PATH_RE` (Task 1).
- Produces:
  - `getRedirectTable(): Promise<Record<string, { destination: string; statusCode: number }>>` (`'use cache'`, tag `redirects`).
  - `GET /api/v1/redirects?path=` → 200 `{ destination, statusCode }` | 204.
  - `proxy.ts` answers `/insights/:slug` with that status and `Location`.
  - E2E helper `createPublishedArticle(request, { slug, title })` → `{ id, version, draft }`.

- [ ] **Step 1: Write the failing tests**

`tests/integration/api/redirects.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

// 'use cache' is inert outside Next; its helpers must be too.
vi.mock("next/cache", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(), cacheLife: vi.fn(), revalidateTag: vi.fn() }))

import { app } from "@/server/api/app"
import { closeDb, getDb } from "@/server/db/client"
import { redirects } from "@/server/db/schema"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)
const resolve = (path: string) => app.request(`/api/v1/redirects?path=${encodeURIComponent(path)}`)

describe("redirect resolver", () => {
  it("answers active rows and nothing else", async () => {
    await getDb().insert(redirects).values([{ sourcePath: "/insights/old", destination: "/insights/new" },
      { sourcePath: "/insights/off", destination: "/insights", isActive: false }])
    const hit = await resolve("/insights/old")
    expect(hit.status).toBe(200)
    expect(await hit.json()).toEqual({ destination: "/insights/new", statusCode: 301 })
    expect((await resolve("/insights/off")).status).toBe(204)
    expect((await resolve("/insights/none")).status).toBe(204) })
  it("rejects paths it does not serve", async () => {
    expect((await resolve("https://evil.example")).status).toBe(400)
    expect((await resolve("/about/../x")).status).toBe(400) }) })
```

Append to `proxy.test.ts` (reuse its `NextRequest` construction helper; add `vi`, `afterEach` imports as needed):

```ts
describe("article redirects (Ruling R1)", () => {
  afterEach(() => vi.unstubAllGlobals())
  const at = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"))
  it("answers a 301 from the resolver for /insights/:slug", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ destination: "/insights/new", statusCode: 301 })))
    const res = await proxy(at("/insights/old"))
    expect(res.status).toBe(301)
    expect(res.headers.get("location")).toBe("http://localhost:3000/insights/new")
    expect(String((fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0]))
      .toBe("http://127.0.0.1:3000/api/v1/redirects?path=%2Finsights%2Fold") })
  it.each([["no match", async () => new Response(null, { status: 204 })],
    ["resolver down", async () => { throw new Error("ECONNREFUSED") }]])("passes through on %s", async (_, impl) => {
    vi.stubGlobal("fetch", vi.fn(impl))
    const res = await proxy(at("/insights/live"))
    expect(res.headers.get("x-middleware-next")).toBe("1") })
  it("never asks for admin or deeper paths", async () => {
    vi.stubGlobal("fetch", vi.fn())
    await proxy(at("/insights/a/b"))
    expect(fetch).not.toHaveBeenCalled() }) })
```

(If `proxy.test.ts` asserts `config.matcher`, update that expectation to include `"/insights/:slug"`.)

`tests/e2e/support/api.ts` — append:

```ts
type Option = { id: string }
// A published article built from seeded taxonomy and media (parity untouched:
// a fresh slug per test).
export async function createPublishedArticle(request: APIRequestContext, { slug, title }: { slug: string; title: string }) {
  const [{ items: cats }, { items: authors }, { items: media }] = await Promise.all([
    api<{ items: Option[] }>(request, "GET", "/categories"), api<{ items: Option[] }>(request, "GET", "/authors"),
    api<{ items: Option[] }>(request, "GET", "/media?type=image")])
  const { id } = await api<{ id: string }>(request, "POST", "/articles", { title, categoryId: cats[0]!.id, authorId: authors[0]!.id })
  const draft = { title, slug, excerpt: "An E2E article.", cover: { mediaId: media[0]!.id }, categoryId: cats[0]!.id,
    authorId: authors[0]!.id, featured: false,
    body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `${title} body.` }] }] } }
  const saved = await api<{ version: number }>(request, "PATCH", `/articles/${id}/draft`, { version: 1, draft })
  const published = await api<{ version: number }>(request, "POST", `/articles/${id}/publish`, { version: saved.version })
  return { id, version: published.version, draft }
}
```

`tests/e2e/admin/content/insights-redirect.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { api, createPublishedArticle } from "../../support/api"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

// Acceptance: the old URL 301s to the new one after a rename.
test("a renamed article's old URL answers 301", async ({ page, request }) => {
  const stamp = Date.now()
  const { id, version, draft } = await createPublishedArticle(request, { slug: `e2e-old-${stamp}`, title: `Rename ${stamp}` })
  const saved = await api<{ version: number }>(request, "PATCH", `/articles/${id}/draft`,
    { version, draft: { ...draft, slug: `e2e-new-${stamp}` } })
  await api(request, "POST", `/articles/${id}/publish`, { version: saved.version })
  const old = await request.get(`/insights/e2e-old-${stamp}`, { maxRedirects: 0 })
  expect(old.status()).toBe(301)
  expect(new URL(old.headers().location!, "http://x").pathname).toBe(`/insights/e2e-new-${stamp}`)
  await page.goto(`/insights/e2e-old-${stamp}`)
  await expect(page).toHaveURL(new RegExp(`/insights/e2e-new-${stamp}$`))
  await expect(page.getByRole("heading", { name: `Rename ${stamp}`, level: 1 })).toBeVisible()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run --project unit proxy.test.ts && pnpm test:integration tests/integration/api/redirects.test.ts`
Expected: FAIL (`/v1/redirects` 404; proxy does not match `/insights/*`).

- [ ] **Step 3: Resolver**

`server/modules/redirects/queries.ts`:

```ts
import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { eq } from "drizzle-orm"

import { getDb } from "@/server/db/client"
import { redirects } from "@/server/db/schema"
import { tags } from "@/server/lib/cache"

// The whole active map is small; one cached entry serves every lookup until a
// write expires `redirects` (docs/brief.md §5.6 tag catalogue).
export async function getRedirectTable() {
  "use cache"
  cacheTag(tags.redirects)
  cacheLife("max")
  const rows = await getDb().select({ source: redirects.sourcePath, destination: redirects.destination,
    statusCode: redirects.statusCode }).from(redirects).where(eq(redirects.isActive, true))
  return Object.fromEntries(rows.map((r) => [r.source, { destination: r.destination, statusCode: r.statusCode }]))
}
```

`server/modules/redirects/routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { PreviewPath } from "@/lib/content/page-path"
import { validationHook } from "@/server/api/errors"
import type { AppEnv } from "@/server/api/types"

import { getRedirectTable } from "./queries"

// Public and read-only: answers only what visiting the URL would reveal.
// Called by proxy.ts over loopback (Ruling R1).
export const redirectsRoutes = new Hono<AppEnv>().get("/",
  zValidator("query", z.object({ path: PreviewPath }), validationHook), async (c) => {
    const hit = (await getRedirectTable())[c.req.valid("query").path]
    return hit ? c.json(hit) : c.body(null, 204)
  })
```

`server/api/app.ts` — chain `.route("/v1/redirects", redirectsRoutes)` after `/v1/cron`.

- [ ] **Step 4: Proxy**

`proxy.ts` — add the import, the helper, the branch at the top of `proxy`, and the matcher entry (the admin branch is unchanged; `proxy` becomes `async`):

```ts
import { internalOrigin } from "@/lib/internal-origin"

// Ruling R1: a renamed article's old URL must answer a real 301, which a
// streamed page cannot. The proxy asks the cached resolver over loopback and
// still never touches the database or server-only modules. Fails open.
const ARTICLE_PATH = /^\/insights\/[^/]+$/

async function articleRedirect(request: NextRequest) {
  try {
    const url = new URL("/api/v1/redirects", internalOrigin())
    url.searchParams.set("path", request.nextUrl.pathname)
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(1000) })
    if (res.status !== 200) return null
    const { destination, statusCode } = (await res.json()) as { destination: string; statusCode: number }
    return NextResponse.redirect(new URL(destination, request.url), statusCode)
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (ARTICLE_PATH.test(pathname)) return (await articleRedirect(request)) ?? NextResponse.next()
  // …existing admin logic unchanged…
}

export const config = { matcher: ["/admin", "/admin/:path*", "/insights/:slug"] }
```

Update the file's top comment to: "Admin: optimistic cookie check only. Insights: the redirect resolver over HTTP (Ruling R1). Never the database or server-only modules."

- [ ] **Step 5: Run tests and gates**

Run: `pnpm vitest run --project unit proxy.test.ts && pnpm test:integration tests/integration/api/redirects.test.ts && pnpm lint && pnpm typecheck && pnpm e2e:seed && pnpm test:e2e tests/e2e/admin/content/insights-redirect.spec.ts tests/e2e/navigation/cms.spec.ts tests/e2e/perf && pnpm test:parity`
Expected: PASS. `cms.spec.ts` still sees `/insights/nope` as the soft 404 (the resolver answers 204). If `getRedirectTable()` throws inside the Hono catch-all at runtime (a `'use cache'` call from a Route Handler), check `node_modules/next/dist/docs/01-app/01-getting-started/` route-handlers "with Cache Components" and, if needed, drop the directive and cache the map in a module-level variable cleared by a `redirects` write — report which one you used.

- [ ] **Step 6: Commit**

```bash
git add server/modules/redirects server/api/app.ts proxy.ts proxy.test.ts tests/e2e/support/api.ts tests/e2e/admin/content/insights-redirect.spec.ts tests/integration/api/redirects.test.ts
git commit -m "feat(insights): 301 old article URLs through a cached redirect resolver"
```

---

### Task 7: Article body editor (TipTap)

**Files:**
- Create: `admin/components/schema-form/widgets/rich-text-toolbar.tsx`, `admin/components/schema-form/widgets/media-picker-dialog.tsx`, `admin/modules/insights/article-body-editor.tsx`
- Modify: `package.json`/`pnpm-lock.yaml`, `admin/components/schema-form/widgets/rich-text-widget.tsx`, `admin/components/schema-form/widgets/media-widget.tsx`
- Test: `admin/modules/insights/article-body-editor.test.tsx`, `admin/components/schema-form/widgets/widgets.test.tsx` (must stay green)

**Interfaces:**
- Consumes: `articleExtensions` (Task 2), `ArticleBodyDoc`, `plainText`/`readingMinutes` (Task 1), `mediaListQuery`/`MediaItem`.
- Produces:
  - `RichTextToolbar({ editor, onImage? }: { editor: Editor; onImage?: () => void })` — the Phase 4 toolbar, plus an "Image" button when `onImage` is given.
  - `MediaPickerDialog({ open, onOpenChange, onPick }: { open: boolean; onOpenChange(open: boolean): void; onPick(item: MediaItem): void })` — the dialog extracted from `MediaWidget` (title "Choose an image").
  - `ArticleBodyEditor({ value, onChange, readOnly }: { value: ArticleDraft["body"]; onChange(body: ArticleDraft["body"]): void; readOnly: boolean })` — labelled textbox "Article body", bubble menu `role="toolbar"` named "Text formatting", live "n min read".

- [ ] **Step 1: Write the failing test**

`admin/modules/insights/article-body-editor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ArticleBodyEditor } from "./article-body-editor"

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ")
const doc = (text: string) => ({ type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text }] }] })
const ui = (props: Partial<Parameters<typeof ArticleBodyEditor>[0]>) => render(
  <QueryClientProvider client={new QueryClient()}>
    <ArticleBodyEditor value={doc("Hello")} onChange={vi.fn()} readOnly={false} {...props} />
  </QueryClientProvider>)

describe("ArticleBodyEditor", () => {
  it("shows the live reading time", () => {
    ui({ value: doc(words(660)) })
    expect(screen.getByText("3 min read")).toBeTruthy() })
  it("is a labelled textbox with an Image button", async () => {
    ui({})
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Article body" })).toBeTruthy())
    expect(screen.getByRole("button", { name: "Image" })).toBeTruthy() })
  it("is read-only for viewers", async () => {
    ui({ readOnly: true })
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Article body" }).getAttribute("contenteditable")).toBe("false"))
    expect(screen.queryByRole("button", { name: "Image" })).toBeNull() }) })
```

Run: `pnpm vitest run --project unit admin/modules/insights`
Expected: FAIL (module missing).

- [ ] **Step 2: Install and extract the shared pieces**

Run: `pnpm add @tiptap/extensions@3.31.3 @tiptap/extension-bubble-menu@3.31.3`

- Move `Toolbar` out of `rich-text-widget.tsx` into `rich-text-toolbar.tsx` as `export function RichTextToolbar({ editor, onImage }: { editor: Editor; onImage?: () => void })`, unchanged, plus at the end of the button row: `{onImage ? <Button type="button" size="sm" variant="ghost" aria-label="Image" onClick={onImage}><ImageIcon aria-hidden /></Button> : null}` (lucide `ImageIcon`). `rich-text-widget.tsx` renders `<RichTextToolbar editor={editor} />`.
- Move the `Dialog` block (search input, image grid, choose handler) out of `media-widget.tsx` into `media-picker-dialog.tsx` as `MediaPickerDialog`, calling `onPick(item)` then `onOpenChange(false)`; `MediaWidget` renders it with `onPick={(item) => onChange({ mediaId: item.id })}`. Keep every label as it is (`widgets.test.tsx` and `media.spec.ts` select by them).

Run: `pnpm vitest run --project unit admin/components/schema-form`
Expected: PASS (pure refactor).

- [ ] **Step 3: The editor**

`admin/modules/insights/article-body-editor.tsx`:

```tsx
"use client"

import { Placeholder } from "@tiptap/extensions"
import { EditorContent, useEditor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import { BoldIcon, ItalicIcon, LinkIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { MediaPickerDialog } from "@/admin/components/schema-form/widgets/media-picker-dialog"
import { RichTextToolbar } from "@/admin/components/schema-form/widgets/rich-text-toolbar"
import { ArticleBodyDoc } from "@/blocks/rich-text"
import { Toggle } from "@/components/ui/toggle"
import type { ArticleDraft } from "@/lib/content/article"
import { plainText, readingMinutes } from "@/lib/content/reading-time"
import { articleExtensions } from "@/lib/rich-text/extensions"

type Body = ArticleDraft["body"]
const extensions = [...articleExtensions, Placeholder.configure({ placeholder: "Start writing…" })]

// docs/brief.md §9.3: headings, lists, quote, links, images from the
// library, bubble menu, live reading time. Same sync rules as the Phase 4
// rich-text widget: our own edits come back as `emitted` and are skipped.
export function ArticleBodyEditor({ value, onChange, readOnly }: { value: Body; onChange(body: Body): void; readOnly: boolean }) {
  const emitted = useRef<unknown>(undefined)
  const [picking, setPicking] = useState(false)
  const editor = useEditor({
    extensions, content: value, editable: !readOnly, immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-label": "Article body",
      class: "prose max-w-none min-h-[50vh] p-4 focus:outline-none" } },
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON()
      const parsed = ArticleBodyDoc.safeParse(json)
      const next = (parsed.success ? parsed.data : json) as Body
      emitted.current = next
      onChange(next)
    },
  })
  useEffect(() => {
    if (!editor || value === emitted.current) return
    if (JSON.stringify(value) === JSON.stringify(emitted.current)) { emitted.current = value; return }
    if (JSON.stringify(value) !== JSON.stringify(editor.getJSON())) editor.commands.setContent(value, { emitUpdate: false })
    emitted.current = value
  }, [editor, value])
  useEffect(() => { if (editor && editor.isEditable === readOnly) editor.setEditable(!readOnly, false) }, [editor, readOnly])
  const minutes = useMemo(() => readingMinutes(plainText(value)), [value])
  return (
    <div className="rounded-xl border bg-card">
      {editor && !readOnly ? <RichTextToolbar editor={editor} onImage={() => setPicking(true)} /> : null}
      {editor && !readOnly ? (
        <BubbleMenu editor={editor} shouldShow={({ editor: e, state }) => !state.selection.empty && !e.isActive("image")}>
          <div role="toolbar" aria-label="Text formatting" className="flex gap-1 rounded-lg border bg-popover p-1 shadow-md">
            <Toggle size="sm" aria-label="Bold" pressed={editor.isActive("bold")}
              onPressedChange={() => editor.chain().focus().toggleBold().run()}><BoldIcon aria-hidden /></Toggle>
            <Toggle size="sm" aria-label="Italic" pressed={editor.isActive("italic")}
              onPressedChange={() => editor.chain().focus().toggleItalic().run()}><ItalicIcon aria-hidden /></Toggle>
            <Toggle size="sm" aria-label="Remove link" pressed={editor.isActive("link")} disabled={!editor.isActive("link")}
              onPressedChange={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}><LinkIcon aria-hidden /></Toggle>
          </div>
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
      <p aria-live="polite" className="border-t px-4 py-2 text-xs text-muted-foreground">{minutes} min read</p>
      <MediaPickerDialog open={picking} onOpenChange={setPicking} onPick={(item) =>
        editor?.chain().focus().insertContent({ type: "image", attrs: { mediaId: item.id, src: item.url, alt: item.alt ?? "" } }).run()} />
    </div>
  )
}
```

Check while implementing: the `MediaItem` field names (`url`, `alt`) in `admin/modules/media/queries.ts`, and that `BubbleMenu` is exported from `@tiptap/react/menus` in `node_modules/@tiptap/react/package.json` `exports`; adjust the import path only.

- [ ] **Step 4: Run tests and gates**

Run: `pnpm vitest run --project unit admin && pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml admin/components/schema-form/widgets admin/modules/insights/article-body-editor.tsx admin/modules/insights/article-body-editor.test.tsx
git commit -m "feat(admin): TipTap article editor with library images, bubble menu and reading time"
```

---

### Task 8: Insights admin screens and acceptance E2E

**Files:**
- Create: `admin/modules/insights/{queries,schedule-time,articles-view,article-editor-view,publish-dialogs,article-sidebar,article-seo-form,taxonomy-view}.ts(x)`, `app/(admin)/admin/(panel)/insights/page.tsx`, `app/(admin)/admin/(panel)/insights/[id]/page.tsx`, `app/(admin)/admin/(panel)/insights/categories/page.tsx`, `app/(admin)/admin/(panel)/insights/authors/page.tsx`, `tests/e2e/admin/content/insights.spec.ts`
- Modify: `admin/lib/query-keys.ts`, `admin/modules/pages/history-sheet.tsx`, `admin/modules/pages/page-builder.tsx`, `tests/e2e/support/db.ts`
- Test: `admin/modules/insights/schedule-time.test.ts`, `tests/e2e/admin/content/insights.spec.ts`, existing `app/(admin)/admin/(panel)/guarded-pages.test.ts`, `lib/admin/nav.test.ts`

**Interfaces:**
- Consumes: `articlesApi`, `categoriesApi`, `authorsApi`, `useAutosave`/`conflictOf`, `ConflictDialog`, `SaveIndicator`, `SchemaForm` + `ui` registry, `StatusPill`, `PageHeader`, `DataTable`, `usePermission`, `ArticleBodyEditor` (Task 7), `ArticleDraft`, `CategoryInput`/`AuthorInput`, `requirePermission`/`permissionFor`.
- Produces:
  - `dublinLocalToIso(local: string): string`, `isoToDublinLocal(iso: string): string`.
  - `HistorySheet` props become `{ open, onOpenChange, revisions: UseQueryOptions<{ items: Revision[] }>, restore(revisionId: string, version: number): Promise<{ version: number }>, exclusive, canRestore, onRestored, onConflict }` (page builder passes `pageRevisionsQuery(id)` and a `pagesApi` restore call).
  - Query keys `queryKeys.articles.{all,list(params),detail(id),revisions(id)}`, `queryKeys.categories`, `queryKeys.authors`.
  - Screens at `/admin/insights`, `/admin/insights/[id]`, `/admin/insights/categories`, `/admin/insights/authors` (all gated by `permissionFor(...)`, which the nav registry already maps to `article.read`).

- [ ] **Step 1: Write the failing tests**

`admin/modules/insights/schedule-time.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { dublinLocalToIso, isoToDublinLocal } from "./schedule-time"

// Review Focus 5: the picker shows Dublin wall time (docs/brief.md §8.2).
describe("schedule time", () => {
  it("converts summer (IST, UTC+1) and winter (GMT) wall times", () => {
    expect(new Date(dublinLocalToIso("2026-07-01T10:00")).toISOString()).toBe("2026-07-01T09:00:00.000Z")
    expect(new Date(dublinLocalToIso("2026-12-01T10:00")).toISOString()).toBe("2026-12-01T10:00:00.000Z") })
  it("round-trips and rejects junk", () => {
    expect(isoToDublinLocal("2026-07-01T09:00:00.000Z")).toBe("2026-07-01T10:00")
    expect(() => dublinLocalToIso("tomorrow")).toThrow() }) })
```

`tests/e2e/support/db.ts` — append:

```ts
// For specs that must move time: run one statement on the E2E database.
export async function runSql(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: E2E_ENV.DATABASE_URL })
  await client.connect()
  try { return (await client.query(text, params)).rows } finally { await client.end() }
}
```

`tests/e2e/admin/content/insights.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { E2E_ENV, E2E_ORIGIN } from "../../fixtures/env"
import { api, createPublishedArticle } from "../../support/api"
import { runSql } from "../../support/db"
import { STORAGE } from "../../support/storage"

test.describe("as an editor", () => {
  test.use({ storageState: STORAGE.editor })

  test("writes and publishes an article from the editor", async ({ page }) => {
    const stamp = Date.now()
    await page.goto("/admin/insights")
    await page.getByRole("button", { name: "New article" }).click()
    await page.getByLabel("Title").fill(`Written ${stamp}`)
    await page.getByRole("combobox", { name: "Category" }).click()
    await page.getByRole("option").first().click()
    await page.getByRole("button", { name: "Create" }).click()
    await expect(page.getByRole("heading", { name: `Written ${stamp}` })).toBeVisible()
    const body = page.getByRole("textbox", { name: "Article body" })
    await body.click()
    await page.keyboard.type("A calm opening paragraph for the test.")
    await page.keyboard.press("Shift+Home")
    await page.getByRole("toolbar", { name: "Text formatting" }).getByRole("button", { name: "Bold" }).click()
    await page.keyboard.press("End")
    await page.keyboard.press("Enter")
    await page.getByRole("button", { name: "Image" }).click()
    await page.getByRole("dialog", { name: "Choose an image" }).getByRole("button").first().click()
    await expect(page.getByText(/\d+ min read/)).toBeVisible()
    await page.getByLabel("Slug").fill(`written-${stamp}`)
    await page.getByLabel("Excerpt").fill("An excerpt written in the E2E test.")
    await page.getByRole("button", { name: "Choose cover image" }).click()
    await page.getByRole("dialog", { name: "Choose an image" }).getByRole("button").first().click()
    await expect(page.getByText("Saved")).toBeVisible()
    await page.getByRole("button", { name: "Publish" }).click()
    await expect(page.getByText("Published", { exact: true }).first()).toBeVisible()
    await page.goto(`/insights/written-${stamp}`)
    await expect(page.getByRole("heading", { name: `Written ${stamp}`, level: 1 })).toBeVisible()
    await expect(page.locator("article strong, main strong").filter({ hasText: "A calm opening" })).toBeVisible()
  })

  // Acceptance (with tests/integration/api/cron.test.ts): a scheduled article
  // appears after the tick. The interval is off in E2E (Ruling R10), so the
  // spec moves the schedule into the past and calls the tick itself.
  test("a scheduled article goes live on the tick", async ({ page, request }) => {
    const stamp = Date.now()
    const { id, version } = await createPublishedArticle(request, { slug: `sched-${stamp}`, title: `Scheduled ${stamp}` })
    await api(request, "POST", `/articles/${id}/unpublish`, { version })
    await page.goto(`/admin/insights/${id}`)
    await page.getByRole("button", { name: "Schedule" }).click()
    const dialog = page.getByRole("dialog", { name: "Schedule publishing" })
    await dialog.getByLabel("Publish at (Dublin time)").fill("2099-01-01T09:00")
    await dialog.getByRole("button", { name: "Schedule" }).click()
    await expect(page.getByText("Scheduled", { exact: true }).first()).toBeVisible()
    expect((await request.get(`/insights/sched-${stamp}`)).status()).toBe(200) // soft 404 until live
    await expect(async () => {
      await runSql("update articles set scheduled_for = now() - interval '1 minute' where id = $1", [id])
      const tick = await request.post("/api/v1/cron/tick", { headers: { authorization: `Bearer ${E2E_ENV.CRON_SECRET}` } })
      expect((await tick.json()).published).toContain(id)
    }).toPass()
    await page.goto(`/insights/sched-${stamp}`)
    await expect(page.getByRole("heading", { name: `Scheduled ${stamp}`, level: 1 })).toBeVisible()
  }) })

test.describe("as an author", () => {
  test.use({ storageState: STORAGE.author })

  // Acceptance: an author cannot publish.
  test("can submit for review but not publish", async ({ page, browser }) => {
    const editor = await browser.newContext({ storageState: STORAGE.editor })
    const { id, version } = await createPublishedArticle(editor.request, { slug: `auth-${Date.now()}`, title: "Not yours" })
    const response = await page.request.post(`/api/v1/admin/articles/${id}/publish`,
      { data: { version }, headers: { origin: E2E_ORIGIN } })
    expect(response.status()).toBe(403)
    await page.goto("/admin/insights")
    await page.getByRole("button", { name: "New article" }).click()
    await page.getByLabel("Title").fill(`Mine ${Date.now()}`)
    await page.getByRole("combobox", { name: "Category" }).click()
    await page.getByRole("option").first().click()
    await page.getByRole("button", { name: "Create" }).click()
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Schedule" })).toHaveCount(0)
    await page.getByRole("button", { name: "Submit for review" }).click()
    await expect(page.getByText("Review requested")).toBeVisible()
    await page.goto(`/admin/insights/${id}`)
    await expect(page.getByRole("note")).toContainText("View only")
    await editor.close()
  }) })
```

Run: `pnpm vitest run --project unit admin/modules/insights/schedule-time.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 2: Time helper, keys, queries, generic history**

`admin/modules/insights/schedule-time.ts`:

```ts
import { TZDate } from "@date-fns/tz"

const ZONE = "Europe/Dublin"
const pad = (n: number) => String(n).padStart(2, "0")

// <input type="datetime-local"> holds Dublin wall time (docs/brief.md §8.2).
export function dublinLocalToIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!m) throw new Error("Pick a date and time")
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number]
  return new TZDate(y, mo - 1, d, h, mi, ZONE).toISOString()
}

export function isoToDublinLocal(iso: string): string {
  const t = new TZDate(new Date(iso).getTime(), ZONE)
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`
}
```

`admin/lib/query-keys.ts` — add:

```ts
  articles: {
    all: ["articles"] as const,
    list: (params: object) => ["articles", "list", params] as const,
    detail: (id: string) => ["articles", "detail", id] as const,
    revisions: (id: string) => ["articles", "revisions", id] as const,
  },
  categories: ["categories"] as const,
  authors: ["authors"] as const,
```

`admin/modules/insights/queries.ts` — mirror `admin/modules/pages/queries.ts`: `ArticleListParams` (`q`, `status`, `categoryId`, `review`, `page`), `articlesListQuery(params)` → `parseResponse(articlesApi.index.$get({ query }))`, `type ArticleSummaryRow`, `articleDetailQuery(id)`, `type ArticleDetail`, `articleRevisionsQuery(id)`, `categoriesQuery()`, `authorsQuery()` (each `queryOptions({ queryKey, queryFn })` with the keys above; `InferResponseType` for the types).

`admin/modules/pages/history-sheet.tsx` — replace the `pageId` prop with `revisions` (query options) and `restore(revisionId, version)`; inside, `useQuery({ ...revisions, enabled: open })` and the mutation calls `exclusive((version) => restore(revisionId, version))`. `page-builder.tsx` passes `revisions={pageRevisionsQuery(page.id)}` and `restore={(rev, version) => parseResponse(pagesApi[":id"].revisions[":rev"].restore.$post({ param: { id: page.id, rev }, json: { version } }))}` (the call the sheet made before). `editing.spec.ts`'s history flow covers the refactor.

- [ ] **Step 3: Screens (specs; labels are load-bearing)**

Each page file follows `app/(admin)/admin/(panel)/pages/page.tsx`: `<Suspense fallback={<CardSkeleton />}><Gate /></Suspense>`, `Gate` calls `await requirePermission(permissionFor("<its href>"))`; `[id]` also 404s a non-uuid (as `pages/[id]`). Metadata titles: "Insights", "Edit article", "Categories", "Authors".

- `ArticlesView` (`articles-view.tsx`): `PageHeader` title "Insights" with primary action button "New article" (shown when `usePermission({ article: ["create"] })`). The button opens a `Dialog` titled "New article" holding a small form: input "Title", `Select` "Category" (from `categoriesQuery`), editors also get `Select` "Author" (from `authorsQuery`; default the first); submit button "Create" → `articlesApi.index.$post` → `router.push(\`/admin/insights/${id}\`)`. Filters row: `Input` "Search articles" (debounced 300 ms, `q`), `Select` "Status" (All, Draft, Scheduled, Published, Archived), `Select` "Category", toggle "Review requested". `DataTable` columns "Title" (link to the editor), "Status" (`StatusPill`: Draft/Scheduled (with Dublin date)/Published/Archived, plus a "Review requested" pill), "Category", "Author", "Updated" (Dublin time, `TIME` formatter as in `conflict-dialog.tsx`). Empty state: "No articles yet" with the "New article" CTA. Pagination via `DataTablePagination`.

- `ArticleEditorView` (`article-editor-view.tsx`), modelled on `page-builder.tsx`:
  - Loads `articleDetailQuery(id)`. `canEdit = detail.canEdit && usePermission({ article: ["update"] })`; `canPublish = usePermission({ article: ["publish"] })`. When `!canEdit`, show `<p role="note">View only: you can read this article but not change it.</p>` and render everything read-only (`<fieldset disabled>` + `readOnly` on the body editor).
  - State: `draft` (`ArticleDraft`) in a `useReducer` of field patches; every change calls `schedule(nextDraft)` from `useAutosave<ArticleDraft>({ version: detail.version, save: (draft, version, options) => parseResponse(articlesApi[":id"].draft.$patch({ param: { id }, json: { version, draft } }, options?.keepalive ? { init: { keepalive: true } } : undefined)) })`. Header: `<h1>` = draft title (or "Untitled article"), `StatusPill` (status), `SaveIndicator state={state}`, buttons "History" (opens `HistorySheet` with `articleRevisionsQuery(id)` and the articles restore call), and for `canPublish`: "Publish" (runs `exclusive((version) => articlesApi[":id"].publish.$post(...))`, toasts "Published", refetches detail; a 400 maps `fieldErrors` onto the side-panel fields and the toast "Fix the highlighted fields before publishing"), "Schedule" (status draft/archived only), "Unpublish" (status published/scheduled). For non-publishers with `canEdit`: "Submit for review" (`/submit`; afterwards the pill "Review requested"). `ConflictDialog` wired exactly as in the page builder (review = reload server copy; overwrite = `overwrite()`).
  - Main column: `Input` labelled "Title" (`draft.title`), then `ArticleBodyEditor value={draft.body} onChange={(body) => patch({ body })} readOnly={!canEdit}`.
  - Side panel (`article-sidebar.tsx`): plain controlled fields (not SchemaForm, so autosave sees each keystroke): "Slug" input with the notice "Changing the slug of a published article redirects the old address here." shown when `detail.publishedAt`; "Excerpt" textarea with a counter `n/240`; "Cover image": the `MediaWidget` with its trigger labelled "Choose cover image" (pass the label via the widget's field prop); "Category" select; "Author" select (disabled unless `canPublish`); "Featured article" switch with hint "Only one article is featured; publishing this one unfeatures the other."; read-only facts: "Published" date, "Scheduled for" (Dublin time), "Reading time".
  - Tabs "Content" | "SEO". The SEO tab renders `ArticleSeoForm` (`article-seo-form.tsx`): `SchemaForm` over `{ title (≤70, "SEO title"), description (≤200, textarea, "Meta description"), ogImage (MediaRef, nullable, "Social image"), noindex ("Hide from search engines") }` saving with `articlesApi[":id"].seo.$patch` (only for `usePermission({ seo: ["update"] })`; otherwise read-only with the note "Only editors and marketers can change SEO.").

- `publish-dialogs.tsx`:
  - `ScheduleDialog` (title "Schedule publishing"): `<Input type="datetime-local">` labelled "Publish at (Dublin time)", defaulting to `isoToDublinLocal(now + 1 h)`; button "Schedule" → `exclusive((version) => articlesApi[":id"].schedule.$post({ param: { id }, json: { version, at: dublinLocalToIso(value) } }))`; shows the API's `fieldErrors.at` under the input.
  - `UnpublishDialog` (title "Unpublish article"): switch "Archive instead" (archived articles leave the list's default view but keep their history); radio group "Old address" with options "Show not found" (default), "Redirect to Insights" (`/insights`), "Redirect to another article" (then a `Select` "Article" of published articles from `articlesListQuery({ status: "published" })`, excluding this one); button "Unpublish" → `/unpublish` with `{ version, archive, redirectTo }`. Copy under the radios: "Redirects are permanent (301). You can change them later in SEO › Redirects."

- `TaxonomyView({ name }: { name: "categories" | "authors" })` (`taxonomy-view.tsx`): `PageHeader` "Categories" / "Authors" with "New category" / "New author" (when `usePermission({ article: ["publish"] })`). Table columns: "Name", "Slug", "Articles" (`articleCount`), "Visible"; authors add an avatar thumbnail. Row action "Edit" opens a `Sheet` with `SchemaForm` over `CategoryInput` / `AuthorInput` (register `ui` labels: "Slug", "Name", "Description", "Related service" (collection picker over `services` if the Phase 4 collection widget supports it, else a select fed by `collectionsApi` options), "Role title", "Bio", "Photo", "Visible on the site"); save → POST or PATCH `{ version, values }`; "Delete" uses an `AlertDialog` ("Delete this category?"), and a 409 shows the API message in a toast. Read-only roles see the table without actions.

Use the existing admin primitives only (`components/ui/*`, `admin/components/*`); no new dependencies.

- [ ] **Step 4: Run tests and gates**

Run: `pnpm vitest run --project unit && pnpm test:integration && pnpm lint && pnpm typecheck && pnpm e2e:seed && pnpm test:e2e tests/e2e/admin/content tests/e2e/admin/shell tests/e2e/admin/a11y`
Expected: PASS, including `editing.spec.ts` (history refactor), `guarded-pages.test.ts` (the four new pages gate through `permissionFor`), axe on the new screens if the a11y spec walks the nav.

- [ ] **Step 5: Commit**

```bash
git add admin app/\(admin\) tests/e2e
git commit -m "feat(admin): insights list, article editor, scheduling and taxonomy screens"
```

---

## Phase exit

- [ ] `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm build` green; a CI-style build with `DATABASE_URL=postgres://x@127.0.0.1:1/x` still passes (`instrumentation.ts` returns early during the build; no new prerendered shells).
- [ ] `pnpm e2e:seed && pnpm test:e2e` green (parity 21/21 unchanged, `insights.spec.ts`, `insights-redirect.spec.ts`, Phase 4 content specs, shell specs).
- [ ] Deployment note appended to `docs/deploy-dokploy.md`: set `CRON_SECRET` (and optionally `INTERNAL_ORIGIN` if the container does not listen on `127.0.0.1:$PORT`); the external Dokploy schedule may call `POST /api/v1/cron/tick` with the same bearer.
- [ ] Append the Phase 5 entries and carries (article preview — R9; Phase 7 owns the redirects manager, hit counts and `[...slug]` resolution on the R1 table/resolver; Phase 10 user↔author linking UI — R4; Phase 11 bell for "Review requested" and failed schedules) to `.superpowers/sdd/plan/progress.md`.

## Spec coverage map

| Contract item (docs/plan.md Phase 5) | Where |
| --- | --- |
| 1. Articles API: CRUD, publish, schedule, unpublish, archive, revisions, author ownership, "submit for review"; slug change → 301 | Tasks 3, 4 (API), 6 (301 served) |
| 2. TipTap 3 editor (StarterKit, Image from the library, Link, Placeholder, bubble menu, live reading time); server rendering via `@tiptap/static-renderer/pm/react` mapped to the site typography (lead paragraph, clay blockquote, lists) with fixture render tests | Task 7 (editor), Task 2 (renderer + `tests/content/rich-text-seed.test.tsx` fixtures) |
| 3. Categories, authors, article template; browser fed from the DB; related by category; single featured | Task 1 (API), Task 8 (screens), Task 2 (template, optional avatar); browser + related already DB-fed since Phase 3 (`getArticleSummaries`, `getRelatedArticles`), unchanged; single featured: Task 1 index + Task 4 publish |
| 4. Scheduler: `instrumentation.ts` 60 s → `POST /api/v1/cron/tick` (`CRON_SECRET`) → advisory lock → publish due → invalidate; controlled-clock integration test | Task 5 |
| 5. Search: Postgres FTS (`websearch_to_tsquery`) for the admin list and ⌘K | Task 3 |
| Acceptance: scheduled 2 min ahead appears after the tick | Task 5 `cron.test.ts` (controlled clock), Task 8 `insights.spec.ts` |
| Acceptance: an author cannot publish | Task 4 RBAC block, Task 8 `insights.spec.ts` |
| Acceptance: old URL 301s after a rename | Task 4 (rows), Task 6 `insights-redirect.spec.ts` |
| Acceptance: article page matches the Phase 0 parity baseline | Task 2 (`pnpm test:parity` + byte-for-byte seed snapshots), re-run in Tasks 6 and exit |
| §6.5 unpublish/archive offers a 301 to `/insights` or a chosen article | Task 4 `unpublishArticle`, Task 8 `UnpublishDialog` |
| §9.3 side panel (status, schedule, category, author, cover with focal point, excerpt counter, featured, slug + auto-redirect notice), SEO panel | Task 8 (focal point comes from the media library's per-asset focal, Phase 4) |
| P3 ledger: missing author avatar hides the article | Task 2 (Ruling R2) |
| P2 carry: rate limit for DB-backed ⌘K | Task 3 (Ruling R7) |

## Self-check against the installed code (done while writing this plan)

Verified in `node_modules` and the repo at `6135f04`:

- **Next 16.3.8.** `instrumentation.ts` at the root exports `register()`, called once per server instance before requests; `process.env.NEXT_RUNTIME` picks the runtime (`docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`). Proxy defaults to the Node runtime and may `fetch` (`…/proxy.md` "Runtime", `waitUntil` example); `NextResponse.redirect(url, status)`. `permanentRedirect()` "in a streaming context … will insert a meta tag" and otherwise answers **308** (`…/04-functions/permanentRedirect.md`) — together with `cms.spec.ts` showing streamed `notFound()` stays 200, this is why Ruling R1 serves the 301 from the proxy. `cacheTag`/`cacheLife` in `'use cache'` as in `server/modules/content/queries.ts`; GET Route Handlers follow the page prerendering model under Cache Components (Task 6 Step 5 flags the one unverified use: `'use cache'` called from the Hono catch-all). `revalidateTag` stays behind `invalidate()`.
- **TipTap 3.31.3.** `@tiptap/static-renderer@3.31.3` peers `@tiptap/core`/`@tiptap/pm` `3.31.3`, `react ^19`; `renderToReactElement({ content, extensions, options: { nodeMapping, markMapping } })` from `pm/react`, node renderers get ProseMirror `node`, `parent?`, `children?` (`dist/pm/react/index.d.ts`). StarterKit 3.31.3 bundles Link. `@tiptap/react` lists `@tiptap/extension-bubble-menu` as an optional dependency (hence the explicit pin); Placeholder lives in `@tiptap/extensions`.
- **Drizzle 0.45.4.** `check()`, `uniqueIndex().on().where(sql)`, `select().for("update", { skipLocked: true })`, nested `tx.transaction()` (savepoints), `onConflictDoNothing({ target })`, `onConflictDoUpdate`, `count()`, `ilike`.
- **Zod 4.6.5.** `z.iso.datetime({ offset: true })`, `z.discriminatedUnion`, `z.object` strips unknown keys (image attrs).
- **Repo.** `ApiError(code, message, fieldErrors?, details?)` with `RATE_LIMITED`; `invalid(error, message?)`; `conflictError`, `isUniqueViolation`, `topLevelDiff`, `userName`; `writeRevision`/`listRevisions`/`findRevision`/`deleteRevisions` (`createdBy` widened in Task 4); `REVISION_LIMITS`; `assertMediaExists`; `mediaUsage` already scans `articles.body/draft/seo` text and `cover_id`; `collectMediaIds`; `tags.{articles,article,categories,authors,redirects}`; `findArticleBySlug`/`listArticleSummaries`; `slugify` (`lib/utils.ts`); `PreviewPath`; `ARTICLE_SHELL_SLUG`; `useAutosave` (`schedule`, `flush`, `exclusive`, `overwrite`, `reset`, `getVersion`), `ConflictDialog`, `HistorySheet`, `SaveIndicator`; `MediaWidget` dialog "Choose an image"; nav already lists `/admin/insights`, `/categories`, `/authors` under `article.read`; integration helpers (`cookieFor`, `adminRequest`, `insertMedia`, `resetDb`); E2E `STORAGE.{editor,author}`, `api()`, `E2E_ENV`; seeded articles have `draft = null` (Ruling R11); `proxy.test.ts` exists at the root.
- **Not compiled here (flagged in the owning step):** the static renderer's mapping prop types (Task 2 Step 4), seed-snapshot byte equality and mark order (Task 2 Step 4), `'use cache'` from Hono (Task 6 Step 5), `BubbleMenu` export path and `MediaItem` field names (Task 7 Step 3), drizzle's partial-index SQL text (Task 1 Step 3).

## Execution handoff

Plan complete and saved to `docs/plans/phase-05-insights.md`. Recommended: **subagent-driven**, because Tasks 1–6 are server slices with sharp ownership, transaction and redirect-chain edges that a fresh reviewer should gate one by one, and Tasks 7–8 depend on their interfaces in order (7 → 8). Task 6 waits on the user's answer to Ruling R1.

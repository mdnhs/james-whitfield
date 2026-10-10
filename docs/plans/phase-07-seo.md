# Phase 7: SEO Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every public URL gets complete, unique, admin-controlled metadata (title, description, canonical, Open Graph, Twitter, robots), a generated branded share card when no image is uploaded, valid JSON-LD, and a place in `sitemap.xml`. `robots.txt` blocks everything outside production. Unknown CMS URLs answer a **real 404** and moved URLs a **real 301/308**, both decided in `proxy.ts` through a cached route resolver that never touches the database from proxy. Editors get a redirect manager (CRUD, hit counts, automatic redirects when an article slug or a custom page address changes, chain flattening, loop rejection, a live-page warning), richer SEO panels (SERP preview, social card, live counters, checks), and an SEO center with a health gauge, issues with "Fix" deep links, alt coverage, defaults, verification codes and robots/sitemap previews.

**Architecture:** Pure, isomorphic builders live in `lib/seo/` (titles, `buildMetadata`, `rootMetadata`, robots policy, checks, JSON-LD, route resolution, redirect rules) and are unit-tested. Server code under `server/modules/seo/` lists live entities, serves the cached route table (`getRouteTable()`, tags `routes` · `articles` · `redirects`), computes health (cached, tag-invalidated) and serves `/api/v1/admin/seo/*`. A public `GET /api/v1/resolve?path=` answers `live | redirect | missing | pass` from the cached table and counts redirect hits with `after()` (through `defer()`). `proxy.ts` asks it for every public GET/HEAD page path (300 ms timeout, fail-open, skipped in draft mode) and answers `NextResponse.redirect` or a rewrite to an unmatched path, which renders `app/global-not-found.tsx` with a real 404. `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts` and the share-card Route Handler `app/og/[[...path]]/route.tsx` run at request time (`connection()`), from cached data.

**Tech Stack:** Next.js 16.3.8 (Cache Components, `connection()`, `after()`, `next/og` `ImageResponse`, metadata routes, `htmlLimitedBots: /.*/` already set) · Hono 4.13.13 + `@hono/zod-validator` 0.9.1 · Drizzle 0.45.4 · Zod 4.6.5 · TanStack Query 5.104.1 / Table 9.2.8 · nuqs · new: `schema-dts` (exact pin below) · Fraunces + Inter TTFs (SIL OFL 1.1) committed under `assets/fonts/` · Lighthouse 13.5.0 (local only).

**Spec:** [`docs/brief.md`](../brief.md) (§2 R8, §3 criterion 5, §4.5, §5.6 tag catalogue, §6.4 `seo` global, §6.5 SEO live-on-save, §6.6 `redirects`, §7.2 `seo.*`/`redirect.*`, §8.3 SEO row, §9.1 SEO nav, §9.3 Page builder / Articles / SEO center rows, **§11 in full**, §15 JSON-LD escaping, §16 unit row, §17 `SITE_ENV`) and the Phase 7 contract in [`docs/plan.md`](../plan.md) ("### Phase 7: SEO center"). Read both first.

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

Phase-7 values from the spec (verbatim):

- "Global defaults live in `settings.seo`. Each page and article has its own `seo` with title, description, canonical override, noindex, OG title, description and image, and Twitter card." (§11)
- "`buildMetadata(entity, defaults, path)` returns a Next `Metadata` object: the template title, description, `alternates.canonical`, `openGraph` (type, url, siteName, locale `en_IE`, images), `twitter` and `robots`." (§11)
- "The site root `generateMetadata` (gated) sets: `metadataBase` from `SITE_URL`; `title: { template: "%s | Magda Kennedy", default }`; icons and verification codes from settings; `formatDetection` turned off." · "**`htmlLimitedBots: /.*/`** keeps metadata in `<head>` for every crawler." (§11)
- "When an entity has no custom image, `opengraph-image.tsx` generates one: a branded card using theme colours, the Fraunces and Inter TTFs committed under `assets/fonts`, the logo and the title, with the category for articles. ImageResponse limits apply: flexbox only, a 500 KB bundle, 1200×630." · "Uploaded images override the generated ones, and the upload is validated for size and ratio." (§11)
- "**`sitemap.ts`**, **`robots.ts`** and **`manifest.ts`** sit at the root of `app/` (gated, from cached data)." · "The sitemap lists published, indexable pages and articles with `lastModified`." · "`robots.ts` disallows `/admin` and `/api` and points at the sitemap. **When `SITE_ENV` is not `production`, it disallows everything.**" (§11)
- "JSON-LD (typed with `schema-dts`; `<` is escaped as `<`): `WebSite`, with a `SearchAction` for `/insights?q=`. `ProfessionalService` / `LocalBusiness`: address, geo, `openingHoursSpecification` from the structured hours, telephone, `priceRange`, `areaServed` (IE, GB, US), `sameAs`. `Person` for Magda Kennedy. `BreadcrumbList`, matching the breadcrumb UI. `BlogPosting` for articles. `Service` + `Offer` for plans. `FAQPage` as valid markup." (§11)
- "`lang="en-IE"` and one H1 per page." · "Alt text is **required** for content images; decorative images are flagged as such." · "A consistent no-trailing-slash canonical policy." · "A custom `not-found` that is `noindex` and carries helpful links." (§11)
- "Checks run per page and article: title of 30–60 characters, and unique; description of 70–160 characters; an OG image of the right size; alt coverage; an H1 is present; no accidental `noindex`; at least one internal link. Results are aggregated for the dashboard gauge and the SEO center, cached and invalidated by tag." (§11)
- "Redirects: managed in the admin, created automatically when a slug changes, and resolved … for unmatched paths through a cached map. `after()` increments the hit count." (§11) · `redirects`: "source_path (unique), destination, status_code (301/302/307/308), is_active, hit_count, last_hit_at, note" (§6.6)
- "**SEO fields** for pages and articles live in their own `seo` column. They go **live on save**, are audited, and can be edited by editors and marketers without publishing content." (§6.5)
- §7.2: `seo.read / update` → owner ✓/✓, admin ✓/✓, editor ✓/✓, author —, marketer ✓/✓, intake —, viewer ✓/—. `redirect.read · manage` → owner, admin, editor, marketer.
- "SEO | `GET /admin/seo/overview` (health) · `GET|PUT /admin/seo/defaults` · redirects CRUD" (§8.3) · "GROWTH SEO ▸ Overview · Defaults · Redirects" (§9.1)
- "SEO center: Health gauge and an issue list with "Fix" deep links. Defaults, sitemap and robots preview, redirects with hit counts, verification codes" · Page builder: "The SEO tab has a SERP preview, social-card preview and checks" · Articles: "slug with an auto-redirect notice. SEO panel." (§9.3)
- "Staging runs on Dokploy with `SITE_ENV=staging` (robots disallow everything …)." (§17)

**New dependencies (exact pins; every version published ≥ 2 weeks before 2026‑10‑10, i.e. on or before 2026‑09‑26, verified with `npm view <pkg> time --json`; installed by the task that needs them):**

| Package | Version | Published | Kind | Task |
| --- | --- | --- | --- | --- |
| `schema-dts` (types only; `dist/schema.d.ts` exports `WithContext`, `Graph`, `WebSite`, `ProfessionalService`, `LocalBusiness`, `Person`, `BreadcrumbList`, `BlogPosting`, `Service`, `Offer`, `FAQPage`, `SearchAction`) | `2.0.0` | 2026‑03‑23 | dependency | 1 |
| `schema-dts-lib` (required by `schema-dts@2.0.0` as `^1.0.0`; pinned through `pnpm-workspace.yaml` `overrides`) | `1.0.0` | 2026‑03‑23 | override | 1 |

Not chosen: `schema-dts` 2.1.0 (2026‑10‑02) and `schema-dts-lib` 1.1.0 (2026‑10‑02) are newer than 2026‑09‑26. `schema-dts` is a dependency rather than a devDependency so the Docker builder's `next build` type-check always sees it.

**Committed font files (Task 4):** `assets/fonts/Fraunces-SemiBold.ttf` (opsz 72, weight 600, ≈ 71 KB) and `assets/fonts/Inter-Regular.ttf` (weight 400, ≈ 325 KB), with `assets/fonts/OFL-Fraunces.txt` and `assets/fonts/OFL-Inter.txt`. Both families are the site's own fonts (`app/(site)/fonts.ts` loads them from Google Fonts) and are licensed under the SIL Open Font License 1.1, which allows bundling and embedding. Static (non-variable) TTF instances come from the Google Fonts CSS API (Satori cannot render variable fonts or WOFF2).

**New environment variables:** none. `SITE_URL` and `SITE_ENV` already exist (`server/env.ts`). Dokploy needs no change for this phase.

## Review Focus

1. **An editor previewing an unpublished custom page.** A signed-in editor in draft mode opens `/team` (a draft page). Proxy must not answer 404: requests carrying Next's `__prerender_bypass` cookie skip the resolver entirely, and `CmsPage` decides as today. → Task 6 `proxy.test.ts` "skips the resolver in draft mode"; the existing `tests/e2e/admin/content/preview.spec.ts` must stay green.
2. **The resolver is slow, down or the database is gone.** Every public page must still render (fail-open): a timeout, a non-200, malformed JSON or a thrown `fetch` all fall through to `NextResponse.next()`, and pages then show today's soft 404 at worst. → Task 6 `proxy.test.ts` "fails open …" (four cases).
3. **Redirect chains and loops.** `/a → /b` exists; an article at `/b` is unpublished with a redirect to `/c` → `/a` must now point straight at `/c`. Creating `/b → /a` while `/a → /b` exists must be rejected with a field error, never saved. → Task 7 `redirects-admin.test.ts` "flattens chains" and "rejects loops".
4. **A redirect whose source is a live page.** Creating `/about → /services` must save but return a warning; `/about` keeps answering 200 (live content wins), and the admin list marks the row as "Inactive while the page is live". → Task 6 `route-resolution.test.ts` "a live path beats a redirect", Task 7 `redirects-admin.test.ts` "warns when the source is live".
5. **Script injection through JSON-LD.** An article titled `</script><script>alert(1)</script>` must stay inside its `application/ld+json` script: every `<` is serialised as `<`, and the output still `JSON.parse`s back to the same title. → Task 5 `json-ld.test.ts` "escapes <".

## Rulings (decisions this plan takes; one line each in the hand-off)

| Ruling | Decision | Tasks |
| --- | --- | --- |
| R1 Real 404 | Proxy answers a missing CMS path with `NextResponse.rewrite(new URL("/_missing/page", request.url), { status: 404 })`. No route matches `/_missing/page` (two segments; `[page]` takes one), so Next renders `app/global-not-found.tsx` with a 404 status before anything streams. **Why:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` ("Status Codes"): "You can run this check in proxy to rewrite missing slugs to a not-found route"; `not-found.md` says the same for Cache Components. The global 404 has no site chrome (it is prerendered without the database); it gains `noindex` and helpful links. The in-shell soft 404 (`app/(site)/not-found.tsx`) stays as the fail-open fallback. | 2, 6 |
| R2 Route resolver | `GET /api/v1/resolve?path=` replaces Phase 5's `GET /api/v1/redirects?path=`. It reads `getRouteTable()` (one cached entry: published page paths, published article paths, active redirects; tags `routes`, `articles`, `redirects`; `cacheLife("max")`) and answers `{ kind: "live" } · { kind: "redirect", destination, statusCode } · { kind: "missing" } · { kind: "pass" }` with `Cache-Control: no-store`. Proxy calls it over loopback (`internalOrigin()`, 300 ms) for every public GET/HEAD outside `/api`, `/_next`, `/uploads`, `/images`, `/og`, `/admin` and the metadata files. Proxy stays database-free, so the Global Constraint holds; brief §11's "redirects are deliberately not handled in proxy" is superseded by the Phase 5 ruling (R1 there), now widened as that ruling said. | 6 |
| R3 Precedence | Live page/article > redirect > missing > pass. `missing` is only answered for shapes the CMS owns: one segment (`/x`, the `[page]` and system routes) and `/insights/<slug>`; `/` is never missing; deeper unknown paths are already real 404s via `global-not-found`. | 6 |
| R4 Redirect targets | Destinations are site paths only (no external URLs: avoids an open-redirect surface and matches proxy's same-origin check). Proxy preserves the visitor's query string (minus Next's `_rsc`) unless the destination has its own. **Open question for the user:** allow external `https://` destinations? | 6, 7 |
| R5 Chains | `createRedirect()` (every writer: manual CRUD, article slug change, article unpublish, page address change) follows active redirects from the destination to its final target (max 10 hops), rejects loops with `VALIDATION_FAILED` `{ destination: ["That would create a redirect loop"] }`, and repoints every row that ended at the new source. Closes the Phase 5 "unpublish chain not flattened" minor. | 7 |
| R6 Page address change | New `PATCH /api/v1/admin/pages/:id/path { path }` for custom pages only (system pages keep their address, 403). When the page was published, it creates an automatic 301 old → new. `redirects` gains `page_id` (FK `pages.id`, `on delete set null`) in migration `0008_seo`, so the admin can label it "Automatic". | 7 |
| R7 Hit counting | The resolver calls `defer(() => recordHit(path), "redirect hit")` (`after()`), a single `UPDATE … SET hit_count = hit_count + 1, last_hit_at = now()`. It invalidates nothing: hit counts are not in the cached table. Prefetches count as hits (accepted). | 6 |
| R8 Share cards | One Route Handler, `app/og/[[...path]]/route.tsx` (`/og` = home, `/og/about`, `/og/insights/<slug>`), instead of an `opengraph-image.tsx` in each of the eleven route segments. **Why:** file-based metadata outranks `generateMetadata` (an uploaded image must win, §11), and one handler is one file. `buildMetadata` points `og:image` at `/og/<path>?v=<hash of title+eyebrow>` when the entity has no custom image. The card shows the title (Fraunces), the eyebrow (article category, else the professional title) and a text wordmark of the site name (Inter): the logo is rendered as text so the handler never fetches an image. Colours come from the published theme tokens with `site.css` defaults. | 1, 4 |
| R9 Fonts | `outputFileTracingIncludes: { "/og/\\[\\[\\.\\.\\.path\\]\\]": ["./assets/fonts/*.ttf"] }` in `next.config.ts` so the standalone image ships the TTFs (`readFile(join(process.cwd(), "assets/fonts/…"))`). | 4 |
| R10 SEO defaults | `/admin/seo/defaults` reuses `GlobalEditor` for the existing `seo` global and the existing `GET|PUT /api/v1/admin/globals/seo` (permissions `seo.read`/`seo.update` are already wired in `GLOBAL_ACCESS`). No duplicate `/admin/seo/defaults` endpoint (§8.3 deviation). Verification codes are fields of that global. | 8 |
| R11 Health scope | Health covers live entities only (published pages and articles, noindex ones included so "accidental noindex" can be reported). Checks come from `lib/seo/checks.ts`, which the editor panels also use. Score = passed checks ÷ all checks, rounded. Cached (`"use cache"`, tags `routes`, `articles`, `media`, `settings:seo`, plus `page:<id>` per live page because page SEO saves only expire `page:<id>`). Exposed as `getSeoHealth()` for Phase 11's dashboard gauge. | 8 |
| R12 Alt text | Missing alt (not decorative, empty alt) on any image a live entity uses is a health issue with a deep link to the media library; publishing is **not** blocked. **Open question for the user:** block publish on missing alt? | 8 |
| R13 Share-image validation | A custom share image (`seo.ogImage`) must be ≥ 1200×630 with a width/height ratio within 1.91 ± 0.05; otherwise the save answers 400 `fieldErrors.ogImage = ["Use an image at least 1200×630 (1.91:1)"]`. Generated cards always pass. | 1, 2 |
| R14 Robots policy | `robotsFor(siteEnv, seo, siteUrl)`: production with `seo.robots = "index"` → `Allow: /`, `Disallow: /admin`, `Disallow: /api`, `Sitemap: <SITE_URL>/sitemap.xml`; anything else → `Disallow: /`. `seo.robots = "noindex"` also puts `noindex, nofollow` in the root metadata. Non-production pages carry no extra meta (robots.txt only, per §11). | 3 |
| R15 Title policy | One function, `documentTitle()`, produces the final `<title>`: home → `seo.title || defaultTitle`; everything else → `titleTemplate` applied to `seo.title || entity title`. `buildMetadata` returns `title: { absolute }`, so uniqueness and length checks measure exactly what ships. | 1 |
| R16 Canonical | Always set: `seo.canonical ?? path`, resolved against `metadataBase`. No trailing slash (Next's default `trailingSlash: false` already 308s `/about/` → `/about`). Entities whose canonical points elsewhere, or that are `noindex`, are left out of the sitemap. | 1, 3 |
| R17 Draft noindex | Pages rendered in draft preview get `robots: { index: false, follow: false }` (Phase 4 minor). | 2 |
| R18 JSON-LD placement | Home: `WebSite` + `ProfessionalService`/`LocalBusiness` + `Person`. Inner CMS pages: `BreadcrumbList` (Home › hero title), `FAQPage` when a visible `faq` block exists, `Service` + `Offer` per plan when a visible `services.plans` block exists. Articles: `BlogPosting` + `BreadcrumbList` (Home › Insights › title). One `<script type="application/ld+json">` per page holding an `@graph`. | 5 |
| R19 Rich Results | Approximated by unit tests that each builder emits Google's required properties, plus an E2E that parses the `ld+json` on `/` and the seeded article and checks `@type`s and required fields. | 5, 9 |
| R20 Lighthouse | Local-only spec titled `lighthouse: …` (CI already skips that prefix) on `/`, `/about`, `/services`, `/insights`, `/insights/calm-is-a-skill`, `onlyCategories: ["seo"]`, `skipAudits: ["is-crawlable"]` because E2E runs `SITE_ENV=development`, where robots.txt disallows everything by design. **Open question for the user:** are these the five key pages (contact instead of insights?). | 9 |

No new Server Actions: all writes go through Hono (the P1 `requireActor` carry stays satisfied).

## File structure

| Files | Responsibility | Task |
| --- | --- | --- |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` (modify) | `schema-dts` pin + `schema-dts-lib` override | 1 |
| `blocks/page.ts`, `lib/content/article.ts` (modify) | `PageSeo` gains `canonical`, `ogTitle`, `ogDescription`, `twitterCard`; shared `SeoPatch` | 1 |
| `lib/seo/{title,metadata,share-image}.ts` (+ tests) | `documentTitle`, `buildMetadata`, `rootMetadata`, `ogImageUrl`, `isShareImageSize` | 1 |
| `server/modules/media/assert-media.ts`, `server/modules/pages/service.ts`, `server/modules/articles/service.ts` (modify) | `assertShareImage` on SEO saves | 2 |
| `server/modules/content/repo.ts`, `lib/content/types.ts` (modify) | `ArticleDetail.seo`, `ArticleDetail.updatedAt`, `PlanView.priceCents` | 2, 5 |
| `app/(site)/layout.tsx`, `app/(site)/_cms/cms-page.tsx`, `app/(site)/_cms/seo-defaults.ts`, `app/(site)/insights/[slug]/page.tsx`, `app/global-not-found.tsx` (modify/create) | metadata wiring | 2 |
| `lib/seo/robots.ts`, `server/modules/seo/live.ts`, `server/modules/seo/queries.ts`, `app/{sitemap,robots,manifest}.ts` | sitemap, robots, manifest | 3 |
| `assets/fonts/*`, `lib/seo/og-theme.ts`, `server/modules/seo/og.tsx`, `app/og/[[...path]]/route.tsx`, `next.config.ts` (modify) | share cards | 4 |
| `lib/seo/json-ld.ts`, `components/json-ld.tsx`, `app/(site)/_cms/page-json-ld.tsx`, `app/(site)/_cms/resolve-block.tsx` (export `select`) | structured data | 5 |
| `lib/seo/route-resolution.ts`, `server/modules/redirects/{queries,resolve-routes}.ts`, `server/api/app.ts`, `proxy.ts` (modify) | resolver + proxy | 6 |
| `lib/seo/redirect-rules.ts`, `server/modules/redirects/service.ts`, `server/db/schema/redirects.ts`, `server/db/migrations/0008_seo.sql` (generated), `server/modules/seo/routes.ts`, `server/modules/pages/{routes,schema,service}.ts`, `server/modules/articles/{publish,service}.ts` (modify) | redirect manager API | 7 |
| `lib/seo/checks.ts`, `server/modules/seo/health.ts`, `admin/modules/seo/*`, `app/(admin)/admin/(panel)/seo/**`, `admin/lib/{api,query-keys}.ts` (modify) | health + SEO center | 8 |
| `admin/components/schema-form/schema-form.tsx`, `admin/modules/seo/{serp-preview,social-card,seo-checks}.tsx`, `admin/modules/pages/{seo-form,page-builder}.tsx`, `admin/modules/insights/{article-seo-form,article-editor-view}.tsx` (modify/create) | editor panels | 9 |
| `tests/e2e/navigation/{cms,seo}.spec.ts`, `tests/e2e/perf/lighthouse-seo.spec.ts`, `tests/e2e/admin/content/{seo,insights}.spec.ts`, `docs/deploy-dokploy.md`, `.superpowers/sdd/plan/progress.md` | acceptance + exit | 2, 3, 6, 9 |

## Conventions for executing this plan

- Where a step gives a component as a spec (props, API call, labels) rather than code, the quoted labels are load-bearing: E2E specs select by them.
- Next-specific APIs used here were checked in `node_modules/next/dist/docs/` (see "Self-check" at the end). Re-read the cited doc before changing how any of them is used.
- Run `pnpm db:up` first. Generate the one migration with `pnpm db:generate --name seo` and commit the SQL, snapshot and journal.
- Pages and route handlers that read the database at request time call `await io()` (Server Components) or `await connection()` (Route Handlers / metadata routes) before any cached query, as `app/(site)/layout.tsx` does: the build has no database (`DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build` must pass).
- Commit messages: Conventional Commits, written normally, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Integration-test conventions (every API task)

- `invalidate()` calls `revalidateTag`; `"use cache"` helpers call `cacheTag`/`cacheLife`. Mock all three per file, keeping the rest of `next/cache`, exactly as `tests/integration/api/redirects.test.ts` does today.
- `defer()` calls `after()`. Mock it per file and drain the queue before asserting on hit counts:

```ts
const deferred = vi.hoisted(() => ({ tasks: [] as Promise<unknown>[] }))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    deferred.tasks.push(Promise.resolve().then(task))
  },
}))
const drain = async () => {
  await Promise.allSettled(deferred.tasks.splice(0))
}
```

- Admin requests go through `adminRequest(path, cookie, { method, body })` with cookies from `cookieFor(role)` (`tests/integration/helpers/auth.ts`). `cookieFor` creates the user: call it once per role per test.
- Content fixtures: `insertMedia`, `insertPage`, `heroDocument` (`tests/integration/helpers/content.ts`), `insertTaxonomy`, `insertArticle` (`tests/integration/helpers/articles.ts`).

---

### Task 1: SEO core — extended SEO fields, titles, `buildMetadata`, `rootMetadata`

**Files:**
- Create: `lib/seo/title.ts`, `lib/seo/metadata.ts`, `lib/seo/share-image.ts`
- Modify: `package.json`, `pnpm-workspace.yaml`, `blocks/page.ts`, `lib/content/article.ts`, `blocks/page.test.ts` (only if a fixture now needs the new defaults)
- Test: `lib/seo/title.test.ts`, `lib/seo/metadata.test.ts`, `lib/seo/share-image.test.ts`

**Interfaces:**
- Consumes: `GlobalValue<"seo">`, `GlobalValue<"site">` (`lib/content/globals.ts`), `MediaAsset` (`lib/media.ts`), `MediaRef` (`blocks/fields.ts`).
- Produces:
  - `PageSeo` (in `blocks/page.ts`) = `{ title: string|null; description: string|null; ogImage: {mediaId}|null; noindex: boolean; canonical: string|null; ogTitle: string|null; ogDescription: string|null; twitterCard: "summary_large_image" | "summary" }` (all defaulted, so old rows parse). `TWITTER_CARDS`.
  - `SeoPatch` (in `blocks/page.ts`): the same keys, each `.optional()`, nullable where `PageSeo` is, `.strict()`. `PageMetaPatch.seo = SeoPatch.optional()`; `ArticleSeoPatch = SeoPatch.refine(non-empty)`.
  - `documentTitle(subject: TitleSubject, defaults: TitleDefaults): string` with `TitleSubject = { home: boolean; title: string; seoTitle: string | null }`, `TitleDefaults = { titleTemplate: string; defaultTitle: string }`.
  - `type SeoSubject`, `type SeoDefaults`, `buildMetadata(subject: SeoSubject, defaults: SeoDefaults): Metadata`, `rootMetadata(input: RootMetadataInput): Metadata`, `ogImageUrl(path: string, title: string, eyebrow: string): string`, `OG_SIZE = { width: 1200, height: 630 }`.
  - `isShareImageSize(size: { width: number; height: number }): boolean`, `SHARE_IMAGE_MESSAGE = "Use an image at least 1200×630 (1.91:1)"`.

- [ ] **Step 1: Install the pinned dependency**

```bash
pnpm add schema-dts@2.0.0
```

Add to the existing top-level `overrides:` in `pnpm-workspace.yaml`, then `pnpm install`:

```yaml
  # schema-dts 2.0.0 asks for "^1.0.0"; 1.1.0 is newer than the 2-week rule.
  "schema-dts-lib": "1.0.0"
```

Confirm `pnpm why schema-dts-lib` shows only `1.0.0`.

- [ ] **Step 2: Write the failing tests**

`lib/seo/title.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { documentTitle } from "./title"

const defaults = {
  titleTemplate: "%s | Magda Kennedy",
  defaultTitle: "Magda Kennedy: Hypnotherapist",
}

describe("documentTitle", () => {
  it("applies the template to the SEO title, then the entity title", () => {
    expect(
      documentTitle({ home: false, title: "About", seoTitle: null }, defaults)
    ).toBe("About | Magda Kennedy")
    expect(
      documentTitle(
        { home: false, title: "About", seoTitle: "About Magda" },
        defaults
      )
    ).toBe("About Magda | Magda Kennedy")
  })

  it("gives the home page the default title, untemplated", () => {
    expect(
      documentTitle({ home: true, title: "Home", seoTitle: null }, defaults)
    ).toBe("Magda Kennedy: Hypnotherapist")
    expect(
      documentTitle({ home: true, title: "Home", seoTitle: "Calm" }, defaults)
    ).toBe("Calm")
  })

  it("works without a template or a default title", () => {
    const bare = { titleTemplate: "", defaultTitle: "" }
    expect(
      documentTitle({ home: false, title: "About", seoTitle: null }, bare)
    ).toBe("About")
    expect(
      documentTitle({ home: true, title: "Home", seoTitle: null }, bare)
    ).toBe("Home")
  })
})
```

`lib/seo/share-image.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { isShareImageSize } from "./share-image"

describe("isShareImageSize", () => {
  it("accepts 1200×630 and larger images of the same ratio", () => {
    expect(isShareImageSize({ width: 1200, height: 630 })).toBe(true)
    expect(isShareImageSize({ width: 2400, height: 1260 })).toBe(true)
  })
  it("rejects small or off-ratio images", () => {
    expect(isShareImageSize({ width: 1000, height: 525 })).toBe(false)
    expect(isShareImageSize({ width: 1200, height: 1200 })).toBe(false)
    expect(isShareImageSize({ width: 1600, height: 630 })).toBe(false)
  })
})
```

`lib/seo/metadata.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { PageSeo } from "@/blocks/page"
import type { MediaAsset } from "@/lib/media"

import { buildMetadata, ogImageUrl, rootMetadata } from "./metadata"

const defaults = {
  titleTemplate: "%s | Magda Kennedy",
  defaultTitle: "Magda Kennedy: Hypnotherapist",
  defaultDescription: "Clinical hypnotherapy in Dublin and online.",
  siteName: "Magda Kennedy",
  professionalTitle: "Clinical Hypnotherapist",
}
const asset = (over: Partial<MediaAsset> = {}): MediaAsset => ({
  id: "m1",
  src: "/uploads/share.jpg",
  width: 1200,
  height: 630,
  blurDataURL: null,
  alt: "Share",
  focal: null,
  ...over,
})
const page = (seo: Partial<PageSeo> = {}) => ({
  path: "/about",
  home: false,
  kind: "page" as const,
  title: "About",
  summary: null,
  eyebrow: null,
  seo: PageSeo.parse(seo),
  ogImage: null,
})

describe("buildMetadata", () => {
  it("sets the absolute title, canonical and site-wide OG fields", () => {
    const m = buildMetadata(page(), defaults)
    expect(m.title).toEqual({ absolute: "About | Magda Kennedy" })
    expect(m.description).toBe("Clinical hypnotherapy in Dublin and online.")
    expect(m.alternates).toEqual({ canonical: "/about" })
    expect(m.openGraph).toMatchObject({
      type: "website",
      url: "/about",
      siteName: "Magda Kennedy",
      locale: "en_IE",
      title: "About | Magda Kennedy",
    })
    expect(m.robots).toBeUndefined()
  })

  it("points og:image at the generated card when there is no upload", () => {
    const m = buildMetadata(page(), defaults)
    const [image] = (m.openGraph as { images: { url: string }[] }).images
    expect(image).toMatchObject({ width: 1200, height: 630 })
    expect(image!.url).toBe(
      ogImageUrl("/about", "About | Magda Kennedy", "Clinical Hypnotherapist")
    )
    expect(image!.url).toMatch(/^\/og\/about\?v=[0-9a-f]{8}$/)
    expect(ogImageUrl("/", "x", "y")).toMatch(/^\/og\?v=/)
  })

  it("lets an uploaded image, OG text, canonical and card type win", () => {
    const m = buildMetadata(
      {
        ...page({
          ogTitle: "Meet Magda",
          ogDescription: "Who I am.",
          canonical: "https://example.org/about",
          twitterCard: "summary",
          description: "About the practice.",
        }),
        ogImage: asset(),
      },
      defaults
    )
    expect(m.description).toBe("About the practice.")
    expect(m.alternates).toEqual({ canonical: "https://example.org/about" })
    expect(m.openGraph).toMatchObject({
      title: "Meet Magda",
      description: "Who I am.",
      images: [{ url: "/uploads/share.jpg", width: 1200, height: 630, alt: "Share" }],
    })
    expect(m.twitter).toMatchObject({ card: "summary", title: "Meet Magda" })
  })

  it("marks noindex entities and draft previews", () => {
    expect(buildMetadata(page({ noindex: true }), defaults).robots).toEqual({
      index: false,
      follow: true,
    })
    expect(
      buildMetadata({ ...page(), draft: true }, defaults).robots
    ).toEqual({ index: false, follow: false })
  })

  it("describes articles", () => {
    const m = buildMetadata(
      {
        ...page(),
        path: "/insights/calm",
        kind: "article",
        title: "Calm is a skill",
        summary: "An excerpt.",
        eyebrow: "Anxiety",
        article: {
          publishedTime: "2026-01-02T00:00:00.000Z",
          modifiedTime: "2026-01-03T00:00:00.000Z",
          authors: ["Magda Kennedy"],
          section: "Anxiety",
        },
      },
      defaults
    )
    expect(m.description).toBe("An excerpt.")
    expect(m.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-01-02T00:00:00.000Z",
      modifiedTime: "2026-01-03T00:00:00.000Z",
      authors: ["Magda Kennedy"],
      section: "Anxiety",
    })
  })
})

describe("rootMetadata", () => {
  const seo = {
    titleTemplate: "%s | Magda Kennedy",
    defaultTitle: "Magda Kennedy",
    defaultDescription: "Hypnotherapy.",
    defaultOgImage: null,
    robots: "index" as const,
    verification: { google: "g-code", bing: "b-code" },
    business: { type: "ProfessionalService" as const, priceRange: "€€", sameAs: [] },
  }
  it("sets base, template, verification, icons and format detection", () => {
    const m = rootMetadata({
      siteUrl: "https://magdakennedy.ie",
      seo,
      siteName: "Magda Kennedy",
      icon: asset({ src: "/uploads/icon.png" }),
      defaultOgImage: null,
    })
    expect(m.metadataBase?.toString()).toBe("https://magdakennedy.ie/")
    expect(m.title).toEqual({ default: "Magda Kennedy", template: "%s | Magda Kennedy" })
    expect(m.verification).toEqual({
      google: "g-code",
      other: { "msvalidate.01": "b-code" },
    })
    expect(m.icons).toEqual({ icon: "/uploads/icon.png", apple: "/uploads/icon.png" })
    expect(m.formatDetection).toEqual({ email: false, address: false, telephone: false })
    expect(m.robots).toBeUndefined()
  })
  it("turns the whole site noindex when the policy says so", () => {
    const m = rootMetadata({
      siteUrl: "https://x.ie",
      seo: { ...seo, robots: "noindex", verification: { google: "", bing: "" } },
      siteName: "X",
      icon: null,
      defaultOgImage: null,
    })
    expect(m.robots).toEqual({ index: false, follow: false })
    expect(m.verification).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm vitest run --project unit lib/seo`
Expected: FAIL (modules not found).

- [ ] **Step 4: Extend the SEO schemas**

In `blocks/page.ts`, replace `PageSeo` and the `seo` member of `PageMetaPatch`:

```ts
export const TWITTER_CARDS = ["summary_large_image", "summary"] as const

// A canonical override: a site path or another https:// address (§11).
const Canonical = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => /^\/(?![/\\])[^\s?#]*$/.test(v) || /^https:\/\/[^\s]+$/.test(v),
    "Use a site path (/about) or an https:// address"
  )

// Live on save, separate from the document (docs/brief.md §6.5, §11).
export const PageSeo = z.object({
  title: z.string().trim().max(70).nullable().default(null),
  description: z.string().trim().max(200).nullable().default(null),
  ogImage: MediaRef.nullable().default(null),
  noindex: z.boolean().default(false),
  canonical: Canonical.nullable().default(null),
  ogTitle: z.string().trim().max(70).nullable().default(null),
  ogDescription: z.string().trim().max(200).nullable().default(null),
  twitterCard: z.enum(TWITTER_CARDS).default("summary_large_image"),
})
export type PageSeo = z.infer<typeof PageSeo>

// Field-level merge for pages and articles alike.
export const SeoPatch = z
  .object({
    title: z.string().trim().max(70).nullable().optional(),
    description: z.string().trim().max(200).nullable().optional(),
    ogImage: MediaRef.nullable().optional(),
    noindex: z.boolean().optional(),
    canonical: Canonical.nullable().optional(),
    ogTitle: z.string().trim().max(70).nullable().optional(),
    ogDescription: z.string().trim().max(200).nullable().optional(),
    twitterCard: z.enum(TWITTER_CARDS).optional(),
  })
  .strict()
export type SeoPatch = z.infer<typeof SeoPatch>
```

and in `PageMetaPatch` use `seo: SeoPatch.optional(),`. In `lib/content/article.ts`:

```ts
import { SeoPatch } from "@/blocks/page"

// Live on save, merged per field (docs/brief.md §6.5), like pages.
export const ArticleSeoPatch = SeoPatch.refine(
  (v) => Object.keys(v).length > 0,
  "Nothing to change"
)
```

(Delete the old inline object. If `blocks/page.ts` importing nothing from `lib/content/article.ts` creates a cycle, it does not: the import goes one way.)

- [ ] **Step 5: Implement the builders**

`lib/seo/share-image.ts`:

```ts
// docs/brief.md §11: uploaded share images are validated for size and ratio.
export const SHARE_IMAGE_MESSAGE = "Use an image at least 1200×630 (1.91:1)"

export function isShareImageSize({
  width,
  height,
}: {
  width: number
  height: number
}) {
  return width >= 1200 && height >= 630 && Math.abs(width / height - 1.91) <= 0.05
}
```

`lib/seo/title.ts`:

```ts
// Ruling R15: the one place the final <title> is decided, so the uniqueness
// and length checks measure exactly what ships.
export type TitleSubject = { home: boolean; title: string; seoTitle: string | null }
export type TitleDefaults = { titleTemplate: string; defaultTitle: string }

export function documentTitle(s: TitleSubject, d: TitleDefaults) {
  if (s.home) return s.seoTitle || d.defaultTitle || s.title
  const own = s.seoTitle || s.title
  return d.titleTemplate ? d.titleTemplate.replace("%s", own) : own
}
```

`lib/seo/metadata.ts`:

```ts
import type { Metadata } from "next"

import type { PageSeo } from "@/blocks/page"
import type { GlobalValue } from "@/lib/content/globals"
import type { MediaAsset } from "@/lib/media"

import { documentTitle } from "./title"

export const OG_SIZE = { width: 1200, height: 630 } as const
const LOCALE = "en_IE"

export type SeoDefaults = {
  titleTemplate: string
  defaultTitle: string
  defaultDescription: string
  siteName: string
  professionalTitle: string
}

export type SeoSubject = {
  path: string
  home: boolean
  kind: "page" | "article"
  title: string
  // Fallback description (an article's excerpt).
  summary: string | null
  // The card's small line: the article category; null → professional title.
  eyebrow: string | null
  seo: PageSeo
  // The uploaded share image, resolved; null → the generated card.
  ogImage: MediaAsset | null
  article?: {
    publishedTime: string
    modifiedTime: string
    authors: string[]
    section: string
  }
  draft?: boolean
}

// FNV-1a: a short, stable cache-buster for the generated card's URL.
function hash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

// Ruling R8: app/og/[[...path]] renders the card for a site path.
export function ogImageUrl(path: string, title: string, eyebrow: string) {
  return `/og${path === "/" ? "" : path}?v=${hash(`${title}\n${eyebrow}`)}`
}

// docs/brief.md §11 buildMetadata(entity, defaults, path).
export function buildMetadata(s: SeoSubject, d: SeoDefaults): Metadata {
  const title = documentTitle(
    { home: s.home, title: s.title, seoTitle: s.seo.title },
    d
  )
  const description =
    s.seo.description ?? s.summary ?? (d.defaultDescription || null)
  const canonical = s.seo.canonical ?? s.path
  const ogTitle = s.seo.ogTitle ?? title
  const ogDescription = s.seo.ogDescription ?? description
  const image = s.ogImage
    ? {
        url: s.ogImage.src,
        width: s.ogImage.width,
        height: s.ogImage.height,
        alt: s.ogImage.alt || ogTitle,
      }
    : {
        url: ogImageUrl(s.path, ogTitle, s.eyebrow ?? d.professionalTitle),
        ...OG_SIZE,
        alt: ogTitle,
      }
  const robots = s.draft
    ? { index: false, follow: false }
    : s.seo.noindex
      ? { index: false, follow: true }
      : undefined
  return {
    title: { absolute: title },
    description: description ?? undefined,
    alternates: { canonical },
    // A child's openGraph replaces the parent's whole object, so the
    // site-wide fields are repeated here.
    openGraph: {
      type: s.kind === "article" ? "article" : "website",
      url: canonical,
      siteName: d.siteName,
      locale: LOCALE,
      title: ogTitle,
      description: ogDescription ?? undefined,
      images: [image],
      ...(s.kind === "article" && s.article ? s.article : {}),
    },
    twitter: {
      card: s.seo.twitterCard,
      title: ogTitle,
      description: ogDescription ?? undefined,
      images: [image.url],
    },
    ...(robots ? { robots } : {}),
  }
}

export type RootMetadataInput = {
  siteUrl: string
  seo: GlobalValue<"seo">
  siteName: string
  icon: MediaAsset | null
  defaultOgImage: MediaAsset | null
}

// The site root generateMetadata (docs/brief.md §11).
export function rootMetadata(i: RootMetadataInput): Metadata {
  const { verification } = i.seo
  const hasVerification = Boolean(verification.google || verification.bing)
  return {
    metadataBase: new URL(i.siteUrl),
    title: {
      default: i.seo.defaultTitle || i.siteName,
      template: i.seo.titleTemplate || "%s",
    },
    description: i.seo.defaultDescription || undefined,
    applicationName: i.siteName || undefined,
    formatDetection: { email: false, address: false, telephone: false },
    ...(i.icon ? { icons: { icon: i.icon.src, apple: i.icon.src } } : {}),
    ...(hasVerification
      ? {
          verification: {
            ...(verification.google ? { google: verification.google } : {}),
            ...(verification.bing
              ? { other: { "msvalidate.01": verification.bing } }
              : {}),
          },
        }
      : {}),
    openGraph: {
      type: "website",
      siteName: i.siteName,
      locale: LOCALE,
      ...(i.defaultOgImage
        ? {
            images: [
              {
                url: i.defaultOgImage.src,
                width: i.defaultOgImage.width,
                height: i.defaultOgImage.height,
                alt: i.defaultOgImage.alt,
              },
            ],
          }
        : {}),
    },
    twitter: { card: "summary_large_image" },
    ...(i.seo.robots === "noindex"
      ? { robots: { index: false, follow: false } }
      : {}),
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit lib/seo blocks && pnpm typecheck`
Expected: PASS. Type errors in `admin/modules/pages/seo-form.tsx` / `article-seo-form.tsx` cannot occur (they send a subset of `SeoPatch`); if `server/modules/articles/service.ts` `updateArticleSeo(patch: Record<string, unknown>)` needs no change, leave it.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml blocks lib
git commit -m "feat(seo): extended seo fields, title policy and metadata builders"
```

---

### Task 2: Metadata on every route, share-image validation, draft noindex, a helpful 404

**Files:**
- Create: `app/(site)/_cms/seo-defaults.ts`, `tests/e2e/navigation/seo.spec.ts`
- Modify: `app/(site)/layout.tsx`, `app/(site)/_cms/cms-page.tsx`, `app/(site)/insights/[slug]/page.tsx`, `app/global-not-found.tsx`, `server/modules/content/repo.ts`, `lib/content/types.ts`, `server/modules/media/assert-media.ts`, `server/modules/pages/service.ts`, `server/modules/articles/service.ts`
- Test: `tests/integration/api/pages.test.ts` (append), `tests/integration/api/articles.test.ts` (append), `tests/e2e/navigation/seo.spec.ts`

**Interfaces:**
- Consumes: Task 1 `buildMetadata`, `rootMetadata`, `isShareImageSize`, `SHARE_IMAGE_MESSAGE`; `getSetting`, `getMedia`, `getPublishedPage`, `getArticle` (`server/modules/content/queries.ts`); `isPreviewing()`.
- Produces:
  - `seoDefaults(): Promise<SeoDefaults>` (`app/(site)/_cms/seo-defaults.ts`; reads the cached `seo` and `site` globals).
  - `ArticleDetail` gains `seo: PageSeo` and `updatedAt: string` (ISO).
  - `assertShareImage(db: DbLike, ref: { mediaId: string } | null | undefined): Promise<void>` → `ApiError("VALIDATION_FAILED", SHARE_IMAGE_MESSAGE, { ogImage: [SHARE_IMAGE_MESSAGE] })`.

- [ ] **Step 1: Write the failing integration tests**

Append to `tests/integration/api/pages.test.ts` (reuse its `aboutPage()`, `cookieFor`, `adminRequest`, `insertMedia`):

```ts
describe("share image validation (Ruling R13)", () => {
  it("rejects a small or off-ratio share image and accepts 1200×630", async () => {
    const { page } = await aboutPage()
    const cookie = await cookieFor("marketer")
    const small = await insertMedia({ width: 800, height: 800 })
    const bad = await adminRequest(`/pages/${page.id}/seo`, cookie, {
      method: "PATCH",
      body: { seo: { ogImage: { mediaId: small.id } } },
    })
    expect(bad.status).toBe(400)
    expect((await bad.json()).error.fieldErrors.ogImage).toEqual([
      "Use an image at least 1200×630 (1.91:1)",
    ])
    const good = await insertMedia({ width: 1200, height: 630 })
    const ok = await adminRequest(`/pages/${page.id}/seo`, cookie, {
      method: "PATCH",
      body: {
        seo: {
          ogImage: { mediaId: good.id },
          canonical: "/about",
          twitterCard: "summary",
        },
      },
    })
    expect(ok.status).toBe(200)
    expect((await ok.json()).seo).toMatchObject({
      canonical: "/about",
      twitterCard: "summary",
    })
  })
})
```

Append the same case to `tests/integration/api/articles.test.ts` against `PATCH /articles/:id/seo` with body `{ ogImage: { mediaId } }` (reuse its article fixture and an `editor` cookie).

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test:integration -- pages articles`
Expected: FAIL (small image accepted with 200).

- [ ] **Step 3: Validate share images on SEO saves**

In `server/modules/media/assert-media.ts`, add `eq` to the `drizzle-orm` import and `import { isShareImageSize, SHARE_IMAGE_MESSAGE } from "@/lib/seo/share-image"`, then append:

```ts
// Ruling R13: a custom share image must be at least 1200×630 at 1.91:1.
export async function assertShareImage(
  db: DbLike,
  ref: { mediaId: string } | null | undefined
) {
  if (!ref) return
  const [row] = await db
    .select({ width: media.width, height: media.height, mimeType: media.mimeType })
    .from(media)
    .where(eq(media.id, ref.mediaId))
    .limit(1)
  const ok =
    row?.mimeType.startsWith("image/") &&
    row.width !== null &&
    row.height !== null &&
    isShareImageSize({ width: row.width, height: row.height })
  if (!ok) {
    throw new ApiError("VALIDATION_FAILED", SHARE_IMAGE_MESSAGE, {
      ogImage: [SHARE_IMAGE_MESSAGE],
    })
  }
}
```

Call it in `updateMeta` (`server/modules/pages/service.ts`) right after `assertMediaExists(tx, …)`: `await assertShareImage(tx, patch.seo?.ogImage)`; and in `updateArticleSeo` (`server/modules/articles/service.ts`) after its `assertMediaExists`: `await assertShareImage(tx, (patch as SeoPatch).ogImage)`.

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test:integration -- pages articles`
Expected: PASS.

- [ ] **Step 5: Wire metadata into the site**

`lib/content/types.ts`: `ArticleDetail` gains `seo: PageSeo` and `updatedAt: string`. `server/modules/content/repo.ts` `findArticleBySlug` returns `seo: PageSeo.parse(r.a.seo)` and `updatedAt: r.a.updatedAt.toISOString()` (`summaryColumns` already carries both columns).

`app/(site)/_cms/seo-defaults.ts`:

```ts
import type { SeoDefaults } from "@/lib/seo/metadata"
import { getSetting } from "@/server/modules/content/queries"

// Callers have awaited io(); both reads are cached and tagged.
export async function seoDefaults(): Promise<SeoDefaults> {
  const [seo, site] = await Promise.all([getSetting("seo"), getSetting("site")])
  return {
    titleTemplate: seo.titleTemplate,
    defaultTitle: seo.defaultTitle,
    defaultDescription: seo.defaultDescription,
    siteName: site.name,
    professionalTitle: site.professionalTitle,
  }
}
```

`app/(site)/layout.tsx` `generateMetadata`:

```ts
export async function generateMetadata(): Promise<Metadata> {
  await io()
  const [seo, site] = await Promise.all([getSetting("seo"), getSetting("site")])
  const ids = [site.icon?.mediaId, seo.defaultOgImage?.mediaId].filter(
    (id): id is string => Boolean(id)
  )
  const assets = ids.length ? await getMedia(ids) : new Map()
  return rootMetadata({
    siteUrl: getEnv().SITE_URL,
    seo,
    siteName: site.name,
    icon: (site.icon && assets.get(site.icon.mediaId)) ?? null,
    defaultOgImage:
      (seo.defaultOgImage && assets.get(seo.defaultOgImage.mediaId)) ?? null,
  })
}
```

`app/(site)/_cms/cms-page.tsx` `cmsMetadata` (keep the `notFound()` path):

```ts
export async function cmsMetadata(path: string): Promise<Metadata> {
  await io()
  const draft = await isPreviewing()
  const page = await getPublishedPage(path, draft)
  if (!page) notFound()
  const ogId = page.seo.ogImage?.mediaId
  const [defaults, assets] = await Promise.all([
    seoDefaults(),
    ogId ? getMedia([ogId]) : Promise.resolve(new Map()),
  ])
  // A deleted share image falls back to the generated card.
  return buildMetadata(
    {
      path: page.path,
      home: page.systemKey === "home",
      kind: "page",
      title: page.title,
      summary: null,
      eyebrow: null,
      seo: page.seo,
      ogImage: ogId ? (assets.get(ogId) ?? null) : null,
      draft,
    },
    defaults
  )
}
```

`app/(site)/insights/[slug]/page.tsx` `generateMetadata`:

```ts
export async function generateMetadata({
  params,
}: PageProps<"/insights/[slug]">): Promise<Metadata> {
  await io()
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) notFound()
  const ogId = article.seo.ogImage?.mediaId
  const [defaults, assets] = await Promise.all([
    seoDefaults(),
    ogId ? getMedia([ogId]) : Promise.resolve(new Map()),
  ])
  return buildMetadata(
    {
      path: `/insights/${article.slug}`,
      home: false,
      kind: "article",
      title: article.title,
      summary: article.excerpt,
      eyebrow: article.category.name,
      seo: article.seo,
      ogImage: ogId ? (assets.get(ogId) ?? null) : null,
      article: {
        publishedTime: article.date.iso,
        modifiedTime: article.updatedAt,
        authors: [article.author.name],
        section: article.category.name,
      },
    },
    defaults
  )
}
```

`app/global-not-found.tsx`: `metadata = { title: "Page not found", robots: { index: false, follow: false } }`; under the paragraph add a `<nav aria-label="Helpful links">` with three links: "Back to home" (`/`, the existing one), "Read the insights" (`/insights`), "Get in touch" (`/contact`), laid out `mt-8 flex flex-wrap justify-center gap-6 underline`. Keep `<main data-page-root>` and `Container`.

- [ ] **Step 6: Write the head E2E**

`tests/e2e/navigation/seo.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"

const head = (page: import("@playwright/test").Page, selector: string, attr = "content") =>
  page.locator(`head ${selector}`).first().getAttribute(attr)

test("an inner page carries full metadata in <head>", async ({ page }) => {
  await page.goto("/about")
  await expect(page).toHaveTitle(/\| /)
  expect(await head(page, 'link[rel="canonical"]', "href")).toBe(`${E2E_ORIGIN}/about`)
  expect(await head(page, 'meta[name="description"]')).toBeTruthy()
  expect(await head(page, 'meta[property="og:locale"]')).toBe("en_IE")
  expect(await head(page, 'meta[property="og:image"]')).toMatch(
    new RegExp(`^${E2E_ORIGIN}/og/about\\?v=[0-9a-f]{8}$`)
  )
  expect(await head(page, 'meta[name="twitter:card"]')).toBe("summary_large_image")
  expect(await page.locator('head meta[name="robots"]').count()).toBe(0)
})

test("the article is an og:article with its dates", async ({ page }) => {
  await page.goto("/insights/calm-is-a-skill")
  expect(await head(page, 'meta[property="og:type"]')).toBe("article")
  expect(await head(page, 'meta[property="article:published_time"]')).toBeTruthy()
  expect(await head(page, 'link[rel="canonical"]', "href")).toBe(
    `${E2E_ORIGIN}/insights/calm-is-a-skill`
  )
})

test("a trailing slash 308s to the canonical path", async ({ request }) => {
  const res = await request.get("/about/", { maxRedirects: 0 })
  expect(res.status()).toBe(308)
  expect(res.headers()["location"]).toBe("/about")
})
```

- [ ] **Step 7: Run everything this task touches**

Run: `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build && pnpm exec playwright test tests/e2e/navigation --project=desktop && pnpm test:parity`
Expected: PASS; parity 21/21 unchanged (metadata is invisible). `DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build` still passes.

- [ ] **Step 8: Commit**

```bash
git add app server lib tests
git commit -m "feat(seo): metadata on every route, share image validation and a helpful 404"
```

---

### Task 3: `sitemap.ts`, `robots.ts`, `manifest.ts` and unique titles

**Files:**
- Create: `lib/seo/robots.ts`, `server/modules/seo/live.ts`, `server/modules/seo/queries.ts`, `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`, `tests/integration/content/seo-titles.test.ts`
- Modify: `tests/e2e/navigation/seo.spec.ts` (append)
- Test: `lib/seo/robots.test.ts`, `tests/integration/content/seo-titles.test.ts`, `tests/integration/api/sitemap.test.ts`

**Interfaces:**
- Consumes: Task 1 `documentTitle`, `PageSeo`; `getEnv()`; `tags`, `MISS_LIFE`.
- Produces:
  - `robotsFor(siteEnv: "production" | "staging" | "development", seo: { robots: "index" | "noindex" }, siteUrl: string): MetadataRoute.Robots`.
  - `type LiveEntity = { kind: "page" | "article"; id: string; path: string; home: boolean; title: string; summary: string | null; seo: PageSeo; updatedAt: Date; document: PageDocument | null; body: ArticleBodyDoc | null }`.
  - `listLiveEntities(db?: DbLike): Promise<LiveEntity[]>` (uncached; published pages + published articles, newest article first).
  - `isIndexable(e: LiveEntity): boolean` (not `noindex`, canonical absent or equal to its own path).
  - `getSitemapEntries(): Promise<{ path: string; lastModified: string }[]>` (`"use cache"`, tags `routes`, `articles`, `page:<id>` per page).

- [ ] **Step 1: Write the failing tests**

`lib/seo/robots.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { robotsFor } from "./robots"

const site = "https://magdakennedy.ie"

describe("robotsFor", () => {
  it("opens production except /admin and /api, with the sitemap", () => {
    expect(robotsFor("production", { robots: "index" }, site)).toEqual({
      rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
      sitemap: `${site}/sitemap.xml`,
    })
  })
  it.each(["staging", "development"] as const)(
    "disallows everything on %s (acceptance)",
    (env) => {
      expect(robotsFor(env, { robots: "index" }, site)).toEqual({
        rules: [{ userAgent: "*", disallow: "/" }],
      })
    }
  )
  it("disallows everything when the SEO policy is noindex", () => {
    expect(robotsFor("production", { robots: "noindex" }, site)).toEqual({
      rules: [{ userAgent: "*", disallow: "/" }],
    })
  })
})
```

`tests/integration/content/seo-titles.test.ts` (the acceptance "unique titles across the sitemap"):

```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { parseGlobal } from "@/lib/content/globals"
import { documentTitle } from "@/lib/seo/title"
import { closeDb, getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { isIndexable, listLiveEntities } from "@/server/modules/seo/live"

import { resetDb } from "../helpers/db"

beforeAll(async () => {
  await resetDb()
  await seedContent()
})
afterAll(closeDb)

describe("seeded site", () => {
  it("has a unique <title> for every URL in the sitemap", async () => {
    const [row] = await getDb().select().from(settings).where(eq(settings.key, "seo"))
    const seo = parseGlobal("seo", row?.value)
    const live = (await listLiveEntities()).filter(isIndexable)
    expect(live.length).toBeGreaterThan(6)
    const titles = live.map((e) =>
      documentTitle({ home: e.home, title: e.title, seoTitle: e.seo.title }, seo)
    )
    const dupes = titles.filter((t, i) => titles.indexOf(t) !== i)
    expect(dupes).toEqual([])
  })

  it("lists the published system pages and articles, not drafts", async () => {
    const paths = (await listLiveEntities()).map((e) => e.path)
    expect(paths).toEqual(
      expect.arrayContaining(["/", "/about", "/services", "/insights", "/contact", "/insights/calm-is-a-skill"])
    )
    expect(paths).not.toContain("/privacy")
  })
})
```

`tests/integration/api/sitemap.test.ts` (mock `next/cache` like `redirects.test.ts`): insert a published `/about` page, a published `/hidden` page with `seo: { noindex: true }`, a published `/elsewhere` page with `seo: { canonical: "https://other.example/x" }`, a draft `/draft` page and a published article; assert `(await getSitemapEntries()).map((e) => e.path)` equals `["/about", "/insights/<slug>"]` in any order and every `lastModified` parses as a date.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run --project unit lib/seo/robots && pnpm test:integration -- seo-titles sitemap`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the policy, the live list and the cached entries**

`lib/seo/robots.ts`:

```ts
import type { MetadataRoute } from "next"

// docs/brief.md §11 + Ruling R14.
export function robotsFor(
  siteEnv: "production" | "staging" | "development",
  seo: { robots: "index" | "noindex" },
  siteUrl: string
): MetadataRoute.Robots {
  if (siteEnv !== "production" || seo.robots === "noindex") {
    return { rules: [{ userAgent: "*", disallow: "/" }] }
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  }
}
```

`server/modules/seo/live.ts`:

```ts
import "server-only"

import { desc, eq } from "drizzle-orm"

import { PageSeo, type PageDocument } from "@/blocks/page"
import type { ArticleBodyDoc } from "@/blocks/rich-text"
import { getDb, type DbLike } from "@/server/db/client"
import { articles, pages } from "@/server/db/schema"

export type LiveEntity = {
  kind: "page" | "article"
  id: string
  path: string
  home: boolean
  title: string
  summary: string | null
  seo: PageSeo
  updatedAt: Date
  document: PageDocument | null
  body: ArticleBodyDoc | null
}

// Everything a visitor can reach (Ruling R11): published pages and articles.
export async function listLiveEntities(db: DbLike = getDb()): Promise<LiveEntity[]> {
  const [pageRows, articleRows] = await Promise.all([
    db
      .select({
        id: pages.id,
        path: pages.path,
        title: pages.title,
        systemKey: pages.systemKey,
        seo: pages.seo,
        published: pages.published,
        updatedAt: pages.updatedAt,
        publishedAt: pages.publishedAt,
      })
      .from(pages)
      .where(eq(pages.status, "published")),
    db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        excerpt: articles.excerpt,
        seo: articles.seo,
        body: articles.body,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(eq(articles.status, "published"))
      .orderBy(desc(articles.publishedAt)),
  ])
  return [
    ...pageRows.map((p) => ({
      kind: "page" as const,
      id: p.id,
      path: p.path,
      home: p.systemKey === "home",
      title: p.title,
      summary: null,
      seo: PageSeo.parse(p.seo),
      updatedAt: p.publishedAt ?? p.updatedAt,
      document: p.published as PageDocument | null,
      body: null,
    })),
    ...articleRows.map((a) => ({
      kind: "article" as const,
      id: a.id,
      path: `/insights/${a.slug}`,
      home: false,
      title: a.title,
      summary: a.excerpt,
      seo: PageSeo.parse(a.seo),
      updatedAt: a.updatedAt,
      document: null,
      body: a.body as ArticleBodyDoc,
    })),
  ]
}

// Ruling R16: noindex and canonical-elsewhere entities stay out of the sitemap.
export const isIndexable = (e: LiveEntity) =>
  !e.seo.noindex && (e.seo.canonical === null || e.seo.canonical === e.path)
```

(`pages.published` is `jsonb().$type<PageDocument>()`, so `p.published` needs no cast beyond `as PageDocument | null` for the nullable column; `ArticleBodyDoc` is exported from `blocks/rich-text.ts`.)

`server/modules/seo/queries.ts`:

```ts
import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { tags } from "@/server/lib/cache"

import { isIndexable, listLiveEntities } from "./live"

// Callers have awaited connection(): the build has no database.
export async function getSitemapEntries() {
  "use cache"
  cacheTag(tags.routes, tags.articles)
  cacheLife("max")
  const live = await listLiveEntities()
  // Page SEO saves expire only page:<id> (noindex, canonical live there).
  for (const e of live) if (e.kind === "page") cacheTag(tags.page(e.id))
  return live
    .filter(isIndexable)
    .map((e) => ({ path: e.path, lastModified: e.updatedAt.toISOString() }))
}
```

- [ ] **Step 4: Add the metadata routes**

`app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next"
import { connection } from "next/server"

import { getEnv } from "@/server/env"
import { getSitemapEntries } from "@/server/modules/seo/queries"

// docs/brief.md §11: published, indexable pages and articles. Request-time
// (connection) because the build has no database; the data is cached.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const origin = getEnv().SITE_URL.replace(/\/$/, "")
  return (await getSitemapEntries()).map((e) => ({
    url: e.path === "/" ? origin : `${origin}${e.path}`,
    lastModified: e.lastModified,
  }))
}
```

`app/robots.ts`:

```ts
import type { MetadataRoute } from "next"
import { connection } from "next/server"

import { robotsFor } from "@/lib/seo/robots"
import { getEnv } from "@/server/env"
import { getSetting } from "@/server/modules/content/queries"

// Read at request time so one image serves staging and production.
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection()
  const { SITE_ENV, SITE_URL } = getEnv()
  return robotsFor(SITE_ENV, await getSetting("seo"), SITE_URL)
}
```

`app/manifest.ts`:

```ts
import type { MetadataRoute } from "next"
import { connection } from "next/server"

import { getMedia, getSetting } from "@/server/modules/content/queries"

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await connection()
  const [site, theme] = await Promise.all([getSetting("site"), getSetting("theme")])
  const icon = site.icon ? (await getMedia([site.icon.mediaId])).get(site.icon.mediaId) : undefined
  return {
    name: site.name,
    short_name: site.name.split(" ")[0] || site.name,
    start_url: "/",
    display: "browser",
    lang: "en-IE",
    background_color: theme.site.cream ?? "#faf6f0",
    theme_color: theme.site.brand ?? "#336060",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      ...(icon ? [{ src: icon.src, sizes: `${icon.width}x${icon.height}`, type: "image/png" }] : []),
    ],
  }
}
```

(The `#faf6f0` / `#336060` fallbacks are `--color-cream` / `--color-brand` in `app/(site)/site.css`. If the icon is not a PNG, derive `type` from its src extension.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit lib/seo && pnpm test:integration -- seo-titles sitemap`
Expected: PASS. If the title test finds duplicates in the seed, fix the seed fixture (`server/db/seed/pages.ts` titles or `seo.title`) rather than the test.

- [ ] **Step 6: Append the E2E checks**

Append to `tests/e2e/navigation/seo.spec.ts`:

```ts
test("robots.txt disallows everything outside production (acceptance)", async ({ request }) => {
  // E2E runs SITE_ENV=development, the same branch staging takes.
  const body = await (await request.get("/robots.txt")).text()
  expect(body).toMatch(/User-Agent: \*\s+Disallow: \/\s*$/m)
  expect(body).not.toContain("Sitemap:")
})

test("sitemap.xml lists live pages and articles only", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text()
  for (const path of ["/about", "/services", "/insights/calm-is-a-skill"]) {
    expect(xml).toContain(`<loc>${E2E_ORIGIN}${path}</loc>`)
  }
  expect(xml).not.toContain("/privacy")
  expect(xml).toContain("<lastmod>")
})

test("manifest.webmanifest names the site", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json()
  expect(manifest).toMatchObject({ start_url: "/", lang: "en-IE" })
})
```

- [ ] **Step 7: Run and commit**

Run: `pnpm typecheck && pnpm lint && pnpm build && DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build && pnpm exec playwright test tests/e2e/navigation/seo.spec.ts --project=desktop`
Expected: PASS; the build output lists `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` as dynamic (`ƒ`).

```bash
git add app lib server tests
git commit -m "feat(seo): sitemap, robots and manifest from cached data"
```

---

### Task 4: Generated share cards (`next/og`) with committed fonts

**Files:**
- Create: `assets/fonts/Fraunces-SemiBold.ttf`, `assets/fonts/Inter-Regular.ttf`, `assets/fonts/OFL-Fraunces.txt`, `assets/fonts/OFL-Inter.txt`, `lib/seo/og-theme.ts`, `server/modules/seo/og.tsx`, `app/og/[[...path]]/route.tsx`
- Modify: `next.config.ts`
- Test: `lib/seo/og-theme.test.ts`, `server/modules/seo/og.test.tsx`, `tests/e2e/navigation/seo.spec.ts` (append)

**Interfaces:**
- Consumes: `getPublishedPage`, `getArticle`, `getSetting` (cached); Task 1 `OG_SIZE`.
- Produces:
  - `ogColors(theme: GlobalValue<"theme">["site"]): { background: string; text: string; accent: string }`.
  - `type OgSubject = { title: string; eyebrow: string; siteName: string }`; `OgCard(props: OgSubject & { colors }): JSX.Element` (flexbox only); `ogSubjectFor(path: string): Promise<OgSubject | null>`; `renderOg(subject: OgSubject, colors): Promise<ImageResponse>`.
  - Route `GET /og` · `/og/<segment>` · `/og/insights/<slug>` → `image/png` 1200×630, `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`; unknown → 404.

- [ ] **Step 1: Fetch and commit the fonts**

```bash
mkdir -p assets/fonts
ttf() { curl -s "https://fonts.googleapis.com/css2?family=$1" | grep -o 'https://[^)]*\.ttf' | head -1; }
curl -sL "$(ttf 'Fraunces:opsz,wght@72,600')" -o assets/fonts/Fraunces-SemiBold.ttf
curl -sL "$(ttf 'Inter:wght@400')" -o assets/fonts/Inter-Regular.ttf
curl -sL https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/OFL.txt -o assets/fonts/OFL-Fraunces.txt
curl -sL https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt -o assets/fonts/OFL-Inter.txt
file assets/fonts/*.ttf   # both: "TrueType Font data"
du -k assets/fonts/*.ttf  # ≈ 71 KB and ≈ 325 KB
```

(Without a browser User-Agent the CSS API serves static TTF instances, which Satori needs. Both fonts are SIL OFL 1.1: the licence files ship next to them.)

- [ ] **Step 2: Write the failing tests**

`lib/seo/og-theme.test.ts`:

```ts
import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { OG_DEFAULTS, ogColors } from "./og-theme"

describe("ogColors", () => {
  it("defaults to the site.css tokens", () => {
    const css = readFileSync(path.join(import.meta.dirname, "../../app/(site)/site.css"), "utf8")
    expect(css).toContain(`--color-ink: ${OG_DEFAULTS.ink};`)
    expect(css).toContain(`--color-cream: ${OG_DEFAULTS.cream};`)
    expect(css).toContain(`--color-brand-mint: ${OG_DEFAULTS["brand-mint"]};`)
    expect(ogColors({})).toEqual({ background: OG_DEFAULTS.ink, text: OG_DEFAULTS.cream, accent: OG_DEFAULTS["brand-mint"] })
  })
  it("follows the published theme", () => {
    expect(ogColors({ ink: "#111111", cream: "#eeeeee", "brand-mint": "#00ff99" })).toEqual({
      background: "#111111", text: "#eeeeee", accent: "#00ff99",
    })
  })
})
```

`server/modules/seo/og.test.tsx` (unit project; `server-only` is stubbed):

```tsx
import { describe, expect, it } from "vitest"

import { OgCard, renderOg } from "./og"

const subject = { title: "Calm is a skill", eyebrow: "Anxiety", siteName: "Magda Kennedy" }
const colors = { background: "#030303", text: "#faf6f0", accent: "#d6e8e4" }

describe("share card", () => {
  it("puts the title, eyebrow and wordmark on the card", () => {
    const text = JSON.stringify(OgCard({ ...subject, colors }))
    for (const s of ["Calm is a skill", "Anxiety", "Magda Kennedy"]) expect(text).toContain(s)
  })
  it("renders a 1200×630 PNG with the committed fonts", async () => {
    const res = await renderOg(subject, colors)
    expect(res.headers.get("content-type")).toBe("image/png")
    const png = new Uint8Array(await res.arrayBuffer())
    expect([...png.slice(1, 4)].map((c) => String.fromCharCode(c)).join("")).toBe("PNG")
    const view = new DataView(png.buffer)
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630])
  }, 20_000)
})
```

(If `next/og` cannot run under Vitest's node environment, drop the second case here and rely on the E2E in Step 6; record that in the commit body.)

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm vitest run --project unit lib/seo/og-theme server/modules/seo/og`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement the card and the route**

`lib/seo/og-theme.ts`:

```ts
import type { GlobalValue } from "@/lib/content/globals"

// app/(site)/site.css @theme values (og-theme.test.ts keeps them in step).
export const OG_DEFAULTS = { ink: "#030303", cream: "#faf6f0", "brand-mint": "#d6e8e4" } as const

export function ogColors(theme: GlobalValue<"theme">["site"]) {
  return {
    background: theme.ink ?? OG_DEFAULTS.ink,
    text: theme.cream ?? OG_DEFAULTS.cream,
    accent: theme["brand-mint"] ?? OG_DEFAULTS["brand-mint"],
  }
}
```

`server/modules/seo/og.tsx`:

```tsx
import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"

import { OG_SIZE } from "@/lib/seo/metadata"
import { getArticle, getPublishedPage, getSetting } from "@/server/modules/content/queries"

export type OgSubject = { title: string; eyebrow: string; siteName: string }
type Colors = { background: string; text: string; accent: string }

// Read once per process; traced into the standalone build (Ruling R9).
const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Fraunces-SemiBold.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Inter-Regular.ttf")),
])

// Flexbox only (ImageResponse/Satori). Ruling R8: the logo is a wordmark.
export function OgCard({ title, eyebrow, siteName, colors }: OgSubject & { colors: Colors }) {
  return (
    <div
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "72px 80px",
        background: colors.background, color: colors.text, fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", fontSize: 30, color: colors.accent, letterSpacing: 1 }}>
        {eyebrow}
      </div>
      <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: title.length > 60 ? 64 : 80, lineHeight: 1.08 }}>
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30 }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: colors.accent }} />
        {siteName}
      </div>
    </div>
  )
}

export async function renderOg(subject: OgSubject, colors: Colors) {
  const [fraunces, inter] = await fonts
  return new ImageResponse(<OgCard {...subject} colors={colors} />, {
    ...OG_SIZE,
    fonts: [
      { name: "Fraunces", data: fraunces, weight: 600, style: "normal" },
      { name: "Inter", data: inter, weight: 400, style: "normal" },
    ],
  })
}

// "/" · "/about" · "/insights/<slug>" → what the card says; null → 404.
export async function ogSubjectFor(path: string): Promise<OgSubject | null> {
  const site = await getSetting("site")
  const article = /^\/insights\/([^/]+)$/.exec(path)
  if (article) {
    const found = await getArticle(article[1]!)
    if (!found) return null
    return { title: found.seo.ogTitle ?? found.title, eyebrow: found.category.name, siteName: site.name }
  }
  const page = await getPublishedPage(path)
  if (!page) return null
  const seo = await getSetting("seo")
  const title = page.seo.ogTitle ?? (page.systemKey === "home" ? page.seo.title || seo.defaultTitle || site.name : page.seo.title || page.title)
  return { title, eyebrow: site.professionalTitle, siteName: site.name }
}
```

(The card text must match what `buildMetadata` hashes into `?v=` only loosely: `v` is a cache-buster, not a signature. The home title uses the default title like the page `<title>`; other cards use the bare SEO/page title without the " | Magda Kennedy" suffix, which the wordmark already shows.)

`app/og/[[...path]]/route.tsx`:

```tsx
import { connection } from "next/server"

import { ogColors } from "@/lib/seo/og-theme"
import { getSetting } from "@/server/modules/content/queries"
import { ogSubjectFor, renderOg } from "@/server/modules/seo/og"

// Ruling R8: the generated share card for a site path.
export async function GET(_request: Request, ctx: RouteContext<"/og/[[...path]]">) {
  await connection()
  const { path = [] } = await ctx.params
  const subject = await ogSubjectFor(`/${path.join("/")}`)
  if (!subject) return new Response("Not found", { status: 404 })
  const image = await renderOg(subject, ogColors((await getSetting("theme")).site))
  image.headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")
  return image
}
```

`next.config.ts`: add at the top level (comment: "Ruling R9: the share-card route reads these at run time"):

```ts
  outputFileTracingIncludes: {
    "/og/\\[\\[\\.\\.\\.path\\]\\]": ["./assets/fonts/*.ttf"],
  },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit lib/seo/og-theme server/modules/seo/og`
Expected: PASS.

- [ ] **Step 6: Append the E2E and check the standalone trace**

Append to `tests/e2e/navigation/seo.spec.ts`:

```ts
test("the generated share card is a PNG, and unknown paths 404", async ({ page, request }) => {
  await page.goto("/insights/calm-is-a-skill")
  const og = await page.locator('head meta[property="og:image"]').getAttribute("content")
  const res = await request.get(og!)
  expect(res.status()).toBe(200)
  expect(res.headers()["content-type"]).toBe("image/png")
  expect((await request.get("/og/no-such-page")).status()).toBe(404)
})
```

Run: `pnpm build && ls .next/standalone/assets/fonts && pnpm exec playwright test tests/e2e/navigation/seo.spec.ts --project=desktop`
Expected: the two TTFs are inside `.next/standalone/assets/fonts`; the spec passes. Open `/og/about` in a browser once and eyeball the card (record a screenshot path in the commit body).

- [ ] **Step 7: Commit**

```bash
git add assets lib server app next.config.ts tests
git commit -m "feat(seo): generated share cards with committed fonts"
```

---
### Task 5: JSON-LD builders (`schema-dts`) on the home, inner and article pages

**Files:**
- Create: `lib/seo/json-ld.ts`, `lib/content/select.ts`, `components/json-ld.tsx`, `app/(site)/_cms/page-json-ld.tsx`
- Modify: `app/(site)/_cms/resolve-block.tsx` (import `select` from `lib/content/select.ts`), `app/(site)/_cms/cms-page.tsx`, `app/(site)/insights/[slug]/page.tsx`, `lib/content/types.ts` (`PlanView.priceCents`), `server/modules/content/repo.ts` (`listPlans` returns `priceCents`)
- Test: `lib/seo/json-ld.test.ts`, `lib/content/select.test.ts`, `tests/e2e/navigation/seo.spec.ts` (append)

**Interfaces:**
- Consumes: `GlobalValue<"site" | "contact" | "seo">`, `FaqView`, `PlanView`, `ArticleDetail`, `getEnv().SITE_URL`.
- Produces (all pure, in `lib/seo/json-ld.ts`; `origin` is `SITE_URL` without a trailing slash):
  - `jsonLd(graph: Graph): string` — `JSON.stringify` with every `<` replaced by `\u003c`.
  - `websiteNode(i: { origin; siteName }): WebSite` (with `SearchAction` → `${origin}/insights?q={search_term_string}`).
  - `businessNode(i: { origin; site; contact; seo }): ProfessionalService | LocalBusiness`.
  - `personNode(i: { origin; site }): Person`.
  - `breadcrumbNode(origin: string, trail: { name: string; path: string }[]): BreadcrumbList`.
  - `blogPostingNode(i: { origin; article: ArticleDetail; siteName }): BlogPosting`.
  - `faqNode(items: FaqView[]): FAQPage`; `planNodes(i: { origin; plans: PlanView[]; siteName }): Service[]`.
  - `graph(nodes: Thing[]): Graph` → `{ "@context": "https://schema.org", "@graph": nodes }`.
  - `select<T extends { id: string }>(items: T[], selection: Selection): T[]` (moved, unchanged behaviour).
  - `<JsonLd graph={…} />` server component → `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />`.

Required properties the tests pin (Google's structured-data docs, the Rich Results Test's own checks): `BlogPosting` → `headline` (≤ 110 chars), `image` (absolute URL array), `datePublished`, `dateModified`, `author` (`Person` with `name` and `url`); `BreadcrumbList` → `itemListElement[]` of `ListItem { position, name, item }` with absolute `item`s; `FAQPage` → `mainEntity[]` of `Question { name, acceptedAnswer: Answer { text } }`; business → `name`, `address` (`PostalAddress`), `telephone` when set, `url`, `image`/`logo` optional.

- [ ] **Step 1: Write the failing tests**

`lib/seo/json-ld.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { GLOBALS } from "@/lib/content/globals"

import {
  blogPostingNode,
  breadcrumbNode,
  businessNode,
  faqNode,
  graph,
  jsonLd,
  personNode,
  planNodes,
  websiteNode,
} from "./json-ld"

const origin = "https://magdakennedy.ie"
const site = GLOBALS.site.parse({
  name: "Magda Kennedy",
  legalName: "Magda Kennedy Hypnotherapy",
  professionalTitle: "Clinical Hypnotherapist",
  social: [{ label: "LinkedIn", url: "https://linkedin.com/in/magda" }],
})
const contact = GLOBALS.contact.parse({
  email: "hello@example.com",
  phone: { display: "01 234 5678", e164: "+35312345678" },
  address: { lines: ["1 Main St"], city: "Dublin", eircode: "D02 XY45", country: "Ireland" },
  hours: { weekly: [{ days: [1, 2, 3], opens: "09:00", closes: "17:00" }] },
  clinic: { geo: { lat: 53.34, lng: -6.26 } },
})
const seo = GLOBALS.seo.parse({ business: { type: "ProfessionalService", priceRange: "€€", sameAs: ["https://facebook.com/magda"] } })

describe("jsonLd", () => {
  it("escapes < so a title cannot close the script (Review Focus 5)", () => {
    const title = "</script><script>alert(1)</script>"
    const out = jsonLd(graph([{ "@type": "Thing", name: title }]))
    expect(out).not.toContain("<")
    expect(out).toContain("\\u003c/script>")
    expect(JSON.parse(out)["@graph"][0].name).toBe(title)
  })
})

describe("site nodes", () => {
  it("adds a SearchAction for /insights?q=", () => {
    expect(websiteNode({ origin, siteName: "Magda Kennedy" })).toMatchObject({
      "@type": "WebSite",
      url: origin,
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${origin}/insights?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    })
  })

  it("describes the practice with address, geo, hours, phone and reach", () => {
    expect(businessNode({ origin, site, contact, seo })).toMatchObject({
      "@type": "ProfessionalService",
      name: "Magda Kennedy",
      url: origin,
      telephone: "+35312345678",
      email: "hello@example.com",
      priceRange: "€€",
      areaServed: ["IE", "GB", "US"],
      sameAs: ["https://facebook.com/magda", "https://linkedin.com/in/magda"],
      address: {
        "@type": "PostalAddress",
        streetAddress: "1 Main St",
        addressLocality: "Dublin",
        postalCode: "D02 XY45",
        addressCountry: "Ireland",
      },
      geo: { "@type": "GeoCoordinates", latitude: 53.34, longitude: -6.26 },
      openingHoursSpecification: [
        { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday"], opens: "09:00", closes: "17:00" },
      ],
    })
  })

  it("omits empty optional fields", () => {
    const bare = businessNode({ origin, site, contact: GLOBALS.contact.parse({}), seo: GLOBALS.seo.parse({}) })
    expect(bare).not.toHaveProperty("telephone")
    expect(bare).not.toHaveProperty("geo")
    expect(bare).not.toHaveProperty("openingHoursSpecification")
  })

  it("names the person", () => {
    expect(personNode({ origin, site })).toMatchObject({
      "@type": "Person", name: "Magda Kennedy", jobTitle: "Clinical Hypnotherapist", url: `${origin}/about`,
    })
  })
})

describe("page nodes", () => {
  it("builds absolute breadcrumbs", () => {
    expect(breadcrumbNode(origin, [{ name: "Home", path: "/" }, { name: "About", path: "/about" }])).toEqual({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: origin },
        { "@type": "ListItem", position: 2, name: "About", item: `${origin}/about` },
      ],
    })
  })

  it("marks up FAQs and plans", () => {
    expect(faqNode([{ id: "1", question: "Does it work?", answer: "Often." }])).toEqual({
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "Does it work?", acceptedAnswer: { "@type": "Answer", text: "Often." } }],
    })
    const [service] = planNodes({
      origin, siteName: "Magda Kennedy",
      plans: [{ id: "p", slug: "programme", name: "Programme", priceLabel: "€840", priceCents: 84000, unit: "4 sessions", summary: "Four sessions.", features: [], ctaLabel: "Book", featured: false }],
    })
    expect(service).toMatchObject({
      "@type": "Service", name: "Programme", description: "Four sessions.",
      provider: { "@type": "ProfessionalService", name: "Magda Kennedy", url: origin },
      offers: { "@type": "Offer", price: "840.00", priceCurrency: "EUR", url: `${origin}/contact?plan=programme` },
    })
  })
})

describe("blogPostingNode", () => {
  it("carries Google's required BlogPosting properties", () => {
    const node = blogPostingNode({
      origin, siteName: "Magda Kennedy",
      article: {
        slug: "calm", title: "Calm is a skill", excerpt: "An excerpt.",
        image: { src: "/uploads/cover.jpg" }, author: { name: "Magda Kennedy" },
        category: { name: "Anxiety" }, date: { iso: "2026-01-02T00:00:00.000Z" }, updatedAt: "2026-01-03T00:00:00.000Z",
      } as never,
    })
    expect(node).toMatchObject({
      "@type": "BlogPosting",
      headline: "Calm is a skill",
      description: "An excerpt.",
      image: [`${origin}/uploads/cover.jpg`],
      datePublished: "2026-01-02T00:00:00.000Z",
      dateModified: "2026-01-03T00:00:00.000Z",
      author: { "@type": "Person", name: "Magda Kennedy", url: `${origin}/about` },
      publisher: { "@type": "Organization", name: "Magda Kennedy" },
      mainEntityOfPage: `${origin}/insights/calm`,
      articleSection: "Anxiety",
    })
  })
})
```

`lib/content/select.test.ts`: `select([{id:"a"},{id:"b"}], { mode: "all" })` returns both; `{ mode: "chosen", ids: ["b", "x", "a"] }` returns `[b, a]` (order of ids, unknown ids dropped).

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run --project unit lib/seo/json-ld lib/content/select`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the builders**

`lib/content/select.ts`: move the `select` helper out of `resolve-block.tsx` verbatim, typed with `z.infer<typeof Selection>` from `blocks/fields.ts`, and import it back into `resolve-block.tsx`.

`lib/seo/json-ld.ts`:

```ts
import type {
  BlogPosting,
  BreadcrumbList,
  FAQPage,
  Graph,
  LocalBusiness,
  Person,
  ProfessionalService,
  Service,
  Thing,
  WebSite,
} from "schema-dts"

import type { GlobalValue } from "@/lib/content/globals"
import type { ArticleDetail, FaqView, PlanView } from "@/lib/content/types"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const
const abs = (origin: string, path: string) => (path === "/" ? origin : `${origin}${path}`)
const url = (origin: string, src: string) => (/^https?:\/\//.test(src) ? src : abs(origin, src))

// docs/brief.md §11 / §15: "<" is escaped as \u003c, so no string can end
// the script element; the result is still valid JSON.
export function jsonLd(value: Graph) {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

export const graph = (nodes: Thing[]): Graph => ({ "@context": "https://schema.org", "@graph": nodes })

export function websiteNode({ origin, siteName }: { origin: string; siteName: string }): WebSite {
  return {
    "@type": "WebSite",
    name: siteName,
    url: origin,
    inLanguage: "en-IE",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${origin}/insights?q={search_term_string}` },
      // schema-dts has no key for this Google extension; keep the cast local.
      ...({ "query-input": "required name=search_term_string" } as object),
    },
  }
}

export function businessNode(i: {
  origin: string
  site: GlobalValue<"site">
  contact: GlobalValue<"contact">
  seo: GlobalValue<"seo">
}): ProfessionalService | LocalBusiness {
  const { address, phone, hours, clinic } = i.contact
  const sameAs = [...i.seo.business.sameAs, ...i.site.social.map((s) => s.url)]
  return {
    "@type": i.seo.business.type,
    name: i.site.name,
    ...(i.site.legalName ? { legalName: i.site.legalName } : {}),
    url: i.origin,
    ...(phone.e164 ? { telephone: phone.e164 } : {}),
    ...(i.contact.email ? { email: i.contact.email } : {}),
    ...(i.seo.business.priceRange ? { priceRange: i.seo.business.priceRange } : {}),
    areaServed: ["IE", "GB", "US"],
    ...(sameAs.length ? { sameAs } : {}),
    ...(address.city || address.lines.length
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: address.lines.join(", "),
            addressLocality: address.city,
            postalCode: address.eircode,
            addressCountry: address.country,
          },
        }
      : {}),
    ...(clinic.geo
      ? { geo: { "@type": "GeoCoordinates", latitude: clinic.geo.lat, longitude: clinic.geo.lng } }
      : {}),
    ...(hours.weekly.length
      ? {
          openingHoursSpecification: hours.weekly.map((h) => ({
            "@type": "OpeningHoursSpecification" as const,
            dayOfWeek: h.days.map((d) => DAYS[d - 1]!),
            opens: h.opens,
            closes: h.closes,
          })),
        }
      : {}),
  } as ProfessionalService
}

export function personNode({ origin, site }: { origin: string; site: GlobalValue<"site"> }): Person {
  return {
    "@type": "Person",
    name: site.name,
    ...(site.professionalTitle ? { jobTitle: site.professionalTitle } : {}),
    url: `${origin}/about`,
    ...(site.social.length ? { sameAs: site.social.map((s) => s.url) } : {}),
  }
}

export function breadcrumbNode(origin: string, trail: { name: string; path: string }[]): BreadcrumbList {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: abs(origin, step.path),
    })),
  }
}

export function faqNode(items: FaqView[]): FAQPage {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  }
}

export function planNodes(i: { origin: string; plans: PlanView[]; siteName: string }): Service[] {
  return i.plans.map((p) => ({
    "@type": "Service",
    name: p.name,
    description: p.summary,
    provider: { "@type": "ProfessionalService", name: i.siteName, url: i.origin },
    ...(p.priceCents !== null
      ? {
          offers: {
            "@type": "Offer",
            price: (p.priceCents / 100).toFixed(2),
            priceCurrency: "EUR",
            url: `${i.origin}/contact?plan=${p.slug}`,
          },
        }
      : {}),
  }))
}

export function blogPostingNode(i: { origin: string; article: ArticleDetail; siteName: string }): BlogPosting {
  const a = i.article
  return {
    "@type": "BlogPosting",
    headline: a.title.slice(0, 110),
    description: a.excerpt,
    image: [url(i.origin, a.image.src)],
    datePublished: a.date.iso,
    dateModified: a.updatedAt,
    author: { "@type": "Person", name: a.author.name, url: `${i.origin}/about` },
    publisher: { "@type": "Organization", name: i.siteName, url: i.origin },
    mainEntityOfPage: `${i.origin}/insights/${a.slug}`,
    articleSection: a.category.name,
    inLanguage: "en-IE",
  }
}
```

(If a `schema-dts` type rejects a literal, narrow the cast to the single property, as with `query-input`; never cast a whole node to `any`.)

`components/json-ld.tsx`:

```tsx
import type { Graph } from "schema-dts"

import { jsonLd } from "@/lib/seo/json-ld"

// Ruling R18: one script per page holding an @graph.
export function JsonLd({ graph }: { graph: Graph }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />
}
```

`app/(site)/_cms/page-json-ld.tsx` (server component; called with the same `page` `CmsPage` already loaded):

```tsx
import { JsonLd } from "@/components/json-ld"
import { select } from "@/lib/content/select"
import type { PublishedPage } from "@/lib/content/types"
import {
  breadcrumbNode, businessNode, faqNode, graph, personNode, planNodes, websiteNode,
} from "@/lib/seo/json-ld"
import { getEnv } from "@/server/env"
import { getFaqs, getPlans, getSetting } from "@/server/modules/content/queries"

export async function PageJsonLd({ page }: { page: PublishedPage }) {
  const origin = getEnv().SITE_URL.replace(/\/$/, "")
  const [site, contact, seo, copy] = await Promise.all([
    getSetting("site"), getSetting("contact"), getSetting("seo"), getSetting("microcopy"),
  ])
  const visible = page.document.blocks.filter((b) => !b.hidden)
  if (page.systemKey === "home") {
    return <JsonLd graph={graph([websiteNode({ origin, siteName: site.name }), businessNode({ origin, site, contact, seo }), personNode({ origin, site })])} />
  }
  const hero = visible.find((b) => b.type === "hero.page")
  const nodes = [
    breadcrumbNode(origin, [
      { name: copy.breadcrumbHome || "Home", path: "/" },
      { name: hero?.type === "hero.page" ? hero.data.title : page.title, path: page.path },
    ]),
  ]
  const faq = visible.find((b) => b.type === "faq")
  if (faq?.type === "faq") nodes.push(faqNode(select(await getFaqs(), faq.data.selection)))
  if (visible.some((b) => b.type === "services.plans")) {
    nodes.push(...planNodes({ origin, plans: (await getPlans()).slice(0, 4), siteName: site.name }))
  }
  return <JsonLd graph={graph(nodes)} />
}
```

(The breadcrumb names mirror `PageHero`'s visible trail: `copy.breadcrumbHome` › hero title. `.slice(0, 4)` mirrors `resolve-block.tsx`'s `services.plans` branch. `nodes` is `Thing[]`: annotate it so `push` accepts each node type.)

`CmsPage` renders `<><PageJsonLd page={page} /><BlockRenderer … /></>`. `ArticlePage` renders, before `<main>`, `<JsonLd graph={graph([blogPostingNode({ origin, article, siteName: site.name }), breadcrumbNode(origin, [{ name: copy.breadcrumbHome, path: "/" }, { name: copy.breadcrumbInsights, path: "/insights" }, { name: article.title, path: `/insights/${article.slug}` }])])} />` (add `getSetting("site")` to its `Promise.all`).

`PlanView` gains `priceCents: number | null`; `listPlans` maps it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit lib/seo lib/content app/\(site\)`
Expected: PASS (including the existing `resolve-block.test.ts` and `cms-page.test.ts`).

- [ ] **Step 5: Append the Rich Results approximation E2E**

Append to `tests/e2e/navigation/seo.spec.ts`:

```ts
const graphOf = async (page: import("@playwright/test").Page) => {
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent()
  return (JSON.parse(raw!) as { "@graph": Record<string, unknown>[] })["@graph"]
}

test("home JSON-LD: WebSite, the practice and the person (Rich Results approximation)", async ({ page }) => {
  await page.goto("/")
  const nodes = await graphOf(page)
  expect(nodes.map((n) => n["@type"]).sort()).toEqual(["Person", "ProfessionalService", "WebSite"])
  const business = nodes.find((n) => n["@type"] === "ProfessionalService")!
  expect(business).toHaveProperty("address")
  expect(business).toHaveProperty("name")
})

test("article JSON-LD: BlogPosting with required fields and a breadcrumb", async ({ page }) => {
  await page.goto("/insights/calm-is-a-skill")
  const nodes = await graphOf(page)
  const post = nodes.find((n) => n["@type"] === "BlogPosting")!
  for (const key of ["headline", "image", "datePublished", "dateModified", "author"]) expect(post).toHaveProperty(key)
  expect(String((post.image as string[])[0])).toMatch(/^http/)
  const crumbs = nodes.find((n) => n["@type"] === "BreadcrumbList")!
  expect((crumbs.itemListElement as unknown[]).length).toBe(3)
})

test("services JSON-LD lists plans as Service + Offer", async ({ page }) => {
  await page.goto("/services")
  const types = (await graphOf(page)).map((n) => n["@type"])
  expect(types).toContain("BreadcrumbList")
  expect(types).toContain("Service")
})
```

- [ ] **Step 6: Run and commit**

Run: `pnpm typecheck && pnpm lint && pnpm build && pnpm exec playwright test tests/e2e/navigation/seo.spec.ts --project=desktop && pnpm test:parity`
Expected: PASS; parity unchanged (scripts render nothing). Paste the home and article HTML into https://search.google.com/test/rich-results once (staging, after merge) and record the result in the ledger; it is not a CI gate.

```bash
git add lib components app server tests
git commit -m "feat(seo): json-ld for the practice, pages, plans, faqs and articles"
```

---

### Task 6: Cached route resolver and proxy — real 404s and real redirects for every public path

**Files:**
- Create: `lib/seo/route-resolution.ts`, `server/modules/redirects/resolve-routes.ts`, `tests/integration/api/resolve.test.ts` (replaces `redirects.test.ts`)
- Modify: `server/modules/redirects/queries.ts` (`getRedirectTable` → `getRouteTable`), `server/modules/redirects/service.ts` (add `recordHit`), `server/api/app.ts`, `proxy.ts`, `proxy.test.ts`, `tests/e2e/navigation/cms.spec.ts`, `tests/e2e/admin/content/insights.spec.ts:95`, `tests/e2e/admin/content/insights-redirect.spec.ts`
- Delete: `server/modules/redirects/routes.ts`, `tests/integration/api/redirects.test.ts`
- Test: `lib/seo/route-resolution.test.ts`, `tests/integration/api/resolve.test.ts`, `proxy.test.ts`, the E2E files above

**Interfaces:**
- Consumes: `tags`, `defer()`, `internalOrigin()`.
- Produces:
  - `type RouteTable = { live: string[]; redirects: Record<string, { destination: string; statusCode: number }> }`.
  - `type Resolution = { kind: "live" } | { kind: "pass" } | { kind: "missing" } | { kind: "redirect"; destination: string; statusCode: number }`.
  - `resolvePath(table: RouteTable, path: string): Resolution` (pure, Ruling R3).
  - `getRouteTable(): Promise<RouteTable>` (`"use cache"`, tags `routes` · `articles` · `redirects`, `cacheLife("max")`).
  - `recordHit(db: DbLike, sourcePath: string): Promise<void>`.
  - `GET /api/v1/resolve?path=` → `200 Resolution` (`Cache-Control: no-store`); 400 for a path not starting with `/` or longer than 512.
  - `NOT_FOUND_REWRITE = "/_missing/page"` (exported from `proxy.ts` for tests).

- [ ] **Step 1: Write the failing pure tests**

`lib/seo/route-resolution.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { resolvePath } from "./route-resolution"

const table = {
  live: ["/", "/about", "/insights", "/insights/calm"],
  redirects: {
    "/old": { destination: "/about", statusCode: 301 },
    "/about": { destination: "/services", statusCode: 301 },
    "/legacy/deep/page.html": { destination: "/insights", statusCode: 308 },
  },
}

describe("resolvePath (Ruling R3)", () => {
  it("answers live for published pages and articles", () => {
    expect(resolvePath(table, "/about")).toEqual({ kind: "live" })
    expect(resolvePath(table, "/insights/calm")).toEqual({ kind: "live" })
  })
  it("a live path beats a redirect (Review Focus 4)", () => {
    expect(resolvePath(table, "/about")).toEqual({ kind: "live" })
  })
  it("redirects active sources at any depth", () => {
    expect(resolvePath(table, "/old")).toEqual({ kind: "redirect", destination: "/about", statusCode: 301 })
    expect(resolvePath(table, "/legacy/deep/page.html")).toMatchObject({ kind: "redirect", statusCode: 308 })
  })
  it("calls CMS-shaped unknowns missing", () => {
    expect(resolvePath(table, "/no-such-page")).toEqual({ kind: "missing" })
    expect(resolvePath(table, "/insights/nope")).toEqual({ kind: "missing" })
    expect(resolvePath(table, "/insights/__shell")).toEqual({ kind: "missing" })
  })
  it("passes everything else through to Next's router", () => {
    expect(resolvePath(table, "/newsletter/confirmed")).toEqual({ kind: "pass" })
    expect(resolvePath(table, "/no/such/page")).toEqual({ kind: "pass" })
    expect(resolvePath({ live: [], redirects: {} }, "/")).toEqual({ kind: "pass" })
  })
})
```

- [ ] **Step 2: Run it to verify it fails, then implement**

Run: `pnpm vitest run --project unit lib/seo/route-resolution` → FAIL.

`lib/seo/route-resolution.ts`:

```ts
export type RouteTable = {
  live: string[]
  redirects: Record<string, { destination: string; statusCode: number }>
}
export type Resolution =
  | { kind: "live" }
  | { kind: "pass" }
  | { kind: "missing" }
  | { kind: "redirect"; destination: string; statusCode: number }

// Shapes the CMS owns: one segment (system and custom pages) and articles.
// Deeper unknown paths already 404 through app/global-not-found.tsx.
const CMS_SHAPE = /^\/(?:[^/]+|insights\/[^/]+)$/

// Ruling R3: live content > redirect > missing > pass. "/" is never missing.
export function resolvePath(table: RouteTable, path: string): Resolution {
  if (table.live.includes(path)) return { kind: "live" }
  const hit = table.redirects[path]
  if (hit) return { kind: "redirect", ...hit }
  if (path !== "/" && CMS_SHAPE.test(path)) return { kind: "missing" }
  return { kind: "pass" }
}
```

Run again → PASS.

- [ ] **Step 3: Write the failing integration test**

`tests/integration/api/resolve.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))
const deferred = vi.hoisted(() => ({ tasks: [] as Promise<unknown>[] }))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    deferred.tasks.push(Promise.resolve().then(task))
  },
}))
const drain = async () => {
  await Promise.allSettled(deferred.tasks.splice(0))
}

import { app } from "@/server/api/app"
import { closeDb, getDb } from "@/server/db/client"
import { redirects } from "@/server/db/schema"

import { insertArticle, insertTaxonomy } from "../helpers/articles"
import { heroDocument, insertMedia, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)
const resolve = async (path: string) => {
  const res = await app.request(`/api/v1/resolve?path=${encodeURIComponent(path)}`)
  return { status: res.status, body: res.status === 200 ? await res.json() : null, cache: res.headers.get("cache-control") }
}

describe("route resolver", () => {
  it("knows live pages, live articles, redirects and missing paths", async () => {
    const asset = await insertMedia()
    await insertPage({ path: "/about", systemKey: "about", document: heroDocument(asset.id), published: true })
    await insertPage({ path: "/privacy", systemKey: "privacy", document: heroDocument(asset.id) })
    const { category, author, media } = await insertTaxonomy()
    await insertArticle({ slug: "calm", categoryId: category.id, authorId: author.id, coverId: media.id })
    await insertArticle({ slug: "draft", categoryId: category.id, authorId: author.id, coverId: media.id, status: "draft" })
    await getDb().insert(redirects).values([
      { sourcePath: "/old", destination: "/about", statusCode: 308 },
      { sourcePath: "/off", destination: "/about", isActive: false },
    ])
    expect((await resolve("/about")).body).toEqual({ kind: "live" })
    expect((await resolve("/insights/calm")).body).toEqual({ kind: "live" })
    expect((await resolve("/privacy")).body).toEqual({ kind: "missing" })
    expect((await resolve("/insights/draft")).body).toEqual({ kind: "missing" })
    expect((await resolve("/off")).body).toEqual({ kind: "missing" })
    expect((await resolve("/a/b")).body).toEqual({ kind: "pass" })
    const hit = await resolve("/old")
    expect(hit.body).toEqual({ kind: "redirect", destination: "/about", statusCode: 308 })
    expect(hit.cache).toBe("no-store")
  })

  it("counts a redirect hit after the response", async () => {
    await getDb().insert(redirects).values({ sourcePath: "/old", destination: "/" })
    await resolve("/old")
    await resolve("/old")
    await drain()
    const [row] = await getDb().select().from(redirects).where(eq(redirects.sourcePath, "/old"))
    expect(row!.hitCount).toBe(2)
    expect(row!.lastHitAt).toBeInstanceOf(Date)
  })

  it("rejects what is not a site path", async () => {
    expect((await resolve("https://evil.example")).status).toBe(400)
    expect((await resolve("/" + "a".repeat(600))).status).toBe(400)
  })
})
```

Run: `pnpm test:integration -- resolve` → FAIL (404 route).

- [ ] **Step 4: Implement the table, the hit counter and the route**

`server/modules/redirects/queries.ts` (replace the file body):

```ts
import "server-only"

import { eq } from "drizzle-orm"
import { cacheLife, cacheTag } from "next/cache"

import type { RouteTable } from "@/lib/seo/route-resolution"
import { getDb } from "@/server/db/client"
import { articles, pages, redirects } from "@/server/db/schema"
import { tags } from "@/server/lib/cache"

// Ruling R2: one small cached entry answers every proxy lookup until a
// publish, unpublish, address change or redirect write expires a tag.
export async function getRouteTable(): Promise<RouteTable> {
  "use cache"
  cacheTag(tags.routes, tags.articles, tags.redirects)
  cacheLife("max")
  const db = getDb()
  const [pageRows, articleRows, redirectRows] = await Promise.all([
    db.select({ path: pages.path }).from(pages).where(eq(pages.status, "published")),
    db.select({ slug: articles.slug }).from(articles).where(eq(articles.status, "published")),
    db
      .select({ source: redirects.sourcePath, destination: redirects.destination, statusCode: redirects.statusCode })
      .from(redirects)
      .where(eq(redirects.isActive, true)),
  ])
  return {
    live: [...pageRows.map((r) => r.path), ...articleRows.map((r) => `/insights/${r.slug}`)],
    redirects: Object.fromEntries(
      redirectRows.map((r) => [r.source, { destination: r.destination, statusCode: r.statusCode }])
    ),
  }
}
```

Append to `server/modules/redirects/service.ts`:

```ts
// Ruling R7: after the response; hit counts are not cached, so no tag.
export async function recordHit(db: DbLike, sourcePath: string) {
  await db
    .update(redirects)
    .set({ hitCount: sql`${redirects.hitCount} + 1`, lastHitAt: new Date() })
    .where(eq(redirects.sourcePath, sourcePath))
}
```

(add `sql` to the `drizzle-orm` import; `updatedAt`'s `$onUpdate` also bumps — acceptable.)

`server/modules/redirects/resolve-routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { resolvePath } from "@/lib/seo/route-resolution"
import { validationHook } from "@/server/api/errors"
import type { AppEnv } from "@/server/api/types"
import { getDb } from "@/server/db/client"
import { defer } from "@/server/lib/defer"

import { getRouteTable } from "./queries"
import { recordHit } from "./service"

// Public and read-only: answers only what visiting the URL would reveal.
// proxy.ts calls it over loopback (Ruling R2).
export const resolveRoutes = new Hono<AppEnv>().get(
  "/",
  zValidator("query", z.object({ path: z.string().startsWith("/").max(512) }), validationHook),
  async (c) => {
    const { path } = c.req.valid("query")
    const result = resolvePath(await getRouteTable(), path)
    if (result.kind === "redirect") defer(() => recordHit(getDb(), path), "redirect hit")
    c.header("Cache-Control", "no-store")
    return c.json(result)
  }
)
```

`server/api/app.ts`: replace `.route("/v1/redirects", redirectsRoutes)` with `.route("/v1/resolve", resolveRoutes)` and fix the import. Delete `server/modules/redirects/routes.ts` and `tests/integration/api/redirects.test.ts` (its cases now live in `resolve.test.ts`). Run `pnpm test:integration -- resolve` → PASS.

- [ ] **Step 5: Write the failing proxy tests**

Append to `proxy.test.ts` (keep every existing admin case; replace any Phase 5 article-redirect cases with these):

```ts
describe("public paths (Ruling R2)", () => {
  const answer = (body: unknown, status = 200) =>
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))
  afterEach(() => vi.unstubAllGlobals())

  it("rewrites a missing CMS path to the global 404 with a 404 status", async () => {
    answer({ kind: "missing" })
    const res = await proxy(request("/no-such-page"))
    expect(res.status).toBe(404)
    expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/_missing/page")
  })

  it("redirects with the stored status and keeps the query string", async () => {
    answer({ kind: "redirect", destination: "/insights/new", statusCode: 301 })
    const res = await proxy(request("/insights/old?utm_source=x&_rsc=abc"))
    expect(res.status).toBe(301)
    expect(res.headers.get("location")).toBe("http://localhost:3000/insights/new?utm_source=x")
  })

  it("keeps a destination's own query string", async () => {
    answer({ kind: "redirect", destination: "/contact?plan=a", statusCode: 302 })
    const res = await proxy(request("/book?x=1"))
    expect(res.headers.get("location")).toBe("http://localhost:3000/contact?plan=a")
  })

  it("never redirects off-site", async () => {
    for (const destination of ["//evil.example", "/\\evil.example", "https://evil.example", "/\t/evil"]) {
      answer({ kind: "redirect", destination, statusCode: 301 })
      const res = await proxy(request("/old"))
      expect(res.headers.get("location")).toBeNull()
      expect(res.headers.get("x-middleware-next")).toBe("1")
    }
  })

  it("lets live and pass-through paths continue", async () => {
    for (const kind of ["live", "pass"]) {
      answer({ kind })
      expect((await proxy(request("/about"))).headers.get("x-middleware-next")).toBe("1")
    }
  })

  it("skips the resolver in draft mode (Review Focus 1)", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const res = await proxy(request("/team", "__prerender_bypass=x"))
    expect(fetch).not.toHaveBeenCalled()
    expect(res.headers.get("x-middleware-next")).toBe("1")
  })

  it("only asks for GET and HEAD", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const post = new NextRequest(new URL("/contact", "http://localhost:3000"), { method: "POST" })
    expect((await proxy(post)).headers.get("x-middleware-next")).toBe("1")
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ["a timeout", () => Promise.reject(new DOMException("t", "TimeoutError"))],
    ["a 500", () => Promise.resolve(new Response("x", { status: 500 }))],
    ["malformed JSON", () => Promise.resolve(new Response("{", { status: 200 }))],
    ["an unknown kind", () => Promise.resolve(new Response('{"kind":"x"}', { status: 200 }))],
  ])("fails open on %s (Review Focus 2)", async (_name, impl) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(impl))
    const res = await proxy(request("/no-such-page"))
    expect(res.status).toBe(200)
    expect(res.headers.get("x-middleware-next")).toBe("1")
  })

  it("never resolves admin paths", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    await proxy(request("/admin/pages", "mk.session_token=abc"))
    expect(fetch).not.toHaveBeenCalled()
  })
})
```

Run: `pnpm vitest run --project unit proxy` → FAIL.

- [ ] **Step 6: Generalise the proxy**

In `proxy.ts`, replace the article-only block (`ARTICLE_PATH`, `articleRedirect`, its branch in `proxy()` and the `/insights/:slug` matcher) with:

```ts
// Ruling R1: no route matches this two-segment path, so Next renders
// app/global-not-found.tsx with a real 404 before anything streams
// (docs: file-conventions/loading.md "Status Codes").
export const NOT_FOUND_REWRITE = "/_missing/page"
// Next's draft-mode cookie: an editor previewing a draft page must reach it
// (Review Focus 1). Forging it only buys the in-shell soft 404.
const DRAFT_COOKIE = "__prerender_bypass"
const KINDS = new Set(["live", "pass", "missing", "redirect"])

type Resolution =
  | { kind: "live" | "pass" | "missing" }
  | { kind: "redirect"; destination: unknown; statusCode: unknown }

async function resolve(pathname: string): Promise<Resolution | null> {
  try {
    const url = new URL("/api/v1/resolve", internalOrigin())
    url.searchParams.set("path", pathname)
    const res = await fetch(url, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(300) })
    if (res.status !== 200) return null
    const body = (await res.json()) as Resolution
    return body && KINDS.has(body.kind) ? body : null
  } catch {
    return null
  }
}

function redirectTo(request: NextRequest, destination: unknown, statusCode: unknown) {
  if (!isSitePath(destination)) return null
  if (!REDIRECT_STATUSES.includes(statusCode as number)) return null
  const target = new URL(destination, request.url)
  if (target.origin !== request.nextUrl.origin) return null
  // Ruling R4: keep the visitor's query unless the destination has its own.
  if (!destination.includes("?")) {
    const params = new URLSearchParams(request.nextUrl.search)
    params.delete("_rsc")
    target.search = params.toString()
  }
  return NextResponse.redirect(target, statusCode as number)
}

// Ruling R2: every public page path asks the cached resolver over loopback.
// Fails open: on any doubt the request continues as before.
async function publicRoute(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next()
  if (request.cookies.has(DRAFT_COOKIE)) return NextResponse.next()
  const hit = await resolve(request.nextUrl.pathname)
  if (hit?.kind === "missing") {
    return NextResponse.rewrite(new URL(NOT_FOUND_REWRITE, request.url), { status: 404 })
  }
  if (hit?.kind === "redirect") {
    return redirectTo(request, hit.destination, hit.statusCode) ?? NextResponse.next()
  }
  return NextResponse.next()
}

const isAdmin = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/")
```

At the top of `proxy()`: `if (!isAdmin(pathname)) return publicRoute(request)` (the admin branch below stays as is). Keep `isSitePath` and `REDIRECT_STATUSES`. Matcher:

```ts
export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    // Every public page path; assets, the API, share cards and metadata
    // files never pay for a resolver hop. (A custom page whose address
    // starts with one of these words skips the resolver and keeps the
    // in-shell soft 404.)
    "/((?!api|_next|uploads|images|og|admin|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest).*)",
  ],
}
```

Update the file's header comment: "Admin: optimistic cookie check only. Public pages: the cached route resolver over HTTP (Rulings R1–R4). Never the database or server-only modules."

Run: `pnpm vitest run --project unit proxy` → PASS.


- [ ] **Step 7: Update the E2E that pinned soft 404s**

`tests/e2e/navigation/cms.spec.ts`: move `"/no-such-page"`, `"/privacy"`, `"/insights/nope"`, `"/insights/__shell"` and `"/__page"` into the real-404 loop, which now asserts status 404, the heading "Page not found", `meta[name="robots"][content*="noindex"]`, and the three helpful links by role and name ("Back to home", "Read the insights", "Get in touch"). Delete the soft-404 loop and `expectNotFoundPage`, and rewrite the comment: "Unknown CMS paths 404 in proxy (Ruling R1); deeper unknown paths 404 because no route matches." The "redirect keeps its query string" E2E needs the redirects admin API, so it lives in Task 9's `tests/e2e/admin/content/seo.spec.ts`; the proxy unit tests above already pin the behaviour.

`tests/e2e/admin/content/insights.spec.ts:95`: `expect(...status()).toBe(404) // real 404 until live (Ruling R1)`.

`tests/e2e/admin/content/insights-redirect.spec.ts`: expectations unchanged (301); re-run it.

- [ ] **Step 8: Run everything this task touches**

Run:

```bash
pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:integration -- resolve articles pages
pnpm build && pnpm exec playwright test tests/e2e/navigation tests/e2e/admin/content/insights.spec.ts tests/e2e/admin/content/insights-redirect.spec.ts tests/e2e/admin/content/preview.spec.ts --project=desktop --project=admin-desktop
pnpm test:parity && pnpm exec playwright test tests/e2e/perf --project=desktop
```

Expected: PASS. Parity unchanged; warm TTFB still under 200 ms (the resolver hop is a cached loopback call). If `next start` does not answer 404 for the rewrite, stop and report (do not ship soft 404s silently): the fallback to try is answering `new NextResponse(null, { status: 404, headers: { "x-middleware-rewrite": <url> } })`, then re-running `cms.spec.ts`.

- [ ] **Step 9: Commit**

```bash
git add lib server proxy.ts proxy.test.ts tests
git commit -m "feat(seo): proxy answers real 404s and redirects from a cached route table"
```

---

### Task 7: Redirect manager API — CRUD, chain flattening, loop rejection, page address changes

**Files:**
- Create: `lib/seo/redirect-rules.ts`, `server/modules/seo/routes.ts`, `server/modules/seo/redirects-service.ts`, `server/db/migrations/0008_seo.sql` (+ snapshot, journal; generated), `tests/integration/api/redirects-admin.test.ts`
- Modify: `server/db/schema/redirects.ts` (`pageId`), `server/modules/redirects/service.ts` (`createRedirect` flattens; `recordSlugChange` → `recordPathChange`), `server/modules/articles/publish.ts`, `server/modules/articles/service.ts` (unpublish uses the flattening writer), `server/modules/pages/{routes,schema,service}.ts` (`PATCH /:id/path`), `server/api/routes/admin.ts`, `admin/lib/api.ts`
- Test: `lib/seo/redirect-rules.test.ts`, `tests/integration/api/redirects-admin.test.ts`, `tests/integration/api/articles-publish.test.ts` (existing slug-change cases must still pass)

**Interfaces:**
- Consumes: Task 6 `getRouteTable` (only through the `redirects`/`routes` tags), `invalidate`, `audit`, `can()`.
- Produces:
  - `RedirectSource`, `RedirectDestination`, `RedirectInput` (`{ sourcePath, destination, statusCode: 301|302|307|308 = 301, note = "" }`), `RedirectPatch` (`{ destination?, statusCode?, isActive?, note? }`, non-empty), `RedirectListQuery` (`{ q?: string; page = 1; pageSize = 25 }`), `REDIRECT_STATUSES` — all in `lib/seo/redirect-rules.ts` (isomorphic, used by the admin form).
  - `createRedirect(db, entry: { from: string; to: string; statusCode?: number; articleId?: string | null; pageId?: string | null; note: string; createdBy: string | null }): Promise<{ to: string } | null>` — flattens and rejects loops (Ruling R5).
  - `recordPathChange(db, change: { from; to; articleId?: string | null; pageId?: string | null; note: string; createdBy }): Promise<void>` (replaces `recordSlugChange`).
  - Admin service (`server/modules/seo/redirects-service.ts`): `listRedirects(query)`, `createManualRedirect(actor, input)`, `updateRedirect(actor, id, patch)`, `deleteRedirect(actor, id)`. Rows: `{ id, sourcePath, destination, statusCode, isActive, hitCount, lastHitAt, note, automatic: boolean, shadowed: boolean, updatedAt }`. Writes return `{ redirect: Row, warning: string | null }`.
  - Routes under `/api/v1/admin/seo`: `GET /redirects` (`redirect.read`), `POST /redirects` → 201, `PATCH /redirects/:id`, `DELETE /redirects/:id` (`redirect.manage`). `seoApi = hc<SeoRoutes>("/api/v1/admin/seo")` in `admin/lib/api.ts`.
  - `PATCH /api/v1/admin/pages/:id/path { path }` (`page.update`) → `{ path, redirected: boolean }`; service `changePagePath(actor, id, path)`.
  - `LIVE_SOURCE_WARNING = "A live page is at this address, so the redirect waits until that page is unpublished or moved."`

- [ ] **Step 1: Write the failing rule tests**

`lib/seo/redirect-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { RedirectInput } from "./redirect-rules"

const parse = (v: Record<string, unknown>) =>
  RedirectInput.safeParse({ sourcePath: "/old", destination: "/new", ...v })

describe("RedirectInput", () => {
  it("normalises a trailing slash and defaults to 301", () => {
    const r = parse({ sourcePath: "/old-page/" })
    expect(r.success && r.data).toMatchObject({ sourcePath: "/old-page", statusCode: 301, note: "" })
  })
  it("accepts legacy shapes", () => {
    expect(parse({ sourcePath: "/blog/2019/post.html" }).success).toBe(true)
    expect(parse({ destination: "/contact?plan=programme" }).success).toBe(true)
  })
  it.each(["/", "/admin/x", "/api", "/og/about", "/_next/x", "/uploads/a.png", "/images/a.png", "/robots.txt", "/newsletter/confirmed", "old", "/a b", "/old?x=1", "//evil"])(
    "rejects source %s",
    (sourcePath) => expect(parse({ sourcePath }).success).toBe(false)
  )
  it.each(["https://evil.example", "//evil.example", "/\\evil", "new", "/a b"])(
    "rejects destination %s (Ruling R4)",
    (destination) => expect(parse({ destination }).success).toBe(false)
  )
  it("rejects other status codes", () => {
    expect(parse({ statusCode: 303 }).success).toBe(false)
  })
})
```

Run: `pnpm vitest run --project unit lib/seo/redirect-rules` → FAIL.

- [ ] **Step 2: Implement the rules**

`lib/seo/redirect-rules.ts`:

```ts
import * as z from "zod"

export const REDIRECT_STATUSES = [301, 302, 307, 308] as const

// Paths the platform owns or that never reach the resolver (proxy matcher).
const RESERVED = /^\/(?:admin|api|_next|uploads|images|og|newsletter)(?:\/|$)/
const FILES = new Set(["/favicon.ico", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest"])

// Stored exactly as proxy sees request.nextUrl.pathname: URL-safe characters
// only, no query, no trailing slash (Next 308s that away first).
export const RedirectSource = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v.length > 1 ? v.replace(/\/+$/, "") : v))
  .refine((v) => /^\/[A-Za-z0-9\-._~%/]*$/.test(v) && !v.startsWith("//"), "Use a path on this site, e.g. /old-page")
  .refine((v) => v !== "/", "The home page can't redirect")
  .refine((v) => !RESERVED.test(v) && !FILES.has(v), "That address is reserved")

// Ruling R4: site paths only, optionally with a query string.
export const RedirectDestination = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^\/(?![/\\])[^\s\\#]*$/.test(v), "Use a path on this site, e.g. /new-page")

const Status = z.union(REDIRECT_STATUSES.map((s) => z.literal(s)) as [z.ZodLiteral<301>, z.ZodLiteral<302>, z.ZodLiteral<307>, z.ZodLiteral<308>])

export const RedirectInput = z.object({
  sourcePath: RedirectSource,
  destination: RedirectDestination,
  statusCode: Status.default(301),
  note: z.string().trim().max(200).default(""),
})
export type RedirectInput = z.infer<typeof RedirectInput>

export const RedirectPatch = z
  .object({
    destination: RedirectDestination.optional(),
    statusCode: Status.optional(),
    isActive: z.boolean().optional(),
    note: z.string().trim().max(200).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change")

export const RedirectListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})
```

Run → PASS.

- [ ] **Step 3: Add `page_id` and generate the migration**

`server/db/schema/redirects.ts`: next to `articleId`, add

```ts
    // Set on rows the pages service made (Ruling R6); shown as automatic.
    pageId: uuid().references(() => pages.id, { onDelete: "set null" }),
```

(import `pages` from `./pages`). Run `pnpm db:generate --name seo`; the SQL must be one `ALTER TABLE "redirects" ADD COLUMN "page_id" uuid` plus its FK constraint. Run `pnpm db:migrate` against the dev database.

- [ ] **Step 4: Write the failing integration tests**

`tests/integration/api/redirects-admin.test.ts` (mock `next/cache` with `cacheTag`, `cacheLife`, `revalidateTag: next.revalidateTag` as in `pages.test.ts`; `expired()` reads the revalidated tags):

```ts
describe("redirects admin", () => {
  it("lets owner, admin, editor and marketer manage; others are refused", async () => {
    // §7.2: redirect.read · manage → owner, admin, editor, marketer.
    for (const role of ["owner", "admin", "editor", "marketer"] as const) {
      const cookie = await cookieFor(role)
      const res = await adminRequest("/seo/redirects", cookie, { method: "POST", body: { sourcePath: `/from-${role}`, destination: "/" } })
      expect(res.status, role).toBe(201)
    }
    for (const role of ["author", "intake", "viewer"] as const) {
      const cookie = await cookieFor(role)
      expect((await adminRequest("/seo/redirects", cookie)).status, role).toBe(403)
    }
  })

  it("creates, lists with hits, updates and deletes, auditing and expiring the tag", async () => {
    const cookie = await cookieFor("marketer")
    const created = await adminRequest("/seo/redirects", cookie, {
      method: "POST", body: { sourcePath: "/old-page/", destination: "/contact", statusCode: 308, note: "Old site" },
    })
    expect(created.status).toBe(201)
    const { redirect, warning } = await created.json()
    expect(redirect).toMatchObject({ sourcePath: "/old-page", destination: "/contact", statusCode: 308, automatic: false, shadowed: false })
    expect(warning).toBeNull()
    expect(expired()).toContain("redirects")
    const dupe = await adminRequest("/seo/redirects", cookie, { method: "POST", body: { sourcePath: "/old-page", destination: "/" } })
    expect(dupe.status).toBe(409)
    const list = await (await adminRequest("/seo/redirects?q=old", cookie)).json()
    expect(list).toMatchObject({ total: 1, items: [{ hitCount: 0 }] })
    const patched = await adminRequest(`/seo/redirects/${redirect.id}`, cookie, { method: "PATCH", body: { isActive: false } })
    expect((await patched.json()).redirect.isActive).toBe(false)
    expect((await adminRequest(`/seo/redirects/${redirect.id}`, cookie, { method: "DELETE" })).status).toBe(200)
    const actions = (await getDb().select().from(auditLogs)).map((a) => a.action)
    expect(actions).toEqual(expect.arrayContaining(["redirect.create", "redirect.update", "redirect.delete"]))
  })

  it("flattens chains (Review Focus 3)", async () => {
    const cookie = await cookieFor("editor")
    const post = (sourcePath: string, destination: string) =>
      adminRequest("/seo/redirects", cookie, { method: "POST", body: { sourcePath, destination } })
    await post("/a", "/b")
    await post("/b", "/c") // /a now points at /c
    const created = await (await post("/z", "/a")).json() // /z lands on /c directly
    expect(created.redirect.destination).toBe("/c")
    const rows = await getDb().select().from(redirects)
    expect(Object.fromEntries(rows.map((r) => [r.sourcePath, r.destination]))).toEqual({ "/a": "/c", "/b": "/c", "/z": "/c" })
  })

  it("rejects loops (Review Focus 3)", async () => {
    const cookie = await cookieFor("editor")
    await adminRequest("/seo/redirects", cookie, { method: "POST", body: { sourcePath: "/a", destination: "/b" } })
    const loop = await adminRequest("/seo/redirects", cookie, { method: "POST", body: { sourcePath: "/b", destination: "/a" } })
    expect(loop.status).toBe(400)
    expect((await loop.json()).error.fieldErrors.destination).toEqual(["That would create a redirect loop"])
    expect(await getDb().$count(redirects)).toBe(1)
  })

  it("warns when the source is live and marks the row shadowed (Review Focus 4)", async () => {
    const asset = await insertMedia()
    await insertPage({ path: "/about", systemKey: "about", document: heroDocument(asset.id), published: true })
    const cookie = await cookieFor("editor")
    const res = await adminRequest("/seo/redirects", cookie, { method: "POST", body: { sourcePath: "/about", destination: "/services" } })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.warning).toBe("A live page is at this address, so the redirect waits until that page is unpublished or moved.")
    expect(body.redirect.shadowed).toBe(true)
  })

  it("an unpublished article's redirect repoints chains that ended at it", async () => {
    // /x → /insights/old exists; unpublishing /insights/old with redirectTo /insights
    // must leave /x → /insights (Phase 5 minor, Ruling R5).
    const owner = await cookieFor("owner")
    const { category, author, media } = await insertTaxonomy()
    const article = await insertArticle({ slug: "old", categoryId: category.id, authorId: author.id, coverId: media.id })
    await getDb().insert(redirects).values({ sourcePath: "/x", destination: "/insights/old" })
    const res = await adminRequest(`/articles/${article.id}/unpublish`, owner, {
      method: "POST", body: { version: article.version, archive: false, redirectTo: "/insights" },
    })
    expect(res.status).toBe(200)
    const rows = await getDb().select().from(redirects)
    expect(Object.fromEntries(rows.map((r) => [r.sourcePath, r.destination]))).toEqual({ "/x": "/insights", "/insights/old": "/insights" })
  })
})

describe("page address change (Ruling R6)", () => {
  it("moves a published custom page and leaves an automatic 301", async () => {
    const asset = await insertMedia()
    const page = await insertPage({ path: "/team", document: heroDocument(asset.id), published: true })
    const editor = await cookieFor("editor")
    const res = await adminRequest(`/pages/${page.id}/path`, editor, { method: "PATCH", body: { path: "/our-team" } })
    expect(await res.json()).toEqual({ path: "/our-team", redirected: true })
    const [row] = await getDb().select().from(redirects)
    expect(row).toMatchObject({ sourcePath: "/team", destination: "/our-team", statusCode: 301, pageId: page.id })
    expect(expired()).toEqual(expect.arrayContaining(["routes", "redirects", `page:${page.id}`]))
    const list = await (await adminRequest("/seo/redirects", editor)).json()
    expect(list.items[0].automatic).toBe(true)
  })

  it("moves a draft page without a redirect, refuses system pages and taken addresses", async () => {
    const asset = await insertMedia()
    const draft = await insertPage({ path: "/draft", document: heroDocument(asset.id) })
    await insertPage({ path: "/taken", document: heroDocument(asset.id) })
    const about = await insertPage({ path: "/about", systemKey: "about", document: heroDocument(asset.id), published: true })
    const editor = await cookieFor("editor")
    const move = (id: string, path: string) => adminRequest(`/pages/${id}/path`, editor, { method: "PATCH", body: { path } })
    expect(await (await move(draft.id, "/moved")).json()).toEqual({ path: "/moved", redirected: false })
    expect((await move(draft.id, "/taken")).status).toBe(409)
    expect((await move(about.id, "/about-us")).status).toBe(403)
    expect((await move(draft.id, "/insights")).status).toBe(400)
    expect(await getDb().$count(redirects)).toBe(0)
  })
})
```

(Imports: `auditLogs`, `redirects` from the schema; `insertMedia`, `insertPage`, `heroDocument`, `insertTaxonomy`, `insertArticle` from the helpers. The unpublish call matches `POST /articles/:id/unpublish` with `UnpublishInput` `{ version, archive, redirectTo }`.)

Run: `pnpm test:integration -- redirects-admin` → FAIL.

- [ ] **Step 5: Make every writer flatten**

`server/modules/redirects/service.ts` — replace `createRedirect` and `recordSlugChange`:

```ts
import { and, eq, sql } from "drizzle-orm"

import { ApiError } from "@/server/api/errors"

const MAX_HOPS = 10
const LOOP = "That would create a redirect loop"
const pathOf = (target: string) => target.split("?")[0]!

// Ruling R5: where `to` finally lands, following active redirects.
async function finalTarget(db: DbLike, from: string, to: string) {
  const seen = new Set([from])
  let target = to
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (seen.has(pathOf(target))) {
      throw new ApiError("VALIDATION_FAILED", LOOP, { destination: [LOOP] })
    }
    seen.add(pathOf(target))
    const [next] = await db
      .select({ destination: redirects.destination })
      .from(redirects)
      .where(and(eq(redirects.sourcePath, pathOf(target)), eq(redirects.isActive, true)))
      .limit(1)
    if (!next) return target
    target = next.destination
  }
  throw new ApiError("VALIDATION_FAILED", LOOP, { destination: [LOOP] })
}

// Every writer goes through here: the new row points at the final target,
// and every chain that ended at `from` now ends there directly.
export async function createRedirect(
  db: DbLike,
  entry: {
    from: string
    to: string
    statusCode?: number
    articleId?: string | null
    pageId?: string | null
    note: string
    createdBy: string | null
  }
) {
  if (entry.from === pathOf(entry.to)) return null
  const to = await finalTarget(db, entry.from, entry.to)
  await db.update(redirects).set({ destination: to }).where(eq(redirects.destination, entry.from))
  const values = {
    destination: to,
    statusCode: entry.statusCode ?? 301,
    isActive: true,
    articleId: entry.articleId ?? null,
    pageId: entry.pageId ?? null,
    note: entry.note,
  }
  await db
    .insert(redirects)
    .values({ sourcePath: entry.from, createdBy: entry.createdBy, ...values })
    .onConflictDoUpdate({ target: redirects.sourcePath, set: values })
  return { to }
}

// docs/brief.md §11 "created automatically when a slug changes" — articles
// and custom pages. Free the new path, then add old → new (which flattens).
export async function recordPathChange(
  db: DbLike,
  change: { from: string; to: string; articleId?: string | null; pageId?: string | null; note: string; createdBy: string | null }
) {
  if (change.from === change.to) return
  await releasePath(db, change.to)
  await createRedirect(db, change)
}
```

Update `server/modules/articles/publish.ts`: `recordSlugChange(tx, { articleId, from, to, createdBy })` → `recordPathChange(tx, { articleId, from, to, createdBy, note: "Automatic: the article's slug changed" })`. `unpublishArticle` already calls `createRedirect` and so now flattens; nothing else changes there. Manual creation (Step 6) does **not** call `releasePath`: a manual redirect never deletes another row.

- [ ] **Step 6: The admin service, routes and page address change**

`server/modules/seo/redirects-service.ts`:

```ts
import "server-only"

import { and, count, desc, eq, ilike, or } from "drizzle-orm"

import type { RedirectInput } from "@/lib/seo/redirect-rules"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { articles, pages, redirects } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { createRedirect } from "@/server/modules/redirects/service"

export const LIVE_SOURCE_WARNING =
  "A live page is at this address, so the redirect waits until that page is unpublished or moved."

async function livePaths(db: DbLike) {
  const [p, a] = await Promise.all([
    db.select({ path: pages.path }).from(pages).where(eq(pages.status, "published")),
    db.select({ slug: articles.slug }).from(articles).where(eq(articles.status, "published")),
  ])
  return new Set([...p.map((r) => r.path), ...a.map((r) => `/insights/${r.slug}`)])
}

type Row = typeof redirects.$inferSelect
const present = (r: Row, live: Set<string>) => ({
  id: r.id,
  sourcePath: r.sourcePath,
  destination: r.destination,
  statusCode: r.statusCode,
  isActive: r.isActive,
  hitCount: r.hitCount,
  lastHitAt: r.lastHitAt,
  note: r.note,
  automatic: r.articleId !== null || r.pageId !== null,
  shadowed: live.has(r.sourcePath),
  updatedAt: r.updatedAt,
})

export async function listRedirects(q: { q?: string; page: number; pageSize: number }) {
  const db = getDb()
  const where = q.q ? or(ilike(redirects.sourcePath, `%${q.q}%`), ilike(redirects.destination, `%${q.q}%`)) : undefined
  const [rows, [{ total }], live] = await Promise.all([
    db.select().from(redirects).where(where).orderBy(desc(redirects.updatedAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
    db.select({ total: count() }).from(redirects).where(where),
    livePaths(db),
  ])
  return { items: rows.map((r) => present(r, live)), page: q.page, pageSize: q.pageSize, total }
}

async function findRow(db: DbLike, id: string) {
  const [row] = await db.select().from(redirects).where(eq(redirects.id, id)).limit(1)
  if (!row) throw new ApiError("NOT_FOUND", "Redirect not found")
  return row
}

export async function createManualRedirect(actor: Actor, input: RedirectInput) {
  const result = await getDb().transaction(async (tx) => {
    const [taken] = await tx.select({ id: redirects.id }).from(redirects).where(eq(redirects.sourcePath, input.sourcePath))
    if (taken) throw new ApiError("CONFLICT", "A redirect from that address already exists", { sourcePath: ["A redirect from that address already exists"] })
    await createRedirect(tx, { from: input.sourcePath, to: input.destination, statusCode: input.statusCode, note: input.note, createdBy: actor.userId })
    const [row] = await tx.select().from(redirects).where(eq(redirects.sourcePath, input.sourcePath))
    if (!row) throw new ApiError("VALIDATION_FAILED", "A redirect can't point at itself", { destination: ["A redirect can't point at itself"] })
    await audit(actor, { action: "redirect.create", entityType: "redirect", entityId: row.id, summary: `Redirect ${row.sourcePath} → ${row.destination}` }, tx)
    const live = await livePaths(tx)
    return { redirect: present(row, live), warning: live.has(row.sourcePath) ? LIVE_SOURCE_WARNING : null }
  })
  invalidate([tags.redirects])
  return result
}
```

`updateRedirect(actor, id, patch)`: in a transaction, `findRow` (404), and when `patch.destination` is given run `createRedirect(tx, { from: row.sourcePath, to: patch.destination, statusCode: patch.statusCode ?? row.statusCode, articleId: row.articleId, pageId: row.pageId, note: patch.note ?? row.note, createdBy: row.createdBy })` (flattening + loop check), then `tx.update(redirects).set({ statusCode, isActive, note })` for the remaining fields; audit `redirect.update` with a `diff` of the changed fields; return `{ redirect, warning }` like create; `invalidate([tags.redirects])`. `deleteRedirect(actor, id)`: `findRow`, delete, audit `redirect.delete` (`summary: "Removed redirect /a → /b"`), invalidate, `{ ok: true }`.

`server/modules/seo/routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { RedirectInput, RedirectListQuery, RedirectPatch } from "@/lib/seo/redirect-rules"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import * as service from "./redirects-service"

const id = zValidator("param", z.object({ id: z.uuid() }), validationHook)
const manage = can({ redirect: ["manage"] })

// docs/brief.md §8.3 SEO row. GET /overview joins in Task 8.
export const seoRoutes = new Hono<AppEnv>()
  .get("/redirects", can({ redirect: ["read"] }), zValidator("query", RedirectListQuery, validationHook), async (c) =>
    c.json(await service.listRedirects(c.req.valid("query")))
  )
  .post("/redirects", manage, zValidator("json", RedirectInput, validationHook), async (c) =>
    c.json(await service.createManualRedirect(c.get("actor")!, c.req.valid("json")), 201)
  )
  .patch("/redirects/:id", manage, id, zValidator("json", RedirectPatch, validationHook), async (c) =>
    c.json(await service.updateRedirect(c.get("actor")!, c.req.valid("param").id, c.req.valid("json")))
  )
  .delete("/redirects/:id", manage, id, async (c) =>
    c.json(await service.deleteRedirect(c.get("actor")!, c.req.valid("param").id))
  )

export type SeoRoutes = typeof seoRoutes
```

Mount it in `server/api/routes/admin.ts`: `.route("/seo", seoRoutes)`. Add `seoApi` to `admin/lib/api.ts` and `queryKeys.seo = { all: ["seo"], overview: ["seo", "overview"], redirects: (params: object) => ["seo", "redirects", params] }` to `admin/lib/query-keys.ts`.

Page address change — `server/modules/pages/schema.ts`: `export const PathInput = z.object({ path: CustomPagePath })`. `server/modules/pages/routes.ts`: `.patch("/:id/path", can({ page: ["update"] }), id, zValidator("json", PathInput, validationHook), async (c) => c.json(await pagesService.changePagePath(c.get("actor")!, c.req.valid("param").id, c.req.valid("json").path)))`. `server/modules/pages/service.ts`:

```ts
export async function changePagePath(actor: Actor, id: string, path: string) {
  const result = await getDb().transaction(async (tx) => {
    const row = await findPage(tx, id, true)
    if (row.systemKey) throw new ApiError("FORBIDDEN", "System pages keep their address")
    if (row.path === path) return { path, redirected: false }
    const [taken] = await tx.select({ id: pages.id }).from(pages).where(eq(pages.path, path))
    if (taken) throw new ApiError("CONFLICT", "A page already lives at that address", { path: ["A page already lives at that address"] })
    await tx.update(pages).set({ path, updatedBy: actor.userId }).where(eq(pages.id, id))
    const redirected = row.status === "published"
    if (redirected) {
      await recordPathChange(tx, { from: row.path, to: path, pageId: id, note: "Automatic: the page's address changed", createdBy: actor.userId })
    }
    await audit(actor, { action: "page.path", entityType: "page", entityId: id, summary: `Moved ${row.path} to ${path}`, diff: { path: { from: row.path, to: path } } }, tx)
    return { path, redirected }
  })
  invalidate([tags.page(id), tags.routes, ...(result.redirected ? [tags.redirects] : [])])
  return result
}
```

(`CustomPagePath` already rejects reserved segments with a 400. `findPage` throws `NOT_FOUND` for an unknown id.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test:integration -- redirects-admin resolve articles-publish articles pages permission-matrix`
Expected: PASS. If `permission-matrix.test.ts` enumerates every admin route, add the four SEO routes and `PATCH /pages/:id/path` to it with their §7.2 permissions.

- [ ] **Step 8: Commit**

```bash
git add lib server admin/lib tests
git commit -m "feat(seo): redirect manager api with chain flattening and page address changes"
```

---

### Task 8: SEO health service and the SEO center (overview, defaults, redirects)

**Files:**
- Create: `lib/seo/checks.ts`, `server/modules/seo/health.ts`, `admin/modules/seo/{seo-overview-view,seo-defaults-view,redirects-view,redirect-dialog,crawl-preview,queries}.tsx`, `app/(admin)/admin/(panel)/seo/page.tsx`, `app/(admin)/admin/(panel)/seo/defaults/page.tsx`, `app/(admin)/admin/(panel)/seo/redirects/page.tsx`
- Modify: `server/modules/seo/routes.ts` (`GET /overview`), `server/modules/seo/queries.ts` (`getSeoHealth`), `tests/e2e/admin/shell/navigation.spec.ts` (SEO pages are no longer placeholders)
- Test: `lib/seo/checks.test.ts`, `tests/integration/api/seo-health.test.ts`, `admin/modules/seo/redirects-view.test.tsx`

**Interfaces:**
- Consumes: Task 1 `documentTitle`, `isShareImageSize`; Task 3 `listLiveEntities`; Task 7 `seoApi`, `queryKeys.seo`, `RedirectInput`; `collectMediaIds` (`blocks/media-refs.ts`); `Gauge`, `PageHeader`, `DataTable`, `DataTablePagination`, `StatusPill`, `EmptyState`, `CardSkeleton`, `GlobalEditor`, `usePermission`.
- Produces:
  - `lib/seo/checks.ts`: `TITLE_RANGE = [30, 60]`, `DESCRIPTION_RANGE = [70, 160]`, `type CheckId = "title-length" | "title-unique" | "description" | "og-image" | "alt-text" | "h1" | "indexable" | "internal-link"`, `type CheckInput = { title: string; titleUnique: boolean; description: string | null; ogImage: { width: number; height: number } | null; imagesMissingAlt: number; hasH1: boolean; noindex: boolean; internalLinks: number }`, `type CheckResult = { id: CheckId; ok: boolean; message: string }`, `runChecks(input: CheckInput): CheckResult[]`.
  - `server/modules/seo/health.ts`: `type SeoIssue = { kind: "page" | "article" | "media"; id: string; title: string; path: string | null; check: CheckId; message: string; fixHref: string }`, `type SeoHealth = { score: number; passed: number; total: number; entities: number; issues: SeoIssue[]; alt: { images: number; described: number; decorative: number; missing: number } }`, `computeSeoHealth(db?: DbLike, origin?: string): Promise<SeoHealth>`.
  - `getSeoHealth(): Promise<SeoHealth>` (cached, Ruling R11) and `GET /api/v1/admin/seo/overview` (`seo.read`) → `SeoHealth`.

- [ ] **Step 1: Write the failing check tests**

`lib/seo/checks.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { runChecks } from "./checks"

const good = {
  title: "Clinical hypnotherapy in Dublin | Magda Kennedy", // 47
  titleUnique: true,
  description: "Evidence-based clinical hypnotherapy for anxiety, sleep and confidence, in Dublin or online.", // 90
  ogImage: null,
  imagesMissingAlt: 0,
  hasH1: true,
  noindex: false,
  internalLinks: 2,
}
const failing = (input: Partial<typeof good>) =>
  runChecks({ ...good, ...input }).filter((r) => !r.ok).map((r) => r.id)

describe("runChecks (docs/brief.md §11)", () => {
  it("passes a healthy entity, generated card included", () => {
    expect(failing({})).toEqual([])
  })
  it("flags each rule on its own", () => {
    expect(failing({ title: "About | MK" })).toEqual(["title-length"])
    expect(failing({ titleUnique: false })).toEqual(["title-unique"])
    expect(failing({ description: null })).toEqual(["description"])
    expect(failing({ description: "Too short." })).toEqual(["description"])
    expect(failing({ ogImage: { width: 800, height: 800 } })).toEqual(["og-image"])
    expect(failing({ imagesMissingAlt: 2 })).toEqual(["alt-text"])
    expect(failing({ hasH1: false })).toEqual(["h1"])
    expect(failing({ noindex: true })).toEqual(["indexable"])
    expect(failing({ internalLinks: 0 })).toEqual(["internal-link"])
  })
  it("explains failures in plain words", () => {
    const [title] = runChecks({ ...good, title: "About | MK" })
    expect(title!.message).toBe("Title is 10 characters (aim for 30–60)")
  })
})
```

Run: `pnpm vitest run --project unit lib/seo/checks` → FAIL.

- [ ] **Step 2: Implement the checks**

`lib/seo/checks.ts`:

```ts
import { isShareImageSize } from "./share-image"

export const TITLE_RANGE = [30, 60] as const
export const DESCRIPTION_RANGE = [70, 160] as const

export type CheckId = "title-length" | "title-unique" | "description" | "og-image" | "alt-text" | "h1" | "indexable" | "internal-link"
export type CheckInput = {
  title: string
  titleUnique: boolean
  description: string | null
  // null: the generated 1200×630 card (always the right size).
  ogImage: { width: number; height: number } | null
  imagesMissingAlt: number
  hasH1: boolean
  noindex: boolean
  internalLinks: number
}
export type CheckResult = { id: CheckId; ok: boolean; message: string }

const within = (n: number, [min, max]: readonly [number, number]) => n >= min && n <= max

// docs/brief.md §11 health checks; shared by the SEO center and the editors.
export function runChecks(i: CheckInput): CheckResult[] {
  const d = i.description?.length ?? 0
  return [
    { id: "title-length", ok: within(i.title.length, TITLE_RANGE), message: `Title is ${i.title.length} characters (aim for 30–60)` },
    { id: "title-unique", ok: i.titleUnique, message: i.titleUnique ? "Title is unique" : "Another page has the same title" },
    { id: "description", ok: within(d, DESCRIPTION_RANGE), message: d ? `Description is ${d} characters (aim for 70–160)` : "Add a meta description" },
    { id: "og-image", ok: i.ogImage === null || isShareImageSize(i.ogImage), message: i.ogImage === null ? "Uses the generated share card" : isShareImageSize(i.ogImage) ? "Share image is the right size" : "Share image should be at least 1200×630 (1.91:1)" },
    { id: "alt-text", ok: i.imagesMissingAlt === 0, message: i.imagesMissingAlt === 0 ? "Every image has alt text" : `${i.imagesMissingAlt} image${i.imagesMissingAlt === 1 ? "" : "s"} missing alt text` },
    { id: "h1", ok: i.hasH1, message: i.hasH1 ? "Has a main heading" : "No main heading (H1)" },
    { id: "indexable", ok: !i.noindex, message: i.noindex ? "Hidden from search engines" : "Visible to search engines" },
    { id: "internal-link", ok: i.internalLinks > 0, message: i.internalLinks > 0 ? `${i.internalLinks} internal link${i.internalLinks === 1 ? "" : "s"}` : "No links to other pages on this site" },
  ]
}
```

Run → PASS.

- [ ] **Step 3: Write the failing health integration test**

`tests/integration/api/seo-health.test.ts` (mock `next/cache` as usual):

```ts
describe("GET /seo/overview", () => {
  it("scores live entities, lists issues with fix links and counts alt coverage", async () => {
    const described = await insertMedia({ alt: "Magda in the clinic", width: 1600, height: 900 })
    const bare = await insertMedia({ alt: "", filename: "bare.jpg" })
    const decorative = await insertMedia({ alt: "", isDecorative: true })
    await getDb().insert(settings).values({ key: "seo", value: { titleTemplate: "%s | Magda Kennedy", defaultTitle: "Magda Kennedy: Clinical Hypnotherapist" } })
    const about = await insertPage({ path: "/about", systemKey: "about", document: heroDocument(bare.id, "About"), published: true })
    await insertPage({ path: "/draft", document: heroDocument(described.id) }) // not live: ignored
    const { category, author } = await insertTaxonomy()
    await insertArticle({ slug: "calm", categoryId: category.id, authorId: author.id, coverId: decorative.id })
    const cookie = await cookieFor("viewer") // seo.read
    const res = await adminRequest("/seo/overview", cookie)
    expect(res.status).toBe(200)
    const health = await res.json()
    expect(health.entities).toBe(2)
    expect(health.total).toBe(16)
    expect(health.score).toBe(Math.round((health.passed / 16) * 100))
    const aboutIssues = health.issues.filter((i: { id: string }) => i.id === about.id).map((i: { check: string }) => i.check)
    expect(aboutIssues).toEqual(expect.arrayContaining(["title-length", "description", "alt-text"]))
    expect(health.issues.find((i: { check: string }) => i.check === "alt-text").fixHref).toBe(`/admin/pages/${about.id}?tab=seo`)
    expect(health.issues).toContainEqual(expect.objectContaining({ kind: "media", id: bare.id, fixHref: "/admin/media?missingAlt=true&q=bare.jpg" }))
    expect(health.alt).toMatchObject({ missing: 1, decorative: 1 })
    expect((await adminRequest("/seo/overview", await cookieFor("intake"))).status).toBe(403)
  })
})
```

(The taxonomy author's avatar comes from `insertTaxonomy`'s own media row; `alt.images` therefore counts it too — assert only `missing` and `decorative`.)

Run: `pnpm test:integration -- seo-health` → FAIL.

- [ ] **Step 4: Implement the health service**

`server/modules/seo/health.ts`:

```ts
import "server-only"

import { eq, inArray } from "drizzle-orm"

import { collectMediaIds } from "@/blocks/media-refs"
import type { PageDocument } from "@/blocks/page"
import { parseGlobal } from "@/lib/content/globals"
import { runChecks, type CheckId } from "@/lib/seo/checks"
import { documentTitle } from "@/lib/seo/title"
import { getDb, type DbLike } from "@/server/db/client"
import { media, settings } from "@/server/db/schema"
import { getEnv } from "@/server/env"

import { listLiveEntities, type LiveEntity } from "./live"

// Blocks whose component renders the page's <h1> (components/page-hero.tsx,
// features/hero/components/hero-content.tsx). Rich text only allows h2/h3
// (blocks/rich-text.ts Heading), so a custom page needs a hero for its h1.
const H1_BLOCKS = new Set(["hero.home", "hero.page"])
// Blocks that always render links to other pages (cards, CTAs).
const LINKING_BLOCKS = new Set(["insights.latest", "insights.browser", "band", "services.plans"])

// Every string under an "href" key, and every rich-text link mark.
function hrefs(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => hrefs(v, out))
  else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (key === "href" && typeof v === "string") out.push(v)
      else hrefs(v, out)
    }
  }
  return out
}
const isInternal = (href: string, origin: string) => href.startsWith("/") || href.startsWith(origin)

function hasH1(e: LiveEntity) {
  if (e.kind === "article") return true // ArticleHero renders the title as <h1>.
  const blocks = (e.document as PageDocument).blocks.filter((b) => !b.hidden)
  return blocks.some((b) => H1_BLOCKS.has(b.type))
}

function internalLinks(e: LiveEntity, origin: string) {
  if (e.kind === "article") return hrefs(e.body).filter((h) => isInternal(h, origin)).length
  const blocks = (e.document as PageDocument).blocks.filter((b) => !b.hidden)
  return blocks.filter((b) => LINKING_BLOCKS.has(b.type)).length + hrefs(blocks.map((b) => b.data)).filter((h) => isInternal(h, origin)).length
}

const fixHref = (e: LiveEntity) => (e.kind === "page" ? `/admin/pages/${e.id}?tab=seo` : `/admin/insights/${e.id}?tab=seo`)

export async function computeSeoHealth(db: DbLike = getDb(), origin = getEnv().SITE_URL.replace(/\/$/, "")) {
  const [live, [seoRow]] = await Promise.all([
    listLiveEntities(db),
    db.select().from(settings).where(eq(settings.key, "seo")).limit(1),
  ])
  const seo = parseGlobal("seo", seoRow?.value)
  const idsOf = (e: LiveEntity) => collectMediaIds(e.kind === "page" ? e.document : e.body)
  const allIds = [...new Set(live.flatMap((e) => [...idsOf(e), ...(e.seo.ogImage ? [e.seo.ogImage.mediaId] : [])]))]
  const rows = allIds.length
    ? await db.select({ id: media.id, alt: media.alt, isDecorative: media.isDecorative, width: media.width, height: media.height, filename: media.filename }).from(media).where(inArray(media.id, allIds))
    : []
  const byId = new Map(rows.map((r) => [r.id, r]))
  const missingAlt = (id: string) => {
    const r = byId.get(id)
    return r !== undefined && !r.isDecorative && r.alt.trim() === ""
  }
  const titles = live.map((e) => documentTitle({ home: e.home, title: e.title, seoTitle: e.seo.title }, seo))
  const issues: SeoIssue[] = []
  let passed = 0
  let total = 0
  live.forEach((e, i) => {
    const og = e.seo.ogImage ? byId.get(e.seo.ogImage.mediaId) : undefined
    const results = runChecks({
      title: titles[i]!,
      titleUnique: titles.indexOf(titles[i]!) === titles.lastIndexOf(titles[i]!),
      description: e.seo.description ?? e.summary,
      ogImage: og && og.width && og.height ? { width: og.width, height: og.height } : null,
      imagesMissingAlt: idsOf(e).filter(missingAlt).length,
      hasH1: hasH1(e),
      noindex: e.seo.noindex,
      internalLinks: internalLinks(e, origin),
    })
    for (const r of results) {
      total++
      if (r.ok) passed++
      else issues.push({ kind: e.kind, id: e.id, title: e.title, path: e.path, check: r.id, message: r.message, fixHref: fixHref(e) })
    }
  })
  // One issue per undescribed image too, linking to the media library.
  for (const r of rows) {
    if (!r.isDecorative && r.alt.trim() === "") {
      issues.push({ kind: "media", id: r.id, title: r.filename, path: null, check: "alt-text", message: "Image has no alt text", fixHref: `/admin/media?missingAlt=true&q=${encodeURIComponent(r.filename)}` })
    }
  }
  return {
    score: total ? Math.round((passed / total) * 100) : 100,
    passed,
    total,
    entities: live.length,
    issues,
    alt: {
      images: rows.length,
      described: rows.filter((r) => r.alt.trim() !== "").length,
      decorative: rows.filter((r) => r.isDecorative).length,
      missing: rows.filter((r) => !r.isDecorative && r.alt.trim() === "").length,
    },
  }
}

export type SeoIssue = { kind: "page" | "article" | "media"; id: string; title: string; path: string | null; check: CheckId; message: string; fixHref: string }
export type SeoHealth = Awaited<ReturnType<typeof computeSeoHealth>>
```

Append to `server/modules/seo/queries.ts`:

```ts
import { computeSeoHealth } from "./health"
import { listLiveEntities } from "./live"

// Ruling R11: cached; page SEO saves expire page:<id>, article SEO saves
// expire `articles`, media edits `media`, defaults `settings:seo`.
export async function getSeoHealth() {
  "use cache"
  cacheTag(tags.routes, tags.articles, tags.media, tags.setting("seo"))
  cacheLife("max")
  for (const e of await listLiveEntities()) if (e.kind === "page") cacheTag(tags.page(e.id))
  return computeSeoHealth()
}
```

Route: `.get("/overview", can({ seo: ["read"] }), async (c) => c.json(await getSeoHealth()))` in `server/modules/seo/routes.ts`. Run `pnpm test:integration -- seo-health` → PASS.

- [ ] **Step 5: Build the SEO center pages**

Each page mirrors `app/(admin)/admin/(panel)/newsletter/page.tsx`: `metadata.title`, `Suspense` + `Gate` → `requirePermission(permissionFor("<href>"))` → the view. The real folders replace the `[section]` placeholder for `/admin/seo`, `/admin/seo/defaults` and `/admin/seo/redirects`.

UI spec (quoted labels are load-bearing for E2E):
- **Overview** (`/admin/seo`, `SeoOverviewView`): `PageHeader` `<h1>` **"SEO"**, description "How search engines see the site." A `Gauge` titled **"SEO health"** with parts `passed` (solid, "Passing checks") and `failed` (hatched, "Needs work"), `centerLabel="Healthy"`. Beside it a card **"Alt text"**: "N of M images described", "D decorative", and a link **"Find images without alt text"** → `/admin/media?missingAlt=true`. Below, a card **"Issues"** (`role="list"`, `aria-label="Issues"`): one row per issue grouped by entity (title + path in mono), the message, and a **"Fix"** link to `fixHref`. Empty: `EmptyState` "No issues. Every live page passes the checks."
- **Defaults** (`/admin/seo/defaults`, `SeoDefaultsView`): `<GlobalEditor title="SEO defaults" keys={["seo"]} />` (Ruling R10; it already shows title template, default title/description, default share image, robots policy, verification codes and business details, with the `seo.update` permission gate). Below it a `CrawlPreview` card **"What crawlers see"** with two tabs **"robots.txt"** and **"Sitemap"**: `useQuery` fetching `/robots.txt` (text, shown in a `<pre>`) and `/sitemap.xml` (count of `<loc>` entries + the first 20 URLs as a list), each with an **"Open"** link in a new tab. A note: "Outside production, robots.txt blocks every crawler."
- **Redirects** (`/admin/seo/redirects`, `RedirectsView`): `<h1>` **"Redirects"**, a search input `aria-label="Search redirects"` (debounced into `q`, nuqs), **"New redirect"** button (only with `redirect.manage`). `DataTable` columns **From**, **To**, **Type** (`301 Permanent · 302 Temporary · 307 Temporary · 308 Permanent`), **Hits**, **Last hit** (Dublin time via `formatDate`, "Never"), **Status** (`StatusPill`: "Active" success, "Off" neutral, "Inactive while the page is live" warning when `shadowed`), and a badge **"Automatic"** next to From when `automatic`. Row actions (manage only): **"Edit"**, **"Turn off"/"Turn on"**, **"Delete"** (confirm `Dialog` **"Delete this redirect?"**). `RedirectDialog` (create/edit): `SchemaForm` over `RedirectInput` (labels **"From"**, **"To"**, **"Type"**, **"Note"**; From disabled when editing), shows server `fieldErrors` inline, and after a save with `warning` shows it as a `toast.warning`. Empty: "No redirects yet. Renamed articles and moved pages add theirs automatically."

- [ ] **Step 6: Component test and navigation spec**

`admin/modules/seo/redirects-view.test.tsx` (scaffolding copied from `admin/modules/leads/lead-drawer.test.tsx`: QueryClient, `ActorProvider`, a `fetch` mock): with roles `["marketer"]` and a list response holding one shadowed automatic row, assert the row shows "Automatic" and "Inactive while the page is live"; with roles `["viewer"]` assert no "New redirect" button. A second case submits the dialog against a mocked 400 `{ error: { fieldErrors: { destination: ["That would create a redirect loop"] } } }` and expects that text under **"To"**.

`tests/e2e/admin/shell/navigation.spec.ts`: the SEO entries now open real pages (`<h1>` "SEO", "SEO defaults", "Redirects"); drop them from any placeholder list.

- [ ] **Step 7: Run and commit**

Run: `pnpm vitest run --project unit lib/seo admin/modules/seo && pnpm test:integration -- seo-health && pnpm typecheck && pnpm lint && pnpm build && pnpm exec playwright test tests/e2e/admin/shell/navigation.spec.ts --project=admin-desktop`
Expected: PASS.

```bash
git add lib server admin app tests
git commit -m "feat(seo): health score and the seo center with defaults and redirects"
```

---

### Task 9: Editor SEO panels, acceptance E2E, Lighthouse and phase exit

**Files:**
- Create: `admin/modules/seo/serp-preview.tsx`, `admin/modules/seo/social-card.tsx`, `admin/modules/seo/seo-checklist.tsx`, `admin/modules/seo/seo-fields.ts`, `admin/modules/pages/address-form.tsx`, `tests/e2e/admin/content/seo.spec.ts`, `tests/e2e/perf/lighthouse-seo.spec.ts`
- Modify: `admin/components/schema-form/schema-form.tsx` (`onValuesChange`), `admin/modules/pages/seo-form.tsx`, `admin/modules/pages/page-builder.tsx` (`?tab=` binding, address form), `admin/modules/insights/article-seo-form.tsx`, `admin/modules/insights/article-editor-view.tsx` (`?tab=` binding, slug auto-redirect notice), `docs/deploy-dokploy.md`, `.superpowers/sdd/plan/progress.md`
- Test: `admin/components/schema-form/schema-form.test.tsx` (append), `admin/modules/seo/serp-preview.test.tsx`, the two E2E specs

**Interfaces:**
- Consumes: Task 1 `documentTitle`, `SeoPatch`, `TWITTER_CARDS`; Task 8 `runChecks`; Task 7 `PATCH /pages/:id/path`, `seoApi`.
- Produces:
  - `SchemaForm` gains `onValuesChange?: (values: z.input<S>) => void` (called from a `form.watch` subscription, unsubscribed on unmount).
  - `SeoMetaFields` (`admin/modules/seo/seo-fields.ts`): the shared Zod form object for both editors (`seoTitle`, `description`, `ogTitle`, `ogDescription`, `ogImage`, `canonical`, `twitterCard`, `noindex`) and `toSeoPatch(values): SeoPatch`.
  - `<SerpPreview path title description />`, `<SocialCard title description imageSrc siteHost />`, `<SeoChecklist input={CheckInput} />` (renders `runChecks` with the existing `Check` row style; only the checks an editor can judge locally: title length, description, og image, indexable — the others need the whole site and live in the SEO center).

- [ ] **Step 1: Write the failing component tests**

Append to `admin/components/schema-form/schema-form.test.tsx`:

```tsx
it("reports values as the user types", async () => {
  const seen: unknown[] = []
  render(
    <SchemaForm
      schema={z.object({ title: z.string().max(70).register(ui, { label: "Title" }) })}
      defaultValues={{ title: "" }}
      submitLabel="Save"
      onSubmit={() => undefined}
      onValuesChange={(v) => seen.push(v)}
    />
  )
  await userEvent.type(screen.getByLabelText("Title"), "Hi")
  expect(seen.at(-1)).toEqual({ title: "Hi" })
})
```

`admin/modules/seo/serp-preview.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { SerpPreview } from "./serp-preview"
import { SocialCard } from "./social-card"

describe("previews", () => {
  it("shows the URL, title and description as a result would", () => {
    render(<SerpPreview url="magdakennedy.ie › about" title="About | Magda Kennedy" description="Who I am." />)
    expect(screen.getByText("magdakennedy.ie › about")).toBeTruthy()
    expect(screen.getByText("About | Magda Kennedy")).toBeTruthy()
  })
  it("falls back to a placeholder description", () => {
    render(<SerpPreview url="x" title="T" description="" />)
    expect(screen.getByText("No description yet.")).toBeTruthy()
  })
  it("renders the social card with its image", () => {
    render(<SocialCard siteHost="magdakennedy.ie" title="Meet Magda" description="Who I am." imageSrc="/og/about?v=1" />)
    expect(screen.getByRole("img", { name: "Share image preview" }).getAttribute("src")).toBe("/og/about?v=1")
  })
})
```

Run: `pnpm vitest run --project unit admin/components/schema-form admin/modules/seo` → FAIL.

- [ ] **Step 2: Implement the shared panel**

`SchemaForm`: add the prop and

```tsx
useEffect(() => {
  if (!onValuesChange) return
  const sub = form.watch((values) => onValuesChange(values as z.input<S>))
  return () => sub.unsubscribe()
}, [form, onValuesChange])
```

`admin/modules/seo/seo-fields.ts`: `SeoMetaFields` registers labels **"SEO title"**, **"Meta description"** (textarea), **"Social title"**, **"Social description"** (textarea), **"Social share image"** (`ogImage`), **"Canonical address"** (description "Leave empty to use this page's own address."), **"Card type"** (`twitterCard`, options "Large image" / "Small image"), **"Hide from search engines"**. Max lengths come from `SeoPatch` (70/200/70/200/300), so the existing live counters show automatically. `toSeoPatch` turns empty strings into `null`.

`SerpPreview` reuses the markup already in `admin/modules/pages/seo-form.tsx` (the "In search results" card), with the URL line rendered as `host › segments`. `SocialCard`: a 1.91:1 bordered card, `<img alt="Share image preview">` (plain `img`, not `next/image`: the generated `/og/…` URL is dynamic), host in small caps, title, two-line description. `SeoChecklist` maps `runChecks` results through the `Check` row component moved out of `seo-form.tsx` into `seo-checklist.tsx`.

Rewire both forms to one layout: left the `SchemaForm` (page form keeps its **"Page title"** and contact-chapter fields first; the article form has only the SEO fields), right a sticky aside with **"In search results"** (`SerpPreview`), **"When shared"** (`SocialCard`; image = the chosen media's src, else `ogImageUrl(path, ogTitle, eyebrow)`), and **"Checks"** (`SeoChecklist`) — all driven by `onValuesChange`, so they update while typing (the old "Shows what is saved" note goes). The resolved title uses `documentTitle` with the `seo` global read through the existing `globalsApi` query (`queryKeys` already has a globals key; read-only, no new endpoint).

Page builder: add a **"Page address"** card above the SEO form for custom pages only (`systemKey === null`, `page.update`): an input labelled **"Address"** prefilled with the path, a **"Change address"** button → `PATCH /pages/:id/path`; on success toast "Address changed. The old address now redirects here." when `redirected`, else "Address changed."; field errors inline. System pages show the path read-only with "System pages keep their address."

Both editors bind the tab to `?tab=` with nuqs (`parseAsStringLiteral(["content", "seo"]).withDefault("content")`), so the SEO center's **"Fix"** links open the SEO tab. The article side panel's slug field gets the notice "Changing the slug of a published article adds a redirect from the old address." (§9.3).

Run the Step 1 tests → PASS.

- [ ] **Step 3: Write the acceptance E2E**

`tests/e2e/admin/content/seo.spec.ts` (`STORAGE.editor` for admin steps; `request` for public checks; unique suffixes per run):

```ts
import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

test("a manual redirect answers 301, keeps the query and counts the hit", async ({ page, request }) => {
  const id = Date.now().toString(36)
  await page.goto("/admin/seo/redirects")
  await page.getByRole("button", { name: "New redirect" }).click()
  await page.getByLabel("From").fill(`/e2e-old-${id}`)
  await page.getByLabel("To").fill("/about")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText(`/e2e-old-${id}`)).toBeVisible()
  const res = await request.get(`/e2e-old-${id}?utm_source=x`, { maxRedirects: 0 })
  expect(res.status()).toBe(301)
  expect(res.headers()["location"]).toBe("/about?utm_source=x")
  await expect
    .poll(async () => {
      await page.reload()
      return page.getByRole("row", { name: new RegExp(`/e2e-old-${id}`) }).getByRole("cell").nth(3).textContent()
    })
    .toBe("1")
})

test("a redirect from a live page warns and does not take effect", async ({ page, request }) => {
  await page.goto("/admin/seo/redirects")
  await page.getByRole("button", { name: "New redirect" }).click()
  await page.getByLabel("From").fill("/contact")
  await page.getByLabel("To").fill("/about")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText(/A live page is at this address/)).toBeVisible()
  expect((await request.get("/contact", { maxRedirects: 0 })).status()).toBe(200)
  // Clean up so other specs see /contact untouched.
  const row = page.getByRole("row", { name: /\/contact/ })
  await row.getByRole("button", { name: "Delete" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).last().click()
})

test("the SEO center shows a health score and Fix links into the editor", async ({ page }) => {
  await page.goto("/admin/seo")
  await expect(page.getByRole("heading", { level: 1, name: "SEO" })).toBeVisible()
  await expect(page.getByText("SEO health")).toBeVisible()
  const fix = page.getByRole("list", { name: "Issues" }).getByRole("link", { name: "Fix" }).first()
  if (await fix.count()) {
    await fix.click()
    await expect(page).toHaveURL(/tab=seo/)
    await expect(page.getByText("In search results")).toBeVisible()
  }
})

test("the SERP preview follows the SEO title as it is typed", async ({ page }) => {
  await page.goto("/admin/pages")
  await page.getByRole("link", { name: /About/ }).first().click()
  await page.getByRole("tab", { name: "SEO" }).click()
  await page.getByLabel("SEO title").fill("Meet Magda")
  await expect(page.getByLabel("In search results").getByText("Meet Magda | Magda Kennedy")).toBeVisible()
})
```

(`STORAGE.editor` exists in `tests/e2e/support/storage.ts`. Match the dialog's submit label and the pages-list link name to what Task 8 and Phase 4 render. The last test does not save.)

`tests/e2e/perf/lighthouse-seo.spec.ts` (local only; CI skips `lighthouse:`; pattern from `tests/e2e/admin/a11y/lighthouse.spec.ts`):

```ts
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { chromium, expect, test } from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"

const PORT = 9334
// Ruling R20: the five key pages.
const KEY_PAGES = ["/", "/about", "/services", "/insights", "/insights/calm-is-a-skill"]

test("lighthouse: SEO is 100 on the five key pages", async () => {
  test.skip(test.info().project.name !== "desktop", "one run is enough")
  test.setTimeout(300_000)
  const { default: lighthouse } = await import("lighthouse")
  const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "mk-lh-seo-")), {
    args: [`--remote-debugging-port=${PORT}`],
  })
  try {
    for (const pathname of KEY_PAGES) {
      const result = await lighthouse(`${E2E_ORIGIN}${pathname}`, {
        port: PORT,
        onlyCategories: ["seo"],
        // E2E runs SITE_ENV=development, where robots.txt blocks all crawlers
        // by design (Ruling R14); production is covered by robots.test.ts.
        skipAudits: ["is-crawlable"],
        logLevel: "error",
        output: "json",
      })
      const failing = Object.values(result?.lhr.audits ?? {}).filter((a) => a.score === 0).map((a) => a.id)
      const score = Math.round((result?.lhr.categories.seo?.score ?? 0) * 100)
      expect(score, `${pathname} SEO (failing: ${failing.join(", ")})`).toBe(100)
    }
  } finally {
    await context.close()
  }
})
```

If an audit fails (likely candidates: `link-text` on a "Learn more" link, `crawlable-anchors` on a `href="#"`), fix the cause in the component or seed copy (for example an `aria-label` naming the target) and note it in the commit body; do not add it to `skipAudits`.

- [ ] **Step 4: Run the acceptance suite**

Run:

```bash
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm build
DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build
pnpm e2e:seed && pnpm test:e2e
pnpm exec playwright test tests/e2e/perf/lighthouse-seo.spec.ts --project=desktop
```

Expected: all green; parity 21/21 unchanged; `lighthouse:` SEO 100 on all five pages (local).

- [ ] **Step 5: Deploy note and ledger**

Append to `docs/deploy-dokploy.md` under a "Phase 7" heading:
- No new environment variables. `SITE_ENV=staging` on staging makes `robots.txt` disallow everything; production must run `SITE_ENV=production` and a correct `SITE_URL` (canonicals, sitemap and share-card URLs use it).
- Proxy now calls `GET /api/v1/resolve` over loopback for every public page; if the container does not listen on `127.0.0.1:$PORT`, set `INTERNAL_ORIGIN` (Phase 5 note). A slow or failing resolver only costs real 404s/redirects (fail-open), never availability.
- After the first production deploy: submit `<SITE_URL>/sitemap.xml` in Google Search Console and Bing Webmaster Tools, add their verification codes in Admin → SEO → Defaults, and run the Rich Results Test on `/` and one article.
- The share-card fonts ship under `assets/fonts` (SIL OFL 1.1, licence files alongside).

Append to `.superpowers/sdd/plan/progress.md` the Phase 7 entries and carries:
- Phase 11: dashboard "SEO health %" KPI and content-health gauge read `getSeoHealth()`; bell item for new health issues (optional).
- Phase 9: the share card reads the published theme tokens; preview of draft themes is not wired.
- Open questions R4 (external redirect destinations), R12 (block publish on missing alt), R20 (key pages), if unanswered.

- [ ] **Step 6: Commit**

```bash
git add admin app tests docs/deploy-dokploy.md .superpowers/sdd/plan/progress.md
git commit -m "feat(seo): editor seo panels, acceptance e2e and lighthouse seo check"
```

---

## Phase exit

- [ ] `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm build` green; the CI-style build with `DATABASE_URL=postgres://x@127.0.0.1:1/x` still passes.
- [ ] `pnpm e2e:seed && pnpm test:e2e` green (parity 21/21 unchanged; `navigation/seo.spec.ts`, the updated `navigation/cms.spec.ts`, `admin/content/seo.spec.ts`, `insights*.spec.ts`, `preview.spec.ts`, shell navigation).
- [ ] Local `lighthouse:` SEO spec: 100 on the five key pages.
- [ ] `curl -sI localhost:3000/no-such-page` → 404; `/insights/nope` → 404; a redirect → 301 with the query kept; `/robots.txt` on a non-production `SITE_ENV` → `Disallow: /`.
- [ ] `docs/deploy-dokploy.md` has the Phase 7 note; ledger entries and carries appended (Task 9 Step 5).

## Spec coverage map

| Contract item (docs/plan.md Phase 7) | Where |
| --- | --- |
| 1. `buildMetadata` and gated `generateMetadata` on every route | Task 1 (builders), Task 2 (root layout, CMS pages, `[page]`, articles; `io()` gating) |
| 1. Canonical policy | Ruling R16; Task 1 tests; Task 2 E2E (canonical + trailing-slash 308) |
| 1. Verification codes | Task 1 `rootMetadata`; Task 8 Defaults page (fields of the `seo` global) |
| 2. `sitemap.ts`, `robots.ts`, `manifest.ts`; non-production disallows everything | Task 3 |
| 3. OG images with committed TTFs and theme colours | Task 4 (Ruling R8 single handler); upload validation Task 2 (R13) |
| 4. JSON-LD builders (`schema-dts`) incl. `<` escaping | Task 5 |
| 5. SEO panels (SERP preview, social card, counters) and the SEO defaults UI | Task 9 (panels), Task 8 (defaults) |
| 6. Health score service (§11 checks) + SEO center: gauge, issues with deep links, alt coverage | Task 8 |
| 7. Redirects: CRUD, cached map resolver, `after()` hit counting, automatic creation on slug change, live-page warning | Task 6 (resolver, hits), Task 7 (CRUD, automatic for articles and pages, warning, flattening) |
| Acceptance: Rich Results Test passes for home and article | Task 5 unit + E2E approximation (R19); manual Rich Results Test noted in Task 9 deploy note |
| Acceptance: Lighthouse SEO 100 on the 5 key pages | Task 9 `lighthouse-seo.spec.ts` (local, R20) |
| Acceptance: a test asserts unique titles across the sitemap | Task 3 `seo-titles.test.ts` |
| Acceptance: the staging robots file disallows everything | Task 3 `robots.test.ts` (staging case) + E2E on a non-production `SITE_ENV` |
| CARRY Phase 3/4: real 404s instead of soft 404s (published-paths manifest) | Task 6 (R1–R3) |
| CARRY Phase 4: explicit noindex on draft-rendered pages | Task 2 (R17) |
| CARRY Phase 5: widen proxy resolver beyond `/insights/<slug>` | Task 6 |
| CARRY Phase 5: unpublish redirect chain not flattened | Task 7 (R5) |
| CARRY Phase 5: proxy 301 drops the query string | Task 6 (R4) |
| CARRY Phase 4/5: extend the existing SEO tabs rather than rebuild | Task 9 |
| §11 custom not-found: `noindex` + helpful links | Task 2 (`global-not-found.tsx`), Task 6 E2E |
| §9.3 article slug auto-redirect notice | Task 9 |

## Self-check against the installed code (done while writing this plan)

Verified in `node_modules` and the repo at `fc72395`:

- **Next 16.3.8.** `docs/01-app/03-api-reference/03-file-conventions/loading.md` "Status Codes": streamed responses keep 200; "run this check in proxy to rewrite missing slugs to a not-found route". `docs/.../04-functions/not-found.md`: with Cache Components every dynamic route streams a static shell, so a real 404 needs proxy. `NextResponse.rewrite(destination, init)` passes `init` (status) through (`dist/server/web/spec-extension/response.js`). `generate-metadata.md` "With Cache Components": metadata reading uncached data defers to request time; `htmlLimitedBots: /.*/` (already in `next.config.ts`) blocks metadata into `<head>` for every agent. `15-route-handlers.md` "With Cache Components": GET handlers run at request time unless prerenderable, hence `connection()` in the metadata routes and the OG handler. `opengraph-image.md`: file-based OG reads fonts with `readFile(join(process.cwd(), "assets/…"))`; file-based metadata outranks config metadata (why R8 uses one Route Handler). `output.md`: `outputFileTracingIncludes` keys are route globs (escaped brackets). `cacheTag.md`: ≤ 128 tags per call (health and sitemap add `page:<id>` in a loop). `io.md`: `await io()` keeps a read out of the static shell. `after.md`: runs after the response in Route Handlers, where Hono runs.
- **schema-dts 2.0.0** (`npm pack`): types-only package; `dist/schema.d.ts` exports `WithContext`, `Graph` (`"@context"` + `"@graph"`), `WebSite`, `ProfessionalService`, `LocalBusiness`, `Person`, `BreadcrumbList`, `BlogPosting`, `Service`, `Offer`, `FAQPage`, `SearchAction`; imports `schema-dts-lib` (`^1.0.0`, hence the override).
- **Fonts.** The Google Fonts CSS API serves static TTFs without a browser UA (Fraunces opsz 72 wght 600 ≈ 71 KB; Inter 400 ≈ 325 KB); `google/fonts` `ofl/fraunces/OFL.txt` and `ofl/inter/OFL.txt` exist.
- **Repo.** `proxy.ts` (admin gate + Phase 5 `/insights/<slug>` resolver, `isSitePath`, 300 ms, fail-open), `server/modules/redirects/{queries,routes,service}.ts` (`getRedirectTable`, `releasePath`, `createRedirect`, `recordSlugChange`), `redirects` table (no `page_id` yet), `lib/internal-origin.ts`, `server/lib/cache.ts` tags (`routes`, `page:<id>`, `articles`, `article:<id>`, `media`, `redirects`, `settings:<key>`), `pages` service (`updateMeta` expires only `page:<id>`; publish/delete/create expire `routes`; no address change yet), `articles` service (`unpublishArticle` with `redirectTo`, `updateArticleSeo` sharing `PageSeo`), `PageSeo`/`PageMetaPatch`/`ArticleSeoPatch` (title, description, ogImage, noindex only), `SeoGlobal` (template, defaults, default OG image, robots policy, verification google/bing, business type/priceRange/sameAs), `ContactGlobal` (structured hours, address, E.164 phone, clinic geo), `SiteGlobal` (name, legalName, professionalTitle, icon, social), `ThemeGlobal.site` tokens, `PlanView` (no `priceCents` yet), the root layout's partial `generateMetadata`, `cmsMetadata`, the article `generateMetadata`, `app/global-not-found.tsx` (no noindex), `[page]` and `insights/[slug]` sentinels, `admin/modules/pages/seo-form.tsx` (SERP preview + checks of saved values), `article-seo-form.tsx` (fields only), `SchemaForm` live counters, `Gauge`, `GlobalEditor`, `GLOBAL_ACCESS.seo`, nav entries `/admin/seo{,/defaults,/redirects}` served by the `[section]` placeholder, `media.isDecorative`/`alt`, the Phase 2 `lighthouse:` spec pattern and CI `--grep-invert "parity:|visual:|lighthouse:|perf:"`, `tests/e2e/navigation/cms.spec.ts` soft-404 cases, `insights.spec.ts:95` soft-404 expectation.
- **Not compiled here (flagged in the owning step):** that `next start` answers 404 for the proxy rewrite to an unmatched path (Task 6 Step 8 has the stop-and-report fallback); `ImageResponse` under Vitest (Task 4 Step 2 note); individual `schema-dts` literal types (Task 5 Step 3 note); the dialog submit label and the pages-list link name the Task 9 E2E clicks (Task 9 Step 3 note).

## Execution handoff

Plan complete and saved to `docs/plans/phase-07-seo.md`. Recommended: **subagent-driven**, because Task 6 (proxy, real 404s) and Task 7 (redirect flattening, loops, page moves) carry the edges that break the public site or SEO if wrong and deserve a fresh reviewer each, while Tasks 1–5 and 8–9 consume each other's interfaces in order. R4, R12 and R20 are open questions for the user; none blocks a task, and the stated defaults apply until answered.

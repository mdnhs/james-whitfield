# SEO Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the SEO team admin control over everything search engines read (service landing pages, category hubs, schema data, image alt text, small UI copy) and fix the technical SEO and speed issues from the 2026-11-12 audit.

**Architecture:** Everything stays CMS-driven: new fields go into the existing zod schemas (`lib/content/collections.ts`, `lib/content/globals.ts`, taxonomy) and Drizzle tables, and the schema-driven admin forms pick them up. New public routes mirror `app/(site)/[page]/page.tsx` (Cache Components shell param + `CmsPage`). Caching moves to a Cloudflare Cache Rule because Next.js marks every dynamic page `no-store`.

**Tech Stack:** Next.js 16 (App Router, Cache Components, `proxy.ts`), Drizzle + Postgres, zod 4, Tailwind 4, Vitest, Playwright, Cloudflare API.

**Spec:** the SEO audit and decisions in the 2026-11-12 conversation; summarised in Global Constraints below.

## Global Constraints

- No static copy or SEO data in code: every visitor-facing string and every SEO value comes from the CMS (page, collection, taxonomy, global or microcopy). Code may only hold fallbacks to other CMS values.
- New CMS fields are optional with defaults, so existing production rows keep parsing and nothing is required before the SEO team fills them in.
- Desktop layouts and behaviour stay as they are; mobile (`< sm`) designs from the Figma work stay as they are.
- Service landing pages live at `/services/<slug>` (`<slug>` = one lower-case kebab segment chosen in admin). Category hubs live at `/insights/category/<category-slug>`.
- Cloudflare edge cache for public HTML: 60 s edge TTL, stale-while-revalidate allowed; never cache `/admin*`, `/api*`, or any request carrying the draft/preview cookie or the auth session cookie (`mk.` prefix).
- DB changes ship as Drizzle migrations in `server/db/migrations` (applied by `migrate.cjs` on deploy).
- Existing checks stay green: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`.

## Review Focus

- A custom page saved at `/services/<slug>` whose slug equals an existing route name (e.g. `/services/formats`) or contains a second slash must be rejected by validation, not 404 at runtime.
- An unknown `/services/<slug>` or `/insights/category/<slug>` must return a real 404 status (not a soft 200), and must not appear in the sitemap.
- A service with no linked page keeps today's "Learn more" behaviour (block's `more.href`).
- A category with zero published articles must still render (empty state from microcopy) or 404; it must not crash, and it must be excluded from the sitemap.
- Cache Rule must never serve a cached admin page or a draft preview to the public; verify with a request carrying the draft cookie.

---

### Task 1: Nested service landing pages (`/services/<slug>`)

**Files:**
- Modify: `lib/content/page-path.ts` (`CustomPagePath` accepts one segment or `/services/<segment>`), `lib/seo/route-resolution.ts` (`CMS_SHAPE` also matches `/services/[^/]+`), `app/(site)/_cms/page-json-ld.tsx` (breadcrumb Home › Services › page for `/services/*`)
- Create: `app/(site)/services/[slug]/page.tsx` (mirror of `app/(site)/[page]/page.tsx`, path `/services/${slug}`, shell param `PAGE_SHELL_SEGMENT`)
- Test: `lib/content/page-path.test.ts` (create if absent), `lib/seo/route-resolution.test.ts`

**Interfaces:**
- Produces: `CustomPagePath` (zod) accepts `/x` and `/services/x`; `isServicePagePath(path: string): boolean` exported from `lib/content/page-path.ts`.

- [ ] **Step 1: Failing tests** — `CustomPagePath` accepts `/services/hypnotherapy-for-anxiety`; rejects `/services`, `/services/`, `/services/a/b`, `/services/Anxiety`, `/other/x`; `resolvePath({live:[], redirects:{}}, "/services/nope")` returns `{kind:"missing"}`; `isServicePagePath("/services/x") === true`, `isServicePagePath("/x") === false`.
- [ ] **Step 2: Run** `pnpm vitest run --project unit lib/content lib/seo/route-resolution.test.ts` → FAIL.
- [ ] **Step 3: Implement** the regex `^/(?:services/)?[a-z0-9]+(?:-[a-z0-9]+)*$` (reserved-segment check applies to the first segment only when there is no `services/` prefix), `isServicePagePath`, the `CMS_SHAPE` extension, the route file, and the breadcrumb (middle crumb name = the Services page title from `findPageByPath("/services")`, path `/services`).
- [ ] **Step 4: Run tests + `pnpm typecheck`** → PASS.
- [ ] **Step 5: Manual check** — create a page at `/services/test-page` in local admin, publish, visit: 200, breadcrumb JSON-LD has 3 items; `/services/missing` → 404 status.
- [ ] **Step 6: Commit** `feat(seo): service landing pages under /services/<slug>`

### Task 2: Link a service to its landing page

**Files:**
- Modify: `server/db/schema/content.ts` (`services.pagePath text not null default ''`), `lib/content/collections.ts` (`services.pagePath`: `""` or a `CustomPagePath`, default `""`), `lib/content/types.ts` (`ServiceView.pagePath: string`), the services query mapping, `features/services/components/services-grid.tsx` (Learn more href = `pagePath || more.href`)
- Create: migration via `pnpm drizzle-kit generate` (name `0013_service_page_path`)
- Test: `features/services/components/services-grid.test.tsx` (create)

**Interfaces:**
- Consumes: `CustomPagePath` from Task 1.
- Produces: `ServiceView.pagePath: string`.

- [ ] **Step 1: Failing test** — rendering `ServicesGrid` with one service `pagePath: "/services/anxiety"` and one `pagePath: ""` gives hrefs `/services/anxiety` and the block's `more.href`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** schema, migration, view mapping, grid. **Step 4: Run** unit + `pnpm test:integration` → PASS.
- [ ] **Step 5: Commit** `feat(cms): services can link to a landing page`

### Task 3: Category hub pages (`/insights/category/<slug>`)

**Files:**
- Modify: `server/db/schema/content.ts` (`articleCategories.seoTitle text not null default ''`, `seoDescription text not null default ''`), taxonomy zod schema in `lib/content/taxonomy.ts` (both optional, max 70 / 200), `server/modules/seo/queries.ts` (`getSitemapEntries` adds categories that have ≥1 published article), `lib/content/globals.ts` microcopy (`categoryEmpty: s(120)`), article card / article hero category label → link to the hub
- Create: `app/(site)/insights/category/[slug]/page.tsx` (H1 = category name, intro = `description`, grid of that category's articles reusing `ArticleCard`/`InsightsRail`, metadata title `seoTitle || name`, description `seoDescription || description`, canonical self, breadcrumb Home › Insights › Category), migration `0014_category_seo`
- Test: `server/modules/seo/queries` sitemap test (integration), `lib/seo` metadata unit test for the fallback order

**Interfaces:**
- Produces: `categoryHref(slug: string): string` in `lib/content/taxonomy.ts` → `/insights/category/${slug}`.

- [ ] **Step 1: Failing tests** — metadata uses `seoTitle` when set else `name`; sitemap includes `/insights/category/sleep` only when Sleep has a published article; unknown slug → `notFound()`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** unit + integration → PASS.
- [ ] **Step 5: Commit** `feat(seo): category hub pages`

### Task 4: `llms.txt`

**Files:**
- Create: `app/llms.txt/route.ts` (text/plain; `# {site.name}`, `> {seo.defaultDescription}`, then `## Pages` and `## Articles` as `- [title](absolute url): description` from sitemap entries + page/article SEO descriptions; cached with the same tags as the sitemap), `lib/seo/llms.ts` (pure `renderLlms(input): string`)
- Modify: `proxy.ts` matcher excludes `llms\\.txt$`
- Test: `lib/seo/llms.test.ts`

- [ ] **Step 1: Failing test** — `renderLlms` output starts with `# Magda Kennedy\n\n> …`, lists each entry once, skips noindex pages.
- [ ] **Step 2–4:** run FAIL → implement → PASS. **Step 5: Commit** `feat(seo): llms.txt from CMS content`

### Task 5: Structured data completeness

**Files:**
- Modify: `lib/content/globals.ts` (`site.portrait: MediaRef.nullable().default(null)`), `lib/seo/json-ld.ts` (`businessNode` gains `logo?: string`, `image?: string[]`; `personNode` gains `image?: string`, `knowsAbout?: string[]`; BlogPosting `publisher.logo` as `ImageObject` when a logo URL is given), `app/(site)/_cms/page-json-ld.tsx` and the article JSON-LD caller (resolve `site.logo`, `contact.clinic.photo`, `site.portrait` via `getMedia`, services titles for `knowsAbout`)
- Test: `lib/seo/json-ld.test.ts`

- [ ] **Step 1: Failing tests** — business node includes `logo` and `image` only when given; person node includes `image`/`knowsAbout` only when given; BlogPosting publisher has `logo: {"@type":"ImageObject", url}` when given.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(seo): logo, images and expertise in JSON-LD`

### Task 6: Image alt text from the media library

**Files:**
- Modify (drop the `alt=""` override so `MediaImage` falls back to `media.alt`): `features/insights/components/{article-hero,article-body,article-card,post-card,featured-article,rich-text}.tsx`, `features/about-page/components/story-section.tsx`, `features/contact/components/clinic-section.tsx`, `features/how-it-works/components/step-card.tsx`. Keep `alt=""` on purely decorative images (hero background, member avatars, testimonial avatars, enterprise backdrop, newsletter band) — they sit beside text that names them.
- Test: `components/media-image.test.tsx` (existing) + one render test asserting `ArticleCard` uses `media.alt`

- [ ] **Step 1: Failing test** — `ArticleCard` with `image.alt = "Hypnotherapy room"` renders an `<img alt="Hypnotherapy room">`.
- [ ] **Step 2–4:** FAIL → implement → PASS (also keep the linked image `aria-hidden` cases decorative). **Step 5: Commit** `fix(a11y,seo): content images use their library alt text`

### Task 7: Speed — CSP, mobile hero, edge cache

**Files:**
- Modify: `lib/tracking/csp.ts` (`script-src` + `https://static.cloudflareinsights.com`; `connect-src` + `https://cloudflareinsights.com`), `lib/tracking/csp.test.ts`, `features/hero/components/hero-webgl.tsx` (skip WebGL entirely when `matchMedia("(max-width: 639px), (pointer: coarse)")` matches)
- Infra (Cloudflare API, zone `3ef2cc94960f92fc6435a4e534adbea3`): a Cache Rule — expression `(http.host eq "magdakennedy.com" and not starts_with(http.request.uri.path, "/admin") and not starts_with(http.request.uri.path, "/api") and not http.cookie contains "mk." and not http.cookie contains "__prerender_bypass" and not http.cookie contains "<DRAFT_COOKIE value>")`, action eligible for cache, edge TTL override 60 s, browser TTL respect origin. Confirm public pages send no `Set-Cookie` first.
- Test: csp unit test; manual curl checks

- [ ] **Step 1: Failing test** — CSP string contains both Cloudflare Insights hosts.
- [ ] **Step 2–4:** FAIL → implement CSP + hero guard → PASS.
- [ ] **Step 5: Commit** `perf: allow Cloudflare Insights in CSP, skip hero WebGL on phones`
- [ ] **Step 6 (after deploy):** create the Cache Rule; verify `cf-cache-status: HIT` on the second request to `/`, `MISS/BYPASS` on `/admin/sign-in` and on `/` with the draft cookie.

### Task 8: Client Journey — one markup for both layouts

**Files:**
- Modify: `features/journey/components/journey-section.tsx` (single `<ol>`; each `<li>` renders the step once: phones = stepper row with disc + rail fill, `sm+` = card; the GSAP stepper logic targets the same `[data-step]` items under the `phone` media condition)
- Test: `features/journey/components/journey-section.test.tsx` (create)

- [ ] **Step 1: Failing test** — rendering 4 steps yields exactly 4 `h3` elements and one `ol`.
- [ ] **Step 2–4:** FAIL → implement → PASS; visual check at 390 px and 1440 px matches the previous screenshots. **Step 5: Commit** `fix(seo): client journey renders each step once`

### Task 9: Remaining hardcoded copy → microcopy

**Files:**
- Modify: `lib/content/globals.ts` microcopy (`stepTag: s(30)` e.g. `"Step {n}"`, `requiredNote: s(80)`, `callLabel: s(40)`), seed `server/db/seed/fixtures/microcopy.ts`, `features/how-it-works/components/step-card.tsx` (+ its caller passes the template), `features/contact/components/contact-form.tsx` (the "Fields marked * are required." line), `features/navbar/components/sticky-cta.tsx` (`aria-label`)
- Test: existing component tests + a step-card render test with `stepTag: "Step {n}"`

- [ ] **Steps 1–4:** failing test → implement → PASS. Empty microcopy hides the element (no English fallback in code).
- [ ] **Step 5: Commit** `refactor(cms): move remaining UI copy to microcopy`

### Task 10: Verify, deploy, production data

- [ ] Run `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration`, then the CI e2e set locally.
- [ ] Push to `main` (CI deploys; migrations run on boot).
- [ ] Production content: set the new microcopy keys (`stepTag`, `requiredNote`, `callLabel`, `categoryEmpty`) with the same idempotent schedule-script approach used on 2026-11-12, then reload the app.
- [ ] Task 7 Step 6 (Cache Rule) and live checks: sitemap, `llms.txt`, a test `/services/<slug>` page, a category hub, JSON-LD in Google's Rich Results Test.

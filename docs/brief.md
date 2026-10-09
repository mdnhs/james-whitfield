# Magda Kennedy: Dynamic Website & Admin Platform

**Project brief and architecture**

|                 |                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Status          | Draft for review                                                                                   |
| Date            | 2026-10-09                                                                                         |
| Scope           | Turn the static marketing site into a database-driven full-stack Next.js app with a premium admin |
| Companion       | [`plan.md`](./plan.md), the phased implementation plan                                             |
| Source analysis | Full read of `app/`, `components/`, `features/`, `lib/`, the build output and the bundled Next 16.3.6 docs, plus current library docs (October 2026) |

---

## 1. Summary

The site is a hand-built Next.js 16 marketing site for **Magda Kennedy**, a coach and clinical hypnotherapist with a practice at Merrion Square, Dublin. The visuals, the GSAP scroll journey and the WebGL hero are high quality. Everything else is hardcoded:

- every word, price, image and link lives in TypeScript files under `features/*/data`;
- the contact form and the newsletter form only *simulate* a submit;
- the home page has no `<title>`, there is no sitemap or robots file, and all 30 images have empty `alt` text.

We will turn it into one full-stack Next.js application with these parts:

- **Content platform** on PostgreSQL. Every page section, collection (articles, services, plans, testimonials, FAQs and more) and global setting becomes editable, with draft, preview, publish and revision history.
- **Hono API**, mounted inside Next.js at `/api`. It serves the admin panel and the public forms.
- **Better Auth** with role-based access control, two-factor auth, invitations and audit logging.
- **Admin panel** built with shadcn/ui and styled after the supplied Vengio dashboard inspiration (an "Evergreen" theme). It has live preview, a ⌘K command palette and theme-colour customisation.
- **SEO system**: metadata, Open Graph images, sitemap, robots and JSON-LD, managed from the admin.
- **Marketing infrastructure**: Google Tag Manager, GA4, Meta Pixel + Conversions API, Consent Mode v2 and a typed dataLayer. It is consent-first because the practice is in the EU, and it is configured from the admin.

All of this ships without changing how the public site looks or moves.

---

## 2. Requirements

### 2.1 What you asked for

| #   | Requirement                                                                                  |
| --- | -------------------------------------------------------------------------------------------- |
| R1  | Backend built with **Hono**                                                                  |
| R2  | A **Next.js full-stack** app (one codebase)                                                  |
| R3  | **PostgreSQL** database                                                                      |
| R4  | **Better Auth** for authentication                                                           |
| R5  | **RBAC**                                                                                     |
| R6  | Next.js 16 **`proxy.ts`**                                                                    |
| R7  | The **whole website dynamic** (content comes from the database)                              |
| R8  | **SEO and Open Graph** settings, customisable from the admin                                 |
| R9  | **GTM, Facebook (Meta) data layer** and similar, customisable from the admin                 |
| R10 | Admin panel built with **shadcn/ui**, visually matching the attached inspiration image       |
| R11 | **Theme colour customisation** from the admin panel                                          |
| R12 | Everything else at our discretion, built "the best way possible" so the client loves the admin |
| R13 | `docs/brief.md` and `docs/plan.md`, with the architecture based on deep codebase analysis    |

### 2.2 Decisions taken on your behalf (confirm or correct)

| #   | Decision                                                                                                                                  | Why                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| D1  | Keep **Dokploy + Docker standalone**, one container                                                                                        | It is the current deploy path (`Dockerfile`, `.github/workflows/ci.yml`)                                                  |
| D2  | **Drizzle ORM 0.45 (stable) + node-postgres**                                                                                             | Type-safe SQL and an official Better Auth adapter. Drizzle v1 is still a release candidate                                |
| D3  | **Hono mounted inside Next** at `app/api/[...route]/route.ts`                                                                             | One deploy, shared TypeScript types, typed RPC client                                                                     |
| D4  | Public pages **read the DB directly through cached server queries**. Hono serves the admin and the forms                                    | The Next docs say not to fetch your own Route Handlers from Server Components                                             |
| D5  | **Cache Components on**, and the **database is never touched at build time**                                                                | `'use cache'` replaces `unstable_cache` in Next 16. The Docker build has no database                                      |
| D6  | Pages become **ordered, typed blocks** (one block type per existing section), plus **collections** and **globals**                        | Keeps the bespoke design and motion while giving real editing power                                                       |
| D7  | **Draft → preview → publish**, with revision history, for pages, articles and the theme                                                   | Expected of a premium CMS. Lets the client experiment safely                                                              |
| D8  | Seven roles: **owner, admin, editor, author, marketer, intake, viewer**                                                                   | Fits a small practice plus an agency. Enquiries (health-adjacent data) stay restricted                                     |
| D9  | Media on **S3-compatible storage** (Cloudflare R2, EU jurisdiction, recommended), with a local-disk driver for development                | Durable, off-server and cheap. Next cannot serve files added to `public/` after the build                                 |
| D10 | Email through **Resend** in production and **Mailpit** in development                                                                      | Simple API and React Email templates. Local mail capture                                                                  |
| D11 | **Public site is light-only**; the admin supports light and dark                                                                           | The site has no dark design. The current system-dark and "d" hotkey half-darken it                                        |
| D12 | **Consent-first tracking** (Irish DPC rules) with Google **Consent Mode v2 in Basic mode**: no tag loads before consent                    | The practice is in Ireland, and enquiries can reveal health information                                                   |
| D13 | The **home hero background stays code-managed**; its text, CTAs and avatars are editable                                                 | The WebGL depth and hair maps are generated offline for that single photo                                                 |
| D14 | Admin typeface: **Plus Jakarta Sans** (already a dependency)                                                                               | Closest to the inspiration's geometric sans                                                                               |

### 2.3 Open questions (the default applies if there is no answer)

1. **Media storage.** A Cloudflare R2 bucket, or a Dokploy volume? *Default: R2 in production, local disk in development.*
2. **Email sending domain.** Which domain will Resend verify (for example `magdakennedy.ie`)? *Default: Resend, with the domain set by env.*
3. **Content fixes found during analysis** (§4.6). Apply them during seeding? *Default: import the content as-is, list the issues in the admin "Content health" panel, and fix the obvious rebrand leftovers (James → Magda, `jameswhitfield.ie`) only once you approve.*
4. **Admin users.** Who will log in, and with which roles? *Default: you as **owner**, the client as **admin**.*
5. **Environments.** What is the production domain, and should there be a staging app on Dokploy? *Default: staging exists and is always `noindex`.*
6. **Privacy sign-off.** Advanced consent mode, and Meta "enhanced matching" (hashed email and phone), need the practice's DPO or legal approval (§12). *Default: Basic consent mode, and CAPI without email or phone hashes.*

---

## 3. Success criteria

1. **Visual parity.** After the switch to database content, every existing page renders the same as today: the Playwright screenshot diff is at most 0.1% per page at three viewports, and the motion behaves the same.
2. **Everything editable.** Every visible string, image, link, price and list can be edited in the admin without a deploy. After **Publish**, the next request shows the change.
3. **No database at build time.** `next build` succeeds with no database reachable, and CI enforces it.
4. **RBAC is provable.** Permissions are enforced in the API and service layers, and automated tests cover the whole permission matrix (§7.2).
5. **SEO.** Every indexable URL has a unique title, description, canonical and OG image. Sitemap, robots and JSON-LD are valid. Every content image has alt text. Lighthouse scores on key pages: SEO 100, accessibility ≥ 95, mobile performance ≥ 90.
6. **Tracking.** No non-essential cookie or tag fires before consent. GTM, GA4, Pixel and CAPI can be configured without a deploy. Lead events are deduplicated between browser and server. No health-revealing data reaches ad platforms.
7. **The admin wows.** It reaches the quality of the Vengio inspiration, with a ⌘K palette, live preview, theme customisation with contrast safety, and full use on tablet and phone.
8. **Operations.** Local setup is one command. Deploys run migrations automatically, and the database is backed up daily.

---

## 4. Current state (deep analysis)

### 4.1 Stack and structure

| Area       | Today                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js **16.3.6**, React **19.2.8**, TypeScript 5, pnpm 10.32.1, Node 22                                                                                                                   |
| Styling    | Tailwind CSS 4. Brand tokens in `app/globals.css` `@theme`. shadcn CLI **4.21** with the `base-nova` style, on **Base UI 1.8**                                                              |
| Motion     | GSAP 3.15 (ScrollTrigger, SplitText), Lenis 1.3, `@bsmnt/scrollytelling`, a three.js WebGL hero                                                                                             |
| Other      | nuqs 2.10 for URL state, next-themes, sharp                                                                                                                                                 |
| Structure  | Feature-sliced `features/<name>/{components,data,lib}` with barrels. Shared code in `components/` and `lib/`. The `@/*` alias points at the repo root (there is no `src/`)                  |
| Rendering  | Every route is SSG: 16 prerendered pages, including 7 articles. `generateStaticParams` + `dynamicParams = false` on `insights/[slug]`                                                       |
| Deploy     | Multi-stage `Dockerfile` with `output: "standalone"`, built by Dokploy on push to `main`. CI runs lint, typecheck and build, and the deploy does not wait for it                            |

### 4.2 Routes and content inventory

There are seven routes: `/`, `/about`, `/services`, `/how-it-works`, `/insights`, `/insights/[slug]` and `/contact`. Each page is a stack of `<StackCard>`s, and each card holds one or two sections. A `CHAPTERS` array feeds the `<JourneyRail>`. The site chrome (`SiteHeader`, `SiteFooter` with `id="contact"`, Lenis, `ScrollMotion`) sits in the root layout.

There are about **22 distinct section types**:

- home: hero, credibility badges, about intro, how-it-works, testimonials, enterprise band, insights teaser, FAQ;
- about: page hero, story, stats band, approach, credentials timeline, "next step" band;
- services: grid, formats & investment;
- how it works: session timeline, honest fit;
- insights: browser, featured article, newsletter band;
- articles: article hero and body;
- contact: contact details and form, clinic.

Repeating content:

| Entity              | Count                                        | Notes                                                                                                                            |
| ------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Articles            | 7 (1 featured), in 5 categories              | Body blocks are `p` / `h2` / `quote` / `list`, plain strings only. The first `p` renders as the lead. Read time = words ÷ 220     |
| Testimonials        | 7 cards                                      | Only 4 unique quotes, all signed "Verified Client". Columns are pre-split in the data                                            |
| FAQs                | 7                                            | Used on 4 pages, in `home` and `page` variants                                                                                    |
| Services            | 6                                            | They also feed the contact-form topics and its URL params                                                                         |
| Plans (formats)     | 3                                            | Free / €840 / €160. Plan slugs prefill the contact form                                                                           |
| Steps               | 4                                            | Each has an image with a hand-tuned crop box. Shared by `/` and `/how-it-works`                                                   |
| Other lists         | session beats 4, credential badges 4, credentials timeline 5, principles 3, stats (3 + 4 + 2), fit items 4 + 4 | All page-specific                                                                                                                 |
| Navigation & footer | 5 nav links, 2 footer columns, 3 legal links | The legal links `/privacy`, `/terms` and `/disclaimer` **return 404**                                                            |
| Contact & clinic    | 4 channels, 1 clinic                         | Opening hours are one preformatted string. There are no map coordinates                                                          |

UI copy is also hardcoded inside components: form labels and errors, "Read article →", "Showing n of m", breadcrumbs, the article CTA card and the "Book a Call" button.

### 4.3 Motion-system constraints (critical for a dynamic site)

- `ScrollMotion` (`components/scroll-motion.tsx`, 480 lines) runs once per pathname and scans **the whole `document`**. Markup must be in the DOM when it runs. Content that is streamed or inserted later is not animated, and streamed `[data-reveal]` elements **stay invisible**.
- With Cache Components, Next keeps previously visited routes in the DOM, hidden by React `<Activity>` (`display:none`). Document-wide queries then match hidden pages, and ids such as `home` and `faq` become duplicates. This affects `scroll-motion.tsx:33,82`, `journey-rail.tsx:54`, `smooth-scroll.tsx:34` and `steps-story.tsx:77`.
- Several layouts assume fixed item counts:
  - `StepsStory` is tuned to exactly four steps (`BEAT=24`, `--steps-spacer:260svh`);
  - the StatsBand and Credibility borders assume four items;
  - `FitSection` pairs its two lists by index;
  - testimonials are pre-split into two columns.
- The count-up animation only parses a leading integer, so `4.9/5` animates as `4` followed by `.9/5`, and `1,200+` breaks.
- The WebGL hero is bound to `hero-bg.png` and its generated depth and hair maps.

The design response is in §5.7.

### 4.4 Theming

- The 11 brand tokens in `@theme` (`--color-brand: #336060`, `pine`, `clay`, `cream`, …) compile to `:root` CSS variables, so **runtime override is feasible**.
- About 60 colours are hardcoded in components instead of tokens: `#525252` ×22, about a dozen border greys, the off-token green `#315d44`, and rgba overlays. SVG icons have colours baked in, and `tint` is passed as Tailwind class strings (`"bg-pine/70"`), which cannot come from a database. All of this must be tokenised before theme customisation can be complete.
- The shadcn tokens are still neutral defaults.
- Seven font families are loaded, and **all 8 font files are preloaded on every route**. Geist Mono is never used.

### 4.5 SEO and analytics gaps

- No root metadata, so the home page has no `<title>`.
- No title template.
- **No `metadataBase`**, so `og:image` points at `http://localhost:3000`.
- No canonicals, and no Open Graph on the static pages.
- No sitemap, robots, manifest, OG image or JSON-LD.
- All 30 images use `alt=""`.
- No custom 404, analytics, consent banner or security headers.

### 4.6 Content-quality findings (for the client)

- Rebrand leftovers: "James"/"His" in `about-content.ts:8` and `testimonials.ts:12,18`; the email `hello@jameswhitfield.ie`.
- The footer contact lines are placeholders: `[email]`, `[phone]`, `[Dublin, Ireland]`.
- Contradictions: online sessions are "Ireland, UK & USA" in one place and "worldwide" in another; FAQ #4 duplicates #7.
- The CTA appears as seven differently-worded "Book a discovery call" variants.
- The same photo is reused for unrelated content (`story.png` is byte-identical to `step-2.png`).
- Small typos: a missing colon in the approach subtitle, a missing comma in the clinic address.

### 4.7 Engineering hotspots to fix along the way

- **CI typecheck fails on a fresh checkout.** `next-env.d.ts` and `.next/types` are gitignored. Fix: `next typegen && tsc --noEmit`.
- **Client components import content modules.** Full article bodies, steps, session beats and services end up in client JS bundles.
- **Simulated forms.** `contact-form.tsx` (335 lines) and the newsletter band never submit anything.
- **Fragile slug coupling.** `TOPIC_FOR` and the contact-param parsers are built from static data when the module loads.
- **Prerender breaks under Cache Components.** `new Date().getFullYear()` in the footer fails it.
- **Duplication.** The clay CTA class string is copied 13 times while the shadcn `Button` goes unused. React keys come from content strings in 37 places.

---

## 5. Target architecture

### 5.1 System overview

```
                       ┌──────────────────── Next.js 16 app · one Docker container (Dokploy) ────────────────────┐
 Visitor ─────────────►│ proxy.ts ── optimistic /admin gate · X-Robots-Tag on /admin                              │
                       │   │                                                                                      │
                       │   ├─► app/(site)/**  RSC ──► server/modules/*/queries ('use cache' + cacheTag) ──┐       │
                       │   │      contact / newsletter forms ──► POST /api/v1/public/* ──────┐            │       │
 Admin user ──────────►│   ├─► app/(admin)/** shell RSC + client UI (TanStack Query + Hono RPC) ──┐        │       │
                       │   │                                                          ▼          ▼        ▼       │
                       │   └─► app/api/[...route] ──► Hono: requestId · secure headers · session · RBAC ·     │
                       │                               rate-limit · zod-validator · error envelope              │
                       │                                 ├─ /api/auth/*      → Better Auth                       │
                       │                                 ├─ /api/v1/admin/*  → services ──► repos (Drizzle) ─────┼──► PostgreSQL 17
                       │                                 ├─ /api/v1/public/* → services                          │
                       │                                 └─ /api/v1/cron/*   → services       revalidateTag ◄────┤
                       │ instrumentation.ts ── scheduler tick (scheduled publishing, retention)                  │
                       └─────────────┬─────────────────────────┬────────────────────────────┬────────────────────┘
                                     ▼                         ▼                            ▼
                         S3-compatible storage (R2)      Resend (email)        GTM · GA4 · Meta Pixel + CAPI
```

### 5.2 Technology choices

| Concern            | Choice                                                                                              | Version (Oct 2026)                  |
| ------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Framework          | Next.js App Router, Cache Components, `proxy.ts`                                                    | 16.3.x (16.4 is optional later)     |
| UI runtime         | React                                                                                               | 19.2.x                              |
| Language           | TypeScript, `strict`                                                                                | 5.x (TS 7 native not yet adopted)   |
| Styling            | Tailwind CSS                                                                                        | 4.x                                 |
| Admin UI kit       | shadcn/ui `base-nova` on Base UI (`render` prop, not `asChild`)                                     | shadcn 4.21+, @base-ui/react 1.8    |
| API                | Hono + `@hono/vercel` `handle()` adapter + `@hono/zod-validator`                                    | 4.13.x · 1.0.x · 0.9.x              |
| Auth               | Better Auth: admin plugin with custom access control, two-factor (TOTP); `auth` CLI for the schema  | 1.7.x                               |
| Database           | PostgreSQL (managed by Dokploy)                                                                     | 17 (18 is compatible)               |
| ORM                | Drizzle ORM + drizzle-kit, node-postgres (`pg`) pool                                                | 0.45.x · 0.31.x · pg 8.23           |
| Validation         | Zod (shared by API, forms and types)                                                                | 4.6.x                               |
| Admin data         | TanStack Query; TanStack Table v9 (`useTable` + `tableFeatures`)                                    | 5.104 · 9.2                         |
| Forms              | react-hook-form + `@hookform/resolvers` (Zod 4), shadcn `Field`                                     | 7.89 · 5.9                          |
| Charts             | Recharts through the shadcn `chart` component                                                       | 3.8+                                |
| Rich text          | TipTap, with `@tiptap/static-renderer` to render JSON in RSC                                        | 3.31.x                              |
| Drag and drop      | `@dnd-kit/core` + `@dnd-kit/sortable`                                                               | 6.3 · 10.0                          |
| Colour             | culori (OKLCH, gamut mapping, WCAG contrast) + react-colorful (picker)                              | 4.0 · 5.8                           |
| Toasts / palette   | sonner / cmdk (inside shadcn `command`)                                                             | 2.0 · 1.1                           |
| Dates              | date-fns + `@date-fns/tz`, Europe/Dublin                                                            | 4.4                                 |
| Email              | Resend SDK + React Email (`react-email` package); nodemailer to Mailpit in development              | resend 6.x · react-email 6.x · nodemailer 10.x |
| Storage            | `@aws-sdk/client-s3` (R2, S3; RustFS for an optional local emulator) + a local-disk driver          | v3                                  |
| Images             | sharp (already installed) for metadata, blur placeholders and crops                                 | 0.35                                |
| Tests              | Vitest (unit and integration against real Postgres), Playwright (E2E and visual parity)             | latest                              |

> **Library-version traps for implementers**
>
> - Drizzle's docs site now shows the **v1 RC** API by default. `defineRelations`, `migrate(db)` without a folder argument and `drizzle-orm/zod` do **not** exist in 0.45. Use `relations()`.
> - `hono/vercel` is deprecated; use `@hono/vercel`. Do not adopt Hono v5 (it is an RC).
> - The Better Auth CLI is now the `auth` package, not `@better-auth/cli`.
> - The shadcn base-nova `form` item is empty. Build forms from `Field` + react-hook-form `Controller`.
> - TanStack Query: `prefetchQuery` is deprecated; use `queryClient.query()`.

### 5.3 Repository layout (target)

```
app/
  (site)/                         public site; its own root layout (html/body, fonts, site.css)
    layout.tsx  site.css  not-found.tsx  error.tsx  opengraph-image.tsx
    page.tsx                      home   → <CmsPage path="/" />
    insights/page.tsx             index  → <CmsPage path="/insights" />
    insights/[slug]/page.tsx      article template (+ opengraph-image.tsx)
    [...slug]/page.tsx            every other CMS page (about, services, legal, custom) + redirects
  (admin)/                        admin; its own root layout (<html data-theme="admin">, admin.css, providers)
    layout.tsx  admin.css
    admin/(auth)/…                sign-in, forgot-password, reset-password, two-factor
    admin/(panel)/layout.tsx      guarded shell (sidebar, topbar, ⌘K)
    admin/(panel)/…               dashboard, pages, insights, collections, media, leads, seo, marketing,
                                  appearance, settings, users, audit, account
  api/[...route]/route.ts         → Hono (all HTTP methods)
  sitemap.ts  robots.ts  manifest.ts  favicon.ico
proxy.ts                          Next 16 proxy (optimistic auth gate, noindex headers)
instrumentation.ts                boot hook: scheduler tick
server/                           SERVER ONLY (import "server-only")
  env.ts                          lazy, Zod-validated environment
  db/  client.ts  schema/*.ts  migrations/  seed/{index.ts, fixtures/*}
  auth/ auth.ts  actor.ts  session.ts (DAL: getSession, requireActor)
  api/  app.ts  middleware/*  errors.ts  types.ts (AppType exports)
  modules/<domain>/ schema.ts · repo.ts · service.ts · routes.ts · queries.ts
  lib/  cache.ts (tags + invalidate) · storage/* · email/* · crypto.ts · rate-limit.ts · meta-capi.ts · audit.ts
blocks/                           ISOMORPHIC block registry: <type>/{schema.ts, meta.ts}, registry.ts, render.tsx (server)
admin/                            admin UI: components/ (shell, charts, kpi, schema-form…), modules/<domain>/, lib/ (api client, query keys, permissions)
features/                         public site sections (existing), now driven by props; data/*.ts move to server/db/seed/fixtures
components/                       shared site components + components/ui (shadcn)
lib/                              isomorphic: auth/permissions.ts (shared with the auth client), theme/ (engine),
                                  analytics/ (dataLayer, consent), page-root.ts, utils.ts, gsap.ts
emails/                           React Email templates
tests/                            e2e/ (Playwright) · integration helpers
docker-compose.yml                postgres, mailpit
```

### 5.4 Layering rules

Dependencies point downward only. Lint rules (`no-restricted-imports`) and code review enforce them.

1. **Routes (`app/**`) are thin.** They compose components and call `server/modules/*/queries` for public data, or admin client modules.
2. **`server/**` starts with `import "server-only"`.** Client code never imports it.
3. **Hono routes (`modules/*/routes.ts`) do three things:** validate (Zod) → authorise (`can()`) → call a service. They never query the database directly.
4. **Services hold all business logic:** business rules, ownership checks, revision snapshots, audit entries and cache invalidation. They take an `Actor` context (`{ userId, roles, ip }`) and return plain DTOs.
5. **Repos are the only files that contain Drizzle queries.**
6. **Zod schemas are the single source of truth** for API input, admin forms (generated from the schema, §9.4) and TypeScript types. Shared schemas (`blocks/**`, `lib/**`) must not import server code.
7. **Public rendering never calls the HTTP API.** There is no self-fetch.

### 5.5 Key flows

**(a) Visitor views a page**

1. `proxy.ts` lets the request pass.
2. The `(site)` layout renders the static shell, then `<SiteFrame>` (inside Suspense) awaits `io()` and loads cached settings: theme tokens, navigation, footer, tracking.
3. `<CmsPage>` loads the cached published page by path and renders its blocks with `<BlockRenderer>`.
4. A cache hit costs no database query. A miss runs one query and stores the result under its tags.

**(b) Admin publishes a page**

1. The UI calls `POST /api/v1/admin/pages/:id/publish`.
2. Middleware resolves the session (with the cookie cache bypassed) and checks `page:publish`.
3. The service validates the draft against the block schemas, copies `draft → published`, bumps `version`, writes a revision and an audit entry, and calls `invalidate(["page:<id>", "routes"])`.
4. That calls `revalidateTag(tag, { expire: 0 })`, so the next visitor request re-renders with fresh data.

**(c) Preview**

1. "Preview" opens `GET /api/v1/admin/preview?path=/about`. The route checks the session and `page:read`, calls `draftMode().enable()`, and redirects to a validated internal path.
2. While draft mode is on, the queries return draft documents and Next bypasses its cache.
3. A floating preview bar on the site offers "Exit preview", which is a POST form.

**(d) Contact enquiry**

1. The form posts JSON to `POST /api/v1/public/leads`.
2. Abuse checks run: honeypot, minimum fill time, IP-hash rate limit and an optional Turnstile check. Zod validates with the same schema as the client.
3. The service inserts the lead and its activity.
4. `after()` sends the notification email and the auto-reply. Only with marketing consent, it also sends the CAPI `Lead` event: same `event_id` as the browser pixel, and no email or phone hashes by default.
5. The client pushes `generate_lead` to the dataLayer. The admin badge count updates on the next poll.

**(e) Sign-in and permission check**

1. Better Auth handles email + password, then TOTP if 2FA is enabled. The session cookie is set (HTTP-only, SameSite=Lax, `__Secure-` in production).
2. `proxy.ts` redirects to `/admin/sign-in` if there is no session cookie.
3. The `(panel)` layout checks the full session and passes the actor's permission map to the client for UI gating.
4. Every API call is authorised again server-side.

**(f) Scheduled publishing**

1. `instrumentation.ts` starts a 60-second interval that calls `POST /api/v1/cron/tick` on localhost with `CRON_SECRET`. It goes through HTTP so that `revalidateTag` runs inside a request context.
2. The tick takes a Postgres advisory lock, publishes due articles, purges expired data and invalidates tags.
3. An external cron (a Dokploy schedule) can call the same endpoint.

### 5.6 Rendering and caching (no database at build)

These facts come from the bundled Next 16.3 docs and decide the design:

- `'use cache'` functions **run at `next build`**.
- `dynamic`, `revalidate` and `dynamicParams` are **removed** under Cache Components.
- An empty `generateStaticParams` is a **build error**.
- `updateTag` works **only in Server Actions**. Route Handlers (and therefore Hono) use `revalidateTag(tag, profile)`.

The rules that follow:

1. **`cacheComponents: true`** in `next.config.ts`.
2. **Gate every database read.** Each server component that reads data first calls `await io()` (from `next/cache`; it suspends during prerender) and is inside a `<Suspense>` boundary. Only then does it call a cached query. `io()` is never called inside a cache scope, and nothing touches the database at module scope.
3. **Cached queries** (`server/modules/*/queries.ts`) use `'use cache'` + `cacheLife("max")` + `cacheTag(...)`. They return serialisable DTOs.
4. **Writes invalidate immediately.** Services call `invalidate(tags)`, which wraps `revalidateTag(tag, { expire: 0 })`. Stale content is never served after a publish.
5. **Metadata goes in `<head>`.** `generateMetadata` uses the same gate. `htmlLimitedBots: /.*/` makes metadata blocking for every user agent. That costs almost nothing because the data is cached, and it guarantees that crawlers and social scrapers see full metadata.
6. **No `generateStaticParams`** on `[slug]` routes. They render on request from cached data. Unknown slugs call `notFound()`, after the redirect lookup.
7. **Draft mode.** Cached queries may read `(await draftMode()).isEnabled` inside the cache scope, which the docs allow, and return draft documents. While draft mode is on, Next re-executes cache scopes and does not store their results.
8. **Cache storage.** Each process has an in-memory LRU; raise `cacheMaxMemorySize` to 128 MB. Run **one replica**. Scaling out needs a shared `cacheHandlers` implementation (for example Redis with `updateTags`/`refreshTags`), because `revalidateTag` only clears the instance that receives it. This is documented and deliberately out of scope.
9. **Build guardrail.** A CI job runs `next build` with `DATABASE_URL` pointing at a closed port. The build must pass.

**Cache tag catalogue** (constants in `server/lib/cache.ts`):

| Tag                                                          | Read by                                              | Invalidated by                                 |
| ------------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------- |
| `settings:<key>` (site, contact, navigation, footer, newsletter, contactForm, microcopy, seo, tracking, consent, theme, scripts) | site frame, blocks, metadata | settings / globals services |
| `page:<id>`, `routes`                                        | `CmsPage`, sitemap, `[...slug]` resolver             | pages service                                  |
| `articles`, `article:<id>`, `categories`, `authors`          | insights blocks, article route, sitemap, OG images   | articles service                               |
| `collection:<name>` (services, plans, testimonials, faqs, steps, bands) | blocks that use them                      | collections service                            |
| `media`                                                      | media lookups (alt text, focal point)                | media service                                  |
| `redirects`                                                  | `[...slug]` resolver                                 | redirects service, article slug changes        |

### 5.7 Adapting the motion system

The motion system is what makes the site special. It has to keep working when the content is dynamic and when Activity is on.

1. **Per-page controller.** `PageMotion` replaces the global `ScrollMotion` in the layout. It is a client component that `BlockRenderer` renders **inside each page's content boundary**, so it hydrates only after that page's markup exists. Activity hides and shows it, which runs effect cleanup and then setup, so GSAP contexts are torn down and rebuilt automatically.
2. **Scoped queries.** Every query in `PageMotion`, `JourneyRail`, `SmoothScroll` (hash links) and `StepsStory` runs against the page root element (`root.querySelector`), never against `document`. Anchors resolve inside the visible page.
3. **Refresh on change.** `PageMotion` exposes `refresh()` and a `ResizeObserver`. Card-row grouping is recomputed on refresh. Live preview and nuqs-driven DOM swaps call `refresh()`.
4. **Failsafe reveal.** A CSS animation reveals any `[data-reveal]` after 2.5 s if JavaScript never runs or a trigger is missed.
5. **Count-up data.** Counters are stored as `{ value: number, decimals, prefix, suffix }`, so `4.9/5` and `1,200+` animate correctly.
6. **Count-agnostic layouts.**
   - `StepsStory` computes beats and spacer from the item count.
   - Dividers move to CSS (`divide-x`, `nth-child`).
   - Testimonials split into columns automatically.
   - `FitSection` accepts lists of unequal length.
7. **Schema limits.** Block schemas set the minimum and maximum item counts and text lengths the design can carry. The admin shows live counters and blocks values that would break the layout.
8. **Generated ids and chapters.** Section ids and JourneyRail chapters come from block data (`anchor`, `chapter`) and must be unique per page. `CHAPTERS` arrays disappear from the code.

---

## 6. Content model

### 6.1 Concepts

| Concept        | What it is                                                                                                   | Examples                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Page**       | A URL whose document is an ordered list of blocks plus page settings. System pages have fixed paths and cannot be deleted. Custom pages can be created. | `/`, `/about`, `/services`, `/how-it-works`, `/insights`, `/contact` (system); `/privacy`, `/terms`, `/disclaimer` (custom) |
| **Block**      | One instance of a registered block type. There is one type per existing section design, holding typed `data` | `services.grid`, `fit`, `hero.page`                         |
| **Collection** | Reusable entities with their own table and admin screen                                                      | articles, services, plans, testimonials, FAQs, steps, CTA bands |
| **Global**     | A single-instance settings document                                                                          | site identity, contact & clinic, navigation, footer, microcopy, SEO, tracking, theme |
| **Media**      | An uploaded or built-in asset with metadata: dimensions, blur placeholder, alt text, focal point             | photos, avatars, OG images                                  |

**Modelling rule.** Content that appears on more than one page, or needs its own URL, becomes a collection or a global. Lists used on only one page stay inside that block's data.

### 6.2 Block registry

Block types live in `blocks/` (isomorphic). Each one is declared once and used everywhere: by API validation, by the admin form, by the renderer and by the types.

```ts
// blocks/services-grid/meta.ts (illustrative)
export const servicesGrid = defineBlock({
  type: "services.grid",
  label: "Services grid",
  icon: "LayoutGrid",
  schema: ServicesGridData, // Zod: fields + min/max counts + text limits
  defaults: SERVICES_GRID_DEFAULTS,
  allowedOn: ["services"], // or "*"
  max: 1,
  uses: ["collection:services"], // data dependencies → cache tags
})
// blocks/render.tsx (server): type → features/* component, loading collection data via cached queries
```

A block instance stored in a page document looks like this:

```ts
type BlockInstance = {
  id: string // nanoid, stable across edits
  type: BlockType
  anchor: string // section id, kebab-case, unique per page (JourneyRail target)
  chapter: string | null // JourneyRail label; null = not in the rail
  hidden: boolean
  joinPrevious: boolean // render inside the previous StackCard (e.g. Credibility + About)
  data: BlockData<BlockType> // validated by the block's Zod schema
}
```

`BlockRenderer` groups consecutive `joinPrevious` blocks into one `StackCard`. The first card always gets `id="home" rounded={false}` and the last gets `last`. JourneyRail chapters are derived from the blocks, plus the footer "Contact" chapter when the page's `showContactChapter` setting is on.

**Block catalogue**, mapped 1:1 from the existing sections:

| Type                | Component (today)                         | Editable data                                                                                     | Data source                         | Constraints                     |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------- |
| `hero.home`         | `features/hero` HeroSection               | eyebrow; headline {lead, muted, tail}; description; primary/secondary CTA; members {count stat, label, 3 avatars} | inline                              | home only, first, max 1. Background locked (D13) |
| `hero.page`         | `components/page-hero`                    | title, subtitle, image + focal point, tint 0–0.9, mirror                                          | inline                              | first, max 1                    |
| `credibility`       | `features/credibility`                    | badges 3–5 {title, subtitle, icon}                                                                | inline                              |                                 |
| `about.intro`       | `features/about` AboutSection             | eyebrow, headline, quote, paragraphs 1–3, stats 2–4, CTA                                          | inline                              |                                 |
| `process`           | `features/how-it-works` (+ StepsStory)    | variant `home` \| `page`, tag, title, subtitle, CTA                                               | `process_steps`                     | 3–6 visible steps               |
| `testimonials`      | `features/testimonials`                   | variant, eyebrow, title, selection (all \| chosen ids)                                            | `testimonials`                      | auto columns                    |
| `band`              | `features/enterprise` EnterpriseSection   | band reference, tint override                                                                     | `cta_bands`                         |                                 |
| `insights.latest`   | `features/insights` InsightsSection       | title, subtitle, CTA, count (1–6), mode latest \| chosen                                          | `articles`                          |                                 |
| `faq`               | `features/faq`                            | variant, title, subtitle, selection, initially-open item                                          | `faqs`                              |                                 |
| `about.story`       | about-page StorySection                   | eyebrow, title, paragraphs, quote, badge stat, role line, photo                                   | inline + `site` global (name, logo) |                                 |
| `about.stats`       | StatsBand                                 | 3–4 stats {value, decimals, prefix, suffix, label}                                                | inline                              |                                 |
| `about.approach`    | ApproachSection                           | eyebrow, title, subtitle, 3 principles {icon, title, body}                                        | inline                              | exactly 3                       |
| `about.credentials` | CredentialsSection                        | eyebrow, title, subtitle, CTA, 3–8 items {year, title, issuer, url?}                              | inline                              |                                 |
| `services.grid`     | ServicesGrid                              | eyebrow, title, intro, "learn more" link                                                          | `services`                          |                                 |
| `services.plans`    | FormatsSection                            | eyebrow, title, subtitle, featured-tag label                                                      | `plans`                             | 1–4 plans                       |
| `session.timeline`  | SessionTimeline                           | eyebrow, title, subtitle, 3–6 beats {time, title, body}                                           | inline                              |                                 |
| `fit`               | FitSection                                | eyebrow, title, subtitle, good {heading, items}, poor {heading, items}                            | inline                              | 2–6 items per list              |
| `insights.browser`  | InsightsBrowser + FeaturedArticle         | heading, page size                                                                                | `articles`, `article_categories`    | insights page only              |
| `newsletter`        | NewsletterBand                            | optional copy override                                                                            | `newsletter` global                 |                                 |
| `contact.details`   | ContactSection + ContactForm              | eyebrow, title, subtitle, body                                                                    | `contact`, `contactForm` globals; `services`, `plans` | contact page only |
| `contact.clinic`    | ClinicSection                             | eyebrow, title, subtitle, photo                                                                   | `contact` global (clinic)           |                                 |
| `richtext`          | new (legal and custom pages)              | TipTap document, width (narrow \| wide)                                                           | inline                              | custom pages                    |

The **article page** (`/insights/[slug]`) has a fixed template: article hero → body + CTA card (copy from `microcopy`) → related articles → newsletter band. Its content comes from the article.

### 6.3 Collections

All collection rows share these columns: `id` (uuid), `sort`, `is_visible`, `created_at`, `updated_at`, `created_by`, `updated_by`, `version`.

| Collection           | Fields                                                                                                                                                                  | Replaces / notes                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `articles`           | slug, title, excerpt, cover (media), category, author, body (TipTap JSON), featured, status (`draft` \| `scheduled` \| `published` \| `archived`), published_at, scheduled_for, seo; derived: body_text, reading_minutes, search (tsvector) | `articles.ts`, `article-bodies.ts`, `posts.ts`, `FEATURED_ARTICLE` (now a flag). Slug changes create redirects automatically |
| `article_categories` | slug, name, description, related service                                                                                                                                | `CATEGORIES`. The related service replaces `TOPIC_FOR` for the article CTA prefill      |
| `authors`            | name, slug, role title, bio, avatar, optional link to a user                                                                                                            | Inline `author{name, avatar}`                                                           |
| `services`           | slug (stable, e.g. `anxiety-stress`), title, body, icon                                                                                                                 | `SERVICES`. Also drives contact topics and `?topic=` URL params                         |
| `plans`              | slug, name, price label ("€840"), price amount in cents (optional, for JSON-LD offers), unit, summary, features[], CTA label, featured                                 | `FORMATS.plans`. Also drives `?plan=` prefill                                           |
| `testimonials`       | quote, author name, author role, avatar                                                                                                                                 | `testimonials.ts`. Columns are no longer encoded in the data                            |
| `faqs`               | question, answer (plain paragraphs)                                                                                                                                     | `faqs.ts`                                                                               |
| `process_steps`      | title, description, image, frame {x, y, w, h} as fractions                                                                                                              | `steps.ts`. The frame replaces the hand-written `%` crop strings, edited with a visual cropper |
| `cta_bands`          | name, eyebrow, title, bullets[], CTA {label, href}, image, tint                                                                                                         | `ENTERPRISE_CONTENT`, `ABOUT_CTA`                                                       |

Saving a collection item makes it live immediately; `is_visible` is the soft "unpublish". Articles are the exception and follow §6.5.

### 6.4 Globals

The `settings` table has one row per key. Each value is a Zod-validated JSON document.

| Key             | Contents                                                                                                                                                                  | Update permission (§7.2) |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `site`          | name, legal name, professional title, footer blurb, logo, icon/favicon, locale `en-IE`, time zone `Europe/Dublin`, social profiles                                        | `settings.update`        |
| `contact`       | email; phone {display, E.164}; address {lines, city, Eircode, country}; structured weekly hours + note; clinic {name, description, photo, online note, geo lat/lng} (maps URL derived) | `globals.update`         |
| `navigation`    | header links[], CTA {label, href}                                                                                                                                         | `globals.update`         |
| `footer`        | blurb, columns[] (with an "auto sitemap" option), contact note, legal links[], copyright name                                                                             | `globals.update`         |
| `newsletter`    | band copy (eyebrow, title, subtitle, placeholder, button, success), image, tint, confirmation-email copy                                                                  | `globals.update`         |
| `contactForm`   | title, field labels, placeholders, extra topics ("Something else"), formats[], consent text, button, success copy, error messages                                        | `globals.update`         |
| `microcopy`     | strings currently inline in components (insights browser, article chrome and CTA card, breadcrumbs, share labels, "Book a call")                                          | `globals.update`         |
| `seo`           | title template, default title and description, default OG image, robots policy, search-console verification, business JSON-LD (type, price range, `sameAs`)              | `seo.update`             |
| `tracking`      | GTM ID, GA4 ID, Meta Pixel ID, CAPI token (**encrypted**), test event code, per-channel enable flags                                                                      | `tracking.update`        |
| `consent`       | banner on/off, copy, policy link, category descriptions, re-consent interval, consent version                                                                             | `tracking.update`        |
| `scripts`       | custom head/body snippets, each with a placement and a consent category                                                                                                   | `code.update` (owner)    |
| `theme`         | site tokens + admin tokens, with draft and published (§10)                                                                                                                | `appearance.update` / `appearance.publish` |
| `notifications` | enquiry recipients, auto-reply on/off and copy                                                                                                                            | `settings.update`        |
| `privacy`       | enquiry retention (months), newsletter double opt-in, IP-hash salt rotation                                                                                               | `settings.update`        |

Reading is governed by the matching `read` permission. Public rendering reads every key except the secrets in `tracking`.

### 6.5 Drafts, publishing and revisions

- **Pages** keep a `draft` document (always the working copy) and a `published` document (what the site serves).
  - **Autosave** writes the draft, debounced at about 1.2 s, guarded by `version`.
  - **Publish** validates the draft against every block schema, then copies it to `published`.
  - **Discard** resets the draft to the published version.
  - Every publish writes a **revision** snapshot (the last 50 are kept). **Restore** loads a snapshot into the draft.
- **Articles** keep their working copy in `draft` (JSONB, same Zod schema). Publish copies the validated values into typed, indexed columns, which is what the site reads and searches. Scheduling sets `status = scheduled` and `scheduled_for`, and the scheduler tick publishes the article.
  - **Unpublish** or **archive** turns the article URL into a 404. In the same dialog the admin offers to create a 301 to `/insights` or to a chosen article.
- **SEO fields** for pages and articles live in their own `seo` column. They go **live on save**, are audited, and can be edited by editors and marketers without publishing content.
- **Theme** has draft and published versions (§10).
- **Globals and collections** go live on save. Every save is audited with a field diff, and globals keep 20 revisions for one-click rollback.
- **Concurrency.** Every editable row has a `version`. Mutations send the version they started from. A mismatch returns **409** with the current version, and the UI shows "Changed by someone else: review / overwrite".

### 6.6 Database schema (PostgreSQL)

Conventions: snake_case, `uuid` primary keys (`gen_random_uuid()`), `timestamptz`, foreign keys with explicit `on delete` rules, and Drizzle `relations()` (0.45 API).

| Table                                                                           | Key columns                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`, `sessions`, `accounts`, `verifications`, `two_factors`, `rate_limits`  | Generated by the Better Auth CLI (`auth generate --adapter drizzle --dialect postgresql`, `usePlural: true`, uuid ids). The admin plugin adds `role`, `banned`, `ban_reason`, `ban_expires` and `sessions.impersonated_by` |
| `media`                                                                         | driver (`static` \| `local` \| `s3`), key (unique, content-hashed), url, filename, mime_type, size_bytes, width, height, blur_data_url, dominant_color, alt, caption, focal_x, focal_y, is_decorative, created_by, deleted_at |
| `pages`                                                                         | system_key (unique, nullable), path (unique), title, status, draft (jsonb), published (jsonb), seo (jsonb), settings (jsonb), version, published_at, published_by                                                     |
| `revisions`                                                                     | entity_type, entity_id, version, snapshot (jsonb), note, created_by, created_at. Index on (entity_type, entity_id, created_at desc)                                                                                 |
| `articles`                                                                      | slug (unique), title, excerpt, cover_id, category_id, author_id, body (jsonb), body_text, reading_minutes, featured, status, published_at, scheduled_for, draft (jsonb), seo (jsonb), version, `search` tsvector generated from title (A), excerpt (B) and body_text (C), with a GIN index |
| `article_categories`, `authors`                                                 | see §6.3                                                                                                                                                                                                             |
| `services`, `plans`, `testimonials`, `faqs`, `process_steps`, `cta_bands`       | see §6.3                                                                                                                                                                                                             |
| `settings`                                                                      | key (pk), value (jsonb), draft (jsonb, theme only), version, updated_by, updated_at                                                                                                                                  |
| `leads`                                                                         | name, email, phone, topic_slug, format_slug, plan_slug, message, privacy_consent_at, marketing_consent, status (`new` \| `contacted` \| `booked` \| `closed` \| `spam`), assigned_to, source_path, referrer, utm (jsonb), ip_hash, user_agent, meta_event_id, created_at |
| `lead_activities`                                                               | lead_id (cascade), actor_id, type (`note` \| `status` \| `email` \| `assignment`), body, data (jsonb), created_at                                                                                                   |
| `newsletter_subscribers`                                                        | email (unique, lower-cased), status (`pending` \| `confirmed` \| `unsubscribed`), token_hash, source_path, consent_text, confirmed_at, unsubscribed_at, ip_hash                                                      |
| `redirects`                                                                     | source_path (unique), destination, status_code (301/302/307/308), is_active, hit_count, last_hit_at, note                                                                                                            |
| `audit_logs`                                                                    | actor_id, actor_email, action (e.g. `page.publish`), entity_type, entity_id, summary, diff (jsonb), ip_hash, user_agent, created_at. Index on created_at desc; **no PII in diffs** for leads                         |
| `api_rate_limits`                                                               | key (pk), count, reset_at. A fixed-window limiter for public endpoints (atomic upsert)                                                                                                                              |
| `consent_events`                                                                | consent_id, analytics, marketing, revision, banner_hash, action (`accept` \| `reject` \| `custom` \| `withdraw`), created_at. Append-only proof of consent; no raw IP (§12.2)                                         |

### 6.7 Content migration (seed)

`pnpm db:seed` is idempotent: it upserts by stable keys. It converts today's content so that the database-driven site renders **identically** on first boot.

1. Move `features/*/data/*.ts` verbatim to `server/db/seed/fixtures/`. They become seed input and nothing else.
2. Register every `public/images/**` asset as `media` with `driver: "static"`. Width, height, blur placeholder and dominant colour are computed with sharp. Alt text is drafted from context where it is obvious and flagged "needs alt" everywhere else.
3. Convert article body blocks to TipTap JSON:
   - `p` → paragraph (the first one stays the lead);
   - `h2` → heading level 2;
   - `quote` → blockquote;
   - `list` → bullet list, with the implicit "bold up to the first `. `" rule turned into real bold marks.
4. Create the six system pages and the three legal pages (placeholder legal copy, flagged). Their block documents mirror today's composition, ids, chapter labels and tints. Tints become numbers instead of class names.
5. Write the globals: site, contact (structured hours and address), navigation, footer, newsletter, contact form, microcopy, SEO defaults, consent defaults, and the theme (today's palette as the published site theme, Evergreen as the admin theme).
6. Create the **owner** account from `SEED_OWNER_EMAIL`. Server-side `createUser` without headers is allowed **only** in this script. Print a one-time set-password link.

---

## 7. Authentication and RBAC

### 7.1 Better Auth configuration (`server/auth/auth.ts`)

- **Lazy construction.** A memoised `getAuth()` builds the instance, because Better Auth initialises eagerly and throws in production without a secret. With lazy construction, importing modules during `next build` needs no auth secrets.
- **Database.** `drizzleAdapter(db, { provider: "pg", schema, usePlural: true, transaction: true })` with `advanced.database.generateId: "uuid"`.
- **Email and password.** `enabled: true, disableSignUp: true, minPasswordLength: 12, revokeSessionsOnPasswordReset: true`, with a custom `sendResetPassword` that has separate templates for invites and resets. There is no public sign-up. Accounts exist only through invitation, and the emailed link proves the address.
- **Sessions.** Seven-day expiry, `updateAge` of one day, `cookieCache` with a 5-minute maxAge for cheap reads. **Admin API and DAL calls pass `disableCookieCache: true`**, so bans and role changes take effect immediately.
- **Cookies.** `cookiePrefix: "mk"`: HTTP-only, SameSite=Lax, and `__Secure-` in production. `ipAddressHeaders: ["x-real-ip"]` because the app sits behind Traefik on Dokploy.
- **Plugins:**
  - `admin({ ac, roles, defaultRole: "viewer", adminRoles: ["owner", "admin"], impersonationSessionDuration: 3600 })`;
  - `twoFactor({ issuer: "Magda Kennedy Admin" })`;
  - passkeys (`@better-auth/passkey`) are a later option.
- **Rate limiting.** `storage: "database"`, with stricter rules on `/sign-in/email`, `/request-password-reset` and `/two-factor/*`.
- **Trusted origins and secrets.** `trustedOrigins: [SITE_URL]`. Secrets: `BETTER_AUTH_SECRET` (rotation via `BETTER_AUTH_SECRETS`) and `BETTER_AUTH_URL`.
- **Hooks.** `databaseHooks` and `hooks.after` write audit entries for sign-in, password changes, role changes, bans and impersonation.

### 7.2 Roles and permission matrix

The access-control statement lives in `lib/auth/permissions.ts`. It is isomorphic because the admin client also needs it, for `adminClient({ ac, roles })` and synchronous UI checks. It is built with `createAccessControl` from `better-auth/plugins/access` and spreads `defaultStatements` from `better-auth/plugins/admin/access`:

```ts
const statement = {
  ...defaultStatements, // user: create, list, set-role, ban, impersonate, impersonate-admins, delete, set-password, set-email, get, update; session: list, revoke, delete
  dashboard: ["view"],
  page: ["read", "create", "update", "publish", "delete"],
  article: ["read", "create", "update", "publish", "delete"],
  collection: ["read", "create", "update", "delete"],
  globals: ["read", "update"],
  media: ["read", "upload", "update", "delete"],
  lead: ["read", "update", "export", "delete"],
  newsletter: ["read", "export", "delete"],
  seo: ["read", "update"],
  redirect: ["read", "manage"],
  tracking: ["read", "update"],
  code: ["update"],
  appearance: ["read", "update", "publish"],
  settings: ["read", "update"],
  audit: ["read"],
} as const
```

**What each role is for:**

- **Owner**: the practice owner or agency lead. Everything, including owners and custom code.
- **Admin**: the client's trusted manager. Everything except custom code and managing owners.
- **Editor**: the content manager. Pages, articles, collections, globals, media and SEO.
- **Author**: a writer. Only their own articles, and they cannot publish.
- **Marketer**: the SEO or ads agency. SEO, redirects, tracking and the newsletter list. **No enquiries.**
- **Intake**: front desk. The enquiries inbox only.
- **Viewer**: a read-only stakeholder.

Users can hold several roles; any role that grants a permission is enough.

✓ = allowed · **own** = only the actor's own records (enforced in the service) · — = denied

| Permission                                        | Owner | Admin               | Editor | Author        | Marketer | Intake | Viewer |
| ------------------------------------------------- | :---: | :-----------------: | :----: | :-----------: | :------: | :----: | :----: |
| dashboard.view                                    | ✓     | ✓                   | ✓      | ✓             | ✓        | ✓      | ✓      |
| page.read                                         | ✓     | ✓                   | ✓      | ✓             | ✓        | —      | ✓      |
| page.update · publish · create · delete (custom)  | ✓     | ✓                   | ✓      | —             | —        | —      | —      |
| article.read                                      | ✓     | ✓                   | ✓      | ✓             | ✓        | —      | ✓      |
| article.create · update                           | ✓     | ✓                   | ✓      | own           | —        | —      | —      |
| article.publish                                   | ✓     | ✓                   | ✓      | — (submits)   | —        | —      | —      |
| article.delete                                    | ✓     | ✓                   | ✓      | own drafts    | —        | —      | —      |
| collection.read                                   | ✓     | ✓                   | ✓      | ✓             | ✓        | —      | ✓      |
| collection.create · update · delete               | ✓     | ✓                   | ✓      | —             | —        | —      | —      |
| globals.read / update                             | ✓ / ✓ | ✓ / ✓               | ✓ / ✓  | — / —         | ✓ / —    | — / —  | ✓ / —  |
| media.read · upload                               | ✓     | ✓                   | ✓      | ✓             | ✓        | —      | —      |
| media.update / delete                             | ✓ / ✓ | ✓ / ✓               | ✓ / ✓  | own / —       | ✓ / —    | —      | —      |
| lead.read · update                                | ✓     | ✓                   | —      | —             | —        | ✓      | —      |
| lead.export · delete                              | ✓     | ✓                   | —      | —             | —        | —      | —      |
| newsletter.read · export / delete                 | ✓ / ✓ | ✓ / ✓               | —      | —             | ✓ / —    | —      | —      |
| seo.read / update                                 | ✓ / ✓ | ✓ / ✓               | ✓ / ✓  | — / —         | ✓ / ✓    | — / —  | ✓ / —  |
| redirect.read · manage                            | ✓     | ✓                   | ✓      | —             | ✓        | —      | —      |
| tracking.read · update                            | ✓     | ✓                   | —      | —             | ✓        | —      | —      |
| code.update (custom scripts)                      | ✓     | —                   | —      | —             | —        | —      | —      |
| appearance.read · update · publish                | ✓     | ✓                   | —      | —             | —        | —      | —      |
| settings.read · update                            | ✓     | ✓                   | —      | —             | —        | —      | —      |
| audit.read                                        | ✓     | ✓                   | —      | —             | —        | —      | —      |
| user.* and session.* (invite, role, ban, revoke)  | ✓     | ✓ (never on owners) | —      | —             | —        | —      | —      |
| user.impersonate / impersonate-admins             | ✓ / ✓ | ✓ / —               | —      | —             | —        | —      | —      |

The service layer also enforces these invariants:

- Admins cannot create, modify, ban, impersonate or delete owners, and cannot grant the owner role.
- The last owner cannot be demoted or deleted.
- Nobody can change their own role.
- Authors can only touch articles they created or that list them as author.
- Every user manages their own profile, password, 2FA and sessions.
- Dashboard enquiry widgets show aggregates only, unless the viewer has `lead.read`.

### 7.3 Enforcement layers (defence in depth)

1. **`proxy.ts`** (Node runtime, optimistic only, as the Next 16 docs recommend):
   - Matcher: `/admin/:path*`. `/api` is excluded because the proxy buffers request bodies up to 10 MB and the API authenticates itself.
   - No `getSessionCookie()` → redirect to `/admin/sign-in?next=…`. Signed-in users hitting the auth pages → redirect to `/admin`.
   - Adds `X-Robots-Tag: noindex, nofollow` to every admin response.
   - **No database access.**
2. **Data access layer** (`server/auth/session.ts`): `getSession()` (React `cache`, full validation), `requireActor()` and `requirePermission()`. Used in the `(panel)` layout and pages, behind Suspense.
3. **Hono middleware:**
   - `session` puts user, session and actor into context;
   - `can({ article: ["publish"] })` authorises in-process using the role definitions (multi-role aware) and returns 401 or 403;
   - `sameOrigin()` checks `Origin`/`Sec-Fetch-Site` on unsafe methods.
4. **Services** check ownership and invariants and write the audit log.
5. **UI.** `usePermission()` (backed by the synchronous `checkRolePermission`) hides or disables controls. This is for convenience, never for security.

### 7.4 Account lifecycle

- **Bootstrap.** `pnpm admin:create --email … --name …` creates the first owner.
- **Invite.** Owner or admin → `POST /api/v1/admin/users/invite` → `createUser` (no password, chosen role, with the actor's headers so RBAC applies) → `requestPasswordReset` → branded "You're invited" email → the user sets a password on `/admin/reset-password`, which creates the credential account.
- **2FA.** TOTP with backup codes and 30-day trusted devices. **Mandatory for owner and admin.** On sign-in without 2FA they are sent straight to setup.
- **Sessions.** Users list and revoke their own. Admins revoke anyone's. Bans revoke sessions immediately.
- **Impersonation ("View as").** Lasts one hour, shows a sticky banner and is audited. It is the easiest way to show the client that the permissions really work.

---

## 8. API design (Hono)

### 8.1 Mounting and middleware

```ts
// app/api/[...route]/route.ts
import { handle } from "@hono/vercel"
import { app } from "@/server/api/app"

const handler = handle(app)
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS }
```

`app = new Hono<AppEnv>().basePath("/api")`, assembled in this order:

1. Global: `requestId()`, `secureHeaders()`, `onError` (error envelope) and `notFound`.
2. `/auth/*` → `getAuth().handler(c.req.raw)`.
3. `/v1/public/*` → `rateLimit`, `bodyLimit(64 KB)`.
4. `/v1/admin/*` → `session` → `signedIn` → `sameOrigin` → `bodyLimit(1 MB)`. The media upload route alone allows 20 MB.
5. `/v1/cron/*` → bearer `CRON_SECRET`.
6. `/v1/health`.

Each domain is a chained sub-app (`.route()`), so `export type AdminApi = typeof adminRoutes` gives an end-to-end typed RPC client without slowing TypeScript down.

### 8.2 Conventions

- **Format.** JSON in and out. The exceptions are the media upload (multipart) and CSV exports.
- **Errors.** `{ error: { code, message, fieldErrors?, requestId } }`, where `code` is one of `VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`, with the matching HTTP status. Validation errors map onto form fields.
- **Lists.** `?page&pageSize&sort=field:dir&q&<filters>` → `{ items, page, pageSize, total }`.
- **Versioning.** Mutations of versioned resources carry `version`. A conflict returns 409 with the current state.
- **IDs and dates.** uuid ids. Slugs match `^[a-z0-9]+(-[a-z0-9]+)*$` and are unique per table. Dates are ISO 8601 UTC and are displayed in Europe/Dublin.
- **Side effects.** Every mutation writes audit and invalidates cache **inside the service**, so no route can forget either.

### 8.3 Route map (`/api/v1`)

| Area           | Endpoints                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public         | `POST /public/leads` · `POST /public/newsletter` · `GET /public/newsletter/confirm` · `POST /public/newsletter/unsubscribe` · `POST /public/consent` · `GET /health` |
| Session        | `GET /admin/me` (user, roles, permission map, 2FA status) · `GET /admin/search?q=` (⌘K) · `GET /admin/dashboard` · `GET /admin/notifications`               |
| Pages          | `GET /admin/pages` · `POST` (custom page) · `GET /:id` · `PATCH /:id/draft` · `PATCH /:id/seo` · `POST /:id/publish` · `POST /:id/discard` · `GET /:id/revisions` · `POST /:id/revisions/:rev/restore` · `DELETE /:id` |
| Preview        | `GET /admin/preview?path=` (enables draft mode, then redirects) · `POST /admin/preview/exit`                                                              |
| Articles       | CRUD + `/publish`, `/schedule`, `/unpublish`, `/revisions` · `/admin/categories` · `/admin/authors`                                                        |
| Collections    | `GET\|POST /admin/collections/:name` · `PATCH\|DELETE /:id` · `PATCH /admin/collections/:name/order`. One generic router driven by the collection registry |
| Globals        | `GET\|PUT /admin/globals/:key` · `GET /:key/revisions` · `POST /:key/revisions/:rev/restore`. The permission is resolved per key (§6.4); `tracking`, `consent`, `scripts` and `theme` use their dedicated endpoints below |
| Media          | `GET /admin/media` (filters: type, missing alt, search) · `POST` (multipart, then sharp) · `PATCH /:id` · `DELETE /:id` · `GET /:id/usage`                |
| Enquiries      | `GET /admin/leads` · `GET\|PATCH /:id` · `POST /:id/notes` · `GET /admin/leads/export.csv` · `DELETE /:id` (GDPR erase)                                    |
| Newsletter     | `GET /admin/newsletter` · `GET /export.csv` · `DELETE /:id`                                                                                                |
| SEO            | `GET /admin/seo/overview` (health) · `GET\|PUT /admin/seo/defaults` · redirects CRUD                                                                       |
| Marketing      | `GET\|PUT /admin/tracking` · `POST /admin/tracking/test-capi` · `GET\|PUT /admin/consent` · `GET\|PUT /admin/scripts` (owner)                              |
| Appearance     | `GET /admin/theme` · `PUT /admin/theme/draft` · `POST /admin/theme/publish` · `POST /admin/theme/reset`                                                    |
| Users          | `GET /admin/users` · `POST /invite` · `PATCH /:id/role` · `POST /:id/ban` · `POST /:id/unban` · `DELETE /:id/sessions` · `POST /:id/impersonate` · `DELETE /:id` |
| Audit          | `GET /admin/audit` (filters: actor, entity, action, date)                                                                                                  |
| Cron           | `POST /cron/tick`                                                                                                                                          |

### 8.4 Admin client

- `admin/lib/api.ts` creates one `hc<…>()` client per sub-app (same origin; cookies flow automatically). `parseResponse` turns error envelopes into typed `ApiError`s.
- `admin/lib/query-keys.ts` is the query-key factory. Each module exposes hooks (`usePages`, `usePublishPage`, …) with optimistic updates, rollback and sonner toasts.
- Table state (page, sort, filters) is mirrored into the URL with nuqs, which is already installed, and doubles as the query key.

---

## 9. Admin panel

### 9.1 Information architecture

```
MENU      Dashboard
          Pages
          Insights      ▸ Articles · Categories · Authors
          Collections   ▸ Services · Plans · Testimonials · FAQs · Steps · CTA bands
          Media
          Enquiries     (badge: new count, styled like the "12+" pill in the inspiration)
          Newsletter
GROWTH    SEO           ▸ Overview · Defaults · Redirects
          Marketing     ▸ Tracking · Consent banner · Custom code
GENERAL   Appearance
          Site settings ▸ Identity · Contact & clinic · Navigation · Footer · Forms & microcopy · Notifications · Privacy
          Users & roles
          Activity log
          Help · Log out
[ Card ]  "Your website": dark-green swirl card (the inspiration's "Download our Mobile App" slot)
          live status · Open site · Preview drafts
```

Each user only sees the items their permissions allow.

The **topbar** holds:

- a search pill with a `⌘K` hint and a filter icon;
- a mail icon that opens the enquiries;
- a bell for notifications: new enquiries, scheduled posts going live, failed deliveries;
- the avatar block with name, email and role badge. Its menu has Account, Security, Theme (light / dark / system) and Sign out.

### 9.2 Design language: "Evergreen" (from the inspiration)

**Layout.** Floating rounded panels sit on a soft grey canvas with 16 px gutters: a 288 px sidebar panel, a 72 px topbar panel and the content panel. Cards have a radius of about 22 px and 20–24 px of padding.

**Typography.** Plus Jakarta Sans throughout:

- page title 36 px / 600, tight tracking;
- card title 18 px / 600;
- KPI figures 44 px / 600 with `tabular-nums`;
- body 14 px;
- Geist Mono for IDs and code.

| Token (light)                        | Value                          | Token (dark)    | Value     |
| ------------------------------------ | ------------------------------ | --------------- | --------- |
| canvas `--background`                | `#F2F3F2`                      | `--background`  | `#0C100D` |
| panel `--sidebar`                    | `#F7F8F7`                      | `--sidebar`     | `#111712` |
| `--card`                             | `#FFFFFF`                      | `--card`        | `#151C17` |
| `--foreground`                       | `#111411`                      | `--foreground`  | `#EEF2EE` |
| `--muted-foreground`                 | `#6B716C`                      |                 | `#9AA39C` |
| `--primary`                          | `#16823A`                      |                 | `#34B567` |
| `--primary-foreground`               | `#FFFFFF`                      |                 | `#06130A` |
| `--accent`                           | `#E6F4EB`                      |                 | `#18301F` |
| `--border`                           | `#E5E8E5`                      |                 | `#243026` |
| `--ring`                             | `#22A055`                      |                 | `#3FCB75` |
| `--chart-1..5`                       | `#1E6B35 · #3F9D5E · #6CC08C · #2F4F38 · #A7D9B8` | | lighter steps |
| status success / warning / danger    | soft fill + strong text (`#DCFCE7/#15803D`, `#FEF3C7/#B45309`, `#FEE2E2/#B91C1C`) | | tinted equivalents |
| `--radius`                           | `0.75rem` (cards use `rounded-2xl`, about 22 px)       |                 |           |

Tokens are stored as OKLCH and generated by the theme engine (§10). Hex is shown here for readability.

**Signature components** (built once in `admin/components`):

1. The floating-panel **shell**, with an active-nav indicator: a 4 px rounded bar on the left edge, a bold label and a filled icon.
2. The **hero KPI card**: a deep-green gradient with fine noise, white text and an up-right arrow chip. **KPI cards** with an outlined arrow chip and a delta caption.
3. The **pill bar chart**: capsule bars (Recharts `radius={999}`) with **hatched SVG-pattern** bars for the comparison period, and a floating value tag on the active bar.
4. The **semicircle gauge**: segmented solid, dark and hatched arcs, a big centred percentage and a legend.
5. **Status pills**: soft fill with strong text (Published / Draft / Scheduled / New / Contacted …).
6. The **promo card**: dark green with swirl line-art.
7. **Circular icon buttons** and the avatar block. The **search pill** with `⌘K`.
8. **Button pair**: filled green primary and outlined green secondary, both 44–48 px tall with `rounded-xl`.
9. **Empty states, skeletons and toasts** in the same language.

**Motion.** Restrained, 150–250 ms: KPI count-up, bar grow-in, skeleton shimmer. Reduced-motion preferences are respected. The admin **never** loads GSAP or Lenis.

### 9.3 Key screens

| Screen         | Highlights                                                                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in        | Split layout: brand panel with gradient and swirl, form on the right. 2FA step, forgot and reset password, invite acceptance                                                                                                                  |
| **Dashboard**  | "Good morning, {name}" with **New article** / **View site** buttons. KPI row: **New enquiries** (hero card, change vs last month), published articles, newsletter subscribers, SEO health %. **Enquiries this week** pill chart (solid = this week, hatched = last week). **Next up** card (next scheduled article, or the oldest uncontacted enquiry, with a CTA). **Team activity** feed with avatars and status pills. **Content health** gauge (complete / needs work / missing SEO or alt). Every widget respects RBAC |
| **Page builder** | Three panes: (1) block outline with drag handles, visibility and "same card" toggles, and an add-block library with thumbnails; (2) the schema form for the selected block, with character counters; (3) a **live preview iframe** in draft mode with desktop, tablet and phone sizes, refreshed on autosave. The toolbar shows status, "Saved 2 s ago", Preview, Discard, **Publish** and a History drawer (restore). The SEO tab has a SERP preview, social-card preview and checks |
| Articles       | Filterable table and a TipTap editor: headings, lists, quote, links, images from the library, bubble menu, live reading time. Side panel: status, schedule, category, author, cover with focal point, excerpt counter, featured flag, slug with an auto-redirect notice. SEO panel. Authors can "Submit for review" |
| Collections    | Sortable tables (drag to reorder), edit drawers built from the schemas, visibility toggles, "Used on Home, About" hints                                                                                                                       |
| Media library  | Grid and list views, drag-and-drop upload with progress, a "missing alt" filter, and a details drawer (alt, caption, focal-point picker, usage). Replace keeps the references. Deletion is blocked while an asset is in use              |
| **Enquiries**  | Kanban (New → Contacted → Booked → Closed) plus a table view. The detail drawer has the message, mailto/tel buttons, consent record, source/UTM, a notes and status timeline, and an assignee. Also CSV export, GDPR erase and a spam folder |
| SEO center     | Health gauge and an issue list with "Fix" deep links. Defaults, sitemap and robots preview, redirects with hit counts, verification codes                                                                                                      |
| Marketing      | GTM, GA4 and Pixel IDs with format validation and status. Consent-banner editor with live preview. Custom code (owner only) with consent categories. CAPI test event. Event-catalogue reference                                             |
| **Appearance** | Preset gallery. Colour pickers with **contrast badges** (AA/AAA) and automatic foregrounds. Radius. Side-by-side live preview of site and admin components. Draft → publish → reset. Logo and favicon                                     |
| Users & roles  | Users table (role badges, 2FA status, last active), invite dialog, role change, ban, sessions, **View as**. A read-only permission-matrix tab                                                                                                 |
| Activity log   | Filterable timeline with before/after field diffs                                                                                                                                                                                              |
| Account        | Profile, password, 2FA setup (QR code and backup codes), active sessions                                                                                                                                                                       |

### 9.4 UX standards

- **Schema-driven forms.**
  - Each Zod schema has UI metadata (a `z.registry`).
  - `z.toJSONSchema(schema, { io: "input", override })` turns it into JSON Schema with `x-ui` hints.
  - `SchemaForm` renders these widgets: text, textarea with counter, mini rich text, link (internal-page and anchor picker), media, icon, stat, number, toggle, select, sortable list (min/max), group, colour and collection picker.
  - Validation uses `zodResolver` on the same schema. Note that `toJSONSchema` drops refinements, so validation always uses the Zod schema itself.
- **Saving.** Autosave for drafts, with a save-state indicator and an unsaved-changes guard. Optimistic UI with rollback. ⌘S saves.
- **⌘K palette.** Navigate, create, and search across pages, articles, enquiries, media and settings, plus recent items.
- **States.** Empty states with a CTA, skeletons, and error boundaries with **retry** (`error.js` `retry()`).
- **Responsive.** Below 1024 px the sidebar becomes a sheet, and tables become cards on phones.
- **Accessibility.** WCAG 2.2 AA, keyboard drag-and-drop (dnd-kit keyboard sensor) and visible focus.
- **Activity-aware.** Transient UI state (dialogs, success flags) resets when a route is hidden, per the Next "preserving UI state" guide. There is no single-key "d" theme hotkey.

---

## 10. Theme customisation

**Goal.** The client can re-colour the public site and the admin from the Appearance screen. The design must stay safe: no flash of default colours, no unreadable contrast, and a revert is always one click away.

### 10.1 Theme engine (`lib/theme/`, isomorphic, unit-tested)

- **Input.** `ThemeConfig = { site: SiteTheme; admin: AdminTheme }`, validated by Zod. Colours are accepted as hex or OKLCH and normalised to **gamut-mapped OKLCH** with culori (`toGamut("rgb", "oklch")`).
- **Site theme.** The brand tokens that exist today (`brand`, `brand-deep`, `brand-mint`, `pine`, `forest`, `clay`, `cream`, `stone`, `mist`, `ink`, `ink-muted`), plus the semantic tokens created during tokenisation (§10.3). Each token is either **set** or **derived** from `brand` with a lock toggle, so a client can change one colour and get a coherent palette.
- **Admin theme.** A preset, or a custom `primary` (+ optional `accent`), a neutral tint, a radius and a default mode. These generate the full shadcn token set for light and dark: primary, accent, ring, sidebar-*, chart-1..5, and the soft status fills.
- **Core functions:**
  - `scale(base)` builds an 11-step OKLCH ramp with chroma easing at the extremes;
  - `onColor(bg)` picks a WCAG-safe foreground;
  - `contrast(a, b)` measures a pair;
  - `buildSiteTokens()` and `buildAdminTokens(mode)` produce the tokens;
  - `toCss(selector, tokens)` serialises them.
- **Safety.** **Publishing is blocked** when a text/background pair falls below WCAG AA (4.5:1 for body text, 3:1 for large text and UI). The UI explains which pair fails and offers "fix automatically", which nudges lightness. Output CSS is always **re-serialised from validated values**, never user-supplied CSS, so CSS injection is impossible.

### 10.2 Presets, storage and delivery

- **Presets:**
  - **Evergreen**: the inspiration green and the admin default;
  - **Teal Sage**: today's site palette and the site default;
  - Ocean, Plum, Terracotta and Graphite.
- **Storage.** `settings.theme` holds `draft` and `value` (published), with revisions.
- **Delivery.** `SiteFrame` and `AdminFrame` render `<style id="theme-tokens">` server-side from cached settings, so there is no flash. Each override targets the right scope: `:root` for the site, `[data-theme="admin"]` and `.dark` for the admin. Tailwind v4 utilities resolve through `var(--color-…)` and `color-mix()`, so overriding the variables recolours every token-based class.
- **Preview.**
  - The Appearance screen applies the draft live to the admin through `document.documentElement.style.setProperty`, and to a preview canvas of real site components.
  - "Preview on site" saves the draft and opens the site in draft mode, which reads the **draft** theme.
  - **Publish** and **Reset to preset** are separate actions.
- **Extras.** Logo, favicon/app icon (used by `manifest.ts` and metadata `icons`), and the admin radius.

### 10.3 Prerequisite: tokenise the site (Phase 3)

The site colours can only be fully customised once the hardcoded values become tokens:

- The about 60 literal colours become roughly 8 semantic tokens:
  - `--color-text-strong` (#0c0c0c)
  - `--color-text-muted` (#525252)
  - `--color-text-subtle` (#8a8f88)
  - `--color-line` (#dfe2d8)
  - `--color-line-soft` (#e7e9e0 / #ececec / #f2f2f2)
  - `--color-surface-soft` (#f8f9f5 / #fcfaf7)
  - `--color-overlay` (the dark-green rgba overlays)
  - `--color-glass`
- The off-token `#315d44` maps to `pine`/`forest`.
- Shadows use `color-mix(in oklab, var(--color-pine) …)`.
- Content SVG icons become inline React components using `currentColor`, via an icon registry that is also the admin icon picker.
- `tint` becomes a number applied through a CSS variable instead of Tailwind class strings.

Photos and the navbar texture stay as they are. Tokenisation must produce **zero visual diff**, which the Phase 3 parity screenshots verify.

---

## 11. SEO system

**Metadata**

- Global defaults live in `settings.seo`. Each page and article has its own `seo` with title, description, canonical override, noindex, OG title, description and image, and Twitter card.
- `buildMetadata(entity, defaults, path)` returns a Next `Metadata` object: the template title, description, `alternates.canonical`, `openGraph` (type, url, siteName, locale `en_IE`, images), `twitter` and `robots`.
- The site root `generateMetadata` (gated) sets:
  - `metadataBase` from `SITE_URL`;
  - `title: { template: "%s | Magda Kennedy", default }`;
  - icons and verification codes from settings;
  - `formatDetection` turned off.
- **`htmlLimitedBots: /.*/`** keeps metadata in `<head>` for every crawler.

**Open Graph images**

- When an entity has no custom image, `opengraph-image.tsx` generates one: a branded card using theme colours, the Fraunces and Inter TTFs committed under `assets/fonts`, the logo and the title, with the category for articles. ImageResponse limits apply: flexbox only, a 500 KB bundle, 1200×630.
- Uploaded images override the generated ones, and the upload is validated for size and ratio.

**Sitemap, robots and manifest**

- **`sitemap.ts`**, **`robots.ts`** and **`manifest.ts`** sit at the root of `app/` (gated, from cached data).
- The sitemap lists published, indexable pages and articles with `lastModified`.
- `robots.ts` disallows `/admin` and `/api` and points at the sitemap. **When `SITE_ENV` is not `production`, it disallows everything.**

**JSON-LD** (typed with `schema-dts`; `<` is escaped as `<`)

- `WebSite`, with a `SearchAction` for `/insights?q=`.
- `ProfessionalService` / `LocalBusiness`: address, geo, `openingHoursSpecification` from the structured hours, telephone, `priceRange`, `areaServed` (IE, GB, US), `sameAs`.
- `Person` for Magda Kennedy.
- `BreadcrumbList`, matching the breadcrumb UI.
- `BlogPosting` for articles.
- `Service` + `Offer` for plans.
- `FAQPage` as valid markup. Google only shows FAQ rich results for authoritative government and health sites, so the benefit is mainly for other engines and AI answers.

**On-page hygiene**

- `lang="en-IE"` and one H1 per page.
- Alt text is **required** for content images; decorative images are flagged as such.
- A consistent no-trailing-slash canonical policy.
- A custom `not-found` that is `noindex` and carries helpful links.
- Trimmed font preloads, which helps LCP.

**SEO health score**

- Checks run per page and article:
  - title of 30–60 characters, and unique;
  - description of 70–160 characters;
  - an OG image of the right size;
  - alt coverage;
  - an H1 is present;
  - no accidental `noindex`;
  - at least one internal link.
- Results are aggregated for the dashboard gauge and the SEO center, cached and invalidated by tag.

**Redirects**

- Managed in the admin, created automatically when a slug changes, and resolved in `app/(site)/[...slug]` for unmatched paths through a cached map.
- `after()` increments the hit count.
- The Next docs advise against database access in `proxy.ts`, so redirects are deliberately **not** handled there.

---

## 12. Marketing and tracking

### 12.1 Principles

- **Consent first.** The Irish DPC guidance (April 2020) and the EDPB cookie-banner taskforce require:
  - prior opt-in for every non-essential cookie and tag, **analytics included**;
  - **Reject all as prominent as Accept all**, on the first layer;
  - no pre-ticked boxes, sliders or "consent by scrolling";
  - granular categories;
  - a demonstrable record of consent;
  - re-confirming consent at least every **6 months**;
  - withdrawal as easy as giving consent, through a persistent "Cookie settings" link in the footer.
- **Basic consent mode.** No Google or Meta script loads until the visitor consents. Advanced mode (cookieless pings before consent) is only an option with the practice's DPO or legal sign-off (§2.3).
- **Health-data minimisation.** Under GDPR Art. 9, as read in CJEU *Lindenapotheke* (C-21/23), health information inferred from data counts as special-category data. So:
  - Topics, message text and condition-revealing URLs or query strings (e.g. `/contact?topic=anxiety-stress`, or article slugs that name techniques) are **never** sent to Google or Meta.
  - Vendor payloads use standard event names only, and URLs are sanitised: origin + path, no query or hash, with article paths collapsed to `/insights`.
  - Meta prohibits "mental health and psychological states" data in URLs, custom events and custom data.
  - Google Ads lists mental-health counselling as a sensitive category, so there are no remarketing lists or Customer Match. In GA4, Google signals and ads personalisation are switched off.
- **Configured, not coded.** Every ID, toggle and banner text lives in `settings`, so marketers change tracking without a deploy.

### 12.2 Consent manager (own lightweight implementation)

- **Implementation.** `lib/analytics/consent.ts` (state machine and storage) plus a site-styled `ConsentBanner` (Accept all / Reject all / Customise), with its copy editable in the admin. vanilla-cookieconsent 3.1 was the fallback considered; it was not needed.
- **Categories.**
  - `necessary`: always on.
  - `analytics` → `analytics_storage`.
  - `marketing` → `ad_storage`, `ad_user_data`, `ad_personalization`, the Meta Pixel and CAPI.
- **Storage.**
  - Cookie `mk_consent = { id, v (revision), ts, a, m }`: 180-day `Max-Age`, `Secure; SameSite=Lax`, not HttpOnly (the bootstrap script reads it).
  - A new revision, or a choice older than 6 months, re-prompts.
- **Proof.** An append-only `consent_events` table stores the consent id, choices, policy revision, a hash of the banner text, the action and a timestamp, but no raw IP. Events arrive through `navigator.sendBeacon` to `POST /api/v1/public/consent`.
- **Withdrawal.** Sends a denied update, deletes `_ga*`, `_gcl_*`, `_fbp` and `_fbc`, and reloads the page.

### 12.3 Bootstrap and loaders

1. **`TrackingBootstrap`** (server) renders **one inline `<script>`** at the very top of `SiteFrame`. The script runs at parse time, in this order:
   1. initialise `dataLayer` and `gtag`;
   2. `gtag("consent", "default", …)`: everything denied except `security_storage`, with `wait_for_update: 500`;
   3. `gtag("set", "ads_data_redaction", true)`;
   4. apply the stored `mk_consent` choice, if there is one (`consent update`);
   5. define `window.__loadGtm()`, and call it only if analytics or marketing consent exists.

   Details:
   - IDs are regex-validated (`^GTM-[A-Z0-9]+$`, `^G-[A-Z0-9]+$`, Pixel `^\d{10,20}$`) and passed through `JSON.stringify`.
   - `url_passthrough` stays off: it rewrites internal links, which clashes with nuqs URL state.
   - GTM's `<noscript>` iframe is omitted, because it would bypass consent.
   - `@next/third-parties` was not used. It is experimental, has no consent support, and its `afterInteractive` scripts only load after hydration.
2. **`ConsentBanner`** (client). On a choice it sends `gtag("consent", "update", …)`, pushes `{ event: "consent_update" }`, calls `__loadGtm()`, loads the Pixel if marketing consent was given, and logs the event.
3. **`MarketingScripts`** (client). Injects the Meta Pixel and custom snippets, each only once its consent category is granted (§12.6).
4. **`RouteTracker`** (client, in Suspense). Pushes `{ event: "virtual_page_view", page_location, page_path, page_title }` once per **pathname** change.
   - GTM's History Change trigger and GA4's "browser history" option were rejected, because they also fire on `replaceState`, which nuqs uses for URL state.
   - In GTM, the Google tag runs with `send_page_view: false`, and a GA4 `page_view` event tag fires on `virtual_page_view`.
5. **Ready-made GTM container.** We ship `docs/gtm-container.json`, an importable workspace containing the Google tag, GA4 event tags and Meta tags (each marked "require additional consent"), plus triggers for the event catalogue.

### 12.4 Typed dataLayer and event catalogue (`lib/analytics/events.ts`)

`track()` takes a discriminated union of events. For each call it:

- clears the previous parameters (`dataLayer.push({ event_params: null })`) and pushes `{ event, event_params }`;
- adds an `event_id` (`crypto.randomUUID()`) where deduplication needs one;
- never includes personal or health data.

Pushing to the dataLayer is always allowed; tags are gated by consent inside GTM. GA4 limits apply: event names of up to 40 characters, up to 25 parameters per event, parameter values of up to 100 characters.

| dataLayer event     | Fires when                                  | Params                                                     | GA4                         | Meta (standard events only)                                       |
| ------------------- | ------------------------------------------- | ---------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| `virtual_page_view` | each pathname change                        | `page_location`, `page_path` (both sanitised), `page_title` | `page_view`                 | `PageView` (allowlisted routes)                                   |
| `generate_lead`     | the API **accepted** the enquiry            | `lead_source: "contact_form"`, `form_id`, `event_id`       | `generate_lead` (key event) | `Lead`, deduplicated with CAPI via `event_id`                     |
| `contact_click`     | phone or email links                        | `method: "phone" \| "email"`, `event_id`                   | custom                      | `Contact`                                                         |
| `book_appointment`  | "Book a discovery call" CTAs                | `cta_location`, `event_id`                                 | custom                      | `Schedule`                                                        |
| `sign_up`           | newsletter double opt-in requested          | `method: "newsletter"`, `event_id`                         | `sign_up`                   | `CompleteRegistration` (not `Subscribe`, which means a paid plan) |
| `share`             | share link or copy                          | `method`, `content_type: "article"`                        | `share`                     | —                                                                 |

GA4 enhanced measurement covers scrolls, outbound clicks and file downloads. Its **form interactions** are switched off, because they fire even when validation fails; `generate_lead` is pushed only after the server confirms.

**Meta Pixel settings:**

- `fbq("set", "autoConfig", false, id)` runs before `init`, so the Pixel does no automatic button or metadata scraping.
- Automatic history-based PageView is disabled; `RouteTracker` sends PageView manually.
- Automatic Advanced Matching is **off** in Events Manager, because it scrapes form fields.

### 12.5 Meta Conversions API (server)

- **When.** On an accepted enquiry, inside `after()`, and **only if** CAPI is enabled **and** marketing consent was granted at event time. The client sends the consent flag, and the server re-checks the `mk_consent` cookie.
- **Endpoint.** `POST https://graph.facebook.com/v26.0/<pixelId>/events`. v26.0 is current; v25.0 is supported until 2028-07.
- **Payload:**
  - `event_name: "Lead"`, and `event_time` in Unix seconds;
  - the **same `event_id`** as the browser pixel (Meta deduplicates within 48 hours);
  - `action_source: "website"`;
  - `event_source_url`, sanitised;
  - `user_data`: `client_ip_address`, `client_user_agent`, `fbp` and `fbc` when present (these are never hashed), and `external_id` set to the SHA-256 of the lead id;
  - **no email or phone hashes by default**, because a `Lead` from a therapy practice plus a hashed email would reveal that a person is seeking psychological care;
  - **no `custom_data`**.
- **Enhanced matching.** An owner-only toggle adds normalised, hashed `em` and `ph`. It requires an explicit legal acknowledgement, which is stored in the audit log.
- **Delivery.** Retries with backoff. Failures surface as an admin notification.
- **Token handling.** The access token is encrypted at rest with AES-256-GCM (`APP_ENCRYPTION_KEY`). It is write-only in the UI ("configured ✓"), never returned to the browser and never logged.
- **Test events.** "Send test event" uses `test_event_code`. Meta also processes test events, so the button is for occasional checks only.

### 12.6 Custom code and CSP

**Custom code entries.**

- Only the owner can add them (2FA is mandatory for owners).
- Snippets are stored as **structured entries**, not raw HTML: `{ placement: "head" | "body", src (https, allowlisted host) | inline, consent category, routes[], enabled }`.
- They are injected with `next/script` (raw `dangerouslySetInnerHTML` scripts do not run on client renders) and never run in the admin.
- Every change is audited with a diff and can be rolled back.
- The env kill switch `DISABLE_CUSTOM_SCRIPTS=true` turns them all off at once.
- The UI warns that a snippet runs with full page privileges. Anyone who can publish the GTM container has the same power, so GTM users must use 2FA too.

**CSP.** An allowlist policy in `next.config` `headers()`:

- `script-src`: self, `www.googletagmanager.com`, `connect.facebook.net`, `challenges.cloudflare.com`, and the hosts allowlisted for custom code;
- `connect-src` and `img-src`: the Google measurement hosts (each Google TLD listed separately), Facebook, and the media host;
- `frame-src`: GTM and Turnstile;
- `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`.

It ships first as **Report-Only**, then is enforced. A nonce-based CSP was rejected: the Next docs say it requires fully dynamic rendering and is incompatible with Partial Prerendering (Cache Components), and GTM custom-HTML tags defeat it anyway.

---

## 13. Forms, enquiries, newsletter and email

**Contact form → enquiries**

- **Shared schema.** One `LeadInput` Zod schema covers both client and server. Fields: name, email, optional phone (normalised to E.164), topic (service slug or `other`), format, plan, message, and privacy consent (required).
- **Hidden fields:**
  - honeypot;
  - start timestamp;
  - `event_id`;
  - a consent snapshot;
  - first-touch UTM and referrer, kept in `sessionStorage`;
  - `fbp`/`fbc`, only with marketing consent.
- **Abuse checks**, in this order:
  - a Postgres fixed-window rate limit: 5 per 10 minutes per IP hash, and separately per email;
  - the honeypot, or a fill time under 3 s measured from an HMAC-signed render timestamp → accepted silently and marked spam;
  - Zod validation;
  - Cloudflare Turnstile, enabled automatically when its keys are configured. Server-side `siteverify` checks `success`, `action` and `hostname`; tokens are single-use and expire after 300 s. Turnstile counts as strictly necessary (no consent needed) and is disclosed in the privacy notice.
- **Notifications.** The practice email is **privacy-by-default**: name, contact details, preferred format and a deep link to the admin, but **not** the message, unless the owner switches that on. The auto-reply to the enquirer is optional and editable, and never echoes the message.
- **Retention.** Leads move through `new → contacted → booked → closed` or `spam`. A purge job runs on a configurable schedule (defaults: closed after 24 months, spam after 30 days). GDPR erase and export are available per person (email lookup).

**Newsletter**

- Double opt-in: `pending` → a confirmation email with a hashed one-time token → `confirmed`. Every email carries an unsubscribe link, and the admin can export the list as CSV.
- **Sending** campaigns is out of scope for v1 (§20).

**Email infrastructure**

- **Drivers.** `server/lib/email` exposes `sendEmail(message)` with three drivers: `resend` (production), `smtp` (Mailpit `axllent/mailpit:v1.31.4` in development) and `log` (tests). Phase 1 ships `log` and `smtp`; Phase 6 adds `resend`.
- **Templates.** React Email 6 templates live in `emails/` and follow the brand theme: invite, password reset, new enquiry, enquiry auto-reply, newsletter confirmation, delivery-failure alert. Components, `render` and `toPlainText` all come from the `react-email` package, and `pnpm email:dev` previews them.
- **Resend.**
  - The Resend 6 SDK returns `{ data, error }` rather than throwing, so the driver checks for errors. It sends with an idempotency key per message (e.g. `enquiry/<id>`).
  - Sending runs in `eu-west-1`, but Resend keeps account data and logs in the US. That is one more reason notifications never contain enquiry content.
- **Sending domain.** Verified in Resend, with SPF, DKIM and DMARC.

---

## 14. Media

**Upload pipeline.** Admin → `POST /api/v1/admin/media` (multipart, up to 20 MB) → then:

1. **Type check.** An allowlist (JPEG, PNG, WebP, AVIF, PDF) verified by magic bytes. **SVG is rejected** because of XSS risk; content icons come from the code icon registry.
2. **Processing with sharp:**
   - auto-orient;
   - **strip EXIF/GPS**;
   - downscale anything over 4000 px;
   - generate a 16 px WebP blur placeholder and the dominant colour.
3. **Storage.** A content-hashed immutable key (`media/2026/10/<hash>-<slug>.<ext>`) → storage driver → database row.

**Drivers:**

- `static`: the existing `/images/**` assets in `public/`.
- `local`: a mounted `./storage` directory, served by a Route Handler with immutable caching, and allowed through `images.localPatterns`.
- `s3`: Cloudflare R2 on the **EU jurisdiction endpoint** (`https://<account>.eu.r2.cloudflarestorage.com`) or S3, served from `MEDIA_PUBLIC_URL` and allowed through `images.remotePatterns`. The SDK client sets `requestChecksumCalculation: "WHEN_REQUIRED"`. Uploads pass through the server (no presigned browser PUTs), so the bucket needs no CORS rules. For an optional local S3 emulator use RustFS; MinIO is archived.

**next/image settings.**

- `qualities: [75, 90]`.
- The existing one-year `minimumCacheTTL` is safe because keys are immutable.
- `dangerouslyAllowLocalIP` is only for a local S3 emulator in development.

**Editing.**

- **Replace** keeps the media id and every reference, uploads a new key, and invalidates the `media` tag.
- The **focal point** maps to `object-position`; step **frames** are crop rectangles edited with react-easy-crop.
- **Usage** is computed by scanning documents for the media id. It feeds the details drawer and the delete guard.

---

## 15. Security and privacy

- **GDPR roles.** The practice is the controller. Sub-processors (VPS host, Cloudflare, Resend, Google and Meta when consented) are listed in the privacy policy, which is a custom CMS page. Enquiries may reveal health information, so:
  - access is limited to owner, admin and intake;
  - they never reach ad platforms;
  - notification emails contain no message by default;
  - audit diffs never contain message content;
  - retention purges run automatically;
  - DSAR export and erase are built in.
- **Secrets.** Env only (§17). The CAPI token is encrypted at rest. Secrets are never logged or sent to the client. **No `NEXT_PUBLIC_*` variables**: they are frozen at build, so client-visible values (such as the Turnstile site key) are passed from the server as props.
- **Headers:**
  - HSTS;
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - `Permissions-Policy` (camera, microphone and geolocation off);
  - `X-Frame-Options: SAMEORIGIN` (the admin preview iframe is same-origin);
  - CSP (§12.6);
  - `X-Robots-Tag` on `/admin` and `/api`.
- **AuthN.** 2FA is mandatory for owner and admin, rate limits are on, there is no public sign-up, passwords need at least 12 characters, error messages are generic, and sessions can be revoked.
- **AuthZ.** Matrix tests (§16), IDOR checks in services, and same-origin checks on admin mutations.
- **Input and output:**
  - Zod at every boundary;
  - TipTap JSON is validated and rendered with the static renderer, never as raw HTML;
  - URL fields only accept `https:`, `mailto:`, `tel:` and relative URLs;
  - JSON-LD is escaped;
  - custom code is owner-only.
- **Supply chain.** Renovate (or Dependabot), plus `pnpm audit` in CI, and pinned majors.
- **Backups.** Dokploy runs a scheduled `pg_dump` to R2 every day and keeps 30 days. A restore drill is documented in the runbook.
- **Observability:**
  - structured logs with `requestId`;
  - `instrumentation.ts` `onRequestError` (Sentry is optional later);
  - `/api/v1/health` for the Docker HEALTHCHECK and an uptime monitor.

---

## 16. Testing strategy

| Level                     | Tooling                                    | What is covered                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                      | Vitest                                     | Permission matrix (every role × permission); theme engine (contrast, gamut, preset snapshots); block schemas (fixtures validate, limits hold); SEO builders and JSON-LD escaping; slugs and redirects; CAPI normalisation and hashing; rate limiter; consent state machine |
| Integration               | Vitest + real PostgreSQL (docker compose / CI service) | Hono routes through `app.request()` with seeded users per role (401/403/200 matrix); publish, revision and restore flows; 409 on concurrent edits; scheduled publishing; enquiry spam rules; migrations from zero; seed idempotency |
| End-to-end                | Playwright                                 | Sign-in + 2FA; edit → preview → publish → public page updated; author cannot publish; enquiry appears in the inbox; theme publish changes CSS variables; consent banner blocks GTM until accepted |
| **Visual parity**         | Playwright screenshots                     | Baseline captured from **today's static site before migration**, then compared after every content-platform change (3 viewports, all routes, motion settled)                                           |
| Quality                   | Lighthouse CI, axe in Playwright           | Performance, SEO and accessibility budgets on key pages                                                                                                                                                  |

Locators must be role- or visibility-aware, because Activity keeps hidden routes in the DOM.

**CI pipeline:**

1. install;
2. lint;
3. typecheck (`next typegen && tsc --noEmit`);
4. unit tests;
5. integration tests (Postgres service);
6. **build with no database**;
7. E2E against `next start` + Postgres;
8. then, on `main`, trigger the Dokploy deploy webhook (Dokploy auto-deploy turned off).

---

## 17. Deployment and operations

**Dokploy topology.** One application (this Dockerfile), one PostgreSQL 17 service on the internal network with daily backups to R2, and an R2 bucket for media. Traefik handles TLS and the domains.

**Dockerfile changes:**

- The build needs no secrets, because env and auth are lazy.
- The runner copies `server/db/migrations` and a bundled `migrate.mjs`.
- `docker-entrypoint.sh` runs `node migrate.mjs && exec node server.js`, with a Postgres advisory lock so concurrent starts are safe.
- `HEALTHCHECK` on `/api/v1/health`.
- `NEXT_DEPLOYMENT_ID` is set to the git SHA for version-skew protection.
- `scripts/generate-hero-depth.mjs` moves to an on-demand `pnpm dlx` setup, so `@huggingface/transformers` leaves the image build.

**Environment variables** (runtime; validated lazily by `server/env.ts`):

| Variable                                                                            | Purpose                                                   |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `DATABASE_URL`                                                                      | PostgreSQL connection                                     |
| `SITE_URL`, `SITE_ENV`                                                              | Canonical origin; `production` \| `staging` \| `development` |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`                                             | Auth                                                      |
| `APP_ENCRYPTION_KEY`                                                                | Encrypting stored secrets (the CAPI token)                |
| `CRON_SECRET`                                                                       | Scheduler endpoint                                        |
| `STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `MEDIA_PUBLIC_URL` | Media storage           |
| `EMAIL_DRIVER`, `RESEND_API_KEY`, `EMAIL_FROM`, `SMTP_URL`                          | Email                                                     |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`                                        | Optional spam protection                                  |
| `SEED_OWNER_EMAIL`                                                                  | First owner (seed only)                                   |

**Local development.**

```bash
docker compose up -d    # postgres:17 + mailpit
pnpm db:migrate && pnpm db:seed && pnpm dev
```

A committed `.env.example` documents the variables.

**Environments.** Staging runs on Dokploy with `SITE_ENV=staging` (robots disallow everything, plus a visible "Staging" ribbon). Production runs **a single replica** (see §5.6).

**Runbook** (`docs/runbook.md`, written in the final phase): deploy, roll back, restore a backup, rotate secrets, recover the owner account, verify the sending domain, set up GTM.

---

## 18. Delivery phases (summary)

The full detail is in [`plan.md`](./plan.md). Each phase ends with something you can demo.

| Phase | Theme                              | Demo outcome                                                                                                       |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 0     | Foundations and guardrails         | Route groups split, DB tooling, test infra, CI fixed, visual-parity baseline captured. The site is unchanged       |
| 1     | Auth, RBAC and API core            | Sign in to `/admin` with 2FA. `proxy.ts` gate. Hono API with the permission matrix proven by tests                 |
| 2     | Admin shell and design system      | The Evergreen admin: sidebar, topbar, ⌘K, dashboard layout and charts on sample data, light and dark               |
| 3     | Content platform                   | The public site renders entirely from PostgreSQL (seeded), visually identical, motion refactored, colours tokenised |
| 4     | Content editing                    | Page builder with live preview, draft, publish and history; collections; globals; media library                    |
| 5     | Insights                           | Article editor, categories, authors, scheduling, search, automatic redirects                                        |
| 6     | Enquiries, forms and email         | Real contact form → enquiries CRM, notifications, auto-reply, newsletter double opt-in                              |
| 7     | SEO center                         | Metadata everywhere, OG images, sitemap, robots, JSON-LD, health score, redirects                                   |
| 8     | Marketing and tracking             | Consent banner + Consent Mode v2, GTM/GA4, Pixel + CAPI, event catalogue, custom code                              |
| 9     | Appearance                         | Theme presets, colour pickers with contrast guard, live preview, publish and reset, logo and favicon                |
| 10    | Users, roles and security          | Invites, roles, bans, sessions, View as, activity log, security headers and CSP                                     |
| 11    | Dashboard data, polish and launch  | Real KPIs, notifications, performance and a11y pass, E2E suite, runbook, production cut-over                        |

---

## 19. Risks and mitigations

| Risk                                                         | Mitigation                                                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Motion regressions once content is dynamic                   | A parity baseline before migration; motion refactored in isolation; screenshot diffs plus a manual motion QA checklist |
| Cache Components strictness (build errors, Activity side effects) | A Phase 0 spike on one route; the no-DB build in CI; page-scoped motion                                        |
| Library churn (Drizzle v1, Hono v5, Next 16.4, TS 7)         | Pin minor versions now and upgrade deliberately in a later maintenance phase                                         |
| Cache lives per process                                      | One replica (documented). Path to a Redis `cacheHandlers` implementation if scaling is ever needed                  |
| Health-data leakage to ad platforms                          | Basic consent mode; sanitised URLs; standard events only; CAPI without email or phone hashes by default; a GTM container template reviewed by us |
| Content quality and missing legal pages                      | Content-health panel, flagged placeholder legal copy, client sign-off before launch                                  |
| Scope creep in the admin                                     | Phased delivery with a demo per phase. The YAGNI list (§20) stays out until requested                               |
| Email deliverability                                         | Verified domain, SPF/DKIM/DMARC, Resend                                                                               |
| Owner lockout                                                | Bootstrap CLI, 2FA backup codes, recovery steps in the runbook                                                        |

---

## 20. Out of scope (candidates for later)

- Sending newsletter campaigns (list export works now; Resend Broadcasts or provider sync later).
- Online booking and payments (a Cal.com / Calendly integration for "Book a discovery call").
- First-party, cookieless page-view analytics in the dashboard (v1 dashboards use enquiry and content metrics).
- Per-service landing pages for local SEO.
- Multi-language.
- Passkeys.
- A public OpenAPI reference (Scalar).
- Multi-replica caching (Redis).
- A pipeline for swapping the hero WebGL image.
- AI writing assistance.

---

## Appendix A: Decision log (alternatives considered)

| Topic             | Options                                                       | Chosen                       | Reason                                                                                         |
| ----------------- | ------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| API placement     | Separate Hono service · **inside Next**                       | Inside Next                  | One deploy, shared types; Hono runs fine on the Node runtime                                    |
| Admin mutations   | Server Actions · **Hono**                                     | Hono                         | Your requirement; typed RPC; easy to test; reusable by future integrations                      |
| ORM               | Prisma · **Drizzle**                                          | Drizzle 0.45                 | SQL-like and light, no engine binary on Alpine, Better Auth CLI output                          |
| Caching model     | Legacy (`unstable_cache`) · **Cache Components**              | Cache Components             | `unstable_cache` is replaced in Next 16; draft-mode integration; Activity navigation UX         |
| Data at build     | Prerender with DB access · **render on request from cache**   | Request-time                 | The Docker build has no database, and pages never ship stale build-time content                 |
| Page editing      | Free-form builder · **typed section blocks**                  | Typed blocks                 | Protects the bespoke design and motion while editing stays flexible                             |
| CMS               | Payload / Sanity / Strapi · **custom on Hono**                | Custom                       | Hono, Better Auth, custom RBAC and a bespoke admin design were all required; no second app      |
| Redirects         | DB lookup in `proxy.ts` · **route-level resolver**            | Route-level                  | The Next docs say to avoid database checks in proxy                                             |
| CSP               | Nonce · **allowlist**                                         | Allowlist                    | A nonce forces dynamic rendering everywhere, and GTM breaks it                                  |
| Media             | `public/` folder · **storage drivers**                        | R2 / local                   | Next only serves `public/` files that existed at build time                                     |

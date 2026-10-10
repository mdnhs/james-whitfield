# Phase 9: Appearance (Theme Customisation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner or an admin re-colours the public site and the admin from **Admin ▸ Appearance** without a deploy. They pick a preset (Teal Sage, Evergreen, Ocean, Plum, Terracotta, Graphite) or their own brand colour, lock or unlock individual site tokens, set the admin's primary, accent, neutral tint, radius and default mode, and see the result live: the admin recolours in place and the real site reloads in draft mode beside it. Every pair of text and background colours that the components actually use is measured against WCAG; a failing pair blocks **Publish** and is explained in words ("Muted text on Cream is 3.21:1; it needs 4.5:1"), with **Fix automatically** next to it. Publishing writes a revision, expires one cache tag, and the next request to the site or the admin gets the new CSS variables from a server-rendered `<style id="theme-tokens">`, so there is no flash. Logo and favicon come from the media library: the logo replaces the mark in the site header and footer, and the favicon is rasterised by sharp into 32/180/192/512 px PNGs used by the metadata `icons` and `manifest.ts`. While the theme is the Teal Sage / Evergreen default, nothing is emitted, so visual parity is byte-for-byte unchanged.

**Architecture:** A pure, isomorphic theme engine lives in `lib/theme/` (culori 4): `color.ts` parses only `#rrggbb` or `oklch(L C H)` input, gamut-maps it into sRGB and normalises it to a canonical `oklch(l c h)` string; `scale`, `onColor`, `contrast` and `nudge` work on numbers. `presets.ts` holds the two base tables copied verbatim from today's CSS (Teal Sage site tokens from `site.css`, Evergreen admin light/dark from `admin.css`), and every other preset is **derived** from them by one hue/chroma(/lightness) shift (`derive.ts`), so a preset that equals the base is an identity and changes no value. `site.ts` and `admin.ts` resolve a validated `ThemeConfig` into full token maps; `checks.ts` measures the pairs and fixes them; `css.ts` re-serialises **only the tokens that differ from the CSS defaults** into `:root{…}` and `:root[data-theme="admin"]{…}` / `….dark{…}` blocks built from numbers, never from stored strings. The `theme` row in `settings` keeps `value` (published) and `draft` (working copy, the column already exists). `server/modules/theme/` owns the dedicated admin API (`GET /admin/theme`, `PUT /draft`, `POST /publish|reset|discard`, revisions, restore, `GET /colors`) with the contrast gate inside the publish transaction. `SiteFrame` reads `getThemeConfig(preview)` (draft only in authorised draft mode); a new `AdminFrame` (inside Suspense, after `io()`) does the same for the admin with the published theme and passes the default mode to next-themes.

**Tech Stack:** Next.js 16.3.8 (Cache Components, `"use cache"` + `cacheTag`, `draftMode()`, `io()`, metadata `icons`, `manifest.ts`, Route Handlers) · Hono 4.13.13 + `@hono/zod-validator` 0.9.1 · Drizzle 0.45.4 · Zod 4.6.5 · TanStack Query 5.104.1 · next-themes 0.4 · sharp 0.35 · **culori 4.0.2** · **react-colorful 5.8.1** · **@types/culori 4.0.1** (dev).

**Spec:** [`docs/brief.md`](../brief.md) (§1 R11, §2.2 D7, §3 criterion 7, §4.4, §5.5 step 2, §5.6 `settings:<key>`, §6.4 `site` and `theme` rows, §6.5 "Theme has draft and published versions", §6.6 `settings.draft`, §7.2 `appearance.read · update · publish`, §8.3 Appearance row, §9.2 Evergreen token table, §9.3 Appearance row, **§10 in full**, §11 OG card theme colours, §16 unit/E2E rows) and the Phase 9 contract in [`docs/plan.md`](../plan.md) ("### Phase 9: Appearance (theme customisation)"). Read both first.

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

Phase-9 values from the spec (verbatim):

- "`ThemeConfig = { site: SiteTheme; admin: AdminTheme }`, validated by Zod. Colours are accepted as hex or OKLCH and normalised to **gamut-mapped OKLCH** with culori (`toGamut("rgb", "oklch")`)." (§10.1)
- "**Site theme.** The brand tokens that exist today (`brand`, `brand-deep`, `brand-mint`, `pine`, `forest`, `clay`, `cream`, `stone`, `mist`, `ink`, `ink-muted`), plus the semantic tokens created during tokenisation (§10.3). Each token is either **set** or **derived** from `brand` with a lock toggle, so a client can change one colour and get a coherent palette." (§10.1)
- "**Admin theme.** A preset, or a custom `primary` (+ optional `accent`), a neutral tint, a radius and a default mode. These generate the full shadcn token set for light and dark: primary, accent, ring, sidebar-*, chart-1..5, and the soft status fills." (§10.1)
- "`scale(base)` builds an 11-step OKLCH ramp with chroma easing at the extremes; `onColor(bg)` picks a WCAG-safe foreground; `contrast(a, b)` measures a pair; `buildSiteTokens()` and `buildAdminTokens(mode)` produce the tokens; `toCss(selector, tokens)` serialises them." (§10.1)
- "**Publishing is blocked** when a text/background pair falls below WCAG AA (4.5:1 for body text, 3:1 for large text and UI). The UI explains which pair fails and offers "fix automatically", which nudges lightness. Output CSS is always **re-serialised from validated values**, never user-supplied CSS, so CSS injection is impossible." (§10.1)
- "**Evergreen**: the inspiration green and the admin default; **Teal Sage**: today's site palette and the site default; Ocean, Plum, Terracotta and Graphite." (§10.2)
- "**Storage.** `settings.theme` holds `draft` and `value` (published), with revisions." (§10.2)
- "`SiteFrame` and `AdminFrame` render `<style id="theme-tokens">` server-side from cached settings, so there is no flash. Each override targets the right scope: `:root` for the site, `[data-theme="admin"]` and `.dark` for the admin." (§10.2)
- "The Appearance screen applies the draft live to the admin through `document.documentElement.style.setProperty`, and to a preview canvas of real site components." · ""Preview on site" saves the draft and opens the site in draft mode, which reads the **draft** theme." · "**Publish** and **Reset to preset** are separate actions." (§10.2)
- "**Extras.** Logo, favicon/app icon (used by `manifest.ts` and metadata `icons`), and the admin radius." (§10.2)
- "`appearance.read · update · publish` | ✓ | ✓ | — | — | — | — | — |" (owner, admin only; §7.2)
- "Appearance | `GET /admin/theme` · `PUT /admin/theme/draft` · `POST /admin/theme/publish` · `POST /admin/theme/reset`" (§8.3)
- "Preset gallery. Colour pickers with **contrast badges** (AA/AAA) and automatic foregrounds. Radius. Side-by-side live preview of site and admin components. Draft → publish → reset. Logo and favicon" (§9.3)
- Acceptance (plan.md): "change the brand colour → preview → publish → the site's CSS variables change on the next request; failing contrast blocks publishing with an explanation; parity is unchanged while the theme is the Teal Sage default."

**New dependencies** (pinned exactly; all published ≥ 2 weeks before 2026-10-10, checked with `npm view <pkg> time --json`):

| Package | Version | Published | Why |
| --- | --- | --- | --- |
| `culori` | `4.0.2` | 2025-06-27 | OKLCH parse/convert, `toGamut`, `wcagContrast`, `formatHex` (brief §5.2 "4.0") |
| `react-colorful` | `5.8.1` | 2026-09-01 | `HexColorPicker` (brief §5.2 "5.8") |
| `@types/culori` (dev) | `4.0.1` | 2025-09-02 | culori 4.0.2 ships no types |

`culori` exports used (verified in the 4.0.2 tarball, `src/index.js`): `converter`, `formatHex`, `parse`, `toGamut` (signature `toGamut(dest = "rgb", mode = "oklch", …)`, returns a function giving a colour in `dest` mode), `wcagContrast`. `@types/culori` 4.0.1 declares all five.

**New environment variables:** none. **Migrations:** none (`settings.draft` exists since Task 0.6: "`draft` is only used by the theme").

## Review Focus

1. **A hostile or sloppy colour string.** Someone sends `#000;}</style><script>alert(1)</script>`, `oklch(1 0 0);color:red`, `red`, `var(--x)`, `rgb(0 0 0)`, `#abc`, or 5 KB of junk to `PUT /admin/theme/draft`, or hand-edits the `settings` row. The API answers a field error naming the path; a bad stored row parses to the defaults; the emitted CSS contains only `--name:oklch(<numbers>)` declarations and never a `<`. → Task 1 `color.test.ts` "refuses everything but #rrggbb and oklch()"; Task 2 `css.test.ts` "emits only numeric declarations"; Task 3 `theme.test.ts` "rejects a hostile colour with a field error" and "a hand-edited row falls back to the defaults".
2. **An extreme colour.** Pure black, pure white, `oklch(0.7 0.4 150)` (far outside sRGB), an achromatic grey (culori gives `h: undefined`), a hue of 360. The engine gamut-maps, never emits `NaN`, and `onColor` still returns a foreground at ≥ 4.5:1. → Task 1 `color.test.ts` "gamut-maps out-of-range input", "an achromatic colour has hue 0", "onColor is always ≥ 4.5:1 (500 seeded colours)"; Task 2 `css.test.ts` "no NaN for black, white and greys".
3. **Publishing around the UI.** A second tab still holds an older version; or a script calls `POST /admin/theme/publish` while the draft fails contrast. The stale call gets 409; the failing one gets 400 with the issues listed in words and the published theme, its revision list and the cache are untouched. → Task 3 `theme.test.ts` "409s a stale version", "blocks a failing draft and keeps the published theme".
4. **A visitor while the owner experiments.** The owner saves a draft with a new brand; an anonymous visitor (and a signed-out browser that still has the draft-mode cookie) must keep seeing the published theme; only an authorised draft-mode request sees the draft. → Task 4 `queries-theme.test.ts` "draft only when asked"; Task 8 E2E "an anonymous visitor never sees the draft".
5. **A favicon that is not a nice square PNG.** The icon media is a 3000×1200 JPEG, a seeded static SVG, soft-deleted, or missing from storage. The route returns a transparent-padded square PNG of the requested size, or 404, and metadata falls back to `/favicon.ico`; nothing throws during render. → Task 6 `brand-icon.test.ts` "pads a wide image into a square PNG", "renders a static SVG", "404s a deleted or unreadable icon"; `read.test.ts` "refuses a static path that climbs out of public/".

---

## Rulings (decisions this plan takes; one line each in the hand-off)

| # | Ruling | Tasks |
| --- | --- | --- |
| R1 Canonical colour | Stored and emitted colours are `oklch(l c h)` with `l` (0–1) and `c` rounded to 4 places and `h` to 2; chroma < 0.0005 becomes `c 0 h 0`. Input accepts only `#rrggbb` and `oklch(L[%] C H[deg])` (≤ 64 chars), checked by regex **before** culori parses it. Hex → canonical → hex round-trips exactly for every base value (verified while writing this plan; Task 1 pins it). | 1 |
| R2 Derivation | A preset or a custom brand is one shift from a base table: hue `+Δh`, chroma `×min(2, to.c/from.c)` (×1 when the base colour is under 0.02), lightness `+Δl` (site and admin light only; admin dark keeps lightness). Tokens with chroma < 0.015 (neutrals) never move; `clay` (the site accent) and the admin status/fixed tokens never move. When `to` equals `from` the token is returned untouched, so Teal Sage (site) and Evergreen (admin) are exact identities. | 2 |
| R3 Preset colours | Site brands: Teal Sage `#336060` (base), Evergreen `#1f6b3a`, Ocean `#2f5f8a` (+ clay `#a8553a`), Plum `#6a3f6b` (+ clay `#a8553a`), Terracotta `#8f4a36` (+ clay `#4f6b5a`), Graphite `#4a4f55`. Admin primaries: Evergreen `#157d38` (base), Teal Sage `#336060`, Ocean `#2f5f8a`, Plum `#6a3f6b`, Terracotta `#9a4a32`, Graphite `#4a4f55`. All twelve tables pass every contrast pair (simulated with culori 4.0.2 while writing this plan; Task 2 pins it and snapshots them). **Open question for the user:** approve these four new palettes. | 2 |
| R4 Emit only differences | `siteThemeCss` and `adminThemeCss` emit only tokens whose canonical value differs from the CSS default (and `--radius` only when ≠ 0.75). The default theme emits **nothing**, so parity is byte-identical and `site.css` / `admin.css` stay the source of the defaults. A sync test keeps the base tables equal to the CSS files. | 2, 4, 5 |
| R5 Contrast pairs | Site: 24 pairs taken from today's components (strong/muted text on every light surface, cream on every dark surface, brand/pine on mint/mist, clay on cream; subtle text on cream at 3:1). Admin: the 14 pairs and the three `--input` control-edge pairs already enforced by `tests/css/admin-tokens.test.ts`, in light and dark. Teal Sage's tightest pair is clay/cream at 4.53:1. | 2 |
| R6 Fix automatically | Site: moves the token of the pair that is not a page surface (cream, stone, surface-soft, surface-warm, brand-mint, mist) away from the other in 0.01 lightness steps until it passes, then locks it (or sets `brand` when the token is `brand`). Admin: moves `primary` (pairs touching primary, sidebar-primary or ring) or `accent` (pairs touching accent), else reports "pick a different colour". Foregrounds on primary and accent are always computed with `onColor`, so they never need fixing. | 2, 7 |
| R7 Storage and audit | `settings.theme.value` = published `ThemeConfig`; `draft` = working copy or `null`. Every draft write bumps `version` (409 on mismatch). Draft saves are **not** audited and expire nothing (draft-mode renders bypass the cache: `use-cache.md` "Draft Mode"). Publish, reset, discard and restore are audited (`appearance.publish|reset|discard|restore`). Publish writes a `setting/theme` revision (20 kept) and expires `settings:theme`. Restore loads a revision into the **draft** (brief §6.5 pattern). | 3 |
| R8 Reset to preset | `POST /admin/theme/reset { version, preset, scope: "site" \| "admin" \| "both" }` replaces the draft's colours with the preset (site: `{ preset, brand: null, tokens: {} }`; admin: `preset`, `primary`/`accent` null, `tint: "preset"`), keeps radius and mode, and does **not** publish. "Discard draft" (`POST /discard`) is the one-click revert to the published theme. | 3, 7 |
| R9 Legacy rows | The Phase 3 shape (`{ site: { brand: "#336060", cream: …, … }, admin: {} }`) parses under the new schema to the defaults (unknown keys stripped; `brand` normalises to the base brand). No data migration; the seed writes `{}`. | 3 |
| R10 Draft visibility | `getThemeConfig(draft)` is a `"use cache"` scope keyed by the boolean; `draft` comes only from `isPreviewing()` (draft-mode cookie **and** a session with `page.read`), the Phase 4 rule. The admin always renders the **published** theme; the Appearance page previews the draft client-side. | 4, 5 |
| R11 Admin delivery | New `app/(admin)/_frame/admin-frame.tsx` awaits `io()`, reads the published theme, renders `<style id="theme-tokens">` and wraps children in `ThemeProvider defaultTheme={mode}` (a saved per-browser choice still wins). The admin root layout wraps it in `<Suspense fallback={<div className="min-h-svh bg-background" />}>`, like the site's `SiteFrame`, so the build never reaches the database. | 5 |
| R12 Site preview canvas | "A preview canvas of real site components" is the real site in draft mode inside the existing `PreviewPane` iframe (Phase 4), reloaded after each draft autosave. The admin bundle cannot render site sections faithfully (`admin.css` has `@source not "../../features"` and no site tokens). The admin preview is live (`setProperty` on `<html>`) plus a card of real admin components. | 7 |
| R13 Logo and favicon | Both stay in the `site` global (§6.4: "logo, icon/favicon") and are edited on the Appearance page through `PUT /admin/globals/site` (`settings.update`, which owner and admin hold). The logo replaces `/images/hero/logo-mark.svg` in `components/brand.tsx` (seeded logo = that file, so parity holds). The favicon is rasterised on request by `app/site-icon/[size]/route.ts` (32, 180, 192, 512; `fit: "contain"`, transparent) from the media bytes (static file, local file, or the S3 public URL), cached with `"use cache"` under `settings:site` + `media`, linked with a `?v=<hash of src>` cache-buster. **No `.ico` generation:** `app/favicon.ico` stays as the legacy fallback. SVG uploads remain rejected (`server/lib/media/sniff.ts`); only seeded static SVGs can be rasterised. `site-icon` joins `RESERVED_SEGMENTS` and the proxy's skip-list. | 6 |
| R14 Share preview carry (Phase 7) | `GET /admin/theme/colors` (any signed-in admin user; the colours are public) returns `ogColors(published.site)`; `seo-aside.tsx` uses it instead of `ogColors({})`. The `/og` route and `manifest.ts` resolve tokens through the engine. | 3, 4, 7 |
| R15 Globals draft carry (Phase 4) | Only the theme gets a draft (brief §6.5: "Globals and collections go live on save"). The Phase 4 note "globals draft preview Phase 9" is closed by the theme draft; no other global changes. | 3 |
| R16 Auth layout carry (Phase 1.10) | The sign-in panel's hardcoded gradient `#0b2f17 → #3f9d5e` and `bg-[#3f9d5e]/30` become `bg-hero` and `bg-primary/30`, so they follow the theme. | 5 |
| R17 E2E isolation | The appearance spec publishes themes, so it runs in its own invocation (`pnpm test:e2e:appearance`, `playwright.appearance.config.ts`, fresh seed by the base global setup), never beside parity; the main config ignores `**/appearance/**`; CI runs it after the tracking step. It resets the theme in `afterAll`. | 8 |
| R18 Email templates | `emails/theme.ts` keeps its static palette this phase (emails are rendered outside the request cache and are out of the §10 scope). **Open question for the user:** should emails follow the published theme later? | — |

No new Server Actions: every write goes through Hono.

## File structure

| Files | Responsibility | Task |
| --- | --- | --- |
| `package.json`, `pnpm-lock.yaml` | culori, react-colorful, @types/culori | 1 |
| `lib/theme/color.ts` (+ test) | `parseColor`, `formatOklch`, `fit`, `toHex`, `contrast`, `sameColor`, `scale`, `onColor`, `nudge` | 1 |
| `lib/theme/tokens.ts`, `lib/theme/presets.ts`, `lib/theme/derive.ts`, `lib/theme/schema.ts`, `lib/theme/site.ts`, `lib/theme/admin.ts`, `lib/theme/checks.ts`, `lib/theme/css.ts` (+ tests), `tests/css/theme-presets.test.ts` | token lists, base tables, presets, Zod `ThemeConfig`, resolvers, contrast checks and fixes, CSS serialiser, CSS sync guard | 2 |
| `lib/content/globals.ts` (modify), `lib/content/globals.test.ts` (modify), `server/db/seed/globals.ts` (modify), `server/modules/theme/{service,routes}.ts`, `server/api/routes/admin.ts` (modify), `tests/integration/api/theme.test.ts` | schema in the globals registry, seed, dedicated API with the publish gate | 3 |
| `server/modules/content/queries.ts` (modify), `tests/integration/content/queries-theme.test.ts`, `app/(site)/_cms/site-frame.tsx` (modify), `components/brand.tsx` (+ test), `features/navbar/components/site-header.tsx`, `features/footer/components/site-footer.tsx` (modify), `lib/seo/og-theme.ts` (+ test, modify), `app/og/[[...path]]/route.tsx`, `app/manifest.ts` (modify), `lib/content/theme.ts` + test (delete) | site delivery, logo in the chrome, OG and manifest colours | 4 |
| `app/(admin)/_frame/admin-frame.tsx` (+ test), `app/(admin)/layout.tsx`, `app/(admin)/admin/(auth)/layout.tsx` (modify) | admin delivery, default mode, auth panel tokens | 5 |
| `lib/seo/icons.ts` (+ test), `server/lib/media/read.ts` (+ test), `server/modules/content/repo.ts` (modify), `server/modules/theme/icons.ts`, `app/site-icon/[size]/route.ts`, `tests/integration/content/brand-icon.test.ts`, `lib/seo/metadata.ts` (+ test, modify), `app/(site)/layout.tsx`, `app/manifest.ts`, `proxy.ts`, `proxy.test.ts`, `lib/content/page-path.ts` (modify) | favicon pipeline and wiring | 6 |
| `admin/lib/{api,query-keys}.ts` (modify), `admin/modules/appearance/*`, `app/(admin)/admin/(panel)/appearance/page.tsx`, `admin/modules/seo/seo-aside.tsx` (modify) | Appearance screen, live preview, share-preview carry | 7 |
| `playwright.appearance.config.ts`, `playwright.config.ts`, `package.json`, `.github/workflows/ci.yml`, `tests/e2e/appearance/appearance.spec.ts`, `tests/e2e/support/theme.ts`, `.superpowers/sdd/plan/progress.md` | acceptance E2E, isolation, exit | 8 |

## Conventions for executing this plan

- Run `pnpm db:up` before integration tests. No migration is generated in this phase; `git status server/db/migrations` must stay clean.
- `SiteFrame` and `AdminFrame` await `io()` before any cached read. The build has no database: `DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build` must pass after Tasks 4, 5, 6 and 8.
- Public client components only ever **type**-import `@/lib/content/globals` (true today: `insights-browser`, `mobile-nav`, `contact-form`, `custom-scripts`). Keep it that way so culori never reaches the public bundle.
- Integration tests mock `revalidateTag` (and `cacheTag`/`cacheLife` where a `"use cache"` helper runs) per file, keeping the rest of `next/cache`, as `tests/integration/api/globals.test.ts` and `redirects-admin.test.ts` do.
- Admin requests: `adminRequest(path, cookie, { method, body })` with `cookieFor(role)` (`tests/integration/helpers/auth.ts`).
- Commit messages: Conventional Commits, written normally, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Next-specific APIs were checked in `node_modules/next/dist/docs/01-app/`: `03-api-reference/01-directives/use-cache.md` ("Draft Mode": cached scopes re-run per request and store nothing; runtime APIs stay forbidden inside), `03-api-reference/04-functions/draft-mode.md`, `03-api-reference/04-functions/cacheTag.md`, `03-api-reference/04-functions/generate-metadata.md` (`icons.icon[]` objects with `url`, `sizes`, `type`; `icons.apple`), `03-api-reference/03-file-conventions/01-metadata/manifest.md` ("cached by default unless it uses a Request-time API"; ours calls `connection()`). Re-read before changing how any of them is used.

---

### Task 1: Colour core — dependencies, canonical OKLCH, contrast, scale, onColor, nudge

**Model:** sonnet

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `lib/theme/color.ts`
- Test: `lib/theme/color.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `lib/theme/color.ts`):
  - `type Oklch = { l: number; c: number; h: number }`
  - `parseColor(input: string): Oklch | null`
  - `formatOklch(color: Oklch): string` → `"oklch(0.4512 0.0601 194.77)"`
  - `fit(color: Oklch): Oklch` (gamut-map + normalise)
  - `toHex(color: Oklch): string`
  - `contrast(a: Oklch, b: Oklch): number`
  - `sameColor(a: Oklch, b: Oklch): boolean`
  - `scale(base: Oklch): Oklch[]` (11 entries, `SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]`)
  - `onColor(bg: Oklch, min?: number): Oklch`
  - `nudge(moving: Oklch, fixed: Oklch, min: number): Oklch | null`
  - `WHITE`, `BLACK` constants

- [ ] **Step 1: Install the pinned dependencies**

```bash
pnpm add --save-exact culori@4.0.2 react-colorful@5.8.1
pnpm add --save-exact -D @types/culori@4.0.1
```

Expected: `package.json` gains `"culori": "4.0.2"`, `"react-colorful": "5.8.1"` and dev `"@types/culori": "4.0.1"` (no carets).

- [ ] **Step 2: Write the failing test**

```ts
// lib/theme/color.test.ts
import { describe, expect, it } from "vitest"

import {
  BLACK,
  contrast,
  fit,
  formatOklch,
  nudge,
  onColor,
  parseColor,
  scale,
  toHex,
  WHITE,
} from "./color"

// Today's palette (site.css @theme, admin.css): every value must survive
// hex → canonical OKLCH → hex unchanged, or Teal Sage would drift (R1).
const BASE_HEX = [
  "#336060", "#d6e8e4", "#faf6f0", "#245f60", "#b55441", "#f3f4ee",
  "#d9e5e5", "#245333", "#1e4f50", "#030303", "#3d3d3d", "#0c0c0c",
  "#525252", "#8a8f88", "#dfe2d8", "#e7e9e0", "#ececec", "#f2f2f2",
  "#d8dccf", "#f8f9f5", "#fcfaf7", "#0d120f", "#315d44", "#002620",
  "#ffffff", "#111411", "#157d38", "#e9ece9", "#eef0ee", "#666c67",
  "#e6f4eb", "#14532d", "#dc2626", "#e5e8e5", "#7d867e", "#22a055",
  "#0c100d", "#1c251f", "#eef2ee", "#34b567", "#06130a", "#9aa39c",
]

// Deterministic PRNG so the property test never flakes.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32
    return seed / 2 ** 32
  }
}

describe("parseColor", () => {
  it("normalises hex to canonical OKLCH", () => {
    expect(formatOklch(parseColor("#336060")!)).toMatch(
      /^oklch\(0\.\d{1,4} 0\.\d{1,4} \d{1,3}(\.\d{1,2})?\)$/
    )
    expect(parseColor("#FFFFFF")).toEqual({ l: 1, c: 0, h: 0 })
    expect(parseColor("  #000000 ")).toEqual({ l: 0, c: 0, h: 0 })
  })

  it("accepts oklch() with a percentage lightness and deg hue", () => {
    expect(parseColor("oklch(52% 0.1 190deg)")).toEqual(
      parseColor("oklch(0.52 0.1 190)")
    )
  })

  it.each(BASE_HEX)("round-trips %s exactly", (hex) => {
    expect(toHex(parseColor(hex)!)).toBe(hex)
  })

  it("refuses everything but #rrggbb and oklch()", () => {
    for (const input of [
      "#000;}</style><script>alert(1)</script>",
      "oklch(1 0 0);color:red",
      "red",
      "var(--x)",
      "rgb(0 0 0)",
      "#abc",
      "#12345g",
      "oklch(1 0)",
      "",
      "#".padEnd(5000, "a"),
    ])
      expect(parseColor(input)).toBeNull()
  })

  it("gamut-maps out-of-range input into sRGB", () => {
    const wild = parseColor("oklch(0.7 0.4 150)")!
    expect(wild.c).toBeLessThan(0.4)
    expect(toHex(wild)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it("an achromatic colour has hue 0 and a hue of 360 wraps to 0", () => {
    expect(parseColor("#808080")!.h).toBe(0)
    expect(parseColor("oklch(0.5 0.1 360)")!.h).toBe(0)
  })
})

describe("formatOklch", () => {
  it("writes only numbers", () => {
    expect(formatOklch({ l: 0.45123456, c: 0.06, h: 194.7712 })).toBe(
      "oklch(0.4512 0.06 194.77)"
    )
  })
})

describe("contrast", () => {
  it("matches WCAG for black on white", () => {
    expect(contrast(BLACK, WHITE)).toBeCloseTo(21, 5)
  })
  it("matches the Teal Sage clay/cream pair (4.53:1)", () => {
    expect(
      contrast(parseColor("#b55441")!, parseColor("#faf6f0")!)
    ).toBeCloseTo(4.53, 2)
  })
})

describe("scale", () => {
  it("builds 11 displayable steps, light to dark, with eased chroma", () => {
    const steps = scale(parseColor("#336060")!)
    expect(steps).toHaveLength(11)
    for (let i = 1; i < steps.length; i++)
      expect(steps[i]!.l).toBeLessThan(steps[i - 1]!.l)
    for (const step of steps) expect(fit(step)).toEqual(step)
    expect(steps[0]!.c).toBeLessThan(steps[5]!.c)
    expect(steps[10]!.c).toBeLessThan(steps[5]!.c)
  })
})

describe("onColor", () => {
  it("is always at least 4.5:1 (500 seeded colours)", () => {
    const next = rng(42)
    for (let i = 0; i < 500; i++) {
      const bg = fit({ l: next(), c: next() * 0.37, h: next() * 360 })
      expect(contrast(onColor(bg), bg)).toBeGreaterThanOrEqual(4.5)
    }
  })
  it("prefers white on a dark brand", () => {
    expect(onColor(parseColor("#157d38")!)).toEqual(WHITE)
  })
})

describe("nudge", () => {
  it("moves a colour away from the fixed one until the pair passes", () => {
    const text = parseColor("#cccccc")!
    const surface = parseColor("#faf6f0")!
    const fixed = nudge(text, surface, 4.5)!
    expect(contrast(fixed, surface)).toBeGreaterThanOrEqual(4.5)
    expect(fixed.l).toBeLessThan(text.l)
  })
  it("returns null when no lightness can pass", () => {
    expect(nudge(WHITE, parseColor("#777777")!, 21)).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run --project unit lib/theme/color.test.ts`
Expected: FAIL with "Failed to resolve import "./color"".

- [ ] **Step 4: Write minimal implementation**

```ts
// lib/theme/color.ts
import { converter, formatHex, parse, toGamut, wcagContrast } from "culori"

// docs/brief.md §10.1. Isomorphic and pure: the server builds CSS from
// these numbers, the admin previews with them.
export type Oklch = { l: number; c: number; h: number }

const toOklch = converter("oklch")
// toGamut(dest, mode): a function that maps any colour into sRGB, reducing
// chroma in OKLCH, and returns it in rgb mode.
const intoRgb = toGamut("rgb", "oklch")

// Ruling R1: only these two forms reach culori. Named colours, var(),
// rgb() and anything with a ";" or "<" are refused here.
const HEX_INPUT = /^#[0-9a-f]{6}$/i
const OKLCH_INPUT =
  /^oklch\(\s*\d*\.?\d+%?\s+\d*\.?\d+\s+\d*\.?\d+(?:deg)?\s*\)$/i

export const WHITE: Oklch = { l: 1, c: 0, h: 0 }
export const BLACK: Oklch = { l: 0, c: 0, h: 0 }

const round = (value: number, places: number) => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function normalise(color: { l: number; c?: number; h?: number }): Oklch {
  const l = round(Math.min(1, Math.max(0, color.l)), 4)
  const c = round(Math.max(0, color.c ?? 0), 4)
  const hue = Number.isFinite(color.h) ? (color.h as number) : 0
  const h = round(((hue % 360) + 360) % 360, 2)
  if (c < 0.0005) return { l, c: 0, h: 0 }
  return { l, c, h: h === 360 ? 0 : h }
}

const culoriOklch = (color: Oklch) => ({ mode: "oklch" as const, ...color })

export function fit(color: Oklch): Oklch {
  return normalise(toOklch(intoRgb(culoriOklch(color))))
}

export function parseColor(input: string): Oklch | null {
  const text = input.trim()
  if (text.length > 64) return null
  if (!HEX_INPUT.test(text) && !OKLCH_INPUT.test(text)) return null
  const parsed = parse(text.toLowerCase())
  if (!parsed) return null
  const mapped = toOklch(intoRgb(parsed))
  if (!mapped || !Number.isFinite(mapped.l)) return null
  return normalise(mapped)
}

// Re-serialised from numbers, never from the stored string.
export function formatOklch({ l, c, h }: Oklch): string {
  return `oklch(${round(l, 4)} ${round(c, 4)} ${round(h, 2)})`
}

export function toHex(color: Oklch): string {
  return formatHex(intoRgb(culoriOklch(color)))
}

export function contrast(a: Oklch, b: Oklch): number {
  return wcagContrast(intoRgb(culoriOklch(a)), intoRgb(culoriOklch(b)))
}

export const sameColor = (a: Oklch, b: Oklch) =>
  a.l === b.l && a.c === b.c && a.h === b.h

export const SCALE_STEPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const
const LIGHTNESS = [
  0.971, 0.936, 0.885, 0.808, 0.712, 0.614, 0.523, 0.443, 0.37, 0.295, 0.215,
]
// Chroma eases off towards both ends so the palest and darkest steps stay
// inside sRGB without clipping to grey.
const CHROMA = [0.12, 0.25, 0.45, 0.7, 0.9, 1, 0.95, 0.85, 0.72, 0.58, 0.45]

export function scale(base: Oklch): Oklch[] {
  return LIGHTNESS.map((l, i) =>
    fit({ l, c: base.c * CHROMA[i]!, h: base.h })
  )
}

// A tinted near-black or white, whichever reads better; pure black or white
// as the fallback, which always clears 4.5:1 on some side.
export function onColor(bg: Oklch, min = 4.5): Oklch {
  const dark = fit({ l: 0.2, c: Math.min(bg.c, 0.03), h: bg.h })
  const best = contrast(WHITE, bg) >= contrast(dark, bg) ? WHITE : dark
  if (contrast(best, bg) >= min) return best
  return contrast(WHITE, bg) >= contrast(BLACK, bg) ? WHITE : BLACK
}

// "Fix automatically" (§10.1): step the lightness of `moving` away from
// `fixed` until the pair reaches `min`.
export function nudge(
  moving: Oklch,
  fixed: Oklch,
  min: number
): Oklch | null {
  const darker = contrast(BLACK, fixed) >= contrast(WHITE, fixed)
  for (let i = 0; i <= 100; i++) {
    const l = darker ? moving.l - i * 0.01 : moving.l + i * 0.01
    if (l < 0 || l > 1) break
    const candidate = fit({ ...moving, l })
    if (contrast(candidate, fixed) >= min) return candidate
  }
  return null
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run --project unit lib/theme/color.test.ts`
Expected: PASS. If a `round-trips` case fails, raise the `l`/`c` precision in `normalise` and `formatOklch` from 4 to 5 places (keep both in step) and re-run; do not drop the case.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm typecheck
git add package.json pnpm-lock.yaml lib/theme/color.ts lib/theme/color.test.ts
git commit -m "feat(theme): canonical oklch colour core with contrast, scale and onColor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Theme engine — tokens, presets, derivation, schema, resolvers, contrast checks, CSS

**Model:** opus

**Files:**
- Create: `lib/theme/tokens.ts`, `lib/theme/presets.ts`, `lib/theme/derive.ts`, `lib/theme/schema.ts`, `lib/theme/site.ts`, `lib/theme/admin.ts`, `lib/theme/checks.ts`, `lib/theme/css.ts`
- Test: `lib/theme/presets.test.ts`, `lib/theme/checks.test.ts`, `lib/theme/css.test.ts`, `tests/css/theme-presets.test.ts`

**Interfaces:**
- Consumes: Task 1 `lib/theme/color.ts`.
- Produces:
  - `lib/theme/tokens.ts`: `SITE_TOKENS` (moved verbatim from `lib/content/globals.ts`), `type SiteToken`, `ADMIN_TOKENS`, `type AdminToken`, `SITE_SURFACES`.
  - `lib/theme/presets.ts`: `PRESET_IDS`, `type PresetId`, `PRESETS: Record<PresetId, { label: string; site: { brand: string; clay?: string }; admin: { primary: string } }>`, `TEAL_SAGE_SITE: Record<SiteToken, string>`, `EVERGREEN_ADMIN: { radius: number; light: Record<AdminToken, string>; dark: Partial<Record<AdminToken, string>> }`.
  - `lib/theme/derive.ts`: `shift(token: Oklch, from: Oklch, to: Oklch, lightness: boolean): Oklch`, `NEUTRAL_CHROMA = 0.015`.
  - `lib/theme/schema.ts`: `ColorValue`, `SiteTheme`, `AdminTheme`, `ThemeConfig` (Zod), `type ThemeConfigValue`, `type SiteThemeConfig`, `type AdminThemeConfig`, `DEFAULT_THEME: ThemeConfigValue`, `ADMIN_RADII`.
  - `lib/theme/site.ts`: `resolveSiteTokens(site: SiteThemeConfig): Record<SiteToken, Oklch>`, `SITE_DEFAULT: Record<SiteToken, Oklch>`, `presetSiteTheme(preset: PresetId): SiteThemeConfig`.
  - `lib/theme/admin.ts`: `buildAdminTokens(admin: AdminThemeConfig, mode: "light" | "dark"): Record<AdminToken, Oklch>`, `ADMIN_DEFAULT: { light: …; dark: … }`, `presetAdminColours(preset: PresetId): Pick<AdminThemeConfig, "preset" | "primary" | "accent" | "tint">`.
  - `lib/theme/checks.ts`: `type ContrastIssue = { scope: "site" | "admin-light" | "admin-dark"; text: string; surface: string; ratio: number; min: 3 | 4.5 }`, `SITE_PAIRS`, `ADMIN_PAIRS`, `checkTheme(config: ThemeConfigValue): ContrastIssue[]`, `pairRatings(config): PairRating[]` (every pair with its ratio, for the badges), `describeIssue(issue: ContrastIssue): string`, `fixIssue(config, issue): ThemeConfigValue | null`, `fixAll(config): { config: ThemeConfigValue; remaining: ContrastIssue[] }`, `tokenLabel(scope, token): string`, `rating(ratio: number, min: 3 | 4.5): "AAA" | "AA" | "fail"`.
  - `lib/theme/css.ts`: `SCOPES`, `toCss(selector, tokens, extra?)`, `siteThemeCss(site: SiteThemeConfig): string`, `adminThemeCss(admin: AdminThemeConfig): string`, `liveDeclarations(admin: AdminThemeConfig, mode: "light" | "dark"): [string, string][]`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/css/theme-presets.test.ts
// R4: the engine's base tables must equal the CSS files, because the
// default theme emits nothing and the CSS is what visitors get.
import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { EVERGREEN_ADMIN, TEAL_SAGE_SITE } from "@/lib/theme/presets"
import { ADMIN_TOKENS, SITE_TOKENS } from "@/lib/theme/tokens"

const root = path.join(import.meta.dirname, "../..")
const read = (file: string) => readFileSync(path.join(root, file), "utf8")

function block(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`no ${selector} block`)
  const body = css.slice(start, css.indexOf("}", start))
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, n, v]) => [
      n,
      v.trim().toLowerCase(),
    ])
  )
}

describe("base tables match the CSS", () => {
  it("Teal Sage equals site.css @theme", () => {
    const theme = block(read("app/(site)/site.css"), "@theme")
    for (const token of SITE_TOKENS)
      expect(TEAL_SAGE_SITE[token], token).toBe(theme[`color-${token}`])
  })

  it("Evergreen equals admin.css light and dark", () => {
    const css = read("app/(admin)/admin.css")
    const light = block(css, ':root[data-theme="admin"]')
    const dark = block(css, ':root[data-theme="admin"].dark')
    expect(`${EVERGREEN_ADMIN.radius}rem`).toBe(light.radius)
    for (const token of ADMIN_TOKENS)
      expect(EVERGREEN_ADMIN.light[token], token).toBe(light[token])
    expect(EVERGREEN_ADMIN.dark).toEqual(
      Object.fromEntries(
        Object.entries(dark).filter(([n]) =>
          (ADMIN_TOKENS as readonly string[]).includes(n)
        )
      )
    )
  })
})
```

```ts
// lib/theme/presets.test.ts
import { describe, expect, it } from "vitest"

import { buildAdminTokens, presetAdminColours } from "./admin"
import { checkTheme } from "./checks"
import { toHex } from "./color"
import { PRESET_IDS } from "./presets"
import { DEFAULT_THEME, ThemeConfig } from "./schema"
import { presetSiteTheme, resolveSiteTokens, SITE_DEFAULT } from "./site"

const hexes = (tokens: Record<string, Parameters<typeof toHex>[0]>) =>
  Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, toHex(v)]))

const presetConfig = (id: (typeof PRESET_IDS)[number]) =>
  ThemeConfig.parse({
    site: presetSiteTheme(id),
    admin: { ...DEFAULT_THEME.admin, ...presetAdminColours(id) },
  })

describe("presets", () => {
  it("Teal Sage resolves to exactly today's site palette", () => {
    expect(resolveSiteTokens(DEFAULT_THEME.site)).toEqual(SITE_DEFAULT)
    expect(hexes(SITE_DEFAULT).brand).toBe("#336060")
  })

  it.each(PRESET_IDS)("%s passes every contrast pair", (id) => {
    expect(checkTheme(presetConfig(id))).toEqual([])
  })

  it.each(PRESET_IDS)("%s snapshot", (id) => {
    const config = presetConfig(id)
    expect({
      site: hexes(resolveSiteTokens(config.site)),
      light: hexes(buildAdminTokens(config.admin, "light")),
      dark: hexes(buildAdminTokens(config.admin, "dark")),
    }).toMatchSnapshot()
  })

  it("a custom brand moves derived tokens but not neutrals or clay", () => {
    const site = { ...DEFAULT_THEME.site, brand: "oklch(0.47 0.09 250)" }
    const tokens = resolveSiteTokens(ThemeConfig.parse({ site }).site)
    expect(tokens.pine.h).not.toBe(SITE_DEFAULT.pine.h)
    expect(tokens["text-muted"]).toEqual(SITE_DEFAULT["text-muted"])
    expect(tokens.clay).toEqual(SITE_DEFAULT.clay)
  })

  it("a locked token wins over derivation", () => {
    const site = {
      ...DEFAULT_THEME.site,
      brand: "#2f5f8a",
      tokens: { pine: "#1e4f50" },
    }
    const tokens = resolveSiteTokens(ThemeConfig.parse({ site }).site)
    expect(toHex(tokens.pine)).toBe("#1e4f50")
  })

  it("custom admin primary gets an automatic foreground in both modes", () => {
    const admin = { ...DEFAULT_THEME.admin, primary: "#e0b000" }
    const parsed = ThemeConfig.parse({ admin }).admin
    for (const mode of ["light", "dark"] as const) {
      const t = buildAdminTokens(parsed, mode)
      expect(t["primary-foreground"]).toBeDefined()
    }
    expect(checkTheme(ThemeConfig.parse({ admin })).map((i) => i.text))
      .not.toContain("primary-foreground")
  })

  it("tint 'none' greys the neutrals; 'primary' gives them its hue", () => {
    const base = ThemeConfig.parse({ admin: { primary: "#6a3f6b" } }).admin
    const none = buildAdminTokens({ ...base, tint: "none" }, "light")
    const tinted = buildAdminTokens({ ...base, tint: "primary" }, "light")
    expect(none.sidebar.c).toBe(0)
    expect(tinted.sidebar.h).toBeCloseTo(
      buildAdminTokens(base, "light").primary.h,
      0
    )
  })
})
```

```ts
// lib/theme/checks.test.ts
import { describe, expect, it } from "vitest"

import { contrast, parseColor } from "./color"
import {
  checkTheme,
  describeIssue,
  fixAll,
  fixIssue,
  rating,
} from "./checks"
import { DEFAULT_THEME, ThemeConfig } from "./schema"
import { resolveSiteTokens } from "./site"

const withSite = (site: object) =>
  ThemeConfig.parse({ site: { ...DEFAULT_THEME.site, ...site } })

describe("checkTheme", () => {
  it("the default theme has no issues", () => {
    expect(checkTheme(DEFAULT_THEME)).toEqual([])
  })

  it("finds a failing site pair and explains it in words", () => {
    const issues = checkTheme(withSite({ tokens: { "text-muted": "#cccccc" } }))
    const muted = issues.find(
      (i) => i.text === "text-muted" && i.surface === "cream"
    )!
    expect(muted).toMatchObject({ scope: "site", min: 4.5 })
    expect(describeIssue(muted)).toMatch(
      /^Muted text on Cream is \d\.\d{2}:1; it needs 4\.5:1 \(body text\)\.$/
    )
  })

  it("never rounds a failing ratio up to the threshold", () => {
    const issue = {
      scope: "site" as const,
      text: "clay",
      surface: "cream",
      ratio: 4.4999,
      min: 4.5 as const,
    }
    expect(describeIssue(issue)).toContain("4.49:1")
  })

  it("checks admin light and dark separately", () => {
    const config = ThemeConfig.parse({ admin: { primary: "#e8f0e8" } })
    const scopes = new Set(checkTheme(config).map((i) => i.scope))
    expect(scopes.has("admin-light")).toBe(true)
  })
})

describe("fix automatically", () => {
  it("fixes a site text token by locking a darker value", () => {
    const config = withSite({ tokens: { "text-muted": "#cccccc" } })
    const [issue] = checkTheme(config)
    const fixed = fixIssue(config, issue!)!
    const tokens = resolveSiteTokens(fixed.site)
    expect(contrast(tokens["text-muted"], tokens.cream)).toBeGreaterThanOrEqual(
      4.5
    )
  })

  it("moves the coloured side, not the page surface", () => {
    const config = withSite({ brand: "#7fb0b0" })
    const issue = checkTheme(config).find(
      (i) => i.text === "cream" && i.surface === "brand"
    )!
    const fixed = fixIssue(config, issue)!
    expect(fixed.site.brand).not.toBe(config.site.brand)
    expect(fixed.site.tokens.cream).toBeUndefined()
  })

  it("fixAll leaves no issues for a fixable theme", () => {
    const config = withSite({
      tokens: { "text-muted": "#cccccc", "text-strong": "#bbbbbb" },
    })
    expect(fixAll(config).remaining).toEqual([])
  })

  it("rates AAA, AA and fail", () => {
    expect(rating(7.1, 4.5)).toBe("AAA")
    expect(rating(4.6, 4.5)).toBe("AA")
    expect(rating(4.49, 4.5)).toBe("fail")
    expect(rating(4.6, 3)).toBe("AAA")
    expect(parseColor("#000000")).not.toBeNull()
  })
})
```

```ts
// lib/theme/css.test.ts
import { describe, expect, it } from "vitest"

import { adminThemeCss, liveDeclarations, siteThemeCss } from "./css"
import { DEFAULT_THEME, ThemeConfig } from "./schema"

const SAFE = /^[a-z0-9\-:;(){}.\[\]="\s]*$/i

describe("siteThemeCss", () => {
  it("emits nothing for the default theme (parity, R4)", () => {
    expect(siteThemeCss(DEFAULT_THEME.site)).toBe("")
  })

  it("emits only the tokens that changed, as :root overrides", () => {
    const site = ThemeConfig.parse({
      site: { tokens: { clay: "#a8553a" } },
    }).site
    expect(siteThemeCss(site)).toMatch(
      /^:root\{--color-clay:oklch\([\d.]+ [\d.]+ [\d.]+\)\}$/
    )
  })

  it("emits only numeric declarations", () => {
    const site = ThemeConfig.parse({ site: { brand: "#2f5f8a" } }).site
    const css = siteThemeCss(site)
    expect(css).toMatch(SAFE)
    expect(css).not.toContain("<")
    expect(css).not.toContain("NaN")
  })

  it("no NaN for black, white and greys", () => {
    for (const brand of ["#000000", "#ffffff", "#808080"]) {
      const css = siteThemeCss(ThemeConfig.parse({ site: { brand } }).site)
      expect(css).not.toContain("NaN")
      expect(css).toMatch(SAFE)
    }
  })
})

describe("adminThemeCss", () => {
  it("emits nothing for the Evergreen default", () => {
    expect(adminThemeCss(DEFAULT_THEME.admin)).toBe("")
  })

  it("scopes light and dark separately and adds the radius", () => {
    const admin = ThemeConfig.parse({
      admin: { primary: "#2f5f8a", radius: 0.5 },
    }).admin
    const css = adminThemeCss(admin)
    expect(css).toMatch(/^:root\[data-theme="admin"\]\{[^}]*--radius:0\.5rem/)
    expect(css).toContain(':root[data-theme="admin"].dark{')
    expect(css).toMatch(SAFE)
  })
})

describe("liveDeclarations", () => {
  it("lists every admin token and the radius", () => {
    const decls = liveDeclarations(DEFAULT_THEME.admin, "light")
    expect(decls).toContainEqual(["--radius", "0.75rem"])
    expect(decls.find(([n]) => n === "--primary")?.[1]).toMatch(/^oklch\(/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --project unit lib/theme tests/css/theme-presets.test.ts`
Expected: FAIL with "Failed to resolve import "./presets"" (and the other new modules).

- [ ] **Step 3: Write the token lists**

```ts
// lib/theme/tokens.ts
// Site colour tokens the theme can override (app/(site)/site.css @theme).
export const SITE_TOKENS = [
  "brand",
  "brand-mint",
  "cream",
  "brand-deep",
  "clay",
  "stone",
  "mist",
  "forest",
  "pine",
  "ink",
  "ink-muted",
  "text-strong",
  "text-muted",
  "text-subtle",
  "line",
  "line-soft",
  "line-neutral",
  "line-faint",
  "line-rule",
  "surface-soft",
  "surface-warm",
  "hero-base",
  "moss",
  "spruce",
] as const
export type SiteToken = (typeof SITE_TOKENS)[number]

// Page backgrounds: "fix automatically" moves the other colour (R6).
export const SITE_SURFACES: readonly SiteToken[] = [
  "cream",
  "stone",
  "surface-soft",
  "surface-warm",
  "brand-mint",
  "mist",
]

// app/(admin)/admin.css :root[data-theme="admin"] (minus --radius).
export const ADMIN_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "success",
  "success-soft",
  "warning",
  "warning-soft",
  "danger",
  "danger-soft",
  "skeleton",
  "hatch",
  "hero-from",
  "hero-to",
  "hero-foreground",
  "hero-chip",
  "hero-chip-foreground",
  "hero-delta",
  "promo-from",
  "promo-to",
  "promo-foreground",
] as const
export type AdminToken = (typeof ADMIN_TOKENS)[number]
```

- [ ] **Step 4: Write the base tables and presets**

```ts
// lib/theme/presets.ts
import type { AdminToken, SiteToken } from "./tokens"

export const PRESET_IDS = [
  "teal-sage",
  "evergreen",
  "ocean",
  "plum",
  "terracotta",
  "graphite",
] as const
export type PresetId = (typeof PRESET_IDS)[number]

// Today's site palette, verbatim from app/(site)/site.css @theme
// (tests/css/theme-presets.test.ts keeps them equal).
export const TEAL_SAGE_SITE: Record<SiteToken, string> = {
  brand: "#336060",
  "brand-mint": "#d6e8e4",
  cream: "#faf6f0",
  "brand-deep": "#245f60",
  clay: "#b55441",
  stone: "#f3f4ee",
  mist: "#d9e5e5",
  forest: "#245333",
  pine: "#1e4f50",
  ink: "#030303",
  "ink-muted": "#3d3d3d",
  "text-strong": "#0c0c0c",
  "text-muted": "#525252",
  "text-subtle": "#8a8f88",
  line: "#dfe2d8",
  "line-soft": "#e7e9e0",
  "line-neutral": "#ececec",
  "line-faint": "#f2f2f2",
  "line-rule": "#d8dccf",
  "surface-soft": "#f8f9f5",
  "surface-warm": "#fcfaf7",
  "hero-base": "#0d120f",
  moss: "#315d44",
  spruce: "#002620",
}

// Evergreen, verbatim from app/(admin)/admin.css. Dark lists only what the
// .dark block overrides; everything else falls back to light, as in CSS.
export const EVERGREEN_ADMIN: {
  radius: number
  light: Record<AdminToken, string>
  dark: Partial<Record<AdminToken, string>>
} = {
  radius: 0.75,
  light: {
    background: "#ffffff",
    foreground: "#111411",
    card: "#ffffff",
    "card-foreground": "#111411",
    popover: "#ffffff",
    "popover-foreground": "#111411",
    primary: "#157d38",
    "primary-foreground": "#ffffff",
    secondary: "#e9ece9",
    "secondary-foreground": "#111411",
    muted: "#eef0ee",
    "muted-foreground": "#666c67",
    accent: "#e6f4eb",
    "accent-foreground": "#14532d",
    destructive: "#dc2626",
    border: "#e5e8e5",
    input: "#7d867e",
    ring: "#22a055",
    "chart-1": "#1e6b35",
    "chart-2": "#3f9d5e",
    "chart-3": "#6cc08c",
    "chart-4": "#2f4f38",
    "chart-5": "#a7d9b8",
    sidebar: "#f2f3f2",
    "sidebar-foreground": "#111411",
    "sidebar-primary": "#157d38",
    "sidebar-primary-foreground": "#ffffff",
    "sidebar-accent": "#e6f4eb",
    "sidebar-accent-foreground": "#14532d",
    "sidebar-border": "#e5e8e5",
    "sidebar-ring": "#22a055",
    success: "#15803d",
    "success-soft": "#dcfce7",
    warning: "#b45309",
    "warning-soft": "#fef3c7",
    danger: "#b91c1c",
    "danger-soft": "#fee2e2",
    skeleton: "#e2e6e2",
    hatch: "#8fcca5",
    "hero-from": "#0f4d23",
    "hero-to": "#2b6e3e",
    "hero-foreground": "#ffffff",
    "hero-chip": "#ffffff",
    "hero-chip-foreground": "#111411",
    "hero-delta": "#a6f0bd",
    "promo-from": "#06120a",
    "promo-to": "#12381f",
    "promo-foreground": "#ffffff",
  },
  dark: {
    background: "#0c100d",
    foreground: "#eef2ee",
    card: "#1c251f",
    "card-foreground": "#eef2ee",
    popover: "#1c251f",
    "popover-foreground": "#eef2ee",
    primary: "#34b567",
    "primary-foreground": "#06130a",
    secondary: "#1c241e",
    "secondary-foreground": "#eef2ee",
    muted: "#1c241e",
    "muted-foreground": "#9aa39c",
    accent: "#18301f",
    "accent-foreground": "#c9ecd6",
    destructive: "#f87171",
    border: "#243026",
    input: "#667369",
    ring: "#3fcb75",
    "chart-1": "#3fcb75",
    "chart-2": "#6cc08c",
    "chart-3": "#a7d9b8",
    "chart-4": "#2f7a45",
    "chart-5": "#1f4a2b",
    sidebar: "#141b16",
    "sidebar-foreground": "#eef2ee",
    "sidebar-primary": "#34b567",
    "sidebar-primary-foreground": "#06130a",
    "sidebar-accent": "#18301f",
    "sidebar-accent-foreground": "#c9ecd6",
    "sidebar-border": "#243026",
    "sidebar-ring": "#3fcb75",
    success: "#4ade80",
    "success-soft": "#12301c",
    warning: "#fbbf24",
    "warning-soft": "#33270c",
    danger: "#f87171",
    "danger-soft": "#3a1414",
    skeleton: "#2a352d",
    "hero-chip": "#ffffff",
    "hero-chip-foreground": "#111411",
    "hero-delta": "#a6f0bd",
    hatch: "#2f7a45",
  },
}

// Ruling R3. Every preset is one shift from the base tables above.
export const PRESETS: Record<
  PresetId,
  { label: string; site: { brand: string; clay?: string }; admin: { primary: string } }
> = {
  "teal-sage": {
    label: "Teal Sage",
    site: { brand: "#336060" },
    admin: { primary: "#336060" },
  },
  evergreen: {
    label: "Evergreen",
    site: { brand: "#1f6b3a" },
    admin: { primary: "#157d38" },
  },
  ocean: {
    label: "Ocean",
    site: { brand: "#2f5f8a", clay: "#a8553a" },
    admin: { primary: "#2f5f8a" },
  },
  plum: {
    label: "Plum",
    site: { brand: "#6a3f6b", clay: "#a8553a" },
    admin: { primary: "#6a3f6b" },
  },
  terracotta: {
    label: "Terracotta",
    site: { brand: "#8f4a36", clay: "#4f6b5a" },
    admin: { primary: "#9a4a32" },
  },
  graphite: {
    label: "Graphite",
    site: { brand: "#4a4f55" },
    admin: { primary: "#4a4f55" },
  },
}
```

If the CSS sync test reports a mismatch, the CSS is the truth: copy its value into the table (never the other way round).

- [ ] **Step 5: Write the derivation and the schema**

```ts
// lib/theme/derive.ts
import { fit, sameColor, type Oklch } from "./color"

// Below this chroma a token reads as grey and stays put (Ruling R2).
export const NEUTRAL_CHROMA = 0.015

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

// Moves `token` the way the anchor moved from `from` to `to`.
export function shift(
  token: Oklch,
  from: Oklch,
  to: Oklch,
  lightness: boolean
): Oklch {
  if (sameColor(from, to) || token.c < NEUTRAL_CHROMA) return token
  const ratio = from.c > 0.02 ? Math.min(2, to.c / from.c) : 1
  return fit({
    l: lightness ? clamp(token.l + (to.l - from.l), 0.04, 0.985) : token.l,
    c: Math.min(0.37, token.c * ratio),
    h: token.h + (to.h - from.h),
  })
}
```

```ts
// lib/theme/schema.ts
import * as z from "zod"

import { formatOklch, parseColor } from "./color"
import { PRESET_IDS } from "./presets"
import { SITE_TOKENS } from "./tokens"

// Hex or oklch() in, canonical oklch() out (Ruling R1). Stored values are
// already canonical, so parsing them again is a no-op.
export const ColorValue = z
  .string()
  .max(64)
  .transform((text, ctx) => {
    const color = parseColor(text)
    if (!color) {
      ctx.addIssue({
        code: "custom",
        message: "Use a #rrggbb or oklch(L C H) colour",
      })
      return z.NEVER
    }
    return formatOklch(color)
  })

export const SiteTheme = z.object({
  preset: z.enum(PRESET_IDS).default("teal-sage"),
  // null = the preset's brand.
  brand: ColorValue.nullable().default(null),
  // Locked tokens; anything absent is derived from the brand.
  tokens: z.partialRecord(z.enum(SITE_TOKENS), ColorValue).default({}),
})

export const ADMIN_RADII = [0, 0.25, 0.5, 0.75, 1, 1.25] as const

export const AdminTheme = z.object({
  preset: z.enum(PRESET_IDS).default("evergreen"),
  primary: ColorValue.nullable().default(null),
  accent: ColorValue.nullable().default(null),
  tint: z.enum(["preset", "none", "primary"]).default("preset"),
  radius: z.number().min(0).max(1.5).multipleOf(0.125).default(0.75),
  mode: z.enum(["system", "light", "dark"]).default("system"),
})

export const ThemeConfig = z.object({
  site: SiteTheme.prefault({}),
  admin: AdminTheme.prefault({}),
})
export type ThemeConfigValue = z.output<typeof ThemeConfig>
export type SiteThemeConfig = ThemeConfigValue["site"]
export type AdminThemeConfig = ThemeConfigValue["admin"]

export const DEFAULT_THEME: ThemeConfigValue = ThemeConfig.parse({})
```

- [ ] **Step 6: Write the resolvers**

```ts
// lib/theme/site.ts
import { parseColor, type Oklch } from "./color"
import { shift } from "./derive"
import { PRESETS, TEAL_SAGE_SITE, type PresetId } from "./presets"
import type { SiteThemeConfig } from "./schema"
import { SITE_TOKENS, type SiteToken } from "./tokens"

type SiteTokens = Record<SiteToken, Oklch>

const table = (hex: Record<SiteToken, string>) =>
  Object.fromEntries(
    SITE_TOKENS.map((t) => [t, parseColor(hex[t])!])
  ) as SiteTokens

const BASE = table(TEAL_SAGE_SITE)

// clay is the site's accent: presets set it, brands never move it (R2).
function derived(from: SiteTokens, brand: Oklch, clay: Oklch): SiteTokens {
  return Object.fromEntries(
    SITE_TOKENS.map((t) => [
      t,
      t === "brand"
        ? brand
        : t === "clay"
          ? clay
          : shift(from[t], from.brand, brand, true),
    ])
  ) as SiteTokens
}

const PRESET_TABLES = Object.fromEntries(
  (Object.keys(PRESETS) as PresetId[]).map((id) => {
    const { brand, clay } = PRESETS[id].site
    return [
      id,
      derived(
        BASE,
        parseColor(brand)!,
        clay ? parseColor(clay)! : BASE.clay
      ),
    ]
  })
) as Record<PresetId, SiteTokens>

// Stored values are canonical; a value that somehow fails to parse falls
// back to the preset's, so rendering never throws.
export function resolveSiteTokens(site: SiteThemeConfig): SiteTokens {
  const preset = PRESET_TABLES[site.preset] ?? PRESET_TABLES["teal-sage"]
  const brand = (site.brand && parseColor(site.brand)) || preset.brand
  const out = derived(preset, brand, preset.clay)
  for (const t of SITE_TOKENS) {
    const locked = site.tokens[t]
    const color = locked ? parseColor(locked) : null
    if (color) out[t] = color
  }
  return out
}

export const SITE_DEFAULT: SiteTokens = PRESET_TABLES["teal-sage"]

export const presetSiteTheme = (preset: PresetId): SiteThemeConfig => ({
  preset,
  brand: null,
  tokens: {},
})
```

```ts
// lib/theme/admin.ts
import { contrast, onColor, parseColor, sameColor, scale, type Oklch } from "./color"
import { NEUTRAL_CHROMA, shift } from "./derive"
import { EVERGREEN_ADMIN, PRESETS, type PresetId } from "./presets"
import type { AdminThemeConfig } from "./schema"
import { ADMIN_TOKENS, type AdminToken } from "./tokens"

type AdminTokens = Record<AdminToken, Oklch>
type Mode = "light" | "dark"

const LIGHT = Object.fromEntries(
  ADMIN_TOKENS.map((t) => [t, parseColor(EVERGREEN_ADMIN.light[t])!])
) as AdminTokens
const DARK = Object.fromEntries(
  ADMIN_TOKENS.map((t) => [
    t,
    parseColor(EVERGREEN_ADMIN.dark[t] ?? EVERGREEN_ADMIN.light[t])!,
  ])
) as AdminTokens
const BASE: Record<Mode, AdminTokens> = { light: LIGHT, dark: DARK }

// Semantic colours that must not follow the brand (R2).
const FIXED = new Set<AdminToken>([
  "destructive",
  "success",
  "success-soft",
  "warning",
  "warning-soft",
  "danger",
  "danger-soft",
  "hero-foreground",
  "hero-chip",
  "hero-chip-foreground",
  "promo-foreground",
])

function anchor(primary: Oklch, mode: Mode): Oklch {
  if (mode === "light") return primary
  // Dark keeps Evergreen's dark lightness and scales its chroma the way the
  // light primary's chroma moved (verified for every preset, R3).
  const ratio = LIGHT.primary.c > 0 ? primary.c / LIGHT.primary.c : 1
  return {
    l: DARK.primary.l,
    c: Math.min(0.37, DARK.primary.c * ratio),
    h: primary.h,
  }
}

export function buildAdminTokens(
  admin: AdminThemeConfig,
  mode: Mode
): AdminTokens {
  const base = BASE[mode]
  const presetPrimary = parseColor(
    (PRESETS[admin.preset] ?? PRESETS.evergreen).admin.primary
  )!
  const primary = (admin.primary && parseColor(admin.primary)) || presetPrimary
  const custom = !sameColor(primary, LIGHT.primary)
  const from = base.primary
  const to = custom ? anchor(primary, mode) : from
  const out = {} as AdminTokens
  for (const t of ADMIN_TOKENS) {
    const value = base[t]
    if (FIXED.has(t)) out[t] = value
    else if (value.c < NEUTRAL_CHROMA) {
      out[t] =
        admin.tint === "none"
          ? { ...value, c: 0, h: 0 }
          : admin.tint === "primary"
            ? { ...value, h: to.h }
            : value
    } else out[t] = shift(value, from, to, mode === "light")
  }
  if (custom) {
    out["primary-foreground"] = onColor(out.primary)
    out["sidebar-primary-foreground"] = onColor(out["sidebar-primary"])
  }
  const accent = admin.accent && parseColor(admin.accent)
  if (accent) {
    const ramp = scale(accent)
    const surface = mode === "light" ? accent : ramp[9]!
    const preferred = mode === "light" ? ramp[9]! : ramp[1]!
    const text =
      contrast(preferred, surface) >= 4.5 ? preferred : onColor(surface)
    out.accent = out["sidebar-accent"] = surface
    out["accent-foreground"] = out["sidebar-accent-foreground"] = text
  }
  return out
}

export const ADMIN_DEFAULT: Record<Mode, AdminTokens> = BASE

export const presetAdminColours = (preset: PresetId) => ({
  preset,
  primary: null,
  accent: null,
  tint: "preset" as const,
})
```

- [ ] **Step 7: Write the contrast checks and fixes**

```ts
// lib/theme/checks.ts
import { buildAdminTokens } from "./admin"
import { contrast, formatOklch, nudge, parseColor, type Oklch } from "./color"
import type { ThemeConfigValue } from "./schema"
import { resolveSiteTokens } from "./site"
import { SITE_SURFACES, type AdminToken, type SiteToken } from "./tokens"

type Min = 3 | 4.5
type Scope = "site" | "admin-light" | "admin-dark"
export type ContrastIssue = {
  scope: Scope
  text: string
  surface: string
  ratio: number
  min: Min
}
export type PairRating = ContrastIssue & { rating: "AAA" | "AA" | "fail" }

// Ruling R5: the pairs today's site components draw.
export const SITE_PAIRS: [SiteToken, SiteToken, Min][] = [
  ["text-strong", "cream", 4.5],
  ["text-strong", "stone", 4.5],
  ["text-strong", "surface-soft", 4.5],
  ["text-strong", "surface-warm", 4.5],
  ["text-muted", "cream", 4.5],
  ["text-muted", "stone", 4.5],
  ["text-muted", "surface-soft", 4.5],
  ["text-muted", "surface-warm", 4.5],
  ["ink", "cream", 4.5],
  ["ink-muted", "cream", 4.5],
  ["ink-muted", "stone", 4.5],
  ["cream", "brand", 4.5],
  ["cream", "brand-deep", 4.5],
  ["cream", "pine", 4.5],
  ["cream", "forest", 4.5],
  ["cream", "moss", 4.5],
  ["cream", "hero-base", 4.5],
  ["cream", "spruce", 4.5],
  ["brand", "stone", 4.5],
  ["pine", "brand-mint", 4.5],
  ["pine", "mist", 4.5],
  ["brand", "brand-mint", 4.5],
  ["clay", "cream", 4.5],
  ["text-subtle", "cream", 3],
]

// The pairs tests/css/admin-tokens.test.ts already enforces.
export const ADMIN_PAIRS: [AdminToken, AdminToken, Min][] = [
  ["foreground", "background", 4.5],
  ["foreground", "card", 4.5],
  ["foreground", "sidebar", 4.5],
  ["muted-foreground", "card", 4.5],
  ["muted-foreground", "sidebar", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["primary", "card", 4.5],
  ["primary", "sidebar", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["success", "success-soft", 4.5],
  ["warning", "warning-soft", 4.5],
  ["danger", "danger-soft", 4.5],
  ["hero-foreground", "hero-to", 4.5],
  ["promo-foreground", "promo-to", 4.5],
  ["input", "sidebar", 3],
  ["input", "card", 3],
  ["input", "background", 3],
]

const SITE_LABELS: Record<SiteToken, string> = {
  brand: "Brand",
  "brand-mint": "Brand mint",
  cream: "Cream",
  "brand-deep": "Brand deep",
  clay: "Clay (accent)",
  stone: "Stone",
  mist: "Mist",
  forest: "Forest",
  pine: "Pine",
  ink: "Ink",
  "ink-muted": "Ink muted",
  "text-strong": "Strong text",
  "text-muted": "Muted text",
  "text-subtle": "Subtle text",
  line: "Lines",
  "line-soft": "Soft lines",
  "line-neutral": "Neutral lines",
  "line-faint": "Faint lines",
  "line-rule": "Rules",
  "surface-soft": "Soft surface",
  "surface-warm": "Warm surface",
  "hero-base": "Hero base",
  moss: "Moss",
  spruce: "Spruce",
}
const ADMIN_LABELS: Partial<Record<AdminToken, string>> = {
  foreground: "Text",
  background: "Canvas",
  card: "Cards",
  sidebar: "Panels",
  "muted-foreground": "Muted text",
  primary: "Primary",
  "primary-foreground": "Text on primary",
  accent: "Accent",
  "accent-foreground": "Text on accent",
  success: "Success text",
  "success-soft": "Success fill",
  warning: "Warning text",
  "warning-soft": "Warning fill",
  danger: "Danger text",
  "danger-soft": "Danger fill",
  "hero-foreground": "Hero text",
  "hero-to": "Hero card",
  "promo-foreground": "Promo text",
  "promo-to": "Promo card",
  input: "Control edges",
}

export function tokenLabel(scope: Scope, token: string): string {
  return scope === "site"
    ? (SITE_LABELS[token as SiteToken] ?? token)
    : (ADMIN_LABELS[token as AdminToken] ?? token)
}

export function rating(ratio: number, min: Min): "AAA" | "AA" | "fail" {
  if (ratio < min) return "fail"
  return ratio >= (min === 3 ? 4.5 : 7) ? "AAA" : "AA"
}

export function pairRatings(config: ThemeConfigValue): PairRating[] {
  const rows: PairRating[] = []
  const add = (scope: Scope, t: Record<string, Oklch>, pairs: [string, string, Min][]) => {
    for (const [text, surface, min] of pairs) {
      const ratio = contrast(t[text]!, t[surface]!)
      rows.push({ scope, text, surface, ratio, min, rating: rating(ratio, min) })
    }
  }
  add("site", resolveSiteTokens(config.site), SITE_PAIRS)
  add("admin-light", buildAdminTokens(config.admin, "light"), ADMIN_PAIRS)
  add("admin-dark", buildAdminTokens(config.admin, "dark"), ADMIN_PAIRS)
  return rows
}

export function checkTheme(config: ThemeConfigValue): ContrastIssue[] {
  return pairRatings(config)
    .filter((r) => r.rating === "fail")
    .map(({ rating: _, ...issue }) => issue)
}

const SCOPE_PREFIX: Record<Scope, string> = {
  site: "",
  "admin-light": "Admin (light): ",
  "admin-dark": "Admin (dark): ",
}

// Floors to 2 places, so a failing 4.499 never prints as "4.50".
export function describeIssue(issue: ContrastIssue): string {
  const ratio = (Math.floor(issue.ratio * 100) / 100).toFixed(2)
  const use = issue.min === 3 ? "large text and controls" : "body text"
  return `${SCOPE_PREFIX[issue.scope]}${tokenLabel(issue.scope, issue.text)} on ${tokenLabel(issue.scope, issue.surface)} is ${ratio}:1; it needs ${issue.min}:1 (${use}).`
}

const stillFails = (config: ThemeConfigValue, issue: ContrastIssue) =>
  checkTheme(config).some(
    (i) =>
      i.scope === issue.scope &&
      i.text === issue.text &&
      i.surface === issue.surface
  )

// Ruling R6.
export function fixIssue(
  config: ThemeConfigValue,
  issue: ContrastIssue
): ThemeConfigValue | null {
  if (issue.scope === "site") {
    const tokens = resolveSiteTokens(config.site)
    const textIsSurface = SITE_SURFACES.includes(issue.text as SiteToken)
    const moving = (textIsSurface ? issue.surface : issue.text) as SiteToken
    const fixedToken = (textIsSurface ? issue.text : issue.surface) as SiteToken
    const next = nudge(tokens[moving], tokens[fixedToken], issue.min)
    if (!next) return null
    const value = formatOklch(next)
    const site =
      moving === "brand"
        ? { ...config.site, brand: value }
        : { ...config.site, tokens: { ...config.site.tokens, [moving]: value } }
    return { ...config, site }
  }
  const touches = (names: string[]) =>
    names.includes(issue.text) || names.includes(issue.surface)
  const field = touches(["primary", "sidebar-primary", "primary-foreground", "ring"])
    ? "primary"
    : touches(["accent", "accent-foreground"])
      ? "accent"
      : null
  if (!field) return null
  const mode = issue.scope === "admin-light" ? "light" : "dark"
  const start =
    (config.admin[field] && parseColor(config.admin[field]!)) ||
    buildAdminTokens(config.admin, "light")[field]
  // Darken for a light-mode failure, lighten for a dark one.
  const step = mode === "light" ? -0.01 : 0.01
  for (let i = 1; i <= 60; i++) {
    const l = start.l + step * i
    if (l < 0 || l > 1) break
    const candidate = { ...config, admin: { ...config.admin, [field]: formatOklch({ ...start, l }) } }
    if (!stillFails(candidate, issue)) return candidate
  }
  return null
}

export function fixAll(config: ThemeConfigValue) {
  let current = config
  for (let round = 0; round < 10; round++) {
    const issues = checkTheme(current)
    const fixable = issues.map((i) => fixIssue(current, i)).find(Boolean)
    if (!fixable) return { config: current, remaining: issues }
    current = fixable
  }
  return { config: current, remaining: checkTheme(current) }
}
```

- [ ] **Step 8: Write the CSS serialiser**

```ts
// lib/theme/css.ts
import { ADMIN_DEFAULT, buildAdminTokens } from "./admin"
import { formatOklch, type Oklch } from "./color"
import type { AdminThemeConfig, SiteThemeConfig } from "./schema"
import { resolveSiteTokens, SITE_DEFAULT } from "./site"
import { EVERGREEN_ADMIN } from "./presets"

// brief §10.2: :root for the site; the admin's own scopes.
export const SCOPES = {
  site: ":root",
  admin: ':root[data-theme="admin"]',
  adminDark: ':root[data-theme="admin"].dark',
} as const
type Selector = (typeof SCOPES)[keyof typeof SCOPES]

const NAME = /^[a-z][a-z0-9-]*$/
const finite = (c: Oklch) => [c.l, c.c, c.h].every(Number.isFinite)

// Every declaration is rebuilt from numbers: no stored string reaches the
// <style> tag (§10.1 "re-serialised from validated values").
export function toCss(
  selector: Selector,
  tokens: Record<string, Oklch>,
  extra: string[] = []
): string {
  const decls = Object.entries(tokens)
    .filter(([name, color]) => NAME.test(name) && finite(color))
    .map(([name, color]) => `--${name}:${formatOklch(color)}`)
  const all = [...decls, ...extra]
  return all.length ? `${selector}{${all.join(";")}}` : ""
}

function changed<K extends string>(
  tokens: Record<K, Oklch>,
  base: Record<K, Oklch>,
  prefix = ""
): Record<string, Oklch> {
  return Object.fromEntries(
    (Object.keys(tokens) as K[])
      .filter((k) => formatOklch(tokens[k]) !== formatOklch(base[k]))
      .map((k) => [`${prefix}${k}`, tokens[k]])
  )
}

// Ruling R4: only what differs from site.css, so the default emits "".
export function siteThemeCss(site: SiteThemeConfig): string {
  return toCss(
    SCOPES.site,
    changed(resolveSiteTokens(site), SITE_DEFAULT, "color-")
  )
}

const radiusDecl = (radius: number) =>
  Number.isFinite(radius) && radius >= 0 && radius <= 1.5
    ? `--radius:${radius}rem`
    : null

export function adminThemeCss(admin: AdminThemeConfig): string {
  const radius =
    admin.radius !== EVERGREEN_ADMIN.radius ? radiusDecl(admin.radius) : null
  return (
    toCss(
      SCOPES.admin,
      changed(buildAdminTokens(admin, "light"), ADMIN_DEFAULT.light),
      radius ? [radius] : []
    ) +
    toCss(
      SCOPES.adminDark,
      changed(buildAdminTokens(admin, "dark"), ADMIN_DEFAULT.dark)
    )
  )
}

// The Appearance page's live preview: every token, set inline on <html>.
export function liveDeclarations(
  admin: AdminThemeConfig,
  mode: "light" | "dark"
): [string, string][] {
  const tokens = buildAdminTokens(admin, mode)
  const radius = radiusDecl(admin.radius)
  return [
    ...Object.entries(tokens).map(
      ([name, color]) => [`--${name}`, formatOklch(color)] as [string, string]
    ),
    ...(radius ? [["--radius", `${admin.radius}rem`] as [string, string]] : []),
  ]
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `pnpm vitest run --project unit lib/theme tests/css/theme-presets.test.ts`
Expected: PASS; `lib/theme/__snapshots__/presets.test.ts.snap` is written. Open the snapshot and confirm the `teal-sage` site table equals `TEAL_SAGE_SITE` and the `evergreen` light/dark tables equal `EVERGREEN_ADMIN` (identity, R2). If a preset fails "passes every contrast pair", darken that preset's brand/primary hex in `PRESETS` by small steps until it passes, update R3 in this plan's hand-off, and re-run; never loosen a pair.

- [ ] **Step 10: Typecheck and commit**

```bash
pnpm typecheck
git add lib/theme tests/css/theme-presets.test.ts
git commit -m "feat(theme): presets, derivation, contrast checks and css serialiser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Storage and API — `ThemeConfig` in the globals registry, seed, draft/publish/reset/discard/revisions, contrast gate

**Model:** opus

**Files:**
- Modify: `lib/content/globals.ts`, `lib/content/globals.test.ts`, `server/db/seed/globals.ts`, `server/api/routes/admin.ts`, `lib/seo/og-theme.ts`, `lib/seo/og-theme.test.ts`
- Create: `server/modules/theme/service.ts`, `server/modules/theme/routes.ts`
- Test: `tests/integration/api/theme.test.ts`

**Interfaces:**
- Consumes: Task 2 `ThemeConfig`, `DEFAULT_THEME`, `checkTheme`, `describeIssue`, `presetSiteTheme`, `presetAdminColours`, `resolveSiteTokens`, `toHex`, `SITE_TOKENS`.
- Produces:
  - `lib/content/globals.ts`: `ThemeGlobal = ThemeConfig`; `SITE_TOKENS` re-exported from `@/lib/theme/tokens`.
  - `lib/seo/og-theme.ts`: `ogColors(site: SiteThemeConfig): OgColors` (resolves tokens; same three keys as today).
  - `server/modules/theme/service.ts`: `type ThemeDoc = { value: ThemeConfigValue; draft: ThemeConfigValue; hasDraft: boolean; version: number; updatedAt: Date | null; issues: ContrastIssue[] }`; `getThemeAdmin(): Promise<ThemeDoc>`, `saveThemeDraft(actor, { version, draft }): Promise<ThemeDoc>`, `publishTheme(actor, { version })`, `resetThemeDraft(actor, { version, preset, scope })`, `discardThemeDraft(actor, { version })`, `themeRevisions()`, `restoreThemeRevision(actor, revisionId, version)`, `publishedColors(): Promise<OgColors>`.
  - `server/modules/theme/routes.ts`: `themeRoutes`, `type ThemeRoutes`, mounted at `/api/v1/admin/theme`.

- [ ] **Step 1: Write the failing integration test**

```ts
// tests/integration/api/theme.test.ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, settings } from "@/server/db/schema"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  // The seed may or may not have run; every test starts from a default row.
  await getDb()
    .insert(settings)
    .values({ key: "theme", value: {} })
    .onConflictDoNothing()
  next.revalidateTag.mockReset()
})
afterAll(closeDb)

const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const row = async () =>
  (
    await getDb().select().from(settings).where(eq(settings.key, "theme"))
  )[0] ?? null
const doc = async (cookie: string) =>
  (await (await adminRequest("/theme", cookie)).json()) as {
    version: number
    hasDraft: boolean
    value: { site: { brand: string | null } }
    draft: { site: { brand: string | null; tokens: Record<string, string> } }
    issues: unknown[]
  }
const saveDraft = (cookie: string, version: number, draft: unknown) =>
  adminRequest("/theme/draft", cookie, {
    method: "PUT",
    body: { version, draft },
  })
const publish = (cookie: string, version: number) =>
  adminRequest("/theme/publish", cookie, { method: "POST", body: { version } })

// brief §7.2: appearance.* is owner and admin only.
const ALLOWED: RoleName[] = ["owner", "admin"]

describe.each(ROLE_NAMES)("theme RBAC for %s", (role) => {
  it("GET, PUT draft and POST publish", async () => {
    const cookie = await cookieFor(role)
    const allowed = ALLOWED.includes(role)
    const want = allowed ? 200 : 403
    expect((await adminRequest("/theme", cookie)).status).toBe(want)
    // can() runs before the version check, so 0 is fine for the 403s.
    const version = allowed ? (await doc(cookie)).version : 0
    expect((await saveDraft(cookie, version, {})).status).toBe(want)
    expect((await publish(cookie, allowed ? version + 1 : 0)).status).toBe(
      want
    )
  })
})

describe("theme API", () => {
  it("saves a draft without touching the published theme or the cache", async () => {
    const cookie = await cookieFor("admin")
    const { version } = await doc(cookie)
    const res = await saveDraft(cookie, version, {
      site: { brand: "#2f5f8a" },
    })
    expect(res.status).toBe(200)
    const saved = await res.json()
    expect(saved.hasDraft).toBe(true)
    expect(saved.draft.site.brand).toMatch(/^oklch\(/)
    expect(saved.value.site.brand).toBeNull()
    expect(expired()).toEqual([])
    expect((await row())!.draft).not.toBeNull()
  })

  it("publishes: copies the draft, clears it, writes a revision, audits, expires the tag", async () => {
    const cookie = await cookieFor("owner")
    const draft = await (
      await saveDraft(cookie, (await doc(cookie)).version, {
        site: { brand: "#2f5f8a" },
      })
    ).json()
    const res = await publish(cookie, draft.version)
    expect(res.status).toBe(200)
    const published = await res.json()
    expect(published.value.site.brand).toBe(draft.draft.site.brand)
    expect(published.hasDraft).toBe(false)
    expect((await row())!.draft).toBeNull()
    expect(expired()).toEqual(["settings:theme"])
    const revisions = await (
      await adminRequest("/theme/revisions", cookie)
    ).json()
    expect(revisions).toHaveLength(1)
    const actions = (await getDb().select().from(auditLogs)).map(
      (a) => a.action
    )
    expect(actions).toContain("appearance.publish")
  })

  it("blocks a failing draft and keeps the published theme", async () => {
    const cookie = await cookieFor("owner")
    const before = await row()
    const saved = await (
      await saveDraft(cookie, (await doc(cookie)).version, {
        site: { tokens: { "text-muted": "#dddddd" } },
      })
    ).json()
    expect(saved.issues.length).toBeGreaterThan(0)
    const res = await publish(cookie, saved.version)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_FAILED")
    expect(body.error.message).toMatch(/Muted text on Cream is \d\.\d{2}:1/)
    expect(body.error.details.issues.length).toBeGreaterThan(0)
    expect((await row())!.value).toEqual(before!.value)
    expect(expired()).toEqual([])
    expect(
      await (await adminRequest("/theme/revisions", cookie)).json()
    ).toHaveLength(0)
  })

  it("409s a stale version", async () => {
    const cookie = await cookieFor("owner")
    const { version } = await doc(cookie)
    expect((await saveDraft(cookie, version, {})).status).toBe(200)
    const stale = await saveDraft(cookie, version, {})
    expect(stale.status).toBe(409)
    expect((await publish(cookie, version)).status).toBe(409)
  })

  it("rejects a hostile colour with a field error", async () => {
    const cookie = await cookieFor("owner")
    const res = await saveDraft(cookie, (await doc(cookie)).version, {
      site: { brand: "#000;}</style><script>alert(1)</script>" },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.fieldErrors["site.brand"]).toEqual([
      "Use a #rrggbb or oklch(L C H) colour",
    ])
  })

  it("a hand-edited row falls back to the defaults", async () => {
    const cookie = await cookieFor("owner")
    await getDb()
      .update(settings)
      .set({ value: { site: { brand: "url(javascript:1)" } } })
      .where(eq(settings.key, "theme"))
    const current = await doc(cookie)
    expect(current.value.site.brand).toBeNull()
  })

  it("resets the draft to a preset without publishing, and discards", async () => {
    const cookie = await cookieFor("admin")
    const reset = await adminRequest("/theme/reset", cookie, {
      method: "POST",
      body: { version: (await doc(cookie)).version, preset: "ocean", scope: "both" },
    })
    expect(reset.status).toBe(200)
    const after = await reset.json()
    expect(after.draft.site).toEqual({ preset: "ocean", brand: null, tokens: {} })
    expect(after.value.site.preset).toBe("teal-sage")
    const discarded = await adminRequest("/theme/discard", cookie, {
      method: "POST",
      body: { version: after.version },
    })
    expect((await discarded.json()).hasDraft).toBe(false)
  })

  it("restores a revision into the draft", async () => {
    const cookie = await cookieFor("owner")
    const saved = await (
      await saveDraft(cookie, (await doc(cookie)).version, {
        site: { brand: "#6a3f6b" },
      })
    ).json()
    const published = await (await publish(cookie, saved.version)).json()
    const [revision] = await (
      await adminRequest("/theme/revisions", cookie)
    ).json()
    const discardedVersion = (
      await (
        await saveDraft(cookie, published.version, { site: { brand: "#2f5f8a" } })
      ).json()
    ).version
    const restored = await adminRequest(
      `/theme/revisions/${revision.id}/restore`,
      cookie,
      { method: "POST", body: { version: discardedVersion } }
    )
    expect(restored.status).toBe(200)
    expect((await restored.json()).draft.site.brand).toBe(
      published.value.site.brand
    )
  })

  it("shares the published OG colours with any signed-in user", async () => {
    const res = await adminRequest("/theme/colors", await cookieFor("marketer"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      background: "#030303",
      text: "#faf6f0",
      accent: "#d6e8e4",
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm db:up && pnpm vitest run --project integration tests/integration/api/theme.test.ts`
Expected: FAIL; `/theme` answers 404.

- [ ] **Step 3: Move `SITE_TOKENS` and plug `ThemeConfig` into the registry**

In `lib/content/globals.ts`:
- delete the local `SITE_TOKENS` array and the `Hex` constant (if `Hex` has no other user; `grep -n "Hex" lib/content/globals.ts` first);
- add `export { SITE_TOKENS } from "@/lib/theme/tokens"` and `import { ThemeConfig } from "@/lib/theme/schema"`;
- replace the `ThemeGlobal` block with:

```ts
// docs/brief.md §10: validated, canonical OKLCH (lib/theme/schema.ts).
// SiteFrame and AdminFrame never write these strings into CSS; lib/theme/
// css.ts rebuilds every declaration from numbers.
export const ThemeGlobal = ThemeConfig
```

In `lib/content/globals.test.ts`, replace any assertion on the old hex-record theme with (imports: `resolveSiteTokens`, `SITE_DEFAULT` from `@/lib/theme/site`):

```ts
it("theme parses the Phase 3 hex shape to today's palette (R9)", () => {
  const legacy = { site: { brand: "#336060", cream: "#faf6f0" }, admin: {} }
  const parsed = parseGlobal("theme", legacy)
  // Unknown keys are stripped; brand normalises to the base brand, which
  // the resolver treats as identity.
  expect(parsed.site.tokens).toEqual({})
  expect(resolveSiteTokens(parsed.site)).toEqual(SITE_DEFAULT)
})
```

In `server/db/seed/globals.ts`, delete `SITE_THEME` and the `SITE_TOKENS` import, and seed `theme: {}`.

- [ ] **Step 4: Update `ogColors` to resolve through the engine**

```ts
// lib/seo/og-theme.ts
import { toHex } from "@/lib/theme/color"
import type { SiteThemeConfig } from "@/lib/theme/schema"
import { resolveSiteTokens } from "@/lib/theme/site"

export type OgColors = { background: string; text: string; accent: string }

// Satori takes plain colours, so the card gets hex.
export function ogColors(site: SiteThemeConfig): OgColors {
  const t = resolveSiteTokens(site)
  return {
    background: toHex(t.ink),
    text: toHex(t.cream),
    accent: toHex(t["brand-mint"]),
  }
}
```

If `OgColors` is already exported from `lib/seo/og-card.tsx`, import that type instead of redeclaring it. Replace `lib/seo/og-theme.test.ts` with:

```ts
import { describe, expect, it } from "vitest"

import { DEFAULT_THEME, ThemeConfig } from "@/lib/theme/schema"

import { ogColors } from "./og-theme"

describe("ogColors", () => {
  it("uses today's palette for the default theme", () => {
    expect(ogColors(DEFAULT_THEME.site)).toEqual({
      background: "#030303",
      text: "#faf6f0",
      accent: "#d6e8e4",
    })
  })
  it("follows a locked token", () => {
    const site = ThemeConfig.parse({ site: { tokens: { ink: "#111111" } } })
      .site
    expect(ogColors(site).background).toBe("#111111")
  })
})
```

Update the two callers to the new argument (still `.site`): `app/og/[[...path]]/route.tsx` keeps `ogColors((await getSetting("theme")).site)`; `admin/modules/seo/seo-aside.tsx` temporarily becomes `ogColors(DEFAULT_THEME.site)` (Task 7 swaps it for the API).

- [ ] **Step 5: Write the service**

```ts
// server/modules/theme/service.ts
import "server-only"

import { eq } from "drizzle-orm"

import { parseGlobal } from "@/lib/content/globals"
import { ogColors } from "@/lib/seo/og-theme"
import { checkTheme, describeIssue } from "@/lib/theme/checks"
import { presetAdminColours } from "@/lib/theme/admin"
import type { PresetId } from "@/lib/theme/presets"
import { ThemeConfig, type ThemeConfigValue } from "@/lib/theme/schema"
import { presetSiteTheme } from "@/lib/theme/site"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { conflictError, topLevelDiff } from "@/server/lib/conflict"
import {
  findRevision,
  listRevisions,
  writeRevision,
} from "@/server/lib/revisions"

const KEY = "theme"
type Row = typeof settings.$inferSelect

const stored = (value: unknown) => parseGlobal(KEY, value)

function toDoc(row: Row | null) {
  const value = stored(row?.value)
  const hasDraft = row?.draft != null
  const draft = hasDraft ? stored(row!.draft) : value
  return {
    value,
    draft,
    hasDraft,
    version: row?.version ?? 0,
    updatedAt: row?.updatedAt ?? null,
    issues: checkTheme(draft),
  }
}
export type ThemeDoc = ReturnType<typeof toDoc>

async function findRow(db: DbLike, lock = false) {
  const query = db.select().from(settings).where(eq(settings.key, KEY)).limit(1)
  const [row] = lock ? await query.for("update") : await query
  return row ?? null
}

async function lockAt(db: DbLike, version: number) {
  const row = await findRow(db, true)
  if ((row?.version ?? 0) !== version)
    throw await conflictError(db, {
      version: row?.version ?? 0,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    })
  return row
}

async function write(
  db: DbLike,
  actor: Actor,
  before: Row | null,
  patch: { value?: ThemeConfigValue; draft: ThemeConfigValue | null }
) {
  const now = new Date()
  const [row] = before
    ? await db
        .update(settings)
        .set({
          ...patch,
          version: before.version + 1,
          updatedBy: actor.userId,
          updatedAt: now,
        })
        .where(eq(settings.key, KEY))
        .returning()
    : await db
        .insert(settings)
        .values({
          key: KEY,
          value: patch.value ?? stored({}),
          draft: patch.draft,
          version: 1,
          updatedBy: actor.userId,
        })
        .returning()
  return row!
}

const parseInput = (input: unknown) => {
  const parsed = ThemeConfig.safeParse(input ?? {})
  if (!parsed.success) throw invalid(parsed.error)
  return parsed.data
}

export async function getThemeAdmin() {
  return toDoc(await findRow(getDb()))
}

// R7: draft saves are not audited and expire nothing; draft-mode renders
// bypass the cache.
export async function saveThemeDraft(
  actor: Actor,
  input: { version: number; draft: unknown }
) {
  const draft = parseInput(input.draft)
  const row = await getDb().transaction(async (tx) => {
    const before = await lockAt(tx, input.version)
    return write(tx, actor, before, { draft })
  })
  return toDoc(row)
}

export async function publishTheme(actor: Actor, input: { version: number }) {
  const row = await getDb().transaction(async (tx) => {
    const before = await lockAt(tx, input.version)
    const next = stored(before?.draft ?? before?.value)
    const issues = checkTheme(next)
    if (issues.length)
      throw new ApiError(
        "VALIDATION_FAILED",
        `Some colours are too hard to read. ${issues.map(describeIssue).join(" ")}`,
        undefined,
        { issues }
      )
    const saved = await write(tx, actor, before, { value: next, draft: null })
    await writeRevision(tx, {
      entityType: "setting",
      entityId: KEY,
      version: saved.version,
      snapshot: next,
      createdBy: actor.userId,
      note: "Published theme",
    })
    await audit(
      actor,
      {
        action: "appearance.publish",
        entityType: "setting",
        entityId: KEY,
        summary: "Published the theme",
        diff: topLevelDiff(before?.value ?? null, next),
      },
      tx
    )
    return saved
  })
  invalidate([tags.setting(KEY)])
  return toDoc(row)
}

// R8: colours only; radius and mode stay.
export async function resetThemeDraft(
  actor: Actor,
  input: { version: number; preset: PresetId; scope: "site" | "admin" | "both" }
) {
  const row = await getDb().transaction(async (tx) => {
    const before = await lockAt(tx, input.version)
    const current = stored(before?.draft ?? before?.value)
    const draft: ThemeConfigValue = {
      site:
        input.scope === "admin" ? current.site : presetSiteTheme(input.preset),
      admin:
        input.scope === "site"
          ? current.admin
          : { ...current.admin, ...presetAdminColours(input.preset) },
    }
    const saved = await write(tx, actor, before, { draft })
    await audit(
      actor,
      {
        action: "appearance.reset",
        entityType: "setting",
        entityId: KEY,
        summary: `Reset the ${input.scope === "both" ? "theme" : input.scope + " theme"} draft to ${input.preset}`,
      },
      tx
    )
    return saved
  })
  return toDoc(row)
}

export async function discardThemeDraft(actor: Actor, input: { version: number }) {
  const row = await getDb().transaction(async (tx) => {
    const before = await lockAt(tx, input.version)
    const saved = await write(tx, actor, before, { draft: null })
    await audit(
      actor,
      {
        action: "appearance.discard",
        entityType: "setting",
        entityId: KEY,
        summary: "Discarded the theme draft",
      },
      tx
    )
    return saved
  })
  return toDoc(row)
}

export const themeRevisions = () => listRevisions(getDb(), "setting", KEY)

export async function restoreThemeRevision(
  actor: Actor,
  revisionId: string,
  version: number
) {
  const revision = await findRevision(getDb(), "setting", KEY, revisionId)
  if (!revision) throw new ApiError("NOT_FOUND", "That version doesn't exist")
  // Re-validated: an old snapshot may predate a schema change.
  const draft = parseInput(revision.snapshot)
  const row = await getDb().transaction(async (tx) => {
    const before = await lockAt(tx, version)
    const saved = await write(tx, actor, before, { draft })
    await audit(
      actor,
      {
        action: "appearance.restore",
        entityType: "setting",
        entityId: KEY,
        summary: `Loaded theme version ${revision.version} into the draft`,
      },
      tx
    )
    return saved
  })
  return toDoc(row)
}

// R14: public colours for the admin's share-card preview.
export async function publishedColors() {
  return ogColors(stored((await findRow(getDb()))?.value).site)
}
```

If `typeof settings.$inferSelect` does not compile under Drizzle 0.45, use `Awaited<ReturnType<typeof findRow>>` with a non-null assertion at the call sites.

- [ ] **Step 6: Write the routes and mount them**

```ts
// server/modules/theme/routes.ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { PRESET_IDS } from "@/lib/theme/presets"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import {
  discardThemeDraft,
  getThemeAdmin,
  publishedColors,
  publishTheme,
  resetThemeDraft,
  restoreThemeRevision,
  saveThemeDraft,
  themeRevisions,
} from "./service"

const Version = z.object({ version: z.number().int().min(0) })
const DraftInput = Version.extend({ draft: z.unknown() })
const ResetInput = Version.extend({
  preset: z.enum(PRESET_IDS),
  scope: z.enum(["site", "admin", "both"]).default("both"),
})
const RevisionParam = z.object({ rev: z.uuid() })

// brief §8.3 Appearance row, plus discard, revisions and colours (R8, R14).
// admin.ts already requires a signed-in, 2FA-complete session.
export const themeRoutes = new Hono<AppEnv>()
  .get("/", can({ appearance: ["read"] }), async (c) =>
    c.json(await getThemeAdmin())
  )
  .get("/colors", async (c) => c.json(await publishedColors()))
  .put(
    "/draft",
    can({ appearance: ["update"] }),
    zValidator("json", DraftInput, validationHook),
    async (c) =>
      c.json(await saveThemeDraft(c.get("actor")!, c.req.valid("json")))
  )
  .post(
    "/publish",
    can({ appearance: ["publish"] }),
    zValidator("json", Version, validationHook),
    async (c) => c.json(await publishTheme(c.get("actor")!, c.req.valid("json")))
  )
  .post(
    "/reset",
    can({ appearance: ["update"] }),
    zValidator("json", ResetInput, validationHook),
    async (c) =>
      c.json(await resetThemeDraft(c.get("actor")!, c.req.valid("json")))
  )
  .post(
    "/discard",
    can({ appearance: ["update"] }),
    zValidator("json", Version, validationHook),
    async (c) =>
      c.json(await discardThemeDraft(c.get("actor")!, c.req.valid("json")))
  )
  .get("/revisions", can({ appearance: ["read"] }), async (c) =>
    c.json(await themeRevisions())
  )
  .post(
    "/revisions/:rev/restore",
    can({ appearance: ["update"] }),
    zValidator("param", RevisionParam, validationHook),
    zValidator("json", Version, validationHook),
    async (c) =>
      c.json(
        await restoreThemeRevision(
          c.get("actor")!,
          c.req.valid("param").rev,
          c.req.valid("json").version
        )
      )
  )

export type ThemeRoutes = typeof themeRoutes
```

In `server/api/routes/admin.ts`, add `import { themeRoutes } from "@/server/modules/theme/routes"` and `.route("/theme", themeRoutes)` after `.route("/tracking", trackingRoutes)`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm vitest run --project integration tests/integration/api/theme.test.ts tests/integration/api/globals.test.ts && pnpm vitest run --project unit lib/content lib/seo`
Expected: PASS. If `tests/integration/api/permission-matrix.test.ts` enumerates admin endpoints, add the eight theme endpoints there with owner/admin allowed and run it too.

- [ ] **Step 8: Typecheck and commit**

```bash
pnpm typecheck
git add lib/content/globals.ts lib/content/globals.test.ts server/db/seed/globals.ts \
  lib/seo/og-theme.ts lib/seo/og-theme.test.ts admin/modules/seo/seo-aside.tsx \
  server/modules/theme server/api/routes/admin.ts tests/integration/api/theme.test.ts
git commit -m "feat(theme): theme draft, publish gate, reset, discard and revisions api

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Site delivery — cached theme read, `<style id="theme-tokens">`, draft preview, logo in the chrome, OG and manifest colours

**Model:** sonnet

**Files:**
- Modify: `server/modules/content/queries.ts`, `app/(site)/_cms/site-frame.tsx`, `components/brand.tsx`, `features/navbar/components/site-header.tsx`, `features/footer/components/site-footer.tsx`, `app/og/[[...path]]/route.tsx`, `app/manifest.ts`
- Delete: `lib/content/theme.ts`, `lib/content/theme.test.ts`
- Test: `tests/integration/content/queries-theme.test.ts`, `components/brand.test.tsx`

**Interfaces:**
- Consumes: Task 2 `siteThemeCss`, `resolveSiteTokens`, `toHex`; Task 3 stored shape.
- Produces: `getThemeConfig(draft?: boolean): Promise<ThemeConfigValue>` in `server/modules/content/queries.ts`; `Brand({ name, logo }: { name: string; logo?: MediaAsset | null })`; `SiteHeader`/`SiteFooter` accept `logo?: MediaAsset | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/integration/content/queries-theme.test.ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { getThemeConfig } from "@/server/modules/content/queries"
import { closeDb, getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  await getDb()
    .insert(settings)
    .values({ key: "theme", value: {} })
    .onConflictDoNothing()
})
afterAll(closeDb)

describe("getThemeConfig", () => {
  it("draft only when asked", async () => {
    await getDb()
      .update(settings)
      .set({ draft: { site: { brand: "#2f5f8a" } } })
      .where(eq(settings.key, "theme"))
    expect((await getThemeConfig()).site.brand).toBeNull()
    expect((await getThemeConfig(false)).site.brand).toBeNull()
    expect((await getThemeConfig(true)).site.brand).toMatch(/^oklch\(/)
  })

  it("falls back to the published theme when there is no draft", async () => {
    expect((await getThemeConfig(true)).site.preset).toBe("teal-sage")
  })
})
```

```tsx
// components/brand.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { Brand } from "./brand"

afterEach(cleanup)

const asset = (src: string) => ({
  id: "m1",
  src,
  width: 200,
  height: 200,
  blurDataURL: null,
  alt: "",
  focal: null,
})

it("keeps today's mark when no logo is set (parity)", () => {
  const { container } = render(<Brand name="Magda Kennedy" />)
  expect(container.querySelector("img")?.getAttribute("src")).toContain(
    "logo-mark.svg"
  )
  expect(screen.getByText("Magda Kennedy")).toBeTruthy()
})

it("draws the library logo when one is set", () => {
  const { container } = render(
    <Brand name="Magda Kennedy" logo={asset("/uploads/logo.png")} />
  )
  expect(container.querySelector("img")?.getAttribute("src")).toContain(
    "logo.png"
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --project integration tests/integration/content/queries-theme.test.ts; pnpm vitest run --project unit components/brand.test.tsx`
Expected: FAIL with "getThemeConfig is not a function" / the second Brand test fails (src is still `logo-mark.svg`).

- [ ] **Step 3: Add the cached theme read**

In `server/modules/content/queries.ts`, change the comment above `getSetting` to `// Globals go live on save; the theme's draft is read by getThemeConfig.` and add:

```ts
// Ruling R10: `draft` comes from isPreviewing() only. In draft mode Next
// re-runs this scope per request and stores nothing (use-cache.md).
export async function getThemeConfig(draft = false) {
  "use cache"
  cacheTag(tags.setting("theme"))
  const row = await repo.findSetting("theme")
  lifetime(row !== null)
  return parseGlobal(
    "theme",
    draft && row?.draft != null ? row.draft : row?.value
  )
}
```

- [ ] **Step 4: Render the theme in `SiteFrame`**

In `app/(site)/_cms/site-frame.tsx`:
- replace `import { themeCss } from "@/lib/content/theme"` with `import { siteThemeCss } from "@/lib/theme/css"`, and import `getMedia, getSetting, getThemeConfig` from queries;
- read `preview` first, then the rest:

```tsx
  await io()
  const preview = await isPreviewing()
  const [site, navigation, footer, theme, consent, scripts, tracking] =
    await Promise.all([
      getSetting("site"),
      getSetting("navigation"),
      getSetting("footer"),
      getThemeConfig(preview),
      getSetting("consent"),
      getSetting("scripts"),
      getPublicTracking(),
    ])
  const logo = site.logo
    ? ((await getMedia([site.logo.mediaId])).get(site.logo.mediaId) ?? null)
    : null
  // R4: "" for the default theme, so the page is byte-identical to today.
  const css = siteThemeCss(theme.site)
```

- replace `{css && <style>{css}</style>}` with `{css ? <style id="theme-tokens">{css}</style> : null}`;
- pass `logo={logo}` to `<SiteHeader …>` and `<SiteFooter …>`.

- [ ] **Step 5: Thread the logo through the chrome**

```tsx
// components/brand.tsx
import Image from "next/image"
import Link from "next/link"

import type { MediaAsset } from "@/lib/media"

// The library logo (Appearance, Ruling R13) or today's mark. The seeded logo
// is the same file, so the default draws exactly what it drew before.
export function Brand({
  name,
  logo,
}: {
  name: string
  logo?: MediaAsset | null
}) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="relative flex size-12 shrink-0 items-center justify-center overflow-clip rounded-full bg-brand-mint">
        <Image
          src={logo?.src ?? "/images/hero/logo-mark.svg"}
          alt=""
          width={28}
          height={28}
          className={logo ? "size-7 object-contain" : undefined}
        />
      </span>
      <span className="font-geist text-xl leading-[normal] font-semibold whitespace-nowrap text-white">
        {name}
      </span>
    </Link>
  )
}
```

In `features/navbar/components/site-header.tsx` and `features/footer/components/site-footer.tsx`, add `logo?: MediaAsset | null` to the props type (`import type { MediaAsset } from "@/lib/media"`), destructure it, and render `<Brand name={site.name} logo={logo} />`. If `SiteHeader` is a client component, `MediaAsset` is plain data and crosses the boundary as is.

- [ ] **Step 6: Manifest and OG colours**

In `app/manifest.ts`, add `import { toHex } from "@/lib/theme/color"` and `import { resolveSiteTokens } from "@/lib/theme/site"`, then:

```ts
  const tokens = resolveSiteTokens(theme.site)
  …
    background_color: toHex(tokens.cream),
    theme_color: toHex(tokens.brand),
```

`app/og/[[...path]]/route.tsx` already passes `.site` to the new `ogColors` (Task 3); leave it.

- [ ] **Step 7: Delete the Phase 3 serializer**

```bash
git rm lib/content/theme.ts lib/content/theme.test.ts
grep -rn "lib/content/theme\"" app components features lib server admin
```

Expected: no matches.

- [ ] **Step 8: Run tests, build and parity**

Run:
```bash
pnpm vitest run --project integration tests/integration/content/queries-theme.test.ts
pnpm vitest run --project unit components lib/theme lib/seo
pnpm typecheck
DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build
pnpm test:parity
```
Expected: all PASS; parity at ≤ 0.1% on every page (the default theme emits no `<style id="theme-tokens">`, and the seeded logo is the same SVG).

- [ ] **Step 9: Commit**

```bash
git add server/modules/content/queries.ts "app/(site)/_cms/site-frame.tsx" components/brand.tsx \
  components/brand.test.tsx features/navbar/components/site-header.tsx \
  features/footer/components/site-footer.tsx app/manifest.ts \
  tests/integration/content/queries-theme.test.ts
git commit -m "feat(theme): site frame renders the published or draft theme and library logo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Admin delivery — `AdminFrame`, default mode, auth panel tokens

**Model:** sonnet

**Files:**
- Create: `app/(admin)/_frame/admin-frame.tsx`
- Modify: `app/(admin)/layout.tsx`, `app/(admin)/admin/(auth)/layout.tsx`
- Test: `app/(admin)/_frame/admin-frame.test.tsx`

**Interfaces:**
- Consumes: Task 2 `adminThemeCss`; Task 4 `getThemeConfig`.
- Produces: `AdminFrame({ children }: { children: React.ReactNode }): Promise<JSX.Element>`.

- [ ] **Step 1: Write the failing test**

```tsx
// app/(admin)/_frame/admin-frame.test.tsx
// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

const theme = vi.hoisted(() => ({ value: {} as unknown }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  io: async () => {},
}))
vi.mock("@/server/modules/content/queries", async () => {
  const { ThemeConfig } = await import("@/lib/theme/schema")
  return { getThemeConfig: async () => ThemeConfig.parse(theme.value) }
})
const provider = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }))
vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: (props: { children: React.ReactNode }) => {
    provider.props = props
    return <>{props.children}</>
  },
}))
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }))

import { AdminFrame } from "./admin-frame"

afterEach(cleanup)

it("emits no style for the Evergreen default", async () => {
  theme.value = {}
  const { container } = render(await AdminFrame({ children: <p>x</p> }))
  expect(container.querySelector("style#theme-tokens")).toBeNull()
  expect(provider.props?.defaultTheme).toBe("system")
})

it("emits the admin scopes and passes the default mode", async () => {
  theme.value = { admin: { primary: "#2f5f8a", mode: "dark" } }
  const { container } = render(await AdminFrame({ children: <p>x</p> }))
  const css = container.querySelector("style#theme-tokens")?.textContent
  expect(css).toMatch(/^:root\[data-theme="admin"\]\{/)
  expect(css).toContain(':root[data-theme="admin"].dark{')
  expect(provider.props?.defaultTheme).toBe("dark")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit "app/(admin)/_frame/admin-frame.test.tsx"`
Expected: FAIL with "Failed to resolve import "./admin-frame"".

- [ ] **Step 3: Write `AdminFrame` and wire it into the root layout**

```tsx
// app/(admin)/_frame/admin-frame.tsx
import { io } from "next/cache"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { adminThemeCss } from "@/lib/theme/css"
import { getThemeConfig } from "@/server/modules/content/queries"

// docs/brief.md §10.2 (Ruling R11): the published admin theme, server-side,
// so there is no flash. io() suspends at prerender, so the build never
// reaches the database. The Appearance page previews drafts client-side.
export async function AdminFrame({ children }: { children: React.ReactNode }) {
  await io()
  const { admin } = await getThemeConfig()
  const css = adminThemeCss(admin)
  return (
    <ThemeProvider defaultTheme={admin.mode}>
      {css ? <style id="theme-tokens">{css}</style> : null}
      {children}
      <Toaster position="top-center" />
    </ThemeProvider>
  )
}
```

In `app/(admin)/layout.tsx`: remove the `ThemeProvider` and `Toaster` imports and elements, import `Suspense` from `react` and `AdminFrame` from `./_frame/admin-frame`, and render:

```tsx
      <body>
        <Suspense fallback={<div className="min-h-svh bg-background" />}>
          <AdminFrame>{children}</AdminFrame>
        </Suspense>
      </body>
```

Update the layout comment: next-themes' inline script now streams with the frame and still runs before the boundary is revealed.

- [ ] **Step 4: Tokenise the sign-in panel (R16)**

In `app/(admin)/admin/(auth)/layout.tsx`:
- line 16: replace `bg-[linear-gradient(150deg,#0b2f17_0%,#12612b_48%,#16823a_78%,#3f9d5e_100%)]` with `bg-hero` and drop `text-white` (the `bg-hero` utility sets `color: var(--hero-foreground)`);
- line 23: replace `bg-[#3f9d5e]/30` with `bg-primary/30`.

- [ ] **Step 5: Run tests and the existing admin theme E2E**

Run:
```bash
pnpm vitest run --project unit "app/(admin)" tests/css/admin-tokens.test.ts
pnpm typecheck
DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build
pnpm exec playwright test tests/e2e/admin/theme.spec.ts
```
Expected: PASS. `theme.spec.ts` ("a dark system preference paints dark before hydration", "a saved light choice wins…") must stay green; if the DOMContentLoaded probe sees no `dark` class, move `<ThemeProvider>` back to the root layout outside Suspense and pass the mode through a `data-default-mode` attribute instead — do not weaken the spec.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/_frame" "app/(admin)/layout.tsx" "app/(admin)/admin/(auth)/layout.tsx"
git commit -m "feat(theme): admin frame renders the published admin theme and default mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Favicon and app icons — sharp rasteriser route, metadata `icons`, manifest

**Model:** sonnet

**Files:**
- Create: `lib/seo/icons.ts`, `server/lib/media/read.ts`, `server/modules/theme/icons.ts`, `app/site-icon/[size]/route.ts`
- Modify: `server/modules/content/repo.ts`, `lib/seo/metadata.ts`, `lib/seo/metadata.test.ts`, `app/(site)/layout.tsx`, `app/manifest.ts`, `proxy.ts`, `proxy.test.ts`, `lib/content/page-path.ts`
- Test: `lib/seo/icons.test.ts`, `server/lib/media/read.test.ts`, `tests/integration/content/brand-icon.test.ts`

**Interfaces:**
- Consumes: Task 4 `getThemeConfig` (not used here), existing `getSetting("site")`, `localFile`, sharp.
- Produces:
  - `lib/seo/icons.ts`: `ICON_SIZES = [32, 180, 192, 512] as const`, `iconVersion(src: string): string` (8 hex chars), `iconHref(size: number, version: string): string` → `/site-icon/<size>?v=<version>`.
  - `server/lib/media/read.ts`: `type MediaFile = { driver: "static" | "local" | "s3"; key: string; url: string }`, `readMediaBytes(file: MediaFile, publicDir?: string): Promise<Buffer | null>`.
  - `server/modules/content/repo.ts`: `findMediaFile(id: string, db?): Promise<MediaFile | null>`.
  - `server/modules/theme/icons.ts`: `brandIcon(size: number): Promise<Uint8Array | null>`.
  - `RootMetadataInput.icon` becomes `iconVersion: string | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/seo/icons.test.ts
import { describe, expect, it } from "vitest"

import { iconHref, iconVersion } from "./icons"

describe("icons", () => {
  it("versions by source so a replaced icon busts caches", () => {
    expect(iconVersion("/uploads/a.png")).toMatch(/^[0-9a-f]{8}$/)
    expect(iconVersion("/uploads/a.png")).toBe(iconVersion("/uploads/a.png"))
    expect(iconVersion("/uploads/a.png")).not.toBe(
      iconVersion("/uploads/b.png")
    )
  })
  it("builds the route address", () => {
    expect(iconHref(32, "abcd1234")).toBe("/site-icon/32?v=abcd1234")
  })
})
```

```ts
// server/lib/media/read.test.ts
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { readMediaBytes } from "./read"

describe("readMediaBytes", () => {
  it("reads a static file from public/", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "pub-"))
    await mkdir(path.join(dir, "images"), { recursive: true })
    await writeFile(path.join(dir, "images/a.svg"), "<svg/>")
    const bytes = await readMediaBytes(
      { driver: "static", key: "static/a", url: "/images/a.svg" },
      dir
    )
    expect(bytes?.toString()).toBe("<svg/>")
  })

  it("refuses a static path that climbs out of public/", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "pub-"))
    for (const url of ["/../etc/passwd", "/images/../../x", "images/a.svg"])
      expect(
        await readMediaBytes({ driver: "static", key: "k", url }, dir)
      ).toBeNull()
  })

  it("returns null for a missing file instead of throwing", async () => {
    expect(
      await readMediaBytes({
        driver: "static",
        key: "k",
        url: "/images/nope.png",
      })
    ).toBeNull()
  })
})
```

```ts
// tests/integration/content/brand-icon.test.ts
import { eq } from "drizzle-orm"
import sharp from "sharp"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { closeDb, getDb } from "@/server/db/client"
import { media, settings } from "@/server/db/schema"
import { brandIcon } from "@/server/modules/theme/icons"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

async function useIcon(url: string, extra: Partial<typeof media.$inferInsert> = {}) {
  const [row] = await getDb()
    .insert(media)
    .values({
      driver: "static",
      key: `static${url}`,
      url,
      filename: url.split("/").pop()!,
      mimeType: url.endsWith(".svg") ? "image/svg+xml" : "image/png",
      sizeBytes: 1,
      width: 100,
      height: 100,
      ...extra,
    })
    .returning()
  const value = { icon: { mediaId: row!.id } }
  await getDb()
    .insert(settings)
    .values({ key: "site", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
  return row!
}

describe("brandIcon", () => {
  it("renders a static SVG as a square PNG", async () => {
    await useIcon("/images/hero/logo-mark.svg")
    const png = await brandIcon(192)
    const meta = await sharp(Buffer.from(png!)).metadata()
    expect(meta).toMatchObject({ format: "png", width: 192, height: 192 })
  })

  it("pads a wide image into a square PNG", async () => {
    // A 1740×1160 PNG that ships under public/.
    await useIcon("/images/how-it-works/step-3.png", {
      width: 1740,
      height: 1160,
    })
    const png = await brandIcon(32)
    const meta = await sharp(Buffer.from(png!)).metadata()
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([32, 32, true])
  })

  it("404s a deleted or unreadable icon", async () => {
    const row = await useIcon("/images/does-not-exist.png")
    expect(await brandIcon(32)).toBeNull()
    await getDb()
      .update(media)
      .set({ deletedAt: new Date(), url: "/images/hero/logo-mark.svg" })
      .where(eq(media.id, row.id))
    expect(await brandIcon(32)).toBeNull()
  })
})
```

If the `media` table has other NOT NULL columns without defaults (check `server/db/schema/media.ts`), add them to the `values` in `useIcon`.

In `lib/seo/metadata.test.ts`, change the "sets base, template, verification, icons…" case to pass `iconVersion: "abcd1234"` instead of `icon: asset(…)` and expect:

```ts
    expect(m.icons).toEqual({
      icon: [
        { url: "/site-icon/32?v=abcd1234", sizes: "32x32", type: "image/png" },
        { url: "/site-icon/192?v=abcd1234", sizes: "192x192", type: "image/png" },
      ],
      apple: [
        { url: "/site-icon/180?v=abcd1234", sizes: "180x180", type: "image/png" },
      ],
    })
```

and add `iconVersion: null` (and `expect(m.icons).toBeUndefined()`) wherever another case passed `icon: null`.

In `proxy.test.ts`, add `"/site-icon/32"` to the "skips %s" list and `"/site-icons"` to the "runs for %s" list.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --project unit lib/seo server/lib/media/read.test.ts proxy.test.ts; pnpm vitest run --project integration tests/integration/content/brand-icon.test.ts`
Expected: FAIL (modules missing; proxy runs for `/site-icon/32`; metadata icons shape differs).

- [ ] **Step 3: Write the helpers**

```ts
// lib/seo/icons.ts
// Ruling R13: the favicon and app icons rasterised from the library icon.
export const ICON_SIZES = [32, 180, 192, 512] as const

// FNV-1a: a short, stable cache-buster that changes when the file does.
export function iconVersion(src: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < src.length; i++) {
    hash ^= src.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

export const iconHref = (size: number, version: string) =>
  `/site-icon/${size}?v=${version}`
```

```ts
// server/lib/media/read.ts
import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"

import { localFile } from "./storage"

export type MediaFile = {
  driver: "static" | "local" | "s3"
  key: string
  url: string
}

const MAX_BYTES = 20 * 1024 * 1024
const STATIC_URL = /^\/[\w./-]+$/

// The original bytes of a media row, or null when they cannot be read.
// Static rows are seeded files under public/ (the only SVGs we hold).
export async function readMediaBytes(
  file: MediaFile,
  publicDir = path.join(process.cwd(), "public")
): Promise<Buffer | null> {
  try {
    if (file.driver === "static") {
      if (!STATIC_URL.test(file.url) || file.url.includes("..")) return null
      const full = path.join(publicDir, file.url)
      if (!full.startsWith(publicDir + path.sep)) return null
      return await readFile(full)
    }
    if (file.driver === "local") {
      const local = localFile(file.key)
      return local ? await readFile(local.path) : null
    }
    const response = await fetch(file.url, {
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    return bytes.length <= MAX_BYTES ? bytes : null
  } catch {
    return null
  }
}
```

Check `localFile`'s return type in `server/lib/media/storage.ts` (it returns an object with `path`, or a falsy value for a refused key) and adjust the property name if it differs.

In `server/modules/content/repo.ts`, add:

```ts
// The storage location of one live media row (favicon rasteriser).
export async function findMediaFile(id: string, db = getDb()) {
  const [row] = await db
    .select({ driver: t.media.driver, key: t.media.key, url: t.media.url })
    .from(t.media)
    .where(and(eq(t.media.id, id), isNull(t.media.deletedAt)))
    .limit(1)
  return row ?? null
}
```

- [ ] **Step 4: Write the rasteriser and the route**

```ts
// server/modules/theme/icons.ts
import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import sharp from "sharp"

import { readMediaBytes } from "@/server/lib/media/read"
import { MISS_LIFE, tags } from "@/server/lib/cache"
import { getSetting } from "@/server/modules/content/queries"
import * as repo from "@/server/modules/content/repo"

// A square, transparent-padded PNG of the site icon (Ruling R13). Cached
// per size until the site settings or the media library change.
export async function brandIcon(size: number): Promise<Uint8Array | null> {
  "use cache"
  cacheTag(tags.setting("site"), tags.media)
  const site = await getSetting("site")
  const file = site.icon ? await repo.findMediaFile(site.icon.mediaId) : null
  const bytes = file ? await readMediaBytes(file) : null
  if (!bytes) {
    cacheLife(MISS_LIFE)
    return null
  }
  try {
    const png = await sharp(bytes, { limitInputPixels: 40_000_000 })
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()
    cacheLife("max")
    return new Uint8Array(png)
  } catch {
    cacheLife(MISS_LIFE)
    return null
  }
}
```

```ts
// app/site-icon/[size]/route.ts
import { connection } from "next/server"

import { ICON_SIZES } from "@/lib/seo/icons"
import { brandIcon } from "@/server/modules/theme/icons"

// Ruling R13: /site-icon/32 · 180 · 192 · 512. Anything else is 404.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/site-icon/[size]">
) {
  await connection()
  const size = Number((await ctx.params).size)
  if (!(ICON_SIZES as readonly number[]).includes(size))
    return new Response("Not found", { status: 404 })
  const png = await brandIcon(size)
  if (!png) return new Response("Not found", { status: 404 })
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
```

If TypeScript rejects `Uint8Array` as `BodyInit`, wrap it: `new Response(new Blob([png]), …)`.

- [ ] **Step 5: Wire metadata, manifest, proxy and reserved segments**

In `lib/seo/metadata.ts`: import `iconHref` from `./icons`, change `RootMetadataInput.icon: MediaAsset | null` to `iconVersion: string | null`, and replace the icons line with:

```ts
    ...(i.iconVersion
      ? {
          icons: {
            icon: [
              { url: iconHref(32, i.iconVersion), sizes: "32x32", type: "image/png" },
              { url: iconHref(192, i.iconVersion), sizes: "192x192", type: "image/png" },
            ],
            apple: [
              { url: iconHref(180, i.iconVersion), sizes: "180x180", type: "image/png" },
            ],
          },
        }
      : {}),
```

In `app/(site)/layout.tsx`: import `iconVersion` from `@/lib/seo/icons`; compute `const icon = (site.icon && assets.get(site.icon.mediaId)) ?? null` and pass `iconVersion: icon ? iconVersion(icon.src) : null` instead of `icon`.

In `app/manifest.ts`: import `{ iconHref, iconVersion }`, delete `iconType`, and build:

```ts
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      ...(icon
        ? [192, 512].map((size) => ({
            src: iconHref(size, iconVersion(icon.src)),
            sizes: `${size}x${size}`,
            type: "image/png",
          }))
        : []),
    ],
```

In `proxy.ts`, add `site-icon` to the skip lookahead: `(?:api|_next|uploads|images|og|admin|site-icon)(?:/|$)`. In `lib/content/page-path.ts`, add `"site-icon"` to `RESERVED_SEGMENTS`.

- [ ] **Step 6: Run tests to verify they pass**

Run:
```bash
pnpm vitest run --project unit lib/seo server/lib/media proxy.test.ts lib/content
pnpm vitest run --project integration tests/integration/content/brand-icon.test.ts
pnpm typecheck
DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build
pnpm test:parity
```
Expected: PASS. Parity is unaffected (`<link rel="icon">` is not painted; the seed sets no `site.icon`, so no new links render).

- [ ] **Step 7: Commit**

```bash
git add lib/seo/icons.ts lib/seo/icons.test.ts server/lib/media/read.ts server/lib/media/read.test.ts \
  server/modules/content/repo.ts server/modules/theme/icons.ts "app/site-icon" \
  lib/seo/metadata.ts lib/seo/metadata.test.ts "app/(site)/layout.tsx" app/manifest.ts \
  proxy.ts proxy.test.ts lib/content/page-path.ts tests/integration/content/brand-icon.test.ts
git commit -m "feat(theme): rasterise the library icon into favicon and app icons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Appearance screen — presets, pickers with contrast badges, fix automatically, radius and mode, live previews, publish/discard/reset/revisions, logo and favicon

**Model:** sonnet

**Files:**
- Modify: `admin/lib/api.ts`, `admin/lib/query-keys.ts`, `admin/modules/seo/seo-aside.tsx`
- Create: `app/(admin)/admin/(panel)/appearance/page.tsx`, `admin/modules/appearance/queries.ts`, `admin/modules/appearance/appearance-view.tsx`, `admin/modules/appearance/preset-gallery.tsx`, `admin/modules/appearance/colour-field.tsx`, `admin/modules/appearance/contrast-panel.tsx`, `admin/modules/appearance/admin-preview.tsx`, `admin/modules/appearance/brand-assets.tsx`, `admin/modules/appearance/theme-history.tsx`, `admin/modules/appearance/live-tokens.ts`
- Test: `admin/modules/appearance/live-tokens.test.ts`, `admin/modules/appearance/appearance-view.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`PRESETS`, `PRESET_IDS`, `SITE_TOKENS`, `resolveSiteTokens`, `buildAdminTokens`, `pairRatings`, `checkTheme`, `describeIssue`, `fixIssue`, `fixAll`, `liveDeclarations`, `parseColor`, `formatOklch`, `toHex`, `ADMIN_RADII`, `ThemeConfig`); Task 3 `ThemeRoutes` and the `ThemeDoc` JSON; `useAutosave` (`admin/modules/pages/use-autosave.ts`: returns `{ state, schedule, flush, setVersion, getVersion, reset, … }`); `PreviewPane`, `previewSrc` (`admin/modules/pages/preview-pane.tsx`); `MediaWidget` (`admin/components/schema-form/widgets/media-widget.tsx`); `globalsApi`.
- Produces: `themeApi = hc<ThemeRoutes>("/api/v1/admin/theme")`; `queryKeys.theme = { detail: ["theme"], revisions: ["theme", "revisions"], colors: ["theme", "colors"] }`; `themeQuery()`, `themeRevisionsQuery()`, `themeColorsQuery()`; `applyLive(root: HTMLElement, decls: [string, string][]): () => void`.

UI contract (labels are load-bearing; tests and Task 8 select by them):
- Page title "Appearance". Status line from `useAutosave` state: "Saving…", "Draft saved", "Couldn't save".
- Header buttons: **"Preview on site"** (flushes the draft, then `window.open(previewSrc("/"), "_blank", "noopener")`), **"Discard draft"** (enabled only when `hasDraft`), **"Reset to preset…"** (dialog: preset select, scope radio "Site" / "Admin" / "Both", confirm "Reset draft"), **"Publish"** (`appearance.publish` only; disabled while saving or while `checkTheme(draft)` is non-empty).
- Tabs **"Site"** and **"Admin"**.
- Site tab: preset gallery (one button per preset, `aria-pressed`, label = preset label, swatches of brand/cream/clay); colour field **"Brand"**; an "Advanced tokens" disclosure listing every `SITE_TOKENS` entry as a colour field with its label from `tokenLabel("site", t)` and a lock toggle `aria-label="Lock <label>"` (locked = value stored in `tokens`; unlocking deletes the key); the site preview (`PreviewPane path="/" refreshKey={savedAt}`).
- Admin tab: preset gallery; colour fields **"Primary"** and **"Accent"** (accent has "Clear"); radio group **"Neutral tint"** ("Preset", "None", "Primary"); radius `<input type="range">` labelled **"Corner radius"** over `ADMIN_RADII` showing `"<n>rem"`; radio group **"Default mode"** ("System", "Light", "Dark"); the admin preview card.
- Colour field: swatch button opening a `Popover` with react-colorful `HexColorPicker` (value `toHex(current)`), a text `Input` that accepts `#rrggbb` or `oklch(…)` and commits on blur/Enter only when `parseColor` succeeds (otherwise shows "Use a #rrggbb or oklch(L C H) colour"), and a readout `oklch(…) · #rrggbb`.
- Contrast panel (both tabs, filtered by scope): every pair from `pairRatings(draft)` with the ratio to 2 places and a badge "AAA", "AA" or "Fails"; failing rows show `describeIssue(issue)` and a **"Fix automatically"** button (calls `fixIssue`; if it returns null the row shows "Pick a different colour"); a panel-level **"Fix all"** button (calls `fixAll`). When any issue exists, a callout above Publish reads "Publishing is blocked until every pair passes." followed by the first issue's text.
- Publish errors from the server (400 with `details.issues`) render the same callout with the server message.
- Brand assets card: **"Logo"** and **"Favicon"** `MediaWidget`s reading `globalsApi[":key"].$get({ param: { key: "site" } })` and saving with `PUT` (version-guarded; 409 shows "Changed by someone else" and reloads). Copy under Favicon: "Square PNG, JPEG or WebP, at least 512 × 512. SVG uploads are not accepted."
- History card: published revisions (date, author, note) with **"Load into draft"**.
- Live admin preview: while the page is mounted, `applyLive(document.documentElement, liveDeclarations(draft.admin, resolvedTheme))` re-applies on every draft or mode change (`resolvedTheme` from `next-themes`); the cleanup removes every property it set, so leaving the page returns to the published `<style>`. The preview card shows real components: `Button` (default, secondary, outline), `Badge`, `Input`, `Switch`, the status pills (success/warning/danger soft fills), a `Card`, and five chart swatches (`bg-chart-1` … `bg-chart-5`).

- [ ] **Step 1: Write the failing tests**

```ts
// admin/modules/appearance/live-tokens.test.ts
// @vitest-environment jsdom
import { expect, it } from "vitest"

import { applyLive } from "./live-tokens"

it("sets every declaration and the cleanup removes only those", () => {
  const root = document.createElement("div")
  root.style.setProperty("--other", "1")
  const undo = applyLive(root, [
    ["--primary", "oklch(0.5 0.1 150)"],
    ["--radius", "0.5rem"],
  ])
  expect(root.style.getPropertyValue("--primary")).toBe("oklch(0.5 0.1 150)")
  undo()
  expect(root.style.getPropertyValue("--primary")).toBe("")
  expect(root.style.getPropertyValue("--radius")).toBe("")
  expect(root.style.getPropertyValue("--other")).toBe("1")
})

it("ignores a declaration name that is not a custom property", () => {
  const root = document.createElement("div")
  applyLive(root, [["color", "red"]])
  expect(root.style.getPropertyValue("color")).toBe("")
})
```

```tsx
// admin/modules/appearance/appearance-view.test.tsx
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"
import { permissionMap, type RoleName } from "@/lib/auth/permissions"
import { DEFAULT_THEME, ThemeConfig } from "@/lib/theme/schema"
import { checkTheme } from "@/lib/theme/checks"

import { AppearanceView } from "./appearance-view"

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const actor = (roles: RoleName[]): MePayload => ({
  user: { id: "u1", email: "o@example.com", name: "O" },
  roles,
  permissions: permissionMap(roles),
  twoFactorEnabled: true,
  impersonatedBy: null,
})

const docFor = (draft: unknown, version = 3) => {
  const parsed = ThemeConfig.parse(draft)
  return {
    value: DEFAULT_THEME,
    draft: parsed,
    hasDraft: true,
    version,
    updatedAt: null,
    issues: checkTheme(parsed),
  }
}

function setup(initial: ReturnType<typeof docFor>) {
  const calls: { url: string; body: unknown }[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : null
      calls.push({ url, body })
      if (url.endsWith("/theme") || url.endsWith("/theme/"))
        return Response.json(initial)
      if (url.includes("/theme/revisions")) return Response.json([])
      if (url.includes("/globals/site"))
        return Response.json({ key: "site", value: { logo: null, icon: null }, version: 1 })
      if (url.endsWith("/theme/draft"))
        return Response.json(docFor(body.draft, body.version + 1))
      if (url.endsWith("/theme/publish"))
        return Response.json({ ...initial, hasDraft: false })
      return Response.json({})
    })
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AdminActorProvider value={actor(["owner"])}>
        <AppearanceView />
      </AdminActorProvider>
    </QueryClientProvider>
  )
  return calls
}

it("blocks Publish and explains a failing pair", async () => {
  setup(docFor({ site: { tokens: { "text-muted": "#dddddd" } } }))
  expect(
    await screen.findByText("Publishing is blocked until every pair passes.")
  ).toBeTruthy()
  expect(screen.getAllByText(/Muted text on Cream is \d\.\d{2}:1/).length)
    .toBeGreaterThan(0)
  expect(
    (screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement)
      .disabled
  ).toBe(true)
})

it("Fix all clears the issues and saves the draft", async () => {
  const calls = setup(docFor({ site: { tokens: { "text-muted": "#dddddd" } } }))
  await userEvent.click(await screen.findByRole("button", { name: "Fix all" }))
  await waitFor(() =>
    expect(calls.some((c) => c.url.endsWith("/theme/draft"))).toBe(true)
  )
  expect(screen.queryByText("Publishing is blocked until every pair passes."))
    .toBeNull()
})

it("choosing a preset updates the draft", async () => {
  const calls = setup(docFor({}))
  await userEvent.click(await screen.findByRole("button", { name: /Ocean/ }))
  await waitFor(() => {
    const save = calls.find((c) => c.url.endsWith("/theme/draft"))
    expect(save?.body).toMatchObject({ draft: { site: { preset: "ocean" } } })
  })
})

it("publishes with the current version", async () => {
  const calls = setup(docFor({ site: { brand: "#2f5f8a" } }))
  await userEvent.click(await screen.findByRole("button", { name: "Publish" }))
  await waitFor(() =>
    expect(calls.find((c) => c.url.endsWith("/theme/publish"))?.body).toEqual({
      version: 3,
    })
  )
})
```

Use fake timers (`vi.useFakeTimers({ shouldAdvanceTime: true })`) if the 1.2 s autosave debounce makes `waitFor` time out, or pass `delay={0}` through a test-only `autosaveDelay` prop on `AppearanceView`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --project unit admin/modules/appearance`
Expected: FAIL with "Failed to resolve import "./live-tokens"" / "./appearance-view".

- [ ] **Step 3: Wire the API client and queries**

In `admin/lib/api.ts`: `import type { ThemeRoutes } from "@/server/modules/theme/routes"` and `export const themeApi = hc<ThemeRoutes>("/api/v1/admin/theme")`. In `admin/lib/query-keys.ts` add:

```ts
  theme: {
    detail: ["theme"] as const,
    revisions: ["theme", "revisions"] as const,
    colors: ["theme", "colors"] as const,
  },
```

```ts
// admin/modules/appearance/queries.ts
import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { parseResponse, themeApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"

export type ThemeAdminDoc = InferResponseType<typeof themeApi.index.$get, 200>

export const themeQuery = () =>
  queryOptions({
    queryKey: queryKeys.theme.detail,
    queryFn: () => parseResponse(themeApi.index.$get()),
    staleTime: 0,
  })

export const themeRevisionsQuery = () =>
  queryOptions({
    queryKey: queryKeys.theme.revisions,
    queryFn: () => parseResponse(themeApi.revisions.$get()),
  })

export const themeColorsQuery = () =>
  queryOptions({
    queryKey: queryKeys.theme.colors,
    queryFn: () => parseResponse(themeApi.colors.$get()),
    staleTime: 5 * 60_000,
  })
```

- [ ] **Step 4: Write `live-tokens.ts`**

```ts
// admin/modules/appearance/live-tokens.ts
// brief §10.2: the draft applied to the admin itself, inline on <html>.
// Inline style beats the published <style>, and the cleanup hands back to it.
export function applyLive(
  root: HTMLElement,
  decls: [string, string][]
): () => void {
  const set: string[] = []
  for (const [name, value] of decls) {
    if (!/^--[a-z][a-z0-9-]*$/.test(name)) continue
    root.style.setProperty(name, value)
    set.push(name)
  }
  return () => {
    for (const name of set) root.style.removeProperty(name)
  }
}
```

- [ ] **Step 5: Build the screen**

Implement the components to the UI contract above. Structure:
- `appearance-view.tsx` (`"use client"`): `useSuspenseQuery(themeQuery())`; local `draft` state initialised from `doc.draft`; `const autosave = useAutosave<ThemeConfigValue>({ version: doc.version, save: async (value, version, options) => { const next = await parseResponse(themeApi.draft.$put({ json: { version, draft: value } }, options?.keepalive ? { init: { keepalive: true } } : undefined)); queryClient.setQueryData(queryKeys.theme.detail, next); return next } })`; every edit goes through `update(next)` = `setDraft(next); autosave.schedule(next)`. Publish: `await autosave.flush()` → `themeApi.publish.$post({ json: { version: autosave.getVersion() } })` → on success `autosave.setVersion(res.version)`, `setQueryData`, invalidate `queryKeys.theme.revisions` and `queryKeys.theme.colors`, toast "Theme published"; on 400 show the server message in the callout. Discard/reset/restore: flush, call the endpoint with `getVersion()`, then `autosave.reset(res.version)` and `setDraft(res.draft)`. `useAdminActor()` (from `admin/lib/actor-context`) gates Publish on `appearance.publish`.
- `preset-gallery.tsx`: props `{ scope: "site" | "admin"; value: PresetId; onPick(id) }`; site pick → `{ ...draft, site: presetSiteTheme(id) }`, admin pick → `{ ...draft, admin: { ...draft.admin, ...presetAdminColours(id) } }`. Swatches use `toHex` of the resolved preset tokens as inline `background-color` (hex from our engine, not user text).
- `colour-field.tsx`: props `{ label: string; value: string | null; fallback: Oklch; onChange(value: string | null): void; lock?: { locked: boolean; onToggle(): void }; clearable?: boolean }`; emits canonical `formatOklch` strings only.
- `contrast-panel.tsx`: props `{ config: ThemeConfigValue; scope: "site" | "admin"; onChange(config): void }`; renders rows from `pairRatings(config)` filtered to `scope === "site"` or the two admin scopes.
- `admin-preview.tsx`: the effect calling `applyLive` and the sample card.
- `brand-assets.tsx`: logo/favicon `MediaWidget`s with `field` objects `{ name: "logo", label: "Logo", widget: "media", required: false, nullable: true }` (and `icon` / "Favicon").
- `theme-history.tsx`: revisions list with "Load into draft".
- `app/(admin)/admin/(panel)/appearance/page.tsx` mirrors `marketing/page.tsx`: `export const metadata = { title: "Appearance" }`, `Suspense` with `CardSkeleton`, `Gate` → `await requirePermission(permissionFor("/admin/appearance"))` → `<AppearanceView />`.

- [ ] **Step 6: Share-card preview carry (R14)**

In `admin/modules/seo/seo-aside.tsx`, replace `colors: ogColors(DEFAULT_THEME.site)` with the published colours:

```tsx
  const colors = useQuery(themeColorsQuery()).data
  …
    // Phase 7 carry: the share card uses the published theme's colours.
    colors: colors ?? ogColors(DEFAULT_THEME.site),
```

(`import { useQuery } from "@tanstack/react-query"` and `themeColorsQuery` from `@/admin/modules/appearance/queries`; keep the default as the loading fallback.)

- [ ] **Step 7: Run tests to verify they pass**

Run:
```bash
pnpm vitest run --project unit admin/modules/appearance admin/modules/seo
pnpm typecheck
pnpm lint
```
Expected: PASS.

- [ ] **Step 8: Check it in the browser**

Run `pnpm dev`, sign in as the owner, open `/admin/appearance`: pick Ocean (admin recolours at once; the site pane reloads blue after "Draft saved"), set Muted text to `#dddddd` (Publish disabled, the callout explains, "Fix automatically" repairs), switch to dark mode from the user menu (the preview follows), leave the page (the admin returns to the published colours). Then "Discard draft".

- [ ] **Step 9: Commit**

```bash
git add admin/lib/api.ts admin/lib/query-keys.ts admin/modules/appearance \
  "app/(admin)/admin/(panel)/appearance" admin/modules/seo/seo-aside.tsx
git commit -m "feat(theme): appearance screen with presets, contrast guard and live preview

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Acceptance E2E, isolation, phase exit

**Model:** sonnet

**Files:**
- Create: `playwright.appearance.config.ts`, `tests/e2e/appearance/appearance.spec.ts`, `tests/e2e/support/theme.ts`
- Modify: `playwright.config.ts`, `package.json`, `.github/workflows/ci.yml`, `.superpowers/sdd/plan/progress.md`

**Interfaces:**
- Consumes: Task 3 API, Task 4/5 delivery, Task 7 labels; `api()`, `STORAGE`, `E2E_ORIGIN`.
- Produces: `resetTheme(): Promise<void>` and `cssVar(page, name): Promise<string>` in `tests/e2e/support/theme.ts`; script `test:e2e:appearance`.

- [ ] **Step 1: Write the failing E2E spec**

```ts
// tests/e2e/support/theme.ts
import { request as playwrightRequest, type Page } from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"
import { api } from "./api"
import { STORAGE } from "./storage"

export async function ownerApi() {
  return playwrightRequest.newContext({
    baseURL: E2E_ORIGIN,
    storageState: STORAGE.owner,
  })
}

// Back to Teal Sage / Evergreen, published (R17).
export async function resetTheme() {
  const req = await ownerApi()
  let doc = await api<{ version: number }>(req, "GET", "/theme")
  doc = await api(req, "POST", "/theme/reset", {
    version: doc.version,
    preset: "teal-sage",
    scope: "site",
  })
  doc = await api(req, "POST", "/theme/reset", {
    version: doc.version,
    preset: "evergreen",
    scope: "admin",
  })
  await api(req, "POST", "/theme/publish", { version: doc.version })
  await req.dispose()
}

export const cssVar = (page: Page, name: string) =>
  page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name
  )
```

```ts
// tests/e2e/appearance/appearance.spec.ts
import { expect, test } from "@playwright/test"

import { api } from "../support/api"
import { STORAGE } from "../support/storage"
import { cssVar, ownerApi, resetTheme } from "../support/theme"

test.describe.configure({ mode: "serial" })
test.afterAll(resetTheme)

test("the default theme emits no theme style (parity guard)", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("style#theme-tokens")).toHaveCount(0)
  expect(await cssVar(page, "--color-brand")).toBe("#336060")
})

test.describe("as the owner", () => {
  test.use({ storageState: STORAGE.owner })

  test("brand colour → preview → publish → CSS variables change on the next request", async ({
    page,
    browser,
  }) => {
    await page.goto("/admin/appearance")
    await page.getByRole("tab", { name: "Site" }).click()
    const brand = page.getByRole("textbox", { name: "Brand" })
    await brand.fill("#2f5f8a")
    await brand.press("Enter")
    await expect(page.getByText("Draft saved")).toBeVisible()

    // An anonymous visitor never sees the draft (Review Focus 4).
    const anon = await browser.newContext({ storageState: undefined })
    const visitor = await anon.newPage()
    await visitor.goto("/")
    expect(await cssVar(visitor, "--color-brand")).toBe("#336060")

    // Preview on site: draft mode reads the draft.
    const preview = await page.context().newPage()
    await preview.goto("/api/v1/admin/preview?path=/")
    expect(await cssVar(preview, "--color-brand")).toMatch(/^oklch\(/)
    await preview.goto("/api/v1/admin/preview/exit?path=/")

    await page.getByRole("button", { name: "Publish" }).click()
    await expect(page.getByText("Theme published")).toBeVisible()

    await visitor.goto("/")
    const published = await cssVar(visitor, "--color-brand")
    expect(published).toMatch(/^oklch\(/)
    expect(published).not.toBe("#336060")
    await expect(visitor.locator("style#theme-tokens")).toHaveCount(1)
    await anon.close()
  })

  test("failing contrast blocks publishing with an explanation", async ({
    page,
  }) => {
    await page.goto("/admin/appearance")
    await page.getByRole("tab", { name: "Site" }).click()
    await page.getByText("Advanced tokens").click()
    const muted = page.getByRole("textbox", { name: "Muted text" })
    await muted.fill("#dddddd")
    await muted.press("Enter")
    await expect(page.getByText("Draft saved")).toBeVisible()
    await expect(
      page.getByText("Publishing is blocked until every pair passes.")
    ).toBeVisible()
    await expect(page.getByText(/Muted text on Cream is \d\.\d{2}:1/).first())
      .toBeVisible()
    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled()

    // The server enforces it too.
    const req = await ownerApi()
    const doc = await api<{ version: number }>(req, "GET", "/theme")
    const res = await req.fetch("/api/v1/admin/theme/publish", {
      method: "POST",
      data: { version: doc.version },
      headers: { origin: new URL(page.url()).origin },
    })
    expect(res.status()).toBe(400)
    expect(await res.text()).toContain("Muted text on Cream")
    await req.dispose()

    await page.getByRole("button", { name: "Fix all" }).click()
    await expect(page.getByText("Draft saved")).toBeVisible()
    await expect(page.getByRole("button", { name: "Publish" })).toBeEnabled()
    await page.getByRole("button", { name: "Discard draft" }).click()
  })

  test("admin primary publishes to the admin's own variables", async ({
    page,
  }) => {
    const req = await ownerApi()
    let doc = await api<{ version: number }>(req, "GET", "/theme")
    doc = await api(req, "PUT", "/theme/draft", {
      version: doc.version,
      draft: { admin: { primary: "#6a3f6b" } },
    })
    await api(req, "POST", "/theme/publish", { version: doc.version })
    await req.dispose()
    await page.goto("/admin")
    await expect(page.locator("style#theme-tokens")).toHaveCount(1)
    expect(await cssVar(page, "--primary")).toMatch(/^oklch\(/)
  })

  test("reset to preset returns the site to today's palette", async ({
    page,
  }) => {
    await resetTheme()
    await page.goto("/")
    await expect(page.locator("style#theme-tokens")).toHaveCount(0)
    expect(await cssVar(page, "--color-brand")).toBe("#336060")
  })
})
```

If the field's accessible name differs (the colour field renders a visible `<label>` for its text input), keep the label text exactly "Brand" / "Muted text" in Task 7 rather than changing the spec.

- [ ] **Step 2: Add the isolated config and script**

```ts
// playwright.appearance.config.ts
import { defineConfig, devices } from "@playwright/test"

import base from "./playwright.config"

// Ruling R17: the appearance spec publishes themes, so it runs in its own
// invocation (fresh seed via globalSetup), never beside parity.
export default defineConfig({
  ...base,
  projects: [
    base.projects!.find((p) => p.name === "setup")!,
    {
      name: "appearance",
      testMatch: /appearance\/.*\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
})
```

In `playwright.config.ts`, add `"**/appearance/**"` next to `"**/tracking/**"` in the public projects' `testIgnore`, and add it to the admin projects' `testIgnore` too (`[...desktopOnly(name), "**/appearance/**"]`). In `package.json` scripts add `"test:e2e:appearance": "playwright test --config playwright.appearance.config.ts"`. In `.github/workflows/ci.yml`, after the step that runs `pnpm test:e2e:tracking`, add an identical step named "E2E (appearance)" that runs `pnpm test:e2e:appearance`.

- [ ] **Step 3: Run the spec and see it pass**

Run: `pnpm test:e2e:appearance`
Expected: 5 passed. (Write the spec first and run it once before Step 2's config exists to see it fail with "No tests found" under the main config's ignore — that is the red run.)

- [ ] **Step 4: Full phase gate**

Run:
```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build
pnpm test:parity
pnpm test:e2e
pnpm test:e2e:tracking
pnpm test:e2e:appearance
git status --short server/db/migrations
```
Expected: all green; parity ≤ 0.1% on every page; no migration changes.

- [ ] **Step 5: Record the phase exit**

Append to `.superpowers/sdd/plan/progress.md`:

```
Phase 9 (appearance): complete. Plan docs/plans/phase-09-appearance.md. Rulings R1–R18. Carries closed: Phase 4 "globals draft preview" (R15), Phase 7 share-preview colours (R14), Phase 1.10 auth gradient (R16), Phase 3 "ThemeGlobal.admin unvalidated" (ThemeConfig). Open questions for the user: R3 new preset palettes; R13 no .ico generation; R18 themed emails.
```

- [ ] **Step 6: Commit**

```bash
git add playwright.appearance.config.ts playwright.config.ts package.json .github/workflows/ci.yml \
  tests/e2e/appearance tests/e2e/support/theme.ts .superpowers/sdd/plan/progress.md
git commit -m "test(theme): appearance acceptance e2e in its own playwright run

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase exit

- Acceptance 1 ("change the brand colour → preview → publish → the site's CSS variables change on the next request"): Task 8 first owner test; Task 3 "publishes…expires the tag".
- Acceptance 2 ("failing contrast blocks publishing with an explanation"): Task 8 second owner test (UI and API); Task 3 "blocks a failing draft…"; Task 7 "blocks Publish and explains a failing pair".
- Acceptance 3 ("parity is unchanged while the theme is the Teal Sage default"): R4; Task 2 `css.test.ts` "emits nothing for the default theme"; `pnpm test:parity` in Tasks 4, 6 and 8; Task 8 "the default theme emits no theme style".

## Spec coverage map

| Spec item | Task |
| --- | --- |
| §10.1 input validation, culori `toGamut("rgb", "oklch")` | 1, 2 |
| §10.1 site tokens set or derived with lock | 2 (`resolveSiteTokens`), 7 (lock toggles) |
| §10.1 admin preset / primary / accent / tint / radius / mode → full token set light + dark | 2 (`buildAdminTokens`), 5, 7 |
| §10.1 `scale`, `onColor`, `contrast`, `buildSiteTokens` (`resolveSiteTokens`), `buildAdminTokens(mode)`, `toCss` | 1, 2 |
| §10.1 publish blocked below AA, explanation, fix automatically | 2, 3, 7 |
| §10.1 CSS re-serialised from validated values | 2 (`toCss` from numbers), Review Focus 1 |
| §10.2 six presets, Evergreen admin default, Teal Sage site default | 2 |
| §10.2 `settings.theme` draft + value + revisions | 3 |
| §10.2 `<style id="theme-tokens">` in `SiteFrame` and `AdminFrame`, scopes | 4, 5 |
| §10.2 live admin preview via `setProperty`, site preview canvas | 7 (R12) |
| §10.2 "Preview on site" → draft mode reads the draft | 4 (R10), 7, 8 |
| §10.2 Publish and Reset to preset separate | 3 (R8), 7 |
| §10.2 logo, favicon/app icon in `manifest.ts` and metadata `icons`, admin radius | 4, 6, 2/7 |
| §7.2 `appearance.read · update · publish` owner/admin | 3 (RBAC matrix), 7 |
| §8.3 Appearance endpoints | 3 |
| §9.3 preset gallery, pickers, AA/AAA badges, automatic foregrounds, radius, side-by-side preview, draft → publish → reset, logo and favicon | 7 |
| §11 OG card uses theme colours (Phase 7 carry) | 3, 4, 7 (R14) |
| §16 unit "theme engine (contrast, gamut, preset snapshots)" | 1, 2 |
| §16 E2E "theme publish changes CSS variables" | 8 |

## Self-check against the installed code (done while writing this plan)

- `settings.draft` exists (`server/db/schema/settings.ts`: "`draft` is only used by the theme"); no migration needed.
- `getSetting` is `"use cache"` + `cacheTag(tags.setting(key))`; `invalidate()` calls `revalidateTag(tag, { expire: 0 })` (`server/lib/cache.ts`).
- `isPreviewing()` = draft-mode cookie **and** a session with `page.read` (`server/modules/content/preview.ts`); owner and admin hold `page.read`.
- `appearance: ["read", "update", "publish"]` exists in `lib/auth/permissions.ts`; only owner and admin have it (`permissions.test.ts`). The nav entry `/admin/appearance` exists in `lib/admin/nav.ts`.
- `site` global already has `logo` and `icon` `MediaRef`s; the seed's logo is the static `/images/hero/logo-mark.svg`, which `components/brand.tsx` draws today.
- `server/lib/media/sniff.ts` accepts JPEG, PNG, WebP, AVIF and PDF only ("SVG is not on it (script)").
- `app/manifest.ts` calls `connection()`; `app/og/[[...path]]/route.tsx` reads `getSetting("theme").site`; `admin/modules/seo/seo-aside.tsx` uses `ogColors({})` with a Phase 9 comment.
- `admin.css` Evergreen blocks and `site.css` `@theme` values were copied into Task 2's tables from the files; every value round-trips hex → canonical OKLCH → hex at 4/4/2 places (culori 4.0.2, checked in a scratch script); all twelve preset tables pass every R5 pair under the R2 derivation (same script).
- `useAutosave` returns `{ state, schedule, flush, exclusive, overwrite, reset, markConflict, setVersion, getVersion }`; `PreviewPane({ path, refreshKey, className })` and `previewSrc(path)` are exported from `admin/modules/pages/preview-pane.tsx`.
- `proxy.ts` matcher skips `api|_next|uploads|images|og|admin`; `RESERVED_SEGMENTS` lives in `lib/content/page-path.ts`.

## Execution handoff

Plan complete and saved to `docs/plans/phase-09-appearance.md`. Recommended execution: **Subagent-driven** (sonnet default; opus for Tasks 2 and 3; fix loops only on Critical/Important findings), because Tasks 4–8 all consume the engine's exact names and a mistake in the publish gate or the CSS serialiser would ship unreadable or injectable output to every visitor.

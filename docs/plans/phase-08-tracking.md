# Phase 8: Marketing and Tracking (Consent-First) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No Google or Meta script, cookie or request reaches a visitor's browser until they say yes. A site-styled banner offers Accept all / Reject all / Customise with equal weight; the choice lives in `mk_consent` (180 days, re-prompted on a new revision or after 6 months) and is proven by an append-only `consent_events` log. Once consent exists, one server-rendered inline script applies Consent Mode v2 and loads GTM (Basic mode). A typed `track()` feeds a sanitised dataLayer (no query, no hash, article and newsletter paths collapsed), a nuqs-safe `RouteTracker` sends `virtual_page_view`, and the five catalogue events are wired. The Meta Pixel loads only with marketing consent, on an allowlist of neutral routes; the Conversions API sends `Lead` from the server inside `after()` with the same `event_id`, re-checking consent from the cookie, with no email or phone hashes unless the owner turns on enhanced matching after a legal acknowledgement. Marketers configure IDs, toggles and banner copy in the admin without a deploy; the owner alone manages custom code. An allowlist CSP ships Report-Only with the other security headers, and `docs/gtm-container.json` is an importable workspace.

**Architecture:** Pure, isomorphic rules live in `lib/tracking/` (ID formats, the consent cookie and its state machine, the URL sanitiser, the event catalogue and `pushEvent`, the bootstrap script builder, the frame decision, route matching, the CSP builder) and are unit-tested; the inline bootstrap is a string built from them and executed under `node:vm` in tests so its cookie and sanitising logic provably match the TypeScript. `SiteFrame` (already dynamic behind `io()`) reads the cached `consent` and `scripts` globals plus a cached, token-free projection of `tracking`, decides once whether tracking is active, and renders the bootstrap, the banner, `RouteTracker`, `ClickTracker`, `MarketingScripts` and `CustomScripts`. Nothing on the server reads `cookies()` while rendering, so the static shell and Cache Components are untouched and the bootstrap reads the cookie in the browser. Server code under `server/modules/tracking/` and `server/modules/consent/` owns the admin API, the consent log and CAPI; `server/lib/secrets.ts` is AES-256-GCM over `APP_ENCRYPTION_KEY`.

**Tech Stack:** Next.js 16.3.8 (Cache Components, `after()` through `defer()`, `next/script` for custom code, `next.config` `headers()`) · Hono 4.13.13 + `@hono/zod-validator` 0.9.1 (`hono/cookie`) · Drizzle 0.45.4 · Zod 4.6.5 (`z.stringbool`) · TanStack Query 5.104.1 · nuqs 2 · `node:crypto` (AES-256-GCM, SHA-256) · `node:vm` (tests) · Playwright network interception. **No new dependencies.**

**Spec:** [`docs/brief.md`](../brief.md) (§1, §2.2 D12, §2.3 Q6, §3 criterion 6, §5.5 step 4, §5.6 `settings:<key>` tags, §6.4 `tracking` / `consent` / `scripts` globals, §6.6 `leads.meta_event_id` and `consent_events`, §7.2 `tracking.*` and `code.update`, §8.3 Public and Marketing rows, §9.1 Marketing nav, §9.3 Marketing row, **§12 in full**, §13 hidden fields, §15 Secrets and Headers, §16 unit/E2E rows, §17 `APP_ENCRYPTION_KEY`, §19 health-data row, Appendix A CSP row) and the Phase 8 contract in [`docs/plan.md`](../plan.md) ("### Phase 8: Marketing and tracking (consent-first)"). Read both first.

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

Phase-8 values from the spec (verbatim):

- "prior opt-in for every non-essential cookie and tag, **analytics included**; **Reject all as prominent as Accept all**, on the first layer; no pre-ticked boxes, sliders or "consent by scrolling"; granular categories; a demonstrable record of consent; re-confirming consent at least every **6 months**; withdrawal as easy as giving consent, through a persistent "Cookie settings" link in the footer." (§12.1)
- "**Basic consent mode.** No Google or Meta script loads until the visitor consents." (§12.1)
- "Topics, message text and condition-revealing URLs or query strings (e.g. `/contact?topic=anxiety-stress`, or article slugs that name techniques) are **never** sent to Google or Meta." · "Vendor payloads use standard event names only, and URLs are sanitised: origin + path, no query or hash, with article paths collapsed to `/insights`." · "Meta prohibits "mental health and psychological states" data in URLs, custom events and custom data." (§12.1)
- "**Configured, not coded.** Every ID, toggle and banner text lives in `settings`, so marketers change tracking without a deploy." (§12.1)
- "`necessary`: always on. `analytics` → `analytics_storage`. `marketing` → `ad_storage`, `ad_user_data`, `ad_personalization`, the Meta Pixel and CAPI." (§12.2)
- "Cookie `mk_consent = { id, v (revision), ts, a, m }`: 180-day `Max-Age`, `Secure; SameSite=Lax`, not HttpOnly (the bootstrap script reads it). A new revision, or a choice older than 6 months, re-prompts." (§12.2)
- "An append-only `consent_events` table stores the consent id, choices, policy revision, a hash of the banner text, the action and a timestamp, but no raw IP. Events arrive through `navigator.sendBeacon` to `POST /api/v1/public/consent`." (§12.2)
- "**Withdrawal.** Sends a denied update, deletes `_ga*`, `_gcl_*`, `_fbp` and `_fbc`, and reloads the page." (§12.2)
- Bootstrap order: "initialise `dataLayer` and `gtag`; `gtag("consent", "default", …)`: everything denied except `security_storage`, with `wait_for_update: 500`; `gtag("set", "ads_data_redaction", true)`; apply the stored `mk_consent` choice, if there is one (`consent update`); define `window.__loadGtm()`, and call it only if analytics or marketing consent exists." · "IDs are regex-validated (`^GTM-[A-Z0-9]+$`, `^G-[A-Z0-9]+$`, Pixel `^\d{10,20}$`) and passed through `JSON.stringify`." · "`url_passthrough` stays off" · "GTM's `<noscript>` iframe is omitted, because it would bypass consent." (§12.3)
- "`RouteTracker` (client, in Suspense). Pushes `{ event: "virtual_page_view", page_location, page_path, page_title }` once per **pathname** change." · "In GTM, the Google tag runs with `send_page_view: false`, and a GA4 `page_view` event tag fires on `virtual_page_view`." (§12.3)
- "`track()` … clears the previous parameters (`dataLayer.push({ event_params: null })`) and pushes `{ event, event_params }`; adds an `event_id` (`crypto.randomUUID()`) where deduplication needs one; never includes personal or health data." · "GA4 limits apply: event names of up to 40 characters, up to 25 parameters per event, parameter values of up to 100 characters." (§12.4)
- The event catalogue table in §12.4 (copied into `EVENT_CATALOGUE`, Task 1).
- "`fbq("set", "autoConfig", false, id)` runs before `init` … Automatic history-based PageView is disabled; `RouteTracker` sends PageView manually." (§12.4)
- CAPI: "On an accepted enquiry, inside `after()`, and **only if** CAPI is enabled **and** marketing consent was granted at event time. The client sends the consent flag, and the server re-checks the `mk_consent` cookie." · "`POST https://graph.facebook.com/v26.0/<pixelId>/events`" · payload: "`event_name: "Lead"`, and `event_time` in Unix seconds; the **same `event_id`** as the browser pixel; `action_source: "website"`; `event_source_url`, sanitised; `user_data`: `client_ip_address`, `client_user_agent`, `fbp` and `fbc` when present (these are never hashed), and `external_id` set to the SHA-256 of the lead id; **no email or phone hashes by default** …; **no `custom_data`**." · "An owner-only toggle adds normalised, hashed `em` and `ph`. It requires an explicit legal acknowledgement, which is stored in the audit log." · "Retries with backoff. Failures surface as an admin notification." · "The access token is encrypted at rest with AES-256-GCM (`APP_ENCRYPTION_KEY`). It is write-only in the UI ("configured ✓"), never returned to the browser and never logged." · ""Send test event" uses `test_event_code`." (§12.5)
- Custom code: "Only the owner can add them (2FA is mandatory for owners). Snippets are stored as **structured entries**, not raw HTML: `{ placement: "head" | "body", src (https, allowlisted host) | inline, consent category, routes[], enabled }`. They are injected with `next/script` … and never run in the admin. Every change is audited with a diff and can be rolled back. The env kill switch `DISABLE_CUSTOM_SCRIPTS=true` turns them all off at once. The UI warns that a snippet runs with full page privileges." (§12.6)
- CSP: "`script-src`: self, `www.googletagmanager.com`, `connect.facebook.net`, `challenges.cloudflare.com`, and the hosts allowlisted for custom code; `connect-src` and `img-src`: the Google measurement hosts (each Google TLD listed separately), Facebook, and the media host; `frame-src`: GTM and Turnstile; `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`. It ships first as **Report-Only**, then is enforced." (§12.6) · Headers: "HSTS; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy` (camera, microphone and geolocation off); `X-Frame-Options: SAMEORIGIN` …; CSP (§12.6); `X-Robots-Tag` on `/admin` and `/api`." (§15)
- §7.2: `tracking.read · update` → owner ✓, admin ✓, marketer ✓, everyone else —. `code.update (custom scripts)` → owner only.
- "Marketing | `GET|PUT /admin/tracking` · `POST /admin/tracking/test-capi` · `GET|PUT /admin/consent` · `GET|PUT /admin/scripts` (owner)" (§8.3) · "Marketing ▸ Tracking · Consent banner · Custom code" (§9.1) · "GTM, GA4 and Pixel IDs with format validation and status. Consent-banner editor with live preview. Custom code (owner only) with consent categories. CAPI test event. Event-catalogue reference" (§9.3)
- "`consent_events` | consent_id, analytics, marketing, revision, banner_hash, action (`accept` \| `reject` \| `custom` \| `withdraw`), created_at" (§6.6)

**New dependencies:** none. AES-256-GCM and SHA-256 come from `node:crypto`; the consent manager is our own (brief §12.2); `@next/third-parties` is rejected by the brief (§12.3).

**New environment variables (both optional; `server/env.ts`, Task 2):**

| Variable | Shape | Needed when | Dokploy impact |
| --- | --- | --- | --- |
| `APP_ENCRYPTION_KEY` | 32 random bytes, base64 (`openssl rand -base64 32`, 44 chars) | Only before saving a CAPI token. Without it the Tracking page explains why the token field is disabled; the site and enquiries keep working. | Add as a runtime secret before turning CAPI on. Rotating it makes the stored token unreadable: re-enter the token. Not required to deploy this phase. |
| `DISABLE_CUSTOM_SCRIPTS` | `true`/`false` (`z.stringbool()`), default `false` | Emergency kill switch for every custom snippet | None; set it only in an incident (restart picks it up). |

No build-arg changes: the CSP reads `MEDIA_PUBLIC_URL` at build, which Dokploy already passes as a build arg (see `next.config.ts` `mediaRemotePatterns`).

## Review Focus

1. **A returning visitor whose choice is stale or from an older banner revision.** Their cookie says `v: 1` but the owner raised the revision to 2, or the choice is 7 months old. GTM must not load, the Pixel must not load, CAPI must not send, and the banner must ask again. → Task 1 `consent.test.ts` "treats an old revision or an expired choice as no choice"; Task 3 `bootstrap.test.ts` "ignores a stale revision" (runs the real script); Task 6 `leads-capi.test.ts` "a stale cookie sends nothing to Meta".
2. **A malformed or tampered `mk_consent` cookie** (`%E0%A4%A`, `[1]`, `{"a":"yes"}`, 5 KB of junk). The bootstrap must not throw (the rest of the page's scripts keep running), the visitor is treated as undecided, and the server never treats it as consent. → Task 1 `consent.test.ts` "rejects malformed cookies"; Task 3 `bootstrap.test.ts` "survives a broken cookie".
3. **A condition-revealing URL.** A visitor lands on `/contact?topic=anxiety-stress`, reads `/insights/hypnosis-for-panic`, or opens `/newsletter/unsubscribe?token=…`, with full consent. Google sees only `https://site/contact`, `https://site/insights` and `https://site/newsletter` (page context and titles collapsed); Meta sees nothing from the article, the newsletter pages or any URL with a query; CAPI's `event_source_url` has no query. → Task 1 `sanitize.test.ts`; Task 3 `bootstrap.test.ts` "pushes a sanitised page"; Task 5 `track.test.ts` "sends no Meta event when the URL has a query or is an article"; Task 6 `meta-capi.test.ts` (acceptance unit test); Task 9 E2E "newsletter token never reaches the dataLayer".
4. **A hostile or sloppy ID.** A marketer types `gtm-abc 12` or `GTM-ABC";alert(1)//`, or someone hand-edits the settings row. The admin answers a field error; if bad data reaches the database anyway, the bootstrap drops the ID and `</script>` cannot break out of the inline script. → Task 2 `globals-tracking.test.ts` "rejects malformed IDs"; Task 3 `bootstrap.test.ts` "drops invalid IDs and escapes </script>".
5. **`APP_ENCRYPTION_KEY` missing or rotated.** Saving a token answers a clear 400 field error (not a 500); with a rotated key the stored token is reported as unreadable, enquiries still return 201 and CAPI is skipped without an unhandled rejection. → Task 7 `tracking-admin.test.ts` "explains a missing key" and "reports an unreadable token"; Task 6 `leads-capi.test.ts` "skips CAPI when the token cannot be decrypted".

## Rulings (decisions this plan takes; one line each in the hand-off)

| Ruling | Decision | Tasks |
| --- | --- | --- |
| R1 CSP strategy | Static allowlist policy in `next.config.ts` `headers()`, sent as `Content-Security-Policy-Report-Only` with `report-uri /api/v1/public/csp-report`. **No nonce**: `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` ("Static vs Dynamic Rendering with CSP") says nonces force every page into dynamic rendering and that "Partial Prerendering (PPR) is incompatible with nonce-based CSP"; its "Without Nonces" section is the pattern used. `script-src` therefore keeps `'unsafe-inline'` (Next's inline flight scripts and our bootstrap, whose content varies with settings, so a hash cannot be precomputed) and adds `'unsafe-eval'` only in development. Hosts: GTM, Google measurement (each listed), Meta, Turnstile (Phase 6 carry), the media host and `CUSTOM_SCRIPT_HOSTS`. Enforcement (dropping `-Report-Only`) is Phase 10 ("security headers and CSP", brief §18) after a week of clean reports. | 9 |
| R2 No request-time cookies in render | `SiteFrame` never calls `cookies()`. The inline bootstrap and the client components read `mk_consent` in the browser. The server reads the cookie only in the Hono lead and consent routes (`hono/cookie`). The static shell, the tag cache and parity are untouched. | 3, 4, 6 |
| R3 When tracking is active | `trackingFrame()` decides once per render: active ⇔ not draft preview **and** `consent.enabled` **and** (a valid, enabled GTM ID **or** Pixel ID **or** an enabled custom snippet whose category is not `necessary`). When inactive nothing renders: no bootstrap, no banner, no footer "Cookie settings" link (nothing to consent to). Draft preview (the admin's iframe) never tracks and never runs custom code. `necessary` snippets run whenever not previewing and not killed. | 3, 4, 8 |
| R4 Endpoints | `consent` and `scripts` are edited through the existing generic globals API (`GET|PUT /admin/globals/:key`, revisions, restore), with `GLOBAL_ACCESS.consent = tracking.read/update` and `GLOBAL_ACCESS.scripts = code.update/code.update`, instead of `/admin/consent` and `/admin/scripts` (§8.3 deviation, same shape as Phase 7 R10). That gives audit diffs and rollback for free. `tracking` keeps dedicated endpoints because its token is write-only. | 7, 8 |
| R5 GA4 through GTM | GA4 runs inside the GTM container. The bootstrap pushes `{ ga4_measurement_id }` into the dataLayer and the container's Google tag reads it, so marketers change the GA4 ID in the admin without republishing GTM. GA4 enabled without GTM shows the status "Needs GTM" and loads nothing. No direct `gtag.js` mode. | 3, 7, 9 |
| R6 Sanitised page context | The bootstrap pushes a persistent `page: { location, path, title, referrer }` (sanitised) before GTM can load; `RouteTracker` refreshes it on each pathname change. The container's Google tag and a shared event-settings variable override `page_location`, `page_title` and `page_referrer` from it, so GA4 never falls back to `document.location`. Titles of collapsed paths become "Insights" / "Newsletter" (an article title can name a condition just like its slug). | 1, 3, 5, 9 |
| R7 Meta Pixel | Loaded directly by `MarketingScripts` (not through GTM) with `autoConfig` off, `disablePushState = true`, manual PageView and `eventID`. It fires only when the current path is in `META_ROUTES` (`/`, `/about`, `/services`, `/how-it-works`, `/contact`, `/insights`) **and** the URL has no query or hash, because the Pixel sends `location.href` itself. Lead dedup still works when the browser event is suppressed (CAPI alone carries it). The container's Meta tags ship **paused**, marked "require additional consent", for teams that prefer GTM. **Open question for the user:** keep direct Pixel, or move it into GTM? | 1, 5, 9 |
| R8 Newsletter routes (Phase 6 carry) | `/newsletter/<state>` collapses to `/newsletter` in every vendor URL and title, is not on `META_ROUTES`, and never triggers CAPI. The token in the query never reaches the dataLayer. | 1, 5, 9 |
| R9 CAPI consent and identifiers | CAPI sends only when `tracking.enabled.capi`, a valid Pixel ID, a readable token, `consent.enabled`, a valid current-revision `mk_consent` with `m: 1` **and** the client's `marketingConsent: true`. `fbp`/`fbc` are read from the request's `_fbp`/`_fbc` cookies on the server (format-checked) rather than hidden form fields (§13): same data, nothing new in the form. The lead's `consent` snapshot and `marketing_consent` column record the cookie's truth. | 5, 6 |
| R10 CAPI failures | Three attempts (0 s, 1 s, 4 s) on network errors, 429 and 5xx; other 4xx stop at once. The final failure writes an audit row `tracking.capi_failed` (actor null, HTTP status only, never the token or payload) and the Tracking page shows the latest one under Status. A notification inbox does not exist yet: **CARRY Phase 11** (dashboard notifications) to surface it in the bell. | 6, 7 |
| R11 Token at rest | `encryptSecret(plain, "tracking.capiToken")` → `v1.<iv>.<tag>.<ciphertext>` (base64url, 12-byte IV, AAD = purpose). The `tracking` global is written by its own service: no revisions (a restore of ciphertext is meaningless), an audit diff that says `capiToken: "replaced" / "removed"`, never the value. | 2, 7 |
| R12 Enhanced matching | Only an owner may change it, and turning it on needs `acknowledge: true` in the same request; the audit row `tracking.enhanced_matching` records who acknowledged and when (`acknowledgedAt`, `acknowledgedBy` kept in the global). With it on, CAPI adds `em` (trimmed, lower-cased) and `ph` (E.164 digits) as SHA-256. | 6, 7 |
| R13 Re-consent interval | `consent.reconsentMonths` becomes `min 1, max 6, default 6` (brief §12.1 "at least every 6 months"; the Phase 3 default of 12 contradicted it). A month is 30 days, so 6 months equals the cookie's 180-day `Max-Age`. | 1, 2 |
| R14 Custom-code hosts | `CUSTOM_SCRIPT_HOSTS` in `lib/tracking/hosts.ts` is the single list the snippet validator and the CSP read (headers are computed at build, so the list cannot live in the database). It starts **empty**: only inline snippets are accepted until a developer adds a host. **Open question for the user:** which third-party hosts should be allowed from day one? | 2, 8, 9 |
| R15 Snippet placement | `placement: "head"` → `next/script` `strategy="afterInteractive"`; `"body"` → `strategy="lazyOnload"`. `beforeInteractive` is impossible for consent-gated code (it runs before anyone has chosen). A snippet runs once per document; navigating away does not undo it (UI says so). | 8 |
| R16 Consent proof | `POST /api/v1/public/consent` stores the client's `id`, `v`, `a`, `m` and action, plus a `banner_hash` the **server** computes (SHA-256 of the current banner copy) so it cannot be forged. Rate-limited per hashed IP; the IP itself is never stored. Answers 204. | 2 |
| R17 Withdrawal | Any save that removes a category previously granted is a `withdraw`: denied update, delete `_ga*`, `_gcl_*`, `_fbp`, `_fbc` on the host and every parent domain, write the new cookie, log, reload. Saves that only add categories load what is newly allowed without a reload. | 1, 4 |
| R18 Event ids | Every catalogue event except `share` carries an `event_id`. `generate_lead` reuses the id the contact form already sends with the lead (Phase 6 R16), which is the id CAPI sends. | 1, 5, 6 |
| R19 E2E isolation | Tracking specs switch the shared site settings on, so they run in their own Playwright invocation, `pnpm test:e2e:tracking` (`playwright.tracking.config.ts`: the base config's global setup reseeds the database, then the `setup` project and a single `tracking` project), never beside parity or the other public specs; the main config ignores `**/tracking/**`. CI runs it as an extra step after the main E2E step. The E2E seed leaves consent off (R3: nothing renders), so `pnpm test:parity` is unchanged; the parity spec also pre-sets a "reject" cookie as a guard. | 4, 9 |
| R20 Security headers | `next.config.ts` `headers()` adds HSTS (`max-age=31536000; includeSubDomains`, no preload), `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` (every path except `/admin/reset-password`, where proxy's `no-referrer` must win), `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Frame-Options: SAMEORIGIN`, and `X-Robots-Tag: noindex, nofollow` on `/api/:path*` (proxy already covers `/admin`). R2 media `nosniff` stays a Phase 11 deploy-doc carry (Phase 4). | 9 |
| R21 Plan file name | The phase map in `docs/plan.md` names `docs/plans/phase-08-marketing.md`; this plan is `docs/plans/phase-08-tracking.md` as requested. Task 9 updates the phase-map link. | 9 |

No new Server Actions: every write goes through Hono.

## File structure

| Files | Responsibility | Task |
| --- | --- | --- |
| `lib/tracking/{ids,consent,sanitize,events}.ts` (+ tests) | ID formats, `mk_consent` encode/decode/read, consent-mode maps, withdrawal targets, URL/title sanitiser, Meta route rule, event catalogue, `pushEvent` | 1 |
| `server/env.ts`, `server/env.test.ts`, `tests/test-env.mjs`, `tests/e2e/fixtures/env.ts`, `.env.example` (modify) | `APP_ENCRYPTION_KEY`, `DISABLE_CUSTOM_SCRIPTS` | 2 |
| `server/lib/secrets.ts` (+ test) | AES-256-GCM `encryptSecret` / `decryptSecret` / `secretsAvailable` | 2 |
| `lib/tracking/hosts.ts`, `lib/content/globals.ts` (modify), `lib/content/globals.test.ts` (modify), `server/db/seed/fixtures/consent.ts`, `server/db/seed/globals.ts` (modify) | reshaped `tracking`, `consent`, `scripts` globals; default banner copy (off) | 2 |
| `server/db/schema/consent.ts`, `server/db/schema/index.ts` (modify), `server/db/migrations/0009_tracking.sql` (generated) | `consent_events` | 2 |
| `server/modules/tracking/settings.ts`, `server/modules/consent/{service,public-routes}.ts`, `server/api/routes/public.ts` (modify) | uncached settings readers; `POST /public/consent` | 2 |
| `server/modules/tracking/public.ts`, `lib/tracking/{frame,bootstrap}.ts` (+ tests), `components/tracking/tracking-bootstrap.tsx`, `app/(site)/_cms/site-frame.tsx` (modify) | cached token-free projection, frame decision, inline bootstrap | 3 |
| `lib/tracking/consent-client.ts` (+ test), `components/consent/consent-banner-view.tsx` (+ test), `features/consent/components/consent-banner.tsx`, `features/footer/components/{site-footer,cookie-settings-button}.tsx`, `tests/e2e/parity/visual-parity.spec.ts` (modify) | banner, cookie writes, withdrawal, footer link, parity guard | 4 |
| `lib/tracking/{track,pixel,clicks}.ts` (+ tests), `features/tracking/components/{route-tracker,click-tracker,marketing-scripts}.tsx`, `features/contact/components/contact-form.tsx`, `features/contact/lib/track.ts` (delete), `lib/leads/schema.ts`, `features/insights/components/{newsletter-band,share-links}.tsx`, CTA files (attributes only) | client tracking, Pixel, instrumentation | 5 |
| `server/lib/meta-capi.ts` (+ test), `server/modules/tracking/capi.ts`, `server/modules/leads/{submit,public-routes}.ts` (modify) | CAPI builder, sender, consent re-check | 6 |
| `server/modules/tracking/{schema,service,routes}.ts`, `server/api/routes/admin.ts`, `lib/content/global-access.ts`, `admin/lib/{api,query-keys}.ts`, `admin/modules/globals/global-editor.tsx`, `admin/modules/marketing/*`, `app/(admin)/admin/(panel)/marketing/{page,consent/page,events/page}.tsx`, `lib/admin/nav.ts`, `lib/tracking/banner-preview.ts` (+ test) | tracking API and screens, consent editor + live preview, event catalogue | 7 |
| `lib/tracking/routes-match.ts` (+ test), `features/tracking/components/custom-scripts.tsx` (+ test), `admin/modules/marketing/code-view.tsx`, `app/(admin)/admin/(panel)/marketing/code/page.tsx`, `admin/modules/globals/global-ui.ts` | custom code manager + injection | 8 |
| `lib/tracking/csp.ts` (+ test), `next.config.ts`, `server/modules/consent/csp-report.ts`, `docs/gtm-container.json`, `tests/tracking/gtm-container.test.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`, `tests/e2e/tracking/*.spec.ts`, `tests/e2e/support/tracking.ts`, `docs/deploy-dokploy.md`, `docs/plan.md` (phase-map link), `.superpowers/sdd/plan/progress.md` | headers, CSP, container, acceptance, docs, exit | 9 |

## Conventions for executing this plan

- Where a step gives a component as a spec (props, behaviour, labels) rather than code, the quoted labels are load-bearing: tests and E2E specs select by them.
- Next-specific APIs used here were checked in `node_modules/next/dist/docs/` (see "Self-check" at the end). Re-read the cited doc before changing how any of them is used.
- Run `pnpm db:up` first. Task 2 generates the one migration with `pnpm db:generate --name tracking`; commit the SQL, snapshot and journal.
- `SiteFrame` already awaits `io()` before reading settings; keep every new cached read after it. The build has no database: `DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build` must pass after Tasks 3, 4, 5, 8 and 9.
- Client modules in `lib/tracking/` that touch `window` or `document` take them as parameters where a test needs to substitute them, and never run at import time.
- Commit messages: Conventional Commits, written normally, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Integration-test conventions (every API task)

- `invalidate()` calls `revalidateTag`; `"use cache"` helpers call `cacheTag`/`cacheLife`. Mock all three per file, keeping the rest of `next/cache`, as `tests/integration/api/redirects-admin.test.ts` does.
- `defer()` calls `after()`. Mock it per file and drain the queue before asserting on anything deferred:

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

- Admin requests: `adminRequest(path, cookie, { method, body })` with `cookieFor(role)` (`tests/integration/helpers/auth.ts`). Public requests: `publicRequest(path, { method, body, ip })` (`tests/integration/helpers/leads.ts`); Task 2 adds an optional `cookie` to it.
- Outbound calls to Meta are intercepted with `vi.spyOn(globalThis, "fetch")`; Hono's `app.request()` does not use the global `fetch`, so only CAPI calls hit the spy. Restore it in `afterEach`.

---

### Task 1: Tracking core — ID formats, the consent cookie, the URL sanitiser, the event catalogue

**Model tier:** sonnet (pure functions with full test code).

**Files:**
- Create: `lib/tracking/ids.ts`, `lib/tracking/consent.ts`, `lib/tracking/sanitize.ts`, `lib/tracking/events.ts`
- Test: `lib/tracking/ids.test.ts`, `lib/tracking/consent.test.ts`, `lib/tracking/sanitize.test.ts`, `lib/tracking/events.test.ts`

**Interfaces:**
- Consumes: nothing (isomorphic, no imports from `server/**`).
- Produces:
  - `GTM_ID`, `GA4_ID`, `PIXEL_ID` (RegExp); `validId(pattern: RegExp, value: string | null | undefined): string | null`.
  - `CONSENT_COOKIE = "mk_consent"`, `CONSENT_MAX_AGE = 15_552_000` (180 days, seconds), `DAY_MS`.
  - `type ConsentChoice = { analytics: boolean; marketing: boolean }`; `type ConsentCookie = { id: string; v: number; ts: number; a: 0 | 1; m: 0 | 1 }`; `type ConsentPolicy = { version: number; months: number }`; `type ConsentAction = "accept" | "reject" | "custom" | "withdraw"`.
  - `encodeConsent(c: ConsentCookie): string`, `decodeConsent(raw: string | null | undefined): ConsentCookie | null`, `readConsent(raw, policy: ConsentPolicy, nowMs: number): ConsentChoice | null`, `cookieValue(header: string | null | undefined, name: string): string | undefined`.
  - `CONSENT_DEFAULTS` (Consent Mode v2 defaults object), `consentModeUpdate(choice: ConsentChoice): Record<"analytics_storage" | "ad_storage" | "ad_user_data" | "ad_personalization", "granted" | "denied">`.
  - `actionFor(previous: ConsentChoice | null, next: ConsentChoice, kind: "accept" | "reject" | "custom"): ConsentAction`.
  - `isTrackingCookie(name: string): boolean`, `cookieDomains(hostname: string): string[]`.
  - `COLLAPSE: readonly (readonly [prefix: string, path: string, title: string])[]`, `sanitizePath(pathname: string): string`, `sanitizeUrl(href: string, base?: string): string`, `pageTitle(pathname: string, title: string): string`, `META_ROUTES`, `metaAllowed(loc: { pathname: string; search: string; hash: string }): boolean`.
  - `type TrackEvent` (discriminated union), `EVENT_CATALOGUE`, `META_EVENT`, `pushEvent(dataLayer: unknown[], e: TrackEvent, newId: () => string): { eventId: string | undefined }`.

- [ ] **Step 1: Write the failing tests**

`lib/tracking/ids.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { GA4_ID, GTM_ID, PIXEL_ID, validId } from "./ids"

describe("tracking IDs (brief §12.3)", () => {
  it("accepts the documented formats", () => {
    expect(validId(GTM_ID, "GTM-AB12CD3")).toBe("GTM-AB12CD3")
    expect(validId(GA4_ID, "G-ABC123XYZ")).toBe("G-ABC123XYZ")
    expect(validId(PIXEL_ID, "1234567890123456")).toBe("1234567890123456")
  })
  it.each([
    [GTM_ID, "gtm-ab12"],
    [GTM_ID, "GTM-AB 12"],
    [GTM_ID, 'GTM-ABC";alert(1)//'],
    [GA4_ID, "UA-1234-1"],
    [PIXEL_ID, "123456789"],
    [PIXEL_ID, "123456789012345678901"],
    [GTM_ID, ""],
    [GTM_ID, null],
  ])("rejects %s %j", (pattern, value) => {
    expect(validId(pattern, value)).toBeNull()
  })
})
```

`lib/tracking/consent.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  actionFor,
  CONSENT_DEFAULTS,
  consentModeUpdate,
  cookieDomains,
  cookieValue,
  DAY_MS,
  decodeConsent,
  encodeConsent,
  isTrackingCookie,
  readConsent,
} from "./consent"

const NOW = Date.UTC(2026, 9, 10, 12)
const ID = "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc"
const cookie = (over: Record<string, unknown> = {}) =>
  encodeConsent({
    id: ID,
    v: 2,
    ts: Math.floor(NOW / 1000) - 60,
    a: 1,
    m: 0,
    ...over,
  } as never)
const policy = { version: 2, months: 6 }

describe("mk_consent", () => {
  it("round-trips and reads the stored choice", () => {
    expect(decodeConsent(cookie())).toMatchObject({ id: ID, v: 2, a: 1, m: 0 })
    expect(readConsent(cookie(), policy, NOW)).toEqual({
      analytics: true,
      marketing: false,
    })
  })

  it("treats an old revision or an expired choice as no choice", () => {
    expect(readConsent(cookie({ v: 1 }), policy, NOW)).toBeNull()
    const old = Math.floor((NOW - 181 * DAY_MS) / 1000)
    expect(readConsent(cookie({ ts: old }), policy, NOW)).toBeNull()
    const edge = Math.floor((NOW - 179 * DAY_MS) / 1000)
    expect(readConsent(cookie({ ts: edge }), policy, NOW)).not.toBeNull()
    // A shorter interval set by the owner applies at once.
    const twoMonths = Math.floor((NOW - 61 * DAY_MS) / 1000)
    expect(
      readConsent(cookie({ ts: twoMonths }), { version: 2, months: 2 }, NOW)
    ).toBeNull()
  })

  it("rejects a choice dated in the future (beyond clock skew)", () => {
    const future = Math.floor((NOW + DAY_MS) / 1000)
    expect(readConsent(cookie({ ts: future }), policy, NOW)).toBeNull()
  })

  it.each([
    "%E0%A4%A",
    encodeURIComponent("[1]"),
    encodeURIComponent('{"id":"x","v":2,"ts":1,"a":"yes","m":0}'),
    encodeURIComponent('{"v":2,"ts":1,"a":1,"m":0}'),
    "x".repeat(5000),
    "",
  ])("rejects malformed cookies (%#)", (raw) => {
    expect(decodeConsent(raw)).toBeNull()
    expect(readConsent(raw, policy, NOW)).toBeNull()
  })

  it("finds a cookie in a Cookie header", () => {
    const header = `a=1; mk_consent=${cookie()}; _fbp=fb.1.2.3`
    expect(cookieValue(header, "mk_consent")).toBe(cookie())
    expect(cookieValue(header, "_fbp")).toBe("fb.1.2.3")
    expect(cookieValue(header, "missing")).toBeUndefined()
    expect(cookieValue(null, "mk_consent")).toBeUndefined()
  })
})

describe("Consent Mode v2", () => {
  it("denies everything by default except security storage", () => {
    expect(CONSENT_DEFAULTS).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      functionality_storage: "denied",
      personalization_storage: "denied",
      security_storage: "granted",
      wait_for_update: 500,
    })
  })
  it("maps categories to consent types (brief §12.2)", () => {
    expect(consentModeUpdate({ analytics: true, marketing: false })).toEqual({
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    })
    expect(consentModeUpdate({ analytics: false, marketing: true })).toEqual({
      analytics_storage: "denied",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    })
  })
})

describe("actionFor", () => {
  const none = { analytics: false, marketing: false }
  const all = { analytics: true, marketing: true }
  it("names first choices by the button used", () => {
    expect(actionFor(null, all, "accept")).toBe("accept")
    expect(actionFor(null, none, "reject")).toBe("reject")
    expect(actionFor(null, { analytics: true, marketing: false }, "custom")).toBe(
      "custom"
    )
  })
  it("calls any removal of a granted category a withdrawal", () => {
    expect(actionFor(all, { analytics: true, marketing: false }, "custom")).toBe(
      "withdraw"
    )
    expect(actionFor(all, none, "reject")).toBe("withdraw")
    expect(actionFor(none, all, "accept")).toBe("accept")
  })
})

describe("withdrawal targets", () => {
  it.each(["_ga", "_ga_ABC123", "_gcl_au", "_gcl_aw", "_fbp", "_fbc"])(
    "%s is a tracking cookie",
    (name) => expect(isTrackingCookie(name)).toBe(true)
  )
  it.each(["mk_consent", "mk.session_token", "_gat_custom", "fbp", "__ga"])(
    "%s is not",
    (name) => expect(isTrackingCookie(name)).toBe(false)
  )
  it("lists the host and every parent domain with two or more labels", () => {
    expect(cookieDomains("www.magdakennedy.ie")).toEqual([
      "www.magdakennedy.ie",
      ".www.magdakennedy.ie",
      ".magdakennedy.ie",
    ])
    expect(cookieDomains("localhost")).toEqual(["localhost"])
  })
})
```

`lib/tracking/sanitize.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  META_ROUTES,
  metaAllowed,
  pageTitle,
  sanitizePath,
  sanitizeUrl,
} from "./sanitize"

const SITE = "https://magdakennedy.ie"

describe("sanitizeUrl (brief §12.1)", () => {
  it.each([
    ["/contact?topic=anxiety-stress", `${SITE}/contact`],
    ["/contact#form", `${SITE}/contact`],
    ["/insights/hypnosis-for-panic-attacks", `${SITE}/insights`],
    ["/insights/hypnosis-for-panic-attacks/", `${SITE}/insights`],
    ["/insights?q=anxiety&category=sleep", `${SITE}/insights`],
    ["/newsletter/unsubscribe?token=abc.def", `${SITE}/newsletter`],
    ["/newsletter/confirmed", `${SITE}/newsletter`],
    ["/", `${SITE}/`],
    [`${SITE}/about?utm_source=x`, `${SITE}/about`],
    ["https://www.google.com/search?q=hypnotherapy+anxiety", "https://www.google.com/search"],
  ])("%s → %s", (input, expected) => {
    expect(sanitizeUrl(input, SITE)).toBe(expected)
  })

  it("returns an empty string for something that is not a URL", () => {
    expect(sanitizeUrl("http://[::1", SITE)).toBe("")
    expect(sanitizeUrl("", SITE)).toBe("")
  })

  it("collapses paths without a base too", () => {
    expect(sanitizePath("/insights/some-slug")).toBe("/insights")
    expect(sanitizePath("/insights")).toBe("/insights")
    expect(sanitizePath("/services")).toBe("/services")
  })
})

describe("pageTitle", () => {
  it("replaces titles of collapsed paths", () => {
    expect(pageTitle("/insights/hypnosis-for-panic", "Hypnosis for panic | MK")).toBe(
      "Insights"
    )
    expect(pageTitle("/newsletter/unsubscribe", "Unsubscribe | MK")).toBe(
      "Newsletter"
    )
    expect(pageTitle("/about", "About | MK")).toBe("About | MK")
  })
})

describe("metaAllowed (Ruling R7)", () => {
  const at = (pathname: string, search = "", hash = "") => ({
    pathname,
    search,
    hash,
  })
  it.each(META_ROUTES)("allows %s with a clean URL", (path) => {
    expect(metaAllowed(at(path))).toBe(true)
  })
  it("refuses articles, newsletter pages and anything with a query or hash", () => {
    expect(metaAllowed(at("/insights/hypnosis-for-panic"))).toBe(false)
    expect(metaAllowed(at("/newsletter/unsubscribe", "?token=a"))).toBe(false)
    expect(metaAllowed(at("/contact", "?topic=anxiety-stress"))).toBe(false)
    expect(metaAllowed(at("/contact", "", "#form"))).toBe(false)
    expect(metaAllowed(at("/privacy"))).toBe(false)
  })
})
```

`lib/tracking/events.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { EVENT_CATALOGUE, META_EVENT, pushEvent } from "./events"

const ids = () => {
  let n = 0
  return () => `id-${++n}`
}

describe("pushEvent (brief §12.4)", () => {
  it("clears the previous params, then pushes the event with an id", () => {
    const dl: unknown[] = []
    const { eventId } = pushEvent(
      dl,
      { event: "contact_click", params: { method: "phone" } },
      ids()
    )
    expect(eventId).toBe("id-1")
    expect(dl).toEqual([
      { event_params: null },
      {
        event: "contact_click",
        event_params: { method: "phone", event_id: "id-1" },
      },
    ])
  })

  it("reuses the lead's own event id for generate_lead (Ruling R18)", () => {
    const dl: unknown[] = []
    const { eventId } = pushEvent(
      dl,
      {
        event: "generate_lead",
        params: { lead_source: "contact_form", form_id: "contact" },
        eventId: "lead-event",
      },
      ids()
    )
    expect(eventId).toBe("lead-event")
    expect(dl[1]).toEqual({
      event: "generate_lead",
      event_params: {
        lead_source: "contact_form",
        form_id: "contact",
        event_id: "lead-event",
      },
    })
  })

  it("gives share no id and caps values at 100 characters", () => {
    const dl: unknown[] = []
    const { eventId } = pushEvent(
      dl,
      {
        event: "share",
        params: { method: "x".repeat(150), content_type: "article" },
      },
      ids()
    )
    expect(eventId).toBeUndefined()
    const pushed = dl[1] as { event_params: Record<string, string> }
    expect(pushed.event_params.method).toHaveLength(100)
    expect(pushed.event_params).not.toHaveProperty("event_id")
  })
})

describe("EVENT_CATALOGUE", () => {
  it("lists every event with GA4-safe names", () => {
    expect(EVENT_CATALOGUE.map((e) => e.event)).toEqual([
      "virtual_page_view",
      "generate_lead",
      "contact_click",
      "book_appointment",
      "sign_up",
      "share",
    ])
    for (const e of EVENT_CATALOGUE) expect(e.event.length).toBeLessThanOrEqual(40)
  })
  it("maps to Meta standard events only", () => {
    expect(META_EVENT).toEqual({
      virtual_page_view: "PageView",
      generate_lead: "Lead",
      contact_click: "Contact",
      book_appointment: "Schedule",
      sign_up: "CompleteRegistration",
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project unit lib/tracking`
Expected: FAIL (`Cannot find module './ids'` and the other three).

- [ ] **Step 3: Write the implementation**

`lib/tracking/ids.ts`:

```ts
// docs/brief.md §12.3. Anything else never reaches a page.
export const GTM_ID = /^GTM-[A-Z0-9]+$/
export const GA4_ID = /^G-[A-Z0-9]+$/
export const PIXEL_ID = /^\d{10,20}$/

export function validId(
  pattern: RegExp,
  value: string | null | undefined
): string | null {
  return value && pattern.test(value) ? value : null
}
```

`lib/tracking/consent.ts`:

```ts
// The consent cookie and its rules (docs/brief.md §12.2). Isomorphic: the
// banner, the Hono routes and (as a copy in lib/tracking/bootstrap.ts, kept
// honest by bootstrap.test.ts) the inline bootstrap all follow it.
export const CONSENT_COOKIE = "mk_consent"
export const DAY_MS = 86_400_000
export const CONSENT_MAX_AGE = 180 * 86_400 // seconds (Ruling R13)
const SKEW_MS = 5 * 60_000
const MAX_RAW = 300

export type ConsentChoice = { analytics: boolean; marketing: boolean }
export type ConsentCookie = {
  id: string
  v: number
  ts: number
  a: 0 | 1
  m: 0 | 1
}
export type ConsentPolicy = { version: number; months: number }
export type ConsentAction = "accept" | "reject" | "custom" | "withdraw"

const bit = (value: unknown): value is 0 | 1 => value === 0 || value === 1

export const encodeConsent = (c: ConsentCookie) =>
  encodeURIComponent(JSON.stringify(c))

export function decodeConsent(
  raw: string | null | undefined
): ConsentCookie | null {
  if (!raw || raw.length > MAX_RAW) return null
  try {
    const v: unknown = JSON.parse(decodeURIComponent(raw))
    if (!v || typeof v !== "object" || Array.isArray(v)) return null
    const c = v as Record<string, unknown>
    if (typeof c.id !== "string" || c.id.length < 1 || c.id.length > 64)
      return null
    if (!Number.isInteger(c.v) || !Number.isInteger(c.ts)) return null
    if (!bit(c.a) || !bit(c.m)) return null
    return { id: c.id, v: c.v as number, ts: c.ts as number, a: c.a, m: c.m }
  } catch {
    return null
  }
}

// A month is 30 days, so the 6-month maximum equals the cookie's Max-Age.
export function readConsent(
  raw: string | null | undefined,
  policy: ConsentPolicy,
  nowMs: number
): ConsentChoice | null {
  const c = decodeConsent(raw)
  if (!c || c.v !== policy.version) return null
  const age = nowMs - c.ts * 1000
  if (age < -SKEW_MS || age > policy.months * 30 * DAY_MS) return null
  return { analytics: c.a === 1, marketing: c.m === 1 }
}

export function cookieValue(
  header: string | null | undefined,
  name: string
): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const at = part.indexOf("=")
    if (at > 0 && part.slice(0, at).trim() === name)
      return part.slice(at + 1).trim()
  }
  return undefined
}

export const CONSENT_DEFAULTS = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
  security_storage: "granted",
  wait_for_update: 500,
} as const

const state = (on: boolean) => (on ? "granted" : "denied")
export function consentModeUpdate(choice: ConsentChoice) {
  return {
    analytics_storage: state(choice.analytics),
    ad_storage: state(choice.marketing),
    ad_user_data: state(choice.marketing),
    ad_personalization: state(choice.marketing),
  } as const
}

// Ruling R17: taking back anything already granted is a withdrawal.
export function actionFor(
  previous: ConsentChoice | null,
  next: ConsentChoice,
  kind: "accept" | "reject" | "custom"
): ConsentAction {
  const removed =
    (previous?.analytics && !next.analytics) ||
    (previous?.marketing && !next.marketing)
  return removed ? "withdraw" : kind
}

const TRACKING_COOKIES = [/^_ga(_|$)/, /^_gcl_/, /^_fbp$/, /^_fbc$/]
export const isTrackingCookie = (name: string) =>
  TRACKING_COOKIES.some((re) => re.test(name))

// GA and Meta write their cookies on the registrable domain; deleting needs
// the exact Domain, so try the host and each parent with two or more labels.
export function cookieDomains(hostname: string): string[] {
  const labels = hostname.split(".")
  if (labels.length < 2) return [hostname]
  const out = [hostname]
  for (let i = 0; i <= labels.length - 2; i++)
    out.push(`.${labels.slice(i).join(".")}`)
  return out
}
```

`lib/tracking/sanitize.ts`:

```ts
// Vendor-facing URLs and titles (docs/brief.md §12.1, Rulings R6–R8).
// [prefix, collapsed path, collapsed title]. Also embedded in the inline
// bootstrap (lib/tracking/bootstrap.ts), so keep it plain data.
export const COLLAPSE = [
  ["/insights/", "/insights", "Insights"],
  ["/newsletter/", "/newsletter", "Newsletter"],
] as const

export function sanitizePath(pathname: string): string {
  for (const [prefix, path] of COLLAPSE) {
    if (pathname.startsWith(prefix)) return path
  }
  return pathname
}

export function sanitizeUrl(href: string, base?: string): string {
  if (!href) return ""
  try {
    const url = new URL(href, base)
    return url.origin + sanitizePath(url.pathname)
  } catch {
    return ""
  }
}

export function pageTitle(pathname: string, title: string): string {
  for (const [prefix, , label] of COLLAPSE) {
    if (pathname.startsWith(prefix)) return label
  }
  return title
}

// Ruling R7: the Pixel sends location.href itself, so it only runs where the
// whole URL is neutral.
export const META_ROUTES = [
  "/",
  "/about",
  "/services",
  "/how-it-works",
  "/contact",
  "/insights",
] as const

export function metaAllowed(loc: {
  pathname: string
  search: string
  hash: string
}): boolean {
  return (
    !loc.search &&
    !loc.hash &&
    (META_ROUTES as readonly string[]).includes(loc.pathname)
  )
}
```

`lib/tracking/events.ts`:

```ts
// The typed dataLayer (docs/brief.md §12.4). Pushing is always allowed; GTM
// gates tags by consent. Never put personal or health data in params.
export type TrackEvent =
  | {
      event: "virtual_page_view"
      params: { page_location: string; page_path: string; page_title: string }
    }
  | {
      event: "generate_lead"
      params: { lead_source: "contact_form"; form_id: string }
      eventId: string
    }
  | { event: "contact_click"; params: { method: "phone" | "email" } }
  | { event: "book_appointment"; params: { cta_location: string } }
  | { event: "sign_up"; params: { method: "newsletter" } }
  | { event: "share"; params: { method: string; content_type: "article" } }

export type TrackEventName = TrackEvent["event"]

export const EVENT_CATALOGUE = [
  {
    event: "virtual_page_view",
    firesWhen: "each pathname change",
    params: ["page_location", "page_path", "page_title"],
    ga4: "page_view",
    meta: "PageView (allowlisted routes)",
  },
  {
    event: "generate_lead",
    firesWhen: "the API accepted the enquiry",
    params: ["lead_source", "form_id", "event_id"],
    ga4: "generate_lead (key event)",
    meta: "Lead, deduplicated with CAPI via event_id",
  },
  {
    event: "contact_click",
    firesWhen: "phone or email links",
    params: ["method", "event_id"],
    ga4: "custom",
    meta: "Contact",
  },
  {
    event: "book_appointment",
    firesWhen: '"Book a discovery call" CTAs',
    params: ["cta_location", "event_id"],
    ga4: "custom",
    meta: "Schedule",
  },
  {
    event: "sign_up",
    firesWhen: "newsletter double opt-in requested",
    params: ["method", "event_id"],
    ga4: "sign_up",
    meta: "CompleteRegistration",
  },
  {
    event: "share",
    firesWhen: "share link or copy",
    params: ["method", "content_type"],
    ga4: "share",
    meta: "—",
  },
] as const satisfies readonly {
  event: TrackEventName
  firesWhen: string
  params: readonly string[]
  ga4: string
  meta: string
}[]

export const META_EVENT: Partial<Record<TrackEventName, string>> = {
  virtual_page_view: "PageView",
  generate_lead: "Lead",
  contact_click: "Contact",
  book_appointment: "Schedule",
  sign_up: "CompleteRegistration",
}

const MAX_VALUE = 100
const cap = (params: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, v.slice(0, MAX_VALUE)])
  )

export function pushEvent(
  dataLayer: unknown[],
  e: TrackEvent,
  newId: () => string
): { eventId: string | undefined } {
  const eventId =
    e.event === "share"
      ? undefined
      : e.event === "generate_lead"
        ? e.eventId
        : newId()
  dataLayer.push({ event_params: null })
  dataLayer.push({
    event: e.event,
    event_params: {
      ...cap(e.params as Record<string, string>),
      ...(eventId ? { event_id: eventId } : {}),
    },
  })
  return { eventId }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit lib/tracking`
Expected: PASS (4 files).

- [ ] **Step 5: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add lib/tracking
git commit -m "feat(tracking): consent cookie, id formats, url sanitiser and event catalogue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Settings shapes, secrets and the consent log — env, AES-256-GCM, globals, `consent_events`, `POST /public/consent`

**Model tier:** sonnet (follows existing env/globals/route patterns).

**Files:**
- Create: `server/lib/secrets.ts`, `lib/tracking/hosts.ts`, `server/db/schema/consent.ts`, `server/db/seed/fixtures/consent.ts`, `server/modules/tracking/settings.ts`, `server/modules/consent/service.ts`, `server/modules/consent/public-routes.ts`
- Modify: `server/env.ts`, `server/env.test.ts`, `tests/test-env.mjs`, `tests/e2e/fixtures/env.ts`, `.env.example`, `lib/content/globals.ts`, `lib/content/globals.test.ts`, `server/db/schema/index.ts`, `server/db/seed/globals.ts`, `server/api/routes/public.ts`, `tests/integration/helpers/leads.ts`
- Generated: `server/db/migrations/0009_tracking.sql`, `server/db/migrations/meta/*`
- Test: `server/lib/secrets.test.ts`, `server/env.test.ts`, `lib/content/globals-tracking.test.ts`, `tests/integration/api/consent.test.ts`

**Interfaces:**
- Consumes (Task 1): `GTM_ID`, `GA4_ID`, `PIXEL_ID`, `ConsentAction`.
- Produces:
  - `getEnv().APP_ENCRYPTION_KEY?: string`, `getEnv().DISABLE_CUSTOM_SCRIPTS: boolean`.
  - `secretsAvailable(): boolean`, `encryptSecret(plain: string, purpose: string): string` (throws `SecretKeyMissingError` without a key), `decryptSecret(payload: string, purpose: string): string | null` (null on a missing key, a wrong key or tampering), `CAPI_TOKEN_PURPOSE = "tracking.capiToken"`.
  - `CUSTOM_SCRIPT_HOSTS: readonly string[]` (empty).
  - Reshaped globals: `GlobalValue<"tracking">` = `{ gtmId; ga4Id; metaPixelId; capiTokenEncrypted: string | null; testEventCode; enabled: { gtm; ga4; meta; capi }; enhancedMatching: { enabled: boolean; acknowledgedAt: string | null; acknowledgedBy: string | null } }`; `GlobalValue<"consent">` = `{ enabled; title; body; accept; reject; customise; save; settingsLink; policyLabel; policyHref; categories: { necessary; analytics; marketing }; reconsentMonths (1–6, default 6); version (≥ 1) }`; `GlobalValue<"scripts">` = `{ snippets: ScriptSnippet[] }` with `ScriptSnippet = { name; placement: "head" | "body"; src: string; inline: string; category: "necessary" | "analytics" | "marketing"; routes: string[]; enabled: boolean }`. `SCRIPT_CATEGORIES`.
  - `consentEvents` table.
  - `readTrackingSettings(): Promise<GlobalValue<"tracking">>`, `readConsentSettings(): Promise<GlobalValue<"consent">>` (uncached, `server/modules/tracking/settings.ts`).
  - `bannerHash(consent: GlobalValue<"consent">): string`, `recordConsent(body: unknown): Promise<void>`, `CONSENT_LIMIT`.
  - `POST /api/v1/public/consent` → 204.
  - `publicRequest(path, { method, body, ip, cookie })` (test helper gains `cookie`).

- [ ] **Step 1: Write the failing tests**

`server/lib/secrets.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest"

import { resetEnvForTests } from "@/server/env"

import {
  decryptSecret,
  encryptSecret,
  SecretKeyMissingError,
  secretsAvailable,
} from "./secrets"

const KEY_A = Buffer.alloc(32, 1).toString("base64")
const KEY_B = Buffer.alloc(32, 2).toString("base64")
const use = (key: string | undefined) => {
  if (key) process.env.APP_ENCRYPTION_KEY = key
  else delete process.env.APP_ENCRYPTION_KEY
  resetEnvForTests()
}
afterEach(() => use(Buffer.alloc(32, 7).toString("base64")))

describe("secrets (AES-256-GCM, Ruling R11)", () => {
  it("round-trips and never contains the plaintext", () => {
    use(KEY_A)
    const sealed = encryptSecret("EAAB-secret-token", "tracking.capiToken")
    expect(sealed).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/)
    expect(sealed).not.toContain("secret")
    expect(decryptSecret(sealed, "tracking.capiToken")).toBe("EAAB-secret-token")
  })
  it("uses a fresh IV every time", () => {
    use(KEY_A)
    expect(encryptSecret("x", "p")).not.toBe(encryptSecret("x", "p"))
  })
  it("returns null for a wrong key, a wrong purpose or tampering", () => {
    use(KEY_A)
    const sealed = encryptSecret("token", "tracking.capiToken")
    expect(decryptSecret(sealed, "other")).toBeNull()
    const parts = sealed.split(".")
    parts[3] = parts[3]!.slice(0, -2) + (parts[3]!.endsWith("A") ? "BB" : "AA")
    expect(decryptSecret(parts.join("."), "tracking.capiToken")).toBeNull()
    expect(decryptSecret("garbage", "tracking.capiToken")).toBeNull()
    use(KEY_B)
    expect(decryptSecret(sealed, "tracking.capiToken")).toBeNull()
  })
  it("refuses to encrypt without a key, and says so", () => {
    use(undefined)
    expect(secretsAvailable()).toBe(false)
    expect(() => encryptSecret("x", "p")).toThrow(SecretKeyMissingError)
    expect(decryptSecret("v1.a.b.c", "p")).toBeNull()
  })
})
```

Add to `server/env.test.ts` (inside its existing `describe`, using its existing helpers for setting `process.env` and calling `getEnv()`; follow the file's pattern for a failing parse):

```ts
it("accepts a 32-byte base64 APP_ENCRYPTION_KEY and rejects anything else", () => {
  // valid
  process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64")
  resetEnvForTests()
  expect(getEnv().APP_ENCRYPTION_KEY).toHaveLength(44)
  // 16 bytes
  process.env.APP_ENCRYPTION_KEY = Buffer.alloc(16, 3).toString("base64")
  resetEnvForTests()
  expect(() => getEnv()).toThrow(/APP_ENCRYPTION_KEY/)
})

it("APP_ENCRYPTION_KEY is optional, even in production", () => {
  delete process.env.APP_ENCRYPTION_KEY
  resetEnvForTests()
  expect(getEnv().APP_ENCRYPTION_KEY).toBeUndefined()
})

it("reads DISABLE_CUSTOM_SCRIPTS as a boolean, default false", () => {
  delete process.env.DISABLE_CUSTOM_SCRIPTS
  resetEnvForTests()
  expect(getEnv().DISABLE_CUSTOM_SCRIPTS).toBe(false)
  process.env.DISABLE_CUSTOM_SCRIPTS = "true"
  resetEnvForTests()
  expect(getEnv().DISABLE_CUSTOM_SCRIPTS).toBe(true)
})
```

(Each case restores the variables it changes in the file's existing `afterEach`; add `APP_ENCRYPTION_KEY` and `DISABLE_CUSTOM_SCRIPTS` to whatever list it restores.)

`lib/content/globals-tracking.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { ConsentGlobal, ScriptsGlobal, TrackingGlobal } from "./globals"

describe("tracking global", () => {
  it("defaults to everything off", () => {
    expect(TrackingGlobal.parse({})).toEqual({
      gtmId: "",
      ga4Id: "",
      metaPixelId: "",
      capiTokenEncrypted: null,
      testEventCode: "",
      enabled: { gtm: false, ga4: false, meta: false, capi: false },
      enhancedMatching: {
        enabled: false,
        acknowledgedAt: null,
        acknowledgedBy: null,
      },
    })
  })
  it("rejects malformed IDs with a readable message", () => {
    const r = TrackingGlobal.safeParse({
      gtmId: 'GTM-ABC";alert(1)//',
      ga4Id: "UA-1-1",
      metaPixelId: "12",
    })
    expect(r.success).toBe(false)
    const paths = r.error!.issues.map((i) => i.path.join("."))
    expect(paths).toEqual(["gtmId", "ga4Id", "metaPixelId"])
    expect(r.error!.issues[0]!.message).toBe("Use the GTM-XXXXXXX format")
  })
})

describe("consent global (Ruling R13)", () => {
  it("re-prompts every 6 months by default, never less often", () => {
    expect(ConsentGlobal.parse({}).reconsentMonths).toBe(6)
    expect(ConsentGlobal.safeParse({ reconsentMonths: 12 }).success).toBe(false)
  })
  it("refuses to switch on a banner with missing labels", () => {
    const r = ConsentGlobal.safeParse({ enabled: true, title: "Cookies" })
    expect(r.success).toBe(false)
    expect(r.error!.issues.map((i) => i.path[0])).toEqual([
      "body",
      "accept",
      "reject",
      "customise",
      "save",
      "settingsLink",
    ])
    expect(ConsentGlobal.safeParse({ enabled: false }).success).toBe(true)
  })
})

describe("scripts global (brief §12.6)", () => {
  const base = {
    name: "Chat",
    placement: "body",
    category: "marketing",
    routes: [],
    enabled: true,
  }
  it("takes an inline snippet", () => {
    expect(
      ScriptsGlobal.safeParse({
        snippets: [{ ...base, src: "", inline: "console.log(1)" }],
      }).success
    ).toBe(true)
  })
  it("needs exactly one of src and inline", () => {
    const both = ScriptsGlobal.safeParse({
      snippets: [{ ...base, src: "https://x.example/a.js", inline: "1" }],
    })
    const neither = ScriptsGlobal.safeParse({
      snippets: [{ ...base, src: "", inline: "" }],
    })
    expect(both.success).toBe(false)
    expect(neither.success).toBe(false)
  })
  it("refuses http and hosts outside CUSTOM_SCRIPT_HOSTS (empty by default)", () => {
    for (const src of [
      "http://cdn.example.com/a.js",
      "https://cdn.example.com/a.js",
      "javascript:alert(1)",
    ]) {
      const r = ScriptsGlobal.safeParse({
        snippets: [{ ...base, src, inline: "" }],
      })
      expect(r.success).toBe(false)
      expect(r.error!.issues[0]!.path).toEqual(["snippets", 0, "src"])
    }
  })
  it("accepts route patterns and refuses anything else", () => {
    const ok = ScriptsGlobal.safeParse({
      snippets: [
        { ...base, src: "", inline: "1", routes: ["/", "/insights/*"] },
      ],
    })
    const bad = ScriptsGlobal.safeParse({
      snippets: [{ ...base, src: "", inline: "1", routes: ["insights"] }],
    })
    expect(ok.success).toBe(true)
    expect(bad.success).toBe(false)
  })
})
```

`tests/integration/api/consent.test.ts`:

```ts
import { createHash } from "node:crypto"

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: vi.fn(),
}))

import { closeDb, getDb } from "@/server/db/client"
import { consentEvents, settings } from "@/server/db/schema"

import { resetDb } from "../helpers/db"
import { freshIp, publicRequest } from "../helpers/leads"

const ID = "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc"
const body = (over: Record<string, unknown> = {}) => ({
  id: ID,
  v: 1,
  a: true,
  m: false,
  action: "custom",
  ...over,
})

beforeEach(async () => {
  await resetDb()
  await getDb()
    .insert(settings)
    .values({
      key: "consent",
      value: { title: "Cookies", body: "We use cookies." },
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: { title: "Cookies", body: "We use cookies." } },
    })
})
afterAll(closeDb)

describe("POST /public/consent", () => {
  it("stores the choice with a server-computed banner hash and no IP", async () => {
    const res = await publicRequest("/consent", {
      method: "POST",
      body: body(),
    })
    expect(res.status).toBe(204)
    const rows = await getDb().select().from(consentEvents)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      consentId: ID,
      analytics: true,
      marketing: false,
      revision: 1,
      action: "custom",
    })
    expect(rows[0]!.bannerHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(rows[0])).not.toMatch(/198\.51\.100/)
  })

  it("ignores any hash the client sends", async () => {
    await publicRequest("/consent", {
      method: "POST",
      body: body({ bannerHash: "f".repeat(64) }),
    })
    const [row] = await getDb().select().from(consentEvents)
    expect(row!.bannerHash).not.toBe("f".repeat(64))
  })

  it("changes the hash when the banner copy changes", async () => {
    await publicRequest("/consent", { method: "POST", body: body() })
    await getDb()
      .update(settings)
      .set({ value: { title: "Cookies v2" } })
    await publicRequest("/consent", { method: "POST", body: body() })
    const rows = await getDb().select().from(consentEvents)
    expect(new Set(rows.map((r) => r.bannerHash)).size).toBe(2)
  })

  it.each([
    [{ id: "nope" }],
    [{ action: "maybe" }],
    [{ v: 0 }],
    [{ a: "yes" }],
  ])("answers 400 for %j", async (over) => {
    const res = await publicRequest("/consent", {
      method: "POST",
      body: body(over),
    })
    expect(res.status).toBe(400)
    expect(await getDb().select().from(consentEvents)).toHaveLength(0)
  })

  it("rate-limits per client (20 per 10 minutes)", async () => {
    const ip = freshIp()
    for (let i = 0; i < 20; i++) {
      const ok = await publicRequest("/consent", {
        method: "POST",
        body: body(),
        ip,
      })
      expect(ok.status).toBe(204)
    }
    const res = await publicRequest("/consent", {
      method: "POST",
      body: body(),
      ip,
    })
    expect(res.status).toBe(429)
  })

  it("is append-only: the service exposes no update or delete", async () => {
    const mod = await import("@/server/modules/consent/service")
    expect(Object.keys(mod).sort()).toEqual(
      ["CONSENT_LIMIT", "bannerHash", "recordConsent"].sort()
    )
  })

  it("hashes exactly the copy a visitor sees", async () => {
    const { bannerHash } = await import("@/server/modules/consent/service")
    const { ConsentGlobal } = await import("@/lib/content/globals")
    const copy = ConsentGlobal.parse({ title: "Cookies" })
    const expected = createHash("sha256")
      .update(
        JSON.stringify([
          "Cookies", "", "", "", "", "", "", "", "", "", "",
        ])
      )
      .digest("hex")
    expect(bannerHash(copy)).toBe(expected)
    // Changing the revision alone does not change what was shown.
    expect(bannerHash({ ...copy, version: 9 })).toBe(expected)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project unit server/lib/secrets.test.ts server/env.test.ts lib/content/globals-tracking.test.ts`
Expected: FAIL (`./secrets` missing; env and globals assertions fail).
Run: `pnpm test:integration tests/integration/api/consent.test.ts`
Expected: FAIL (`consentEvents` is not exported).

- [ ] **Step 3: Environment**

In `server/env.ts`, add inside the object schema (after the Turnstile keys):

```ts
    // docs/brief.md §12.5: encrypts the CAPI token. Optional: only needed
    // before a token is saved (the Tracking page explains when it is missing).
    APP_ENCRYPTION_KEY: z
      .string()
      .refine(
        (v) =>
          /^[A-Za-z0-9+/]{43}=$/.test(v) &&
          Buffer.from(v, "base64").length === 32,
        "APP_ENCRYPTION_KEY must be 32 random bytes, base64 (openssl rand -base64 32)"
      )
      .optional(),
    // docs/brief.md §12.6 kill switch for every custom snippet.
    DISABLE_CUSTOM_SCRIPTS: z.stringbool().default(false),
```

`tests/test-env.mjs` and `tests/e2e/fixtures/env.ts` `E2E_ENV` each gain:

```js
  // 32 bytes of 0x07, base64: tests only.
  APP_ENCRYPTION_KEY: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=",
```

`.env.example` gains, commented, with one-line explanations: `# APP_ENCRYPTION_KEY=` ("openssl rand -base64 32; needed before saving a Meta CAPI token") and `# DISABLE_CUSTOM_SCRIPTS=false` ("true turns every custom snippet off").

- [ ] **Step 4: Secrets**

`server/lib/secrets.ts`:

```ts
import "server-only"

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import { getEnv } from "@/server/env"

// docs/brief.md §12.5 / Ruling R11: v1.<iv>.<tag>.<ciphertext>, base64url,
// AES-256-GCM with a 12-byte IV and the purpose as additional data.
export const CAPI_TOKEN_PURPOSE = "tracking.capiToken"

export class SecretKeyMissingError extends Error {
  constructor() {
    super("APP_ENCRYPTION_KEY is not set")
    this.name = "SecretKeyMissingError"
  }
}

export const secretsAvailable = () => Boolean(getEnv().APP_ENCRYPTION_KEY)

function key(): Buffer | null {
  const raw = getEnv().APP_ENCRYPTION_KEY
  return raw ? Buffer.from(raw, "base64") : null
}

export function encryptSecret(plain: string, purpose: string): string {
  const k = key()
  if (!k) throw new SecretKeyMissingError()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", k, iv)
  cipher.setAAD(Buffer.from(purpose))
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    body.toString("base64url"),
  ].join(".")
}

export function decryptSecret(payload: string, purpose: string): string | null {
  const k = key()
  const [version, iv, tag, body] = payload.split(".")
  if (!k || version !== "v1" || !iv || !tag || !body) return null
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      k,
      Buffer.from(iv, "base64url")
    )
    decipher.setAAD(Buffer.from(purpose))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([
      decipher.update(Buffer.from(body, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Globals**

`lib/tracking/hosts.ts`:

```ts
// Ruling R14: the only hosts a custom snippet's `src` may use. The CSP
// (lib/tracking/csp.ts, read by next.config.ts at build) uses the same list,
// so adding a host is a code change and a deploy. Hostnames only, no scheme.
export const CUSTOM_SCRIPT_HOSTS: readonly string[] = []
```

In `lib/content/globals.ts`, import `GA4_ID`, `GTM_ID`, `PIXEL_ID` from `@/lib/tracking/ids` (relative imports are not needed; `lib/content` already uses `@/`) and `CUSTOM_SCRIPT_HOSTS` from `@/lib/tracking/hosts`, then replace `TrackingGlobal`, `ConsentGlobal` and `ScriptsGlobal` with:

```ts
// A refine, not .or(z.literal("")): a union would report "Invalid input"
// instead of the format hint.
const optionalId = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || pattern.test(v), message)
    .default("")

export const TrackingGlobal = z.object({
  gtmId: optionalId(GTM_ID, "Use the GTM-XXXXXXX format"),
  ga4Id: optionalId(GA4_ID, "Use the G-XXXXXXXXXX format"),
  metaPixelId: optionalId(PIXEL_ID, "Use the 10–20 digit Pixel ID"),
  // Ruling R11: v1.<iv>.<tag>.<ciphertext>; never sent to the browser.
  capiTokenEncrypted: z.string().max(2000).nullable().default(null),
  testEventCode: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Z0-9]*$/, "Use the code from Events Manager (letters and digits)")
    .default(""),
  enabled: z
    .object({
      gtm: z.boolean().default(false),
      ga4: z.boolean().default(false),
      meta: z.boolean().default(false),
      capi: z.boolean().default(false),
    })
    .prefault({}),
  // Ruling R12: owner-only, with a recorded legal acknowledgement.
  enhancedMatching: z
    .object({
      enabled: z.boolean().default(false),
      acknowledgedAt: z.iso.datetime().nullable().default(null),
      acknowledgedBy: z.string().max(254).nullable().default(null),
    })
    .prefault({}),
})

export const ConsentGlobal = z.object({
  enabled: z.boolean().default(false),
  title: s(80),
  body: s(600),
  accept: s(30),
  reject: s(30),
  customise: s(30),
  save: s(30),
  settingsLink: s(30),
  policyLabel: s(40),
  policyHref: Href.or(z.literal("")).default(""),
  categories: z
    .object({ necessary: s(300), analytics: s(300), marketing: s(300) })
    .prefault({}),
  // Ruling R13: brief §12.1 "at least every 6 months".
  reconsentMonths: z.number().int().min(1).max(6).default(6),
  // Raising it asks every visitor again.
  version: z.number().int().min(1).default(1),
}).superRefine((v, ctx) => {
  // A live banner needs every label: the site never invents copy (the
  // content-literals test), and withdrawal needs the footer link.
  if (!v.enabled) return
  for (const key of [
    "title",
    "body",
    "accept",
    "reject",
    "customise",
    "save",
    "settingsLink",
  ] as const) {
    if (!v[key])
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "Fill this in before turning the banner on",
      })
  }
})

export const SCRIPT_CATEGORIES = ["necessary", "analytics", "marketing"] as const
const RoutePattern = z
  .string()
  .trim()
  .max(120)
  .regex(/^\/[\w\-/]*\*?$/, 'Use a path like "/" or "/insights/*"')

const allowedSrc = (src: string) => {
  try {
    const url = new URL(src)
    return url.protocol === "https:" && CUSTOM_SCRIPT_HOSTS.includes(url.hostname)
  } catch {
    return false
  }
}

export const ScriptSnippet = z
  .object({
    name: s(60),
    placement: z.enum(["head", "body"]).default("body"),
    src: z.string().trim().max(500).default(""),
    inline: z.string().max(20_000).default(""),
    category: z.enum(SCRIPT_CATEGORIES).default("marketing"),
    routes: z.array(RoutePattern).max(20).default([]),
    enabled: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (Boolean(v.src) === Boolean(v.inline.trim()))
      ctx.addIssue({
        code: "custom",
        path: ["src"],
        message: "Give either a script address or inline code, not both",
      })
    else if (v.src && !allowedSrc(v.src))
      ctx.addIssue({
        code: "custom",
        path: ["src"],
        message:
          CUSTOM_SCRIPT_HOSTS.length === 0
            ? "External scripts are not allowed yet; use inline code"
            : `Use https on an allowed host: ${CUSTOM_SCRIPT_HOSTS.join(", ")}`,
      })
  })
export type ScriptSnippet = z.infer<typeof ScriptSnippet>

export const ScriptsGlobal = z.object({
  snippets: z.array(ScriptSnippet).max(20).default([]),
})
```

Update `lib/content/globals.test.ts` only where an existing snapshot or default assertion for these three keys now differs.

`server/db/seed/fixtures/consent.ts` (default copy, banner **off**; the content-literals test keeps these strings out of components):

```ts
export const consentCopy = {
  enabled: false,
  title: "Your privacy, your choice",
  body: "We use cookies to understand how the site is used and, with your permission, to measure our advertising. Nothing beyond what is strictly necessary runs until you choose.",
  accept: "Accept all",
  reject: "Reject all",
  customise: "Customise",
  save: "Save choices",
  settingsLink: "Cookie settings",
  policyLabel: "Privacy policy",
  policyHref: "/privacy",
  categories: {
    necessary: "Keep the site secure and remember your choices. Always on.",
    analytics: "Google Analytics: which pages are visited and how, so we can improve them.",
    marketing: "Google and Meta advertising measurement: whether our ads lead to enquiries.",
  },
  reconsentMonths: 6,
  version: 1,
}
```

In `server/db/seed/globals.ts`, replace `consent: {}` with `consent: consentCopy` (import it). `seedGlobals` is `onConflictDoNothing`, so existing environments keep their row (the defaults fill new fields).

- [ ] **Step 6: Table and migration**

`server/db/schema/consent.ts`:

```ts
import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

// docs/brief.md §6.6 / §12.2: append-only proof of consent. No IP, no user.
export const consentEvents = pgTable(
  "consent_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    consentId: uuid().notNull(),
    analytics: boolean().notNull(),
    marketing: boolean().notNull(),
    revision: integer().notNull(),
    bannerHash: text().notNull(),
    action: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "consent_events_action_check",
      sql`${t.action} in ('accept','reject','custom','withdraw')`
    ),
    index("consent_events_consent_idx").on(t.consentId, t.createdAt),
  ]
)
```

Add `export * from "./consent"` to `server/db/schema/index.ts`, then:

```bash
pnpm db:generate --name tracking
```

Check `server/db/migrations/0009_tracking.sql` creates only `consent_events`, its check and its index.

- [ ] **Step 7: Settings readers, the service and the route**

`server/modules/tracking/settings.ts`:

```ts
import "server-only"

import { parseGlobal } from "@/lib/content/globals"
import { findSetting } from "@/server/modules/content/repo"

// Uncached reads for writes and for CAPI (which must see the latest consent
// revision and token). Rendering uses the cached readers instead.
export async function readTrackingSettings() {
  return parseGlobal("tracking", (await findSetting("tracking"))?.value)
}
export async function readConsentSettings() {
  return parseGlobal("consent", (await findSetting("consent"))?.value)
}
```

`server/modules/consent/service.ts`:

```ts
import "server-only"

import { createHash } from "node:crypto"

import * as z from "zod"

import type { GlobalValue } from "@/lib/content/globals"
import { invalid } from "@/server/api/errors"
import { getDb } from "@/server/db/client"
import { consentEvents } from "@/server/db/schema"
import { readConsentSettings } from "@/server/modules/tracking/settings"

export const CONSENT_LIMIT = { limit: 20, windowMs: 10 * 60_000 }

const ConsentEventInput = z.object({
  id: z.uuid(),
  v: z.number().int().min(1).max(10_000),
  a: z.boolean(),
  m: z.boolean(),
  action: z.enum(["accept", "reject", "custom", "withdraw"]),
})

// Ruling R16: what the visitor was shown, computed here so it cannot be forged.
export function bannerHash(c: GlobalValue<"consent">) {
  const shown = [
    c.title,
    c.body,
    c.accept,
    c.reject,
    c.customise,
    c.save,
    c.policyLabel,
    c.policyHref,
    c.categories.necessary,
    c.categories.analytics,
    c.categories.marketing,
  ]
  return createHash("sha256").update(JSON.stringify(shown)).digest("hex")
}

export async function recordConsent(body: unknown) {
  const parsed = ConsentEventInput.safeParse(body)
  if (!parsed.success) throw invalid(parsed.error)
  const e = parsed.data
  await getDb()
    .insert(consentEvents)
    .values({
      consentId: e.id,
      analytics: e.a,
      marketing: e.m,
      revision: e.v,
      bannerHash: bannerHash(await readConsentSettings()),
      action: e.action,
    })
}
```

`server/modules/consent/public-routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { publicLimit } from "@/server/api/middleware/public-limit"
import type { AppEnv } from "@/server/api/types"

import { CONSENT_LIMIT, recordConsent } from "./service"

// navigator.sendBeacon posts here (docs/brief.md §12.2); the answer is unread.
export const consentPublicRoutes = new Hono<AppEnv>().post(
  "/",
  publicLimit("consent", CONSENT_LIMIT),
  async (c) => {
    await recordConsent(await c.req.json().catch(() => ({})))
    return c.body(null, 204)
  }
)
```

Mount it in `server/api/routes/public.ts`: `.route("/consent", consentPublicRoutes)`.

`tests/integration/helpers/leads.ts` `publicRequest`: add `cookie?: string` to `init` and send `...(init.cookie ? { cookie: init.cookie } : {})` in the headers.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit server/lib/secrets.test.ts server/env.test.ts lib/content`
Run: `pnpm test:integration tests/integration/api/consent.test.ts tests/integration/db tests/integration/seed`
Expected: PASS. (The seed and migration suites prove `0009_tracking` applies from zero and the seed stays idempotent.)

- [ ] **Step 9: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add server/env.ts server/env.test.ts tests/test-env.mjs tests/e2e/fixtures/env.ts .env.example server/lib/secrets.ts server/lib/secrets.test.ts lib/tracking/hosts.ts lib/content server/db server/modules/tracking/settings.ts server/modules/consent server/api/routes/public.ts tests/integration/helpers/leads.ts tests/integration/api/consent.test.ts
git commit -m "feat(tracking): consent log, encrypted secrets and reshaped tracking settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The bootstrap — token-free tracking projection, the frame decision, one inline script in `SiteFrame`

**Model tier:** opus (Cache Components, inline script executed in vm, consent-before-load correctness).

**Files:**
- Create: `lib/tracking/frame.ts`, `lib/tracking/bootstrap.ts`, `server/modules/tracking/public.ts`, `components/tracking/tracking-bootstrap.tsx`
- Modify: `app/(site)/_cms/site-frame.tsx`
- Test: `lib/tracking/frame.test.ts`, `lib/tracking/bootstrap.test.ts`, `tests/integration/content/public-tracking.test.ts`

**Interfaces:**
- Consumes: Task 1 (`CONSENT_DEFAULTS`, `CONSENT_COOKIE`, `DAY_MS`, `ConsentPolicy`, `readConsent`, `encodeConsent`, `COLLAPSE`, `GTM_ID`, `GA4_ID`, `PIXEL_ID`, `validId`); Task 2 (reshaped `consent` / `scripts` / `tracking` globals, `getEnv().DISABLE_CUSTOM_SCRIPTS`).
- Produces:
  - `type PublicTracking = { gtmId: string | null; ga4Id: string | null; pixelId: string | null }` (in `lib/tracking/frame.ts`).
  - `getPublicTracking(): Promise<PublicTracking>` (`"use cache"`, tag `settings:tracking`; never contains the token).
  - `type TrackingFrame = { active: boolean; policy: ConsentPolicy; gtmId: string | null; ga4Id: string | null; pixelId: string | null; scripts: ScriptSnippet[] }`; `trackingFrame(input: { consent: GlobalValue<"consent">; scripts: GlobalValue<"scripts">; tracking: PublicTracking; preview: boolean; scriptsDisabled: boolean }): TrackingFrame`.
  - `bootstrapScript(input: { gtmId: string | null; ga4Id: string | null; policy: ConsentPolicy }): string`.
  - Browser globals the script defines: `window.dataLayer`, `window.gtag`, `window.__mkConsent: ConsentChoice | null`, `window.__loadGtm(): void`; dataLayer keys `page: { location, path, title, referrer }` and `ga4_measurement_id`.
  - `<TrackingBootstrap script={string} />`.
  - `SiteFrame` computes `frame` and (until Task 4/5/8 use them) renders only the bootstrap.

- [ ] **Step 1: Write the failing tests**

`lib/tracking/frame.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { ConsentGlobal, ScriptsGlobal } from "@/lib/content/globals"

import { trackingFrame } from "./frame"

// Spread, not parse: a live banner needs every label (Task 2 refine), which
// this decision does not care about.
const consent = { ...ConsentGlobal.parse({ version: 3 }), enabled: true }
const none = ScriptsGlobal.parse({})
const tracking = { gtmId: "GTM-AB12", ga4Id: "G-XYZ", pixelId: null }
const snippet = (category: string, enabled = true) => ({
  name: "s",
  placement: "body",
  src: "",
  inline: "1",
  category,
  routes: [],
  enabled,
})
const base = {
  consent,
  scripts: none,
  tracking,
  preview: false,
  scriptsDisabled: false,
}

describe("trackingFrame (Ruling R3)", () => {
  it("is active with the banner on and something to consent to", () => {
    expect(trackingFrame(base)).toMatchObject({
      active: true,
      policy: { version: 3, months: 6 },
      gtmId: "GTM-AB12",
      ga4Id: "G-XYZ",
      pixelId: null,
    })
  })

  it("is inactive when the banner is off: nothing loads at all", () => {
    const frame = trackingFrame({
      ...base,
      consent: { ...consent, enabled: false },
    })
    expect(frame).toMatchObject({ active: false, gtmId: null, ga4Id: null })
  })

  it("is inactive with nothing to consent to", () => {
    const frame = trackingFrame({
      ...base,
      tracking: { gtmId: null, ga4Id: null, pixelId: null },
    })
    expect(frame.active).toBe(false)
  })

  it("never tracks or runs snippets in draft preview", () => {
    const frame = trackingFrame({
      ...base,
      preview: true,
      scripts: ScriptsGlobal.parse({ snippets: [snippet("necessary")] }),
    })
    expect(frame).toMatchObject({ active: false, gtmId: null, scripts: [] })
  })

  it("counts a consent-gated snippet as something to consent to", () => {
    const frame = trackingFrame({
      ...base,
      tracking: { gtmId: null, ga4Id: null, pixelId: null },
      scripts: ScriptsGlobal.parse({ snippets: [snippet("analytics")] }),
    })
    expect(frame.active).toBe(true)
    expect(frame.scripts).toHaveLength(1)
  })

  it("keeps necessary snippets without a banner, drops gated ones and disabled ones", () => {
    const frame = trackingFrame({
      ...base,
      consent: { ...consent, enabled: false },
      scripts: ScriptsGlobal.parse({
        snippets: [
          snippet("necessary"),
          snippet("marketing"),
          snippet("necessary", false),
        ],
      }),
    })
    expect(frame.scripts.map((s) => s.category)).toEqual(["necessary"])
  })

  it("honours the kill switch", () => {
    const frame = trackingFrame({
      ...base,
      scriptsDisabled: true,
      scripts: ScriptsGlobal.parse({ snippets: [snippet("necessary")] }),
    })
    expect(frame.scripts).toEqual([])
  })

  it("drops GA4 when there is no GTM to run it (Ruling R5)", () => {
    const frame = trackingFrame({
      ...base,
      tracking: { gtmId: null, ga4Id: "G-XYZ", pixelId: "1234567890" },
    })
    expect(frame).toMatchObject({ active: true, ga4Id: null })
  })
})
```

`lib/tracking/bootstrap.test.ts`:

```ts
import { runInNewContext } from "node:vm"

import { describe, expect, it } from "vitest"

import { bootstrapScript } from "./bootstrap"
import { CONSENT_DEFAULTS, DAY_MS, encodeConsent, readConsent } from "./consent"

const policy = { version: 2, months: 6 }
const SCRIPT = bootstrapScript({
  gtmId: "GTM-AB12CD3",
  ga4Id: "G-XYZ123",
  policy,
})
const ID = "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc"
const now = () => Math.floor(Date.now() / 1000)
const consent = (a: 0 | 1, m: 0 | 1, over: Record<string, unknown> = {}) =>
  `mk_consent=${encodeConsent({ id: ID, v: 2, ts: now() - 60, a, m, ...over } as never)}`

type Run = {
  window: Record<string, unknown> & { dataLayer: unknown[] }
  appended: { async?: boolean; src?: string }[]
}
function run(
  script = SCRIPT,
  {
    cookie = "",
    href = "https://site.ie/contact?topic=anxiety-stress",
    referrer = "",
    title = "Contact | Magda Kennedy",
  } = {}
): Run {
  const appended: Run["appended"] = []
  const document = {
    cookie,
    referrer,
    title,
    head: { appendChild: (el: Run["appended"][number]) => appended.push(el) },
    createElement: () => ({}),
  }
  const window = { location: new URL(href), document } as Run["window"]
  runInNewContext(script, {
    window,
    document,
    URL,
    Date,
    JSON,
    RegExp,
    encodeURIComponent,
    decodeURIComponent,
  })
  return { window, appended }
}
const args = (entry: unknown) => Array.from(entry as ArrayLike<unknown>)

describe("bootstrap order (brief §12.3)", () => {
  it("sets denied defaults and ads_data_redaction first, then the page", () => {
    const { window } = run()
    const dl = window.dataLayer
    expect(args(dl[0])).toEqual(["consent", "default", CONSENT_DEFAULTS])
    expect(args(dl[1])).toEqual(["set", "ads_data_redaction", true])
    expect(dl[2]).toEqual({
      page: {
        location: "https://site.ie/contact",
        path: "/contact",
        title: "Contact | Magda Kennedy",
        referrer: "",
      },
    })
    expect(dl[3]).toEqual({ ga4_measurement_id: "G-XYZ123" })
  })

  it("never sets url_passthrough and has no noscript fallback", () => {
    expect(SCRIPT).not.toContain("url_passthrough")
    expect(SCRIPT).not.toContain("noscript")
  })
})

describe("bootstrap consent", () => {
  it("loads nothing without a choice", () => {
    const { window, appended } = run()
    expect(window.__mkConsent).toBeNull()
    expect(appended).toEqual([])
    expect(typeof window.__loadGtm).toBe("function")
  })

  it("applies a stored analytics choice and loads GTM once", () => {
    const { window, appended } = run(SCRIPT, { cookie: consent(1, 0) })
    expect(window.__mkConsent).toEqual({ analytics: true, marketing: false })
    const update = window.dataLayer.map(args).find((a) => a[1] === "update")
    expect(update).toEqual([
      "consent",
      "update",
      {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ])
    expect(appended).toEqual([
      {
        async: true,
        src: "https://www.googletagmanager.com/gtm.js?id=GTM-AB12CD3",
      },
    ])
    ;(window.__loadGtm as () => void)()
    expect(appended).toHaveLength(1)
  })

  it("a stored rejection updates to denied and loads nothing", () => {
    const { window, appended } = run(SCRIPT, { cookie: consent(0, 0) })
    expect(window.__mkConsent).toEqual({ analytics: false, marketing: false })
    expect(appended).toEqual([])
  })

  it("ignores a stale revision", () => {
    const { window, appended } = run(SCRIPT, {
      cookie: consent(1, 1, { v: 1 }),
    })
    expect(window.__mkConsent).toBeNull()
    expect(appended).toEqual([])
  })

  it("survives a broken cookie", () => {
    for (const cookie of [
      "mk_consent=%E0%A4%A",
      "mk_consent=" + encodeURIComponent("[1]"),
      "mk_consent=" + "x".repeat(5000),
    ]) {
      expect(() => run(SCRIPT, { cookie })).not.toThrow()
      expect(run(SCRIPT, { cookie }).window.__mkConsent).toBeNull()
    }
  })

  it("agrees with readConsent on every fixture", () => {
    const fixtures = [
      consent(1, 1),
      consent(0, 1),
      consent(1, 1, { v: 1 }),
      consent(1, 1, { ts: now() - 181 * 86_400 }),
      consent(1, 1, { ts: now() + 86_400 }),
      consent(1, 1, { a: 2 }),
      consent(1, 1, { id: "" }),
      "mk_consent=%E0%A4%A",
      "other=1",
    ]
    for (const cookie of fixtures) {
      const raw = cookie.startsWith("mk_consent=")
        ? cookie.slice("mk_consent=".length)
        : undefined
      expect(run(SCRIPT, { cookie: `a=1; ${cookie}` }).window.__mkConsent).toEqual(
        readConsent(raw, policy, Date.now())
      )
    }
    expect(DAY_MS).toBe(86_400_000)
  })
})

describe("bootstrap sanitising (Rulings R6, R8)", () => {
  it("pushes a sanitised page for articles, newsletter links and referrers", () => {
    const article = run(SCRIPT, {
      href: "https://site.ie/insights/hypnosis-for-panic#top",
      title: "Hypnosis for panic | MK",
      referrer: "https://www.google.com/search?q=panic+attack+help",
    })
    expect(article.window.dataLayer[2]).toEqual({
      page: {
        location: "https://site.ie/insights",
        path: "/insights",
        title: "Insights",
        referrer: "https://www.google.com/search",
      },
    })
    const newsletter = run(SCRIPT, {
      href: "https://site.ie/newsletter/unsubscribe?token=abc.def",
    })
    expect(JSON.stringify(newsletter.window.dataLayer)).not.toContain("token")
  })
})

describe("bootstrap safety (Review Focus 4)", () => {
  it("drops invalid IDs and escapes </script>", () => {
    const script = bootstrapScript({
      gtmId: 'GTM-A</script><script>alert(1)</script>',
      ga4Id: "g-lower",
      policy,
    })
    expect(script.toLowerCase()).not.toMatch(/<\/script|<!--/)
    // The embedded config holds no "<" at all (the body's loops may).
    const config = script.slice(script.indexOf("var C="), script.indexOf("};") + 1)
    expect(config).not.toContain("<")
    const { window, appended } = run(script, { cookie: consent(1, 1) })
    expect(appended).toEqual([])
    expect(window.dataLayer).not.toContainEqual({ ga4_measurement_id: "g-lower" })
  })
})
```

`tests/integration/content/public-tracking.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { cacheTag } from "next/cache"

import { closeDb, getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { getPublicTracking } from "@/server/modules/tracking/public"

import { resetDb } from "../helpers/db"

const write = (value: unknown) =>
  getDb()
    .insert(settings)
    .values({ key: "tracking", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })

beforeEach(resetDb)
afterAll(closeDb)

describe("getPublicTracking", () => {
  it("returns enabled, valid IDs only, and never the token", async () => {
    await write({
      gtmId: "GTM-AB12",
      ga4Id: "G-XYZ",
      metaPixelId: "1234567890",
      capiTokenEncrypted: "v1.SECRET.SECRET.SECRET",
      testEventCode: "TEST123",
      enabled: { gtm: true, ga4: true, meta: true, capi: true },
    })
    const result = await getPublicTracking()
    expect(result).toEqual({
      gtmId: "GTM-AB12",
      ga4Id: "G-XYZ",
      pixelId: "1234567890",
    })
    expect(JSON.stringify(result)).not.toMatch(/SECRET|TEST123/)
    expect(cacheTag).toHaveBeenCalledWith("settings:tracking")
  })

  it("nulls disabled channels, GA4 without GTM, and a missing row", async () => {
    await write({
      gtmId: "GTM-AB12",
      ga4Id: "G-XYZ",
      metaPixelId: "1234567890",
      enabled: { gtm: false, ga4: true, meta: false },
    })
    expect(await getPublicTracking()).toEqual({
      gtmId: null,
      ga4Id: null,
      pixelId: null,
    })
    await resetDb()
    expect(await getPublicTracking()).toEqual({
      gtmId: null,
      ga4Id: null,
      pixelId: null,
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project unit lib/tracking/frame.test.ts lib/tracking/bootstrap.test.ts`
Run: `pnpm test:integration tests/integration/content/public-tracking.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write the implementation**

`lib/tracking/frame.ts`:

```ts
import type { GlobalValue, ScriptSnippet } from "@/lib/content/globals"

import type { ConsentPolicy } from "./consent"

export type PublicTracking = {
  gtmId: string | null
  ga4Id: string | null
  pixelId: string | null
}

export type TrackingFrame = {
  active: boolean
  policy: ConsentPolicy
  gtmId: string | null
  ga4Id: string | null
  pixelId: string | null
  scripts: ScriptSnippet[]
}

// Ruling R3: decided once per render, from cached settings only.
export function trackingFrame(input: {
  consent: GlobalValue<"consent">
  scripts: GlobalValue<"scripts">
  tracking: PublicTracking
  preview: boolean
  scriptsDisabled: boolean
}): TrackingFrame {
  const { consent, tracking, preview } = input
  const runnable =
    preview || input.scriptsDisabled
      ? []
      : input.scripts.snippets.filter((s) => s.enabled)
  const gated = runnable.some((s) => s.category !== "necessary")
  const active =
    !preview &&
    consent.enabled &&
    Boolean(tracking.gtmId || tracking.pixelId || gated)
  return {
    active,
    policy: { version: consent.version, months: consent.reconsentMonths },
    gtmId: active ? tracking.gtmId : null,
    ga4Id: active && tracking.gtmId ? tracking.ga4Id : null,
    pixelId: active ? tracking.pixelId : null,
    scripts: active
      ? runnable
      : runnable.filter((s) => s.category === "necessary"),
  }
}
```

`lib/tracking/bootstrap.ts`:

```ts
import { CONSENT_COOKIE, CONSENT_DEFAULTS, DAY_MS, type ConsentPolicy } from "./consent"
import { GA4_ID, GTM_ID, validId } from "./ids"
import { COLLAPSE } from "./sanitize"

// docs/brief.md §12.3: the one inline script at the top of SiteFrame. It
// runs at parse time, before hydration and before GTM could ever load. Its
// cookie and sanitising rules mirror lib/tracking/{consent,sanitize}.ts;
// bootstrap.test.ts executes it against the same fixtures.
const BODY = `
var dl=w.dataLayer=w.dataLayer||[];
function gtag(){dl.push(arguments)}
w.gtag=w.gtag||gtag;
gtag("consent","default",C.defaults);
gtag("set","ads_data_redaction",true);
function hit(p,k,f){for(var i=0;i<C.collapse.length;i++){if(p.indexOf(C.collapse[i][0])===0)return C.collapse[i][k]}return f}
function clean(h){if(!h)return"";try{var u=new URL(h,w.location.href);return u.origin+hit(u.pathname,1,u.pathname)}catch(e){return""}}
var l=w.location;
dl.push({page:{location:clean(l.href),path:hit(l.pathname,1,l.pathname),title:hit(l.pathname,2,d.title),referrer:clean(d.referrer)}});
if(C.ga4)dl.push({ga4_measurement_id:C.ga4});
var s=null;
try{var m=d.cookie.match(new RegExp("(?:^|;\\\\s*)"+C.cookie+"=([^;]*)"));if(m&&m[1].length<=300){var v=JSON.parse(decodeURIComponent(m[1]));if(v&&typeof v==="object"&&typeof v.id==="string"&&v.id.length>0&&v.id.length<=64&&v.v===C.version&&typeof v.ts==="number"&&v.ts%1===0&&(v.a===0||v.a===1)&&(v.m===0||v.m===1)){var age=Date.now()-v.ts*1000;if(age>=-300000&&age<=C.maxAgeMs)s={analytics:v.a===1,marketing:v.m===1}}}}catch(e){}
w.__mkConsent=s;
var loaded=false;
w.__loadGtm=function(){if(loaded||!C.gtm)return;loaded=true;dl.push({"gtm.start":new Date().getTime(),event:"gtm.js"});var j=d.createElement("script");j.async=true;j.src="https://www.googletagmanager.com/gtm.js?id="+encodeURIComponent(C.gtm);d.head.appendChild(j)};
if(s){var g=function(on){return on?"granted":"denied"};gtag("consent","update",{analytics_storage:g(s.analytics),ad_storage:g(s.marketing),ad_user_data:g(s.marketing),ad_personalization:g(s.marketing)});if(s.analytics||s.marketing)w.__loadGtm()}
`

export function bootstrapScript(input: {
  gtmId: string | null
  ga4Id: string | null
  policy: ConsentPolicy
}): string {
  const config = {
    gtm: validId(GTM_ID, input.gtmId),
    ga4: validId(GA4_ID, input.ga4Id),
    version: input.policy.version,
    maxAgeMs: input.policy.months * 30 * DAY_MS,
    cookie: CONSENT_COOKIE,
    defaults: CONSENT_DEFAULTS,
    collapse: COLLAPSE,
  }
  // JSON.stringify, then no "<" at all: nothing can close the script tag.
  const json = JSON.stringify(config).replace(/</g, "\\u003c")
  return `(function(w,d){var C=${json};${BODY.replace(/\n/g, "")}})(window,document);`
}
```

> Escaping note: inside the TypeScript template literal, `"(?:^|;\\\\s*)"` produces the JS source `"(?:^|;\\s*)"`, which is the regex `(?:^|;\s*)`. The "agrees with readConsent" test fails loudly if this is wrong.

`server/modules/tracking/public.ts`:

```ts
import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { parseGlobal } from "@/lib/content/globals"
import type { PublicTracking } from "@/lib/tracking/frame"
import { GA4_ID, GTM_ID, PIXEL_ID, validId } from "@/lib/tracking/ids"
import { MISS_LIFE, tags } from "@/server/lib/cache"
import { findSetting } from "@/server/modules/content/repo"

// The public half of the `tracking` global. The token and the test code never
// enter the cache entry (docs/brief.md §6.4 "except the secrets in tracking").
// Callers must `await io()` first.
export async function getPublicTracking(): Promise<PublicTracking> {
  "use cache"
  cacheTag(tags.setting("tracking"))
  const row = await findSetting("tracking")
  if (row) cacheLife("max")
  else cacheLife(MISS_LIFE)
  const t = parseGlobal("tracking", row?.value)
  const gtmId = t.enabled.gtm ? validId(GTM_ID, t.gtmId) : null
  return {
    gtmId,
    ga4Id: gtmId && t.enabled.ga4 ? validId(GA4_ID, t.ga4Id) : null,
    pixelId: t.enabled.meta ? validId(PIXEL_ID, t.metaPixelId) : null,
  }
}
```

`components/tracking/tracking-bootstrap.tsx`:

```tsx
// Server-rendered only. React does not execute an inline script it creates on
// the client, and SiteFrame lives in the root layout, which a client
// navigation never re-creates: the script runs exactly once per document.
export function TrackingBootstrap({ script }: { script: string }) {
  return <script id="mk-tracking" dangerouslySetInnerHTML={{ __html: script }} />
}
```

`app/(site)/_cms/site-frame.tsx` — read the three extra settings in the same `Promise.all`, decide the frame, render the bootstrap first:

```tsx
import { io } from "next/cache"

import { SmoothScroll } from "@/components/smooth-scroll"
import { PreviewBar } from "@/components/preview-bar"
import { TrackingBootstrap } from "@/components/tracking/tracking-bootstrap"
import { SiteFooter } from "@/features/footer"
import { SiteHeader } from "@/features/navbar"
import { themeCss } from "@/lib/content/theme"
import { bootstrapScript } from "@/lib/tracking/bootstrap"
import { trackingFrame } from "@/lib/tracking/frame"
import { getEnv } from "@/server/env"
import { isPreviewing } from "@/server/modules/content/preview"
import { getSetting } from "@/server/modules/content/queries"
import { getPublicTracking } from "@/server/modules/tracking/public"

// Site chrome from the globals (docs/brief.md §5.5a). io() suspends during
// prerender, so the build never reaches the database; at request time the
// settings come from the tag cache. No cookies() here (Ruling R2): consent is
// read in the browser by the bootstrap.
export async function SiteFrame({ children }: { children: React.ReactNode }) {
  await io()
  const [site, navigation, footer, theme, preview, consent, scripts, tracking] =
    await Promise.all([
      getSetting("site"),
      getSetting("navigation"),
      getSetting("footer"),
      getSetting("theme"),
      isPreviewing(),
      getSetting("consent"),
      getSetting("scripts"),
      getPublicTracking(),
    ])
  const frame = trackingFrame({
    consent,
    scripts,
    tracking,
    preview,
    scriptsDisabled: getEnv().DISABLE_CUSTOM_SCRIPTS,
  })
  const css = themeCss(theme.site)
  return (
    <>
      {frame.active ? (
        <TrackingBootstrap script={bootstrapScript(frame)} />
      ) : null}
      {css && <style>{css}</style>}
      <SmoothScroll>
        <SiteHeader site={site} navigation={navigation} />
        {children}
        <SiteFooter site={site} footer={footer} navigation={navigation} />
      </SmoothScroll>
      {preview ? <PreviewBar /> : null}
    </>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit lib/tracking "app/(site)"`
Run: `pnpm test:integration tests/integration/content/public-tracking.test.ts`
Expected: PASS (including the existing `io-gate.test.ts`).

- [ ] **Step 5: Build without a database, parity**

Run: `DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build`
Expected: success (the new reads sit behind `io()`).
Run: `pnpm test:parity`
Expected: PASS ≤ 0.1% (the seeded banner is off, so nothing renders).

- [ ] **Step 6: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add lib/tracking server/modules/tracking/public.ts components/tracking "app/(site)/_cms/site-frame.tsx" tests/integration/content/public-tracking.test.ts
git commit -m "feat(tracking): consent-mode bootstrap script and token-free tracking projection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The consent banner — equal first layer, Customise, footer "Cookie settings", withdrawal, parity guard

**Model tier:** sonnet (UI + cookie writes, tests given).

**Files:**
- Create: `lib/tracking/consent-client.ts`, `components/consent/consent-banner-view.tsx`, `features/consent/components/consent-banner.tsx`, `features/footer/components/cookie-settings-button.tsx`
- Modify: `app/(site)/_cms/site-frame.tsx`, `features/footer/components/site-footer.tsx`, `tests/e2e/parity/visual-parity.spec.ts`
- Test: `lib/tracking/consent-client.test.ts`, `components/consent/consent-banner-view.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`CONSENT_COOKIE`, `CONSENT_MAX_AGE`, `encodeConsent`, `decodeConsent`, `readConsent`, `cookieValue`, `consentModeUpdate`, `actionFor`, `isTrackingCookie`, `cookieDomains`, `ConsentChoice`, `ConsentPolicy`, `ConsentAction`); Task 3 (`TrackingFrame`, browser globals `__mkConsent`, `__loadGtm`, `gtag`).
- Produces:
  - `type ConsentEnv = { window: ConsentWindow; doc: { cookie: string }; beacon?: (url: string, body: Blob) => boolean; reload: () => void; now: () => number; newId: () => string }`, `browserConsentEnv(): ConsentEnv`.
  - `saveConsent(choice: ConsentChoice, kind: "accept" | "reject" | "custom", policy: ConsentPolicy, env?: ConsentEnv): ConsentAction`.
  - `clearTrackingCookies(doc: { cookie: string }, hostname: string): void`.
  - `subscribeConsent(cb: () => void): () => void`, `getConsentSnapshot(): ConsentChoice | null`, `getServerConsentSnapshot(): null` (for `useSyncExternalStore`).
  - `OPEN_CONSENT_EVENT = "mk:open-consent"`, `openConsentSettings(): void`.
  - `type ConsentCopy = Pick<GlobalValue<"consent">, "title" | "body" | "accept" | "reject" | "customise" | "save" | "policyLabel" | "policyHref" | "categories">`.
  - `<ConsentBannerView copy mode choice onAccept onReject onCustomise onSave onToggle />` (presentational, also used by the admin preview in Task 7).
  - `<ConsentBanner copy policy />` (client container), `<CookieSettingsButton label />`, `SiteFooter` prop `cookieSettings: string | null`.

- [ ] **Step 1: Write the failing tests**

`lib/tracking/consent-client.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import { clearTrackingCookies, saveConsent, subscribeConsent } from "./consent-client"
import { decodeConsent } from "./consent"

class FakeDoc {
  jar = ""
  writes: string[] = []
  get cookie() {
    return this.jar
  }
  set cookie(value: string) {
    this.writes.push(value)
  }
}

function env(over: { jar?: string; previous?: object | null } = {}) {
  const doc = new FakeDoc()
  doc.jar = over.jar ?? ""
  const window = {
    location: { hostname: "www.magdakennedy.ie" },
    dataLayer: [] as unknown[],
    gtag: vi.fn(),
    __loadGtm: vi.fn(),
    __mkConsent: over.previous ?? null,
  }
  const beacons: { url: string; body: string }[] = []
  return {
    doc,
    window,
    beacons,
    reload: vi.fn(),
    env: {
      window: window as never,
      doc,
      beacon: (url: string, body: Blob) => {
        void body.text().then((text) => beacons.push({ url, body: text }))
        return true
      },
      reload: () => undefined,
      now: () => Date.UTC(2026, 9, 10),
      newId: () => "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc",
    },
  }
}
const policy = { version: 3, months: 6 }
const flush = () => new Promise((r) => setTimeout(r, 0))

describe("saveConsent", () => {
  it("accept: writes the cookie, updates consent mode, loads GTM, logs", async () => {
    const t = env()
    const action = saveConsent(
      { analytics: true, marketing: true },
      "accept",
      policy,
      t.env
    )
    expect(action).toBe("accept")
    const written = t.doc.writes[0]!
    expect(written).toMatch(
      /^mk_consent=[^;]+; Max-Age=15552000; Path=\/; SameSite=Lax; Secure$/
    )
    expect(
      decodeConsent(written.slice("mk_consent=".length).split(";")[0])
    ).toEqual({
      id: "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc",
      v: 3,
      ts: Math.floor(Date.UTC(2026, 9, 10) / 1000),
      a: 1,
      m: 1,
    })
    expect(t.window.gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    })
    expect(t.window.dataLayer).toContainEqual({ event: "consent_update" })
    expect(t.window.__loadGtm).toHaveBeenCalledOnce()
    expect(t.window.__mkConsent).toEqual({ analytics: true, marketing: true })
    await flush()
    expect(t.beacons).toEqual([
      {
        url: "/api/v1/public/consent",
        body: JSON.stringify({
          id: "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc",
          v: 3,
          a: true,
          m: true,
          action: "accept",
        }),
      },
    ])
  })

  it("reject: denies, loads nothing", () => {
    const t = env()
    expect(
      saveConsent({ analytics: false, marketing: false }, "reject", policy, t.env)
    ).toBe("reject")
    expect(t.window.__loadGtm).not.toHaveBeenCalled()
  })

  it("keeps the consent id across changes", () => {
    const t = env({
      jar: 'mk_consent=' +
        encodeURIComponent(
          JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", v: 2, ts: 1, a: 0, m: 0 })
        ),
    })
    saveConsent({ analytics: true, marketing: false }, "custom", policy, t.env)
    expect(t.doc.writes[0]).toContain(
      encodeURIComponent('"id":"11111111-1111-4111-8111-111111111111"')
    )
  })

  it("withdrawal clears tracking cookies everywhere and reloads (Ruling R17)", () => {
    const t = env({
      previous: { analytics: true, marketing: true },
      jar: "_ga=1; _ga_ABC=2; _gcl_au=3; _fbp=4; _fbc=5; mk.session_token=keep",
    })
    const reload = vi.fn()
    const action = saveConsent(
      { analytics: true, marketing: false },
      "custom",
      policy,
      { ...t.env, reload }
    )
    expect(action).toBe("withdraw")
    expect(reload).toHaveBeenCalledOnce()
    expect(t.window.__loadGtm).not.toHaveBeenCalled()
    for (const name of ["_ga", "_ga_ABC", "_gcl_au", "_fbp", "_fbc"]) {
      expect(t.doc.writes).toContain(`${name}=; Max-Age=0; Path=/`)
      expect(t.doc.writes).toContain(
        `${name}=; Max-Age=0; Path=/; Domain=.magdakennedy.ie`
      )
    }
    expect(t.doc.writes.join("\n")).not.toContain("mk.session_token")
  })

  it("notifies subscribers after a non-withdrawing save", () => {
    const t = env()
    const listener = vi.fn()
    const off = subscribeConsent(listener)
    saveConsent({ analytics: false, marketing: true }, "custom", policy, t.env)
    expect(listener).toHaveBeenCalledOnce()
    off()
  })
})

describe("clearTrackingCookies", () => {
  it("only touches tracking cookies", () => {
    const doc = new FakeDoc()
    doc.jar = "mk_consent=x; theme=dark"
    clearTrackingCookies(doc, "localhost")
    expect(doc.writes).toEqual([])
  })
})
```

`components/consent/consent-banner-view.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ConsentBannerView } from "./consent-banner-view"

const copy = {
  title: "Your privacy",
  body: "Body text",
  accept: "Accept all",
  reject: "Reject all",
  customise: "Customise",
  save: "Save choices",
  policyLabel: "Privacy policy",
  policyHref: "/privacy",
  categories: {
    necessary: "Necessary text",
    analytics: "Analytics text",
    marketing: "Marketing text",
  },
}
const handlers = () => ({
  onAccept: vi.fn(),
  onReject: vi.fn(),
  onCustomise: vi.fn(),
  onSave: vi.fn(),
  onToggle: vi.fn(),
})

describe("ConsentBannerView", () => {
  it("gives Accept, Reject and Customise equal prominence on the first layer", () => {
    render(
      <ConsentBannerView
        copy={copy}
        mode="first"
        choice={{ analytics: false, marketing: false }}
        {...handlers()}
      />
    )
    const dialog = screen.getByRole("dialog", { name: "Your privacy" })
    expect(dialog).toHaveAttribute("aria-modal", "false")
    const buttons = ["Accept all", "Reject all", "Customise"].map((name) =>
      screen.getByRole("button", { name })
    )
    const classes = new Set(buttons.map((b) => b.className))
    expect(classes.size).toBe(1)
    expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute(
      "href",
      "/privacy"
    )
  })

  it("Customise shows unticked categories and an always-on necessary row", async () => {
    const h = handlers()
    render(
      <ConsentBannerView
        copy={copy}
        mode="custom"
        choice={{ analytics: false, marketing: false }}
        {...h}
      />
    )
    expect(screen.getByRole("checkbox", { name: /Necessary/ })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Necessary/ })).toBeDisabled()
    const analytics = screen.getByRole("checkbox", { name: /Analytics/ })
    const marketing = screen.getByRole("checkbox", { name: /Marketing/ })
    expect(analytics).not.toBeChecked()
    expect(marketing).not.toBeChecked()
    await userEvent.click(analytics)
    expect(h.onToggle).toHaveBeenCalledWith("analytics", true)
    await userEvent.click(screen.getByRole("button", { name: "Save choices" }))
    expect(h.onSave).toHaveBeenCalledOnce()
    // Reject stays one click away on the second layer too.
    expect(screen.getByRole("button", { name: "Reject all" })).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project unit lib/tracking/consent-client.test.ts components/consent`
Expected: FAIL (modules missing).

- [ ] **Step 3: `lib/tracking/consent-client.ts`**

```ts
import {
  actionFor,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  consentModeUpdate,
  cookieDomains,
  cookieValue,
  decodeConsent,
  encodeConsent,
  isTrackingCookie,
  type ConsentAction,
  type ConsentChoice,
  type ConsentPolicy,
} from "./consent"

// Browser side of docs/brief.md §12.2. No React here: the banner, the Pixel
// loader and custom scripts all read and change consent through this module.
export type ConsentWindow = {
  location: { hostname: string }
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  __mkConsent?: ConsentChoice | null
  __loadGtm?: () => void
}
export type ConsentEnv = {
  window: ConsentWindow
  doc: { cookie: string }
  beacon?: (url: string, body: Blob) => boolean
  reload: () => void
  now: () => number
  newId: () => string
}

export const browserConsentEnv = (): ConsentEnv => ({
  window: window as unknown as ConsentWindow,
  doc: document,
  beacon: navigator.sendBeacon?.bind(navigator),
  reload: () => window.location.reload(),
  now: Date.now,
  newId: () => crypto.randomUUID(),
})

const listeners = new Set<() => void>()
export function subscribeConsent(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
export const getConsentSnapshot = (): ConsentChoice | null =>
  typeof window === "undefined"
    ? null
    : ((window as unknown as ConsentWindow).__mkConsent ?? null)
export const getServerConsentSnapshot = () => null

export function clearTrackingCookies(doc: { cookie: string }, hostname: string) {
  const names = doc.cookie
    .split(";")
    .map((part) => part.split("=")[0]!.trim())
    .filter(isTrackingCookie)
  for (const name of names) {
    doc.cookie = `${name}=; Max-Age=0; Path=/`
    for (const domain of cookieDomains(hostname))
      doc.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}`
  }
}

export function saveConsent(
  choice: ConsentChoice,
  kind: "accept" | "reject" | "custom",
  policy: ConsentPolicy,
  env: ConsentEnv = browserConsentEnv()
): ConsentAction {
  const w = env.window
  const action = actionFor(w.__mkConsent ?? null, choice, kind)
  const id =
    decodeConsent(cookieValue(env.doc.cookie, CONSENT_COOKIE))?.id ??
    env.newId()
  const value = encodeConsent({
    id,
    v: policy.version,
    ts: Math.floor(env.now() / 1000),
    a: choice.analytics ? 1 : 0,
    m: choice.marketing ? 1 : 0,
  })
  env.doc.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax; Secure`
  w.__mkConsent = choice
  w.gtag?.("consent", "update", consentModeUpdate(choice))
  ;(w.dataLayer ??= []).push({ event: "consent_update" })
  env.beacon?.(
    "/api/v1/public/consent",
    new Blob(
      [
        JSON.stringify({
          id,
          v: policy.version,
          a: choice.analytics,
          m: choice.marketing,
          action,
        }),
      ],
      { type: "application/json" }
    )
  )
  if (action === "withdraw") {
    clearTrackingCookies(env.doc, w.location.hostname)
    env.reload()
    return action
  }
  if (choice.analytics || choice.marketing) w.__loadGtm?.()
  for (const listener of listeners) listener()
  return action
}

export const OPEN_CONSENT_EVENT = "mk:open-consent"
export const openConsentSettings = () =>
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))
```

> `Secure` on `http://localhost` (E2E): Chromium treats `localhost` as a secure context and accepts it. Do not drop the attribute for local runs.

- [ ] **Step 4: The banner**

`components/consent/consent-banner-view.tsx` (presentational, no state, `"use client"` not needed; no imports from `features/**` so the admin can render it):

- Props: `copy: ConsentCopy`, `mode: "first" | "custom"`, `choice: ConsentChoice`, `onAccept()`, `onReject()`, `onCustomise()`, `onSave()`, `onToggle(category: "analytics" | "marketing", on: boolean)`, optional `headingRef`.
- Root: `<div role="dialog" aria-modal="false" aria-labelledby="mk-consent-title" aria-describedby="mk-consent-body">`, fixed to the bottom of the viewport (`fixed inset-x-0 bottom-0 z-50`), inner card aligned like `Container` (max width 1440px, 66px gutter on desktop, 16px on phones) so it lines up with every section; non-modal (no focus trap, page stays usable).
- `<h2 id="mk-consent-title">{copy.title}</h2>`, `<p id="mk-consent-body">{copy.body}</p>`, and when `copy.policyHref` is set a link `{copy.policyLabel}` to it.
- First layer: three `<button type="button">` in the order Accept, Reject, Customise, **all with the same `BUTTON` class constant** (same size, colour, weight, border). No primary styling on Accept.
- Custom layer: three rows, each a `<label>` wrapping a checkbox and the category text: "Necessary" (checked, disabled, `copy.categories.necessary`), "Analytics" (`choice.analytics`, `copy.categories.analytics`), "Marketing" (`choice.marketing`, `copy.categories.marketing`). The row titles "Necessary", "Analytics" and "Marketing" are category names, not copy. Below: `{copy.save}` and `{copy.reject}` buttons, same `BUTTON` class.
- Styling uses CSS-variable utilities only (`bg-(--color-cream)`, `text-(--color-pine)`, `border-(--color-line)`, `font-(family-name:--font-display)` …), never the site's theme utilities (`bg-pine`), because the admin stylesheet does not define the site theme and Task 7 previews this component inside the admin with the variables supplied inline. Visible focus rings; 44 px minimum touch targets.

`features/consent/components/consent-banner.tsx` (`"use client"`):

- Props: `copy: ConsentCopy`, `policy: ConsentPolicy`.
- State: `open` (initially `false`, so server HTML and first client render match), `mode`, `choice`.
- On mount: `readConsent(cookieValue(document.cookie, CONSENT_COOKIE), policy, Date.now())`; if `null` → `open = true`, `mode = "first"`, `choice = { analytics: false, marketing: false }`.
- Listens for `OPEN_CONSENT_EVENT` on `window`: opens in `"custom"` mode with `choice = getConsentSnapshot() ?? both false`, then focuses the heading.
- Accept → `saveConsent({ analytics: true, marketing: true }, "accept", policy)`; Reject → both false, `"reject"`; Save → current `choice`, `"custom"`. Each closes the banner (a withdrawal reloads anyway).
- Renders `ConsentBannerView` only while `open`.

`features/footer/components/cookie-settings-button.tsx` (`"use client"`): a `<button type="button">` styled exactly like the footer's legal links, calling `openConsentSettings()`, text `{label}`.

`features/footer/components/site-footer.tsx`: new prop `cookieSettings: string | null`; when set, render `<CookieSettingsButton label={cookieSettings} />` as the last item of the legal-links row (same list markup as the links). When `null`, the footer is byte-identical to today.

`app/(site)/_cms/site-frame.tsx`: pass `cookieSettings={frame.active ? consent.settingsLink : null}` to `SiteFooter`, and after `</SmoothScroll>` render

```tsx
{frame.active ? (
  <ConsentBanner
    policy={frame.policy}
    copy={{
      title: consent.title,
      body: consent.body,
      accept: consent.accept,
      reject: consent.reject,
      customise: consent.customise,
      save: consent.save,
      policyLabel: consent.policyLabel,
      policyHref: consent.policyHref,
      categories: consent.categories,
    }}
  />
) : null}
```

- [ ] **Step 5: Parity guard (Ruling R19)**

In `tests/e2e/parity/visual-parity.spec.ts`, before the loop:

```ts
import { encodeConsent } from "../../../lib/tracking/consent"
import { E2E_ORIGIN } from "../fixtures/env"

// The seed keeps the banner off, so nothing tracking-related renders. If a
// developer has switched it on locally, a stored "reject" keeps the banner
// (a fixed overlay) out of the screenshots.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: "mk_consent",
      value: encodeConsent({
        id: "00000000-0000-4000-8000-000000000000",
        v: 1,
        ts: Math.floor(Date.now() / 1000),
        a: 0,
        m: 0,
      }),
      url: E2E_ORIGIN,
    },
  ])
})
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit lib/tracking components/consent features tests/lint`
Expected: PASS (the content-literals test proves no seeded consent copy appears in components).

- [ ] **Step 7: Build, parity**

Run: `DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build && pnpm test:parity`
Expected: build succeeds; parity PASS ≤ 0.1%.

- [ ] **Step 8: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add lib/tracking/consent-client.ts lib/tracking/consent-client.test.ts components/consent features/consent features/footer "app/(site)/_cms/site-frame.tsx" tests/e2e/parity/visual-parity.spec.ts
git commit -m "feat(tracking): consent banner with equal choices, cookie settings and withdrawal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Client tracking — `track()`, `RouteTracker`, click events, lead/newsletter/share instrumentation, the Meta Pixel

**Model tier:** sonnet (wiring against given interfaces).

**Files:**
- Create: `lib/tracking/track.ts`, `lib/tracking/pixel.ts`, `lib/tracking/clicks.ts`, `features/tracking/components/route-tracker.tsx`, `features/tracking/components/click-tracker.tsx`, `features/tracking/components/marketing-scripts.tsx`
- Modify: `features/contact/components/contact-form.tsx`, `lib/leads/schema.ts`, `features/insights/components/newsletter-band.tsx`, `features/insights/components/share-links.tsx`, `features/navbar/components/book-call-button.tsx`, `features/navbar/components/site-header.tsx`, `features/navbar/components/mobile-nav.tsx`, `features/insights/components/insights-section.tsx`, `features/enterprise/components/enterprise-section.tsx`, `features/about-page/components/credentials-section.tsx`, `features/about/components/about-section.tsx`, `features/how-it-works/components/how-it-works-section.tsx`, `app/(site)/_cms/site-frame.tsx`
- Delete: `features/contact/lib/track.ts`
- Test: `lib/tracking/track.test.ts`, `lib/tracking/pixel.test.ts`, `lib/tracking/clicks.test.ts`, `features/contact/components/contact-form.test.tsx` (modify), `features/insights/components/newsletter-band.test.tsx` (modify)

**Interfaces:**
- Consumes: Task 1 (`TrackEvent`, `pushEvent`, `META_EVENT`, `metaAllowed`, `sanitizeUrl`, `sanitizePath`, `pageTitle`, `PIXEL_ID`, `validId`); Task 4 (`getConsentSnapshot`, `subscribeConsent`, `getServerConsentSnapshot`).
- Produces:
  - `track(e: TrackEvent, env?: TrackEnv): string | undefined` (returns the `event_id`), `flushMetaPageView(env?): boolean`, `currentPage(env?): { location: string; path: string; title: string; referrer: string }`, `pushPage(page, env?)`.
  - `loadPixel(id: string, env?: { window; document }): boolean` (false when already loaded or the ID is invalid).
  - `clickEvent(target: Element | null): TrackEvent | null`.
  - `<RouteTracker />`, `<ClickTracker />`, `<MarketingScripts pixelId={string | null} />`.
  - `LeadSubmission.marketingConsent: boolean` (default `false`), consumed by Task 6.
  - Markup contract for CTAs: `data-track="book_appointment" data-cta-location="<where>"`.

- [ ] **Step 1: Write the failing tests**

`lib/tracking/track.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import { currentPage, flushMetaPageView, track, type TrackEnv } from "./track"

function env(href: string, consent: { marketing: boolean } | null) {
  const url = new URL(href)
  const fbq = vi.fn()
  const window = {
    dataLayer: [] as unknown[],
    fbq,
    __mkConsent: consent && { analytics: true, ...consent },
    location: url,
  }
  const e: TrackEnv = {
    window: window as never,
    document: { title: "Contact | MK", referrer: "" } as never,
    newId: () => "evt-1",
  }
  return { e, window, fbq }
}

describe("track", () => {
  it("always pushes to the dataLayer, with or without consent", () => {
    const t = env("https://site.ie/contact", null)
    const id = track({ event: "contact_click", params: { method: "email" } }, t.e)
    expect(id).toBe("evt-1")
    expect(t.window.dataLayer).toEqual([
      { event_params: null },
      { event: "contact_click", event_params: { method: "email", event_id: "evt-1" } },
    ])
    expect(t.fbq).not.toHaveBeenCalled()
  })

  it("mirrors to Meta with the same event id when marketing consent exists", () => {
    const t = env("https://site.ie/contact", { marketing: true })
    track(
      {
        event: "generate_lead",
        params: { lead_source: "contact_form", form_id: "contact" },
        eventId: "lead-1",
      },
      t.e
    )
    expect(t.fbq).toHaveBeenCalledWith("track", "Lead", {}, { eventID: "lead-1" })
  })

  it("sends no Meta event when the URL has a query or is an article (Ruling R7)", () => {
    for (const href of [
      "https://site.ie/contact?topic=anxiety-stress",
      "https://site.ie/insights/hypnosis-for-panic",
      "https://site.ie/newsletter/unsubscribe?token=a",
    ]) {
      const t = env(href, { marketing: true })
      track({ event: "sign_up", params: { method: "newsletter" } }, t.e)
      expect(t.fbq).not.toHaveBeenCalled()
      expect(t.window.dataLayer).toHaveLength(2)
    }
  })

  it("never sends share to Meta, and never custom data", () => {
    const t = env("https://site.ie/insights", { marketing: true })
    track({ event: "share", params: { method: "copy_link", content_type: "article" } }, t.e)
    expect(t.fbq).not.toHaveBeenCalled()
    track({ event: "contact_click", params: { method: "phone" } }, t.e)
    expect(t.fbq.mock.calls[0]![2]).toEqual({})
  })
})

describe("flushMetaPageView", () => {
  it("sends the page view Meta missed, once", () => {
    const t = env("https://site.ie/about", { marketing: true })
    const fbq = t.window.fbq
    // Pixel not loaded yet when the page view is pushed.
    ;(t.window as { fbq?: unknown }).fbq = undefined
    track(
      {
        event: "virtual_page_view",
        params: { page_location: "x", page_path: "/about", page_title: "About" },
      },
      t.e
    )
    ;(t.window as { fbq?: unknown }).fbq = fbq
    expect(flushMetaPageView(t.e)).toBe(true)
    expect(fbq).toHaveBeenCalledWith("track", "PageView", {}, { eventID: "evt-1" })
    expect(flushMetaPageView(t.e)).toBe(false)
  })

  it("does not repeat a page view Meta already received", () => {
    const t = env("https://site.ie/about", { marketing: true })
    track(
      {
        event: "virtual_page_view",
        params: { page_location: "x", page_path: "/about", page_title: "About" },
      },
      t.e
    )
    expect(t.fbq).toHaveBeenCalledOnce()
    expect(flushMetaPageView(t.e)).toBe(false)
  })
})

describe("currentPage", () => {
  it("is sanitised", () => {
    const t = env("https://site.ie/insights/hypnosis-for-panic?x=1#y", null)
    expect(currentPage(t.e)).toEqual({
      location: "https://site.ie/insights",
      path: "/insights",
      title: "Insights",
      referrer: "",
    })
  })
})
```

`lib/tracking/pixel.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { loadPixel } from "./pixel"

function env() {
  const appended: { async?: boolean; src?: string }[] = []
  const window: Record<string, unknown> = {}
  const document = {
    createElement: () => ({}),
    head: { appendChild: (el: { src?: string }) => appended.push(el) },
  }
  return { window, document, appended }
}

describe("loadPixel (brief §12.4)", () => {
  it("turns off autoConfig before init and history PageViews, and queues no PageView", () => {
    const t = env()
    expect(loadPixel("1234567890", t as never)).toBe(true)
    const fbq = t.window.fbq as { queue: unknown[][]; disablePushState: boolean }
    expect(fbq.disablePushState).toBe(true)
    expect(fbq.queue).toEqual([
      ["set", "autoConfig", false, "1234567890"],
      ["init", "1234567890"],
    ])
    expect(t.appended).toEqual([
      { async: true, src: "https://connect.facebook.net/en_US/fbevents.js" },
    ])
  })

  it("loads once and refuses an invalid ID", () => {
    const t = env()
    loadPixel("1234567890", t as never)
    expect(loadPixel("1234567890", t as never)).toBe(false)
    expect(t.appended).toHaveLength(1)
    const u = env()
    expect(loadPixel("12345", u as never)).toBe(false)
    expect(u.window.fbq).toBeUndefined()
  })
})
```

`lib/tracking/clicks.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { clickEvent } from "./clicks"

const html = (markup: string) => {
  document.body.innerHTML = markup
  return document.body
}

describe("clickEvent", () => {
  it("phone and email links", () => {
    html('<a href="tel:+35312345678"><span id="t">Call</span></a><a id="m" href="mailto:hello@example.com">Mail</a>')
    expect(clickEvent(document.getElementById("t"))).toEqual({
      event: "contact_click",
      params: { method: "phone" },
    })
    expect(clickEvent(document.getElementById("m"))).toEqual({
      event: "contact_click",
      params: { method: "email" },
    })
  })
  it("booking CTAs carry their location", () => {
    html('<a href="/contact" data-track="book_appointment" data-cta-location="header"><span id="x">Book</span></a>')
    expect(clickEvent(document.getElementById("x"))).toEqual({
      event: "book_appointment",
      params: { cta_location: "header" },
    })
  })
  it("ignores everything else", () => {
    html('<a id="a" href="/about">About</a><button id="b">x</button>')
    expect(clickEvent(document.getElementById("a"))).toBeNull()
    expect(clickEvent(document.getElementById("b"))).toBeNull()
    expect(clickEvent(null)).toBeNull()
  })
})
```

In `features/contact/components/contact-form.test.tsx` add (mocking `@/lib/tracking/track` with `vi.mock` and a `track` spy, and setting `window.__mkConsent`):

```tsx
it("pushes generate_lead with the submitted event id only after a 201", async () => {
  // existing helpers: render the form, fill valid values, mock fetch 201
  // …
  expect(track).toHaveBeenCalledWith({
    event: "generate_lead",
    params: { lead_source: "contact_form", form_id: "contact" },
    eventId: submittedBody.eventId,
  })
})

it("sends the browser's marketing consent with the lead", async () => {
  ;(window as never as { __mkConsent: object }).__mkConsent = {
    analytics: false,
    marketing: true,
  }
  // submit as above
  expect(submittedBody.marketingConsent).toBe(true)
})

it("does not track a rejected submission", async () => {
  // mock fetch 400 with fieldErrors
  expect(track).not.toHaveBeenCalled()
})
```

(Use the file's existing render/fill/fetch-mock helpers; `submittedBody` is the parsed JSON of the mocked `fetch` call.)

In `features/insights/components/newsletter-band.test.tsx` add: a 201 answer calls `track({ event: "sign_up", params: { method: "newsletter" } })` once; a 400 or 429 does not.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project unit lib/tracking features/contact features/insights`
Expected: FAIL (modules missing, new assertions fail).

- [ ] **Step 3: `track()` and the Pixel**

`lib/tracking/track.ts`:

```ts
import type { ConsentChoice } from "./consent"
import { META_EVENT, pushEvent, type TrackEvent } from "./events"
import { metaAllowed, pageTitle, sanitizePath, sanitizeUrl } from "./sanitize"

type TrackWindow = {
  dataLayer?: unknown[]
  fbq?: (...args: unknown[]) => void
  __mkConsent?: ConsentChoice | null
  location: { href: string; pathname: string; search: string; hash: string }
}
export type TrackEnv = {
  window: TrackWindow
  document: { title: string; referrer: string }
  newId: () => string
}
const browser = (): TrackEnv => ({
  window: window as unknown as TrackWindow,
  document,
  newId: () => crypto.randomUUID(),
})

// docs/brief.md §12.4. The dataLayer always gets the event; Meta gets a
// standard event only with marketing consent on a neutral URL (Ruling R7).
export function track(e: TrackEvent, env: TrackEnv = browser()) {
  const w = env.window
  const { eventId } = pushEvent((w.dataLayer ??= []), e, env.newId)
  const meta = META_EVENT[e.event]
  const ready = typeof w.fbq === "function"
  if (e.event === "virtual_page_view") pendingMetaPageView = !ready
  if (meta && ready && w.__mkConsent?.marketing && metaAllowed(w.location)) {
    w.fbq!("track", meta, {}, eventId ? { eventID: eventId } : undefined)
  }
  return eventId
}

export function currentPage(env: TrackEnv = browser()) {
  const { location } = env.window
  return {
    location: sanitizeUrl(location.href),
    path: sanitizePath(location.pathname),
    title: pageTitle(location.pathname, env.document.title),
    referrer: sanitizeUrl(env.document.referrer),
  }
}

// A virtual_page_view that Meta could not receive yet (Pixel not loaded) is
// sent once the Pixel loads; one that Meta did receive is never repeated.
let pendingMetaPageView = false

export function flushMetaPageView(env: TrackEnv = browser()) {
  const w = env.window
  if (!pendingMetaPageView || typeof w.fbq !== "function") return false
  pendingMetaPageView = false
  if (!w.__mkConsent?.marketing || !metaAllowed(w.location)) return false
  w.fbq("track", "PageView", {}, { eventID: env.newId() })
  return true
}

// Ruling R6: the persistent page context GTM reads for every GA4 hit.
export function pushPage(
  page: ReturnType<typeof currentPage>,
  env: TrackEnv = browser()
) {
  ;(env.window.dataLayer ??= []).push({ page })
}
```

`lib/tracking/pixel.ts`:

```ts
import { PIXEL_ID, validId } from "./ids"

type PixelFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  push: PixelFn
  loaded: boolean
  version: string
  disablePushState: boolean
  allowDuplicatePageViews: boolean
}
type Env = {
  window: Record<string, unknown>
  document: {
    createElement: (tag: "script") => { async?: boolean; src?: string }
    head: { appendChild: (el: { async?: boolean; src?: string }) => unknown }
  }
}

// Meta's base code, without its automatic PageView (brief §12.4): autoConfig
// off before init, no history-based PageViews. track() sends events.
export function loadPixel(
  id: string,
  env: Env = { window: window as never, document: document as never }
): boolean {
  const w = env.window
  if (!validId(PIXEL_ID, id) || w.fbq) return false
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  } as PixelFn
  fbq.queue = []
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = "2.0"
  fbq.disablePushState = true
  fbq.allowDuplicatePageViews = true
  w.fbq = fbq
  w._fbq ??= fbq
  fbq("set", "autoConfig", false, id)
  fbq("init", id)
  const script = env.document.createElement("script")
  script.async = true
  script.src = "https://connect.facebook.net/en_US/fbevents.js"
  env.document.head.appendChild(script)
  return true
}
```

`lib/tracking/clicks.ts`:

```ts
import type { TrackEvent } from "./events"

// Delegated click tracking. Activity-safe: hidden routes cannot be clicked,
// and nothing here queries the document for page content.
export function clickEvent(target: Element | null): TrackEvent | null {
  const book = target?.closest<HTMLElement>('[data-track="book_appointment"]')
  if (book)
    return {
      event: "book_appointment",
      params: { cta_location: book.dataset.ctaLocation || "unknown" },
    }
  const href = target?.closest("a[href]")?.getAttribute("href") ?? ""
  if (href.startsWith("tel:"))
    return { event: "contact_click", params: { method: "phone" } }
  if (href.startsWith("mailto:"))
    return { event: "contact_click", params: { method: "email" } }
  return null
}
```

- [ ] **Step 4: Components and wiring**

`features/tracking/components/route-tracker.tsx` (`"use client"`): `usePathname()`; in an effect keyed on the pathname, `const page = currentPage(); pushPage(page); track({ event: "virtual_page_view", params: { page_location: page.location, page_path: page.path, page_title: page.title } })`. Renders `null`. nuqs `replaceState` changes only the search, so it never fires (brief §12.3). Read `document.title` inside a `requestAnimationFrame` callback so a client navigation's new title has been applied.

`features/tracking/components/click-tracker.tsx` (`"use client"`): one `click` listener on `document` (capture phase) calling `clickEvent(event.target as Element)` and `track()` when non-null; removed on unmount. Renders `null`.

`features/tracking/components/marketing-scripts.tsx` (`"use client"`): props `pixelId: string | null`. `const consent = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getServerConsentSnapshot)`. In an effect: when `pixelId && consent?.marketing && loadPixel(pixelId)` returns `true`, call `flushMetaPageView()`. Renders `null`. Whichever runs first — `RouteTracker`'s `virtual_page_view` or the Pixel loading after a fresh "Accept" — the current page gets exactly one Meta PageView and GA4 never sees a second `virtual_page_view`.

`app/(site)/_cms/site-frame.tsx`: inside `SmoothScroll`'s sibling area, when `frame.active` render `<RouteTracker />`, `<ClickTracker />` and `<MarketingScripts pixelId={frame.pixelId} />`. (They are client components inside the existing Suspense boundary.)

`lib/leads/schema.ts`: add to `Hidden`:

```ts
  // The browser's marketing consent at submit time (docs/brief.md §12.5); the
  // server re-checks the cookie before anything reaches Meta (Ruling R9).
  marketingConsent: z.boolean().default(false),
```

`features/contact/components/contact-form.tsx`: replace the `trackLead` import with `import { track } from "@/lib/tracking/track"` and `import { getConsentSnapshot } from "@/lib/tracking/consent-client"`; add `marketingConsent: getConsentSnapshot()?.marketing === true` to `payload`; on `result.ok` call

```ts
track({
  event: "generate_lead",
  params: { lead_source: "contact_form", form_id: "contact" },
  eventId,
})
```

Delete `features/contact/lib/track.ts`.

`features/insights/components/newsletter-band.tsx`: on `res.status === 201`, `track({ event: "sign_up", params: { method: "newsletter" } })` before `setDone(true)`.

`features/insights/components/share-links.tsx`: after a successful copy, `track({ event: "share", params: { method: "copy_link", content_type: "article" } })`; before opening the mail link, `track({ event: "share", params: { method: "email", content_type: "article" } })`.

CTA markup (attributes only; no visual change):
- `BookCallButton` gains a `location: string` prop rendered as `data-track="book_appointment" data-cta-location={location}`; `site-header.tsx` passes `"header"`, `mobile-nav.tsx` passes `"mobile-nav"`.
- The CTA `Link`s that point at the contact page in `insights-section.tsx`, `enterprise-section.tsx`, `credentials-section.tsx`, `about-section.tsx` and `how-it-works-section.tsx` get `data-track="book_appointment"` and `data-cta-location` set to the section's block id (the `id` prop they already receive) — only when `cta.href` starts with `/contact`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit lib/tracking features tests/lint`
Expected: PASS.

- [ ] **Step 6: Build, parity**

Run: `DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build && pnpm test:parity`
Expected: build succeeds; parity PASS ≤ 0.1% (attributes only; trackers render nothing).

- [ ] **Step 7: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add -A lib/tracking features lib/leads/schema.ts "app/(site)/_cms/site-frame.tsx"
git commit -m "feat(tracking): typed track(), route and click tracking, meta pixel and lead events

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Meta Conversions API — server `Lead` inside `after()`, consent re-checked from the cookie

**Model tier:** opus (privacy-critical payload and consent re-check).

**Files:**
- Create: `server/lib/meta-capi.ts`, `server/modules/tracking/capi.ts`
- Modify: `server/modules/leads/submit.ts`, `server/modules/leads/public-routes.ts`
- Test: `server/lib/meta-capi.test.ts`, `tests/integration/api/leads-capi.test.ts`

**Interfaces:**
- Consumes: Task 1 (`readConsent`, `cookieValue`, `CONSENT_COOKIE`, `sanitizeUrl`, `PIXEL_ID`, `validId`); Task 2 (`decryptSecret`, `encryptSecret`, `CAPI_TOKEN_PURPOSE`, `readTrackingSettings`, `readConsentSettings`, `publicRequest({ cookie })`); Task 5 (`LeadSubmission.marketingConsent`).
- Produces:
  - `CAPI_VERSION = "v26.0"`, `sha256(value: string): string`.
  - `type LeadEventInput = { leadId: string; eventId: string; eventTime: Date; sourcePath: string; siteUrl: string; ip: string | null; userAgent: string; fbp?: string; fbc?: string; email: string; phone: string | null; enhancedMatching: boolean }`; `buildLeadEvent(input): CapiEvent`.
  - `type CapiResult = { ok: true; status: number } | { ok: false; status: number; message: string }`; `sendCapi(opts: { pixelId: string; token: string; events: CapiEvent[]; testEventCode?: string; fetchImpl?: typeof fetch; delays?: number[]; sleep?: (ms: number) => Promise<void> }): Promise<CapiResult>`.
  - `sendLeadToCapi(input: Omit<LeadEventInput, "siteUrl" | "enhancedMatching">): Promise<"sent" | "skipped" | "failed">`.
  - `submitLead(body, ctx: { ip; userAgent; cookie?: string | null; now? })`.
  - Audit action `tracking.capi_failed` (read by Task 7's status panel).

- [ ] **Step 1: Write the failing tests**

`server/lib/meta-capi.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import { buildLeadEvent, sendCapi, sha256 } from "./meta-capi"

const input = {
  leadId: "7d0c2f1a-0000-4000-8000-000000000001",
  eventId: "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc",
  eventTime: new Date("2026-10-10T12:00:00Z"),
  sourcePath: "/contact?topic=anxiety-stress#form",
  siteUrl: "https://magdakennedy.ie",
  ip: "203.0.113.9",
  userAgent: "Mozilla/5.0",
  fbp: "fb.1.1700000000000.123456789",
  fbc: "fb.1.1700000000000.IwAR0abc",
  email: "Ann@Example.com ",
  phone: "+353871234567",
  enhancedMatching: false,
}

describe("buildLeadEvent (brief §12.5)", () => {
  it("the default payload has no email, phone or condition-revealing URL", () => {
    const event = buildLeadEvent(input)
    expect(event).toEqual({
      event_name: "Lead",
      event_time: 1791633600,
      event_id: input.eventId,
      action_source: "website",
      event_source_url: "https://magdakennedy.ie/contact",
      user_data: {
        client_ip_address: "203.0.113.9",
        client_user_agent: "Mozilla/5.0",
        fbp: input.fbp,
        fbc: input.fbc,
        external_id: [sha256(input.leadId)],
      },
    })
    const json = JSON.stringify(event)
    for (const leak of [
      "ann@example.com",
      "Ann@Example.com",
      "353871234567",
      sha256("ann@example.com"),
      sha256("353871234567"),
      "anxiety",
      "topic",
      "?",
      "#",
      "custom_data",
      '"em"',
      '"ph"',
    ])
      expect(json).not.toContain(leak)
  })

  it("collapses article paths", () => {
    expect(
      buildLeadEvent({ ...input, sourcePath: "/insights/hypnosis-for-panic" })
        .event_source_url
    ).toBe("https://magdakennedy.ie/insights")
  })

  it("drops malformed fbp/fbc and a missing IP", () => {
    const event = buildLeadEvent({
      ...input,
      fbp: "<script>",
      fbc: undefined,
      ip: null,
    })
    expect(event.user_data).toEqual({
      client_user_agent: "Mozilla/5.0",
      external_id: [sha256(input.leadId)],
    })
  })

  it("adds normalised, hashed em and ph only with enhanced matching (Ruling R12)", () => {
    const event = buildLeadEvent({ ...input, enhancedMatching: true })
    expect(event.user_data.em).toEqual([sha256("ann@example.com")])
    expect(event.user_data.ph).toEqual([sha256("353871234567")])
  })
})

describe("sendCapi", () => {
  const ok = () => new Response(JSON.stringify({ events_received: 1 }), { status: 200 })
  const err = (status: number, message = "Invalid parameter") =>
    new Response(JSON.stringify({ error: { message } }), { status })
  const event = buildLeadEvent(input)

  it("posts to v26.0 with the token in the body, not the URL", async () => {
    const fetchImpl = vi.fn(async () => ok())
    const result = await sendCapi({
      pixelId: "1234567890",
      token: "EAAB-secret",
      events: [event],
      fetchImpl: fetchImpl as never,
    })
    expect(result).toEqual({ ok: true, status: 200 })
    const [url, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toBe("https://graph.facebook.com/v26.0/1234567890/events")
    expect(url).not.toContain("EAAB")
    expect(JSON.parse(String(init.body))).toEqual({
      data: [event],
      access_token: "EAAB-secret",
    })
  })

  it("adds test_event_code when given", async () => {
    const fetchImpl = vi.fn(async () => ok())
    await sendCapi({
      pixelId: "1234567890",
      token: "t",
      events: [event],
      testEventCode: "TEST123",
      fetchImpl: fetchImpl as never,
    })
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(JSON.parse(String(init.body)).test_event_code).toBe("TEST123")
  })

  it("retries 5xx, 429 and network errors with backoff, then succeeds", async () => {
    const sleep = vi.fn(async () => undefined)
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(err(503))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(ok())
    const result = await sendCapi({
      pixelId: "1234567890",
      token: "t",
      events: [event],
      fetchImpl,
      sleep,
    })
    expect(result.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls).toEqual([[1000], [4000]])
  })

  it("stops at once on other 4xx and never echoes the token", async () => {
    const fetchImpl = vi.fn(async () =>
      err(400, "Invalid OAuth access token: EAAB-secret")
    )
    const result = await sendCapi({
      pixelId: "1234567890",
      token: "EAAB-secret",
      events: [event],
      fetchImpl: fetchImpl as never,
      sleep: async () => undefined,
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "Invalid OAuth access token: [token]",
    })
  })
})
```

`tests/integration/api/leads-capi.test.ts`:

```ts
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
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

import { eq } from "drizzle-orm"

import { encodeConsent } from "@/lib/tracking/consent"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, leads, settings } from "@/server/db/schema"
import { CAPI_TOKEN_PURPOSE, encryptSecret } from "@/server/lib/secrets"
import { sha256 } from "@/server/lib/meta-capi"

import { insertServiceAndForm } from "../helpers/content"
import { resetDb } from "../helpers/db"
import { publicRequest, submission } from "../helpers/leads"

const CONSENT = {
  enabled: true,
  title: "t",
  body: "b",
  accept: "a",
  reject: "r",
  customise: "c",
  save: "s",
  settingsLink: "l",
  version: 1,
}
const put = (key: string, value: unknown) =>
  getDb()
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
const tracking = (over: Record<string, unknown> = {}) => ({
  metaPixelId: "1234567890",
  capiTokenEncrypted: encryptSecret("EAAB-token", CAPI_TOKEN_PURPOSE),
  enabled: { meta: true, capi: true },
  ...over,
})
const cookie = (a: 0 | 1, m: 0 | 1, v = 1) =>
  `mk_consent=${encodeConsent({
    id: "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc",
    v,
    ts: Math.floor(Date.now() / 1000) - 60,
    a,
    m,
  })}; _fbp=fb.1.1700000000000.42; _fbc=fb.1.1700000000000.IwAR0`

let fetchSpy: ReturnType<typeof vi.spyOn>
beforeEach(async () => {
  await resetDb()
  await insertServiceAndForm()
  await put("consent", CONSENT)
  await put("tracking", tracking())
  fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response('{"events_received":1}', { status: 200 }))
})
afterEach(() => fetchSpy.mockRestore())
afterAll(closeDb)

const post = (body: object, cookieHeader?: string) =>
  publicRequest("/leads", { method: "POST", body, cookie: cookieHeader })
const capiCalls = () =>
  fetchSpy.mock.calls.filter(([url]) =>
    String(url).startsWith("https://graph.facebook.com/")
  )

describe("CAPI on an accepted enquiry (brief §12.5, Ruling R9)", () => {
  it("sends Lead with the browser's event_id when cookie and flag agree", async () => {
    const body = submission({ marketingConsent: true })
    expect((await post(body, cookie(1, 1))).status).toBe(201)
    await drain()
    const calls = capiCalls()
    expect(calls).toHaveLength(1)
    expect(String(calls[0]![0])).toBe(
      "https://graph.facebook.com/v26.0/1234567890/events"
    )
    const sent = JSON.parse(String((calls[0]![1] as RequestInit).body))
    const [row] = await getDb().select().from(leads)
    expect(sent.data[0]).toMatchObject({
      event_name: "Lead",
      event_id: body.eventId,
      event_source_url: "http://localhost:3000/contact",
      user_data: {
        fbp: "fb.1.1700000000000.42",
        fbc: "fb.1.1700000000000.IwAR0",
        external_id: [sha256(row!.id)],
        client_user_agent: "vitest",
      },
    })
    expect(sent.data[0].user_data).not.toHaveProperty("em")
    expect(row).toMatchObject({
      marketingConsent: true,
      metaEventId: body.eventId,
      consent: expect.objectContaining({
        analytics: true,
        marketing: true,
        version: 1,
      }),
    })
  })

  it.each([
    ["the browser flag is false", { marketingConsent: false }, cookie(1, 1)],
    ["there is no cookie", { marketingConsent: true }, undefined],
    ["the cookie denies marketing", { marketingConsent: true }, cookie(1, 0)],
    ["a stale cookie", { marketingConsent: true }, cookie(1, 1, 2)],
  ])("sends nothing to Meta when %s", async (_label, over, header) => {
    expect((await post(submission(over), header)).status).toBe(201)
    await drain()
    expect(capiCalls()).toHaveLength(0)
  })

  it("sends nothing when the banner is off or CAPI is disabled", async () => {
    await put("consent", { ...CONSENT, enabled: false })
    await post(submission({ marketingConsent: true }), cookie(1, 1))
    await put("consent", CONSENT)
    await put("tracking", tracking({ enabled: { meta: true, capi: false } }))
    await post(submission({ marketingConsent: true }), cookie(1, 1))
    await drain()
    expect(capiCalls()).toHaveLength(0)
    // Banner off → not recorded as consent; CAPI off → consent recorded, no call.
    const rows = await getDb().select().from(leads)
    expect(rows.map((r) => r.marketingConsent).sort()).toEqual([false, true])
  })

  it("adds hashed em and ph once enhanced matching is acknowledged", async () => {
    await put(
      "tracking",
      tracking({
        enhancedMatching: {
          enabled: true,
          acknowledgedAt: "2026-10-01T00:00:00.000Z",
          acknowledgedBy: "owner@example.com",
        },
      })
    )
    const body = submission({ marketingConsent: true })
    await post(body, cookie(1, 1))
    await drain()
    const sent = JSON.parse(String((capiCalls()[0]![1] as RequestInit).body))
    expect(sent.data[0].user_data.em).toEqual([sha256(body.email)])
    expect(sent.data[0].user_data.ph).toEqual([sha256("353871234567")])
  })

  it("skips CAPI when the token cannot be decrypted", async () => {
    await put("tracking", tracking({ capiTokenEncrypted: "v1.bad.bad.bad" }))
    expect(
      (await post(submission({ marketingConsent: true }), cookie(1, 1))).status
    ).toBe(201)
    await drain()
    expect(capiCalls()).toHaveLength(0)
  })

  it("audits a failed delivery without the token or payload", async () => {
    fetchSpy.mockResolvedValue(
      new Response('{"error":{"message":"Invalid parameter"}}', { status: 400 })
    )
    await post(submission({ marketingConsent: true }), cookie(1, 1))
    await drain()
    const rows = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "tracking.capi_failed"))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.summary).toContain("400")
    expect(JSON.stringify(rows[0])).not.toMatch(/EAAB|example\.com|fbp/)
  })

  it("never sends spam to Meta", async () => {
    await post(submission({ marketingConsent: true, website: "bot" }), cookie(1, 1))
    await drain()
    expect(capiCalls()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project unit server/lib/meta-capi.test.ts`
Run: `pnpm test:integration tests/integration/api/leads-capi.test.ts`
Expected: FAIL (`./meta-capi` missing; no CAPI call made).

- [ ] **Step 3: The builder and sender**

`server/lib/meta-capi.ts`:

```ts
import "server-only"

import { createHash } from "node:crypto"

import { sanitizeUrl } from "@/lib/tracking/sanitize"

// docs/brief.md §12.5. Standard event, no custom_data, no email or phone
// unless enhanced matching is on (Ruling R12).
export const CAPI_VERSION = "v26.0"
const FB_COOKIE = /^fb\.\d\.\d{10,16}\.[\w.-]{1,200}$/
const DELAYS = [0, 1000, 4000]
const TIMEOUT_MS = 10_000

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex")

export type LeadEventInput = {
  leadId: string
  eventId: string
  eventTime: Date
  sourcePath: string
  siteUrl: string
  ip: string | null
  userAgent: string
  fbp?: string
  fbc?: string
  email: string
  phone: string | null
  enhancedMatching: boolean
}

export function buildLeadEvent(i: LeadEventInput) {
  const user_data: Record<string, unknown> = {}
  if (i.ip) user_data.client_ip_address = i.ip
  if (i.userAgent) user_data.client_user_agent = i.userAgent
  if (i.fbp && FB_COOKIE.test(i.fbp)) user_data.fbp = i.fbp
  if (i.fbc && FB_COOKIE.test(i.fbc)) user_data.fbc = i.fbc
  user_data.external_id = [sha256(i.leadId)]
  if (i.enhancedMatching) {
    user_data.em = [sha256(i.email.trim().toLowerCase())]
    if (i.phone) user_data.ph = [sha256(i.phone.replace(/\D/g, ""))]
  }
  return {
    event_name: "Lead" as const,
    event_time: Math.floor(i.eventTime.getTime() / 1000),
    event_id: i.eventId,
    action_source: "website" as const,
    event_source_url: sanitizeUrl(i.sourcePath, i.siteUrl),
    user_data,
  }
}
export type CapiEvent = ReturnType<typeof buildLeadEvent>

export type CapiResult =
  | { ok: true; status: number }
  | { ok: false; status: number; message: string }

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function sendCapi(opts: {
  pixelId: string
  token: string
  events: object[]
  testEventCode?: string
  fetchImpl?: typeof fetch
  delays?: number[]
  sleep?: (ms: number) => Promise<void>
}): Promise<CapiResult> {
  const doFetch = opts.fetchImpl ?? fetch
  const sleep = opts.sleep ?? wait
  const body = JSON.stringify({
    data: opts.events,
    access_token: opts.token,
    ...(opts.testEventCode ? { test_event_code: opts.testEventCode } : {}),
  })
  const scrub = (text: string) => text.split(opts.token).join("[token]")
  let last: CapiResult = { ok: false, status: 0, message: "Not sent" }
  for (const delay of opts.delays ?? DELAYS) {
    if (delay > 0) await sleep(delay)
    try {
      const res = await doFetch(
        `https://graph.facebook.com/${CAPI_VERSION}/${opts.pixelId}/events`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }
      )
      if (res.ok) return { ok: true, status: res.status }
      const payload = (await res.json().catch(() => ({}))) as {
        error?: { message?: unknown }
      }
      const message =
        typeof payload.error?.message === "string"
          ? scrub(payload.error.message).slice(0, 200)
          : `HTTP ${res.status}`
      last = { ok: false, status: res.status, message }
      if (res.status !== 429 && res.status < 500) return last
    } catch {
      last = { ok: false, status: 0, message: "Meta could not be reached" }
    }
  }
  return last
}
```

`server/modules/tracking/capi.ts`:

```ts
import "server-only"

import { PIXEL_ID, validId } from "@/lib/tracking/ids"
import { getEnv } from "@/server/env"
import { audit } from "@/server/lib/audit"
import {
  buildLeadEvent,
  sendCapi,
  type LeadEventInput,
} from "@/server/lib/meta-capi"
import { CAPI_TOKEN_PURPOSE, decryptSecret } from "@/server/lib/secrets"

import { readTrackingSettings } from "./settings"

// Runs inside after() (docs/brief.md §5.5 step 4). Reads the settings fresh,
// so a token change or a switch-off applies to the very next lead.
export async function sendLeadToCapi(
  input: Omit<LeadEventInput, "siteUrl" | "enhancedMatching">
): Promise<"sent" | "skipped" | "failed"> {
  const t = await readTrackingSettings()
  const pixelId = validId(PIXEL_ID, t.metaPixelId)
  if (!t.enabled.capi || !pixelId || !t.capiTokenEncrypted) return "skipped"
  const token = decryptSecret(t.capiTokenEncrypted, CAPI_TOKEN_PURPOSE)
  if (!token) {
    console.warn("[capi] stored token cannot be decrypted; skipped")
    return "skipped"
  }
  const event = buildLeadEvent({
    ...input,
    siteUrl: getEnv().SITE_URL,
    enhancedMatching: Boolean(
      t.enhancedMatching.enabled && t.enhancedMatching.acknowledgedAt
    ),
  })
  const result = await sendCapi({ pixelId, token, events: [event] })
  if (result.ok) return "sent"
  // Ruling R10: status only; never the token, the payload or the lead.
  await audit(null, {
    action: "tracking.capi_failed",
    entityType: "setting",
    entityId: "tracking",
    summary: `Meta Conversions API did not accept a Lead event (${
      result.status ? `HTTP ${result.status}` : "no answer"
    })`,
  })
  return "failed"
}
```

- [ ] **Step 4: Wire it into the lead**

`server/modules/leads/public-routes.ts`: pass `cookie: c.req.header("cookie") ?? null` in the `submitLead` context.

`server/modules/leads/submit.ts`:

- `type Ctx = { ip: string | null; userAgent: string; cookie?: string | null; now?: Date }`.
- Imports: `CONSENT_COOKIE`, `cookieValue`, `readConsent` from `@/lib/tracking/consent`; `readConsentSettings` from `@/server/modules/tracking/settings`; `sendLeadToCapi` from `@/server/modules/tracking/capi`.
- After the Turnstile spam branch, before the transaction:

```ts
  // Ruling R9: the cookie is the truth; the browser's flag must agree.
  const policy = await readConsentSettings()
  const choice = policy.enabled
    ? readConsent(
        cookieValue(ctx.cookie, CONSENT_COOKIE),
        { version: policy.version, months: policy.reconsentMonths },
        now.getTime()
      )
    : null
  const marketing = choice?.marketing === true
```

- In the insert: `marketingConsent: marketing` and

```ts
        consent: {
          privacyText: form.consent,
          analytics: choice?.analytics ?? false,
          marketing,
          version: choice ? policy.version : null,
        },
```

- After `defer(() => notifyNewLead(leadId), "lead notification")`:

```ts
  if (marketing && input.marketingConsent && input.eventId) {
    const eventId = input.eventId
    // The raw IP goes to Meta (brief §12.5) but is never stored.
    defer(
      () =>
        sendLeadToCapi({
          leadId,
          eventId,
          eventTime: now,
          sourcePath: input.sourcePath,
          ip: ctx.ip,
          userAgent: meta.userAgent,
          fbp: cookieValue(ctx.cookie, "_fbp"),
          fbc: cookieValue(ctx.cookie, "_fbc"),
          email: input.email,
          phone,
        }),
      "meta capi"
    )
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit server/lib/meta-capi.test.ts`
Run: `pnpm test:integration tests/integration/api/leads-capi.test.ts tests/integration/api/leads-public.test.ts`
Expected: PASS (the existing lead tests still see `consent: { analytics: false, marketing: false, version: null }` without a cookie).

- [ ] **Step 6: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add server/lib/meta-capi.ts server/lib/meta-capi.test.ts server/modules/tracking/capi.ts server/modules/leads tests/integration/api/leads-capi.test.ts
git commit -m "feat(tracking): meta conversions api lead with consent re-check and retries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Admin — tracking settings (write-only token, status, test event, enhanced matching), consent editor with live preview, event catalogue

**Model tier:** sonnet (large but pattern-following admin work).

**Files:**
- Create: `server/modules/tracking/schema.ts`, `server/modules/tracking/service.ts`, `server/modules/tracking/routes.ts`, `lib/tracking/banner-preview.ts`, `admin/modules/marketing/queries.ts`, `admin/modules/marketing/tracking-view.tsx`, `admin/modules/marketing/tracking-status.tsx`, `admin/modules/marketing/consent-view.tsx`, `admin/modules/marketing/events-view.tsx`, `app/(admin)/admin/(panel)/marketing/page.tsx`, `app/(admin)/admin/(panel)/marketing/consent/page.tsx`, `app/(admin)/admin/(panel)/marketing/events/page.tsx`
- Modify: `server/api/routes/admin.ts`, `lib/content/global-access.ts`, `admin/lib/api.ts`, `admin/lib/query-keys.ts`, `admin/modules/globals/global-editor.tsx`, `components/consent/consent-banner-view.tsx` (an `inline` prop), `lib/admin/nav.ts`, `lib/admin/nav.test.ts`
- Test: `tests/integration/api/tracking-admin.test.ts`, `tests/integration/api/globals-consent.test.ts`, `lib/tracking/banner-preview.test.ts`, `admin/modules/marketing/tracking-view.test.tsx`, `admin/modules/marketing/consent-view.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`EVENT_CATALOGUE`, ID patterns); Task 2 (`TrackingGlobal`, `ConsentGlobal`, `encryptSecret`, `decryptSecret`, `secretsAvailable`, `CAPI_TOKEN_PURPOSE`, `readTrackingSettings`, `readConsentSettings`); Task 4 (`ConsentBannerView`, `ConsentCopy`); Task 6 (`sendCapi`, `sha256`, audit action `tracking.capi_failed`).
- Produces:
  - `TrackingUpdate` (Zod): `{ version: number; value: { gtmId; ga4Id; metaPixelId; testEventCode; enabled: { gtm; ga4; meta; capi } }; capiToken?: string | null; enhancedMatching?: { enabled: boolean; acknowledge?: boolean } }` — `capiToken` omitted keeps, `null` removes, a string replaces.
  - `type ChannelStatus = "off" | "ready" | "missing-id" | "needs-gtm" | "needs-banner" | "needs-pixel" | "no-token" | "no-key" | "unreadable-token"`.
  - `getTrackingAdmin(): Promise<TrackingAdmin>` with `TrackingAdmin = { version: number; value: Omit<GlobalValue<"tracking">, "capiTokenEncrypted">; capiToken: { configured: boolean; readable: boolean | null }; keyAvailable: boolean; status: Record<"gtm" | "ga4" | "meta" | "capi", ChannelStatus>; lastCapiFailure: { at: string; summary: string } | null }`.
  - `saveTracking(actor: Actor, input: TrackingUpdate): Promise<TrackingAdmin>`, `sendTestEvent(actor: Actor): Promise<{ ok: boolean; status: number; message: string }>`.
  - Routes: `GET /api/v1/admin/tracking` (`tracking.read`), `PUT /api/v1/admin/tracking` (`tracking.update`), `POST /api/v1/admin/tracking/test-capi` (`tracking.update`); `type TrackingRoutes`; `trackingApi` client.
  - `EDITABLE_GLOBAL_KEYS` gains `"consent"`; `GLOBAL_ACCESS.consent = { read: { tracking: ["read"] }, update: { tracking: ["update"] } }`; `GLOBAL_LABELS.consent = "Consent banner"`.
  - `GlobalEditor` prop `onValuesChange?: (values: unknown) => void` (single-key editors only).
  - `BANNER_PREVIEW_STYLE: React.CSSProperties` (site colour and font variables for previews in the admin).
  - Nav child `{ id: "marketing-events", label: "Event catalogue", href: "/admin/marketing/events", permission: { tracking: ["read"] } }`.

- [ ] **Step 1: Write the failing integration tests**

`tests/integration/api/tracking-admin.test.ts`:

```ts
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { eq } from "drizzle-orm"

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, settings } from "@/server/db/schema"
import { resetEnvForTests } from "@/server/env"
import { audit } from "@/server/lib/audit"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

const TOKEN = "EAAB-test-token-0123456789-abcdefghij"
const value = (over: Record<string, unknown> = {}) => ({
  gtmId: "GTM-AB12CD3",
  ga4Id: "G-XYZ123",
  metaPixelId: "1234567890",
  testEventCode: "TEST123",
  enabled: { gtm: true, ga4: true, meta: true, capi: true },
  ...over,
})
const put = (cookie: string, body: object) =>
  adminRequest("/tracking", cookie, { method: "PUT", body })
const KEY = process.env.APP_ENCRYPTION_KEY

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockClear()
})
afterEach(() => {
  process.env.APP_ENCRYPTION_KEY = KEY
  resetEnvForTests()
})
afterAll(closeDb)

describe("tracking permissions (brief §7.2)", () => {
  const allowed: RoleName[] = ["owner", "admin", "marketer"]
  it.each(ROLE_NAMES)("GET /tracking as %s", async (role) => {
    const res = await adminRequest("/tracking", await cookieFor(role))
    expect(res.status).toBe(allowed.includes(role) ? 200 : 403)
  })
})

describe("PUT /tracking", () => {
  it("encrypts the token and never returns or logs it", async () => {
    const cookie = await cookieFor("marketer")
    const res = await put(cookie, { version: 0, value: value(), capiToken: TOKEN })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.capiToken).toEqual({ configured: true, readable: true })
    expect(body.value).not.toHaveProperty("capiTokenEncrypted")
    expect(JSON.stringify(body)).not.toContain(TOKEN)
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "tracking"))
    expect(JSON.stringify(row!.value)).not.toContain(TOKEN)
    expect((row!.value as { capiTokenEncrypted: string }).capiTokenEncrypted).toMatch(
      /^v1\./
    )
    const logs = await getDb().select().from(auditLogs)
    expect(JSON.stringify(logs)).not.toContain(TOKEN)
    expect(logs.find((l) => l.action === "tracking.update")!.diff).toMatchObject({
      capiToken: { from: "none", to: "replaced" },
    })
    expect(next.revalidateTag).toHaveBeenCalledWith("settings:tracking", {
      expire: 0,
    })
  })

  it("keeps the token when omitted and removes it on null", async () => {
    const cookie = await cookieFor("admin")
    await put(cookie, { version: 0, value: value(), capiToken: TOKEN })
    const kept = await (await put(cookie, { version: 1, value: value() })).json()
    expect(kept.capiToken.configured).toBe(true)
    const removed = await (
      await put(cookie, { version: 2, value: value(), capiToken: null })
    ).json()
    expect(removed.capiToken).toEqual({ configured: false, readable: null })
    expect(removed.status.capi).toBe("no-token")
  })

  it("rejects malformed IDs with field errors", async () => {
    const res = await put(await cookieFor("marketer"), {
      version: 0,
      value: value({ gtmId: "gtm-abc", metaPixelId: "12" }),
    })
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(Object.keys(error.fieldErrors)).toEqual(
      expect.arrayContaining(["gtmId", "metaPixelId"])
    )
  })

  it("explains a missing key instead of failing", async () => {
    delete process.env.APP_ENCRYPTION_KEY
    resetEnvForTests()
    const res = await put(await cookieFor("marketer"), {
      version: 0,
      value: value(),
      capiToken: TOKEN,
    })
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(error.fieldErrors.capiToken[0]).toMatch(/APP_ENCRYPTION_KEY/)
    const status = await (
      await adminRequest("/tracking", await cookieFor("owner"))
    ).json()
    expect(status.keyAvailable).toBe(false)
  })

  it("reports an unreadable token", async () => {
    await getDb()
      .insert(settings)
      .values({
        key: "tracking",
        value: { ...value(), capiTokenEncrypted: "v1.aaaa.bbbb.cccc" },
      })
    const body = await (
      await adminRequest("/tracking", await cookieFor("marketer"))
    ).json()
    expect(body.capiToken).toEqual({ configured: true, readable: false })
    expect(body.status.capi).toBe("unreadable-token")
  })

  it("answers 409 on a stale version", async () => {
    const cookie = await cookieFor("marketer")
    await put(cookie, { version: 0, value: value() })
    expect((await put(cookie, { version: 0, value: value() })).status).toBe(409)
  })
})

describe("status", () => {
  it("explains what blocks each channel", async () => {
    const cookie = await cookieFor("marketer")
    const body = await (
      await put(cookie, {
        version: 0,
        value: value({
          gtmId: "",
          enabled: { gtm: true, ga4: true, meta: true, capi: false },
        }),
      })
    ).json()
    // The consent banner is off by default.
    expect(body.status).toEqual({
      gtm: "missing-id",
      ga4: "needs-gtm",
      meta: "needs-banner",
      capi: "off",
    })
  })

  it("shows the latest CAPI failure", async () => {
    await audit(null, {
      action: "tracking.capi_failed",
      entityType: "setting",
      entityId: "tracking",
      summary: "Meta Conversions API did not accept a Lead event (HTTP 400)",
    })
    const body = await (
      await adminRequest("/tracking", await cookieFor("marketer"))
    ).json()
    expect(body.lastCapiFailure.summary).toContain("HTTP 400")
  })
})

describe("enhanced matching (Ruling R12)", () => {
  it("only an owner may change it, and only with the acknowledgement", async () => {
    const marketer = await cookieFor("marketer")
    expect(
      (
        await put(marketer, {
          version: 0,
          value: value(),
          enhancedMatching: { enabled: true, acknowledge: true },
        })
      ).status
    ).toBe(403)
    const owner = await cookieFor("owner")
    const missing = await put(owner, {
      version: 0,
      value: value(),
      enhancedMatching: { enabled: true },
    })
    expect(missing.status).toBe(400)
    expect((await missing.json()).error.fieldErrors).toHaveProperty(
      "enhancedMatching.acknowledge"
    )
    const ok = await put(owner, {
      version: 0,
      value: value(),
      enhancedMatching: { enabled: true, acknowledge: true },
    })
    expect(ok.status).toBe(200)
    expect((await ok.json()).value.enhancedMatching).toMatchObject({
      enabled: true,
      acknowledgedBy: "owner@example.com",
    })
    const [entry] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "tracking.enhanced_matching"))
    expect(entry!.summary).toMatch(/acknowledged/i)
  })

  it("a marketer can still save other fields while it is on", async () => {
    const owner = await cookieFor("owner")
    await put(owner, {
      version: 0,
      value: value(),
      enhancedMatching: { enabled: true, acknowledge: true },
    })
    const res = await put(await cookieFor("marketer"), {
      version: 1,
      value: value({ testEventCode: "OTHER1" }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).value.enhancedMatching.enabled).toBe(true)
  })
})

describe("POST /tracking/test-capi", () => {
  it("sends one test event with the test code", async () => {
    const cookie = await cookieFor("marketer")
    await put(cookie, { version: 0, value: value(), capiToken: TOKEN })
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response('{"events_received":1}', { status: 200 }))
    const res = await adminRequest("/tracking/test-capi", cookie, {
      method: "POST",
    })
    expect(await res.json()).toEqual({ ok: true, status: 200, message: "Meta received the test event" })
    const sent = JSON.parse(String((spy.mock.calls[0]![1] as RequestInit).body))
    expect(sent.test_event_code).toBe("TEST123")
    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })

  it("answers 400 when the test code or token is missing", async () => {
    const cookie = await cookieFor("marketer")
    await put(cookie, { version: 0, value: value({ testEventCode: "" }) })
    const res = await adminRequest("/tracking/test-capi", cookie, {
      method: "POST",
    })
    expect(res.status).toBe(400)
    expect(Object.keys((await res.json()).error.fieldErrors)).toEqual(
      expect.arrayContaining(["testEventCode", "capiToken"])
    )
  })
})
```

`tests/integration/api/globals-consent.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { closeDb } from "@/server/db/client"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

const COPY = {
  enabled: true,
  title: "Cookies",
  body: "Body",
  accept: "Accept all",
  reject: "Reject all",
  customise: "Customise",
  save: "Save choices",
  settingsLink: "Cookie settings",
}

beforeEach(resetDb)
afterAll(closeDb)

describe("consent through the globals API (Ruling R4)", () => {
  it("marketers edit it; editors, who can edit other globals, cannot", async () => {
    const marketer = await cookieFor("marketer")
    const res = await adminRequest("/globals/consent", marketer, {
      method: "PUT",
      body: { version: 0, value: COPY },
    })
    expect(res.status).toBe(200)
    expect(next.revalidateTag).toHaveBeenCalledWith("settings:consent", {
      expire: 0,
    })
    const editor = await cookieFor("editor")
    expect((await adminRequest("/globals/consent", editor)).status).toBe(403)
  })

  it("refuses to switch the banner on with missing labels", async () => {
    const res = await adminRequest("/globals/consent", await cookieFor("admin"), {
      method: "PUT",
      body: { version: 0, value: { ...COPY, reject: "" } },
    })
    expect(res.status).toBe(400)
  })

  it("tracking is not reachable through the generic API", async () => {
    const res = await adminRequest("/globals/tracking", await cookieFor("owner"))
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test:integration tests/integration/api/tracking-admin.test.ts tests/integration/api/globals-consent.test.ts`
Expected: FAIL (404 on `/tracking`; `consent` not editable).

- [ ] **Step 3: Schema, service, routes**

`server/modules/tracking/schema.ts`:

```ts
import "server-only"

import * as z from "zod"

export const TrackingUpdate = z.object({
  version: z.number().int().min(0),
  value: z.object({
    gtmId: z.string().max(30),
    ga4Id: z.string().max(30),
    metaPixelId: z.string().max(30),
    testEventCode: z.string().max(40),
    enabled: z.object({
      gtm: z.boolean(),
      ga4: z.boolean(),
      meta: z.boolean(),
      capi: z.boolean(),
    }),
  }),
  // Omitted: keep. null: remove. A string: replace (write-only, §12.5).
  capiToken: z.string().trim().min(20).max(500).nullable().optional(),
  enhancedMatching: z
    .object({ enabled: z.boolean(), acknowledge: z.boolean().optional() })
    .optional(),
})
export type TrackingUpdate = z.infer<typeof TrackingUpdate>
```

`server/modules/tracking/service.ts` (structure and the load-bearing parts; follow `server/modules/globals/service.ts` for the transaction, row lock, version guard and `conflictError`):

```ts
import "server-only"

import { randomUUID } from "node:crypto"

import { desc, eq } from "drizzle-orm"

import { parseGlobal, TrackingGlobal, type GlobalValue } from "@/lib/content/globals"
import { GA4_ID, GTM_ID, PIXEL_ID, validId } from "@/lib/tracking/ids"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb } from "@/server/db/client"
import { auditLogs, settings } from "@/server/db/schema"
import { getEnv } from "@/server/env"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { conflictError, topLevelDiff } from "@/server/lib/conflict"
import { sendCapi, sha256 } from "@/server/lib/meta-capi"
import {
  CAPI_TOKEN_PURPOSE,
  decryptSecret,
  encryptSecret,
  secretsAvailable,
} from "@/server/lib/secrets"

import type { TrackingUpdate } from "./schema"
import { readConsentSettings, readTrackingSettings } from "./settings"

export type ChannelStatus =
  | "off"
  | "ready"
  | "missing-id"
  | "needs-gtm"
  | "needs-banner"
  | "needs-pixel"
  | "no-token"
  | "no-key"
  | "unreadable-token"

const KEY = "tracking"

function channelStatus(t: GlobalValue<"tracking">, bannerOn: boolean) {
  const gtmOk = t.enabled.gtm && Boolean(validId(GTM_ID, t.gtmId))
  const pixel = validId(PIXEL_ID, t.metaPixelId)
  const readable = t.capiTokenEncrypted
    ? decryptSecret(t.capiTokenEncrypted, CAPI_TOKEN_PURPOSE) !== null
    : null
  const gate = (s: ChannelStatus): ChannelStatus =>
    s === "ready" && !bannerOn ? "needs-banner" : s
  return {
    gtm: !t.enabled.gtm
      ? "off"
      : !validId(GTM_ID, t.gtmId)
        ? "missing-id"
        : gate("ready"),
    ga4: !t.enabled.ga4
      ? "off"
      : !validId(GA4_ID, t.ga4Id)
        ? "missing-id"
        : !gtmOk
          ? "needs-gtm"
          : gate("ready"),
    meta: !t.enabled.meta ? "off" : !pixel ? "missing-id" : gate("ready"),
    capi: !t.enabled.capi
      ? "off"
      : !pixel
        ? "needs-pixel"
        : !t.capiTokenEncrypted
          ? "no-token"
          : !secretsAvailable()
            ? "no-key"
            : readable === false
              ? "unreadable-token"
              : gate("ready"),
  } satisfies Record<string, ChannelStatus>
}

export async function getTrackingAdmin() {
  const [row] = await getDb().select().from(settings).where(eq(settings.key, KEY))
  const t = parseGlobal("tracking", row?.value)
  const consent = await readConsentSettings()
  const [failure] = await getDb()
    .select({ at: auditLogs.createdAt, summary: auditLogs.summary })
    .from(auditLogs)
    .where(eq(auditLogs.action, "tracking.capi_failed"))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1)
  const { capiTokenEncrypted, ...value } = t
  return {
    version: row?.version ?? 0,
    value,
    capiToken: {
      configured: Boolean(capiTokenEncrypted),
      readable: capiTokenEncrypted
        ? decryptSecret(capiTokenEncrypted, CAPI_TOKEN_PURPOSE) !== null
        : null,
    },
    keyAvailable: secretsAvailable(),
    status: channelStatus(t, consent.enabled),
    lastCapiFailure: failure
      ? { at: failure.at.toISOString(), summary: failure.summary }
      : null,
  }
}
export type TrackingAdmin = Awaited<ReturnType<typeof getTrackingAdmin>>
```

`saveTracking(actor, input)` — inside one transaction, with the row locked `for("update")`:

1. Version guard exactly as `saveGlobal` (409 via `conflictError`).
2. Token: `undefined` → keep `current.capiTokenEncrypted`; `null` → `null`; a string → if `!secretsAvailable()` throw `new ApiError("VALIDATION_FAILED", "Check the highlighted fields", { capiToken: ["The server has no APP_ENCRYPTION_KEY, so the token can't be stored safely. Ask your developer to set it."] })`, else `encryptSecret(input.capiToken, CAPI_TOKEN_PURPOSE)`.
3. Enhanced matching: when `input.enhancedMatching` is present **and** `enabled` differs from the stored value: non-owners (`!actor.roles.includes("owner")`) → `new ApiError("FORBIDDEN", "Only an owner can change enhanced matching")`; turning on without `acknowledge === true` → `VALIDATION_FAILED` with `{ "enhancedMatching.acknowledge": ["Confirm the legal acknowledgement first"] }`; on → `{ enabled: true, acknowledgedAt: new Date().toISOString(), acknowledgedBy: actor.email }`, off → all cleared; write an audit row `tracking.enhanced_matching` with summary `"Turned on enhanced matching and acknowledged the legal basis"` or `"Turned off enhanced matching"`. Otherwise keep the stored value unchanged (a marketer's save never touches it).
4. `TrackingGlobal.safeParse({ ...input.value, capiTokenEncrypted, enhancedMatching })`; failure → `throw invalid(parsed.error)`.
5. Upsert `settings` (`version + 1`, `updatedBy: actor.userId`, `updatedAt: new Date()`); **no revision** (Ruling R11).
6. Audit `tracking.update` with `diff = topLevelDiff(redact(before), redact(after))`, where `redact` drops `capiTokenEncrypted` and the token change is added by hand as `capiToken: { from: current.capiTokenEncrypted ? "configured" : "none", to: "replaced" | "removed" }` only when it changed.
7. After the transaction: `invalidate([tags.setting("tracking")])`; return `getTrackingAdmin()`.

`sendTestEvent(actor)`:

```ts
export async function sendTestEvent(actor: Actor) {
  const t = await readTrackingSettings()
  const pixelId = validId(PIXEL_ID, t.metaPixelId)
  const token = t.capiTokenEncrypted
    ? decryptSecret(t.capiTokenEncrypted, CAPI_TOKEN_PURPOSE)
    : null
  const fieldErrors: Record<string, string[]> = {}
  if (!pixelId) fieldErrors.metaPixelId = ["Add the Pixel ID first"]
  if (!token) fieldErrors.capiToken = ["Add a readable access token first"]
  if (!t.testEventCode)
    fieldErrors.testEventCode = ["Add the test event code from Events Manager first"]
  if (Object.keys(fieldErrors).length)
    throw new ApiError("VALIDATION_FAILED", "Check the highlighted fields", fieldErrors)
  // A neutral PageView: Meta processes test events too (brief §12.5).
  const result = await sendCapi({
    pixelId: pixelId!,
    token: token!,
    testEventCode: t.testEventCode,
    delays: [0],
    events: [
      {
        event_name: "PageView",
        event_time: Math.floor(Date.now() / 1000),
        event_id: randomUUID(),
        action_source: "website",
        event_source_url: `${getEnv().SITE_URL}/`,
        user_data: {
          client_user_agent: "admin-test-event",
          external_id: [sha256("admin-test-event")],
        },
      },
    ],
  })
  await audit(actor, {
    action: "tracking.test_event",
    entityType: "setting",
    entityId: KEY,
    summary: result.ok ? "Sent a CAPI test event" : `CAPI test event failed (${result.status})`,
  })
  return result.ok
    ? { ok: true, status: result.status, message: "Meta received the test event" }
    : { ok: false, status: result.status, message: result.message }
}
```

`server/modules/tracking/routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { TrackingUpdate } from "./schema"
import { getTrackingAdmin, saveTracking, sendTestEvent } from "./service"

// docs/brief.md §8.3 Marketing row.
export const trackingRoutes = new Hono<AppEnv>()
  .get("/", can({ tracking: ["read"] }), async (c) =>
    c.json(await getTrackingAdmin())
  )
  .put(
    "/",
    can({ tracking: ["update"] }),
    zValidator("json", TrackingUpdate, validationHook),
    async (c) =>
      c.json(await saveTracking(c.get("actor")!, c.req.valid("json")))
  )
  .post("/test-capi", can({ tracking: ["update"] }), async (c) =>
    c.json(await sendTestEvent(c.get("actor")!))
  )

export type TrackingRoutes = typeof trackingRoutes
```

Mount in `server/api/routes/admin.ts`: `.route("/tracking", trackingRoutes)`. In `admin/lib/api.ts`: `export const trackingApi = hc<TrackingRoutes>("/api/v1/admin/tracking")`. In `admin/lib/query-keys.ts`: `tracking: { detail: ["tracking"] as const }` (follow the file's shape; extend `query-keys.test.ts` if it enumerates keys).

`lib/content/global-access.ts`: add `"consent"` to `EDITABLE_GLOBAL_KEYS`, `consent: { read: { tracking: ["read"] }, update: { tracking: ["update"] } }` to `GLOBAL_ACCESS`, `consent: "Consent banner"` to `GLOBAL_LABELS`, and update the top comment ("tracking has dedicated endpoints; consent and scripts use this API, Ruling R4"). `consent` is not added to any `SETTINGS_PAGES` entry.

- [ ] **Step 4: Run the integration tests to verify they pass**

Run: `pnpm test:integration tests/integration/api/tracking-admin.test.ts tests/integration/api/globals-consent.test.ts tests/integration/api/globals.test.ts tests/integration/api/permission-matrix.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing UI tests**

`lib/tracking/banner-preview.test.ts`: reads `app/(site)/site.css`, and for every `--color-*` / `--font-*` key in `BANNER_PREVIEW_STYLE` asserts the stylesheet's `@theme` declares the same value (same approach as `lib/seo/og-theme.test.ts`).

`admin/modules/marketing/tracking-view.test.tsx` (`// @vitest-environment jsdom`, wrap in `QueryClientProvider` and `AdminActorProvider` like `lead-drawer.test.tsx`, mock `trackingApi`):
- with `capiToken: { configured: true, readable: true }` it shows "Configured ✓", a "Replace token" button and a "Remove token" button, and **no** input holding a value;
- the "Status" section lists "Google Tag Manager", "GA4", "Meta Pixel" and "Conversions API" with the labels for the given statuses (`ready` → "Ready", `needs-banner` → "Turn on the consent banner", `needs-gtm` → "Needs GTM", `no-key` → "Server key missing (APP_ENCRYPTION_KEY)", `unreadable-token` → "Token can't be read; enter it again");
- the "Enhanced matching" section is absent for a marketer and present for an owner, whose switch stays disabled until "I confirm the practice's DPO or legal adviser approved sending hashed email and phone numbers to Meta" is ticked;
- "Send test event" calls `trackingApi["test-capi"].$post` and toasts the returned message.

`admin/modules/marketing/consent-view.test.tsx`: typing a new value into the "Title" field updates the heading inside the "Preview" region without saving; switching the preview to "Customise" shows the three category rows.

- [ ] **Step 6: Build the screens**

`components/consent/consent-banner-view.tsx`: new optional prop `inline?: boolean` → `absolute` instead of `fixed` positioning (for previews).

`lib/tracking/banner-preview.ts`: `export const BANNER_PREVIEW_STYLE` — an object of CSS custom properties (`"--color-cream"`, `"--color-pine"`, `"--color-ink"`, `"--color-clay"`, `"--color-line"`, `"--color-text-muted"`, `"--font-display"`, `"--font-sans"` … exactly the variables `ConsentBannerView` uses) with the values from `app/(site)/site.css`, typed as `React.CSSProperties`.

`admin/modules/globals/global-editor.tsx`: add `onValuesChange?: (values: unknown) => void` to `GlobalEditor`'s props and pass it to `GlobalForm` → `SchemaForm`'s existing `onValuesChange` (only when `keys.length === 1`).

`admin/modules/marketing/tracking-view.tsx` (`"use client"`): `PageHeader` "Tracking" ("IDs and switches go live as soon as you save. Nothing loads until a visitor consents."). One form (React Hook Form + `zodResolver` on a client copy of `TrackingUpdate["value"]` with the same ID patterns) with fields "GTM container ID", "GA4 measurement ID", "Meta Pixel ID", "Test event code", switches "Load Google Tag Manager", "Send GA4 through GTM", "Load the Meta Pixel", "Send leads with the Conversions API", a token block "Conversions API access token" (password input when not configured; "Configured ✓" with "Replace token" / "Remove token" when configured; disabled with the explanation when `keyAvailable` is false), and the submit button "Save tracking". API field errors map onto the fields; 409 reloads and shows "Someone else saved this a moment ago. Their version is loaded; make your change again." Includes `<TrackingStatus>` and the "Send test event" button. The "Enhanced matching" section renders only when the actor's roles include `owner`.

`admin/modules/marketing/tracking-status.tsx`: a `<section aria-labelledby>` titled "Status": one row per channel with a `StatusPill` and the label map above, plus "Last Conversions API failure: {summary} ({relative time})" when `lastCapiFailure` is set.

`admin/modules/marketing/consent-view.tsx` (`"use client"`): two columns on desktop, stacked on mobile. Left: `<GlobalEditor title="Consent banner" keys={["consent"]} onValuesChange={setDraft} />`. Right: `<section aria-label="Preview">` with a two-option toggle "First layer" / "Customise" and a 420 px tall, clipped box styled with `BANNER_PREVIEW_STYLE` holding `<ConsentBannerView inline … />` fed from the draft (falling back to the saved value). Field UI: describe `version` as "Raise this to ask every visitor again (for example after adding a new tool)" and `reconsentMonths` as "Ask again after this many months (6 at most)" via `GLOBAL_FIELD_UI.consent` in `admin/modules/globals/global-ui.ts`.

`admin/modules/marketing/events-view.tsx`: `PageHeader` "Event catalogue" ("What the site sends to the dataLayer. GTM decides what reaches GA4 and Meta, and only after consent."), then a table from `EVENT_CATALOGUE` with columns "dataLayer event", "Fires when", "Params", "GA4", "Meta", and a note: "Import docs/gtm-container.json into GTM to get these tags and triggers."

Pages (each follows `app/(admin)/admin/(panel)/seo/defaults/page.tsx`: `metadata.title`, `Suspense` + `CardSkeleton`, `Gate` calling `requirePermission(permissionFor(path))`):
- `marketing/page.tsx` → "Tracking" → `<TrackingView />`
- `marketing/consent/page.tsx` → "Consent banner" → `<ConsentView />`
- `marketing/events/page.tsx` → "Event catalogue" → `<EventsView />`

`lib/admin/nav.ts`: add the "Event catalogue" child after "Consent banner"; update `lib/admin/nav.test.ts` if it lists children.

- [ ] **Step 7: Run all tests for this task**

Run: `pnpm vitest run --project unit lib/tracking admin lib/admin "app/(admin)"`
Run: `pnpm test:integration tests/integration/api`
Expected: PASS (the existing `guarded-pages.test.ts` covers the three new pages).

- [ ] **Step 8: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add server/modules/tracking server/api/routes/admin.ts lib/content/global-access.ts lib/tracking/banner-preview.ts lib/tracking/banner-preview.test.ts admin "app/(admin)/admin/(panel)/marketing" components/consent lib/admin tests/integration/api/tracking-admin.test.ts tests/integration/api/globals-consent.test.ts
git commit -m "feat(tracking): tracking settings, consent editor with live preview and event catalogue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Custom code manager — owner-only structured snippets, `next/script` injection, kill switch

**Model tier:** sonnet (small, pattern-following).

**Files:**
- Create: `lib/tracking/routes-match.ts`, `features/tracking/components/custom-scripts.tsx`, `admin/modules/marketing/code-view.tsx`, `app/(admin)/admin/(panel)/marketing/code/page.tsx`
- Modify: `lib/content/global-access.ts`, `admin/modules/globals/global-ui.ts`, `app/(site)/_cms/site-frame.tsx`
- Test: `lib/tracking/routes-match.test.ts`, `features/tracking/components/custom-scripts.test.tsx`, `tests/integration/api/globals-scripts.test.ts`

**Interfaces:**
- Consumes: Task 2 (`ScriptsGlobal`, `ScriptSnippet`, `CUSTOM_SCRIPT_HOSTS`, `getEnv().DISABLE_CUSTOM_SCRIPTS`); Task 3 (`TrackingFrame.scripts`, already filtered for preview, kill switch, `enabled` and an inactive banner); Task 4 (`subscribeConsent`, `getConsentSnapshot`, `getServerConsentSnapshot`); Task 7 (generic globals editing for `consent`, `GlobalEditor`).
- Produces:
  - `matchesRoute(patterns: readonly string[], pathname: string): boolean`.
  - `<CustomScripts snippets={ScriptSnippet[]} />`.
  - `EDITABLE_GLOBAL_KEYS` gains `"scripts"`; `GLOBAL_ACCESS.scripts = { read: { code: ["update"] }, update: { code: ["update"] } }`; `GLOBAL_LABELS.scripts = "Custom code"`.
  - Page `/admin/marketing/code` (nav entry already exists with `code.update`).

- [ ] **Step 1: Write the failing tests**

`lib/tracking/routes-match.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { matchesRoute } from "./routes-match"

describe("matchesRoute", () => {
  it("runs everywhere when no route is given", () => {
    expect(matchesRoute([], "/anything")).toBe(true)
  })
  it("matches exact paths and prefix wildcards", () => {
    expect(matchesRoute(["/"], "/")).toBe(true)
    expect(matchesRoute(["/"], "/about")).toBe(false)
    expect(matchesRoute(["/insights/*"], "/insights/a-slug")).toBe(true)
    expect(matchesRoute(["/insights/*"], "/insights")).toBe(false)
    expect(matchesRoute(["/about", "/contact"], "/contact")).toBe(true)
  })
})
```

`features/tracking/components/custom-scripts.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({ pathname: "/" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))
vi.mock("next/script", () => ({
  default: (props: {
    id: string
    src?: string
    strategy: string
    children?: string
  }) => (
    <script
      data-testid={props.id}
      data-strategy={props.strategy}
      data-src={props.src}
    >
      {props.children}
    </script>
  ),
}))

import { saveConsent } from "@/lib/tracking/consent-client"

import { CustomScripts } from "./custom-scripts"

const snippet = (over: Record<string, unknown>) => ({
  name: "s",
  placement: "body" as const,
  src: "",
  inline: "window.x=1",
  category: "necessary" as const,
  routes: [] as string[],
  enabled: true,
  ...over,
})

beforeEach(() => {
  nav.pathname = "/"
  ;(window as never as { __mkConsent: unknown }).__mkConsent = null
})

describe("CustomScripts (brief §12.6)", () => {
  it("runs necessary snippets without consent, with the placement's strategy", () => {
    const { container } = render(
      <CustomScripts
        snippets={[
          snippet({ placement: "head" }),
          snippet({ placement: "body", inline: "window.y=1" }),
        ]}
      />
    )
    const scripts = [...container.querySelectorAll("script")]
    expect(scripts.map((s) => s.dataset.strategy)).toEqual([
      "afterInteractive",
      "lazyOnload",
    ])
  })

  it("waits for the snippet's own consent category", () => {
    const { container } = render(
      <CustomScripts
        snippets={[
          snippet({ category: "analytics" }),
          snippet({ category: "marketing", inline: "window.m=1" }),
        ]}
      />
    )
    expect(container.querySelectorAll("script")).toHaveLength(0)
    act(() => {
      saveConsent({ analytics: true, marketing: false }, "custom", {
        version: 1,
        months: 6,
      }, {
        window: window as never,
        doc: { cookie: "" },
        reload: () => undefined,
        now: Date.now,
        newId: () => "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc",
      })
    })
    const scripts = [...container.querySelectorAll("script")]
    expect(scripts.map((s) => s.textContent)).toEqual(["window.x=1"])
  })

  it("only runs on matching routes", () => {
    nav.pathname = "/about"
    const { container } = render(
      <CustomScripts snippets={[snippet({ routes: ["/insights/*"] })]} />
    )
    expect(container.querySelectorAll("script")).toHaveLength(0)
  })
})
```

`tests/integration/api/globals-scripts.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: vi.fn(),
}))

import { eq } from "drizzle-orm"

import { ROLE_NAMES } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs } from "@/server/db/schema"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

const entry = (over: Record<string, unknown> = {}) => ({
  name: "Chat widget",
  placement: "body",
  src: "",
  inline: "window.chat=1",
  category: "marketing",
  routes: [],
  enabled: true,
  ...over,
})

beforeEach(resetDb)
afterAll(closeDb)

describe("custom code is owner-only (brief §7.2 code.update)", () => {
  it.each(ROLE_NAMES)("GET /globals/scripts as %s", async (role) => {
    const res = await adminRequest("/globals/scripts", await cookieFor(role))
    expect(res.status).toBe(role === "owner" ? 200 : 403)
  })
})

describe("saving snippets", () => {
  it("audits the change with a diff and keeps a revision to roll back to", async () => {
    const owner = await cookieFor("owner")
    const res = await adminRequest("/globals/scripts", owner, {
      method: "PUT",
      body: { version: 0, value: { snippets: [entry()] } },
    })
    expect(res.status).toBe(200)
    const [log] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, "scripts"))
    expect(log!.diff).toHaveProperty("snippets")
    const revisions = await (
      await adminRequest("/globals/scripts/revisions", owner)
    ).json()
    expect(revisions.items).toHaveLength(1)
  })

  it("refuses an external script outside the allowlist", async () => {
    const res = await adminRequest("/globals/scripts", await cookieFor("owner"), {
      method: "PUT",
      body: {
        version: 0,
        value: {
          snippets: [entry({ inline: "", src: "https://evil.example/x.js" })],
        },
      },
    })
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(Object.keys(error.fieldErrors).join(" ")).toContain("src")
  })

  it("an admin, who can do almost everything else, cannot write", async () => {
    const res = await adminRequest("/globals/scripts", await cookieFor("admin"), {
      method: "PUT",
      body: { version: 0, value: { snippets: [entry()] } },
    })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run --project unit lib/tracking/routes-match.test.ts features/tracking`
Run: `pnpm test:integration tests/integration/api/globals-scripts.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementation**

`lib/tracking/routes-match.ts`:

```ts
// "/" and "/about" are exact; "/insights/*" is a prefix (not "/insights").
export function matchesRoute(patterns: readonly string[], pathname: string) {
  if (patterns.length === 0) return true
  return patterns.some((p) =>
    p.endsWith("*") ? pathname.startsWith(p.slice(0, -1)) : pathname === p
  )
}
```

`features/tracking/components/custom-scripts.tsx`:

```tsx
"use client"

import { usePathname } from "next/navigation"
import Script from "next/script"
import { useSyncExternalStore } from "react"

import type { ScriptSnippet } from "@/lib/content/globals"
import {
  getConsentSnapshot,
  getServerConsentSnapshot,
  subscribeConsent,
} from "@/lib/tracking/consent-client"
import { matchesRoute } from "@/lib/tracking/routes-match"

// docs/brief.md §12.6: next/script (raw inline scripts do not run on client
// renders). Ruling R15: head → afterInteractive, body → lazyOnload. A snippet
// runs once per document; leaving a matching route does not undo it.
export function CustomScripts({ snippets }: { snippets: ScriptSnippet[] }) {
  const pathname = usePathname()
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getServerConsentSnapshot
  )
  const allowed = (s: ScriptSnippet) =>
    s.category === "necessary" ||
    (s.category === "analytics" ? consent?.analytics : consent?.marketing)
  return snippets.map((s, i) => {
    if (!allowed(s) || !matchesRoute(s.routes, pathname)) return null
    const id = `mk-code-${i}`
    const strategy = s.placement === "head" ? "afterInteractive" : "lazyOnload"
    return s.src ? (
      <Script key={id} id={id} src={s.src} strategy={strategy} />
    ) : (
      <Script key={id} id={id} strategy={strategy}>
        {s.inline}
      </Script>
    )
  })
}
```

`app/(site)/_cms/site-frame.tsx`: render `{frame.scripts.length ? <CustomScripts snippets={frame.scripts} /> : null}` next to the other trackers (outside the `frame.active` condition, because `necessary` snippets run without a banner).

`lib/content/global-access.ts`: add `"scripts"` to `EDITABLE_GLOBAL_KEYS`, `scripts: { read: { code: ["update"] }, update: { code: ["update"] } }` to `GLOBAL_ACCESS`, and `scripts: "Custom code"` to `GLOBAL_LABELS`.

`admin/modules/globals/global-ui.ts` — `GLOBAL_FIELD_UI.scripts`:

```ts
  scripts: {
    "snippets.$.src": {
      label: "Script address",
      description: "https only, on an allowed host. Leave empty when you paste code below.",
    },
    "snippets.$.inline": { label: "Inline code", widget: "textarea" },
    "snippets.$.placement": {
      label: "When it loads",
      options: [
        { value: "head", label: "Early: as soon as the page is interactive" },
        { value: "body", label: "Late: when the browser is idle" },
      ],
    },
    "snippets.$.category": {
      label: "Needs consent for",
      options: [
        { value: "necessary", label: "Nothing (strictly necessary)" },
        { value: "analytics", label: "Analytics" },
        { value: "marketing", label: "Marketing" },
      ],
    },
    "snippets.$.routes": {
      label: "Pages",
      description: 'Leave empty for every page. "/insights/*" matches every article.',
    },
    "snippets.$.enabled": { label: "Enabled" },
  },
```

`admin/modules/marketing/code-view.tsx` (`"use client"`): props `disabled: boolean`. A warning callout (`role="note"`) above the editor: "Custom code runs with full access to every visitor's page, including the enquiry form. Only add code from a source you trust. Snippets never run in the admin or in previews, and each runs once per page load." When `disabled`, a second callout: "Custom code is switched off on the server (DISABLE_CUSTOM_SCRIPTS). Saved snippets will not run until it is turned back on." Then `<GlobalEditor title="Custom code" keys={["scripts"]} />` (its History sheet is the rollback, §12.6).

`app/(admin)/admin/(panel)/marketing/code/page.tsx`: same `Gate` pattern (`requirePermission(permissionFor("/admin/marketing/code"))`), metadata title "Custom code", renders `<CodeView disabled={getEnv().DISABLE_CUSTOM_SCRIPTS} />`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit lib/tracking features/tracking admin "app/(admin)"`
Run: `pnpm test:integration tests/integration/api/globals-scripts.test.ts tests/integration/api/globals.test.ts`
Expected: PASS.

- [ ] **Step 5: Build, parity**

Run: `DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build && pnpm test:parity`
Expected: build succeeds; parity PASS ≤ 0.1% (no snippets seeded).

- [ ] **Step 6: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add lib/tracking/routes-match.ts lib/tracking/routes-match.test.ts features/tracking admin "app/(admin)/admin/(panel)/marketing/code" lib/content/global-access.ts "app/(site)/_cms/site-frame.tsx" tests/integration/api/globals-scripts.test.ts
git commit -m "feat(tracking): owner-only custom code with consent categories and kill switch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: CSP and security headers, the GTM container, acceptance E2E with network assertions, setup notes, phase exit

**Model tier:** sonnet (config, fixtures and E2E with given code).

**Files:**
- Create: `lib/tracking/csp.ts`, `server/modules/security/csp-report.ts`, `docs/gtm-container.json`, `tests/tracking/gtm-container.test.ts`, `playwright.tracking.config.ts`, `tests/e2e/support/tracking.ts`, `tests/e2e/tracking/consent.spec.ts`, `tests/e2e/navigation/headers.spec.ts`
- Modify: `next.config.ts`, `server/api/routes/public.ts`, `playwright.config.ts`, `package.json` (script), `.github/workflows/ci.yml`, `docs/deploy-dokploy.md`, `docs/plan.md` (phase-map link only), `.superpowers/sdd/plan/progress.md`
- Test: `lib/tracking/csp.test.ts`, `tests/tracking/gtm-container.test.ts`, `tests/integration/api/csp-report.test.ts`, the two E2E specs

**Interfaces:**
- Consumes: everything above; `CUSTOM_SCRIPT_HOSTS` (Task 2); `EVENT_CATALOGUE` (Task 1); `encodeConsent` (Task 1); `STORAGE.owner` and `runSql` (existing E2E support).
- Produces:
  - `buildCsp(opts: { dev: boolean; mediaOrigin: string | null; customHosts?: readonly string[] }): string`, `securityHeaders(opts): { source: string; headers: { key: string; value: string }[] }[]`, `CSP_REPORT_PATH = "/api/v1/public/csp-report"`.
  - `POST /api/v1/public/csp-report` → 204.
  - `docs/gtm-container.json` (GTM export format 2).
  - `pnpm test:e2e:tracking`.

- [ ] **Step 1: Write the failing unit tests**

`lib/tracking/csp.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { buildCsp, CSP_REPORT_PATH, securityHeaders } from "./csp"

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.split(" ")
    .slice(1) ?? []

describe("buildCsp (brief §12.6, Ruling R1)", () => {
  const csp = buildCsp({ dev: false, mediaOrigin: "https://media.example.com" })

  it("allows exactly the vendors the site uses", () => {
    expect(directive(csp, "script-src")).toEqual([
      "'self'",
      "'unsafe-inline'",
      "https://www.googletagmanager.com",
      "https://connect.facebook.net",
      "https://challenges.cloudflare.com",
    ])
    for (const host of [
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      "https://www.google.com",
      "https://www.google.ie",
      "https://www.facebook.com",
    ]) {
      expect(directive(csp, "connect-src")).toContain(host)
      expect(directive(csp, "img-src")).toContain(host)
    }
    expect(directive(csp, "img-src")).toContain("https://media.example.com")
    expect(directive(csp, "frame-src")).toEqual([
      "'self'",
      "https://www.googletagmanager.com",
      "https://challenges.cloudflare.com",
    ])
  })

  it("locks down the rest", () => {
    expect(directive(csp, "object-src")).toEqual(["'none'"])
    expect(directive(csp, "base-uri")).toEqual(["'self'"])
    expect(directive(csp, "form-action")).toEqual(["'self'"])
    expect(directive(csp, "frame-ancestors")).toEqual(["'self'"])
    expect(directive(csp, "report-uri")).toEqual([CSP_REPORT_PATH])
  })

  it("uses no nonce, and unsafe-eval only in development", () => {
    expect(csp).not.toMatch(/nonce-|unsafe-eval/)
    expect(directive(buildCsp({ dev: true, mediaOrigin: null }), "script-src")).toContain(
      "'unsafe-eval'"
    )
  })

  it("adds allowlisted custom-code hosts to script-src and connect-src", () => {
    const withHost = buildCsp({
      dev: false,
      mediaOrigin: null,
      customHosts: ["widget.example.org"],
    })
    expect(directive(withHost, "script-src")).toContain("https://widget.example.org")
    expect(directive(withHost, "connect-src")).toContain("https://widget.example.org")
  })
})

describe("securityHeaders (Ruling R20)", () => {
  const rules = securityHeaders({ dev: false, mediaOrigin: null })
  const find = (key: string) =>
    rules.filter((r) => r.headers.some((h) => h.key === key))

  it("ships the CSP as Report-Only on every path", () => {
    const [rule] = find("Content-Security-Policy-Report-Only")
    expect(rule!.source).toBe("/:path*")
    expect(find("Content-Security-Policy")).toHaveLength(0)
  })

  it("sends the brief's security headers", () => {
    const all = Object.fromEntries(
      rules.flatMap((r) => r.headers.map((h) => [h.key, h.value]))
    )
    expect(all).toMatchObject({
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Robots-Tag": "noindex, nofollow",
    })
  })

  it("leaves the reset page's no-referrer to proxy and tags only /api for robots", () => {
    const [referrer] = find("Referrer-Policy")
    expect(referrer!.source).toBe("/((?!admin/reset-password).*)")
    const [robots] = find("X-Robots-Tag")
    expect(robots!.source).toBe("/api/:path*")
  })
})
```

`tests/tracking/gtm-container.test.ts`:

```ts
import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { EVENT_CATALOGUE } from "@/lib/tracking/events"

type Param = { key?: string; value?: string; list?: { map?: Param[] }[] }
type Tag = {
  name: string
  type: string
  paused?: boolean
  parameter: Param[]
  firingTriggerId: string[]
  consentSettings?: {
    consentStatus: string
    consentType?: { list: { value: string }[] }
  }
}

const raw = readFileSync(
  path.join(import.meta.dirname, "../../docs/gtm-container.json"),
  "utf8"
)
const container = JSON.parse(raw) as {
  exportFormatVersion: number
  containerVersion: {
    container: { usageContext: string[] }
    tag: Tag[]
    trigger: { triggerId: string; customEventFilter: { parameter: Param[] }[] }[]
    variable: { name: string }[]
  }
}
const v = container.containerVersion
const INIT_ALL_PAGES = "2147479573"
const settingsOf = (tag: Tag, key: string) =>
  Object.fromEntries(
    (tag.parameter.find((p) => p.key === key)?.list ?? []).map((row) => [
      row.map!.find((m) => m.key === "parameter")!.value,
      row.map!.find((m) => m.key === "parameterValue")!.value,
    ])
  )

describe("docs/gtm-container.json", () => {
  it("is an importable GTM web export", () => {
    expect(container.exportFormatVersion).toBe(2)
    expect(v.container.usageContext).toEqual(["WEB"])
  })

  it("fires every tag from a trigger that exists", () => {
    const ids = new Set([INIT_ALL_PAGES, ...v.trigger.map((t) => t.triggerId)])
    for (const tag of v.tag)
      for (const id of tag.firingTriggerId) expect(ids).toContain(id)
  })

  it("resolves every {{variable}} it references", () => {
    const names = new Set(["_event", ...v.variable.map((x) => x.name)])
    for (const [, name] of raw.matchAll(/\{\{([^}]+)\}\}/g))
      expect(names).toContain(name)
  })

  it("has a trigger for exactly the event catalogue", () => {
    const events = v.trigger.map(
      (t) => t.customEventFilter[0]!.parameter.find((p) => p.key === "arg1")!.value
    )
    expect(events.sort()).toEqual(EVENT_CATALOGUE.map((e) => e.event).sort())
  })

  it("configures GA4 without automatic page views, signals or ads personalisation", () => {
    const google = v.tag.find((t) => t.type === "googtag")!
    expect(settingsOf(google, "configSettingsTable")).toEqual({
      send_page_view: "false",
      allow_google_signals: "false",
      allow_ad_personalization_signals: "false",
      page_location: "{{DLV - page.location}}",
      page_title: "{{DLV - page.title}}",
      page_referrer: "{{DLV - page.referrer}}",
    })
    const pageView = v.tag.find(
      (t) => t.type === "gaawe" && t.parameter.some((p) => p.value === "page_view")
    )!
    expect(pageView).toBeDefined()
    for (const tag of v.tag.filter((t) => t.type === "gaawe"))
      expect(
        tag.parameter.find((p) => p.key === "eventSettingsVariable")!.value
      ).toBe("{{GA4 - Shared event settings}}")
  })

  it("ships Meta tags paused and requiring additional consent (Ruling R7)", () => {
    const meta = v.tag.filter((t) => t.name.startsWith("Meta - "))
    expect(meta.length).toBeGreaterThan(0)
    for (const tag of meta) {
      expect(tag.paused).toBe(true)
      expect(tag.consentSettings!.consentStatus).toBe("NEEDED")
      expect(tag.consentSettings!.consentType!.list.map((x) => x.value)).toContain(
        "ad_storage"
      )
    }
  })

  it("never passes URLs through or bypasses consent", () => {
    expect(raw).not.toMatch(/url_passthrough|noscript|ns\.html/)
  })
})
```

`tests/integration/api/csp-report.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { app } from "@/server/api/app"
import { closeDb } from "@/server/db/client"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("POST /public/csp-report", () => {
  it("logs a sanitised violation and answers 204", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const res = await app.request("/api/v1/public/csp-report", {
      method: "POST",
      headers: { "content-type": "application/csp-report", "x-real-ip": "198.51.100.7" },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": "https://site.ie/newsletter/unsubscribe?token=secret",
          "violated-directive": "script-src-elem",
          "blocked-uri": "https://evil.example/x.js?a=1",
        },
      }),
    })
    expect(res.status).toBe(204)
    const logged = warn.mock.calls.flat().join(" ")
    expect(logged).toContain("script-src-elem")
    expect(logged).toContain("https://evil.example/x.js")
    expect(logged).not.toContain("secret")
    warn.mockRestore()
  })

  it("ignores junk", async () => {
    const res = await app.request("/api/v1/public/csp-report", {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: "not json",
    })
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run --project unit lib/tracking/csp.test.ts tests/tracking`
Run: `pnpm test:integration tests/integration/api/csp-report.test.ts`
Expected: FAIL (modules and the container file missing).

- [ ] **Step 3: CSP, headers and the report endpoint**

`lib/tracking/csp.ts` (imported by `next.config.ts` through a **relative** path, so it and `./hosts` must stay free of `@/` imports and `server-only`):

```ts
import { CUSTOM_SCRIPT_HOSTS } from "./hosts"

// docs/brief.md §12.6 and §15. Allowlist, no nonce (Ruling R1):
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md,
// "Static vs Dynamic Rendering with CSP" and "Without Nonces".
export const CSP_REPORT_PATH = "/api/v1/public/csp-report"

const GOOGLE = [
  "https://www.googletagmanager.com",
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  // Each Google TLD separately (brief §12.6); signals and ads are off.
  "https://www.google.com",
  "https://www.google.ie",
]
const META = ["https://www.facebook.com"]

type Opts = {
  dev: boolean
  mediaOrigin: string | null
  customHosts?: readonly string[]
}

export function buildCsp({
  dev,
  mediaOrigin,
  customHosts = CUSTOM_SCRIPT_HOSTS,
}: Opts) {
  const custom = customHosts.map((h) => `https://${h}`)
  const media = mediaOrigin ? [mediaOrigin] : []
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
      "https://www.googletagmanager.com",
      "https://connect.facebook.net",
      "https://challenges.cloudflare.com",
      ...custom,
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...GOOGLE, ...META, ...media],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      ...GOOGLE,
      ...META,
      "https://connect.facebook.net",
      ...media,
      ...custom,
    ],
    "frame-src": [
      "'self'",
      "https://www.googletagmanager.com",
      "https://challenges.cloudflare.com",
    ],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'self'"],
    "report-uri": [CSP_REPORT_PATH],
  }
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ")
}

export function securityHeaders(opts: Opts) {
  return [
    {
      source: "/:path*",
      headers: [
        // Report-Only until Phase 10 enforces it (brief §12.6).
        { key: "Content-Security-Policy-Report-Only", value: buildCsp(opts) },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
    {
      // proxy.ts sends no-referrer on the reset page (its URL holds a token).
      source: "/((?!admin/reset-password).*)",
      headers: [
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
    {
      source: "/api/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
  ]
}
```

`next.config.ts`: `import { securityHeaders } from "./lib/tracking/csp"` and add

```ts
  // Ruling R1/R20. Computed at build: MEDIA_PUBLIC_URL is already a build arg.
  async headers() {
    const media = process.env.MEDIA_PUBLIC_URL
    return securityHeaders({
      dev: process.env.NODE_ENV === "development",
      mediaOrigin: media ? new URL(media).origin : null,
    })
  },
```

`server/modules/security/csp-report.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { sanitizeUrl } from "@/lib/tracking/sanitize"
import { publicLimit } from "@/server/api/middleware/public-limit"
import type { AppEnv } from "@/server/api/types"

// Report-Only CSP violations (Ruling R1). Logged without query strings: the
// document may be a newsletter link with a token in it.
export const cspReportRoutes = new Hono<AppEnv>().post(
  "/",
  publicLimit("csp", { limit: 60, windowMs: 10 * 60_000 }),
  async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      "csp-report"?: Record<string, unknown>
    } | null
    const report = body?.["csp-report"]
    if (report) {
      const text = (key: string) =>
        typeof report[key] === "string" ? (report[key] as string) : ""
      console.warn(
        "[csp]",
        text("violated-directive").slice(0, 60),
        sanitizeUrl(text("blocked-uri")) || text("blocked-uri").slice(0, 20),
        sanitizeUrl(text("document-uri"))
      )
    }
    return c.body(null, 204)
  }
)
```

Mount in `server/api/routes/public.ts`: `.route("/csp-report", cspReportRoutes)`. (Hono's `c.req.json()` parses regardless of the `application/csp-report` content type.)

- [ ] **Step 4: The GTM container**

Create `docs/gtm-container.json` with exactly this content (Ruling R5–R7; import it in GTM with **Admin → Import Container → Merge**, then replace `GTM-XXXXXXX`):

```json
{
  "exportFormatVersion": 2,
  "exportTime": "2026-10-10 00:00:00",
  "containerVersion": {
    "path": "accounts/0/containers/0/versions/0",
    "accountId": "0",
    "containerId": "0",
    "containerVersionId": "0",
    "name": "Consent-first tracking (Phase 8)",
    "description": "Basic consent mode: the site loads GTM only after consent. GA4 reads its measurement ID and sanitised page context from the dataLayer. Meta tags are paused because the site loads the Pixel itself (Ruling R7).",
    "container": {"path": "accounts/0/containers/0", "accountId": "0", "containerId": "0", "name": "Magda Kennedy", "publicId": "GTM-XXXXXXX", "usageContext": ["WEB"]},
    "builtInVariable": [
      {"accountId": "0", "containerId": "0", "type": "EVENT", "name": "Event"}
    ],
    "variable": [
      {"accountId": "0", "containerId": "0", "variableId": "11", "name": "DLV - ga4_measurement_id", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "ga4_measurement_id"}]},
      {"accountId": "0", "containerId": "0", "variableId": "12", "name": "DLV - page.location", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "page.location"}]},
      {"accountId": "0", "containerId": "0", "variableId": "13", "name": "DLV - page.path", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "page.path"}]},
      {"accountId": "0", "containerId": "0", "variableId": "14", "name": "DLV - page.title", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "page.title"}]},
      {"accountId": "0", "containerId": "0", "variableId": "15", "name": "DLV - page.referrer", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "page.referrer"}]},
      {"accountId": "0", "containerId": "0", "variableId": "16", "name": "DLV - event_params.lead_source", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "event_params.lead_source"}]},
      {"accountId": "0", "containerId": "0", "variableId": "17", "name": "DLV - event_params.form_id", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "event_params.form_id"}]},
      {"accountId": "0", "containerId": "0", "variableId": "18", "name": "DLV - event_params.event_id", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "event_params.event_id"}]},
      {"accountId": "0", "containerId": "0", "variableId": "19", "name": "DLV - event_params.method", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "event_params.method"}]},
      {"accountId": "0", "containerId": "0", "variableId": "20", "name": "DLV - event_params.cta_location", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "event_params.cta_location"}]},
      {"accountId": "0", "containerId": "0", "variableId": "21", "name": "DLV - event_params.content_type", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "event_params.content_type"}]},
      {"accountId": "0", "containerId": "0", "variableId": "22", "name": "DLV - event_params.page_location", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "event_params.page_location"}]},
      {"accountId": "0", "containerId": "0", "variableId": "23", "name": "DLV - event_params.page_path", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "event_params.page_path"}]},
      {"accountId": "0", "containerId": "0", "variableId": "24", "name": "DLV - event_params.page_title", "type": "v", "parameter": [{"type": "INTEGER", "key": "dataLayerVersion", "value": "2"}, {"type": "BOOLEAN", "key": "setDefaultValue", "value": "false"}, {"type": "TEMPLATE", "key": "name", "value": "event_params.page_title"}]},
      {"accountId": "0", "containerId": "0", "variableId": "25", "name": "GA4 - Shared event settings", "type": "gtes", "parameter": [{"type": "LIST", "key": "eventSettingsTable", "list": [{"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "page_location"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - page.location}}"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "page_title"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - page.title}}"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "page_referrer"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - page.referrer}}"}]}]}]}
    ],
    "trigger": [
      {"accountId": "0", "containerId": "0", "triggerId": "101", "name": "CE - virtual_page_view", "type": "CUSTOM_EVENT", "customEventFilter": [{"type": "EQUALS", "parameter": [{"type": "TEMPLATE", "key": "arg0", "value": "{{_event}}"}, {"type": "TEMPLATE", "key": "arg1", "value": "virtual_page_view"}]}]},
      {"accountId": "0", "containerId": "0", "triggerId": "102", "name": "CE - generate_lead", "type": "CUSTOM_EVENT", "customEventFilter": [{"type": "EQUALS", "parameter": [{"type": "TEMPLATE", "key": "arg0", "value": "{{_event}}"}, {"type": "TEMPLATE", "key": "arg1", "value": "generate_lead"}]}]},
      {"accountId": "0", "containerId": "0", "triggerId": "103", "name": "CE - contact_click", "type": "CUSTOM_EVENT", "customEventFilter": [{"type": "EQUALS", "parameter": [{"type": "TEMPLATE", "key": "arg0", "value": "{{_event}}"}, {"type": "TEMPLATE", "key": "arg1", "value": "contact_click"}]}]},
      {"accountId": "0", "containerId": "0", "triggerId": "104", "name": "CE - book_appointment", "type": "CUSTOM_EVENT", "customEventFilter": [{"type": "EQUALS", "parameter": [{"type": "TEMPLATE", "key": "arg0", "value": "{{_event}}"}, {"type": "TEMPLATE", "key": "arg1", "value": "book_appointment"}]}]},
      {"accountId": "0", "containerId": "0", "triggerId": "105", "name": "CE - sign_up", "type": "CUSTOM_EVENT", "customEventFilter": [{"type": "EQUALS", "parameter": [{"type": "TEMPLATE", "key": "arg0", "value": "{{_event}}"}, {"type": "TEMPLATE", "key": "arg1", "value": "sign_up"}]}]},
      {"accountId": "0", "containerId": "0", "triggerId": "106", "name": "CE - share", "type": "CUSTOM_EVENT", "customEventFilter": [{"type": "EQUALS", "parameter": [{"type": "TEMPLATE", "key": "arg0", "value": "{{_event}}"}, {"type": "TEMPLATE", "key": "arg1", "value": "share"}]}]}
    ],
    "tag": [
      {"accountId": "0", "containerId": "0", "tagId": "1", "name": "Google tag - GA4 (no automatic page view)", "type": "googtag", "parameter": [{"type": "TEMPLATE", "key": "tagId", "value": "{{DLV - ga4_measurement_id}}"}, {"type": "LIST", "key": "configSettingsTable", "list": [{"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "send_page_view"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "false"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "allow_google_signals"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "false"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "allow_ad_personalization_signals"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "false"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "page_location"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - page.location}}"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "page_title"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - page.title}}"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "page_referrer"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - page.referrer}}"}]}]}], "firingTriggerId": ["2147479573"], "tagFiringOption": "ONCE_PER_EVENT"},
      {"accountId": "0", "containerId": "0", "tagId": "2", "name": "GA4 event - page_view", "type": "gaawe", "parameter": [{"type": "TEMPLATE", "key": "eventName", "value": "page_view"}, {"type": "TEMPLATE", "key": "measurementIdOverride", "value": "{{DLV - ga4_measurement_id}}"}, {"type": "TEMPLATE", "key": "eventSettingsVariable", "value": "{{GA4 - Shared event settings}}"}, {"type": "LIST", "key": "eventSettingsTable", "list": [{"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "page_location"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.page_location}}"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "page_path"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.page_path}}"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "page_title"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.page_title}}"}]}]}, {"type": "BOOLEAN", "key": "sendEcommerceData", "value": "false"}], "firingTriggerId": ["101"], "tagFiringOption": "ONCE_PER_EVENT"},
      {"accountId": "0", "containerId": "0", "tagId": "3", "name": "GA4 event - generate_lead", "type": "gaawe", "parameter": [{"type": "TEMPLATE", "key": "eventName", "value": "generate_lead"}, {"type": "TEMPLATE", "key": "measurementIdOverride", "value": "{{DLV - ga4_measurement_id}}"}, {"type": "TEMPLATE", "key": "eventSettingsVariable", "value": "{{GA4 - Shared event settings}}"}, {"type": "LIST", "key": "eventSettingsTable", "list": [{"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "lead_source"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.lead_source}}"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "form_id"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.form_id}}"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "event_id"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.event_id}}"}]}]}, {"type": "BOOLEAN", "key": "sendEcommerceData", "value": "false"}], "firingTriggerId": ["102"], "tagFiringOption": "ONCE_PER_EVENT"},
      {"accountId": "0", "containerId": "0", "tagId": "4", "name": "GA4 event - contact_click", "type": "gaawe", "parameter": [{"type": "TEMPLATE", "key": "eventName", "value": "contact_click"}, {"type": "TEMPLATE", "key": "measurementIdOverride", "value": "{{DLV - ga4_measurement_id}}"}, {"type": "TEMPLATE", "key": "eventSettingsVariable", "value": "{{GA4 - Shared event settings}}"}, {"type": "LIST", "key": "eventSettingsTable", "list": [{"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "method"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.method}}"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "event_id"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.event_id}}"}]}]}, {"type": "BOOLEAN", "key": "sendEcommerceData", "value": "false"}], "firingTriggerId": ["103"], "tagFiringOption": "ONCE_PER_EVENT"},
      {"accountId": "0", "containerId": "0", "tagId": "5", "name": "GA4 event - book_appointment", "type": "gaawe", "parameter": [{"type": "TEMPLATE", "key": "eventName", "value": "book_appointment"}, {"type": "TEMPLATE", "key": "measurementIdOverride", "value": "{{DLV - ga4_measurement_id}}"}, {"type": "TEMPLATE", "key": "eventSettingsVariable", "value": "{{GA4 - Shared event settings}}"}, {"type": "LIST", "key": "eventSettingsTable", "list": [{"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "cta_location"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.cta_location}}"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "event_id"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.event_id}}"}]}]}, {"type": "BOOLEAN", "key": "sendEcommerceData", "value": "false"}], "firingTriggerId": ["104"], "tagFiringOption": "ONCE_PER_EVENT"},
      {"accountId": "0", "containerId": "0", "tagId": "6", "name": "GA4 event - sign_up", "type": "gaawe", "parameter": [{"type": "TEMPLATE", "key": "eventName", "value": "sign_up"}, {"type": "TEMPLATE", "key": "measurementIdOverride", "value": "{{DLV - ga4_measurement_id}}"}, {"type": "TEMPLATE", "key": "eventSettingsVariable", "value": "{{GA4 - Shared event settings}}"}, {"type": "LIST", "key": "eventSettingsTable", "list": [{"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "method"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.method}}"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "event_id"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.event_id}}"}]}]}, {"type": "BOOLEAN", "key": "sendEcommerceData", "value": "false"}], "firingTriggerId": ["105"], "tagFiringOption": "ONCE_PER_EVENT"},
      {"accountId": "0", "containerId": "0", "tagId": "7", "name": "GA4 event - share", "type": "gaawe", "parameter": [{"type": "TEMPLATE", "key": "eventName", "value": "share"}, {"type": "TEMPLATE", "key": "measurementIdOverride", "value": "{{DLV - ga4_measurement_id}}"}, {"type": "TEMPLATE", "key": "eventSettingsVariable", "value": "{{GA4 - Shared event settings}}"}, {"type": "LIST", "key": "eventSettingsTable", "list": [{"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "method"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.method}}"}]}, {"type": "MAP", "map": [{"type": "TEMPLATE", "key": "parameter", "value": "content_type"}, {"type": "TEMPLATE", "key": "parameterValue", "value": "{{DLV - event_params.content_type}}"}]}]}, {"type": "BOOLEAN", "key": "sendEcommerceData", "value": "false"}], "firingTriggerId": ["106"], "tagFiringOption": "ONCE_PER_EVENT"},
      {"accountId": "0", "containerId": "0", "tagId": "8", "name": "Meta - PageView (paused: the site loads the Pixel itself)", "type": "html", "paused": true, "parameter": [{"type": "TEMPLATE", "key": "html", "value": "<script>if(window.fbq)window.fbq('track','PageView',{},{eventID:{{DLV - event_params.event_id}}})</script>"}, {"type": "BOOLEAN", "key": "supportDocumentWrite", "value": "false"}], "firingTriggerId": ["101"], "tagFiringOption": "ONCE_PER_EVENT", "consentSettings": {"consentStatus": "NEEDED", "consentType": {"type": "LIST", "list": [{"type": "TEMPLATE", "value": "ad_storage"}, {"type": "TEMPLATE", "value": "ad_user_data"}]}}},
      {"accountId": "0", "containerId": "0", "tagId": "9", "name": "Meta - Lead (paused: the site loads the Pixel itself)", "type": "html", "paused": true, "parameter": [{"type": "TEMPLATE", "key": "html", "value": "<script>if(window.fbq)window.fbq('track','Lead',{},{eventID:{{DLV - event_params.event_id}}})</script>"}, {"type": "BOOLEAN", "key": "supportDocumentWrite", "value": "false"}], "firingTriggerId": ["102"], "tagFiringOption": "ONCE_PER_EVENT", "consentSettings": {"consentStatus": "NEEDED", "consentType": {"type": "LIST", "list": [{"type": "TEMPLATE", "value": "ad_storage"}, {"type": "TEMPLATE", "value": "ad_user_data"}]}}},
      {"accountId": "0", "containerId": "0", "tagId": "10", "name": "Meta - Contact (paused: the site loads the Pixel itself)", "type": "html", "paused": true, "parameter": [{"type": "TEMPLATE", "key": "html", "value": "<script>if(window.fbq)window.fbq('track','Contact',{},{eventID:{{DLV - event_params.event_id}}})</script>"}, {"type": "BOOLEAN", "key": "supportDocumentWrite", "value": "false"}], "firingTriggerId": ["103"], "tagFiringOption": "ONCE_PER_EVENT", "consentSettings": {"consentStatus": "NEEDED", "consentType": {"type": "LIST", "list": [{"type": "TEMPLATE", "value": "ad_storage"}, {"type": "TEMPLATE", "value": "ad_user_data"}]}}},
      {"accountId": "0", "containerId": "0", "tagId": "11", "name": "Meta - Schedule (paused: the site loads the Pixel itself)", "type": "html", "paused": true, "parameter": [{"type": "TEMPLATE", "key": "html", "value": "<script>if(window.fbq)window.fbq('track','Schedule',{},{eventID:{{DLV - event_params.event_id}}})</script>"}, {"type": "BOOLEAN", "key": "supportDocumentWrite", "value": "false"}], "firingTriggerId": ["104"], "tagFiringOption": "ONCE_PER_EVENT", "consentSettings": {"consentStatus": "NEEDED", "consentType": {"type": "LIST", "list": [{"type": "TEMPLATE", "value": "ad_storage"}, {"type": "TEMPLATE", "value": "ad_user_data"}]}}},
      {"accountId": "0", "containerId": "0", "tagId": "12", "name": "Meta - CompleteRegistration (paused: the site loads the Pixel itself)", "type": "html", "paused": true, "parameter": [{"type": "TEMPLATE", "key": "html", "value": "<script>if(window.fbq)window.fbq('track','CompleteRegistration',{},{eventID:{{DLV - event_params.event_id}}})</script>"}, {"type": "BOOLEAN", "key": "supportDocumentWrite", "value": "false"}], "firingTriggerId": ["105"], "tagFiringOption": "ONCE_PER_EVENT", "consentSettings": {"consentStatus": "NEEDED", "consentType": {"type": "LIST", "list": [{"type": "TEMPLATE", "value": "ad_storage"}, {"type": "TEMPLATE", "value": "ad_user_data"}]}}}
    ]
  }
}
```

- [ ] **Step 5: Run the unit and integration tests to verify they pass**

Run: `pnpm vitest run --project unit lib/tracking tests/tracking`
Run: `pnpm test:integration tests/integration/api/csp-report.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the acceptance E2E (network assertions)**

`playwright.config.ts`: add `"**/tracking/**"` to every viewport project's `testIgnore` (the admin projects only match `ADMIN` already).

`playwright.tracking.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test"

import base from "./playwright.config"

// Ruling R19: tracking specs switch shared site settings on, so they run in
// their own invocation (fresh seed via globalSetup), never beside parity or
// the other public specs.
export default defineConfig({
  ...base,
  projects: [
    base.projects!.find((p) => p.name === "setup")!,
    {
      name: "tracking",
      testMatch: /tracking\/.*\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
})
```

`package.json` scripts: `"test:e2e:tracking": "playwright test --config playwright.tracking.config.ts"`.

`.github/workflows/ci.yml`: after the existing E2E step, add a step `pnpm test:e2e:tracking` with the same `env` (including `E2E_SKIP_BUILD`) as the E2E step.

`tests/e2e/support/tracking.ts`:

```ts
import {
  request as playwrightRequest,
  type BrowserContext,
  type Page,
} from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"
import { api } from "./api"
import { STORAGE } from "./storage"

const VENDORS = /^https:\/\/(www\.googletagmanager\.com|connect\.facebook\.net|[\w.-]*google-analytics\.com|www\.facebook\.com)\//

// Every vendor request is answered locally with an empty script and recorded.
export async function stubVendors(context: BrowserContext) {
  const hits: string[] = []
  await context.route(VENDORS, (route) => {
    hits.push(route.request().url())
    return route.fulfill({ status: 200, contentType: "text/javascript", body: "" })
  })
  return hits
}

const COPY = {
  enabled: true,
  title: "E2E cookie banner",
  body: "E2E banner body.",
  accept: "Accept all",
  reject: "Reject all",
  customise: "Customise",
  save: "Save choices",
  settingsLink: "Cookie settings",
  policyLabel: "Privacy policy",
  policyHref: "/privacy",
  categories: { necessary: "N", analytics: "A", marketing: "M" },
  reconsentMonths: 6,
  version: 1,
}

// Switches GTM, the Pixel and the banner on through the owner's API.
export async function enableTracking() {
  const req = await playwrightRequest.newContext({
    baseURL: E2E_ORIGIN,
    storageState: STORAGE.owner,
  })
  const tracking = await api<{ version: number }>(req, "GET", "/tracking")
  await api(req, "PUT", "/tracking", {
    version: tracking.version,
    value: {
      gtmId: "GTM-E2ETEST",
      ga4Id: "G-E2ETEST",
      metaPixelId: "1234567890",
      testEventCode: "",
      enabled: { gtm: true, ga4: true, meta: true, capi: false },
    },
  })
  const consent = await api<{ version: number }>(req, "GET", "/globals/consent")
  await api(req, "PUT", "/globals/consent", {
    version: consent.version,
    value: COPY,
  })
  await req.dispose()
}

export async function consentCookie(context: BrowserContext) {
  const cookie = (await context.cookies()).find((c) => c.name === "mk_consent")
  return cookie ? JSON.parse(decodeURIComponent(cookie.value)) : null
}

export const dataLayer = (page: Page) =>
  page.evaluate(() => JSON.stringify((window as never as { dataLayer: unknown[] }).dataLayer))
```

`tests/e2e/tracking/consent.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { runSql } from "../support/db"
import {
  consentCookie,
  dataLayer,
  enableTracking,
  stubVendors,
} from "../support/tracking"

test.describe.configure({ mode: "serial" })
test.beforeAll(enableTracking)

const banner = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "E2E cookie banner" })

test("no request to googletagmanager.com or connect.facebook.net before consent", async ({
  context,
  page,
}) => {
  const hits = await stubVendors(context)
  await page.goto("/")
  await expect(banner(page)).toBeVisible()
  // The bootstrap ran: consent defaults are the first dataLayer entry.
  expect(await dataLayer(page)).toContain('"default"')
  await page.goto("/about")
  await page.waitForTimeout(1000)
  expect(hits).toEqual([])
  const names = (await context.cookies()).map((c) => c.name)
  expect(names.filter((n) => /^_ga|^_gcl_|^_fb/.test(n))).toEqual([])
})

test("Accept loads GTM and the Pixel, and is logged", async ({ context, page }) => {
  const hits = await stubVendors(context)
  await page.goto("/")
  await banner(page).getByRole("button", { name: "Accept all" }).click()
  await expect
    .poll(() => hits.some((u) => u.includes("gtm.js?id=GTM-E2ETEST")))
    .toBe(true)
  await expect.poll(() => hits.some((u) => u.includes("fbevents.js"))).toBe(true)
  const cookie = await consentCookie(context)
  expect(cookie).toMatchObject({ v: 1, a: 1, m: 1 })
  await expect
    .poll(async () =>
      (
        await runSql(
          "select action from consent_events where consent_id = $1",
          [cookie.id]
        )
      ).map((r) => r.action)
    )
    .toEqual(["accept"])
  // A returning visitor: GTM loads at parse time, no banner.
  hits.length = 0
  await page.reload()
  await expect(banner(page)).toBeHidden()
  await expect.poll(() => hits.some((u) => u.includes("gtm.js"))).toBe(true)
})

test("Reject loads nothing", async ({ context, page }) => {
  const hits = await stubVendors(context)
  await page.goto("/")
  await banner(page).getByRole("button", { name: "Reject all" }).click()
  await page.reload()
  await expect(banner(page)).toBeHidden()
  await page.goto("/services")
  await page.waitForTimeout(1000)
  expect(hits).toEqual([])
  expect(await consentCookie(context)).toMatchObject({ a: 0, m: 0 })
})

test("withdrawal deletes the tracking cookies", async ({ context, page }) => {
  await stubVendors(context)
  await page.goto("/")
  await banner(page).getByRole("button", { name: "Accept all" }).click()
  await context.addCookies(
    ["_ga", "_ga_E2ETEST", "_gcl_au", "_fbp", "_fbc"].map((name) => ({
      name,
      value: "1",
      domain: "localhost",
      path: "/",
    }))
  )
  await page.getByRole("button", { name: "Cookie settings" }).click()
  await banner(page).getByRole("checkbox", { name: /Analytics/ }).uncheck()
  await banner(page).getByRole("checkbox", { name: /Marketing/ }).uncheck()
  await Promise.all([
    page.waitForEvent("load"),
    banner(page).getByRole("button", { name: "Save choices" }).click(),
  ])
  const names = (await context.cookies()).map((c) => c.name)
  expect(names.filter((n) => /^_ga|^_gcl_|^_fb/.test(n))).toEqual([])
  const cookie = await consentCookie(context)
  expect(cookie).toMatchObject({ a: 0, m: 0 })
  const actions = (
    await runSql("select action from consent_events where consent_id = $1 order by created_at", [
      cookie.id,
    ])
  ).map((r) => r.action)
  expect(actions).toEqual(["accept", "withdraw"])
})

test("newsletter tokens and contact topics never reach the dataLayer or Meta", async ({
  context,
  page,
}) => {
  await stubVendors(context)
  await page.goto("/")
  await banner(page).getByRole("button", { name: "Accept all" }).click()
  const metaTracks = () =>
    page.evaluate(
      () =>
        ((window as never as { fbq?: { queue: unknown[][] } }).fbq?.queue ?? [])
          .filter((call) => call[0] === "track").length
    )
  await page.goto("/newsletter/unsubscribe?token=e2e.secret")
  const nl = await dataLayer(page)
  expect(nl).not.toContain("e2e.secret")
  expect(nl).not.toContain("token")
  expect(await metaTracks()).toBe(0)
  await page.goto("/contact?topic=anxiety-stress")
  const contact = await dataLayer(page)
  expect(contact).not.toContain("anxiety")
  expect(contact).toContain('"location":"http://localhost:3100/contact"')
  expect(await metaTracks()).toBe(0)
})

test("the Tracking page shows GTM ready", async ({ browser }) => {
  const { STORAGE } = await import("../support/storage")
  const ctx = await browser.newContext({ storageState: STORAGE.owner })
  const page = await ctx.newPage()
  await page.goto("/admin/marketing")
  const status = page.getByRole("region", { name: "Status" })
  await expect(status.getByText("Google Tag Manager")).toBeVisible()
  await expect(status.getByText("Ready").first()).toBeVisible()
  await ctx.close()
})
```

`tests/e2e/navigation/headers.spec.ts` (runs in the normal projects):

```ts
import { expect, test } from "@playwright/test"

test("public pages carry the Report-Only CSP and security headers", async ({
  request,
}) => {
  const res = await request.get("/")
  const h = res.headers()
  expect(h["content-security-policy-report-only"]).toContain(
    "https://www.googletagmanager.com"
  )
  expect(h["content-security-policy"]).toBeUndefined()
  expect(h["x-content-type-options"]).toBe("nosniff")
  expect(h["x-frame-options"]).toBe("SAMEORIGIN")
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin")
})

test("the reset page keeps no-referrer and the API is noindex", async ({
  request,
}) => {
  const reset = await request.get("/admin/reset-password?token=x")
  expect(reset.headers()["referrer-policy"]).toBe("no-referrer")
  const health = await request.get("/api/v1/health")
  expect(health.headers()["x-robots-tag"]).toBe("noindex, nofollow")
})
```

- [ ] **Step 7: Run the E2E**

Run: `pnpm test:e2e:tracking`
Expected: 6 passed.
Run: `pnpm test:e2e --project=desktop tests/e2e/navigation`
Expected: PASS (headers spec included).

> If "no request … before consent" sees the dataLayer missing (`'"default"'` absent), the inline script inside the Suspense boundary did not execute: stop and report. React streams a resolved boundary as parsed HTML, so it should run; the fallback is moving `<TrackingBootstrap>` into the layout's `<head>` behind its own `<Suspense>`, which needs a decision.

- [ ] **Step 8: Setup notes and docs**

`docs/deploy-dokploy.md`:
- environment table: `APP_ENCRYPTION_KEY` (optional; `openssl rand -base64 32`; set before saving a CAPI token; rotating it means re-entering the token) and `DISABLE_CUSTOM_SCRIPTS` (optional kill switch).
- a "Tracking setup" section:
  1. GTM: Admin → Import Container → `docs/gtm-container.json` → Merge → "Rename conflicting". Leave the Meta tags paused unless the site's own Pixel is switched off (Ruling R7). Anyone who can publish the container must use 2FA (brief §12.6).
  2. GA4 property: **Google signals off; ads personalisation off**; enhanced measurement on for scrolls, outbound clicks and file downloads, with **"Page changes based on browser history events" off** and **form interactions off**; mark `generate_lead` as a key event. Mental-health counselling is a Google Ads sensitive category: **no remarketing audiences, no Customer Match**.
  3. Meta Events Manager: **Automatic Advanced Matching off**; no custom conversions on URLs.
  4. CSP: reports arrive in the app log as `[csp] …`; after a clean week, Phase 10 switches the header to enforcing.
  5. Enhanced matching stays off unless the practice's DPO or legal adviser approves (brief §2.3 Q6).

`docs/plan.md`: in "### Phase map", change the Phase 8 plan link to `docs/plans/phase-08-tracking.md` (Ruling R21). No other edits.

- [ ] **Step 9: Phase exit**

Run, in order: `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build && pnpm test:e2e --project=desktop --project=admin-desktop --grep-invert "parity:|visual:|lighthouse:|perf:" && pnpm test:e2e:tracking && pnpm test:parity`
Expected: everything green; parity ≤ 0.1% on every page.

Append the phase summary to `.superpowers/sdd/plan/progress.md`, including these carries:
- CARRY Phase 10: enforce the CSP (drop `-Report-Only`) after reviewing `[csp]` logs; decide on `CUSTOM_SCRIPT_HOSTS` entries.
- CARRY Phase 11: surface `tracking.capi_failed` in the notifications bell; R2 media `nosniff` Transform Rule (from Phase 4).

- [ ] **Step 10: Commit**

```bash
git add lib/tracking/csp.ts lib/tracking/csp.test.ts next.config.ts server/modules/security server/api/routes/public.ts docs/gtm-container.json tests/tracking playwright.config.ts playwright.tracking.config.ts package.json .github/workflows/ci.yml tests/e2e/support/tracking.ts tests/e2e/tracking tests/e2e/navigation/headers.spec.ts tests/integration/api/csp-report.test.ts docs/deploy-dokploy.md docs/plan.md .superpowers/sdd/plan/progress.md
git commit -m "feat(tracking): report-only csp, security headers, gtm container and consent acceptance e2e

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase exit

- All of Task 9 Step 9 is green.
- Acceptance (docs/plan.md Phase 8): no request to `googletagmanager.com` or `connect.facebook.net` before consent (Task 9 E2E 1); Accept loads GTM, Reject loads nothing (E2E 2, 3); withdrawal deletes the cookies (E2E 4); a unit test proves the default CAPI payload has no email, phone or condition-revealing URL (Task 6 `meta-capi.test.ts`).
- `docs/gtm-container.json` imports and its validity test passes.
- Dokploy: no required change; set `APP_ENCRYPTION_KEY` before turning CAPI on.

## Spec coverage map

| Spec item | Task |
| --- | --- |
| §12.1 opt-in for every non-essential tag, Basic mode | 3 (frame + bootstrap), 9 (E2E) |
| §12.1 Reject as prominent as Accept, no pre-ticked boxes, granular categories | 4 |
| §12.1 record of consent | 2 |
| §12.1 re-confirm every 6 months | 1, 2 (R13), 3 |
| §12.1 withdrawal via footer "Cookie settings" | 4, 9 |
| §12.1 health-data minimisation (sanitised URLs, standard events, no topics) | 1, 3, 5, 6, 9 |
| §12.1 configured, not coded | 2, 7, 8 |
| §12.2 consent manager, categories, cookie, proof, withdrawal | 1, 2, 4 |
| §12.3 bootstrap order, ID regexes, JSON.stringify, no url_passthrough, no noscript | 3 |
| §12.3 ConsentBanner behaviour, MarketingScripts, RouteTracker | 4, 5, 8 |
| §12.3 ready-made GTM container | 9 |
| §12.4 typed dataLayer, event_params clearing, event_id, GA4 limits, catalogue | 1, 5, 7 (catalogue page) |
| §12.4 Pixel settings (autoConfig, no history PageView) | 5 |
| §12.5 CAPI when/endpoint/payload/enhanced matching/retries/token/test events | 6, 7 |
| §12.6 custom code entries, next/script, owner-only, audit + rollback, kill switch, warning | 2, 8 |
| §12.6 CSP allowlist, Report-Only, no nonce | 9 |
| §15 security headers | 9 |
| §6.4 tracking / consent / scripts globals, secrets never public | 2, 3 |
| §6.6 `consent_events` | 2 |
| §7.2 tracking.* and code.update | 7, 8 |
| §8.3 Marketing and Public rows | 2, 7, 8 (R4 deviation) |
| §9.1 / §9.3 Marketing screens | 7, 8 |
| §16 unit (CAPI hashing, consent state machine) and E2E (banner blocks GTM) | 1, 6, 9 |
| §17 `APP_ENCRYPTION_KEY` | 2 |
| Phase 6 carries: Turnstile CSP; newsletter query stripping; `event_id` wiring | 9 (R1); 1, 5, 9 (R8); 5, 6 (R18) |

## Self-check against the installed code (done while writing this plan)

Verified in `node_modules` and the repo at `42308df`:

- **Next 16.3.8.** `01-app/02-guides/content-security-policy.md`: "you **must use dynamic rendering to add nonces**"; "Partial Prerendering (PPR) is incompatible with nonce-based CSP"; "Without Nonces" sets the header in `next.config.js` `headers()` with `'unsafe-inline'` (and `'unsafe-eval'` in development). `03-api-reference/02-components/script.md`: `beforeInteractive` must sit in the root layout and runs before hydration (unusable for consent-gated code); `afterInteractive` / `lazyOnload` work in any component; inline scripts need an `id`; scripts run once per document. `04-functions/cookies.md`: with Cache Components, `cookies()` outside Suspense blocks prerendering (R2 avoids it entirely). `04-functions/after.md`: Route Handlers may use request APIs in `after()`; we read the cookie before deferring anyway. `03-file-conventions/proxy.md` "Execution order": `next.config` headers run before proxy, so proxy's `no-referrer` on the reset page wins only if `headers()` does not also set it there (hence the negative source in R20). `05-config/01-next-config-js/headers.md`: later matching rules override earlier ones for the same key.
- **Repo.** `SiteFrame` awaits `io()` inside the layout's `<Suspense>`; `getSetting()` is `"use cache"` with `settings:<key>` tags and accepts `consent` and `scripts` (`PUBLIC_GLOBAL_KEYS`), not `tracking`; `TrackingGlobal`, `ConsentGlobal` (default `reconsentMonths: 12`), `ScriptsGlobal` (old shape) exist and are seeded as `{}`; `features/contact/lib/track.ts` is the Phase 6 R16 placeholder; `leads` has `marketing_consent`, `consent` jsonb and `meta_event_id`; `submitLead` uses `defer()`; `server/lib/crypto.ts` has HMAC helpers only (no AES), so `server/lib/secrets.ts` is new; `server/env.ts` has no `APP_ENCRYPTION_KEY`; `lib/auth/permissions.ts` already gives marketer `tracking.*` and only owner `code.update`; nav already lists `/admin/marketing`, `/consent`, `/code` (served by the `[section]` placeholder until real folders exist); `GlobalEditor` + `SchemaForm` (`onValuesChange` exists on `SchemaForm`); `publicLimit`, `sameOrigin`, the integration helpers and the `after()` mock pattern; migrations end at `0008_seo`; the admin stylesheet scans `components/` but not `features/`; parity and E2E share the seeded E2E database, and CI runs E2E on desktop projects only, parity locally.
- **Not compiled here (flagged in the owning step):** that the inline bootstrap inside the streamed Suspense boundary executes in Chromium (Task 9 Step 7 has the stop-and-report note; React streams resolved boundaries as parsed HTML, so it should); the exact `fieldErrors` key format `invalid()` produces for nested paths (Task 8 test asserts loosely); GTM's acceptance of the container on import (the JSON follows the export format 2 shape; Task 9 test checks internal consistency only).

## Execution handoff

Plan complete and saved to `docs/plans/phase-08-tracking.md`. Recommended: **subagent-driven**, because Tasks 3 (bootstrap under Cache Components) and 6 (CAPI consent and payload privacy) carry the mistakes that would leak health-adjacent data or load trackers without consent, and deserve a fresh reviewer each, while Tasks 1–2 and 4–5, 7–9 consume each other's interfaces in order. R7 and R14 are open questions for the user; neither blocks a task, and the stated defaults apply until answered.

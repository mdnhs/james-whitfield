# Phase 6: Enquiries, Forms and Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The contact form and the newsletter band really submit. Enquiries land in a Postgres-backed inbox behind layered abuse checks (honeypot, signed fill-time stamp, a Postgres fixed-window rate limit, optional Turnstile). The practice gets a privacy-by-default notification (no message body) and the enquirer an optional auto-reply, both sent after the response through React Email 6 templates and a new Resend 6 driver. Intake, admins and owners work the leads in a Kanban/table inbox with a detail drawer, notes, assignee, spam folder, CSV export, GDPR erase and a sidebar badge. The newsletter gets double opt-in, confirm/unsubscribe pages and an admin list. The cron tick purges expired data, and DSAR export/erase works by email.

**Architecture:** A new public Hono area `/api/v1/public/*` (64 KB body limit, `no-store`, a Postgres-backed per-IP limiter as middleware) serves `POST /leads`, `GET /leads/stamp`, `POST /newsletter`, `GET /newsletter/confirm` and `POST /newsletter/unsubscribe`. Services own the pipeline, the inserts, the audit (never PII) and the deferred email (`defer()` → `after()` from `next/server`). Admin sub-apps `/api/v1/admin/leads` and `/api/v1/admin/newsletter` follow the usual validate → `can()` → service pattern. `server/lib/email` gains a `resend` driver and renders React Email templates from `emails/`. The scheduler tick (Phase 5) calls `purgeExpired()` inside its advisory-lock transaction.

**Tech Stack:** Next.js 16.3.8 (Cache Components, `after()`) · Hono 4.13.13 + `@hono/zod-validator` 0.9.1 · Drizzle 0.45.4 · Zod 4.6.5 · TanStack Query 5.104.1 / Table 9.2.8 · nuqs · `@dnd-kit/core` 6.3.1 · new: `react-email`, `resend`, `libphonenumber-js` (exact pins below).

**Spec:** [`docs/brief.md`](../brief.md) (§5.5(d), §6.4 `notifications`/`privacy`/`newsletter`/`contactForm`, §6.6 `leads`/`lead_activities`/`newsletter_subscribers`/`api_rate_limits`, §7.2 `lead.*`/`newsletter.*`, §8.1, §8.3 Public/Enquiries/Newsletter rows, §9.1 badge, §9.3 Enquiries, §13, §15) and the Phase 6 contract in [`docs/plan.md`](../plan.md) ("### Phase 6: Enquiries, forms and email"). Read both first.

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

Phase-6 values from the spec (verbatim):

- "One `LeadInput` Zod schema covers both client and server. Fields: name, email, optional phone (normalised to E.164), topic (service slug or `other`), format, plan, message, and privacy consent (required)." (§13)
- "Hidden fields: honeypot; start timestamp; `event_id`; a consent snapshot; first-touch UTM and referrer, kept in `sessionStorage`; `fbp`/`fbc`, only with marketing consent." (§13) → `fbp`/`fbc` wait for Phase 8 consent.
- "Abuse checks, in this order: a Postgres fixed-window rate limit: 5 per 10 minutes per IP hash, and separately per email; the honeypot, or a fill time under 3 s measured from an HMAC-signed render timestamp → accepted silently and marked spam; Zod validation; Cloudflare Turnstile, enabled automatically when its keys are configured. Server-side `siteverify` checks `success`, `action` and `hostname`; tokens are single-use and expire after 300 s." (§13)
- "The practice email is **privacy-by-default**: name, contact details, preferred format and a deep link to the admin, but **not** the message, unless the owner switches that on. The auto-reply to the enquirer is optional and editable, and never echoes the message." (§13)
- "Leads move through `new → contacted → booked → closed` or `spam`. A purge job runs on a configurable schedule (defaults: closed after 24 months, spam after 30 days). GDPR erase and export are available per person (email lookup)." (§13)
- "Double opt-in: `pending` → a confirmation email with a hashed one-time token → `confirmed`. Every email carries an unsubscribe link, and the admin can export the list as CSV." (§13)
- "`server/lib/email` exposes `sendEmail(message)` with three drivers: `resend` (production), `smtp` (Mailpit `axllent/mailpit:v1.31.4` in development) and `log` (tests)." · "Components, `render` and `toPlainText` all come from the `react-email` package, and `pnpm email:dev` previews them." · "The Resend 6 SDK returns `{ data, error }` rather than throwing, so the driver checks for errors. It sends with an idempotency key per message (e.g. `enquiry/<id>`)." (§13)
- "access is limited to owner, admin and intake; they never reach ad platforms; notification emails contain no message by default; audit diffs never contain message content; retention purges run automatically; DSAR export and erase are built in." (§15)
- "**No `NEXT_PUBLIC_*` variables** … client-visible values (such as the Turnstile site key) are passed from the server as props." (§15)
- "`/v1/public/*` → `rateLimit`, `bodyLimit(64 KB)`." (§8.1)
- "Public | `POST /public/leads` · `POST /public/newsletter` · `GET /public/newsletter/confirm` · `POST /public/newsletter/unsubscribe`" · "Enquiries | `GET /admin/leads` · `GET|PATCH /:id` · `POST /:id/notes` · `GET /admin/leads/export.csv` · `DELETE /:id` (GDPR erase)" · "Newsletter | `GET /admin/newsletter` · `GET /export.csv` · `DELETE /:id`" (§8.3)
- §7.2: `lead.read · update` → owner, admin, intake; `lead.export · delete` → owner, admin; `newsletter.read · export` → owner, admin, marketer; `newsletter.delete` → owner, admin. Marketer: "**No enquiries.**"
- §6.6 `leads`: "name, email, phone, topic_slug, format_slug, plan_slug, message, privacy_consent_at, marketing_consent, status (`new` | `contacted` | `booked` | `closed` | `spam`), assigned_to, source_path, referrer, utm (jsonb), ip_hash, user_agent, meta_event_id, created_at" · `lead_activities`: "lead_id (cascade), actor_id, type (`note` | `status` | `email` | `assignment`), body, data (jsonb), created_at" · `newsletter_subscribers`: "email (unique, lower-cased), status (`pending` | `confirmed` | `unsubscribed`), token_hash, source_path, consent_text, confirmed_at, unsubscribed_at, ip_hash" · `api_rate_limits`: "key (pk), count, reset_at. A fixed-window limiter for public endpoints (atomic upsert)".

**New dependencies (exact pins; every version published ≥ 2 weeks before 2026‑10‑10, i.e. on or before 2026‑09‑26, verified with `npm view <pkg> time --json`; installed by the task that needs them):**

| Package | Version | Published | Kind | Task |
| --- | --- | --- | --- | --- |
| `react-email` (components, `render`, `toPlainText`, `email` CLI) | `6.11.0` | 2026‑09‑23 | dependency | 1 |
| `@react-email/render` (re-exported by `react-email`, which declares `>=2.1.0`; pinned through `pnpm-workspace.yaml` `overrides`) | `2.1.0` | 2026‑07‑10 | override | 1 |
| `@react-email/ui` (the `email dev` preview server; the CLI would otherwise auto-install the floating version) | `6.11.0` | 2026‑09‑23 | devDependency | 1 |
| `resend` | `6.30.0` | 2026‑09‑25 | dependency | 1 |
| `libphonenumber-js` (server-only E.164 normalisation) | `1.13.14` | 2026‑09‑24 | dependency | 2 |

Not chosen: `react-email` 6.11.1, `resend` 6.31.0+ and `libphonenumber-js` 1.13.15 are all newer than 2026‑09‑26. `@react-email/ui@6.11.0` depends on `next@16.3.3`; it is a devDependency that only `pnpm email:dev` loads, so production keeps one Next.

**New environment variables (none becomes required in production):**

| Variable | Validation | Where |
| --- | --- | --- |
| `EMAIL_DRIVER` | enum gains `"resend"` (still defaults to `"log"`; `"log"` stays forbidden when `SITE_ENV=production`) | `server/env.ts` |
| `RESEND_API_KEY` | `z.string().startsWith("re_").optional()`; **required only when `EMAIL_DRIVER=resend`** | Task 1 |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | optional strings; both or neither (superRefine); Turnstile is on exactly when both are set | Task 3 |

Production keeps working with today's Dokploy env (`EMAIL_DRIVER=smtp` + `SMTP_URL`). Dokploy needs updating before merge **only** to switch email to Resend (`EMAIL_DRIVER=resend`, `RESEND_API_KEY`, a verified `EMAIL_FROM` domain) or to turn Turnstile on. No new HMAC secret is added (Ruling R2).

## Review Focus

1. **Two submissions race past the limit.** Ten simultaneous `POST /public/leads` from one IP must let exactly five through and answer the rest 429. A read-then-write limiter breaks this; the single-statement upsert must not. → Task 2 `rate-limit-db.test.ts` "is atomic under concurrency".
2. **Spam can be told apart from a real submission.** A honeypot, too-fast or missing-stamp submission must get the same status and body as a real one (`201 { ok: true }`), send no email, and stay out of the badge count and the inbox. → Task 3 `leads-public.test.ts` "spam is indistinguishable…".
3. **Enquiry content leaks out of the inbox.** With `includeMessage` off, the notification HTML and text never contain the message, the auto-reply never does either, and no `audit_logs` row for a lead contains the enquirer's message, email or phone. → Task 3 `leads-public.test.ts` "privacy by default", Task 5 `leads-admin.test.ts` "audit carries no PII".
4. **An email failure loses the enquiry.** When the driver throws (Resend `{ error }`, SMTP down), the visitor still gets 201, the lead is stored, a `lead_activities` row `type = "email"` with `data.status = "failed"` is written, and the owners get a delivery-failure email. → Task 3 `leads-public.test.ts` "a failed notification…".
5. **The CSV export runs formulas.** A name such as `=HYPERLINK("https://evil.example")` or `+1-555` must reach the CSV as a text cell (`'=HYPERLINK(…)`), with quotes doubled and newlines kept inside quotes. → Task 5 `csv.test.ts`.

## Rulings (decisions this plan takes; one line each in the hand-off)

| Ruling | Decision | Tasks |
| --- | --- | --- |
| R1 Fill-time stamp | The form fetches `GET /api/v1/public/leads/stamp` → `{ stamp: "<ms>.<hmac>" }` (`Cache-Control: no-store`) when it mounts, instead of rendering the stamp into HTML. **Why:** under Cache Components the contact page shell is prerendered and cached, so a stamp rendered on the server would be frozen at build or revalidation time. A dynamic `connection()` hole is possible, but it would put a per-request render on every page that has a contact block. A stamp that is missing, badly signed, younger than 3 s or older than 7 days → stored as spam (`spamReason`). This is a client call from the browser, not a server-rendered page fetching `/api`, so the "public pages never fetch" rule holds. | 2, 3, 4 |
| R2 No new secret | The stamp HMAC and the newsletter unsubscribe token use keys derived from `BETTER_AUTH_SECRET` with labels (`HMAC(secret, "lead-stamp")`, `HMAC(secret, "newsletter-unsubscribe")`), the same pattern `hashIp` already uses. No `LEAD_HMAC_SECRET` var. Rotating the auth secret invalidates open forms (they become spam for at most one submission) and old unsubscribe links (the page then offers "Email us to unsubscribe"). | 2, 7 |
| R3 Env | `EMAIL_DRIVER` gains `resend` (`RESEND_API_KEY` required only then); Turnstile keys are optional and must come as a pair. Nothing new is required in production. | 1, 3 |
| R4 Client IP | `X-Real-IP` validated with `net.isIP` (the same header Better Auth trusts; Traefik overwrites it in production, Phase 1 carry). Missing → the shared key `unknown`. E2E specs send a distinct `X-Real-IP` per test so parallel specs never share a bucket. | 2, 8 |
| R5 Phone | The isomorphic `LeadInput` only checks the shape (`/^[+()\d\s.-]{6,20}$/`). The server normalises to E.164 with `libphonenumber-js/min` (default region `IE`) and answers `fieldErrors.phone` when the number is impossible. This keeps libphonenumber's metadata out of the public bundle. | 2, 3 |
| R6 `after()` | All post-response work goes through `defer(task)` in `server/lib/defer.ts`, which calls `after()` from `next/server` and logs rejections. Hono runs inside the `app/api/[...route]` Route Handler, so `after()` has its request store (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`). Integration tests mock `next/server`'s `after` and drain the queued callbacks. | 2, 3, 7 |
| R7 Spam capture | The brief puts the honeypot/stamp check before Zod, so spam is stored with a lenient `SpamCapture` coercion (every field `.catch("")`, length-capped), `status = "spam"` and `spamReason` ∈ `honeypot · too-fast · stamp`. It sends no email and gets the same `201 { ok: true }`. Spam still counts towards the IP limit (the limit runs first). | 3 |
| R8 Option values | The contact form's `<option>`/radio values change from labels to slugs (`topic` = service slug, slugified extra topic or `other`; `format` = slugified label). The server checks them against the current services, `contactForm.extraTopics` and `contactForm.formats` and answers a field error for unknown slugs. Values are invisible, so parity is unaffected. | 3, 4 |
| R9 Notifications | Recipients come from `notifications.recipients`, falling back to the `contact.email` global. A new `notifications.includeMessage` (default `false`) adds the message. `replyTo` is the enquirer. Idempotency keys: `enquiry/<id>/notify`, `enquiry/<id>/auto-reply`, `newsletter/<subscriberId>/confirm/<first 12 hex of tokenHash>`, `enquiry/<id>/delivery-failure`. | 1, 3, 7 |
| R10 Delivery failure | A failed notification or auto-reply writes `lead_activities { type: "email", data: { kind, status: "failed", error: <code only> } }` and sends the delivery-failure template to every owner's email (from `users`). It is never retried automatically; the activity is visible in the drawer timeline. Phase 11's bell reads these rows. | 3 |
| R11 No lead version | Leads have no `version` column. Status and assignee changes are last-write-wins, each logged as a `lead_activities` row; the drawer refetches after every mutation. | 5 |
| R12 Purge cadence | `purgeExpired()` runs on every tick inside the advisory-lock transaction. The "configurable schedule" is the retention windows in the `privacy` global: the existing `enquiryRetentionMonths` (closed leads, by `status_changed_at`) and a new `spamRetentionDays` (default 30, by `created_at`). It also deletes `api_rate_limits` rows whose window ended and `pending` newsletter rows older than 30 days. It audits only when something was deleted, as counts only. | 2, 8 |
| R13 DSAR | Lives under `/api/v1/admin/leads/dsar?email=`. `GET` (JSON download of leads + activities + the newsletter row) needs `lead.export` **and** `newsletter.export`; `DELETE` needs `lead.delete` **and** `newsletter.delete` (owner and admin hold all four). The audit stores counts only, never the email. | 5 |
| R14 Newsletter links | Confirm: the email links to `GET /api/v1/public/newsletter/confirm?token=` → one-time token (stored as a SHA-256 hash, expires after 7 days) → `303` to `/newsletter/confirmed` or `/newsletter/invalid`. Unsubscribe: the email links to the `/newsletter/unsubscribe?token=` **page**, whose button POSTs (so link scanners never unsubscribe anyone) → `303` to `/newsletter/unsubscribed`. Every `POST /public/newsletter` answers the same `201 { ok: true }` whatever the address's state (no enumeration). When `privacy.newsletterDoubleOptIn` is false the row is confirmed directly. | 7 |
| R15 React Email | Templates live in `emails/*.tsx` and import only `react-email` and sibling files (no `@/`, no `server-only`), so `email dev` can build them. Server wrappers in `server/lib/email/templates.ts` call `render()`/`toPlainText()` and return `{ subject, html, text }`. Brand values live in `emails/theme.ts`. | 1 |
| R16 Tracking plumbing | The client creates `eventId = crypto.randomUUID()` per submission. It is stored as `leads.meta_event_id`, and after success the client pushes `{ event: "generate_lead", event_id }` onto `window.dataLayer` **only if that array already exists**. `marketing_consent = false` and no `fbp`/`fbc` until Phase 8. First-touch UTM and referrer are captured site-wide into `sessionStorage` by a render-nothing client component. | 4 |
| R17 Turnstile outage | When `siteverify` cannot be reached (5 s timeout) the submission fails closed with `fieldErrors.turnstile` ("Please try again"). **Open question for the user**: fail open instead? | 3 |

No new Server Actions: all writes go through Hono (the P1 `requireActor` carry stays satisfied).

## File structure

| Files | Responsibility | Task |
| --- | --- | --- |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` (modify) | pins, `email:dev` script, render override | 1, 2 |
| `emails/{theme,layout,invite,password-reset,new-enquiry,enquiry-auto-reply,newsletter-confirmation,delivery-failure}.tsx` | React Email templates (+ `PreviewProps`) | 1 |
| `server/lib/email/index.ts`, `server/lib/email/templates.ts`, `server/lib/email/resend-driver.ts` (modify/create) | drivers, `EmailMessage.idempotencyKey/replyTo`, async render wrappers | 1 |
| `server/auth/email.ts` (modify) | invite/reset use async templates | 1 |
| `server/env.ts`, `server/env.test.ts`, `.env.example` (modify) | `resend`, `RESEND_API_KEY`, Turnstile pair | 1, 3 |
| `server/db/schema/leads.ts`, `server/db/schema/newsletter.ts`, `server/db/schema/rate-limits.ts`, `server/db/schema/index.ts` | four tables | 2 |
| `server/db/migrations/0007_enquiries.sql` (generated) | migration | 2 |
| `lib/leads/schema.ts` | `LEAD_STATUSES`, `BOARD_STATUSES`, `LeadInput`, `LeadSubmission`, `Attribution`, `NewsletterSubmission`, `LeadPatch`, `LeadNote`, `LeadListQuery` (isomorphic) | 2 |
| `lib/content/globals.ts`, `server/db/seed/globals.ts`, `server/db/seed/fixtures/*` (modify) | `notifications.includeMessage`, `privacy.spamRetentionDays`, `contactForm.errors.{phone,message,rateLimited,generic}`, `newsletter.pages` | 2 |
| `server/lib/rate-limit-db.ts`, `server/lib/client-ip.ts`, `server/lib/defer.ts`, `server/lib/crypto.ts` (modify) | limiter, IP, `after()` wrapper, derived HMAC keys | 2 |
| `server/modules/leads/stamp.ts` | `issueStamp`, `checkStamp` | 2 |
| `server/api/middleware/public-limit.ts`, `server/api/routes/public.ts`, `server/api/app.ts` (modify) | public area | 3 |
| `server/lib/turnstile.ts` | `turnstileEnabled`, `verifyTurnstile` | 3 |
| `server/modules/leads/{submit,notify,phone,public-routes}.ts` | public pipeline + emails | 3 |
| `features/contact/components/contact-form.tsx`, `features/contact/components/turnstile.tsx`, `features/contact/lib/{submit-lead,attribution,track}.ts`, `components/attribution-capture.tsx`, `app/(site)/layout.tsx`, `app/(site)/_cms/resolve-block.tsx` (modify/create) | form wiring | 4 |
| `server/modules/leads/{service,routes,csv,dsar}.ts`, `server/api/routes/admin.ts`, `admin/lib/api.ts`, `admin/lib/query-keys.ts` (modify) | admin API | 5 |
| `admin/modules/leads/*`, `app/(admin)/admin/(panel)/leads/page.tsx`, `admin/components/shell/{admin-shell,topbar}.tsx` (modify) | inbox UI + badge | 6 |
| `server/modules/newsletter/{service,public-routes,routes}.ts`, `features/insights/components/newsletter-band.tsx`, `app/(site)/newsletter/[state]/page.tsx`, `features/newsletter/components/*`, `admin/modules/newsletter/*`, `app/(admin)/admin/(panel)/newsletter/page.tsx` | newsletter | 7 |
| `server/modules/leads/retention.ts`, `server/modules/scheduler/service.ts` (modify) | purge | 8 |
| `tests/integration/helpers/leads.ts`, `tests/e2e/support/{mailpit,public}.ts` | shared test helpers | 2, 3, 8 |
| `docs/deploy-dokploy.md` (modify) | deploy note | 8 |

## Conventions for executing this plan

- Where a step gives a component as a spec (props, API call, labels) rather than code, the quoted labels are load-bearing: E2E specs select by them.
- Next-specific APIs used here were checked in `node_modules/next/dist/docs/` (see "Self-check" at the end). Re-read the cited doc before changing how any of them is used.
- Run `pnpm db:up` first (Postgres + Mailpit). Generate migrations with `pnpm db:generate --name enquiries` and commit the SQL, snapshot and journal.
- Commit messages: Conventional Commits, written normally, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Integration-test conventions (every API task)

- `invalidate()` calls `revalidateTag`, which needs a Next request store. Mock it per file, keeping the rest of `next/cache`, exactly as `tests/integration/api/cron.test.ts` does.
- `defer()` calls `after()`. Mock it per file and drain the queue before asserting on email:

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
- Public requests go through `publicRequest(path, { method, body, ip })` from `tests/integration/helpers/leads.ts` (Task 2), which sets `x-real-ip`.
- Emails sent with the `log` driver under `NODE_ENV=test` land in `readOutbox()`; call `clearOutbox()` in `beforeEach`.

---

### Task 1: Email v2 — React Email templates and the Resend driver

**Files:**
- Create: `emails/theme.ts`, `emails/layout.tsx`, `emails/invite.tsx`, `emails/password-reset.tsx`, `emails/new-enquiry.tsx`, `emails/enquiry-auto-reply.tsx`, `emails/newsletter-confirmation.tsx`, `emails/delivery-failure.tsx`, `server/lib/email/resend-driver.ts`
- Modify: `package.json`, `pnpm-workspace.yaml`, `server/lib/email/index.ts`, `server/lib/email/templates.ts`, `server/auth/email.ts`, `server/auth/email.test.ts`, `server/env.ts`, `server/env.test.ts`, `.env.example`, `.gitignore` (add `.react-email/`)
- Test: `server/lib/email/email.test.ts` (extend), `server/lib/email/templates.test.tsx`, `server/lib/email/resend-driver.test.ts`

**Interfaces:**
- Consumes: `getEnv()`, the existing `sendEmail`/`readOutbox`/`clearOutbox`.
- Produces:
  - `type EmailMessage = { to: string | string[]; subject: string; html: string; text: string; replyTo?: string; idempotencyKey?: string }`; `sendEmail(message: EmailMessage): Promise<void>` (throws `EmailError` on failure).
  - `class EmailError extends Error { code: string }` (in `server/lib/email/index.ts`).
  - `createResendDriver(apiKey: string, client?: ResendLike): EmailDriver`.
  - Async template wrappers in `server/lib/email/templates.ts`, each returning `Promise<{ subject: string; html: string; text: string }>`:
    - `inviteEmail({ name, url })`, `passwordResetEmail({ name, url })`
    - `newEnquiryEmail({ name, email, phone, topic, format, plan, message, includeMessage, adminUrl })` (`message` is `undefined` when off)
    - `enquiryAutoReplyEmail({ name, subject, body, unsubscribeUrl? })`
    - `newsletterConfirmationEmail({ confirmUrl, unsubscribeUrl, subject, body })`
    - `deliveryFailureEmail({ kind, leadUrl, occurredAt })`
  - `getEnv().RESEND_API_KEY?: string`; `EMAIL_DRIVER: "log" | "smtp" | "resend"`.
  - Script `pnpm email:dev`.

- [ ] **Step 1: Install the pinned dependencies**

```bash
pnpm add react-email@6.11.0 resend@6.30.0
pnpm add -D @react-email/ui@6.11.0
```

Add to `pnpm-workspace.yaml` (top level), then `pnpm install`:

```yaml
overrides:
  # react-email 6.11.0 re-exports render/toPlainText from a ">=2.1.0" range.
  "@react-email/render": "2.1.0"
```

Add the script `"email:dev": "email dev --dir emails --port 3030"` to `package.json` and `.react-email/` to `.gitignore`. Confirm `docker-compose.yml` still pins `axllent/mailpit:v1.31.4` (it does; no change).

- [ ] **Step 2: Write the failing tests**

Append to `server/env.test.ts` (follow its existing `process.env` / `resetEnvForTests()` pattern):

```ts
it("requires RESEND_API_KEY only for the resend driver", () => {
  Object.assign(process.env, { EMAIL_DRIVER: "resend" })
  delete process.env.RESEND_API_KEY
  resetEnvForTests()
  expect(() => getEnv()).toThrow(/RESEND_API_KEY/)
  process.env.RESEND_API_KEY = "re_test_123"
  resetEnvForTests()
  expect(getEnv().EMAIL_DRIVER).toBe("resend")
})
```

`server/lib/email/resend-driver.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import { EmailError } from "./index"
import { createResendDriver } from "./resend-driver"

const envelope = {
  from: "Magda Kennedy <hello@example.com>",
  to: "ann@example.com",
  subject: "Hi",
  html: "<p>Hi</p>",
  text: "Hi",
  replyTo: "visitor@example.com",
  idempotencyKey: "enquiry/1/notify",
}

describe("resend driver", () => {
  it("passes the idempotency key and reply-to", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "x" }, error: null })
    await createResendDriver("re_x", { emails: { send } }).send(envelope)
    expect(send).toHaveBeenCalledWith(
      {
        from: envelope.from,
        to: envelope.to,
        subject: "Hi",
        html: "<p>Hi</p>",
        text: "Hi",
        replyTo: "visitor@example.com",
      },
      { idempotencyKey: "enquiry/1/notify" }
    )
  })

  it("turns a { error } result into an EmailError", async () => {
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Invalid from" },
    })
    await expect(
      createResendDriver("re_x", { emails: { send } }).send(envelope)
    ).rejects.toBeInstanceOf(EmailError)
  })
})
```

`server/lib/email/templates.test.tsx`:

```tsx
import { describe, expect, it } from "vitest"

import {
  deliveryFailureEmail,
  enquiryAutoReplyEmail,
  inviteEmail,
  newEnquiryEmail,
  newsletterConfirmationEmail,
  passwordResetEmail,
} from "./templates"

const enquiry = {
  name: "<b>Ann</b>",
  email: "ann@example.com",
  phone: "+353871234567",
  topic: "Anxiety",
  format: "Online",
  plan: null,
  adminUrl: "https://site.example/admin/leads?lead=1",
}

describe("templates", () => {
  it("escapes names and keeps links usable", async () => {
    const m = await inviteEmail({ name: "<script>x</script>", url: "https://e.x/r?token=1&x=2" })
    expect(m.html).not.toContain("<script>")
    expect(m.html).toContain("https://e.x/r?token=1&amp;x=2")
    expect(m.text).toContain("https://e.x/r?token=1&x=2")
    expect((await passwordResetEmail({ name: "Ann", url: "https://e.x" })).subject).toBe(
      "Reset your admin password"
    )
  })

  it("leaves the message out of the notification by default", async () => {
    const m = await newEnquiryEmail({ ...enquiry, message: undefined, includeMessage: false })
    expect(m.subject).toBe("New enquiry from <b>Ann</b>")
    expect(m.html).not.toContain("<b>Ann</b>")
    expect(m.html).toContain(enquiry.adminUrl)
    expect(`${m.html}${m.text}`).not.toContain("SECRET-MESSAGE")
  })

  it("adds the message only when switched on", async () => {
    const m = await newEnquiryEmail({ ...enquiry, message: "SECRET-MESSAGE", includeMessage: true })
    expect(m.text).toContain("SECRET-MESSAGE")
  })

  it("renders the other templates with plain-text versions", async () => {
    for (const m of [
      await enquiryAutoReplyEmail({ name: "Ann", subject: "Thanks", body: "Hi {name}, we got it." }),
      await newsletterConfirmationEmail({
        subject: "Confirm",
        body: "Please confirm.",
        confirmUrl: "https://e.x/c?token=t",
        unsubscribeUrl: "https://e.x/u?token=u",
      }),
      await deliveryFailureEmail({ kind: "notification", leadUrl: "https://e.x/l", occurredAt: new Date(0) }),
    ]) {
      expect(m.html).toMatch(/^<!DOCTYPE html/i)
      expect(m.text.length).toBeGreaterThan(10)
    }
    const reply = await enquiryAutoReplyEmail({ name: "Ann", subject: "Thanks", body: "Hi {name}." })
    expect(reply.text).toContain("Hi Ann.")
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run --project unit server/lib/email server/env.test.ts`
Expected: FAIL. `./resend-driver` does not exist, the templates are not async, and `EMAIL_DRIVER` rejects `"resend"`.

- [ ] **Step 4: Implement env, driver and templates**

`server/env.ts`: change the driver to `EMAIL_DRIVER: z.enum(["log", "smtp", "resend"]).default("log")`, delete the "added in Phase 6" comment, add `RESEND_API_KEY: z.string().startsWith("re_").optional()`, and in `superRefine`:

```ts
if (env.EMAIL_DRIVER === "resend" && !env.RESEND_API_KEY) {
  ctx.addIssue({
    code: "custom",
    path: ["RESEND_API_KEY"],
    message: 'RESEND_API_KEY is required when EMAIL_DRIVER is "resend"',
  })
}
```

`server/lib/email/resend-driver.ts`:

```ts
import "server-only"

import { Resend } from "resend"

import { EmailError, type EmailDriver, type Envelope } from "./index"

type SendResult = {
  data: unknown
  error: { name?: string; message?: string } | null
}
export type ResendLike = {
  emails: {
    send(
      payload: Record<string, unknown>,
      options?: { idempotencyKey?: string }
    ): Promise<SendResult>
  }
}

// docs/brief.md §13: Resend 6 returns { data, error } instead of throwing.
export function createResendDriver(
  apiKey: string,
  client: ResendLike = new Resend(apiKey) as unknown as ResendLike
): EmailDriver {
  return {
    async send({ idempotencyKey, replyTo, ...message }: Envelope) {
      const { error } = await client.emails.send(
        { ...message, ...(replyTo ? { replyTo } : {}) },
        idempotencyKey ? { idempotencyKey } : undefined
      )
      if (error) throw new EmailError(error.name ?? "resend_error", error.message ?? "Resend refused the email")
    },
  }
}
```

`server/lib/email/index.ts`: export `type Envelope` and `type EmailDriver`, widen `EmailMessage` as in **Interfaces**, add `export class EmailError extends Error { constructor(readonly code: string, message: string) { super(message) } }`, wrap the SMTP send in `try/catch → throw new EmailError("smtp_error", …)` (pass `replyTo`; nodemailer ignores the unknown `idempotencyKey`, so strip it), and pick the driver:

```ts
driver =
  env.EMAIL_DRIVER === "smtp"
    ? smtpDriver(env.SMTP_URL!)
    : env.EMAIL_DRIVER === "resend"
      ? createResendDriver(env.RESEND_API_KEY!)
      : logDriver
```

The log driver keeps its rules (outbox only under test; body printed only in development). Log only `to`/`subject`/`idempotencyKey`, never `replyTo`.

`emails/theme.ts` holds the brand values used today (`#f2f3f2` canvas, `#ffffff` card, `#111411` ink, `#16823a` button, 16px radius, Arial stack) plus the site palette names used in copy. `emails/layout.tsx` exports `EmailLayout({ preview, title, children, footer? })` built from `Html`, `Head`, `Preview`, `Body`, `Container`, `Heading`, `Text`, `Hr` (all from `react-email`) and a footer slot for the unsubscribe link. Each template file default-exports a component with `PreviewProps` for `email dev` and a named `subject(props)` helper, for example:

```tsx
import { Button, Text } from "react-email"

import { EmailLayout } from "./layout"
import { theme } from "./theme"

export type NewEnquiryProps = {
  name: string
  email: string
  phone: string | null
  topic: string
  format: string | null
  plan: string | null
  message?: string
  adminUrl: string
}

export const subject = ({ name }: Pick<NewEnquiryProps, "name">) =>
  `New enquiry from ${name}`

export default function NewEnquiry(props: NewEnquiryProps) {
  const rows: [string, string | null][] = [
    ["Name", props.name],
    ["Email", props.email],
    ["Phone", props.phone],
    ["Topic", props.topic],
    ["Preferred format", props.format],
    ["Plan", props.plan],
  ]
  return (
    <EmailLayout preview={subject(props)} title="New enquiry">
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <Text key={label} style={{ margin: "4px 0" }}>
            <strong>{label}:</strong> {value}
          </Text>
        ))}
      {props.message !== undefined && (
        <Text style={{ whiteSpace: "pre-wrap" }}>{props.message}</Text>
      )}
      <Button href={props.adminUrl} style={theme.button}>
        Open in the admin
      </Button>
    </EmailLayout>
  )
}

NewEnquiry.PreviewProps = {
  name: "Ann Example",
  email: "ann@example.com",
  phone: "+353 87 123 4567",
  topic: "Anxiety",
  format: "Online",
  plan: null,
  adminUrl: "http://localhost:3000/admin/leads?lead=00000000-0000-4000-8000-000000000001",
} satisfies NewEnquiryProps
```

The others follow the same shape. Invite and reset copy is the current copy from `templates.ts`. The auto-reply's `body` replaces `{name}` (use `fill` logic inlined: `body.replaceAll("{name}", name)`; `emails/` cannot import `@/lib/fill`). Newsletter confirmation has a "Confirm subscription" button and an "Unsubscribe" footer link. Delivery failure reads "An email about a new enquiry could not be delivered" with an "Open the enquiry" button.

`server/lib/email/templates.ts` becomes the render layer:

```ts
import "server-only"

import { createElement, type ComponentType } from "react"
import { render, toPlainText } from "react-email"

import NewEnquiry, { subject as enquirySubject, type NewEnquiryProps } from "@/emails/new-enquiry"
// …the other five imports…

async function build<P extends object>(
  Component: ComponentType<P>,
  props: P,
  subject: string
) {
  const html = await render(createElement(Component, props))
  return { subject, html, text: toPlainText(html) }
}

export const newEnquiryEmail = ({
  includeMessage,
  message,
  ...rest
}: Omit<NewEnquiryProps, "message"> & { message?: string; includeMessage: boolean }) =>
  build(NewEnquiry, { ...rest, message: includeMessage ? message : undefined }, enquirySubject(rest))
// inviteEmail, passwordResetEmail, enquiryAutoReplyEmail,
// newsletterConfirmationEmail, deliveryFailureEmail: same pattern.
```

`server/auth/email.ts`: `deliverResetEmail` already runs in a `Promise.resolve().then(...)` chain, so make the `then` callback `async` and `await` the template. Update `server/auth/email.test.ts` where it relied on a sync return.

**Unverified (check while implementing):** `render`/`toPlainText` signatures re-exported from `@react-email/render@2.1.0` (open `node_modules/@react-email/render/dist/*.d.ts`). Whether `next build` bundles `react-email` cleanly. If the build fails on `tailwindcss`/`esbuild` imports, add `serverExternalPackages: ["react-email", "@react-email/render"]` to `next.config.ts` and note it in the commit.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit server/lib/email server/auth server/env.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Smoke the preview and the build**

Run: `pnpm email:dev` (open `http://localhost:3030`, see the six templates, stop it). Then run `pnpm build`.
Expected: the preview lists all six; the build succeeds.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml .gitignore .env.example emails server/lib/email server/auth/email.ts server/auth/email.test.ts server/env.ts server/env.test.ts next.config.ts
git commit -m "feat(email): React Email templates and Resend driver"
```

---

### Task 2: Enquiry tables, shared schema, Postgres rate limiter and form stamp

**Files:**
- Create: `server/db/schema/leads.ts`, `server/db/schema/newsletter.ts`, `server/db/schema/rate-limits.ts`, `lib/leads/schema.ts`, `server/lib/rate-limit-db.ts`, `server/lib/client-ip.ts`, `server/lib/defer.ts`, `server/modules/leads/stamp.ts`, `server/modules/leads/phone.ts`, `tests/integration/helpers/leads.ts`
- Modify: `server/db/schema/index.ts`, `server/lib/crypto.ts`, `lib/content/globals.ts`, `server/db/seed/globals.ts` (+ the fixture holding contact-form/newsletter copy), `package.json` (`libphonenumber-js`)
- Generated: `server/db/migrations/0007_enquiries.sql` (+ snapshot, journal)
- Test: `lib/leads/schema.test.ts`, `server/modules/leads/stamp.test.ts`, `server/modules/leads/phone.test.ts`, `server/lib/client-ip.test.ts`, `tests/integration/db/leads-schema.test.ts`, `tests/integration/api/rate-limit-db.test.ts`

**Interfaces:**
- Consumes: `getDb`/`DbLike`, `getEnv`, `Slug` (`lib/content/slug.ts`).
- Produces:
  - Tables: `leads`, `leadActivities`, `newsletterSubscribers`, `apiRateLimits` (columns below).
  - `lib/leads/schema.ts`: `LEAD_STATUSES`, `type LeadStatus`, `BOARD_STATUSES`, `ACTIVITY_TYPES`, `UTM_KEYS`, `Attribution`, `LeadInput`/`type LeadInput`, `LeadSubmission`/`type LeadSubmission`, `NewsletterSubmission`, `LeadPatch`, `LeadNote`, `LeadListQuery`/`type LeadListQuery`, `type ConsentRecord`.
  - `hitLimit(key: string, opts: { limit: number; windowMs: number }, now?: Date, db?: DbLike): Promise<{ allowed: boolean; retryAfterSec: number }>`.
  - `clientIp(headers: Headers): string | null`.
  - `defer(task: () => Promise<unknown>, label: string): void`.
  - `derivedHmac(label: string, value: string): string` (hex) and `hashEmail(email: string): string` in `server/lib/crypto.ts`.
  - `issueStamp(now?: number): string`; `checkStamp(stamp: string | undefined, now?: number): "ok" | "too-fast" | "stamp"`; constants `STAMP_MIN_MS = 3000`, `STAMP_MAX_MS = 7 * 86_400_000`.
  - `toE164(raw: string): string | null`.
  - Globals: `notifications.includeMessage: boolean` (default `false`); `privacy.spamRetentionDays: number` (1–365, default 30); `contactForm.errors.{phone,message,rateLimited,generic}`; `newsletter.pages.{confirmed,invalid,unsubscribe,unsubscribed}` each `{ title, body }` (+ `unsubscribe.button`) and `newsletter.errors.{email,rateLimited,generic}`.
  - Test helpers: `publicRequest(path, { method?, body?, ip? })`, `submission(overrides?)` (a valid `LeadSubmission` with a 5-second-old stamp), `insertLead(values)`.

- [ ] **Step 1: Add the phone dependency**

```bash
pnpm add libphonenumber-js@1.13.14
```

- [ ] **Step 2: Write the failing tests**

`lib/leads/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { LeadInput, LeadSubmission } from "./schema"

const valid = {
  name: " Ann ",
  email: " Ann@Example.COM ",
  phone: "087 123 4567",
  topic: "anxiety",
  format: "online",
  message: "Hello",
  consent: true,
}

describe("LeadInput", () => {
  it("trims, lower-cases the email and keeps the phone shape", () => {
    const parsed = LeadInput.parse(valid)
    expect(parsed).toMatchObject({ name: "Ann", email: "ann@example.com", phone: "087 123 4567" })
  })
  it.each([
    ["name", ""],
    ["email", "nope"],
    ["topic", "Not A Slug"],
    ["consent", false],
    ["phone", "call me maybe"],
    ["message", "x".repeat(5001)],
  ])("rejects %s = %j", (key, value) => {
    expect(LeadInput.safeParse({ ...valid, [key]: value }).success).toBe(false)
  })
  it("treats an empty phone as absent", () => {
    expect(LeadInput.parse({ ...valid, phone: "" }).phone).toBeUndefined()
  })
})

describe("LeadSubmission", () => {
  it("defaults the hidden fields and refuses an off-site source path", () => {
    const parsed = LeadSubmission.parse(valid)
    expect(parsed).toMatchObject({ website: "", stamp: "", sourcePath: "/", attribution: { referrer: "", utm: {} } })
    expect(LeadSubmission.safeParse({ ...valid, sourcePath: "https://evil.example" }).success).toBe(false)
    expect(LeadSubmission.safeParse({ ...valid, attribution: { utm: { utm_source: "x".repeat(201) } } }).success).toBe(false)
  })
})
```

`server/modules/leads/stamp.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { checkStamp, issueStamp, STAMP_MAX_MS } from "./stamp"

describe("form stamp", () => {
  const t = 1_800_000_000_000
  it("accepts a stamp older than 3 s", () => {
    expect(checkStamp(issueStamp(t), t + 3_000)).toBe("ok")
  })
  it("flags a fast fill", () => {
    expect(checkStamp(issueStamp(t), t + 2_999)).toBe("too-fast")
  })
  it("flags missing, forged, future and expired stamps", () => {
    expect(checkStamp(undefined, t)).toBe("stamp")
    expect(checkStamp(`${t}.deadbeef`, t + 5_000)).toBe("stamp")
    expect(checkStamp(issueStamp(t + 60_000), t)).toBe("stamp")
    expect(checkStamp(issueStamp(t), t + STAMP_MAX_MS + 1)).toBe("stamp")
  })
})
```

`server/modules/leads/phone.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { toE164 } from "./phone"

describe("toE164", () => {
  it.each([
    ["087 123 4567", "+353871234567"],
    ["+44 20 7946 0958", "+442079460958"],
    ["(01) 234 5678", "+35312345678"],
  ])("normalises %s", (raw, e164) => expect(toE164(raw)).toBe(e164))
  it("returns null for an impossible number", () => expect(toE164("123")).toBeNull())
})
```

`server/lib/client-ip.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { clientIp } from "./client-ip"

describe("clientIp", () => {
  it("trusts a valid X-Real-IP only", () => {
    expect(clientIp(new Headers({ "x-real-ip": " 203.0.113.9 " }))).toBe("203.0.113.9")
    expect(clientIp(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1")
    expect(clientIp(new Headers({ "x-real-ip": "evil, 1.2.3.4" }))).toBeNull()
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBeNull()
  })
})
```

`tests/integration/api/rate-limit-db.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb } from "@/server/db/client"
import { hitLimit } from "@/server/lib/rate-limit-db"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)
const opts = { limit: 5, windowMs: 600_000 }

describe("Postgres fixed-window limiter", () => {
  it("allows five per window, then reports Retry-After, then resets", async () => {
    const t0 = new Date("2026-10-10T10:00:00Z")
    for (let i = 0; i < 5; i++) expect((await hitLimit("k", opts, t0)).allowed).toBe(true)
    const blocked = await hitLimit("k", opts, new Date(t0.getTime() + 60_000))
    expect(blocked).toEqual({ allowed: false, retryAfterSec: 540 })
    expect((await hitLimit("k", opts, new Date(t0.getTime() + 600_000))).allowed).toBe(true)
  })

  it("is atomic under concurrency", async () => {
    const now = new Date()
    const results = await Promise.all(Array.from({ length: 10 }, () => hitLimit("race", opts, now)))
    expect(results.filter((r) => r.allowed)).toHaveLength(5)
  })

  it("keeps keys apart", async () => {
    for (let i = 0; i < 5; i++) await hitLimit("a", opts)
    expect((await hitLimit("b", opts)).allowed).toBe(true)
  })
})
```

`tests/integration/db/leads-schema.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { leadActivities, leads, newsletterSubscribers } from "@/server/db/schema"

import { insertLead } from "../helpers/leads"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("enquiry schema", () => {
  it("refuses unknown statuses and activity types", async () => {
    await expect(insertLead({ status: "maybe" as never })).rejects.toThrow()
    const lead = await insertLead()
    await expect(
      getDb().insert(leadActivities).values({ leadId: lead.id, type: "poke" as never })
    ).rejects.toThrow()
  })
  it("cascades activities when a lead is erased", async () => {
    const lead = await insertLead()
    await getDb().insert(leadActivities).values({ leadId: lead.id, type: "note", body: "x" })
    await getDb().delete(leads)
    expect(await getDb().select().from(leadActivities)).toHaveLength(0)
  })
  it("keeps newsletter emails unique and lower-case", async () => {
    await getDb().insert(newsletterSubscribers).values({ email: "a@example.com" })
    await expect(getDb().insert(newsletterSubscribers).values({ email: "a@example.com" })).rejects.toThrow()
    await expect(getDb().insert(newsletterSubscribers).values({ email: "B@example.com" })).rejects.toThrow()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run --project unit lib/leads server/modules/leads server/lib/client-ip.test.ts && pnpm test:integration -- rate-limit-db leads-schema`
Expected: FAIL (modules and tables missing).

- [ ] **Step 4: Implement the schema and the shared types**

`server/db/schema/leads.ts`:

```ts
import { sql } from "drizzle-orm"
import { boolean, check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import type { ConsentRecord } from "@/lib/leads/schema"

import { users } from "./auth"

// docs/brief.md §6.6. Enquiries may reveal health information (§15): only
// owner, admin and intake read them, and audit rows never copy their fields.
export const leads = pgTable(
  "leads",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    email: text().notNull(),
    phone: text(),
    topicSlug: text().notNull().default(""),
    formatSlug: text(),
    planSlug: text(),
    message: text().notNull().default(""),
    privacyConsentAt: timestamp({ withTimezone: true }),
    marketingConsent: boolean().notNull().default(false),
    consent: jsonb().$type<ConsentRecord>().notNull().default({}),
    status: text().notNull().default("new"),
    statusChangedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    spamReason: text(),
    assignedTo: uuid().references(() => users.id, { onDelete: "set null" }),
    sourcePath: text().notNull().default("/"),
    referrer: text().notNull().default(""),
    utm: jsonb().$type<Record<string, string>>().notNull().default({}),
    ipHash: text(),
    userAgent: text().notNull().default(""),
    metaEventId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    check("leads_status_check", sql`${t.status} in ('new','contacted','booked','closed','spam')`),
    index("leads_status_created_idx").on(t.status, t.createdAt.desc()),
    index("leads_email_idx").on(sql`lower(${t.email})`),
    index("leads_status_changed_idx").on(t.status, t.statusChangedAt),
  ]
)

export const leadActivities = pgTable(
  "lead_activities",
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: uuid().notNull().references(() => leads.id, { onDelete: "cascade" }),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    type: text().notNull(),
    body: text().notNull().default(""),
    data: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("lead_activities_type_check", sql`${t.type} in ('note','status','email','assignment')`),
    index("lead_activities_lead_idx").on(t.leadId, t.createdAt),
  ]
)
```

`server/db/schema/newsletter.ts`: `newsletterSubscribers` with `id`, `email` (`.notNull().unique()`, check `email = lower(email)`), `status` (default `'pending'`, check in `pending/confirmed/unsubscribed`), `tokenHash` (unique, nullable), `tokenExpiresAt`, `sourcePath` (default `"/"`), `consentText` (default `""`), `confirmedAt`, `unsubscribedAt`, `ipHash`, `createdAt`, `updatedAt`; index `(status, created_at)`.

`server/db/schema/rate-limits.ts`: `apiRateLimits` = `key text primary key`, `count integer not null`, `resetAt timestamptz not null`; index on `reset_at`. Export all three from `server/db/schema/index.ts`. Then run `pnpm db:generate --name enquiries` and check that the SQL contains the checks and the `lower(email)` expression index.

`lib/leads/schema.ts` (isomorphic: no server imports):

```ts
import * as z from "zod"

import { Slug } from "@/lib/content/slug"

export const LEAD_STATUSES = ["new", "contacted", "booked", "closed", "spam"] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]
export const BOARD_STATUSES = ["new", "contacted", "booked", "closed"] as const
export const ACTIVITY_TYPES = ["note", "status", "email", "assignment"] as const
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const

// The consent record kept with each lead (docs/brief.md §13 "consent snapshot").
export type ConsentRecord = {
  privacyText?: string
  analytics?: boolean
  marketing?: boolean
  version?: number | null
}

const PHONE_SHAPE = /^[+()\d\s.-]{6,20}$/
const Email = z.string().trim().toLowerCase().max(254).pipe(z.email())

export const LeadInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: Email,
  phone: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v || undefined)
    .pipe(z.string().regex(PHONE_SHAPE).optional())
    .optional(),
  topic: Slug,
  format: Slug.optional(),
  plan: Slug.optional(),
  message: z.string().trim().max(5000).default(""),
  consent: z.literal(true),
})
export type LeadInput = z.infer<typeof LeadInput>

export const Attribution = z
  .object({
    referrer: z.string().max(500).default(""),
    landingPath: z.string().max(300).default(""),
    utm: z.partialRecord(z.enum(UTM_KEYS), z.string().max(200)).default({}),
  })
  .prefault({})

const Hidden = {
  website: z.string().max(200).default(""), // honeypot
  stamp: z.string().max(200).default(""),
  eventId: z.uuid().optional(),
  sourcePath: z.string().max(300).regex(/^\/(?!\/)/).default("/"),
  attribution: Attribution,
  turnstileToken: z.string().max(2048).optional(),
}
export const LeadSubmission = LeadInput.extend(Hidden)
export type LeadSubmission = z.infer<typeof LeadSubmission>

export const NewsletterSubmission = z.object({
  email: Email,
  website: Hidden.website,
  sourcePath: Hidden.sourcePath,
})

export const LeadPatch = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    assignedTo: z.uuid().nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.assignedTo !== undefined, "Nothing to change")
export const LeadNote = z.object({ body: z.string().trim().min(1).max(5000) })
export const LeadListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  folder: z.enum(["inbox", "spam"]).default("inbox"),
  status: z.enum(BOARD_STATUSES).optional(),
  assignee: z.union([z.uuid(), z.literal("me"), z.literal("none")]).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["createdAt:desc", "createdAt:asc"]).default("createdAt:desc"),
})
export type LeadListQuery = z.infer<typeof LeadListQuery>
```

If `Slug` lives elsewhere (`blocks/fields.ts`), import it from there; do not duplicate the regex.

- [ ] **Step 5: Implement the limiter, IP, defer, crypto, stamp and phone**

`server/lib/rate-limit-db.ts`:

```ts
import "server-only"

import { sql } from "drizzle-orm"

import { getDb, type DbLike } from "@/server/db/client"

// docs/brief.md §6.6 api_rate_limits: one atomic upsert per hit, so
// concurrent requests can never both read "4" and both pass.
export async function hitLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  now = new Date(),
  db: DbLike = getDb()
) {
  const resetAt = new Date(now.getTime() + windowMs)
  const { rows } = await db.execute<{ count: number; reset_at: Date }>(sql`
    insert into api_rate_limits (key, count, reset_at)
    values (${key}, 1, ${resetAt})
    on conflict (key) do update set
      count = case when api_rate_limits.reset_at <= ${now} then 1
                   else api_rate_limits.count + 1 end,
      reset_at = case when api_rate_limits.reset_at <= ${now} then excluded.reset_at
                      else api_rate_limits.reset_at end
    returning count, reset_at`)
  const row = rows[0]!
  const allowed = row.count <= limit
  const retryAfterSec = allowed
    ? 0
    : Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - now.getTime()) / 1000))
  return { allowed, retryAfterSec }
}
```

`server/lib/client-ip.ts`:

```ts
import "server-only"

import { isIP } from "node:net"

// Traefik overwrites X-Real-IP in production (Phase 1 carry); Better Auth
// keys its limiter on the same header. Chains are never trusted.
export function clientIp(headers: Headers): string | null {
  const value = headers.get("x-real-ip")?.trim() ?? ""
  return isIP(value) ? value : null
}
```

`server/lib/defer.ts`:

```ts
import "server-only"

import { after } from "next/server"

// Work after the response (docs/brief.md §5.5(d) step 4). Failures are logged,
// never surfaced: the visitor's request already succeeded.
export function defer(task: () => Promise<unknown>, label: string) {
  after(() =>
    task().catch((error) => console.error(`[defer] ${label} failed`, error))
  )
}
```

`server/lib/crypto.ts`: add

```ts
// Domain-separated keys from the one server secret (Ruling R2).
export function derivedHmac(label: string, value: string) {
  const key = createHmac("sha256", getEnv().BETTER_AUTH_SECRET).update(label).digest()
  return createHmac("sha256", key).update(value).digest("hex")
}

export const hashEmail = (email: string) =>
  derivedHmac("email", email.trim().toLowerCase()).slice(0, 32)
```

`server/modules/leads/stamp.ts`:

```ts
import "server-only"

import { timingSafeEqual } from "node:crypto"

import { derivedHmac } from "@/server/lib/crypto"

export const STAMP_MIN_MS = 3_000
export const STAMP_MAX_MS = 7 * 86_400_000
const sign = (ms: string) => derivedHmac("lead-stamp", ms).slice(0, 32)

export const issueStamp = (now = Date.now()) => `${now}.${sign(String(now))}`

export function checkStamp(stamp: string | undefined, now = Date.now()) {
  const [ms, mac] = (stamp ?? "").split(".")
  if (!ms || !mac || !/^\d{13}$/.test(ms)) return "stamp" as const
  const expected = Buffer.from(sign(ms))
  const given = Buffer.from(mac)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return "stamp" as const
  const age = now - Number(ms)
  if (age < 0 || age > STAMP_MAX_MS) return "stamp" as const
  return age < STAMP_MIN_MS ? ("too-fast" as const) : ("ok" as const)
}
```

`server/modules/leads/phone.ts`:

```ts
import "server-only"

import { parsePhoneNumberFromString } from "libphonenumber-js/min"

export function toE164(raw: string): string | null {
  const parsed = parsePhoneNumberFromString(raw, "IE")
  return parsed?.isValid() ? parsed.number : null
}
```

- [ ] **Step 6: Extend the globals and seed copy**

In `lib/content/globals.ts`:
- `NotificationsGlobal`: add `includeMessage: z.boolean().default(false)` with the comment `// §13 privacy-by-default: off unless the owner switches it on.`
- `PrivacyGlobal`: add `spamRetentionDays: z.number().int().min(1).max(365).default(30)`.
- `ContactFormGlobal.errors`: add `phone: s(80)`, `message: s(80)`, `rateLimited: s(160)`, `generic: s(160)`.
- `NewsletterGlobal`: add `errors: z.object({ email: s(80), rateLimited: s(160), generic: s(160) }).prefault({})` and `pages: z.object({ confirmed: Page, invalid: Page, unsubscribe: Page.extend({ button: s(40) }), unsubscribed: Page }).prefault({})` with `const Page = z.object({ title: s(80), body: s(400) }).prefault({})`.

Seed the copy in the fixture that already holds contact-form and newsletter copy (`server/db/seed/fixtures/contact-content.ts` and the newsletter fixture), e.g. `rateLimited: "You've sent a few messages already. Please try again in a few minutes, or email us directly."`, `generic: "Something went wrong sending your message. Please try again."`, `pages.confirmed: { title: "You're subscribed", body: "Thanks for confirming. The monthly letter will arrive in your inbox." }`, `pages.invalid: { title: "This link has expired", body: "Subscribe again from any article and we'll send a fresh link." }`, `pages.unsubscribe: { title: "Unsubscribe", body: "Stop receiving the monthly letter?", button: "Unsubscribe" }`, `pages.unsubscribed: { title: "You're unsubscribed", body: "You won't receive any more emails from us." }`. `admin/modules/globals/global-ui.ts` gets a label for `notifications.includeMessage`: `{ label: "Include the message in notification emails", description: "Off by default: enquiries can contain health information, and email copies leave the admin." }`.

Run `pnpm test:unit -- lib/content tests/lint` and update `lib/content/globals.test.ts` expectations if it snapshots defaults.

- [ ] **Step 7: Add the integration helpers**

`tests/integration/helpers/leads.ts`:

```ts
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { leads } from "@/server/db/schema"
import { issueStamp } from "@/server/modules/leads/stamp"

let ipCounter = 1
export const freshIp = () => `198.51.100.${ipCounter++ % 250}`

export function publicRequest(
  path: string,
  init: { method?: string; body?: unknown; ip?: string } = {}
) {
  return app.request(`/api/v1/public${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-real-ip": init.ip ?? freshIp(),
      "user-agent": "vitest",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

export const submission = (overrides: Record<string, unknown> = {}) => ({
  name: "Ann Example",
  email: `ann+${crypto.randomUUID().slice(0, 8)}@example.com`,
  phone: "087 123 4567",
  topic: "anxiety",
  format: "online",
  message: "SECRET-MESSAGE about my week",
  consent: true,
  website: "",
  stamp: issueStamp(Date.now() - 5_000),
  eventId: crypto.randomUUID(),
  sourcePath: "/contact",
  attribution: { referrer: "https://google.com/", utm: { utm_source: "google" } },
  ...overrides,
})

export async function insertLead(values: Partial<typeof leads.$inferInsert> = {}) {
  const [row] = await getDb()
    .insert(leads)
    .values({ name: "Ann", email: "ann@example.com", topicSlug: "anxiety", ...values })
    .returning()
  return row!
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm db:migrate && pnpm vitest run --project unit lib/leads server/modules/leads server/lib && pnpm test:integration -- rate-limit-db leads-schema && pnpm typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml server/db lib/leads lib/content/globals.ts lib/content/globals.test.ts admin/modules/globals/global-ui.ts server/lib server/modules/leads tests/integration
git commit -m "feat(leads): enquiry tables, shared schema, Postgres limiter and form stamp"
```

---

### Task 3: Public enquiry endpoint — abuse pipeline, Turnstile and notifications

**Files:**
- Create: `server/api/middleware/public-limit.ts`, `server/api/routes/public.ts`, `server/lib/turnstile.ts`, `server/modules/leads/submit.ts`, `server/modules/leads/notify.ts`, `server/modules/leads/options.ts`, `server/modules/leads/public-routes.ts`
- Modify: `server/api/app.ts`, `server/env.ts`, `server/env.test.ts`, `.env.example`, `tests/integration/helpers/content.ts` (`insertServiceAndForm`)
- Test: `tests/integration/api/leads-public.test.ts`, `server/lib/turnstile.test.ts`

**Interfaces:**
- Consumes: Task 1 `sendEmail`, `newEnquiryEmail`, `enquiryAutoReplyEmail`, `deliveryFailureEmail`, `EmailError`. Task 2 `hitLimit`, `clientIp`, `defer`, `hashIp`, `hashEmail`, `checkStamp`, `issueStamp`, `toE164`, `LeadSubmission`, `leads`, `leadActivities`; `getGlobal` (`server/modules/globals/service.ts`); `findServices`-style repo reads for topic validation (use `server/modules/content/repo.ts`'s service list or a direct `select` on the services collection table).
- Produces:
  - `publicLimit(name: string, opts: { limit: number; windowMs: number })`: Hono middleware keyed `${name}:ip:${hashIp(ip ?? "unknown")}` that answers `429` + `Retry-After` with the error envelope.
  - `publicRoutes` mounted at `/api/v1/public` (64 KB body limit, `Cache-Control: no-store`).
  - `POST /api/v1/public/leads` → `201 { ok: true }` · `400 VALIDATION_FAILED { fieldErrors }` · `429 RATE_LIMITED`. `GET /api/v1/public/leads/stamp` → `200 { stamp }`.
  - `submitLead(body: unknown, ctx: { ip: string | null; userAgent: string; now?: Date }): Promise<{ ok: true; leadId: string | null }>` (`leadId` is for tests; the route never returns it).
  - `notifyNewLead(leadId: string): Promise<void>` (runs inside `defer`).
  - `turnstileEnabled(): boolean`, `turnstileSiteKey(): string | null`, `verifyTurnstile(token: string | undefined, ip: string | null): Promise<boolean>`.
  - Constants `LEAD_LIMIT = { limit: 5, windowMs: 600_000 }`.

- [ ] **Step 1: Write the failing tests**

`server/lib/turnstile.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"

import { resetEnvForTests } from "@/server/env"

import { verifyTurnstile } from "./turnstile"

// Cloudflare's documented test keys (always-pass site key / secret).
const KEYS = {
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
}
const reply = (body: object) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body)))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  resetEnvForTests()
})

describe("verifyTurnstile", () => {
  const on = () => {
    for (const [k, v] of Object.entries(KEYS)) vi.stubEnv(k, v)
    resetEnvForTests()
  }
  it("passes when success, action and hostname match", async () => {
    on()
    const spy = reply({ success: true, action: "lead", hostname: "localhost" })
    expect(await verifyTurnstile("tok", "203.0.113.1")).toBe(true)
    const body = spy.mock.calls[0]![1]!.body as URLSearchParams
    expect(body.get("secret")).toBe(KEYS.TURNSTILE_SECRET_KEY)
    expect(body.get("remoteip")).toBe("203.0.113.1")
  })
  it.each([
    [{ success: false }],
    [{ success: true, action: "login", hostname: "localhost" }],
    [{ success: true, action: "lead", hostname: "evil.example" }],
  ])("fails for %j", async (body) => {
    on()
    reply(body)
    expect(await verifyTurnstile("tok", null)).toBe(false)
  })
  it("fails closed on a network error or a missing token", async () => {
    on()
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"))
    expect(await verifyTurnstile("tok", null)).toBe(false)
    expect(await verifyTurnstile(undefined, null)).toBe(false)
  })
})
```

Append to `server/env.test.ts`:

```ts
it("wants both Turnstile keys or neither", () => {
  process.env.TURNSTILE_SITE_KEY = "1x00000000000000000000AA"
  delete process.env.TURNSTILE_SECRET_KEY
  resetEnvForTests()
  expect(() => getEnv()).toThrow(/TURNSTILE_SECRET_KEY/)
})
```

`tests/integration/api/leads-public.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
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

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, leadActivities, leads, settings } from "@/server/db/schema"
import * as email from "@/server/lib/email"
import { clearOutbox, readOutbox } from "@/server/lib/email"
import { issueStamp } from "@/server/modules/leads/stamp"

import { cookieFor } from "../helpers/auth"
import { insertServiceAndForm } from "../helpers/content"
import { freshIp, publicRequest, submission } from "../helpers/leads"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  clearOutbox()
  // Services "anxiety" + contactForm formats ["Online"] + contact.email
  // "practice@example.com": the helper writes the collection row and globals.
  await insertServiceAndForm()
})
afterAll(closeDb)
const post = (body: unknown, ip = freshIp()) => publicRequest("/leads", { method: "POST", body, ip })

describe("POST /public/leads", () => {
  it("stores a valid enquiry with attribution and returns 201 { ok: true }", async () => {
    const body = submission()
    const res = await post(body)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })
    const [row] = await getDb().select().from(leads)
    expect(row).toMatchObject({
      status: "new",
      email: body.email,
      phone: "+353871234567",
      topicSlug: "anxiety",
      formatSlug: "online",
      sourcePath: "/contact",
      referrer: "https://google.com/",
      utm: { utm_source: "google" },
      metaEventId: body.eventId,
      marketingConsent: false,
    })
    expect(row!.ipHash).toMatch(/^[0-9a-f]{32}$/)
    expect(row!.privacyConsentAt).toBeInstanceOf(Date)
    expect(row!.consent.privacyText).toBeTruthy()
  })

  it("answers field errors, including unknown topics and impossible phones", async () => {
    const res = await post(submission({ email: "nope", topic: "made-up", phone: "123456" }))
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(Object.keys(error.fieldErrors).sort()).toEqual(["email"])
    const second = await post(submission({ topic: "made-up", phone: "123456" }))
    expect(Object.keys((await second.json()).error.fieldErrors).sort()).toEqual(["phone", "topic"])
  })

  it("spam is indistinguishable: honeypot, fast fill and bad stamp", async () => {
    const real = await post(submission())
    for (const extra of [
      { website: "https://spam.example" },
      { stamp: issueStamp(Date.now() - 500) },
      { stamp: "forged.stamp" },
    ]) {
      const res = await post(submission(extra))
      expect(res.status).toBe(real.status)
      expect(await res.json()).toEqual({ ok: true })
    }
    await drain()
    const rows = await getDb().select().from(leads).where(eq(leads.status, "spam"))
    expect(rows.map((r) => r.spamReason).sort()).toEqual(["honeypot", "stamp", "too-fast"])
    // Only the real one notified the practice.
    expect(readOutbox().filter((m) => m.subject.startsWith("New enquiry"))).toHaveLength(1)
  })

  it("stores even malformed spam, capped", async () => {
    const res = await post({ website: "x", name: "y".repeat(5000), email: 42 })
    expect(res.status).toBe(201)
    const [row] = await getDb().select().from(leads)
    expect(row).toMatchObject({ status: "spam", email: "" })
    expect(row!.name.length).toBeLessThanOrEqual(120)
  })

  it("limits 5 per 10 minutes per IP, and separately per email", async () => {
    const ip = freshIp()
    for (let i = 0; i < 5; i++) expect((await post(submission(), ip)).status).toBe(201)
    const blocked = await post(submission(), ip)
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get("retry-after")).toMatch(/^\d+$/)
    expect((await blocked.json()).error.code).toBe("RATE_LIMITED")
    const same = submission().email
    for (let i = 0; i < 5; i++) await post(submission({ email: same }))
    expect((await post(submission({ email: same }))).status).toBe(429)
  })

  it("privacy by default: no message in the notification, auto-reply never echoes it", async () => {
    await getDb().insert(settings).values({
      key: "notifications",
      value: { recipients: ["owner@example.com"], autoReply: { enabled: true, subject: "Thanks", body: "Hi {name}" } },
    })
    await post(submission())
    await drain()
    const out = readOutbox()
    const notify = out.find((m) => m.subject.startsWith("New enquiry"))!
    expect([notify.to].flat()).toEqual(["owner@example.com"])
    expect(notify.subject).toBe("New enquiry from Ann Example")
    expect(`${notify.html}${notify.text}`).not.toContain("SECRET-MESSAGE")
    expect(notify.text).toMatch(/\/admin\/leads\?lead=[0-9a-f-]{36}/)
    const reply = out.find((m) => m.subject === "Thanks")!
    expect(`${reply.html}${reply.text}`).not.toContain("SECRET-MESSAGE")
    expect(reply.text).toContain("Hi Ann Example")
  })

  it("includes the message when the owner switched it on", async () => {
    await getDb().insert(settings).values({ key: "notifications", value: { includeMessage: true } })
    await post(submission())
    await drain()
    expect(readOutbox()[0]!.text).toContain("SECRET-MESSAGE")
  })

  it("a failed notification keeps the lead, logs an email activity and alerts owners", async () => {
    await cookieFor("owner") // creates owner@example.com
    const real = email.sendEmail
    vi.spyOn(email, "sendEmail").mockImplementation(async (m) => {
      if (m.subject.startsWith("New enquiry")) throw new email.EmailError("smtp_error", "down")
      return real(m)
    })
    expect((await post(submission())).status).toBe(201)
    await drain()
    const [activity] = await getDb().select().from(leadActivities)
    expect(activity).toMatchObject({ type: "email", data: { kind: "notification", status: "failed", error: "smtp_error" } })
    expect(readOutbox().some((m) => [m.to].flat().includes("owner@example.com"))).toBe(true)
    vi.restoreAllMocks()
  })

  it("writes no audit row and never logs the message", async () => {
    await post(submission())
    expect(JSON.stringify(await getDb().select().from(auditLogs))).not.toContain("SECRET-MESSAGE")
  })

  it("issues a fresh stamp with no-store", async () => {
    const res = await publicRequest("/leads/stamp")
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect((await res.json()).stamp).toMatch(/^\d{13}\.[0-9a-f]{32}$/)
  })

  it("refuses bodies over 64 KB", async () => {
    const res = await post(submission({ message: "x".repeat(70_000) }))
    expect(res.status).toBe(413)
  })
})
```

Add `insertServiceAndForm()` to `tests/integration/helpers/content.ts`: insert one services collection row with slug `anxiety` (title "Anxiety"), and write the settings rows `contactForm` (`{ formats: ["Online", "In person"], extraTopics: ["Something else"] }`) and `contact` (`{ email: "practice@example.com" }`, filling the remaining required fields from the schema defaults). Look at how `insertMedia` and the collections tests insert rows and reuse that path.

**Note on `vi.spyOn(email, "sendEmail")`:** `notify.ts` must call `sendEmail` through the module namespace (`import * as mail from "@/server/lib/email"` → `mail.sendEmail(...)`), or the spy cannot intercept it under ESM. Otherwise, inject a `send` parameter as `deliverResetEmail` does and test through that.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project unit server/lib/turnstile.test.ts server/env.test.ts && pnpm test:integration -- leads-public`
Expected: FAIL (`/api/v1/public/leads` → 404, modules missing).

- [ ] **Step 3: Implement the public area**

`server/env.ts`: add `TURNSTILE_SITE_KEY: z.string().min(1).optional()`, `TURNSTILE_SECRET_KEY: z.string().min(1).optional()`, and in `superRefine`:

```ts
if (Boolean(env.TURNSTILE_SITE_KEY) !== Boolean(env.TURNSTILE_SECRET_KEY)) {
  ctx.addIssue({
    code: "custom",
    path: [env.TURNSTILE_SITE_KEY ? "TURNSTILE_SECRET_KEY" : "TURNSTILE_SITE_KEY"],
    message: "Set both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, or neither",
  })
}
```

Document all three new vars (`RESEND_API_KEY`, the Turnstile pair) in `.env.example` as optional, and update its "Required in production" comment: drop "(until Phase 6)" and add `SMTP_URL or RESEND_API_KEY, depending on EMAIL_DRIVER`.

`server/api/middleware/public-limit.ts`:

```ts
import "server-only"

import { createMiddleware } from "hono/factory"

import { errorBody } from "@/server/api/errors"
import type { AppEnv } from "@/server/api/types"
import { clientIp } from "@/server/lib/client-ip"
import { hashIp } from "@/server/lib/crypto"
import { hitLimit } from "@/server/lib/rate-limit-db"

// docs/brief.md §8.1 "/v1/public/* → rateLimit". Answers directly so the
// Retry-After header survives (the error handler builds a fresh response).
export const publicLimit = (name: string, opts: { limit: number; windowMs: number }) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const ip = clientIp(c.req.raw.headers) ?? "unknown"
    const { allowed, retryAfterSec } = await hitLimit(`${name}:ip:${hashIp(ip)}`, opts)
    if (!allowed) {
      return c.json(
        errorBody("RATE_LIMITED", "Too many requests. Try again later.", c.get("requestId")),
        429,
        { "Retry-After": String(retryAfterSec) }
      )
    }
    await next()
  })
```

`server/api/routes/public.ts`:

```ts
import "server-only"

import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"

import { leadsPublicRoutes } from "@/server/modules/leads/public-routes"

import { errorBody } from "../errors"
import type { AppEnv } from "../types"

const PUBLIC_BODY_LIMIT = 64 * 1024

export const publicRoutes = new Hono<AppEnv>()
  .use(async (c, next) => {
    await next()
    c.header("Cache-Control", "no-store")
  })
  .use(
    bodyLimit({
      maxSize: PUBLIC_BODY_LIMIT,
      onError: (c) =>
        c.json(errorBody("PAYLOAD_TOO_LARGE", "Request body is too large", c.get("requestId")), 413),
    })
  )
  .route("/leads", leadsPublicRoutes)
```

Mount it in `server/api/app.ts`: `.route("/v1/public", publicRoutes)` after `/v1/redirects`.

`server/modules/leads/public-routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { publicLimit } from "@/server/api/middleware/public-limit"
import type { AppEnv } from "@/server/api/types"
import { clientIp } from "@/server/lib/client-ip"

import { issueStamp } from "./stamp"
import { LEAD_LIMIT, submitLead } from "./submit"

export const leadsPublicRoutes = new Hono<AppEnv>()
  .get("/stamp", (c) => c.json({ stamp: issueStamp() }))
  // The body is parsed by the service: spam is captured before Zod (§13).
  .post("/", publicLimit("lead", LEAD_LIMIT), async (c) => {
    const body = await c.req.json().catch(() => ({}))
    await submitLead(body, {
      ip: clientIp(c.req.raw.headers),
      userAgent: c.req.header("user-agent") ?? "",
    })
    return c.json({ ok: true as const }, 201)
  })
```

`server/lib/turnstile.ts`:

```ts
import "server-only"

import { getEnv } from "@/server/env"

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export const turnstileEnabled = () => Boolean(getEnv().TURNSTILE_SECRET_KEY)
export const turnstileSiteKey = () => getEnv().TURNSTILE_SITE_KEY ?? null

// docs/brief.md §13: success, action and hostname are all checked; tokens are
// single-use (Cloudflare enforces it). Fails closed (Ruling R17).
export async function verifyTurnstile(token: string | undefined, ip: string | null) {
  const env = getEnv()
  if (!token || !env.TURNSTILE_SECRET_KEY) return false
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token })
  if (ip) body.set("remoteip", ip)
  try {
    const res = await fetch(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(5_000) })
    const data = (await res.json()) as { success?: boolean; action?: string; hostname?: string }
    return (
      data.success === true &&
      data.action === "lead" &&
      data.hostname === new URL(env.SITE_URL).hostname
    )
  } catch (error) {
    console.error("[turnstile] siteverify failed", error)
    return false
  }
}
```

- [ ] **Step 4: Implement the pipeline**

`server/modules/leads/submit.ts`:

```ts
import "server-only"

import * as z from "zod"

import { LeadSubmission } from "@/lib/leads/schema"
import { invalid, ApiError } from "@/server/api/errors"
import { getDb } from "@/server/db/client"
import { leads } from "@/server/db/schema"
import { hashEmail, hashIp } from "@/server/lib/crypto"
import { defer } from "@/server/lib/defer"
import { hitLimit } from "@/server/lib/rate-limit-db"
import { verifyTurnstile, turnstileEnabled } from "@/server/lib/turnstile"
import { getGlobal } from "@/server/modules/globals/service"

import { notifyNewLead } from "./notify"
import { toE164 } from "./phone"
import { checkStamp } from "./stamp"
import { allowedOptions } from "./options"

export const LEAD_LIMIT = { limit: 5, windowMs: 10 * 60_000 }

const cap = (n: number) => z.string().max(100_000).catch("").transform((v) => v.slice(0, n))
// Ruling R7: spam is kept for review, coerced, never validated.
const SpamCapture = z.object({
  name: cap(120), email: cap(254), phone: cap(40), topic: cap(80),
  message: cap(5000), sourcePath: cap(300),
})

type Ctx = { ip: string | null; userAgent: string; now?: Date }

export async function submitLead(body: unknown, ctx: Ctx) {
  const now = ctx.now ?? new Date()
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const meta = {
    ipHash: ctx.ip ? hashIp(ctx.ip) : null,
    userAgent: ctx.userAgent.slice(0, 512),
  }
  // 1. The per-IP limit already ran (publicLimit). 2. Honeypot and stamp.
  const honeypot = typeof raw.website === "string" && raw.website.trim() !== ""
  const stamp = checkStamp(typeof raw.stamp === "string" ? raw.stamp : undefined, now.getTime())
  if (honeypot || stamp !== "ok") {
    const s = SpamCapture.parse(raw)
    const [row] = await getDb().insert(leads).values({
      name: s.name, email: s.email, phone: s.phone || null, topicSlug: s.topic,
      message: s.message, sourcePath: s.sourcePath || "/", status: "spam",
      spamReason: honeypot ? "honeypot" : stamp, ...meta,
    }).returning({ id: leads.id })
    return { ok: true as const, leadId: row!.id }
  }
  // 3. Zod.
  const parsed = LeadSubmission.safeParse(raw)
  if (!parsed.success) throw invalid(parsed.error)
  const input = parsed.data
  // Per-email limit (needs a valid address, so it runs after Zod).
  if (!(await hitLimit(`lead:email:${hashEmail(input.email)}`, LEAD_LIMIT, now)).allowed) {
    throw new ApiError("RATE_LIMITED", "Too many requests. Try again later.")
  }
  const fieldErrors: Record<string, string[]> = {}
  const options = await allowedOptions()
  if (!options.topics.has(input.topic)) fieldErrors.topic = ["Choose a topic from the list"]
  if (input.format && !options.formats.has(input.format)) fieldErrors.format = ["Choose a format from the list"]
  if (input.plan && !options.plans.has(input.plan)) fieldErrors.plan = ["Unknown plan"]
  const phone = input.phone ? toE164(input.phone) : null
  if (input.phone && !phone) fieldErrors.phone = ["Enter a valid phone number"]
  if (Object.keys(fieldErrors).length) throw new ApiError("VALIDATION_FAILED", "Check the highlighted fields", fieldErrors)
  // 4. Turnstile, only when configured.
  if (turnstileEnabled() && !(await verifyTurnstile(input.turnstileToken, ctx.ip))) {
    throw new ApiError("VALIDATION_FAILED", "Verification failed", { turnstile: ["Please try again"] })
  }
  const form = (await getGlobal("contactForm")).value
  const [row] = await getDb().insert(leads).values({
    name: input.name, email: input.email, phone, topicSlug: input.topic,
    formatSlug: input.format ?? null, planSlug: input.plan ?? null, message: input.message,
    privacyConsentAt: now, marketingConsent: false,
    consent: { privacyText: form.consent, analytics: false, marketing: false, version: null },
    sourcePath: input.sourcePath, referrer: input.attribution.referrer, utm: input.attribution.utm,
    metaEventId: input.eventId ?? null, ...meta,
  }).returning({ id: leads.id })
  defer(() => notifyNewLead(row!.id), "lead notification")
  return { ok: true as const, leadId: row!.id }
}
```

Create `server/modules/leads/options.ts` exporting `allowedOptions(): Promise<{ topics: Set<string>; formats: Set<string>; plans: Set<string> }>`, built from the services and plans collections (slugs), `slugify()` of `contactForm.extraTopics` plus `"other"`, and `slugify()` of `contactForm.formats`. It must mirror exactly what `resolve-block.tsx` renders (Ruling R8). Read through the uncached repo functions (not `'use cache'` queries: a Route Handler outside a page render).

`ConsentRecord.privacyText` is the server's copy of the consent text, never the client's.

`server/modules/leads/notify.ts`:

```ts
import "server-only"

import { eq, like } from "drizzle-orm"

import { getDb } from "@/server/db/client"
import { leadActivities, leads, users } from "@/server/db/schema"
import { getEnv } from "@/server/env"
import * as mail from "@/server/lib/email"
import {
  deliveryFailureEmail, enquiryAutoReplyEmail, newEnquiryEmail,
} from "@/server/lib/email/templates"
import { getGlobal } from "@/server/modules/globals/service"

import { allowedOptions, optionLabels } from "./options"

type Kind = "notification" | "auto-reply"

async function attempt(leadId: string, kind: Kind, send: () => Promise<void>) {
  try {
    await send()
    await getDb().insert(leadActivities).values({ leadId, type: "email", data: { kind, status: "sent" } })
  } catch (error) {
    const code = error instanceof mail.EmailError ? error.code : "unknown"
    await getDb().insert(leadActivities).values({ leadId, type: "email", data: { kind, status: "failed", error: code } })
    await alertOwners(leadId, kind)
  }
}

async function alertOwners(leadId: string, kind: Kind) {
  const owners = await getDb().select({ email: users.email }).from(users).where(like(users.role, "%owner%"))
  if (!owners.length) return
  const message = await deliveryFailureEmail({ kind, leadUrl: leadUrl(leadId), occurredAt: new Date() })
  await mail.sendEmail({ to: owners.map((o) => o.email), ...message, idempotencyKey: `enquiry/${leadId}/delivery-failure` })
    .catch((error) => console.error("[leads] delivery-failure alert failed", error))
}

const leadUrl = (id: string) => `${getEnv().SITE_URL}/admin/leads?lead=${id}`

export async function notifyNewLead(leadId: string) {
  const [lead] = await getDb().select().from(leads).where(eq(leads.id, leadId))
  if (!lead || lead.status === "spam") return
  const [{ value: notifications }, { value: contact }] = await Promise.all([
    getGlobal("notifications"), getGlobal("contact"),
  ])
  const recipients = notifications.recipients.length ? notifications.recipients : [contact.email].filter(Boolean)
  const labels = await optionLabels(lead)
  if (recipients.length) {
    await attempt(leadId, "notification", async () => {
      const message = await newEnquiryEmail({
        name: lead.name, email: lead.email, phone: lead.phone, ...labels,
        message: lead.message, includeMessage: notifications.includeMessage, adminUrl: leadUrl(lead.id),
      })
      await mail.sendEmail({ to: recipients, ...message, replyTo: lead.email, idempotencyKey: `enquiry/${lead.id}/notify` })
    })
  }
  if (notifications.autoReply.enabled && notifications.autoReply.subject) {
    await attempt(leadId, "auto-reply", async () => {
      const message = await enquiryAutoReplyEmail({ name: lead.name, ...notifications.autoReply })
      await mail.sendEmail({ to: lead.email, ...message, idempotencyKey: `enquiry/${lead.id}/auto-reply` })
    })
  }
}
```

`optionLabels(lead)` (in `options.ts`) maps the stored slugs back to display labels (`{ topic, format, plan }`, falling back to the slug). Better Auth stores roles comma-separated; `like '%owner%'` is safe because no other role name contains "owner". Add a comment saying so.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit server/lib server/env.test.ts && pnpm test:integration -- leads-public && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server tests .env.example
git commit -m "feat(leads): public enquiry endpoint with abuse checks and notifications"
```

---

### Task 4: Contact form wiring — API errors, success, stamp, Turnstile, attribution

**Files:**
- Create: `features/contact/lib/submit-lead.ts`, `features/contact/lib/attribution.ts`, `features/contact/lib/track.ts`, `features/contact/components/turnstile.tsx`, `components/attribution-capture.tsx`
- Modify: `features/contact/components/contact-form.tsx`, `app/(site)/_cms/resolve-block.tsx`, `app/(site)/layout.tsx`
- Test: `features/contact/lib/submit-lead.test.ts`, `features/contact/lib/attribution.test.ts`, `features/contact/components/contact-form.test.tsx`

**Interfaces:**
- Consumes: Task 2 `LeadInput` (client-side validation now uses it, replacing the local regex), `LeadSubmission`, `UTM_KEYS`; Task 3 endpoints and their responses; `turnstileSiteKey()`.
- Produces:
  - `submitLead(payload: LeadSubmission): Promise<SubmitResult>` where `type SubmitResult = { ok: true } | { ok: false; kind: "fields"; fieldErrors: Record<string, string[]> } | { ok: false; kind: "rate-limited" } | { ok: false; kind: "error" }` (client; `fetch("/api/v1/public/leads")`).
  - `fetchStamp(): Promise<string>` (`""` on failure).
  - `captureAttribution(location: Location, referrer: string, storage: Storage): void`; `readAttribution(storage: Storage): Attribution` (key `mk:attribution`, first touch wins, wrapped in try/catch).
  - `trackLead(eventId: string): void`.
  - `ContactForm` props gain `turnstileSiteKey: string | null`.

- [ ] **Step 1: Write the failing tests**

`features/contact/lib/attribution.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { captureAttribution, readAttribution } from "./attribution"

const storage = () => {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage
}
const at = (href: string) => new URL(href) as unknown as Location

describe("first-touch attribution", () => {
  it("keeps the first landing's UTM and referrer only", () => {
    const s = storage()
    captureAttribution(at("https://site.ie/insights/x?utm_source=google&utm_medium=cpc&gclid=1"), "https://google.com/", s)
    captureAttribution(at("https://site.ie/contact?utm_source=other"), "https://site.ie/insights/x", s)
    expect(readAttribution(s)).toEqual({
      referrer: "https://google.com/",
      landingPath: "/insights/x",
      utm: { utm_source: "google", utm_medium: "cpc" },
    })
  })
  it("ignores a same-site referrer and survives storage errors", () => {
    const broken = { getItem: () => { throw new Error("blocked") }, setItem: () => { throw new Error("blocked") } } as unknown as Storage
    expect(() => captureAttribution(at("https://site.ie/"), "", broken)).not.toThrow()
    expect(readAttribution(broken)).toEqual({ referrer: "", landingPath: "", utm: {} })
  })
})
```

`features/contact/lib/submit-lead.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"

import { submitLead } from "./submit-lead"

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }))
afterEach(() => vi.restoreAllMocks())
const payload = { name: "Ann" } as never

describe("submitLead", () => {
  it("maps the API's answers", async () => {
    respond(201, { ok: true })
    expect(await submitLead(payload)).toEqual({ ok: true })
    respond(400, { error: { code: "VALIDATION_FAILED", fieldErrors: { email: ["bad"] } } })
    expect(await submitLead(payload)).toEqual({ ok: false, kind: "fields", fieldErrors: { email: ["bad"] } })
    respond(429, { error: { code: "RATE_LIMITED" } })
    expect(await submitLead(payload)).toEqual({ ok: false, kind: "rate-limited" })
    respond(500, {})
    expect(await submitLead(payload)).toEqual({ ok: false, kind: "error" })
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"))
    expect(await submitLead(payload)).toEqual({ ok: false, kind: "error" })
  })
})
```

`features/contact/components/contact-form.test.tsx` (jsdom via `tests/setup/dom.ts`; render with `NuqsTestingAdapter` from `nuqs/adapters/testing`; `copy` built from `GLOBALS.contactForm.parse({ ... })` with distinctive strings):

```tsx
// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { afterEach, describe, expect, it, vi } from "vitest"

import { GLOBALS } from "@/lib/content/globals"

import { ContactForm } from "./contact-form"

const copy = GLOBALS.contactForm.parse({
  labels: { name: "Name", email: "Email", phone: "Phone", topic: "Topic", format: "Format", message: "Message" },
  errors: { name: "NAME-ERR", email: "EMAIL-ERR", topic: "TOPIC-ERR", consent: "CONSENT-ERR", phone: "PHONE-ERR", rateLimited: "SLOW-DOWN", generic: "OOPS" },
  success: { title: "SENT-TITLE", body: "b" },
  consent: "I agree",
  button: "Send",
})
const props = {
  copy,
  topics: [{ slug: "anxiety", label: "Anxiety" }],
  formats: [{ slug: "online", label: "Online" }],
  plans: [],
  turnstileSiteKey: null,
}
const calls: { url: string; body?: unknown }[] = []
const mockApi = (leadStatus: number, leadBody: unknown) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input)
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (url.endsWith("/stamp")) return new Response(JSON.stringify({ stamp: "1.a" }))
    return new Response(JSON.stringify(leadBody), { status: leadStatus })
  })
afterEach(() => { vi.restoreAllMocks(); calls.length = 0 })

async function fillAndSend() {
  const user = userEvent.setup()
  render(<NuqsTestingAdapter><ContactForm {...props} /></NuqsTestingAdapter>)
  await user.type(screen.getByLabelText(/Name/), "Ann")
  await user.type(screen.getByLabelText(/Email/), "ann@example.com")
  await user.selectOptions(screen.getByLabelText(/Topic/), "anxiety")
  await user.click(screen.getByRole("checkbox"))
  await user.click(screen.getByRole("button", { name: "Send" }))
}

describe("ContactForm", () => {
  it("posts slugs, the stamp, an event id and the honeypot, then shows success", async () => {
    mockApi(201, { ok: true })
    await fillAndSend()
    expect(await screen.findByText("SENT-TITLE")).toBeTruthy()
    const lead = calls.find((c) => c.url === "/api/v1/public/leads")!.body as Record<string, unknown>
    expect(lead).toMatchObject({ topic: "anxiety", format: "online", stamp: "1.a", website: "", consent: true })
    expect(lead.eventId).toMatch(/^[0-9a-f-]{36}$/)
  })
  it("shows the API's field errors with the form's own copy", async () => {
    mockApi(400, { error: { code: "VALIDATION_FAILED", fieldErrors: { phone: ["x"] } } })
    await fillAndSend()
    expect(await screen.findByText("PHONE-ERR")).toBeTruthy()
  })
  it("explains a rate limit", async () => {
    mockApi(429, { error: { code: "RATE_LIMITED" } })
    await fillAndSend()
    expect(await screen.findByText("SLOW-DOWN")).toBeTruthy()
  })
  it("keeps the honeypot out of the accessibility tree", () => {
    mockApi(201, { ok: true })
    render(<NuqsTestingAdapter><ContactForm {...props} /></NuqsTestingAdapter>)
    const trap = document.querySelector<HTMLInputElement>('input[name="website"]')!
    expect(trap.tabIndex).toBe(-1)
    expect(trap.autocomplete).toBe("off")
    expect(trap.closest("[aria-hidden='true']")).not.toBeNull()
  })
})
```

If the form's labels include the required asterisk, the regex matchers above already allow for it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project unit features/contact`
Expected: FAIL.

- [ ] **Step 3: Implement the client helpers**

`features/contact/lib/submit-lead.ts`:

```ts
import type { LeadSubmission } from "@/lib/leads/schema"

export type SubmitResult =
  | { ok: true }
  | { ok: false; kind: "fields"; fieldErrors: Record<string, string[]> }
  | { ok: false; kind: "rate-limited" }
  | { ok: false; kind: "error" }

export async function fetchStamp(): Promise<string> {
  try {
    const res = await fetch("/api/v1/public/leads/stamp", { cache: "no-store" })
    return res.ok ? ((await res.json()) as { stamp: string }).stamp : ""
  } catch {
    return ""
  }
}

export async function submitLead(payload: LeadSubmission): Promise<SubmitResult> {
  try {
    const res = await fetch("/api/v1/public/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (res.status === 201) return { ok: true }
    if (res.status === 429) return { ok: false, kind: "rate-limited" }
    const body = (await res.json().catch(() => ({}))) as { error?: { fieldErrors?: Record<string, string[]> } }
    if (res.status === 400 && body.error?.fieldErrors) return { ok: false, kind: "fields", fieldErrors: body.error.fieldErrors }
    return { ok: false, kind: "error" }
  } catch {
    return { ok: false, kind: "error" }
  }
}
```

`features/contact/lib/attribution.ts`: `captureAttribution` writes `mk:attribution` = `JSON.stringify({ referrer, landingPath, utm })` only if the key is absent. `referrer` is kept only when its origin differs from `location.origin`. `utm` picks `UTM_KEYS` from `location.search`, each value sliced to 200 characters. `readAttribution` parses it with `Attribution.safeParse` and falls back to the empty value. Both are wrapped in `try/catch`.

`features/contact/lib/track.ts`:

```ts
type DataLayerWindow = Window & { dataLayer?: unknown[] }

// Ruling R16: plumbing only. GTM and consent arrive in Phase 8; until then
// nothing defines dataLayer and this is a no-op.
export function trackLead(eventId: string) {
  const w = window as DataLayerWindow
  if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event: "generate_lead", event_id: eventId })
}
```

`components/attribution-capture.tsx`: `"use client"`; `useEffect(() => captureAttribution(window.location, document.referrer, window.sessionStorage), [])` (the `sessionStorage` getter itself can throw, so wrap it); returns `null`. Render `<AttributionCapture />` inside `<NuqsAdapter>` in `app/(site)/layout.tsx`. It renders nothing, so parity is unaffected.

`features/contact/components/turnstile.tsx`: `"use client"`; props `{ siteKey: string; onToken(token: string | null): void }`. It loads `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` once (a module-level promise; `<script async>` appended to `document.head`) and calls `window.turnstile.render(ref.current, { sitekey, action: "lead", callback: onToken, "expired-callback": () => onToken(null), "error-callback": () => onToken(null) })`; on unmount it calls `window.turnstile.remove(id)`. It renders `<div ref={ref} className="min-h-16.25" />`. It is rendered only when `siteKey` is non-null, so E2E and parity (no keys) never load it. CSP for the script is Phase 8's job (§12.6); note this in the commit body.

- [ ] **Step 4: Wire the form**

In `contact-form.tsx`:
- Add the `turnstileSiteKey: string | null` prop and pass it through `ContactForm` → `PrefilledForm` → `EnquiryForm`.
- Replace the old header comment ("No email service is connected yet…") with one describing the real flow.
- Option and radio `value`s become slugs (`topic.slug`, `format.slug`); `prefill.topic` / `prefill.format` become slugs (`topic`, `format` straight from `useQueryStates`), `defaultChecked` compares slugs. Add a hidden `<input type="hidden" name="plan" value={plan ?? ""} />` when a plan is chosen.
- Extend `Field` to `"name" | "email" | "phone" | "topic" | "message" | "consent"`; client validation runs `LeadInput.safeParse` on the collected values and maps issue paths to `copy.errors[field]`.
- Add a stamp: `const [stamp, setStamp] = useState("")` + `useEffect(() => { void fetchStamp().then(setStamp) }, [])`.
- Add the honeypot inside the form, before the submit button:

```tsx
<div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
  <label>
    Website
    <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
  </label>
</div>
```

  (the `<form>` gets `relative`; the trap is off-screen, not `display:none`, so naive bots fill it).
- `onSubmit` becomes async. Validate → build `LeadSubmission` (`eventId: crypto.randomUUID()`, `sourcePath: location.pathname`, `attribution: readAttribution(sessionStorage)` (guarded), `stamp`, `website`, `turnstileToken`) → `submitLead` → `{ ok: true }` ⇒ `trackLead(eventId)`, `setSent(true)`; `kind: "fields"` ⇒ map each key to `copy.errors[key] ?? copy.errors.generic` and focus the first; `rate-limited` ⇒ form-level `copy.errors.rateLimited`; `error` ⇒ `copy.errors.generic`. The form-level message renders as `<p role="alert" className="text-[13px] leading-[1.4] text-clay">` above the button. While pending, the button is `disabled` with `aria-busy="true"` (same classes, plus `disabled:opacity-70`). "Send another" resets the state and fetches a new stamp.
- Add the phone and message `FieldError`s with `aria-invalid` / `aria-describedby`, like the existing fields.
- Render `<Turnstile siteKey=… onToken={setToken} />` above the button when `turnstileSiteKey` is set; submitting without a token then shows `copy.errors.generic`.

In `resolve-block.tsx` `contact.details`: pass `turnstileSiteKey: turnstileSiteKey()` (from `server/lib/turnstile.ts`; `resolve-block` already runs after `io()`). The topic/format slug mapping already exists there; keep it the single source and make `server/modules/leads/options.ts` produce the same slugs (add `extraTopics` → `slugify(label)`). Nothing visual changes.

- [ ] **Step 5: Run the tests and parity**

Run: `pnpm vitest run --project unit features/contact && pnpm typecheck && pnpm lint && pnpm test:parity`
Expected: PASS; parity unchanged (21/21), because the hidden inputs and option values are invisible.

- [ ] **Step 6: Commit**

```bash
git add features/contact components/attribution-capture.tsx "app/(site)/layout.tsx" "app/(site)/_cms/resolve-block.tsx"
git commit -m "feat(contact): submit enquiries with field errors, stamp, Turnstile and attribution"
```

---

### Task 5: Enquiries admin API — list, detail, status, notes, export, erase, DSAR

**Files:**
- Create: `server/modules/leads/service.ts`, `server/modules/leads/routes.ts`, `server/modules/leads/csv.ts`, `server/modules/leads/dsar.ts`
- Modify: `server/api/routes/admin.ts`, `admin/lib/api.ts`, `admin/lib/query-keys.ts`
- Test: `server/modules/leads/csv.test.ts`, `tests/integration/api/leads-admin.test.ts`

**Interfaces:**
- Consumes: Task 2 tables, `LeadListQuery`, `LeadPatch`, `LeadNote`, `hashEmail`; `audit`, `can`, `validationHook`, `ApiError`, `userName` (if present in `server/lib`; otherwise select `users.name`).
- Produces (all under `/api/v1/admin/leads`, typed `LeadsRoutes`; client `leadsApi`):
  - `GET /` (`lead.read`; query `LeadListQuery`) → `{ items: LeadSummary[]; page; pageSize; total }` where `LeadSummary = { id, name, email, phone, topicSlug, formatSlug, status, spamReason, assignee: { id, name } | null, createdAt }` (**no message**).
  - `GET /stats` (`lead.read`) → `{ new: number }` (status `new` only; spam excluded).
  - `GET /assignees` (`lead.update`) → `{ items: { id: string; name: string }[] }` (users whose roles include owner, admin or intake, not banned).
  - `GET /:id` (`lead.read`) → `LeadDetail = LeadSummary & { message, planSlug, privacyConsentAt, marketingConsent, consent, sourcePath, referrer, utm, metaEventId, activities: { id, type, body, data, actor: { id, name } | null, createdAt }[] }`.
  - `PATCH /:id` (`lead.update`; body `LeadPatch`) → `LeadDetail`. Writes one activity per changed field (`status` `{ from, to }`; `assignment` `{ from, to }`), sets `statusChangedAt`, audits `lead.update` with `diff` `{ status?: {from,to}, assignedTo?: {from,to} }` only.
  - `POST /:id/notes` (`lead.update`; `LeadNote`) → `201` activity row. Audit `lead.note` with no body.
  - `GET /export.csv` (`lead.export`; `folder`, `status` filters) → `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="enquiries-YYYY-MM-DD.csv"`. Audit `lead.export` with the count.
  - `DELETE /:id` (`lead.delete`) → `{ ok: true }`; hard delete (cascade). Audit `lead.erase`, summary `Enquiry erased`.
  - `GET /dsar?email=` (`lead.export` + `newsletter.export`) → JSON attachment `{ email, generatedAt, leads: LeadDetail[], newsletter: row | null }`. `DELETE /dsar?email=` (`lead.delete` + `newsletter.delete`) → `{ leads: number; newsletter: number }`. Both audit counts only, entity id `hashEmail(email)`.
  - `toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string`.
  - `queryKeys.leads = { all, list(params), detail(id), stats, assignees }`.

- [ ] **Step 1: Write the failing tests**

`server/modules/leads/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { toCsv } from "./csv"

const cols = [{ key: "name", label: "Name" }, { key: "message", label: "Message" }]

describe("toCsv", () => {
  it("neutralises formulas, doubles quotes and keeps newlines quoted", () => {
    const csv = toCsv(
      [
        { name: '=HYPERLINK("https://evil.example")', message: 'He said "hi"\nthen left' },
        { name: "+1-555", message: "@SUM(A1)" },
        { name: "-2", message: "\tTab" },
      ],
      cols
    )
    expect(csv.split("\r\n")[0]).toBe("Name,Message")
    expect(csv).toContain(`"'=HYPERLINK(""https://evil.example"")"`)
    expect(csv).toContain(`"He said ""hi""\nthen left"`)
    expect(csv).toContain(`"'+1-555","'@SUM(A1)"`)
    expect(csv).toContain(`"'-2","'\tTab"`)
    expect(csv.startsWith("﻿")).toBe(false)
  })
  it("renders null and dates", () => {
    expect(toCsv([{ name: null, message: new Date("2026-01-02T03:04:05Z") }], cols)).toContain(`"","2026-01-02T03:04:05.000Z"`)
  })
})
```

`tests/integration/api/leads-admin.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, leadActivities, leads, newsletterSubscribers } from "@/server/db/schema"

import { adminRequest, cookieFor } from "../helpers/auth"
import { insertLead } from "../helpers/leads"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

// §7.2: [GET /, PATCH /:id, GET /export.csv, DELETE /:id]
const MATRIX: Record<RoleName, [number, number, number, number]> = {
  owner: [200, 200, 200, 200], admin: [200, 200, 200, 200], intake: [200, 200, 403, 403],
  editor: [403, 403, 403, 403], author: [403, 403, 403, 403], marketer: [403, 403, 403, 403], viewer: [403, 403, 403, 403],
}

describe.each(ROLE_NAMES)("leads RBAC for %s", (role) => {
  it(`→ ${MATRIX[role].join(", ")}`, async () => {
    const cookie = await cookieFor(role)
    const lead = await insertLead()
    const got = [
      (await adminRequest("/leads", cookie)).status,
      (await adminRequest(`/leads/${lead.id}`, cookie, { method: "PATCH", body: { status: "contacted" } })).status,
      (await adminRequest("/leads/export.csv", cookie)).status,
      (await adminRequest(`/leads/${lead.id}`, cookie, { method: "DELETE" })).status,
    ]
    expect(got).toEqual(MATRIX[role])
  })
})

describe("leads API", () => {
  it("lists the inbox without spam or messages, filters, searches and counts new", async () => {
    const cookie = await cookieFor("intake")
    await insertLead({ name: "Ann", email: "ann@example.com", message: "SECRET" })
    await insertLead({ name: "Bob", email: "bob@example.com", status: "contacted" })
    await insertLead({ name: "Spammy", status: "spam", spamReason: "honeypot" })
    const inbox = await (await adminRequest("/leads", cookie)).json()
    expect(inbox.total).toBe(2)
    expect(JSON.stringify(inbox)).not.toContain("SECRET")
    expect((await (await adminRequest("/leads?folder=spam", cookie)).json()).items[0].name).toBe("Spammy")
    expect((await (await adminRequest("/leads?status=contacted", cookie)).json()).items.map((i: { name: string }) => i.name)).toEqual(["Bob"])
    expect((await (await adminRequest("/leads?q=ann%40example", cookie)).json()).total).toBe(1)
    expect(await (await adminRequest("/leads/stats", cookie)).json()).toEqual({ new: 1 })
  })

  it("changes status and assignee with a timeline, notes, and an audit without PII", async () => {
    const cookie = await cookieFor("intake")
    const owner = await cookieFor("owner")
    void owner
    const lead = await insertLead({ email: "private@example.com", phone: "+353870000000", message: "SECRET" })
    const { items: people } = await (await adminRequest("/leads/assignees", cookie)).json()
    expect(people.map((p: { name: string }) => p.name).sort()).toEqual(["intake", "owner"])
    const patched = await (await adminRequest(`/leads/${lead.id}`, cookie, {
      method: "PATCH", body: { status: "contacted", assignedTo: people[0].id },
    })).json()
    expect(patched.status).toBe("contacted")
    await adminRequest(`/leads/${lead.id}/notes`, cookie, { method: "POST", body: { body: "Called back" } })
    const detail = await (await adminRequest(`/leads/${lead.id}`, cookie)).json()
    expect(detail.message).toBe("SECRET")
    expect(detail.activities.map((a: { type: string }) => a.type)).toEqual(["status", "assignment", "note"])
    const audit = JSON.stringify(await getDb().select().from(auditLogs))
    for (const pii of ["private@example.com", "+353870000000", "SECRET", "Called back"]) expect(audit).not.toContain(pii)
  })

  it("exports CSV for owners and erases a lead with its activities", async () => {
    const cookie = await cookieFor("owner")
    const lead = await insertLead({ name: "=cmd()" })
    await getDb().insert(leadActivities).values({ leadId: lead.id, type: "note", body: "x" })
    const csv = await adminRequest("/leads/export.csv", cookie)
    expect(csv.headers.get("content-type")).toContain("text/csv")
    expect(csv.headers.get("content-disposition")).toMatch(/attachment; filename="enquiries-\d{4}-\d{2}-\d{2}\.csv"/)
    expect(await csv.text()).toContain(`"'=cmd()"`)
    expect((await adminRequest(`/leads/${lead.id}`, cookie, { method: "DELETE" })).status).toBe(200)
    expect(await getDb().select().from(leadActivities)).toHaveLength(0)
    expect((await adminRequest(`/leads/${lead.id}`, cookie)).status).toBe(404)
  })

  it("DSAR exports and erases everything for one email, case-insensitively", async () => {
    const cookie = await cookieFor("admin")
    await insertLead({ email: "dsar@example.com" })
    await insertLead({ email: "DSAR@example.com" })
    await insertLead({ email: "other@example.com" })
    await getDb().insert(newsletterSubscribers).values({ email: "dsar@example.com", status: "confirmed" })
    const exported = await adminRequest("/leads/dsar?email=Dsar%40Example.com", cookie)
    expect(exported.headers.get("content-disposition")).toContain("attachment")
    const data = await exported.json()
    expect(data.leads).toHaveLength(2)
    expect(data.newsletter.status).toBe("confirmed")
    const erased = await (await adminRequest("/leads/dsar?email=dsar%40example.com", cookie, { method: "DELETE" })).json()
    expect(erased).toEqual({ leads: 2, newsletter: 1 })
    expect(await getDb().select().from(leads)).toHaveLength(1)
    expect(JSON.stringify(await getDb().select().from(auditLogs))).not.toContain("dsar@example.com")
  })

  it("refuses DSAR to intake and a marketer", async () => {
    for (const role of ["intake", "marketer"] as const) {
      const cookie = await cookieFor(role)
      expect((await adminRequest("/leads/dsar?email=a%40b.co", cookie)).status).toBe(403)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project unit server/modules/leads/csv.test.ts && pnpm test:integration -- leads-admin`
Expected: FAIL.

- [ ] **Step 3: Implement the CSV helper**

```ts
import "server-only"

// Formula injection (OWASP CSV injection): a leading = + - @ tab or CR turns
// the cell into text with a leading apostrophe. Every cell is quoted.
const FORMULA = /^[=+\-@\t\r]/

function cell(value: unknown) {
  const text = value == null ? "" : value instanceof Date ? value.toISOString() : String(value)
  const safe = FORMULA.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]) {
  const header = columns.map((c) => c.label).join(",")
  const body = rows.map((row) => columns.map((c) => cell(row[c.key])).join(","))
  return [header, ...body].join("\r\n")
}
```

The header row is not quoted (`Name,Message`), because labels are ours.

- [ ] **Step 4: Implement the service and routes**

`server/modules/leads/service.ts` exports `listLeads(actor, query)`, `leadStats()`, `listAssignees()`, `getLead(id)`, `updateLead(actor, id, patch)`, `addNote(actor, id, body)`, `exportLeads(actor, filters)`, `eraseLead(actor, id)`. Rules:
- `listLeads`: `folder = "spam"` ⇒ `status = 'spam'`, else `status <> 'spam'` (+ `status = $status` when set). `q` ⇒ `name ILIKE %q% OR email ILIKE %q% OR phone ILIKE %q%` (escape `%`/`_`). `assignee = "me"` needs the actor. Order by `created_at`, then id. Select explicit summary columns (never `message`), left join `users` for the assignee name, and a separate `count()` for `total`.
- `updateLead`: in a transaction, `select … for update`; a 404 `NOT_FOUND` if missing; validate that `assignedTo` is in `listAssignees()` (else `VALIDATION_FAILED { assignedTo }`); write the changed fields, then one `lead_activities` row per change with `actorId`, then `audit(actor, { action: "lead.update", entityType: "lead", entityId: id, summary: "Enquiry updated", diff })`. Moving into or out of `spam` is allowed (that is how a false positive is rescued, Task 6 "Not spam"); clear `spamReason` when leaving spam.
- `addNote`: insert the activity; audit `{ action: "lead.note", summary: "Note added to an enquiry" }`.
- `exportLeads`: the same filters without paging, all columns including `message`, consent and UTM flattened (`utm_source` …); audit `lead.export` with `summary: "Exported N enquiries"`.
- `eraseLead`: delete returning id → 404 if none; audit `lead.erase`.

Every audit call passes the `Actor` (it carries `ip`/`userAgent`); summaries never interpolate lead fields. Nothing here touches the public cache, so no `invalidate()`.

`server/modules/leads/dsar.ts`: `exportPerson(actor, email)` and `erasePerson(actor, email)`. Match `lower(leads.email) = lower($1)` and `newsletter_subscribers.email = lower($1)`. Erase runs both deletes in one transaction. Audit `{ action: "privacy.export" | "privacy.erase", entityType: "person", entityId: hashEmail(email), summary: "Privacy request: N enquiries, M subscriptions" }`.

`server/modules/leads/routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { LeadListQuery, LeadNote, LeadPatch } from "@/lib/leads/schema"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import * as dsar from "./dsar"
import * as service from "./service"

const IdParam = z.object({ id: z.uuid() })
const EmailQuery = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) })
const ExportQuery = LeadListQuery.pick({ folder: true, status: true })
const today = () => new Date().toISOString().slice(0, 10)

// Static paths before /:id.
export const leadsRoutes = new Hono<AppEnv>()
  .get("/", can({ lead: ["read"] }), zValidator("query", LeadListQuery, validationHook), async (c) =>
    c.json(await service.listLeads(c.get("actor")!, c.req.valid("query"))))
  .get("/stats", can({ lead: ["read"] }), async (c) => c.json(await service.leadStats()))
  .get("/assignees", can({ lead: ["update"] }), async (c) => c.json(await service.listAssignees()))
  .get("/export.csv", can({ lead: ["export"] }), zValidator("query", ExportQuery, validationHook), async (c) => {
    const csv = await service.exportLeads(c.get("actor")!, c.req.valid("query"))
    return c.body(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="enquiries-${today()}.csv"`,
    })
  })
  .get("/dsar", can({ lead: ["export"], newsletter: ["export"] }), zValidator("query", EmailQuery, validationHook), async (c) => {
    const data = await dsar.exportPerson(c.get("actor")!, c.req.valid("query").email)
    c.header("Content-Disposition", `attachment; filename="privacy-export-${today()}.json"`)
    return c.json(data)
  })
  .delete("/dsar", can({ lead: ["delete"], newsletter: ["delete"] }), zValidator("query", EmailQuery, validationHook), async (c) =>
    c.json(await dsar.erasePerson(c.get("actor")!, c.req.valid("query").email)))
  .get("/:id", can({ lead: ["read"] }), zValidator("param", IdParam, validationHook), async (c) =>
    c.json(await service.getLead(c.req.valid("param").id)))
  .patch("/:id", can({ lead: ["update"] }), zValidator("param", IdParam, validationHook), zValidator("json", LeadPatch, validationHook), async (c) =>
    c.json(await service.updateLead(c.get("actor")!, c.req.valid("param").id, c.req.valid("json"))))
  .post("/:id/notes", can({ lead: ["update"] }), zValidator("param", IdParam, validationHook), zValidator("json", LeadNote, validationHook), async (c) =>
    c.json(await service.addNote(c.get("actor")!, c.req.valid("param").id, c.req.valid("json").body), 201))
  .delete("/:id", can({ lead: ["delete"] }), zValidator("param", IdParam, validationHook), async (c) =>
    c.json(await service.eraseLead(c.get("actor")!, c.req.valid("param").id)))

export type LeadsRoutes = typeof leadsRoutes
```

If `can()` takes only one resource at a time, chain two `can()` middlewares for DSAR. Mount `.route("/leads", leadsRoutes)` in `server/api/routes/admin.ts`, add `export const leadsApi = hc<LeadsRoutes>("/api/v1/admin/leads")` to `admin/lib/api.ts` and `leads` keys to `queryKeys`. Add the new routes to `tests/integration/api/permission-matrix.test.ts` if that file enumerates admin endpoints.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit server/modules/leads && pnpm test:integration -- leads-admin permission-matrix && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server admin/lib tests
git commit -m "feat(leads): enquiries admin API with export, erase and DSAR"
```

---

### Task 6: Enquiries admin screen — board, table, drawer, spam folder and badge

**Files:**
- Create: `admin/modules/leads/{leads-view,leads-board,leads-table,lead-drawer,lead-timeline,privacy-request-dialog,params,queries,present}.ts(x)`, `admin/modules/leads/use-new-leads-count.ts`, `app/(admin)/admin/(panel)/leads/page.tsx`
- Modify: `admin/components/shell/admin-shell.tsx`, `admin/components/shell/app-sidebar.tsx` (only if the prop wiring needs it), `admin/components/shell/topbar.tsx`, `tests/e2e/admin/shell/navigation.spec.ts`
- Test: `admin/modules/leads/params.test.ts`, `admin/modules/leads/present.test.ts`, `admin/modules/leads/lead-drawer.test.tsx`

**Interfaces:**
- Consumes: Task 5 `leadsApi`, `queryKeys.leads`, response types (`InferResponseType` from `hono/client`); `PageHeader`, `DataTable`, `DataTablePagination`, `StatusPill`, `EmptyState`, `CardSkeleton`, `usePermission`, `Sheet`, `Tabs`, `ToggleGroup`, `Select`, `Textarea`, `Dialog`; `@dnd-kit/core`; `formatDate` (`lib/format-date.ts`, Europe/Dublin).
- Produces:
  - `leadsParams` (nuqs parsers): `view: "board" | "table"` (default `"board"`), `folder: "inbox" | "spam"`, `status`, `q`, `page`, `lead` (uuid of the open drawer).
  - `statusLabel(status: LeadStatus): string` → `New · Contacted · Booked · Closed · Spam`; `spamReasonLabel`.
  - `useNewLeadsCount(enabled: boolean): number | undefined` (`refetchInterval: 60_000`, `refetchOnWindowFocus: true`).

UI spec (quoted labels are load-bearing for E2E):
- Page: `PageHeader` with `<h1>` **"Enquiries"**. Actions: **"Export CSV"** (a link to `/api/v1/admin/leads/export.csv?folder=…&status=…`, shown only with `lead.export`) and **"Privacy request"** (opens `PrivacyRequestDialog`, shown only with `lead.export` + `newsletter.export`).
- Folder tabs: **"Inbox"** / **"Spam"** (`Tabs`, bound to `folder`). View toggle (`ToggleGroup`, `aria-label="View"`): **"Board"** / **"Table"**; Spam always uses the table.
- Search input `type="search"`, `aria-label="Search enquiries"` (debounced 300 ms into `q`).
- Board: four columns (`role="list"`, `aria-label` = status label) **New · Contacted · Booked · Closed**, each with its count. Cards show name, topic label, relative date and an assignee avatar. Dragging a card to another column PATCHes `status` (optimistic; roll back with a toast on error). Each card also has a keyboard-reachable `button` that opens the drawer; the status `Select` inside the drawer is the non-drag way to move it (WCAG 2.5.7).
- Table columns: **Name**, **Email**, **Topic**, **Status** (`StatusPill`), **Assignee**, **Received** (Dublin time). A row click (or Enter) opens the drawer. Pagination uses `DataTablePagination`. Empty inbox: `EmptyState` "No enquiries yet". Empty spam: "No spam. Suspicious submissions land here."
- Drawer (`Sheet`, right side, title = lead name; `?lead=` makes it deep-linkable, which is what the notification email links to):
  - Contact block: email as a `mailto:` link, phone as a `tel:` link, buttons **"Email"** and **"Call"**.
  - **"Message"** section (`whitespace-pre-wrap`).
  - **"Status"** `Select` (New / Contacted / Booked / Closed; in Spam a **"Not spam"** button moves it to New).
  - **"Assignee"** `Select` (from `/assignees`, plus "Unassigned").
  - **"Consent"**: privacy consent time + the stored consent text, and marketing yes/no.
  - **"Source"**: source path, referrer, UTM table, event id.
  - **"Timeline"**: activities, newest last; email failures render as "Notification email failed" with the destructive tone.
  - A **"Add a note"** `Textarea` + **"Add note"** button.
  - **"Erase"** (only with `lead.delete`) → `Dialog` **"Erase this enquiry?"** → **"Erase permanently"**.
  - Intake sees no Erase and no Export.
- `PrivacyRequestDialog`: `Input` labelled **"Email address"**, buttons **"Download data"** (fetches `/dsar?email=` and saves the JSON through an object URL) and **"Erase all data"** (second confirm: type the email again; label **"Type the email to confirm"**; then DELETE and toast `Erased N enquiries and M subscriptions`).
- Badge: `AdminShell` calls `useNewLeadsCount(usePermission({ lead: ["read"] }))` and passes `badges={{ "new-leads": count }}` to `AppSidebar` (hide at 0; show `99+` above 99; `aria-label="N new enquiries"`). Hide the topbar Enquiries shortcut without `lead.read` if it is not hidden already. Invalidate `queryKeys.leads.stats` after every status change.

- [ ] **Step 1: Write the failing tests**

`admin/modules/leads/present.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { badgeText, statusLabel } from "./present"

describe("present", () => {
  it("labels statuses and caps the badge", () => {
    expect(statusLabel("contacted")).toBe("Contacted")
    expect(badgeText(0)).toBeNull()
    expect(badgeText(7)).toBe("7")
    expect(badgeText(150)).toBe("99+")
  })
})
```

`admin/modules/leads/params.test.ts`: assert `leadsParams.view.parse("table") === "table"`, unknown values fall back to `"board"`, `folder` defaults to `"inbox"`, and `lead` rejects a non-uuid (use `createSerializer`/the parsers' `.parse` as in `admin/modules/activity/params.test.ts`).

`admin/modules/leads/lead-drawer.test.tsx` (jsdom; QueryClient + an `ActorProvider` with intake roles; mock `fetch` for `GET /api/v1/admin/leads/<id>` returning a detail with `message: "Hello there"`, two activities and `consent.privacyText`):

```tsx
it("shows message, consent and timeline; intake cannot erase", async () => {
  renderDrawer({ roles: ["intake"] })
  expect(await screen.findByText("Hello there")).toBeTruthy()
  expect(screen.getByRole("link", { name: "Email" }).getAttribute("href")).toBe("mailto:ann@example.com")
  expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe("tel:+353871234567")
  expect(screen.getByText(/I agree to the privacy policy/)).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Erase" })).toBeNull()
})
it("posts a note", async () => {
  renderDrawer({ roles: ["intake"] })
  await user.type(await screen.findByLabelText("Add a note"), "Called back")
  await user.click(screen.getByRole("button", { name: "Add note" }))
  expect(fetchCalls.at(-1)).toMatchObject({ url: expect.stringMatching(/\/notes$/), method: "POST" })
})
```

Copy the render scaffolding (QueryClient, actor provider, fetch mock) from `admin/modules/insights/article-body-editor.test.tsx` or `admin/modules/account/account-view.test.tsx`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project unit admin/modules/leads`
Expected: FAIL.

- [ ] **Step 3: Implement the page, views and badge**

`app/(admin)/admin/(panel)/leads/page.tsx` mirrors `insights/page.tsx`: `metadata = { title: "Enquiries" }`, `Suspense` + `Gate` → `requirePermission(permissionFor("/admin/leads"))` → `<LeadsView />`. The `[section]` placeholder stops serving `/admin/leads`, because the real folder wins (as with `/admin/insights`).

Build the components from the UI spec above with TanStack Query (`useQuery` on `queryKeys.leads.list(params)`, `placeholderData: keepPreviousData`), `useMutation` with `onSettled` invalidating `queryKeys.leads.all`, nuqs `useQueryStates(leadsParams)`, and `@dnd-kit/core` (`DndContext`, `useDraggable`, `useDroppable`, `KeyboardSensor` + `PointerSensor`). Status pill tones: new → info, contacted → warning, booked → success, closed → neutral, spam → destructive (use the existing `StatusPill` tones).

`use-new-leads-count.ts`:

```ts
"use client"

import { useQuery } from "@tanstack/react-query"

import { leadsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"

export function useNewLeadsCount(enabled: boolean) {
  const { data } = useQuery({
    queryKey: queryKeys.leads.stats,
    queryFn: () => parseResponse(leadsApi.stats.$get()),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  return data?.new
}
```

- [ ] **Step 4: Update the navigation spec**

`tests/e2e/admin/shell/navigation.spec.ts`: the intake tests keep expecting `<h1>` "Enquiries". The "each placeholder link opens its own page" test now covers built pages too; rename it to "each sidebar link opens its own page" and keep `["Newsletter", "Enquiries", "Appearance"]` (Newsletter is still a placeholder until Task 7, Appearance until Phase 9). This also settles the Phase 4 carry ("as intake › opens every link it is shown" failing). Run it and, if it still fails, diagnose before moving on (record the cause in the commit body).

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run --project unit admin/modules/leads && pnpm typecheck && pnpm lint && pnpm build && pnpm exec playwright test tests/e2e/admin/shell/navigation.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add admin "app/(admin)/admin/(panel)/leads" tests/e2e/admin/shell/navigation.spec.ts
git commit -m "feat(admin): enquiries board, table, drawer and sidebar badge"
```

---

### Task 7: Newsletter — double opt-in, confirm/unsubscribe pages, band wiring, admin list

**Files:**
- Create: `server/modules/newsletter/service.ts`, `server/modules/newsletter/public-routes.ts`, `server/modules/newsletter/routes.ts`, `app/(site)/newsletter/[state]/page.tsx`, `features/newsletter/components/newsletter-state.tsx`, `features/newsletter/components/unsubscribe-form.tsx`, `admin/modules/newsletter/{newsletter-view,queries}.tsx`, `app/(admin)/admin/(panel)/newsletter/page.tsx`
- Modify: `server/api/routes/public.ts`, `server/api/routes/admin.ts`, `admin/lib/api.ts`, `admin/lib/query-keys.ts`, `features/insights/components/newsletter-band.tsx`, `server/lib/crypto.ts` (unsubscribe token helpers)
- Test: `tests/integration/api/newsletter.test.ts`, `features/insights/components/newsletter-band.test.tsx`

**Interfaces:**
- Consumes: Task 1 `newsletterConfirmationEmail`; Task 2 `newsletterSubscribers`, `NewsletterSubmission`, `hitLimit`, `hashEmail`, `hashIp`, `derivedHmac`, `defer`; Task 3 `publicLimit`; `getGlobal("newsletter" | "privacy")`.
- Produces:
  - `POST /api/v1/public/newsletter` (`publicLimit("newsletter", { limit: 5, windowMs: 600_000 })` + per-email limit) → always `201 { ok: true }` for valid input; `400` field errors; `429`.
  - `GET /api/v1/public/newsletter/confirm?token=` → `303 Location: /newsletter/confirmed` or `/newsletter/invalid`.
  - `POST /api/v1/public/newsletter/unsubscribe` (form-encoded or JSON `{ token }`) → `303 Location: /newsletter/unsubscribed` (also for unknown tokens: no enumeration).
  - `unsubscribeToken(id: string): string` (`<id>.<derivedHmac("newsletter-unsubscribe", id) first 32 hex>`), `readUnsubscribeToken(token: string): string | null`.
  - `subscribe(input, ctx)`, `confirm(token, now?)`, `unsubscribe(token, now?)`.
  - Admin `/api/v1/admin/newsletter`: `GET /` (`newsletter.read`; `?status&q&page&pageSize`) → `{ items: { id, email, status, sourcePath, createdAt, confirmedAt, unsubscribedAt }[], page, pageSize, total }`; `GET /export.csv` (`newsletter.export`; confirmed only by default, `?status=all` for every row); `DELETE /:id` (`newsletter.delete`). Client `newsletterApi`; `queryKeys.newsletter`.
  - Public pages `/newsletter/confirmed`, `/newsletter/invalid`, `/newsletter/unsubscribe`, `/newsletter/unsubscribed` (`generateStaticParams` returns these four; others `notFound()`).

- [ ] **Step 1: Write the failing tests**

`tests/integration/api/newsletter.test.ts` (with the `next/server` `after` mock and `drain()` from the conventions):

```ts
describe("newsletter double opt-in", () => {
  const subscribe = (email: string, extra = {}) =>
    publicRequest("/newsletter", { method: "POST", body: { email, sourcePath: "/insights", ...extra } })
  const linkFrom = (text: string, path: string) => text.match(new RegExp(`https?://\\S+${path}\\S*`))![0]

  it("creates a pending row with a hashed token and emails a confirm link", async () => {
    expect((await subscribe("New@Example.com")).status).toBe(201)
    await drain()
    const [row] = await getDb().select().from(newsletterSubscribers)
    expect(row).toMatchObject({ email: "new@example.com", status: "pending" })
    const mail = readOutbox()[0]!
    const confirm = linkFrom(mail.text, "/api/v1/public/newsletter/confirm")
    const token = new URL(confirm).searchParams.get("token")!
    expect(row!.tokenHash).not.toBe(token)
    expect(mail.text).toContain("/newsletter/unsubscribe?token=")
    const res = await app.request(new URL(confirm).pathname + new URL(confirm).search)
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe("/newsletter/confirmed")
    const [after] = await getDb().select().from(newsletterSubscribers)
    expect(after).toMatchObject({ status: "confirmed", tokenHash: null })
    // One-time: a second use is invalid.
    expect((await app.request(new URL(confirm).pathname + new URL(confirm).search)).headers.get("location")).toBe("/newsletter/invalid")
  })

  it("answers identically for confirmed, pending and new addresses and never re-mails a confirmed one", async () => {
    await getDb().insert(newsletterSubscribers).values({ email: "done@example.com", status: "confirmed" })
    const a = await subscribe("done@example.com")
    const b = await subscribe("fresh@example.com")
    expect([a.status, await a.json()]).toEqual([b.status, await b.json()])
    await drain()
    expect(readOutbox().map((m) => m.to)).toEqual(["fresh@example.com"])
  })

  it("expires confirm tokens after 7 days", async () => {
    await subscribe("late@example.com")
    await drain()
    const token = new URL(linkFrom(readOutbox()[0]!.text, "/api/v1/public/newsletter/confirm")).searchParams.get("token")!
    vi.useFakeTimers({ now: Date.now() + 8 * 86_400_000, toFake: ["Date"] })
    const res = await publicRequest(`/newsletter/confirm?token=${token}`)
    expect(res.headers.get("location")).toBe("/newsletter/invalid")
    vi.useRealTimers()
  })

  it("unsubscribes by POST only, with a forged token answering the same", async () => {
    const [row] = await getDb().insert(newsletterSubscribers).values({ email: "bye@example.com", status: "confirmed" }).returning()
    const token = unsubscribeToken(row!.id)
    const forged = await publicRequest("/newsletter/unsubscribe", { method: "POST", body: { token: `${row!.id}.0000` } })
    expect(forged.headers.get("location")).toBe("/newsletter/unsubscribed")
    expect((await getDb().select().from(newsletterSubscribers))[0]!.status).toBe("confirmed")
    await publicRequest("/newsletter/unsubscribe", { method: "POST", body: { token } })
    expect((await getDb().select().from(newsletterSubscribers))[0]!.status).toBe("unsubscribed")
    expect((await publicRequest(`/newsletter/unsubscribe?token=${token}`)).status).toBe(404)
  })

  it("confirms directly when double opt-in is off, and ignores the honeypot silently", async () => {
    await getDb().insert(settings).values({ key: "privacy", value: { newsletterDoubleOptIn: false } })
    await subscribe("direct@example.com")
    expect((await getDb().select().from(newsletterSubscribers))[0]!.status).toBe("confirmed")
    expect((await subscribe("bot@example.com", { website: "x" })).status).toBe(201)
    expect(await getDb().select().from(newsletterSubscribers)).toHaveLength(1)
  })
})

describe("newsletter admin", () => {
  // [GET /, GET /export.csv, DELETE /:id]
  const MATRIX: Record<RoleName, [number, number, number]> = {
    owner: [200, 200, 200], admin: [200, 200, 200], marketer: [200, 200, 403],
    editor: [403, 403, 403], author: [403, 403, 403], intake: [403, 403, 403], viewer: [403, 403, 403],
  }
  it.each(ROLE_NAMES)("RBAC for %s", async (role) => {
    const cookie = await cookieFor(role)
    const [row] = await getDb().insert(newsletterSubscribers).values({ email: `${role}-s@example.com`, status: "confirmed" }).returning()
    expect([
      (await adminRequest("/newsletter", cookie)).status,
      (await adminRequest("/newsletter/export.csv", cookie)).status,
      (await adminRequest(`/newsletter/${row!.id}`, cookie, { method: "DELETE" })).status,
    ]).toEqual(MATRIX[role])
  })
})
```

Imports: `app`, `getDb`, `closeDb`, `newsletterSubscribers`, `settings`, `readOutbox`/`clearOutbox`, `unsubscribeToken` (from `@/server/modules/newsletter/service`), `ROLE_NAMES`/`RoleName`, `adminRequest`/`cookieFor`, `publicRequest`, `resetDb`; `beforeEach` resets the DB and the outbox.

`features/insights/components/newsletter-band.test.tsx` (jsdom): mocking `fetch` to 201 shows `content.success`; 429 shows `content.errors.rateLimited`; the submitted body contains `{ email, website: "", sourcePath: "/" }`; the honeypot input is `tabIndex=-1` inside `aria-hidden`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:integration -- newsletter && pnpm vitest run --project unit features/insights/components/newsletter-band.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the service and routes**

`server/modules/newsletter/service.ts`:
- `subscribe(raw, ctx)`: honeypot non-empty → return `{ ok: true }` without writing. Otherwise parse `NewsletterSubmission` (`invalid()` on failure), apply the per-email `hitLimit("newsletter:email:"+hashEmail)` (429), and read `privacy.newsletterDoubleOptIn` and the `newsletter` global.
  - Double opt-in off: upsert `{ status: "confirmed", confirmedAt: now }` unless already confirmed.
  - Double opt-in on, existing row `confirmed` → nothing. Otherwise create a token (`randomBytes(32).toString("base64url")`), store `tokenHash = sha256(token)` hex and `tokenExpiresAt = now + 7 days`, and upsert `status: "pending"` (an unsubscribed row returns to pending; `unsubscribedAt` stays as history) with `sourcePath`, `consentText` (the band's subtitle/button copy at the time: `${global.subtitle} — ${global.button}`) and `ipHash`.
  - Then `defer(() => sendConfirmation(row.id, token), "newsletter confirmation")`, which renders `newsletterConfirmationEmail({ subject: global.confirmationEmail.subject || "Confirm your subscription", body: global.confirmationEmail.body, confirmUrl: `${SITE_URL}/api/v1/public/newsletter/confirm?token=${token}`, unsubscribeUrl: `${SITE_URL}/newsletter/unsubscribe?token=${unsubscribeToken(row.id)}` })` and sends it with `idempotencyKey: newsletter/<id>/confirm/<tokenHash.slice(0,12)>`.
  - Returns `{ ok: true }` in every branch.
- `confirm(token, now)`: look up by `sha256(token)`, `status = 'pending'`, `tokenExpiresAt > now` → set `confirmed`, `confirmedAt`, `tokenHash = null` → `true`; else `false`.
- `unsubscribe(token, now)`: `readUnsubscribeToken` (constant-time compare) → set `unsubscribed`, `unsubscribedAt` if currently not unsubscribed. Always resolves.
- Admin: `listSubscribers(query)`, `exportSubscribers(actor, status)` (reuses `toCsv` from `server/modules/leads/csv.ts`; audit `newsletter.export` with the count), `deleteSubscriber(actor, id)` (audit `newsletter.delete`, summary `Subscriber removed`).

`server/modules/newsletter/public-routes.ts`:

```ts
export const newsletterPublicRoutes = new Hono<AppEnv>()
  .post("/", publicLimit("newsletter", NEWSLETTER_LIMIT), async (c) => {
    await subscribe(await c.req.json().catch(() => ({})), { ip: clientIp(c.req.raw.headers) })
    return c.json({ ok: true as const }, 201)
  })
  .get("/confirm", async (c) => {
    const ok = await confirm(c.req.query("token") ?? "")
    return c.redirect(ok ? "/newsletter/confirmed" : "/newsletter/invalid", 303)
  })
  .post("/unsubscribe", async (c) => {
    const type = c.req.header("content-type") ?? ""
    const token = type.includes("application/json")
      ? String(((await c.req.json().catch(() => ({}))) as { token?: unknown }).token ?? "")
      : String((await c.req.parseBody()).token ?? "")
    await unsubscribe(token)
    return c.redirect("/newsletter/unsubscribed", 303)
  })
```

Mount it as `.route("/newsletter", newsletterPublicRoutes)` in `public.ts` and the admin routes as `.route("/newsletter", newsletterRoutes)` in `admin.ts`. `GET /newsletter/unsubscribe` has no handler, so it answers 404 (the test asserts this).

- [ ] **Step 4: Implement the pages and the band**

`app/(site)/newsletter/[state]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { io } from "next/cache"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { NewsletterState } from "@/features/newsletter/components/newsletter-state"
import { getSetting } from "@/server/modules/content/queries"

const STATES = ["confirmed", "invalid", "unsubscribe", "unsubscribed"] as const
type State = (typeof STATES)[number]

export const metadata: Metadata = { robots: { index: false, follow: false } }
export const generateStaticParams = () => STATES.map((state) => ({ state }))

export default function Page({ params }: { params: Promise<{ state: string }> }) {
  return (
    <Suspense fallback={null}>
      <Body params={params} />
    </Suspense>
  )
}

async function Body({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  if (!STATES.includes(state as State)) notFound()
  await io()
  const { pages } = await getSetting("newsletter")
  return <NewsletterState state={state as State} copy={pages[state as State]} />
}
```

`NewsletterState` renders a `<section>` inside `Container` (`components/layout/container.tsx`) with the site's display heading styles (`font-display text-pine`), the body copy and a link home. For `unsubscribe` it renders `<UnsubscribeForm button={copy.button} />`: a client component that reads `?token=` with `useSearchParams` (inside its own `Suspense`) and renders a plain `<form method="post" action="/api/v1/public/newsletter/unsubscribe">` with a hidden `token` and a clay pill button. A missing token shows the invalid copy. The page reads the static segment `newsletter`, which takes precedence over `app/(site)/[page]`.

`newsletter-band.tsx`: replace the simulated submit and its comment. Add the off-screen honeypot (same markup as the contact form, inside an `aria-hidden` wrapper) and an async submit that POSTs `{ email, website, sourcePath: location.pathname }`. 201 → `done`; 429 → `content.errors.rateLimited`; 400 → `content.errors.email`; anything else → `content.errors.generic`, shown below the pill as `<p role="alert" className="mt-3 text-sm text-cream">`. The button is disabled while pending. `NewsletterView` already omits `confirmationEmail`; also omit `pages` from the props passed to the client (`Omit<…, "confirmationEmail" | "pages">`) and update `resolve-block.tsx` / the article page to strip it.

Admin screen `app/(admin)/admin/(panel)/newsletter/page.tsx` + `admin/modules/newsletter/newsletter-view.tsx`: `<h1>` **"Newsletter"**; status filter `Tabs` **"Confirmed" · "Pending" · "Unsubscribed" · "All"**; search `aria-label="Search subscribers"`; table columns **Email**, **Status**, **Source**, **Subscribed** (confirmedAt or createdAt, Dublin), plus a row action **"Delete"** (with `newsletter.delete`) → `Dialog` **"Remove this subscriber?"** → **"Remove"**; header action **"Export CSV"** (with `newsletter.export`).

- [ ] **Step 5: Run the tests and parity**

Run: `pnpm test:integration -- newsletter && pnpm vitest run --project unit features && pnpm typecheck && pnpm lint && pnpm test:parity`
Expected: PASS; parity 21/21 unchanged (the band markup only gains an invisible honeypot).

- [ ] **Step 6: Commit**

```bash
git add server features "app/(site)/newsletter" "app/(site)/_cms/resolve-block.tsx" "app/(site)/insights" admin "app/(admin)/admin/(panel)/newsletter" tests
git commit -m "feat(newsletter): double opt-in, confirm and unsubscribe pages, admin list"
```

---

### Task 8: Retention purge in the cron tick, acceptance E2E and phase exit

**Files:**
- Create: `server/modules/leads/retention.ts`, `tests/e2e/support/mailpit.ts`, `tests/e2e/support/public.ts`, `tests/e2e/admin/content/enquiries.spec.ts`, `tests/e2e/admin/content/newsletter.spec.ts`
- Modify: `server/modules/scheduler/service.ts`, `tests/integration/api/cron.test.ts`, `tests/e2e/support/admin.ts` (reuse the Mailpit helper), `docs/deploy-dokploy.md`, `.superpowers/sdd/plan/progress.md`
- Test: `tests/integration/api/cron.test.ts` (append), the two E2E specs

**Interfaces:**
- Consumes: Tasks 2–7.
- Produces:
  - `purgeExpired(tx: Tx, now: Date): Promise<{ closed: number; spam: number; pendingSubscribers: number; rateLimits: number }>`.
  - `runTick()` result gains `purged: { closed, spam, pendingSubscribers, rateLimits }`.
  - E2E helpers: `latestEmail(query: string, since: Date): Promise<{ Subject: string; Text: string; HTML: string; To: { Address: string }[] }>` (Mailpit `/api/v1/search` + `/api/v1/message/:id`); `publicStamp(request): Promise<string>`; `postLead(request, body, ip): Promise<APIResponse>`.

- [ ] **Step 1: Write the failing integration test**

Append to `tests/integration/api/cron.test.ts` (reuse its `tick()` helper and imports; add `leads`, `newsletterSubscribers`, `apiRateLimits`, `settings` from the schema and `insertLead` from `../helpers/leads`):

```ts
describe("retention purge", () => {
  const DAY = 86_400_000
  it("purges closed leads past retention, old spam, stale pending subscribers and spent windows", async () => {
    const now = Date.now()
    await getDb().insert(settings).values({ key: "privacy", value: { enquiryRetentionMonths: 24, spamRetentionDays: 30 } })
    const keepClosed = await insertLead({ status: "closed", statusChangedAt: new Date(now - 700 * DAY) })
    await insertLead({ status: "closed", statusChangedAt: new Date(now - 740 * DAY) })
    await insertLead({ status: "spam", createdAt: new Date(now - 31 * DAY) })
    const keepSpam = await insertLead({ status: "spam", createdAt: new Date(now - 29 * DAY) })
    const keepNew = await insertLead({ status: "new", createdAt: new Date(now - 900 * DAY) })
    await getDb().insert(newsletterSubscribers).values([
      { email: "stale@example.com", status: "pending", createdAt: new Date(now - 31 * DAY) },
      { email: "kept@example.com", status: "confirmed", createdAt: new Date(now - 900 * DAY) },
    ])
    await getDb().insert(apiRateLimits).values([
      { key: "old", count: 9, resetAt: new Date(now - 1000) },
      { key: "live", count: 1, resetAt: new Date(now + 60_000) },
    ])
    const res = await tick()
    expect((await res.json()).purged).toEqual({ closed: 1, spam: 1, pendingSubscribers: 1, rateLimits: 1 })
    expect((await getDb().select({ id: leads.id }).from(leads)).map((r) => r.id).sort()).toEqual(
      [keepClosed.id, keepSpam.id, keepNew.id].sort()
    )
    const [entry] = await getDb().select().from(auditLogs).where(eq(auditLogs.action, "lead.purge"))
    expect(entry!.summary).toBe("Retention purge: 1 closed and 1 spam enquiries, 1 unconfirmed subscriptions")
  })

  it("audits nothing when nothing expired", async () => {
    await tick()
    expect(await getDb().select().from(auditLogs).where(eq(auditLogs.action, "lead.purge"))).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:integration -- cron`
Expected: FAIL (`purged` undefined).

- [ ] **Step 3: Implement the purge**

`server/modules/leads/retention.ts`:

```ts
import "server-only"

import { and, eq, lt } from "drizzle-orm"

import { parseGlobal } from "@/lib/content/globals"
import type { Tx } from "@/server/db/client"
import { apiRateLimits, leads, newsletterSubscribers, settings } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"

const DAY = 86_400_000
const PENDING_DAYS = 30

// Ruling R12: every tick, under the scheduler's advisory lock; the windows
// come from the privacy global (docs/brief.md §13 retention defaults).
export async function purgeExpired(tx: Tx, now: Date) {
  const [row] = await tx.select().from(settings).where(eq(settings.key, "privacy")).limit(1)
  const privacy = parseGlobal("privacy", row?.value)
  const closedBefore = new Date(now)
  closedBefore.setUTCMonth(closedBefore.getUTCMonth() - privacy.enquiryRetentionMonths)
  const spamBefore = new Date(now.getTime() - privacy.spamRetentionDays * DAY)
  const count = (rows: unknown[]) => rows.length
  const closed = count(await tx.delete(leads)
    .where(and(eq(leads.status, "closed"), lt(leads.statusChangedAt, closedBefore))).returning({ id: leads.id }))
  const spam = count(await tx.delete(leads)
    .where(and(eq(leads.status, "spam"), lt(leads.createdAt, spamBefore))).returning({ id: leads.id }))
  const pendingSubscribers = count(await tx.delete(newsletterSubscribers)
    .where(and(eq(newsletterSubscribers.status, "pending"),
      lt(newsletterSubscribers.createdAt, new Date(now.getTime() - PENDING_DAYS * DAY))))
    .returning({ id: newsletterSubscribers.id }))
  const rateLimits = count(await tx.delete(apiRateLimits)
    .where(lt(apiRateLimits.resetAt, now)).returning({ key: apiRateLimits.key }))
  if (closed + spam + pendingSubscribers > 0) {
    await audit(null, {
      action: "lead.purge",
      entityType: "lead",
      summary: `Retention purge: ${closed} closed and ${spam} spam enquiries, ${pendingSubscribers} unconfirmed subscriptions`,
    }, tx)
  }
  return { closed, spam, pendingSubscribers, rateLimits }
}
```

`server/modules/scheduler/service.ts`: inside the locked branch, after the publishing loop, add `const purged = await tx.transaction((sp) => purgeExpired(sp, now))` (a savepoint, so a purge error cannot undo published articles; catch and log, setting `purged` to zeros). Return `{ skipped: false, published, failed, purged }`, and in the skipped branch return zeros for `purged`. Replace the "Retention purges (Phase 6) join here" comment.

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test:integration -- cron`
Expected: PASS (and the existing scheduler cases still pass).

- [ ] **Step 5: Write the acceptance E2E specs**

`tests/e2e/support/mailpit.ts`:

```ts
import { expect } from "@playwright/test"

import { MAILPIT_URL } from "../fixtures/env"

type Summary = { ID: string; Created: string }
export type MailpitMessage = { Subject: string; Text: string; HTML: string; To: { Address: string }[] }

// Polls, because email is sent after the response (after()).
export async function latestEmail(query: string, since: Date): Promise<MailpitMessage> {
  let found: MailpitMessage | undefined
  await expect
    .poll(
      async () => {
        const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}`)
        const { messages } = (await search.json()) as { messages: Summary[] }
        const fresh = messages.find((m) => new Date(m.Created) >= since)
        if (!fresh) return false
        found = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${fresh.ID}`)).json()) as MailpitMessage
        return true
      },
      { message: `email matching ${query}`, timeout: 15_000 }
    )
    .toBe(true)
  return found!
}
```

Refactor `emailedResetLink` in `tests/e2e/support/admin.ts` to use `latestEmail(`to:"${to}"`, since)`.

`tests/e2e/support/public.ts`:

```ts
import type { APIRequestContext } from "@playwright/test"

export async function publicStamp(request: APIRequestContext) {
  const res = await request.get("/api/v1/public/leads/stamp")
  return ((await res.json()) as { stamp: string }).stamp
}

export const postLead = (request: APIRequestContext, data: Record<string, unknown>, ip: string) =>
  request.post("/api/v1/public/leads", { data, headers: { "x-real-ip": ip } })

// A distinct client per test so parallel workers never share a rate-limit
// bucket (Ruling R4). IPv6 documentation range: effectively collision-free.
const hex4 = () => Math.floor(Math.random() * 0xffff).toString(16)
export const testIp = () => `2001:db8::${hex4()}:${hex4()}`
```

`tests/e2e/admin/content/enquiries.spec.ts` (desktop-only content project, `STORAGE.intake`; parity untouched because nothing seeded changes):

```ts
import { expect, test } from "@playwright/test"

import { api } from "../../support/api"
import { latestEmail } from "../../support/mailpit"
import { postLead, publicStamp, testIp } from "../../support/public"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.intake })

const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e4)}`

test("a form submission reaches the inbox and the notification has no message", async ({ page, browser }) => {
  const id = unique()
  const name = `Enquirer ${id}`
  const message = `Private message ${id}`
  const since = new Date()
  // A visitor with its own client IP.
  const visitor = await browser.newContext({ extraHTTPHeaders: { "x-real-ip": testIp() } })
  const site = await visitor.newPage()
  await site.goto("/contact")
  await site.locator('[name="name"]').fill(name)
  await site.locator('[name="email"]').fill(`e2e+${id}@example.com`)
  await site.locator('[name="topic"]').selectOption({ index: 1 })
  await site.locator('[name="message"]').fill(message)
  await site.locator('[name="consent"]').check()
  await site.waitForTimeout(3_200) // the 3 s fill-time floor
  await site.locator('form button[type="submit"]').click()
  await expect(site.getByRole("status")).toBeVisible()
  await visitor.close()

  const mail = await latestEmail(`subject:"New enquiry from ${name}"`, since)
  expect(mail.Text).not.toContain(message)
  expect(mail.HTML).not.toContain(message)
  expect(mail.Text).toMatch(/\/admin\/leads\?lead=[0-9a-f-]{36}/)

  await page.goto("/admin/leads?view=table")
  await expect(page.getByRole("heading", { level: 1, name: "Enquiries" })).toBeVisible()
  await page.getByRole("searchbox", { name: "Search enquiries" }).fill(name)
  await page.getByRole("row", { name: new RegExp(name) }).click()
  await expect(page.getByRole("dialog", { name })).toBeVisible()
  await expect(page.getByText(message)).toBeVisible()
})

test("a honeypot submission returns success but is stored as spam", async ({ request }) => {
  const id = unique()
  const stamp = await publicStamp(request)
  await new Promise((r) => setTimeout(r, 3_200))
  const res = await postLead(request, {
    name: `Bot ${id}`, email: `bot+${id}@example.com`, topic: "other", consent: true,
    website: "https://spam.example", stamp,
  }, testIp())
  expect(res.status()).toBe(201)
  expect(await res.json()).toEqual({ ok: true })
  const spam = await api<{ items: { name: string; status: string }[] }>(request, "GET", `/leads?folder=spam&q=${id}`)
  expect(spam.items).toEqual([expect.objectContaining({ name: `Bot ${id}`, status: "spam" })])
  const inbox = await api<{ total: number }>(request, "GET", `/leads?q=${id}`)
  expect(inbox.total).toBe(0)
})

test("the 6th submission within 10 minutes gets 429", async ({ request }) => {
  const ip = testIp()
  const stamp = await publicStamp(request)
  await new Promise((r) => setTimeout(r, 3_200))
  const statuses: number[] = []
  for (let i = 0; i < 6; i++) {
    const id = unique()
    const res = await postLead(request, {
      name: `Rate ${id}`, email: `rate+${id}@example.com`, topic: "other", consent: true, stamp,
    }, ip)
    statuses.push(res.status())
  }
  expect(statuses).toEqual([201, 201, 201, 201, 201, 429])
})
```

(`topic: "other"` is always allowed by `allowedOptions()`.) If `request` in the intake storage context sends cookies to the public endpoint, that is harmless: the public area ignores sessions.

`tests/e2e/admin/content/newsletter.spec.ts` (`STORAGE.owner`): a visitor context with its own IP subscribes on `/insights` through the band (email `news+<id>@example.com`, then sees the band's success text). `latestEmail(`to:"news+<id>@example.com"`, since)` → extract the confirm link from `Text` → `visitor.goto(link)` → expect URL `/newsletter/confirmed` and a level-1 heading. As owner, `/admin/newsletter` → search the address → row with status "Confirmed". Then open the unsubscribe link from the same email → click the button → URL `/newsletter/unsubscribed`.

- [ ] **Step 6: Deploy note and ledger**

Append to `docs/deploy-dokploy.md` under a "Phase 6" heading:
- No new required env. Optional: `EMAIL_DRIVER=resend` + `RESEND_API_KEY` (verify the sending domain in Resend with SPF/DKIM/DMARC first; `EMAIL_FROM` must use it); `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` (both or neither; the widget needs the Phase 8 CSP to allow `challenges.cloudflare.com` once CSP ships).
- Traefik must overwrite `X-Real-IP` with the real client address: the enquiry limiter keys on it, and if it is missing every visitor shares one bucket of 5 per 10 minutes.
- Set the notification recipients in Admin → Site settings → Notifications (they fall back to the contact email).
- The retention purge runs inside the existing cron tick: no new schedule.

Append the Phase 6 entries and carries to `.superpowers/sdd/plan/progress.md`:
- Phase 8: consent snapshot, `fbp`/`fbc`, GTM `generate_lead` (the client already pushes when `dataLayer` exists), the CAPI `Lead` event reusing `meta_event_id`, and CSP for Turnstile.
- Phase 11: bell items for new enquiries and failed deliveries (`lead_activities type=email status=failed`), dashboard enquiry KPIs.
- Phase 10: a resend-invite action (Phase 1 Task 1.7 note).
- The Turnstile fail-closed question (R17), if the user has not answered it.

- [ ] **Step 7: Full verification**

Run:

```bash
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm build
DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build
pnpm e2e:seed && pnpm test:e2e
```

Expected: all green. The CI-style build with an unreachable database still passes (no new prerendered data reads: the newsletter pages read the global after `io()` inside `Suspense`). Parity is 21/21 unchanged; `enquiries.spec.ts`, `newsletter.spec.ts`, the navigation specs and the Phase 4/5 content specs all pass.

- [ ] **Step 8: Commit**

```bash
git add server tests docs/deploy-dokploy.md .superpowers/sdd/plan/progress.md
git commit -m "feat(leads): retention purge in the cron tick and enquiry acceptance E2E"
```

---

## Phase exit

- [ ] `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm build` green; the CI-style build with `DATABASE_URL=postgres://x@127.0.0.1:1/x` still passes.
- [ ] `pnpm e2e:seed && pnpm test:e2e` green (parity 21/21 unchanged, `enquiries.spec.ts`, `newsletter.spec.ts`, shell navigation specs incl. the intake carry, Phase 4/5 content specs).
- [ ] `pnpm email:dev` lists the six templates.
- [ ] `docs/deploy-dokploy.md` has the Phase 6 note; Dokploy env changes are needed only to switch to Resend or enable Turnstile.
- [ ] Ledger entries and carries appended (Task 8 Step 6).

## Spec coverage map

| Contract item (docs/plan.md Phase 6) | Where |
| --- | --- |
| 1. `leads`, `lead_activities`, `api_rate_limits` tables | Task 2 |
| 1. `POST /api/v1/public/leads`: shared Zod schema, honeypot, HMAC-signed render timestamp (≥ 3 s), Postgres fixed-window limit on hashed IP and on email, optional Turnstile (`action` + `hostname`, Cloudflare test keys) | Task 2 (schema, stamp, limiter), Task 3 (pipeline, Turnstile with test keys + mocked siteverify) |
| 2. Contact form: API field errors, success state, `event_id`, prefill from props | Task 4 (prefill already exists; now slug-based) |
| 3. React Email 6 templates (invite, reset, new enquiry w/o message, auto-reply, newsletter confirmation, delivery failure) + `email:dev` | Task 1 |
| 3. Resend 6 driver (`{ data, error }`, idempotency keys) | Task 1 (driver), Task 3/7 (keys) |
| 3. Mailpit pinned `axllent/mailpit:v1.31.4` | Already pinned in `docker-compose.yml`; verified in Task 1 Step 1 |
| 4. Enquiries admin: Kanban + table, drawer (message, mailto/tel, consent record, source/UTM, notes + status timeline, assignee), CSV export (`lead.export`), GDPR erase, spam folder, sidebar badge | Task 5 (API), Task 6 (UI) |
| 5. Newsletter: double opt-in (hashed token), confirm + unsubscribe endpoints and pages, band wiring, admin list with export and delete | Task 7 |
| 6. Retention purge in the cron tick (closed + spam) and DSAR export/erase by email | Task 8 (purge), Task 5 (DSAR) |
| Acceptance: submission appears in the inbox | Task 8 `enquiries.spec.ts` test 1 |
| Acceptance: Mailpit notification has no message body | Task 8 `enquiries.spec.ts` test 1; Task 3 integration "privacy by default" |
| Acceptance: honeypot returns success, stored as spam | Task 8 `enquiries.spec.ts` test 2; Task 3 integration |
| Acceptance: 6th submission within 10 minutes → 429 | Task 8 `enquiries.spec.ts` test 3; Task 2/3 integration |
| §15 audit never contains message content | Task 3 + Task 5 tests |
| §7.2 marketer: no enquiries; intake: read/update only | Task 5 RBAC matrix, Task 7 newsletter matrix |
| Phase 4 carry: intake navigation spec | Task 6 Step 4 |
| Phase 1 carry: Traefik `X-Real-IP` | Ruling R4, Task 8 deploy note |

## Self-check against the installed code (done while writing this plan)

Verified in `node_modules` and the repo at `512d25e`:

- **Next 16.3.8.** `after()` runs after the response in Route Handlers, which is where Hono runs (`app/api/[...route]/route.ts` → `handle(app)`); it is not a request-time API and does not make a route dynamic (`docs/01-app/03-api-reference/04-functions/after.md`). Under Cache Components the contact block's page shell is prerendered/cached, which is why the stamp is fetched by the client (Ruling R1). Public newsletter pages read globals after `io()` inside `Suspense`, as `app/(site)/layout.tsx` does. `revalidateTag` stays behind `invalidate()`; nothing in this phase invalidates public tags.
- **react-email 6.11.0.** `dist/index.d.mts` exports `Html, Head, Body, Container, Section, Heading, Text, Button, Link, Hr, Preview, Img, Tailwind…` and `export * from "@react-email/render"` (dependency `>=2.1.0`, hence the override). The CLI binary is `email`; `email dev` installs `@react-email/ui@<same version>` unless present (hence the devDependency).
- **resend 6.30.0.** `emails.send(payload, { idempotencyKey })` (`idempotencyKey?: string` in `dist/index.d.mts`); the optional peer `@react-email/render` is satisfied by the override.
- **Repo.** `server/lib/email/index.ts` (log + smtp drivers, `readOutbox`/`clearOutbox`), `server/lib/email/templates.ts` (plain HTML, says "Phase 6 replaces them"), `server/auth/email.ts` (`deliverResetEmail` with injectable `send`), `server/env.ts` (`EMAIL_DRIVER` comment "resend is added in Phase 6", `CRON_SECRET` rule), `server/lib/crypto.ts` `hashIp` (HMAC with `BETTER_AUTH_SECRET`), the in-memory `server/lib/rate-limit.ts` (comment: "Public endpoints get the database-backed limiter in Phase 6"), `runTick()` (comment: "Retention purges (Phase 6) join here"), `server/api/app.ts` (no public area yet), `ApiError` + `RATE_LIMITED` (429), `errorBody`, Better Auth `ipAddressHeaders: ["x-real-ip"]`, `lib/admin/nav.ts` (`leads` entry with `badge: "new-leads"`; `newsletter` entry), `AppSidebar` `badges` prop (not yet fed), `[section]` placeholder route, `NotificationsGlobal` (`recipients`, `autoReply`), `PrivacyGlobal` (`enquiryRetentionMonths`, `newsletterDoubleOptIn`), `NewsletterGlobal.confirmationEmail`, contact form option values are labels today, `docker-compose.yml` Mailpit `v1.31.4`, E2E env (`EMAIL_DRIVER=smtp` → Mailpit, `SITE_ENV=development`, `SCHEDULER=off`), `STORAGE.intake/owner`, `emailedResetLink` (Mailpit polling), roles in `lib/auth/permissions.ts` (intake `lead: read, update`; marketer `newsletter: read, export`).
- **Not compiled here (flagged in the owning step):** `render`/`toPlainText` exact signatures and Turbopack bundling of `react-email` (Task 1 Step 4); whether `can()` accepts two resources at once (Task 5 Step 4); the `vi.spyOn` on an ESM namespace (Task 3 Step 1 note gives the fallback); the drizzle `lower(email)` expression index SQL (Task 2 Step 4); `insertServiceAndForm` must match the collections table shape (Task 3 Step 1).

## Execution handoff

Plan complete and saved to `docs/plans/phase-06-enquiries.md`. Recommended: **subagent-driven**, because Tasks 2–3 carry the abuse and privacy edges (atomic limiter, indistinguishable spam, no PII in emails/audit) that a fresh reviewer should gate one by one, and Tasks 4–8 consume their interfaces in order. R17 (Turnstile fail-closed) waits on the user's answer but does not block Task 3. The default applies until they answer.

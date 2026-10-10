# Phase 11: Dashboard Data, Polish and Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The dashboard shows the brief's real numbers: **New enquiries** (hero card, change vs the 30 days before), published articles, newsletter subscribers and SEO health %, the **Enquiries this week** pill chart (solid = this week, hatched = last week), **Next up** (the oldest uncontacted enquiry or the next scheduled article, then the setup steps), **Team activity**, and a **Content health** gauge (complete / needs work / missing SEO or alt) with the brief's §4.6 content findings listed beneath it. Every widget respects RBAC: people without `lead.read` get enquiry counts only. A **notifications bell** lists new enquiries, articles that went live on schedule, failed schedules, review requests and delivery failures (enquiry emails, Meta CAPI), polled every 60 s and cleared per person through a new `notificationsSeenAt` user field. A quality pass adds Lighthouse budgets (mobile performance ≥ 90, accessibility ≥ 95, SEO 100 on the key pages), public-site axe, an image audit and a JavaScript budget, all running in CI. CI gains a Linux visual job in the Playwright Docker image (with committed Linux baselines) and a deploy job that triggers Dokploy only after every check is green, with `NEXT_DEPLOYMENT_ID` set to the git SHA. `@huggingface/transformers` leaves the image build. Launch operations ship as code and docs: an owner-recovery CLI, a backup restore drill, `docs/runbook.md`, a client content-QA sheet and a launch checklist that maps every §3 success criterion to its evidence. The steps only a person can take (pushing, merging to `main`, Dokploy/GitHub/R2 configuration, client sign-off) are listed, never executed.

**Architecture:** The dashboard stays one endpoint (`GET /api/v1/admin/dashboard` → `server/modules/dashboard/service.ts`), rebuilt on new repo queries over `leads`, `articles`, `newsletter_subscribers` and `audit_logs`, `getSeoHealth()` (Phase 7, cached) and a new content-QA scanner: pure rules in `lib/content/qa.ts`, sources loaded in `server/modules/dashboard/content-qa.ts`. Notifications are **derived**, not stored: `server/modules/notifications/service.ts` reads the same tables per permission, and only the per-user "seen" instant is persisted (`users.notifications_seen_at`, declared as a Better Auth `additionalField` so schema regeneration keeps it). The bell is a client component in `admin/modules/notifications/`; the existing shell button only renders it. Quality budgets are Playwright specs (Lighthouse through CDP, `@axe-core/playwright`, Resource Timing), so they run locally and in CI with the existing harness. Linux baselines are recorded by `scripts/visual-baselines-linux.sh` in `mcr.microsoft.com/playwright:v1.64.0-noble` from `HEAD`; CI's `visual` job runs in the same image. Deploys are a GitHub Actions job that calls the Dokploy API per GitHub environment (`staging` ← `feat/platform`, `production` ← `main`).

**Tech Stack:** Next.js 16.3.8 (App Router, Cache Components, `deploymentId` / `NEXT_DEPLOYMENT_ID`) · Hono 4.13.13 · Drizzle 0.45.4 / drizzle-kit 0.31 · Better Auth 1.7.7 (`user.additionalFields`) · TanStack Query 5.104.1 · Recharts 3.8.0 (existing `Gauge`, `PillBarChart`) · date-fns 4.4 + `@date-fns/tz` 1.5 · Playwright 1.64.0 · `@axe-core/playwright` 4.13.0 · Lighthouse 13.5.0 · `@aws-sdk/client-s3` 3.1141.0 (restore drill) · GitHub Actions · Docker. **No new dependencies; one removed** (`@huggingface/transformers`).

**Spec:** [`docs/brief.md`](../brief.md) (**§3 in full**, §2.3 Q3 "Content fixes", §4.4 fonts, **§4.6 in full**, §7.2 "Dashboard enquiry widgets show aggregates only, unless the viewer has `lead.read`", §8.3 Session row `GET /admin/dashboard` · `GET /admin/notifications`, §9.1 bell, **§9.3 Dashboard row**, §11 "Results are aggregated for the dashboard gauge", §12.5 "Failures surface as an admin notification", §15 Backups, **§16 in full** incl. the CI pipeline, **§17 in full**, §18 Phase 11 row, §19 "Content quality and missing legal pages", "Owner lockout") and the Phase 11 contract in [`docs/plan.md`](../plan.md) ("### Phase 11: Dashboard data, polish and launch", ~line 5664) plus its "Spec coverage map". Read both first.

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

Phase-11 values from the spec (verbatim):

- "**Dashboard** | "Good morning, {name}" with **New article** / **View site** buttons. KPI row: **New enquiries** (hero card, change vs last month), published articles, newsletter subscribers, SEO health %. **Enquiries this week** pill chart (solid = this week, hatched = last week). **Next up** card (next scheduled article, or the oldest uncontacted enquiry, with a CTA). **Team activity** feed with avatars and status pills. **Content health** gauge (complete / needs work / missing SEO or alt). Every widget respects RBAC" (§9.3)
- "Dashboard enquiry widgets show aggregates only, unless the viewer has `lead.read`." (§7.2) · "a bell for notifications: new enquiries, scheduled posts going live, failed deliveries;" (§9.1) · "**Delivery.** Retries with backoff. Failures surface as an admin notification." (§12.5)
- "5. **SEO.** … Every content image has alt text. Lighthouse scores on key pages: SEO 100, accessibility ≥ 95, mobile performance ≥ 90." · "8. **Operations.** Local setup is one command. Deploys run migrations automatically, and the database is backed up daily." (§3)
- "| Quality | Lighthouse CI, axe in Playwright | Performance, SEO and accessibility budgets on key pages |" · CI pipeline "7. E2E against `next start` + Postgres; 8. then, on `main`, trigger the Dokploy deploy webhook (Dokploy auto-deploy turned off)." (§16)
- "`NEXT_DEPLOYMENT_ID` is set to the git SHA for version-skew protection." · "`scripts/generate-hero-depth.mjs` moves to an on-demand `pnpm dlx` setup, so `@huggingface/transformers` leaves the image build." · "**Runbook** (`docs/runbook.md`, written in the final phase): deploy, roll back, restore a backup, rotate secrets, recover the owner account, verify the sending domain, set up GTM." (§17)
- "**Backups.** Dokploy runs a scheduled `pg_dump` to R2 every day and keeps 30 days. A restore drill is documented in the runbook." (§15)
- "3. **Content fixes found during analysis** (§4.6). … _Default: import the content as-is, list the issues in the admin "Content health" panel, and fix the obvious rebrand leftovers (James → Magda, `jameswhitfield.ie`) only once you approve._" (§2.3)
- Contract (plan.md): "1. **Dashboard KPIs** … All widgets are RBAC-aware: aggregates only without `lead.read`. 2. **Notifications.** A bell for new enquiries, scheduled publishes and delivery failures, polled every 60 s, with a `notificationsSeenAt` user field. 3. **Performance and accessibility pass:** Lighthouse CI budgets, axe, image audit, bundle check. 4. **CI and deploys.** Full E2E in CI, with Linux visual baselines generated in the Playwright Docker image. The Dokploy deploy runs only after green CI (webhook), with `NEXT_DEPLOYMENT_ID` set to the git SHA. `@huggingface/transformers` moves out of the image build. 5. **Launch:** `docs/runbook.md`; daily `pg_dump` to R2 and a restore drill; content QA with the client (the §4.6 findings) and legal pages; the staging → production cut-over (`feat/platform` → `main`)."
- Acceptance (plan.md): "every §3 success criterion verified, and the client signs off."

**New dependencies:** none. **Removed:** `@huggingface/transformers` (devDependency). **New environment variables:** none for the app. CI secrets per GitHub environment: `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_APPLICATION_ID`. Restore drill (operator's shell only): `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_BUCKET`, `BACKUP_S3_PREFIX`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, optional `DRILL_DATABASE_URL`. **Migrations:** one, `0010_notifications` (`users.notifications_seen_at`, `audit_logs_action_created_idx`).

## Review Focus

1. **Health-adjacent data reaching the wrong role.** A marketer, editor or viewer opens the dashboard or the bell while enquiries are waiting. They see counts (the KPI and the pill chart) and nothing that names or links an enquiry; the bell shows them no enquiry or enquiry-email items at all. → Task 1 `dashboard.test.ts` "a marketer gets enquiry counts but no enquiry in Next up"; Task 3 `notifications.test.ts` "each role gets only the items its permissions allow".
2. **Read state that lies.** A person invited today must not open the bell to 30 days of "unread" history; an owner viewing as an intake person must not clear that person's unread items; a second tab must not resurrect the badge after the first tab opened the bell. → Task 3 "a new account starts with nothing unread", "View-as never marks notifications read", `notifications-bell.test.tsx` "opening the bell marks everything read and drops the badge".
3. **A brand-new or empty site.** No enquiries, no articles, no subscribers, no live pages, no audit rows. Every KPI says 0 with a caption that makes sense (no "NaN%", no "vs last week" beside nothing), the gauge shows its empty state, Next up falls back to the setup steps, the findings list is absent rather than broken. → Task 1 "a fresh install answers zeros everywhere"; Task 2 `present.test.ts` "kpis caption zeros honestly".
4. **Irish calendar boundaries.** An enquiry at 00:30 on a summer Monday in Dublin (23:30 UTC Sunday) counts for Monday this week, not Sunday last week; the 30-day windows never double-count the boundary instant. → Task 1 "counts an enquiry at 00:30 Irish Monday on that Monday" and "the 30-day windows share no instant".
5. **A deploy that should not happen.** A push to `main` whose E2E or visual job fails, a pull request from a fork, a `workflow_dispatch` baseline refresh, or a repository without the Dokploy secrets. None of them triggers Dokploy; a missing secret is a visible warning, never a silent pass or a leaked value. → Task 6 `tests/ci/workflow.test.ts` "deploys only after check, e2e and visual pass, and only on pushes to main or feat/platform", "skips with a warning when the Dokploy secrets are missing".

---

## Rulings (decisions this plan takes; one line each in the hand-off)

| # | Ruling | Tasks |
| --- | --- | --- |
| R1 Dashboard set | The DTO is rebuilt around the §9.3 widgets. Phase 2's sign-in KPIs, "Changes this week" and the Security-health gauge retire from the dashboard (two-factor status lives on Users & roles; the two-factor and invite setup steps stay in Next up). `GET /admin/dashboard` keeps its path and `dashboard.view` gate. | 1, 2 |
| R2 Windows | "New enquiries … vs last month" = non-spam leads created in the last 30 days vs the 30 days before (half-open windows, like Phase 2's active users). The pill chart uses Phase 2's Irish `weekWindow`. "Published articles" = `status = 'published'` (caption: how many are scheduled). "Subscribers" = `status = 'confirmed'` (caption: confirmed in the last 30 days). | 1 |
| R3 Widget permissions | Counts (enquiries, chart, articles, subscribers) go to everyone with `dashboard.view` — aggregates are what §7.2 allows. The **enquiry** Next-up item needs `lead.read`; the **article** item `article.read`; **SEO health** KPI and the **Content health** gauge `seo.read`; the **findings list** `page.update`; **Team activity** `audit.read` (unchanged). KPI links render only when the viewer can open the target. | 1, 2 |
| R4 Gauge buckets | Per live page or article (from `getSeoHealth().issues`): **missing SEO or alt** if any failing check is `description`, `og-image` or `alt-text`; **needs work** if it fails only other checks; **complete** otherwise. Media-only issues are not entities. | 1 |
| R5 Content QA | Brief §2.3 Q3 default: issues are listed, never auto-fixed. Automated rules over published pages and articles, the editable globals (site, contact, navigation, footer, newsletter, contact form, microcopy) and visible collection rows: `rebrand` (`James`, `jameswhitfield`), `placeholder-contact` (`[email]`, `[phone]`, `[Dublin, Ireland]`), `placeholder-copy` (seeded legal placeholder text), `online-reach` ("worldwide" and "Ireland, UK & USA" both present), `legal-unpublished` (`/privacy`, `/terms`, `/disclaimer` not published). The rest of §4.6 (duplicate FAQ, seven CTA wordings, reused photo, typos) is a manual list in `docs/content-qa.md`. The dashboard shows at most 10 findings plus the total. | 1, 2, 8 |
| R6 Derived notifications | No notifications table. Sources: new non-spam leads (`lead.read`), failed enquiry emails from `lead_activities` (`lead.read`), `article.publish` audit rows with no actor = went live on schedule (`article.read`), `article.schedule_failed` (`article.update`), `article.submit` by someone else = review requested (`article.publish`), `tracking.capi_failed` (`tracking.read`). Last 30 days, newest 20. Unread = newer than `notificationsSeenAt`, which defaults to the account's `createdAt`. Marking seen is personal UI state: not audited. | 3 |
| R7 `notificationsSeenAt` | Column `users.notifications_seen_at timestamptz null`, written by hand into `server/db/schema/auth.ts` **and** declared in Better Auth `user.additionalFields` (`type: "date"`, `required: false`, `input: false`, `returned: false`) so `pnpm auth:generate` keeps it and no client can set it through `update-user`. The same migration adds `audit_logs_action_created_idx (action, created_at desc)` (Phase 2.8 carry), which the bell's audit query uses. | 3 |
| R8 Bell placement | The bell lives in `admin/modules/notifications/notifications-bell.tsx`. `admin/components/shell/notifications-button.tsx` (clean in git, but inside the user's shell directory) is changed to a one-line render of it — **controller coordinates with user** before that edit; until then the bell ships unmounted and its E2E is held. | 3 |
| R9 View-as and the bell | `GET /notifications` during View-as shows what the viewed person would see; `POST /notifications/seen` refuses (403 `IMPERSONATION_READ_ONLY`), and the bell ignores that refusal. | 3 |
| R10 Quality budgets | One Lighthouse spec on the five key pages (`/`, `/about`, `/services`, `/insights`, `/insights/calm-is-a-skill`) with Lighthouse's default **mobile** config and simulated throttling: SEO 100, accessibility ≥ 95, performance ≥ 90 as the **median of three runs**. Public axe on every parity route and the 404 (no serious/critical). Image audit: every `<img>` has an `alt` attribute and no visible raster is more than 2× its rendered size × DPR. JavaScript budget: script bytes (compressed) per public route ≤ the measured maximum + 15%, rounded up to 10 KB. All run in CI (titles `lighthouse:` / `budget:` / `axe:`). A budget is never lowered to pass: a page that misses after the listed fixes is reported to the controller. | 4, 5 |
| R11 Linux baselines | Docker is available locally (Docker 29.7.2, **arm64**). Baselines are recorded locally by `scripts/visual-baselines-linux.sh` in `mcr.microsoft.com/playwright:v1.64.0-noble` with `platform: linux/amd64` (CI's architecture), from `git archive HEAD` (never the working tree, so the user's uncommitted shell edits never reach a baseline). CI's `visual` job runs in the same image and is the judge. Fallback: `workflow_dispatch` with `update_baselines: true` records them in CI and uploads them as an artifact. Admin `visual:` baselines must be re-recorded whenever shell changes are committed. Parity baselines on Linux are recorded from today's DB-driven site: the darwin parity suite already proves it matches the pre-migration static site at ≤ 0.1%. | 5 |
| R12 Deploy gating | New `deploy` job: `needs: [check, e2e, visual]`, only on `push` to `main` (GitHub environment `production`) or `feat/platform` (environment `staging`). It calls Dokploy's API `POST <DOKPLOY_URL>/api/application.deploy` with `x-api-key` and `{ applicationId }`; Dokploy's auto-deploy is turned off (user step). Missing secrets → `::warning::` and exit 0. Pull requests, forks and `workflow_dispatch` never deploy. | 6 |
| R13 Deployment id | `scripts/deployment-id.sh` prints `$NEXT_DEPLOYMENT_ID` if the build arg is set, else the commit read from `.git/HEAD` (+ `refs/…` or `packed-refs`) of the build context, else `build-<UTC timestamp>`. `.dockerignore` keeps `.git` out except `HEAD`, `refs/` and `packed-refs`. The Dockerfile exports the result before `pnpm build`. | 6 |
| R14 Hero depth tooling | `@huggingface/transformers` is removed from `devDependencies`. `pnpm hero:depth` installs `@huggingface/transformers@4.3.0` into `node_modules/.cache/hero-depth` and runs a copy of the script from there (Node's ESM resolution walks up from the script file, which a `pnpm dlx` temp dir cannot provide). | 6 |
| R15 Backups | Daily backups are Dokploy's own scheduled PostgreSQL backups to an R2 destination with 30-day retention (user step). `pnpm backup:drill` restores a dump — `--file <path>` or `--latest` from R2 — into a disposable database whose name must end in `_restore_drill`, detects custom-format vs plain SQL (gzipped or not) by magic bytes, and checks migrations, owners and published pages. | 7 |
| R16 Owner recovery | `owner-recover.cjs --email` (shell only, no HTTP route): for an account that holds `owner`, deletes its two-factor row, clears `two_factor_enabled` and any ban, ends its sessions and the View-as sessions it started, audits `user.recover` (system actor) and emails a password-reset link. Refuses unknown emails and non-owners. | 7 |
| R17 Cut-over | Merging `feat/platform` → `main`, pushing, Dokploy/GitHub/R2/Resend configuration, client content and legal sign-off are **user steps** in `docs/launch.md`. The plan never pushes, merges or configures external services. | 8 |

**Open questions for the user** (defaults apply if unanswered; carried into `docs/launch.md`):

- Q1 (R3): enquiry **counts** visible to every dashboard role (brief default) — or hide the enquiry KPI/chart from roles without `lead.read`?
- Q2 (R10): if a key page stays under mobile performance 90 after Task 4's fixes, accept a documented exception or keep working before launch?
- Q3 (R12): require a reviewer on the GitHub `production` environment (a manual "approve deploy" click)? Default: yes.
- Q4 (R12): confirm the Dokploy version exposes `application.deploy` (Dokploy ▸ Settings ▸ API / `/swagger`); otherwise the job switches to the app's deploy webhook URL.
- Carried from Phase 10: R8 "View-as read-only everywhere?"; R15 "any `CUSTOM_SCRIPT_HOSTS` before launch?".

## File structure

| Files | Responsibility | Task |
| --- | --- | --- |
| `lib/content/qa.ts` (+ test), `server/modules/dashboard/content-qa.ts`, `server/modules/dashboard/content-health.ts` (+ test), `server/modules/dashboard/repo.ts` (rewrite), `server/modules/dashboard/service.ts` (rewrite), `tests/integration/api/dashboard.test.ts` (rewrite), `tests/integration/api/dashboard-content.test.ts` | dashboard data, gauge, content QA | 1 |
| `admin/modules/dashboard/dashboard-view.tsx` (rewrite), `admin/modules/dashboard/present.ts` (+ test), `admin/modules/dashboard/dashboard-skeleton.tsx` (modify if the grid changes), `admin/modules/insights/articles-view.tsx` (`?new=1` opens the dialog), `tests/e2e/fixtures/dashboard.ts`, `tests/e2e/fixtures/notifications.ts`, `tests/e2e/admin/visual/shell.spec.ts`, `tests/e2e/admin/shell/dashboard.spec.ts`, `tests/e2e/__screenshots__/darwin/admin-*/dashboard-*.png` | dashboard screen | 2 |
| `server/db/schema/auth.ts`, `server/db/schema/audit.ts`, `server/db/migrations/0010_notifications.sql` (+ meta), `server/auth/auth.ts`, `lib/notifications.ts`, `server/modules/notifications/{service,routes}.ts`, `server/api/routes/admin.ts`, `admin/lib/{api,query-keys}.ts`, `admin/modules/notifications/{queries,notifications-bell}.tsx` (+ test), `admin/components/shell/notifications-button.tsx` (**controller coordinates with user**), `tests/integration/api/notifications.test.ts`, `tests/e2e/admin/content/notifications.spec.ts` | notifications | 3 |
| `tests/e2e/perf/lighthouse-budgets.spec.ts` (replaces `lighthouse-seo.spec.ts`), `tests/e2e/navigation/axe.spec.ts`, `tests/e2e/perf/images.spec.ts`, `tests/e2e/perf/javascript.spec.ts`, `tests/e2e/admin/a11y/lighthouse.spec.ts` (comment), public-site fixes found by the specs | quality budgets | 4 |
| `scripts/visual-baselines-linux.sh`, `docker/visual/compose.yml`, `tests/e2e/__screenshots__/linux/**`, `.github/workflows/ci.yml` (visual job, budgets step, dispatch input), `tests/ci/workflow.test.ts`, `tests/e2e/admin/visual/shell.spec.ts` (comment) | Linux baselines and CI | 5 |
| `.github/workflows/ci.yml` (deploy job), `tests/ci/workflow.test.ts` (extend), `scripts/deployment-id.sh`, `tests/ci/deployment-id.test.ts`, `Dockerfile`, `.dockerignore`, `package.json`, `pnpm-lock.yaml`, `scripts/generate-hero-depth.mjs` | deploy after green CI, deployment id, hero tooling | 6 |
| `server/modules/users/recover.ts`, `scripts/owner-recover.ts`, `tests/integration/users/recover.test.ts`, `scripts/restore-drill.ts`, `scripts/restore-drill-lib.ts` (+ test), `package.json`, `Dockerfile`, `docs/runbook.md`, `docs/deploy-dokploy.md` | owner recovery, restore drill, runbook | 7 |
| `docs/content-qa.md`, `docs/launch.md`, `.superpowers/sdd/plan/progress.md` | client QA sheet, §3 acceptance and cut-over checklist, phase exit | 8 |

**Files this plan never touches** (the user's uncommitted work): `admin/components/shell/*` (incl. `footer-dock.tsx`, `section-tabs.tsx`) **except** the single coordinated edit to `notifications-button.tsx` (R8), `app/(admin)/admin.css`, `lib/admin/nav.ts`, `admin/modules/pages/page-builder.tsx`, `components/ui/tabs.tsx`, `tests/e2e/admin/shell/navigation.spec.ts`. Stage files by path only (`git add <paths>`), never `git add -A`/`.`.

## Conventions for executing this plan

- Run `pnpm db:up` before integration tests. Only Task 3 generates a migration; after every other task `git status --short server/db/migrations` must be clean.
- Integration tests use `resetDb` per test, `cookieFor(role)` / `createUser` / `signIn` / `signInWithTwoFactor` / `viewAs(cookie, userId)` / `adminRequest(path, cookie, { method, body, origin })` from `tests/integration/helpers/auth.ts`, `insertLead` (`helpers/leads.ts`), `insertTaxonomy` / `insertArticle` (`helpers/articles.ts`), `insertMedia` / `insertPage` / `heroDocument` (`helpers/content.ts`), and `readOutbox` / `clearOutbox` from `@/server/lib/email`. Anything that reaches `getSeoHealth()` mocks `next/cache` like `tests/integration/api/seo-health.test.ts` (`cacheTag`, `cacheLife`, `revalidateTag` → `vi.fn()`).
- The build has no database: `DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build` must pass after Tasks 2, 3, 4 and 6.
- Visual baselines: never re-record darwin baselines from the working tree (it contains the user's uncommitted shell edits). Task 2 re-records only `dashboard-*.png`, from a clean worktree of `HEAD` (Step shown there). Linux baselines come only from `scripts/visual-baselines-linux.sh` (Task 5) or the CI artifact.
- Playwright filters: `--grep` applies only to the selected projects' tests; the `setup` dependency project always runs in full (verified in `playwright@1.64.0/lib/runner/index.js`: dependency suites are built from the unfiltered project suites), so `--grep "parity:|visual:"` still signs the E2E roles in.
- Commit messages: Conventional Commits, written normally, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Next-specific APIs were checked in `node_modules/next/dist/docs/01-app/`: `03-api-reference/05-config/01-next-config-js/deploymentId.md` ("You can also set the deployment ID using the `NEXT_DEPLOYMENT_ID` environment variable"; it appends `?dpl=`, sets `x-nextjs-deployment-id` and `data-dpl-id`, and keys `'use cache'` entries), `02-guides/self-hosting.md` (Version Skew), `02-guides/package-bundling.md` (`pnpm next experimental-analyze`, the Turbopack bundle analyzer, available from 16.1). Re-read before changing how any of them is used.
- Never push, never merge, never run anything against staging or production. Every external configuration is a user step in `docs/launch.md`.

---

### Task 1: Dashboard data — KPIs, enquiries chart, Next up, content health and content QA

**Model:** opus

**Files:**
- Create: `lib/content/qa.ts`, `lib/content/qa.test.ts`, `server/modules/dashboard/content-qa.ts`, `server/modules/dashboard/content-health.ts`, `server/modules/dashboard/content-health.test.ts`, `tests/integration/api/dashboard-content.test.ts`
- Modify (rewrite): `server/modules/dashboard/repo.ts`, `server/modules/dashboard/service.ts`, `tests/integration/api/dashboard.test.ts`
- Keep: `server/modules/dashboard/routes.ts`, `server/modules/dashboard/week.ts` (+ its test)

**Interfaces:**
- Consumes: `weekWindow`, `DUBLIN` (`./week`), `getSeoHealth()` + `type SeoHealth` (`server/modules/seo/queries.ts`, `./health`), `listLiveEntities()` (`server/modules/seo/live.ts`), `entryFor`, `titleOf` (`server/modules/collections/registry.ts`), `COLLECTION_NAMES`, `COLLECTION_LABELS` (`lib/content/collections.ts`), `GLOBAL_LABELS`, `type EditableGlobalKey`, `type SettingsPage` (`lib/content/global-access.ts`), `hasPermission`, `parseRoles` (`lib/auth/permissions.ts`), `roleRequiresTwoFactor` (`lib/auth/two-factor-policy.ts`).
- Produces:
  - `lib/content/qa.ts`: `type QaRuleId = "rebrand" | "placeholder-contact" | "placeholder-copy" | "online-reach" | "legal-unpublished"`, `type QaSource = { label: string; href: string; value: unknown }`, `type QaFinding = { rule: QaRuleId; label: string; href: string; message: string }`, `LEGAL_PATHS`, `strings(value: unknown): string[]`, `scanContent(sources: readonly QaSource[]): QaFinding[]`, `legalFinding(path: string, page: { id: string; title: string } | null): QaFinding`.
  - `server/modules/dashboard/content-health.ts`: `type ContentGauge = { complete: number; needsWork: number; missing: number; total: number }`, `contentGauge(health: Pick<SeoHealth, "issues">, entities: readonly { kind: "page" | "article"; id: string }[]): ContentGauge`.
  - `server/modules/dashboard/content-qa.ts`: `getContentFindings(): Promise<QaFinding[]>`.
  - `server/modules/dashboard/service.ts`: `type DashboardDto` (below), `type NextUpItem`, `getDashboard(actor: Actor, now?: Date): Promise<DashboardDto>` — Task 2 renders it, Task 2's fixture is typed against it.

```ts
export type NextUpItem = {
  id: "enquiry" | "article" | "two-factor" | "invite"
  title: string
  description: string
  cta: string
  href: string
  done: boolean
}
export type DashboardDto = {
  generatedAt: string
  enquiries: { value: number; previous: number }
  enquiriesWeek: {
    days: { key: string; label: string; current: number; previous: number }[]
    current: number
    previous: number
  }
  articles: { published: number; scheduled: number }
  subscribers: { confirmed: number; newThisMonth: number }
  seoHealth: { score: number; issues: number } | null
  contentHealth:
    | (ContentGauge & { findings: QaFinding[] | null; findingsTotal: number })
    | null
  recentActivity:
    | {
        id: string
        actorName: string | null
        actorEmail: string | null
        action: string
        summary: string
        createdAt: string
      }[]
    | null
  nextUp: NextUpItem[]
}
```

- [ ] **Step 1: Write the failing QA unit test**

```ts
// lib/content/qa.test.ts
import { describe, expect, it } from "vitest"

import { legalFinding, scanContent, strings } from "./qa"

const src = (label: string, value: unknown) => ({
  label,
  href: `/admin/${label}`,
  value,
})

describe("strings", () => {
  it("collects every string, however deep", () => {
    expect(
      strings({ a: "x", b: [{ c: "y" }, 3, null], d: { e: { f: "z" } } })
    ).toEqual(["x", "y", "z"])
  })
})

describe("scanContent (docs/brief.md §4.6)", () => {
  it("flags the rebrand leftovers, once per source", () => {
    const findings = scanContent([
      src("about", { text: "James works with… James again" }),
      src("contact", { email: "hello@jameswhitfield.ie" }),
      src("clean", { text: "Magda works with individuals." }),
    ])
    expect(findings.map((f) => [f.rule, f.label])).toEqual([
      ["rebrand", "about"],
      ["rebrand", "contact"],
    ])
  })

  it("flags placeholder contact lines and placeholder copy", () => {
    const findings = scanContent([
      src("footer", { contactLines: ["[email]", "[phone]", "[Dublin, Ireland]"] }),
      src("privacy", { doc: "This privacy policy is a placeholder and has not been reviewed." }),
    ])
    expect(findings.map((f) => f.rule)).toEqual([
      "placeholder-contact",
      "placeholder-copy",
    ])
  })

  it("flags the online-reach contradiction only when both wordings exist", () => {
    expect(
      scanContent([src("contact", { note: "Online sessions available worldwide" })])
    ).toEqual([])
    const [finding] = scanContent([
      src("contact", { note: "Online sessions available worldwide via Zoom." }),
      src("footer", { note: "Online sessions available - Ireland, UK & USA." }),
    ])
    expect(finding).toMatchObject({
      rule: "online-reach",
      label: "contact, footer",
      href: "/admin/contact",
    })
  })

  it("never matches a bare word like 'his' or a lowercase name in a slug", () => {
    expect(scanContent([src("x", { text: "His practice", slug: "st-jamess" })])).toEqual([])
  })
})

describe("legalFinding", () => {
  it("links to the page when it exists, else to the page list", () => {
    expect(legalFinding("/privacy", { id: "p1", title: "Privacy Policy" })).toMatchObject({
      rule: "legal-unpublished",
      label: "Privacy Policy",
      href: "/admin/pages/p1",
    })
    expect(legalFinding("/terms", null)).toMatchObject({
      label: "/terms",
      href: "/admin/pages",
    })
  })
})
```

- [ ] **Step 2: Write the failing gauge unit test**

```ts
// server/modules/dashboard/content-health.test.ts
import { describe, expect, it } from "vitest"

import type { SeoIssue } from "@/server/modules/seo/health"

import { contentGauge } from "./content-health"

const issue = (id: string, check: SeoIssue["check"], kind: SeoIssue["kind"] = "page") =>
  ({ kind, id, title: id, path: "/", check, message: "", fixHref: "" }) as SeoIssue

describe("contentGauge (Ruling R4)", () => {
  it("buckets each live entity once: missing beats needs work", () => {
    const entities = ["a", "b", "c", "d"].map((id) => ({ kind: "page" as const, id }))
    const gauge = contentGauge(
      {
        issues: [
          issue("a", "description"),
          issue("a", "title-length"),
          issue("b", "h1"),
          issue("c", "alt-text"),
          // Media rows are not entities.
          issue("m1", "alt-text", "media"),
        ],
      },
      entities
    )
    expect(gauge).toEqual({ complete: 1, needsWork: 1, missing: 2, total: 4 })
  })

  it("is all zeros for a site with nothing live", () => {
    expect(contentGauge({ issues: [] }, [])).toEqual({
      complete: 0,
      needsWork: 0,
      missing: 0,
      total: 0,
    })
  })
})
```

- [ ] **Step 3: Run both to verify they fail**

Run: `pnpm vitest run --project unit lib/content/qa.test.ts server/modules/dashboard/content-health.test.ts`
Expected: FAIL with `Failed to resolve import "./qa"` and `"./content-health"`.

- [ ] **Step 4: Implement the QA rules and the gauge**

```ts
// lib/content/qa.ts
// docs/brief.md §4.6 and §2.3 Q3: content issues are listed in the admin's
// Content health panel, never fixed automatically. Isomorphic and pure.

export type QaRuleId =
  | "rebrand"
  | "placeholder-contact"
  | "placeholder-copy"
  | "online-reach"
  | "legal-unpublished"
export type QaSource = { label: string; href: string; value: unknown }
export type QaFinding = {
  rule: QaRuleId
  label: string
  href: string
  message: string
}

export const LEGAL_PATHS = ["/privacy", "/terms", "/disclaimer"] as const

const TEXT_RULES: { id: QaRuleId; message: string; pattern: RegExp }[] = [
  {
    id: "rebrand",
    message: "Mentions the previous practitioner (“James” or jameswhitfield.ie)",
    pattern: /\bJames\b|jameswhitfield/,
  },
  {
    id: "placeholder-contact",
    message: "Has placeholder contact details such as [email] or [phone]",
    pattern: /\[(?:email|phone|Dublin, Ireland)\]/i,
  },
  {
    id: "placeholder-copy",
    message: "Has placeholder copy that must be replaced before launch",
    pattern: /placeholder copy|is a placeholder|has not been reviewed/i,
  },
]
const WORLDWIDE = /\bworldwide\b/i
const THREE_COUNTRIES = /Ireland,\s*UK\s*(?:&|and)\s*(?:the\s*)?USA/i

export function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value)
  else if (Array.isArray(value)) for (const v of value) strings(v, out)
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) strings(v, out)
  return out
}

export function scanContent(sources: readonly QaSource[]): QaFinding[] {
  const findings: QaFinding[] = []
  const worldwide: QaSource[] = []
  const threeCountries: QaSource[] = []
  for (const source of sources) {
    const text = strings(source.value).join("\n")
    for (const rule of TEXT_RULES) {
      if (rule.pattern.test(text)) {
        findings.push({
          rule: rule.id,
          label: source.label,
          href: source.href,
          message: rule.message,
        })
      }
    }
    if (WORLDWIDE.test(text)) worldwide.push(source)
    if (THREE_COUNTRIES.test(text)) threeCountries.push(source)
  }
  if (worldwide.length && threeCountries.length) {
    const labels = [...new Set([...worldwide, ...threeCountries].map((s) => s.label))]
    findings.push({
      rule: "online-reach",
      label: labels.join(", "),
      href: worldwide[0]!.href,
      message:
        "Online sessions are “worldwide” in one place and “Ireland, UK & USA” in another",
    })
  }
  return findings
}

export function legalFinding(
  path: string,
  page: { id: string; title: string } | null
): QaFinding {
  return {
    rule: "legal-unpublished",
    label: page?.title ?? path,
    href: page ? `/admin/pages/${page.id}` : "/admin/pages",
    message: "Legal page is not published, so the footer link returns 404",
  }
}
```

```ts
// server/modules/dashboard/content-health.ts
import "server-only"

import type { CheckId } from "@/lib/seo/checks"
import type { SeoHealth } from "@/server/modules/seo/health"

export type ContentGauge = {
  complete: number
  needsWork: number
  missing: number
  total: number
}

// Ruling R4: "missing SEO or alt" (docs/brief.md §9.3) is a missing
// description, share image or alt text; any other failing check is work.
const MISSING: ReadonlySet<CheckId> = new Set(["description", "og-image", "alt-text"])

export function contentGauge(
  health: Pick<SeoHealth, "issues">,
  entities: readonly { kind: "page" | "article"; id: string }[]
): ContentGauge {
  const worst = new Map<string, "missing" | "work">()
  for (const issue of health.issues) {
    if (issue.kind === "media") continue
    const key = `${issue.kind}:${issue.id}`
    if (MISSING.has(issue.check)) worst.set(key, "missing")
    else if (!worst.has(key)) worst.set(key, "work")
  }
  let missing = 0
  let needsWork = 0
  for (const e of entities) {
    const state = worst.get(`${e.kind}:${e.id}`)
    if (state === "missing") missing += 1
    else if (state === "work") needsWork += 1
  }
  return {
    complete: entities.length - missing - needsWork,
    needsWork,
    missing,
    total: entities.length,
  }
}
```

`contentGauge` takes the entity list separately because `SeoHealth` only carries `entities: number`; the service passes `listLiveEntities()` (it is cheap and `getSeoHealth()` already loaded the same rows into the cache). If `lib/seo/checks.ts` names the checks differently from `description`, `og-image`, `alt-text`, use its real ids (they were read from it while writing this plan: `title-length`, `title-unique`, `description`, `og-image`, `alt-text`, `h1`, `indexable`, `internal-link`).

Run: `pnpm vitest run --project unit lib/content/qa.test.ts server/modules/dashboard/content-health.test.ts` → PASS.

- [ ] **Step 5: Write the failing dashboard integration tests**

Replace `tests/integration/api/dashboard.test.ts` entirely:

```ts
// tests/integration/api/dashboard.test.ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { closeDb, getDb } from "@/server/db/client"
import { articles, auditLogs, newsletterSubscribers } from "@/server/db/schema"
import { weekWindow } from "@/server/modules/dashboard/week"

import { insertArticle, insertTaxonomy } from "../helpers/articles"
import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"
import { insertLead } from "../helpers/leads"

beforeEach(resetDb)
afterAll(closeDb)

const HOUR = 3_600_000
const DAY = 24 * HOUR
const at = (base: Date, ms: number) => new Date(base.getTime() + ms)

async function dashboard(cookie: string) {
  const response = await adminRequest("/dashboard", cookie)
  expect(response.status).toBe(200)
  return response.json()
}

describe("GET /api/v1/admin/dashboard — enquiries", () => {
  it("counts non-spam enquiries over 30 days against the 30 before", async () => {
    const cookie = await cookieFor("owner")
    const now = new Date()
    await insertLead({ createdAt: at(now, -1 * DAY) })
    await insertLead({ createdAt: at(now, -2 * DAY), email: "b@example.com" })
    await insertLead({ createdAt: at(now, -3 * DAY), status: "spam", email: "s@example.com" })
    await insertLead({ createdAt: at(now, -40 * DAY), email: "c@example.com" })

    expect((await dashboard(cookie)).enquiries).toEqual({ value: 2, previous: 1 })
  })

  it("the 30-day windows share no instant", async () => {
    const cookie = await cookieFor("owner")
    // Exactly 30 days ago belongs to the current window only.
    const edge = new Date(Date.now() - 30 * DAY + 5_000)
    await insertLead({ createdAt: edge })
    const body = await dashboard(cookie)
    expect(body.enquiries.value + body.enquiries.previous).toBe(1)
  })

  it("counts an enquiry at 00:30 Irish Monday on that Monday", async () => {
    const cookie = await cookieFor("owner")
    const week = weekWindow(new Date())
    await insertLead({ createdAt: at(week.start, 30 * 60_000) })
    await insertLead({ createdAt: at(week.previousStart, 2 * HOUR), email: "p@example.com" })

    const body = await dashboard(cookie)
    expect(body.enquiriesWeek).toMatchObject({ current: 1, previous: 1 })
    expect(body.enquiriesWeek.days[0]).toEqual({
      key: week.days[0]!.key,
      label: "Mon",
      current: 1,
      previous: 1,
    })
  })
})

describe("articles, subscribers and Next up", () => {
  it("counts published and scheduled articles and names the next one due", async () => {
    const cookie = await cookieFor("editor")
    const refs = await insertTaxonomy()
    const base = { categoryId: refs.category.id, authorId: refs.author.id, coverId: refs.media.id }
    await insertArticle({ ...base, slug: "live" })
    const soon = await insertArticle({ ...base, slug: "soon", status: "scheduled" })
    await insertArticle({ ...base, slug: "later", status: "scheduled" })
    await getDb()
      .update(articles)
      .set({ scheduledFor: new Date(Date.now() + DAY) })
      .where(eqId(soon.id))
    await getDb()
      .update(articles)
      .set({ scheduledFor: new Date(Date.now() + 3 * DAY) })
      .where(notEqId(soon.id))

    const body = await dashboard(cookie)
    expect(body.articles).toEqual({ published: 1, scheduled: 2 })
    expect(body.nextUp[0]).toMatchObject({
      id: "article",
      href: `/admin/insights/${soon.id}`,
      done: false,
    })
  })

  it("counts confirmed subscribers and those confirmed in 30 days", async () => {
    const cookie = await cookieFor("owner")
    const now = new Date()
    await getDb().insert(newsletterSubscribers).values([
      { email: "a@example.com", status: "confirmed", confirmedAt: at(now, -2 * DAY) },
      { email: "b@example.com", status: "confirmed", confirmedAt: at(now, -60 * DAY) },
      { email: "c@example.com", status: "pending" },
      { email: "d@example.com", status: "unsubscribed", confirmedAt: at(now, -1 * DAY) },
    ])
    expect((await dashboard(cookie)).subscribers).toEqual({
      confirmed: 2,
      newThisMonth: 1,
    })
  })

  it("puts the oldest uncontacted enquiry first for someone with lead.read", async () => {
    const cookie = await cookieFor("intake")
    const now = new Date()
    const oldest = await insertLead({ name: "Nora Byrne", createdAt: at(now, -3 * DAY) })
    await insertLead({ createdAt: at(now, -1 * DAY), email: "x@example.com" })
    await insertLead({ createdAt: at(now, -9 * DAY), status: "contacted", email: "y@example.com" })

    const [first] = (await dashboard(cookie)).nextUp
    expect(first).toMatchObject({
      id: "enquiry",
      title: "Reply to Nora",
      cta: "Open enquiry",
      href: `/admin/leads?lead=${oldest.id}`,
      done: false,
    })
  })

  it("a marketer gets enquiry counts but no enquiry in Next up (docs/brief.md §7.2)", async () => {
    const cookie = await cookieFor("marketer")
    await insertLead({ name: "Nora Byrne" })
    const body = await dashboard(cookie)
    expect(body.enquiries.value).toBe(1)
    expect(JSON.stringify(body)).not.toContain("Nora")
    expect(body.nextUp.map((item: { id: string }) => item.id)).not.toContain("enquiry")
    expect(body.recentActivity).toBeNull()
  })
})

describe("RBAC and empty states", () => {
  it("a fresh install answers zeros everywhere", async () => {
    const cookie = await cookieFor("owner")
    await getDb().delete(auditLogs)
    const body = await dashboard(cookie)
    expect(body.enquiries).toEqual({ value: 0, previous: 0 })
    expect(body.enquiriesWeek.current + body.enquiriesWeek.previous).toBe(0)
    expect(body.articles).toEqual({ published: 0, scheduled: 0 })
    expect(body.subscribers).toEqual({ confirmed: 0, newThisMonth: 0 })
    expect(body.seoHealth).toEqual({ score: 100, issues: 0 })
    expect(body.contentHealth).toMatchObject({ complete: 0, needsWork: 0, missing: 0, total: 0 })
    expect(body.nextUp.map((item: { id: string }) => item.id)).toEqual(["two-factor", "invite"])
  })

  it("an intake person gets no SEO or content health (no seo.read)", async () => {
    const body = await dashboard(await cookieFor("intake"))
    expect(body.seoHealth).toBeNull()
    expect(body.contentHealth).toBeNull()
    expect(body.recentActivity).toBeNull()
  })

  it("a viewer gets the gauge but not the findings (no page.update)", async () => {
    const body = await dashboard(await cookieFor("viewer"))
    expect(body.contentHealth).not.toBeNull()
    expect(body.contentHealth.findings).toBeNull()
    // Two-factor is optional for a viewer, so it is not called required.
    expect(body.nextUp.at(-1).description).not.toMatch(/required/i)
  })

  it("an owner gets team activity", async () => {
    const body = await dashboard(await cookieFor("owner"))
    expect(body.recentActivity[0]).toMatchObject({ action: "auth.sign_in" })
    expect(typeof body.recentActivity[0].createdAt).toBe("string")
  })
})
```

Define the two tiny helpers at the top of the file (after the imports): `const eqId = (id: string) => eq(articles.id, id)` and `const notEqId = (id: string) => ne(articles.id, id)`, importing `eq`, `ne` from `drizzle-orm`. Keep the Phase 2 "security health counts a user whose ban has expired" test **only** if Task 1 keeps `activeAccounts`; it does not (R1), so delete that describe block with the rest of the old file.

```ts
// tests/integration/api/dashboard-content.test.ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { closeDb, getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { adminRequest, cookieFor } from "../helpers/auth"
import { heroDocument, insertMedia, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("dashboard content health", () => {
  it("lists §4.6 findings with links for an editor, and buckets live pages", async () => {
    const cookie = await cookieFor("editor")
    const media = await insertMedia({ alt: "", filename: "bare.jpg" })
    await insertPage({ path: "/about", document: heroDocument(media.id, "James works here"), published: true })
    await insertPage({ path: "/privacy", document: heroDocument(media.id, "Privacy"), published: false })
    await getDb().insert(settings).values({
      key: "footer",
      value: { contactLines: ["[email]"], contactNote: "Online sessions available - Ireland, UK & USA." },
    })
    await getDb().insert(settings).values({
      key: "contact",
      value: { onlineNote: "Online sessions available worldwide via secure Zoom." },
    })

    const response = await adminRequest("/dashboard", cookie)
    const { contentHealth } = await response.json()
    const rules = contentHealth.findings.map((f: { rule: string }) => f.rule)
    expect(rules).toEqual(
      expect.arrayContaining(["rebrand", "placeholder-contact", "online-reach", "legal-unpublished"])
    )
    expect(contentHealth.findingsTotal).toBe(contentHealth.findings.length)
    expect(contentHealth.findings.find((f: { rule: string }) => f.rule === "placeholder-contact").href).toBe(
      "/admin/settings/footer"
    )
    // The live /about page misses alt text: "missing SEO or alt".
    expect(contentHealth).toMatchObject({ missing: 1, total: 1 })
  })
})
```

`heroDocument(mediaId, title)` puts `title` into the hero block; if the helper's shape does not carry the title into a string the scanner sees, pass a document built inline with a `richtext` block containing "James works here". If `settings` rows for `footer`/`contact` already exist after `resetDb` (seeded defaults), use `.onConflictDoUpdate({ target: settings.key, set: { value: … } })`.

Run: `pnpm vitest run --project integration tests/integration/api/dashboard.test.ts tests/integration/api/dashboard-content.test.ts`
Expected: FAIL (the DTO has no `enquiries`, `contentHealth`, …).

- [ ] **Step 6: Rewrite the repo**

```ts
// server/modules/dashboard/repo.ts
import "server-only"

import { and, asc, count, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm"

import { getDb } from "@/server/db/client"
import { articles, auditLogs, leads, newsletterSubscribers, users } from "@/server/db/schema"

const notSpam = ne(leads.status, "spam")
const createdBetween = (from: Date, to: Date) =>
  and(gte(leads.createdAt, from), lt(leads.createdAt, to))

export async function enquiryCount(from: Date, to: Date) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(leads)
    .where(and(notSpam, createdBetween(from, to)))
  return row?.value ?? 0
}

// Bucketed by the Irish calendar day, so the keys match weekWindow's days.
export function enquiriesByDay(from: Date, to: Date) {
  const day = sql<string>`to_char(${leads.createdAt} at time zone 'Europe/Dublin', 'YYYY-MM-DD')`
  return getDb()
    .select({ day, count: count() })
    .from(leads)
    .where(and(notSpam, createdBetween(from, to)))
    .groupBy(day)
}

export async function articleCounts() {
  const rows = await getDb()
    .select({ status: articles.status, value: count() })
    .from(articles)
    .where(inArray(articles.status, ["published", "scheduled"]))
    .groupBy(articles.status)
  const of = (status: string) => rows.find((r) => r.status === status)?.value ?? 0
  return { published: of("published"), scheduled: of("scheduled") }
}

export async function subscriberCounts(since: Date) {
  const [row] = await getDb()
    .select({
      confirmed: count(),
      recent: sql<number>`count(*) filter (where ${newsletterSubscribers.confirmedAt} >= ${since.toISOString()}::timestamptz)`.mapWith(Number),
    })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.status, "confirmed"))
  return { confirmed: row?.confirmed ?? 0, newThisMonth: row?.recent ?? 0 }
}

export async function oldestNewEnquiry() {
  const [row] = await getDb()
    .select({ id: leads.id, name: leads.name, createdAt: leads.createdAt })
    .from(leads)
    .where(eq(leads.status, "new"))
    .orderBy(asc(leads.createdAt))
    .limit(1)
  return row ?? null
}

// A scheduled article goes live with its draft (docs/brief.md §6.5), so the
// draft's title is the one to show.
export async function nextScheduledArticle() {
  const [row] = await getDb()
    .select({
      id: articles.id,
      title: sql<string>`coalesce(${articles.draft}->>'title', ${articles.title})`,
      scheduledFor: articles.scheduledFor,
    })
    .from(articles)
    .where(eq(articles.status, "scheduled"))
    .orderBy(asc(articles.scheduledFor))
    .limit(1)
  return row ?? null
}

export function recentAudit(limit: number) {
  return getDb()
    .select({
      id: auditLogs.id,
      actorName: users.name,
      actorEmail: auditLogs.actorEmail,
      action: auditLogs.action,
      summary: auditLogs.summary,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
}

export async function accountCount() {
  const [row] = await getDb().select({ value: count() }).from(users)
  return row?.value ?? 0
}
```

Check the real name of the article draft column in `server/db/schema/content.ts` (the schema comment says "the editor's working copy lives in `draft`"); if the scheduled title is stored elsewhere, read it the way `server/modules/articles/service.ts` `draftOf(row)` does.

- [ ] **Step 7: Implement content QA loading**

```ts
// server/modules/dashboard/content-qa.ts
import "server-only"

import { eq, inArray } from "drizzle-orm"

import { COLLECTION_LABELS, COLLECTION_NAMES } from "@/lib/content/collections"
import {
  GLOBAL_LABELS,
  type EditableGlobalKey,
  type SettingsPage,
} from "@/lib/content/global-access"
import { LEGAL_PATHS, legalFinding, scanContent, type QaFinding, type QaSource } from "@/lib/content/qa"
import { getDb, type DbLike } from "@/server/db/client"
import { pages, settings } from "@/server/db/schema"
import { entryFor, titleOf } from "@/server/modules/collections/registry"
import { listLiveEntities } from "@/server/modules/seo/live"

// The globals a visitor reads (Ruling R5). SEO, consent, scripts,
// notifications and privacy hold settings, not site copy.
const QA_GLOBALS = {
  site: "identity",
  contact: "contact",
  navigation: "navigation",
  footer: "footer",
  newsletter: "forms",
  contactForm: "forms",
  microcopy: "forms",
} as const satisfies Partial<Record<EditableGlobalKey, SettingsPage>>
type QaGlobal = keyof typeof QA_GLOBALS

async function loadSources(db: DbLike): Promise<QaSource[]> {
  const [live, globalRows, collectionRows] = await Promise.all([
    listLiveEntities(db),
    db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(inArray(settings.key, Object.keys(QA_GLOBALS))),
    Promise.all(
      COLLECTION_NAMES.map((name) => {
        const { table } = entryFor(name)
        return db.select().from(table).where(eq(table.isVisible, true))
      })
    ),
  ])
  return [
    ...live.map((e) => ({
      label: `${e.kind === "page" ? "Page" : "Article"} “${e.title}”`,
      href: e.kind === "page" ? `/admin/pages/${e.id}` : `/admin/insights/${e.id}`,
      value: e.kind === "page" ? e.document : e.body,
    })),
    ...globalRows.map((row) => ({
      label: GLOBAL_LABELS[row.key as QaGlobal],
      href: `/admin/settings/${QA_GLOBALS[row.key as QaGlobal]}`,
      value: row.value,
    })),
    ...COLLECTION_NAMES.flatMap((name, index) =>
      collectionRows[index]!.map((row) => ({
        label: `${COLLECTION_LABELS[name]}: ${titleOf(name, row as Record<string, unknown>)}`,
        href: `/admin/collections/${name}`,
        value: row,
      }))
    ),
  ]
}

async function legalFindings(db: DbLike): Promise<QaFinding[]> {
  const rows = await db
    .select({ id: pages.id, path: pages.path, title: pages.title, status: pages.status })
    .from(pages)
    .where(inArray(pages.path, [...LEGAL_PATHS]))
  return LEGAL_PATHS.flatMap((path) => {
    const row = rows.find((r) => r.path === path)
    return row?.status === "published" ? [] : [legalFinding(path, row ?? null)]
  })
}

export async function getContentFindings(db: DbLike = getDb()): Promise<QaFinding[]> {
  const [sources, legal] = await Promise.all([loadSources(db), legalFindings(db)])
  return [...scanContent(sources), ...legal]
}
```

- [ ] **Step 8: Rewrite the service**

```ts
// server/modules/dashboard/service.ts
import "server-only"

import { format } from "date-fns"

import { hasPermission } from "@/lib/auth/permissions"
import { roleRequiresTwoFactor } from "@/lib/auth/two-factor-policy"
import type { QaFinding } from "@/lib/content/qa"
import type { Actor } from "@/server/auth/actor"
import { getSeoHealth } from "@/server/modules/seo/queries"
import { listLiveEntities } from "@/server/modules/seo/live"

import { contentGauge, type ContentGauge } from "./content-health"
import { getContentFindings } from "./content-qa"
import * as repo from "./repo"
import { DUBLIN, weekWindow } from "./week"

// (NextUpItem and DashboardDto exactly as in this task's Interfaces block.)

const DAY = 86_400_000
const FINDINGS_SHOWN = 10
const first = (name: string) => name.trim().split(/\s+/)[0] || "them"

function twoFactorStep(actor: Actor): NextUpItem {
  const required = roleRequiresTwoFactor(actor.roles)
  return {
    id: "two-factor",
    title: actor.twoFactorEnabled ? "Two-factor is on" : "Turn on two-factor",
    description: required
      ? "Required for your role. A code from your phone keeps your account safe even if your password leaks."
      : "Recommended. A code from your phone keeps your account safe even if your password leaks.",
    cta: "Set up two-factor",
    href: "/admin/two-factor-setup",
    done: actor.twoFactorEnabled,
  }
}

// docs/brief.md §9.3 Dashboard; RBAC per Ruling R3.
export async function getDashboard(actor: Actor, now: Date = new Date()): Promise<DashboardDto> {
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(actor.roles, p)
  const canLeads = can({ lead: ["read"] })
  const canArticles = can({ article: ["read"] })
  const canSeo = can({ seo: ["read"] })
  const canFix = can({ page: ["update"] })
  const canAudit = can({ audit: ["read"] })
  const canInvite = can({ user: ["create"] })
  const week = weekWindow(now)
  const monthAgo = new Date(now.getTime() - 30 * DAY)
  const twoMonthsAgo = new Date(now.getTime() - 60 * DAY)

  const [
    enquiries,
    enquiriesBefore,
    byDay,
    articleCounts,
    subscribers,
    oldest,
    scheduled,
    health,
    live,
    findings,
    recent,
    accounts,
  ] = await Promise.all([
    repo.enquiryCount(monthAgo, now),
    repo.enquiryCount(twoMonthsAgo, monthAgo),
    repo.enquiriesByDay(week.previousStart, week.end),
    repo.articleCounts(),
    repo.subscriberCounts(monthAgo),
    canLeads ? repo.oldestNewEnquiry() : null,
    canArticles ? repo.nextScheduledArticle() : null,
    canSeo ? getSeoHealth() : null,
    canSeo ? listLiveEntities() : null,
    canFix ? getContentFindings() : null,
    canAudit ? repo.recentAudit(8) : null,
    canInvite ? repo.accountCount() : null,
  ])

  const counts = new Map(byDay.map((row) => [row.day, row.count]))
  const days = week.days.map((day, index) => ({
    key: day.key,
    label: day.label,
    current: counts.get(day.key) ?? 0,
    previous: counts.get(week.previousDays[index]!.key) ?? 0,
  }))
  const sum = (key: "current" | "previous") => days.reduce((t, d) => t + d[key], 0)

  const nextUp: NextUpItem[] = []
  if (oldest) {
    nextUp.push({
      id: "enquiry",
      title: `Reply to ${first(oldest.name)}`,
      description: `Waiting since ${format(oldest.createdAt, "d MMM", { in: DUBLIN })}: the oldest enquiry nobody has contacted yet.`,
      cta: "Open enquiry",
      href: `/admin/leads?lead=${oldest.id}`,
      done: false,
    })
  }
  if (scheduled?.scheduledFor) {
    nextUp.push({
      id: "article",
      title: `“${scheduled.title}” goes live`,
      description: `Scheduled for ${format(scheduled.scheduledFor, "d MMM 'at' HH:mm", { in: DUBLIN })}. Give it a last read.`,
      cta: "Open article",
      href: `/admin/insights/${scheduled.id}`,
      done: false,
    })
  }
  nextUp.push(twoFactorStep(actor))
  if (canInvite) {
    nextUp.push({
      id: "invite",
      title: "Invite your team",
      description: "Give each person their own account and only the role they need.",
      cta: "Invite teammates",
      href: "/admin/users",
      done: (accounts ?? 0) > 1,
    })
  }

  return {
    generatedAt: now.toISOString(),
    enquiries: { value: enquiries, previous: enquiriesBefore },
    enquiriesWeek: { days, current: sum("current"), previous: sum("previous") },
    articles: articleCounts,
    subscribers,
    seoHealth: health
      ? { score: health.score, issues: health.issues.length }
      : null,
    contentHealth:
      health && live
        ? {
            ...contentGauge(health, live),
            findings: findings?.slice(0, FINDINGS_SHOWN) ?? null,
            findingsTotal: findings?.length ?? 0,
          }
        : null,
    recentActivity:
      recent?.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })) ?? null,
    nextUp,
  }
}
```

The fresh-install test expects `seoHealth.score === 100` with nothing live: `computeSeoHealth` already returns `100` when `total` is 0. Delete `activeAccounts`, `signInsByDay`, `distinctSignedIn`, `changeCount` from the repo (R1); `grep -rn "signInsByDay\|distinctSignedIn\|changeCount\|activeAccounts" server admin tests` must come back empty apart from this task's files.

- [ ] **Step 9: Run the tests**

Run: `pnpm vitest run --project unit lib/content server/modules/dashboard && pnpm vitest run --project integration tests/integration/api/dashboard.test.ts tests/integration/api/dashboard-content.test.ts tests/integration/api/permission-matrix.test.ts`
Expected: PASS.

- [ ] **Step 10: Lint, typecheck, commit**

`pnpm typecheck` now fails in `admin/modules/dashboard/dashboard-view.tsx` and `tests/e2e/fixtures/dashboard.ts` (they read the old DTO). Task 2 rewrites both; to keep this commit green, make the smallest compile fix and no more: change `DashboardBody` to `return <p className="text-sm text-muted-foreground">Updated {data.generatedAt}</p>`, drop the imports that become unused, and replace the fixture's object with `{} as DashboardDto`. No `@ts-expect-error`, no `any`.

Run: `pnpm lint && pnpm typecheck`

```bash
git add lib/content/qa.ts lib/content/qa.test.ts server/modules/dashboard/content-qa.ts \
  server/modules/dashboard/content-health.ts server/modules/dashboard/content-health.test.ts \
  server/modules/dashboard/repo.ts server/modules/dashboard/service.ts \
  tests/integration/api/dashboard.test.ts tests/integration/api/dashboard-content.test.ts \
  admin/modules/dashboard/dashboard-view.tsx tests/e2e/fixtures/dashboard.ts
git commit -m "feat(dashboard): enquiry, article, subscriber and content-health data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Dashboard screen — KPI row, enquiries chart, Next up, content health, New article

**Model:** sonnet

**Files:**
- Modify (rewrite): `admin/modules/dashboard/dashboard-view.tsx`, `tests/e2e/fixtures/dashboard.ts`
- Modify: `admin/modules/dashboard/present.ts`, `admin/modules/dashboard/present.test.ts`, `admin/modules/insights/articles-view.tsx`, `tests/e2e/admin/visual/shell.spec.ts`, `tests/e2e/admin/shell/dashboard.spec.ts`, `admin/modules/dashboard/dashboard-skeleton.tsx` (only if its grid no longer matches)
- Create: `tests/e2e/fixtures/notifications.ts`
- Re-record: `tests/e2e/__screenshots__/darwin/admin-{desktop,tablet,mobile}/dashboard-{light,dark}.png`

**Interfaces:**
- Consumes: `DashboardDto`, `NextUpItem` (Task 1, via `InferResponseType` in `admin/modules/dashboard/queries.ts`, unchanged), `KpiCard`, `DashboardCard`, `PillBarChart`, `Gauge`, `ActivityFeed`, `EmptyState`, `PageHeader`, `LINK_PRIMARY`, `LINK_SECONDARY`, `formatDelta`, `formatNumber` (`admin/components/dashboard/*`), `usePermission` (`admin/lib/actor-context.tsx`).
- Produces: `kpisFor(data: Dashboard, can: (p: Permissions) => boolean): KpiProps[]` and `setupSteps(items: NextUpItem[])` in `present.ts`; `NOTIFICATIONS_FIXTURE` (empty bell) in `tests/e2e/fixtures/notifications.ts`, used by Task 3's visual pinning. Task 3 types it once `NotificationsDto` exists; until then it is a plain object.

- [ ] **Step 1: Write the failing presenter tests**

Append to `admin/modules/dashboard/present.test.ts`:

```ts
import { kpisFor, setupSteps } from "./present"

const base = {
  generatedAt: "2026-10-09T10:00:00.000Z",
  enquiries: { value: 0, previous: 0 },
  enquiriesWeek: { days: [], current: 0, previous: 0 },
  articles: { published: 0, scheduled: 0 },
  subscribers: { confirmed: 0, newThisMonth: 0 },
  seoHealth: null,
  contentHealth: null,
  recentActivity: null,
  nextUp: [],
} as unknown as Parameters<typeof kpisFor>[0]

describe("kpisFor", () => {
  it("kpis caption zeros honestly and link only where the viewer may go", () => {
    const kpis = kpisFor(base, () => false)
    expect(kpis.map((k) => [k.label, k.value, k.caption, k.href])).toEqual([
      ["New enquiries", "0", "last 30 days", undefined],
      ["Published articles", "0", "none scheduled", undefined],
      ["Newsletter subscribers", "0", "0 new in 30 days", undefined],
    ])
  })

  it("compares enquiries, adds SEO health and links for an owner", () => {
    const kpis = kpisFor(
      { ...base, enquiries: { value: 12, previous: 8 }, articles: { published: 7, scheduled: 1 }, seoHealth: { score: 92, issues: 1 } },
      () => true
    )
    expect(kpis[0]).toMatchObject({ caption: "vs the 30 days before", href: "/admin/leads", variant: "hero" })
    expect(kpis[1]).toMatchObject({ caption: "1 scheduled", href: "/admin/insights" })
    expect(kpis[3]).toMatchObject({ label: "SEO health", value: "92%", caption: "1 issue to fix", href: "/admin/seo" })
  })
})

describe("setupSteps", () => {
  it("keeps only the two setup steps for the checklist", () => {
    const step = (id: string) => ({ id, title: id, description: "", cta: "", href: "", done: false })
    expect(setupSteps([step("enquiry"), step("two-factor"), step("invite")] as never).map((s) => s.id)).toEqual([
      "two-factor",
      "invite",
    ])
  })
})
```

Run: `pnpm vitest run --project unit admin/modules/dashboard/present.test.ts` → FAIL (`kpisFor` is not exported).

- [ ] **Step 2: Implement the presenters**

Add to `admin/modules/dashboard/present.ts`:

```ts
import { formatDelta, formatNumber, type Delta } from "@/admin/components/dashboard/format"
import type { Permissions } from "@/lib/auth/permissions"

import type { Dashboard } from "./queries"

export type KpiProps = {
  label: string
  value: string
  caption: string
  delta: Delta | null
  href?: string
  variant?: "hero" | "default"
}

const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`

// docs/brief.md §9.3 KPI row. Links appear only when the viewer can open
// the page behind them (Ruling R3).
export function kpisFor(data: Dashboard, can: (p: Permissions) => boolean): KpiProps[] {
  const enquiryDelta = formatDelta(data.enquiries.value, data.enquiries.previous)
  const link = (allowed: boolean, href: string) => (allowed ? { href } : {})
  const kpis: KpiProps[] = [
    {
      label: "New enquiries",
      value: formatNumber(data.enquiries.value),
      delta: enquiryDelta,
      caption: enquiryDelta ? "vs the 30 days before" : "last 30 days",
      variant: "hero",
      ...link(can({ lead: ["read"] }), "/admin/leads"),
    },
    {
      label: "Published articles",
      value: formatNumber(data.articles.published),
      delta: null,
      caption: data.articles.scheduled ? `${formatNumber(data.articles.scheduled)} scheduled` : "none scheduled",
      ...link(can({ article: ["read"] }), "/admin/insights"),
    },
    {
      label: "Newsletter subscribers",
      value: formatNumber(data.subscribers.confirmed),
      delta: null,
      caption: `${formatNumber(data.subscribers.newThisMonth)} new in 30 days`,
      ...link(can({ newsletter: ["read"] }), "/admin/newsletter"),
    },
  ]
  if (data.seoHealth) {
    kpis.push({
      label: "SEO health",
      value: `${data.seoHealth.score}%`,
      delta: null,
      caption: data.seoHealth.issues ? `${plural(data.seoHealth.issues, "issue", "issues")} to fix` : "nothing to fix",
      href: "/admin/seo",
    })
  }
  return kpis
}

const SETUP = new Set(["two-factor", "invite"])
export const setupSteps = (items: Dashboard["nextUp"]) => items.filter((item) => SETUP.has(item.id))
```

Extend `ACTION_LABELS` with `"article.publish": "Published"`, `"page.publish": "Published"`, `"user.role": "Role changed"`, `"lead.update": "Updated"` so the feed's status pills cover the actions owners see most. Run the presenter test → PASS.

- [ ] **Step 3: Rewrite the view**

Replace `DashboardView`'s header actions and `DashboardBody` in `admin/modules/dashboard/dashboard-view.tsx` (keep the file's loading/error structure and the greeting):

```tsx
// Header actions (docs/brief.md §9.3: "New article" / "View site").
const canWrite = usePermission({ article: ["create"] })
…
actions={
  <>
    {canWrite ? (
      <Link href="/admin/insights?new=1" data-slot="button" className={LINK_PRIMARY}>
        <PlusIcon data-icon="inline-start" />
        New article
      </Link>
    ) : null}
    <a href={siteUrl} target="_blank" rel="noreferrer" data-slot="button" className={LINK_SECONDARY}>
      View site
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  </>
}
```

```tsx
function DashboardBody({ data }: { data: Dashboard }) {
  const actor = useActor()
  const can = (p: Permissions) => hasPermission(actor.roles, p)
  const now = Date.parse(data.generatedAt)
  const kpis = kpisFor(data, can)
  const next = data.nextUp.find((item) => !item.done)
  const steps = setupSteps(data.nextUp)
  const quiet = data.enquiriesWeek.current === 0 && data.enquiriesWeek.previous === 0
  const health = data.contentHealth

  return (
    <>
      <h2 className="sr-only">Key figures</h2>
      <div className={cn("grid gap-4 sm:grid-cols-2", kpis.length > 3 ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <DashboardCard title="Enquiries this week">
          <div className="relative">
            <PillBarChart
              title="Enquiries this week"
              data={data.enquiriesWeek.days}
              currentLabel="This week"
              previousLabel="Last week"
            />
            {quiet ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex h-64 flex-col items-center justify-center gap-1 text-center">
                <p className="text-base font-semibold">No enquiries yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Each day&apos;s enquiries this week and last will show here.
                </p>
              </div>
            ) : null}
          </div>
        </DashboardCard>
        <DashboardCard title="Next up">
          {/* Same structure as Phase 2: headline = first item not done;
              the checklist lists only the setup steps, when there are two. */}
          …existing headline / description markup using `next`…
          {steps.length > 1 ? (
            <ul aria-label="Setup checklist" className="flex flex-col gap-2">
              {steps.map((item) => …existing <li> markup…)}
            </ul>
          ) : null}
          …existing CTA link using `next`…
        </DashboardCard>
      </div>
      {data.recentActivity || health ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          {data.recentActivity ? (
            <DashboardCard title="Team activity">…existing ActivityFeed, emptyDescription "Publishing, enquiries and sign-ins by your team will show here."…</DashboardCard>
          ) : null}
          {health ? (
            <DashboardCard title="Content health">
              <Gauge
                title="Content health"
                centerLabel="Complete"
                headlineKey="complete"
                parts={[
                  { key: "complete", label: "Complete", value: health.complete, tone: "solid" },
                  { key: "work", label: "Needs work", value: health.needsWork, tone: "dark" },
                  { key: "missing", label: "Missing SEO or alt", value: health.missing, tone: "hatched" },
                ]}
              />
              {health.findings?.length ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">
                    Content to review ({formatNumber(health.findingsTotal)})
                  </h3>
                  <ul aria-label="Content findings" className="flex flex-col gap-2 text-sm">
                    {health.findings.map((finding) => (
                      <li key={`${finding.rule}:${finding.href}:${finding.label}`}>
                        <Link href={finding.href} className="font-medium underline-offset-4 hover:underline">
                          {finding.label}
                        </Link>
                        <span className="block text-muted-foreground">{finding.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </DashboardCard>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
```

Imports: `PlusIcon` (lucide), `useActor` (`@/admin/lib/actor-context`), `hasPermission`, `type Permissions` (`@/lib/auth/permissions`), `kpisFor`, `setupSteps` (`./present`); drop `UserPlusIcon`, `formatShare`, `compare()`. The "…existing…" markers mean: keep that block of the current file verbatim (it is shown in full in the current `dashboard-view.tsx`, lines 198–246 and 250–264); only the data it reads changes as described.

- [ ] **Step 4: Open the new-article dialog from `?new=1`**

In `admin/modules/insights/articles-view.tsx`, initialise the dialog from the URL and clear the flag on close, with nuqs (already used across the admin):

```tsx
import { parseAsBoolean, useQueryState } from "nuqs"
…
const [newParam, setNewParam] = useQueryState("new", parseAsBoolean.withDefault(false))
const [creating, setCreatingState] = useState(newParam && canCreate)
const setCreating = (open: boolean) => {
  setCreatingState(open)
  if (!open && newParam) void setNewParam(null)
}
```

Replace the existing `const [creating, setCreating] = useState(false)` (line ~157). `canCreate` must be defined above this line; move the line below it if needed.

- [ ] **Step 5: New fixtures, visual pinning, E2E expectations**

Rewrite `tests/e2e/fixtures/dashboard.ts` with the same header comment and the new shape — `generatedAt: "2026-10-09T10:00:00.000Z"`; `enquiries: { value: 12, previous: 9 }`; `enquiriesWeek` with the seven 2026-10-05…11 days (current 2,3,1,4,2,0,0 / previous 1,2,2,3,1,1,0, totals 12 and 10); `articles: { published: 7, scheduled: 1 }`; `subscribers: { confirmed: 148, newThisMonth: 11 }`; `seoHealth: { score: 92, issues: 4 }`; `contentHealth: { complete: 9, needsWork: 3, missing: 2, total: 14, findingsTotal: 3, findings: [three findings: rebrand / "Page “About”" / "/admin/pages/p-about", placeholder-contact / "Footer" / "/admin/settings/footer", legal-unpublished / "Privacy Policy" / "/admin/pages/p-privacy"] }`; the existing four `recentActivity` rows with one changed to `action: "article.publish", summary: "Published “Calm is a skill”"`; `nextUp`: `enquiry` ("Reply to Aoife", not done), `two-factor` (done), `invite` (done). Type it `satisfies DashboardDto`.

```ts
// tests/e2e/fixtures/notifications.ts
// Pins the bell for screenshots: nothing unread, so no badge.
export const NOTIFICATIONS_FIXTURE = {
  items: [],
  unread: 0,
  seenAt: "2026-10-09T10:00:00.000Z",
}
```

In `tests/e2e/admin/visual/shell.spec.ts`, add to the existing `beforeEach`:

```ts
await page.route("**/api/v1/admin/notifications", (route) =>
  route.fulfill({ json: NOTIFICATIONS_FIXTURE })
)
```

and change the dashboard test's wait from "Team activity has 4 list items" (still true) plus `await expect(page.getByRole("list", { name: "Content findings" }).getByRole("listitem")).toHaveCount(3)`. Update the file's header comment: titles keep "visual:" and run in CI's `visual` job from Task 5.

Rewrite `tests/e2e/admin/shell/dashboard.spec.ts` expectations (same structure, same storage states):
- owner: greeting `/, Sam$/`; `page.getByRole("article")` count **4**; regions "Enquiries this week", "Next up", "Team activity", "Content health" visible; link "New article" visible; "Setup checklist" list has 2 items.
- viewer: 4 articles (viewers hold `seo.read`); "Content health" region visible, "Content findings" list count 0; "Team activity" count 0; link "New article" count 0; "Turn on two-factor" text count 1; "Recommended." visible; the existing two-factor link test unchanged.
- add `as intake`: 3 articles; regions "Content health" and "Team activity" count 0.
- add `as an editor` (`STORAGE.editor`): click "New article" → URL `/admin/insights?new=1` and `page.getByRole("dialog", { name: "New article" })` visible.

- [ ] **Step 6: Re-record the darwin dashboard baselines from a clean HEAD**

The working tree holds the user's uncommitted shell edits, which would leak into the baseline. Commit Steps 1–5 first (Step 7), then:

```bash
git worktree add ../mk-baselines HEAD
cd ../mk-baselines && pnpm install --frozen-lockfile && pnpm db:up
pnpm build && E2E_SKIP_BUILD=1 pnpm test:e2e tests/e2e/admin/visual --project=admin-desktop --project=admin-tablet --project=admin-mobile --grep "visual: dashboard" --update-snapshots
for p in desktop tablet mobile; do
  cp tests/e2e/__screenshots__/darwin/admin-$p/dashboard-*.png ../james-whitfield/tests/e2e/__screenshots__/darwin/admin-$p/
done
cd ../james-whitfield && git worktree remove ../mk-baselines --force
```

Open the six PNGs and check them by eye: four KPI cards, the pill chart with hatched last-week bars, "Reply to Aoife" in Next up, the gauge with three findings beneath it, light and dark.

- [ ] **Step 7: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm vitest run --project unit admin/modules/dashboard && DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build && E2E_SKIP_BUILD=1 pnpm test:e2e tests/e2e/admin/shell/dashboard.spec.ts --project=admin-desktop`
Expected: PASS.

```bash
git add admin/modules/dashboard/dashboard-view.tsx admin/modules/dashboard/present.ts \
  admin/modules/dashboard/present.test.ts admin/modules/insights/articles-view.tsx \
  tests/e2e/fixtures/dashboard.ts tests/e2e/fixtures/notifications.ts \
  tests/e2e/admin/visual/shell.spec.ts tests/e2e/admin/shell/dashboard.spec.ts
git commit -m "feat(dashboard): real KPIs, enquiries chart, next up and content health

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
# after Step 6:
git add tests/e2e/__screenshots__/darwin/admin-desktop/dashboard-light.png \
  tests/e2e/__screenshots__/darwin/admin-desktop/dashboard-dark.png \
  tests/e2e/__screenshots__/darwin/admin-tablet/dashboard-light.png \
  tests/e2e/__screenshots__/darwin/admin-tablet/dashboard-dark.png \
  tests/e2e/__screenshots__/darwin/admin-mobile/dashboard-light.png \
  tests/e2e/__screenshots__/darwin/admin-mobile/dashboard-dark.png
git commit -m "test(dashboard): re-record darwin dashboard baselines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Notifications — `notificationsSeenAt`, derived feed, bell

**Model:** opus

**Files:**
- Modify: `server/db/schema/auth.ts` (users column), `server/db/schema/audit.ts` (index), `server/auth/auth.ts` (`user.additionalFields`), `server/api/routes/admin.ts`, `admin/lib/api.ts`, `admin/lib/query-keys.ts`, `tests/e2e/fixtures/notifications.ts` (type it)
- Create: `server/db/migrations/0010_notifications.sql` (+ `meta/0010_snapshot.json`, `_journal.json`), `lib/notifications.ts`, `server/modules/notifications/service.ts`, `server/modules/notifications/routes.ts`, `admin/modules/notifications/queries.ts`, `admin/modules/notifications/notifications-bell.tsx`, `admin/modules/notifications/notifications-bell.test.tsx`, `tests/integration/api/notifications.test.ts`, `tests/e2e/admin/content/notifications.spec.ts`
- Modify (**controller coordinates with user**, R8): `admin/components/shell/notifications-button.tsx`

**Interfaces:**
- Consumes: `can`, `notViewingAs` (`server/api/middleware/{auth,view-as}.ts`), `hasPermission`, `type Permissions`, `Actor`, `relativeTime` (`admin/components/dashboard/format.ts`), `parseResponse` (`admin/lib/api.ts`), `Popover*`, `ScrollArea`, `Button`, `ICON_BUTTON` (`admin/components/shell/constants`, read-only import).
- Produces:
  - `lib/notifications.ts`: `NOTIFICATION_KINDS`, `type NotificationKind`, `type NotificationItem = { id: string; kind: NotificationKind; title: string; description: string; href: string; at: string; unread: boolean }`, `type NotificationsDto = { items: NotificationItem[]; unread: number; seenAt: string }`, `badgeText(unread: number): string`, `POLL_MS = 60_000`, `NOTIFICATION_LIMIT = 20`, `NOTIFICATION_WINDOW_DAYS = 30`.
  - `server/modules/notifications/service.ts`: `listNotifications(actor: Actor, now?: Date): Promise<NotificationsDto>`, `markSeen(actor: Actor, now?: Date): Promise<{ seenAt: string }>`.
  - `server/modules/notifications/routes.ts`: `notificationsRoutes`, `type NotificationsRoutes` (`GET /`, `POST /seen`), mounted at `/api/v1/admin/notifications`.
  - `admin/modules/notifications/notifications-bell.tsx`: `NotificationsBell({ className }: { className?: string })`.

- [ ] **Step 1: Schema, Better Auth field and migration**

```ts
// server/db/schema/auth.ts — inside the users table, after twoFactorEnabled.
// Phase 11 (Ruling R7): declared in server/auth/auth.ts user.additionalFields
// too, so `pnpm auth:generate` keeps it.
  notificationsSeenAt: timestamp("notifications_seen_at", { withTimezone: true }),
```

```ts
// server/db/schema/audit.ts — add to the index list.
    // The bell and the dashboard read rows by action and recency.
    index("audit_logs_action_created_idx").on(table.action, table.createdAt.desc()),
```

```ts
// server/auth/auth.ts — add to the betterAuth({ … }) options.
    user: {
      additionalFields: {
        // The bell's "seen" instant (Ruling R7). Never accepted from a
        // client and never sent back in session payloads.
        notificationsSeenAt: {
          type: "date",
          required: false,
          input: false,
          returned: false,
        },
      },
    },
```

Confirm `returned` exists in `node_modules/better-auth/dist/**/types` for `additionalFields` (`grep -rn "returned?:" node_modules/better-auth/dist --include=*.d.mts | head`); if it does not in 1.7.7, drop that one key.

Run: `pnpm db:generate --name notifications`
Expected: `server/db/migrations/0010_notifications.sql` containing exactly `ALTER TABLE "users" ADD COLUMN "notifications_seen_at" timestamp with time zone;` and `CREATE INDEX "audit_logs_action_created_idx" ON "audit_logs" USING btree ("action","created_at" DESC NULLS LAST);`. Anything else in the diff means the schema drifted — stop and report.

- [ ] **Step 2: Write the failing integration tests**

```ts
// tests/integration/api/notifications.test.ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, leadActivities, users } from "@/server/db/schema"

import { adminRequest, cookieFor, createUser, signIn, viewAs } from "../helpers/auth"
import { resetDb } from "../helpers/db"
import { insertLead } from "../helpers/leads"

beforeEach(resetDb)
afterAll(closeDb)

const DAY = 86_400_000
const ago = (ms: number) => new Date(Date.now() - ms)

async function bell(cookie: string) {
  const response = await adminRequest("/notifications", cookie)
  expect(response.status).toBe(200)
  return response.json()
}

async function seedEverything(submitterId: string | null = null) {
  const lead = await insertLead({ name: "Nora Byrne", createdAt: ago(60_000) })
  await insertLead({ status: "spam", email: "spam@example.com", createdAt: ago(60_000) })
  await getDb().insert(leadActivities).values({
    leadId: lead.id,
    type: "email",
    data: { kind: "auto-reply", status: "failed", error: "unknown" },
  })
  const row = (action: string, actorId: string | null = null) => ({
    action,
    actorId,
    entityType: action.startsWith("tracking") ? "setting" : "article",
    entityId: "a1",
    summary: `${action} summary`,
    createdAt: ago(30_000),
  })
  await getDb().insert(auditLogs).values([
    row("article.publish"),
    row("article.schedule_failed"),
    row("article.submit", submitterId),
    row("tracking.capi_failed"),
  ])
  return lead
}

const kinds = (body: { items: { kind: string }[] }) => body.items.map((i) => i.kind).sort()

describe("GET /api/v1/admin/notifications", () => {
  it("each role gets only the items its permissions allow (Ruling R6)", async () => {
    const author = await createUser("author", "writer@example.com")
    await seedEverything(author.id)
    // Make every account old enough that the items are unread.
    const expect_ = async (role: Parameters<typeof cookieFor>[0], expected: string[]) => {
      const cookie = await cookieFor(role)
      await getDb().update(users).set({ createdAt: ago(DAY) })
      expect(kinds(await bell(cookie)), role).toEqual(expected.sort())
    }
    await expect_("intake", ["enquiry", "delivery_failed"])
    await expect_("marketer", ["capi_failed", "published"])
    await expect_("editor", ["published", "schedule_failed", "review_requested"])
    await expect_("viewer", ["published"])
    await expect_("owner", [
      "capi_failed",
      "delivery_failed",
      "enquiry",
      "published",
      "review_requested",
      "schedule_failed",
    ])
  })

  it("never shows a spam lead, and names the enquirer by first name only", async () => {
    const lead = await seedEverything()
    const cookie = await cookieFor("intake")
    await getDb().update(users).set({ createdAt: ago(DAY) })
    const enquiry = (await bell(cookie)).items.find((i: { kind: string }) => i.kind === "enquiry")
    expect(enquiry).toMatchObject({
      title: "New enquiry",
      description: "From Nora",
      href: `/admin/leads?lead=${lead.id}`,
      unread: true,
    })
    expect(JSON.stringify(await bell(cookie))).not.toContain("Byrne")
  })

  it("a review request is not shown to the person who submitted it", async () => {
    const owner = await createUser("owner", "boss@example.com")
    await seedEverything(owner.id)
    const cookie = await cookieFor("editor")
    expect(kinds(await bell(cookie))).not.toContain("review_requested")
  })

  it("a new account starts with nothing unread", async () => {
    await seedEverything()
    const body = await bell(await cookieFor("owner"))
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.unread).toBe(0)
  })

  it("keeps 30 days and the newest 20", async () => {
    for (let i = 0; i < 25; i++) {
      await insertLead({ email: `p${i}@example.com`, createdAt: ago(i * 60_000 + 1_000) })
    }
    await insertLead({ email: "old@example.com", createdAt: ago(31 * DAY) })
    const cookie = await cookieFor("intake")
    await getDb().update(users).set({ createdAt: ago(40 * DAY) })
    const body = await bell(cookie)
    expect(body.items).toHaveLength(20)
    expect(body.unread).toBe(20)
    expect(Date.parse(body.items[0].at)).toBeGreaterThan(Date.parse(body.items[19].at))
  })

  it("POST /seen clears unread until something newer arrives", async () => {
    await seedEverything()
    const cookie = await cookieFor("intake")
    await getDb().update(users).set({ createdAt: ago(DAY) })
    expect((await bell(cookie)).unread).toBe(2)

    const seen = await adminRequest("/notifications/seen", cookie, { method: "POST" })
    expect(seen.status).toBe(200)
    expect((await bell(cookie)).unread).toBe(0)

    await insertLead({ email: "later@example.com", createdAt: new Date(Date.now() + 1_000) })
    expect((await bell(cookie)).unread).toBe(1)
  })

  it("View-as never marks notifications read (Ruling R9)", async () => {
    await seedEverything()
    const intake = await createUser("intake", "ivy@example.com")
    await getDb().update(users).set({ createdAt: ago(DAY) }).where(eq(users.id, intake.id))
    const owner = await cookieFor("owner")
    const viewing = await viewAs(owner, intake.id)

    expect((await bell(viewing)).unread).toBe(2)
    const refused = await adminRequest("/notifications/seen", viewing, { method: "POST" })
    expect(refused.status).toBe(403)
    expect((await refused.json()).error.code).toBe("IMPERSONATION_READ_ONLY")
    expect((await bell(await signIn("ivy@example.com"))).unread).toBe(2)
  })
})
```

If `viewAs(cookie, userId)` returns a response or a cookie under another name, adapt to its real signature in `tests/integration/helpers/auth.ts` (it was read while writing this plan: `viewAs(cookie, userId)` starts View-as server-side with `asResponse: true`). If `adminRequest` needs an `origin` for POST, pass `{ method: "POST", origin: ORIGIN }` as other POST tests do.

Run: `pnpm vitest run --project integration tests/integration/api/notifications.test.ts` → FAIL (404).

- [ ] **Step 3: Implement the shared types and the service**

```ts
// lib/notifications.ts
// The admin bell (docs/brief.md §9.1, §12.5; Ruling R6). Isomorphic.
export const NOTIFICATION_KINDS = [
  "enquiry",
  "delivery_failed",
  "published",
  "schedule_failed",
  "review_requested",
  "capi_failed",
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]
export type NotificationItem = {
  id: string
  kind: NotificationKind
  title: string
  description: string
  href: string
  at: string
  unread: boolean
}
export type NotificationsDto = {
  items: NotificationItem[]
  unread: number
  seenAt: string
}

export const POLL_MS = 60_000
export const NOTIFICATION_LIMIT = 20
export const NOTIFICATION_WINDOW_DAYS = 30

export const badgeText = (unread: number) => (unread > 9 ? "9+" : String(unread))
```

```ts
// server/modules/notifications/service.ts
import "server-only"

import { and, desc, eq, gte, isNull, ne, or, sql, type SQL } from "drizzle-orm"

import { hasPermission, type Permissions } from "@/lib/auth/permissions"
import {
  NOTIFICATION_LIMIT,
  NOTIFICATION_WINDOW_DAYS,
  type NotificationItem,
  type NotificationKind,
  type NotificationsDto,
} from "@/lib/notifications"
import type { Actor } from "@/server/auth/actor"
import { getDb } from "@/server/db/client"
import { auditLogs, leadActivities, leads, users } from "@/server/db/schema"

type Draft = Omit<NotificationItem, "unread" | "at"> & { at: Date }

type AuditSource = {
  action: string
  kind: NotificationKind
  title: string
  needs: Permissions
  href: (entityId: string | null) => string
  where?: (actor: Actor) => SQL | undefined
}

const article = (id: string | null) => (id ? `/admin/insights/${id}` : "/admin/insights")

const AUDIT_SOURCES: AuditSource[] = [
  {
    action: "article.publish",
    kind: "published",
    title: "Article went live",
    needs: { article: ["read"] },
    href: article,
    // Only the scheduler publishes without an actor.
    where: () => isNull(auditLogs.actorId),
  },
  {
    action: "article.schedule_failed",
    kind: "schedule_failed",
    title: "A scheduled article wasn't published",
    needs: { article: ["update"] },
    href: article,
  },
  {
    action: "article.submit",
    kind: "review_requested",
    title: "Review requested",
    needs: { article: ["publish"] },
    href: article,
    where: (actor) => or(isNull(auditLogs.actorId), ne(auditLogs.actorId, actor.userId)),
  },
  {
    action: "tracking.capi_failed",
    kind: "capi_failed",
    title: "Meta Conversions API failed",
    needs: { tracking: ["read"] },
    href: () => "/admin/marketing",
  },
]

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "someone"

async function leadItems(since: Date): Promise<Draft[]> {
  const rows = await getDb()
    .select({ id: leads.id, name: leads.name, createdAt: leads.createdAt })
    .from(leads)
    .where(and(ne(leads.status, "spam"), gte(leads.createdAt, since)))
    .orderBy(desc(leads.createdAt))
    .limit(NOTIFICATION_LIMIT)
  return rows.map((row) => ({
    id: `lead:${row.id}`,
    kind: "enquiry",
    title: "New enquiry",
    description: `From ${firstName(row.name)}`,
    href: `/admin/leads?lead=${row.id}`,
    at: row.createdAt,
  }))
}

async function deliveryItems(since: Date): Promise<Draft[]> {
  const rows = await getDb()
    .select({
      id: leadActivities.id,
      leadId: leadActivities.leadId,
      kind: sql<string>`${leadActivities.data}->>'kind'`,
      createdAt: leadActivities.createdAt,
    })
    .from(leadActivities)
    .where(
      and(
        eq(leadActivities.type, "email"),
        sql`${leadActivities.data}->>'status' = 'failed'`,
        gte(leadActivities.createdAt, since)
      )
    )
    .orderBy(desc(leadActivities.createdAt))
    .limit(NOTIFICATION_LIMIT)
  return rows.map((row) => ({
    id: `email:${row.id}`,
    kind: "delivery_failed",
    title: "An enquiry email didn't send",
    description:
      row.kind === "auto-reply"
        ? "The auto-reply to the enquirer failed"
        : "The notification to the practice failed",
    href: `/admin/leads?lead=${row.leadId}`,
    at: row.createdAt,
  }))
}

async function auditItems(actor: Actor, since: Date): Promise<Draft[]> {
  const allowed = AUDIT_SOURCES.filter((s) => hasPermission(actor.roles, s.needs))
  if (!allowed.length) return []
  const rows = await getDb()
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityId: auditLogs.entityId,
      summary: auditLogs.summary,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(
      and(
        gte(auditLogs.createdAt, since),
        or(...allowed.map((s) => and(eq(auditLogs.action, s.action), s.where?.(actor))))
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(NOTIFICATION_LIMIT)
  return rows.map((row) => {
    const source = allowed.find((s) => s.action === row.action)!
    return {
      id: `audit:${row.id}`,
      kind: source.kind,
      title: source.title,
      description: row.summary,
      href: source.href(row.entityId),
      at: row.createdAt,
    }
  })
}

async function seenAtOf(actor: Actor) {
  const [row] = await getDb()
    .select({ seen: users.notificationsSeenAt, created: users.createdAt })
    .from(users)
    .where(eq(users.id, actor.userId))
  // A new account has seen everything that happened before it existed.
  return row?.seen ?? row?.created ?? new Date(0)
}

export async function listNotifications(actor: Actor, now: Date = new Date()): Promise<NotificationsDto> {
  const since = new Date(now.getTime() - NOTIFICATION_WINDOW_DAYS * 86_400_000)
  const canLeads = hasPermission(actor.roles, { lead: ["read"] })
  const [seenAt, ...groups] = await Promise.all([
    seenAtOf(actor),
    canLeads ? leadItems(since) : [],
    canLeads ? deliveryItems(since) : [],
    auditItems(actor, since),
  ])
  const items = groups
    .flat()
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, NOTIFICATION_LIMIT)
    .map((item) => ({ ...item, at: item.at.toISOString(), unread: item.at > seenAt }))
  return {
    items,
    unread: items.filter((item) => item.unread).length,
    seenAt: seenAt.toISOString(),
  }
}

// Personal UI state, so not audited (Ruling R6).
export async function markSeen(actor: Actor, now: Date = new Date()) {
  await getDb().update(users).set({ notificationsSeenAt: now }).where(eq(users.id, actor.userId))
  return { seenAt: now.toISOString() }
}
```

`users.updatedAt` has `$onUpdate`, so marking seen bumps it; nothing reads `users.updated_at` as activity (Phase 10 R5 uses sessions and `auth.sign_in` rows), so that is harmless.

```ts
// server/modules/notifications/routes.ts
import "server-only"

import { Hono } from "hono"

import { can } from "@/server/api/middleware/auth"
import { notViewingAs } from "@/server/api/middleware/view-as"
import type { AppEnv } from "@/server/api/types"

import { listNotifications, markSeen } from "./service"

export const notificationsRoutes = new Hono<AppEnv>()
  .get("/", can({ dashboard: ["view"] }), async (c) =>
    c.json(await listNotifications(c.get("actor")!))
  )
  .post(
    "/seen",
    can({ dashboard: ["view"] }),
    notViewingAs("Viewing as someone never marks their notifications as read"),
    async (c) => c.json(await markSeen(c.get("actor")!))
  )

export type NotificationsRoutes = typeof notificationsRoutes
```

Mount in `server/api/routes/admin.ts` after `/dashboard`: `.route("/notifications", notificationsRoutes)` (import it with the others).

Run: `pnpm vitest run --project integration tests/integration/api/notifications.test.ts tests/integration/api/permission-matrix.test.ts` → PASS. If `permission-matrix.test.ts` enumerates every admin route and now fails because `/notifications` is unlisted, add both endpoints there with `dashboard.view` for every role.

- [ ] **Step 4: Write the failing bell test**

```tsx
// admin/modules/notifications/notifications-bell.test.tsx
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { NotificationsDto } from "@/lib/notifications"

import { NotificationsBell } from "./notifications-bell"
import { notificationsQuery } from "./queries"

const dto = (unread: number): NotificationsDto => ({
  seenAt: "2026-10-09T09:00:00.000Z",
  unread,
  items: Array.from({ length: Math.max(unread, 1) }, (_, i) => ({
    id: `lead:${i}`,
    kind: "enquiry",
    title: "New enquiry",
    description: `From Person ${i}`,
    href: `/admin/leads?lead=${i}`,
    at: "2026-10-09T09:30:00.000Z",
    unread: i < unread,
  })),
})

function stubApi(first: NotificationsDto) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = url.endsWith("/seen") ? { seenAt: "2026-10-09T10:00:00.000Z" } : first
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

const renderBell = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsBell />
    </QueryClientProvider>
  )

describe("NotificationsBell", () => {
  it("polls every 60 seconds", () => {
    expect(notificationsQuery().refetchInterval).toBe(60_000)
  })

  it("opening the bell marks everything read and drops the badge", async () => {
    const fetch = stubApi(dto(2))
    renderBell()
    const bell = await screen.findByRole("button", { name: "Notifications (2 unread)" })
    await userEvent.click(bell)
    expect(await screen.findByRole("link", { name: /From Person 0/ })).toBeTruthy()
    expect(fetch.mock.calls.some(([url, init]) => String(url).endsWith("/seen") && init?.method === "POST")).toBe(true)
    expect(await screen.findByRole("button", { name: "Notifications" })).toBeTruthy()
    // What was new when the bell opened stays marked while it is open.
    expect(screen.getAllByText("(new)")).toHaveLength(2)
  })

  it("caps the badge at 9+ and does not post when nothing is unread", async () => {
    stubApi(dto(12))
    renderBell()
    expect(await screen.findByRole("button", { name: "Notifications (9+ unread)" })).toBeTruthy()
  })

  it("shows the empty state", async () => {
    const fetch = stubApi({ seenAt: "2026-10-09T09:00:00.000Z", unread: 0, items: [] })
    renderBell()
    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }))
    expect(await screen.findByText(/all caught up/)).toBeTruthy()
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/seen"))).toBe(false)
  })
})
```

`next/link` renders in jsdom without a router for these assertions (other admin tests render links); if it throws, add `vi.mock("next/link", …)` returning a plain `<a>`.

Run: `pnpm vitest run --project unit admin/modules/notifications` → FAIL.

- [ ] **Step 5: Implement the client**

```ts
// admin/lib/api.ts — with the other clients:
import type { NotificationsRoutes } from "@/server/modules/notifications/routes"
export const notificationsApi = hc<NotificationsRoutes>("/api/v1/admin/notifications")

// admin/lib/query-keys.ts — inside queryKeys, after dashboard:
  notifications: ["notifications"] as const,
```

```ts
// admin/modules/notifications/queries.ts
import { queryOptions } from "@tanstack/react-query"

import { notificationsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { POLL_MS } from "@/lib/notifications"

// Polled every 60 s while the tab is visible (docs/plan.md Phase 11 item 2).
export const notificationsQuery = () =>
  queryOptions({
    queryKey: queryKeys.notifications,
    queryFn: () => parseResponse(notificationsApi.index.$get()),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  })
```

```tsx
// admin/modules/notifications/notifications-bell.tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BellIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { relativeTime } from "@/admin/components/dashboard/format"
import { notificationsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { badgeText, type NotificationsDto } from "@/lib/notifications"
import { cn } from "@/lib/utils"

import { notificationsQuery } from "./queries"

// The bell (docs/brief.md §9.1). Opening it marks everything read for this
// person; what was new at that moment stays marked until it closes.
export function NotificationsBell({ className }: { className?: string }) {
  const client = useQueryClient()
  const { data, dataUpdatedAt } = useQuery(notificationsQuery())
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  const seen = useMutation({
    mutationFn: () => parseResponse(notificationsApi.seen.$post()),
    onSuccess: ({ seenAt }) =>
      client.setQueryData<NotificationsDto>(queryKeys.notifications, (old) =>
        old && { seenAt, unread: 0, items: old.items.map((item) => ({ ...item, unread: false })) }
      ),
    // View-as refuses (Ruling R9): nothing to undo.
    onError: () => {},
  })
  const unread = data?.unread ?? 0

  function onOpenChange(open: boolean) {
    if (!open) return
    setFresh(new Set(data?.items.filter((item) => item.unread).map((item) => item.id)))
    if (unread > 0) seen.mutate()
  }

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className={cn("relative", className)}
            aria-label={unread ? `Notifications (${badgeText(unread)} unread)` : "Notifications"}
          />
        }
      >
        <BellIcon />
        {unread ? (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 min-w-5 rounded-full bg-primary px-1 text-center text-[11px] leading-5 font-semibold text-primary-foreground"
          >
            {badgeText(unread)}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <PopoverHeader className="border-b px-4 py-3">
          <PopoverTitle>Notifications</PopoverTitle>
        </PopoverHeader>
        <ScrollArea className="max-h-80">
          {data?.items.length ? (
            <ul aria-label="Notifications" className="flex flex-col py-1">
              {data.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex flex-col gap-0.5 px-4 py-2.5 text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {fresh.has(item.id) ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" /> : null}
                      {item.title}
                      {fresh.has(item.id) ? <span className="sr-only"> (new)</span> : null}
                    </span>
                    <span className="text-muted-foreground">{item.description}</span>
                    <time dateTime={item.at} className="text-xs text-muted-foreground">
                      {relativeTime(item.at, dataUpdatedAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up. New enquiries, posts going live and failed deliveries will show here.
            </p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
```

The test's `getAllByText("(new)")` matches the `sr-only` spans (Testing Library ignores CSS); keep that text exactly. Type `tests/e2e/fixtures/notifications.ts` with `satisfies NotificationsDto`.

Run: `pnpm vitest run --project unit admin/modules/notifications` → PASS.

- [ ] **Step 6: Mount the bell (controller coordinates with user)**

The controller first runs `git status --short admin/components/shell/notifications-button.tsx admin/components/shell/topbar.tsx` and tells the user this one file inside their shell directory changes. With their go-ahead (or if the file is clean and the user has said shell-adjacent edits are fine), replace the body of `admin/components/shell/notifications-button.tsx`:

```tsx
"use client"

import { NotificationsBell } from "@/admin/modules/notifications/notifications-bell"

import { ICON_BUTTON } from "./constants"

// The bell (docs/brief.md §9.1): admin/modules/notifications.
export function NotificationsButton() {
  return <NotificationsBell className={ICON_BUTTON} />
}
```

If the user says no, skip this step and Step 7, record "bell built, not mounted (R8)" in the progress file, and continue.

- [ ] **Step 7: Acceptance E2E**

```ts
// tests/e2e/admin/content/notifications.spec.ts
// Desktop only (admin/content/**): it moves the shared intake account's
// "seen" instant, so one project at a time.
import { expect, test } from "@playwright/test"

import { runSql } from "../../support/db"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.intake })

test("a new enquiry rings the bell, and opening it marks it read", async ({ page }) => {
  const stamp = Date.now()
  await runSql("insert into leads (name, email, topic_slug) values ($1, $2, 'anxiety')", [
    `Nora ${stamp}`,
    `nora-${stamp}@example.com`,
  ])
  await page.goto("/admin")
  const ringing = page.getByRole("button", { name: /^Notifications \(\d+\+? unread\)$/ })
  await expect(ringing).toBeVisible()
  await ringing.click()
  const item = page
    .getByRole("list", { name: "Notifications" })
    .getByRole("link")
    .filter({ hasText: "From Nora" })
    .first()
  await expect(item).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Notifications", exact: true }).click()
  await item.click()
  await expect(page).toHaveURL(/\/admin\/leads\?lead=[0-9a-f-]{36}$/)
})
```

Run: `pnpm build && E2E_SKIP_BUILD=1 pnpm test:e2e tests/e2e/admin/content/notifications.spec.ts tests/e2e/admin/a11y/axe.spec.ts --project=admin-desktop` → PASS (axe covers the bell's popover via the existing "with the user menu open" pattern; no new violations).

- [ ] **Step 8: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm vitest run --project integration tests/integration/api && DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build`

```bash
git add server/db/schema/auth.ts server/db/schema/audit.ts server/auth/auth.ts \
  server/db/migrations/0010_notifications.sql server/db/migrations/meta/0010_snapshot.json \
  server/db/migrations/meta/_journal.json lib/notifications.ts \
  server/modules/notifications/service.ts server/modules/notifications/routes.ts \
  server/api/routes/admin.ts admin/lib/api.ts admin/lib/query-keys.ts \
  admin/modules/notifications/queries.ts admin/modules/notifications/notifications-bell.tsx \
  admin/modules/notifications/notifications-bell.test.tsx tests/e2e/fixtures/notifications.ts \
  tests/integration/api/notifications.test.ts tests/e2e/admin/content/notifications.spec.ts
# Only after Step 6 was approved:
git add admin/components/shell/notifications-button.tsx
git commit -m "feat(notifications): bell for enquiries, schedules and delivery failures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Add `tests/integration/api/permission-matrix.test.ts` to the `git add` if Step 3 changed it.

---

### Task 4: Quality budgets — Lighthouse, public axe, image audit, JavaScript budget

**Model:** opus

**Files:**
- Create: `tests/e2e/perf/lighthouse-budgets.spec.ts`, `tests/e2e/navigation/axe.spec.ts`, `tests/e2e/perf/images.spec.ts`, `tests/e2e/perf/javascript.spec.ts`
- Delete: `tests/e2e/perf/lighthouse-seo.spec.ts` (folded into the budgets spec)
- Modify: `tests/e2e/admin/a11y/lighthouse.spec.ts` (comment only: it now runs in CI), plus whatever public-site files the fixes in Step 5 need

**Interfaces:**
- Consumes: `PARITY_ROUTES` (`tests/e2e/parity/routes.ts`), `settle` (`tests/e2e/support/settle.ts`), `E2E_ORIGIN` (`tests/e2e/fixtures/env.ts`), Lighthouse 13.5 (lazy import, as today).
- Produces: titles prefixed `lighthouse:`, `budget:` and `axe:` that Task 5 wires into CI; `KEY_PAGES` exported from the Lighthouse spec.

- [ ] **Step 1: Write the four specs**

```ts
// tests/e2e/perf/lighthouse-budgets.spec.ts
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { chromium, expect, test } from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"

const PORT = 9334
// docs/brief.md §3 criterion 5 (Phase 7 Ruling R20: the five key pages).
export const KEY_PAGES = ["/", "/about", "/services", "/insights", "/insights/calm-is-a-skill"]
const BUDGET = { seo: 100, accessibility: 95, performance: 90 }
// Ruling R10: performance is the median of three mobile runs.
const RUNS = 3

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!

test("lighthouse: key pages meet the §3 budgets on mobile", async () => {
  test.skip(test.info().project.name !== "desktop", "one run is enough")
  test.setTimeout(1_200_000)
  const { default: lighthouse } = await import("lighthouse")
  const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "mk-lh-")), {
    args: [`--remote-debugging-port=${PORT}`],
  })
  const failures: string[] = []
  try {
    for (const pathname of KEY_PAGES) {
      const performance: number[] = []
      for (let run = 0; run < RUNS; run++) {
        const result = await lighthouse(`${E2E_ORIGIN}${pathname}`, {
          port: PORT,
          // Lighthouse's default config is mobile with simulated throttling.
          onlyCategories: run === 0 ? ["performance", "accessibility", "seo"] : ["performance"],
          // E2E runs SITE_ENV=development, where robots.txt blocks crawlers
          // by design (Phase 7 R14); production is covered by robots.test.ts.
          skipAudits: ["is-crawlable"],
          logLevel: "error",
          output: "json",
        })
        const lhr = result?.lhr
        const score = (id: string) => Math.round((lhr?.categories[id]?.score ?? 0) * 100)
        performance.push(score("performance"))
        if (run === 0) {
          const failing = Object.values(lhr?.audits ?? {})
            .filter((a) => a.score === 0)
            .map((a) => a.id)
          for (const category of ["seo", "accessibility"] as const) {
            if (score(category) < BUDGET[category])
              failures.push(`${pathname} ${category} ${score(category)} (failing: ${failing.join(", ")})`)
          }
        }
      }
      const perf = median(performance)
      console.log(`[lighthouse] ${pathname} performance ${performance.join("/")} → ${perf}`)
      if (perf < BUDGET.performance) failures.push(`${pathname} performance ${perf}`)
    }
  } finally {
    await context.close()
  }
  expect(failures).toEqual([])
})
```

```ts
// tests/e2e/navigation/axe.spec.ts
import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

import { PARITY_ROUTES } from "../parity/routes"
import { settle } from "../support/settle"

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

test.use({ reducedMotion: "reduce" })

// docs/brief.md §16 Quality row: axe in Playwright on the public site.
for (const route of [...PARITY_ROUTES, { name: "not-found", path: "/no-such-page" }]) {
  test(`axe: ${route.name} has no serious or critical violations`, async ({ page }) => {
    await page.goto(route.path)
    await settle(page)
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    expect(
      violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
    ).toEqual([])
  })
}
```

```ts
// tests/e2e/perf/images.spec.ts
import { expect, test } from "@playwright/test"

import { PARITY_ROUTES } from "../parity/routes"
import { settle } from "../support/settle"

// Ruling R10: a visible raster may be at most twice its rendered size × DPR
// (next/image's widths step by ≤ 1.6×), and every <img> has an alt attribute
// ("" for decorative images is fine; Phase 7 checks content images have text).
const OVERSIZE = 2

test.use({ reducedMotion: "reduce" })

for (const route of PARITY_ROUTES) {
  test(`budget: images on ${route.name} have alt and fit their slot`, async ({ page }) => {
    await page.goto(route.path)
    await settle(page)
    const dpr = await page.evaluate(() => window.devicePixelRatio)
    const images = await page.locator("img").evaluateAll((elements) =>
      elements.map((element) => {
        const img = element as HTMLImageElement
        return {
          src: img.currentSrc || img.src,
          alt: img.getAttribute("alt"),
          natural: img.naturalWidth,
          shown: img.getBoundingClientRect().width,
          visible: img.checkVisibility(),
        }
      })
    )
    const missingAlt = images.filter((i) => i.alt === null).map((i) => i.src)
    const oversized = images
      .filter((i) => i.visible && i.shown > 0 && !/\.svg(\?|$)/.test(i.src))
      .filter((i) => i.natural > Math.max(i.shown * dpr * OVERSIZE, 64))
      .map((i) => `${i.src} (${i.natural}px for ${Math.round(i.shown)}px @${dpr}x)`)
    expect({ missingAlt, oversized }).toEqual({ missingAlt: [], oversized: [] })
  })
}
```

```ts
// tests/e2e/perf/javascript.spec.ts
import { expect, test } from "@playwright/test"

import { PARITY_ROUTES } from "../parity/routes"

// Ruling R10: compressed script bytes per public route, set in Step 3 to the
// measured maximum + 15%, rounded up to 10 KB. Raise it only deliberately.
const JS_BUDGET_KB = 10_000

for (const route of PARITY_ROUTES) {
  test(`budget: ${route.name} loads at most ${JS_BUDGET_KB} KB of JavaScript`, async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "the same bundle ships to every viewport")
    await page.goto(route.path)
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {})
    const bytes = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry as PerformanceResourceTiming)
        .filter((entry) => entry.initiatorType === "script" || /\.js(\?|$)/.test(entry.name))
        .reduce((sum, entry) => sum + entry.encodedBodySize, 0)
    )
    const kb = Math.round(bytes / 1024)
    console.log(`[budget] ${route.path} ${kb} KB of JavaScript`)
    expect(kb).toBeLessThanOrEqual(JS_BUDGET_KB)
  })
}
```

Delete `tests/e2e/perf/lighthouse-seo.spec.ts`. In `tests/e2e/admin/a11y/lighthouse.spec.ts`, change the comment "It runs locally only (Lighthouse 13.5 needs Node ≥ 22.19): CI skips titles starting "lighthouse:"" to "CI runs it in the e2e job's budgets step (Node 22 ≥ 22.19, which Lighthouse 13.5 needs)".

- [ ] **Step 2: Measure**

Run: `pnpm build && E2E_SKIP_BUILD=1 pnpm test:e2e tests/e2e/perf tests/e2e/navigation/axe.spec.ts --project=desktop --project=mobile --reporter=list`
Record in `.superpowers/sdd/phase-11-launch/progress.md` (create the folder if missing): every `[lighthouse]` line, every `[budget]` line, and each failing axe/image assertion. `ttfb.spec.ts` (title `perf:`) also runs; ignore it here.

- [ ] **Step 3: Set the JavaScript budget**

Set `JS_BUDGET_KB` to `Math.ceil((max measured KB × 1.15) / 10) * 10` and write the measured values in the constant's comment (e.g. `// Measured 2026-10-xx: home 412 KB … max 431 KB.`).

- [ ] **Step 4: Fix axe and image findings**

Fix each serious/critical axe violation and each oversized image at its source (a component's markup or a `next/image` `sizes` attribute; alt text comes from media rows, so a missing `alt` attribute is a component bug). Every change on the public site must keep `pnpm test:parity` ≤ 0.1%.

- [ ] **Step 5: Fix performance until every key page's median is ≥ 90**

Work down this list, re-running only `tests/e2e/perf/lighthouse-budgets.spec.ts` and `pnpm test:parity` after each change, and stop as soon as all five pages pass. Use Lighthouse's own "Opportunities"/"Diagnostics" (`output: "json"`, inspect `lhr.audits["largest-contentful-paint-element"]`, `render-blocking-resources`, `unused-javascript`) and `pnpm next experimental-analyze` (Turbopack bundle analyzer, `node_modules/next/dist/docs/01-app/02-guides/package-bundling.md`) to choose.
1. LCP image: the hero image is `priority` (or `fetchPriority="high"` + `loading="eager"`) with a `sizes` that matches its slot.
2. WebGL hero: load three.js and the shader after first paint (dynamic `import()` from an effect, or `requestIdleCallback`), keeping the static hero image underneath so the first frame is identical (the parity suite masks the canvas).
3. Fonts: preload only the faces used above the fold on public routes; `preload: false` for the rest (`app/(site)/fonts.ts`; brief §4.4).
4. Phase 3 carry: the site layout's whole-page `<Suspense fallback={null}>` gives a blank first paint; move the chrome (header, footer) outside the boundary or give it a non-null fallback that matches the final layout.
5. GSAP plugins: register ScrollTrigger/SplitText from a client effect after hydration instead of at module scope.
If a page is still under 90 after the list, stop and report the numbers and what was tried to the controller (open question Q2). Never lower `BUDGET`.

- [ ] **Step 6: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build && E2E_SKIP_BUILD=1 pnpm test:e2e tests/e2e/perf tests/e2e/navigation --project=desktop && E2E_SKIP_BUILD=1 pnpm test:e2e tests/e2e/admin/a11y/lighthouse.spec.ts --project=admin-desktop && pnpm test:parity`
Expected: all PASS; parity ≤ 0.1% on every page.

```bash
git rm tests/e2e/perf/lighthouse-seo.spec.ts
git add tests/e2e/perf/lighthouse-budgets.spec.ts tests/e2e/navigation/axe.spec.ts \
  tests/e2e/perf/images.spec.ts tests/e2e/perf/javascript.spec.ts \
  tests/e2e/admin/a11y/lighthouse.spec.ts <each fixed file, by path>
git commit -m "perf: lighthouse, axe, image and javascript budgets for the public site

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If Step 5 changed public components, a separate commit `perf(site): <what changed>` keeps the diff reviewable.

---

### Task 5: Linux visual baselines and the CI quality jobs

**Model:** sonnet

**Files:**
- Create: `scripts/visual-baselines-linux.sh`, `docker/visual/compose.yml`, `tests/ci/workflow.test.ts`, `tests/e2e/__screenshots__/linux/**` (generated)
- Modify: `.github/workflows/ci.yml`, `tests/e2e/admin/visual/shell.spec.ts` (header comment), `.dockerignore` only if `docker/` must stay out of the app image (it is small; leave it in)

**Interfaces:**
- Consumes: Playwright 1.64.0 (installed), the `parity:` / `visual:` / `lighthouse:` / `budget:` / `axe:` titles (Tasks 2 and 4), `E2E_ENV` overrides `DATABASE_URL_E2E`, `SMTP_URL_E2E`, `MAILPIT_URL` (`tests/e2e/fixtures/env.ts`).
- Produces: CI job `visual` (Task 6's deploy job `needs` it), the `workflow_dispatch` input `update_baselines`, and `tests/ci/workflow.test.ts` with a `job(name)` helper that Task 6 extends.

- [ ] **Step 1: Write the failing workflow test**

```ts
// tests/ci/workflow.test.ts
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const yml = readFileSync(".github/workflows/ci.yml", "utf8")
const playwright = JSON.parse(readFileSync("node_modules/@playwright/test/package.json", "utf8")).version

// The body of one top-level job (two-space indented key under `jobs:`).
export function job(name: string) {
  const match = yml.match(new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z][a-z-]*:\\n|$)`))
  return match?.[1] ?? ""
}

describe("CI visual job (Ruling R11)", () => {
  it("runs in the Playwright image that matches the installed version", () => {
    expect(job("visual")).toContain(`image: mcr.microsoft.com/playwright:v${playwright}-noble`)
  })

  it("runs every parity and visual snapshot on all six projects", () => {
    const visual = job("visual")
    for (const project of ["desktop", "tablet", "mobile", "admin-desktop", "admin-tablet", "admin-mobile"])
      expect(visual).toContain(`--project=${project}`)
    expect(visual).toContain('--grep "parity:|visual:"')
  })

  it("keeps snapshots out of the e2e job and runs the budgets there", () => {
    const e2e = job("e2e")
    expect(e2e).toContain('--grep-invert "parity:|visual:|lighthouse:|budget:|perf:"')
    expect(e2e).toContain('--grep "lighthouse:|budget:"')
  })

  it("can record baselines on demand and upload them", () => {
    expect(yml).toMatch(/workflow_dispatch:\n\s+inputs:\n\s+update_baselines:/)
    expect(job("visual")).toContain("tests/e2e/__screenshots__/linux")
  })

  it("the local script uses the same image", () => {
    expect(readFileSync("scripts/visual-baselines-linux.sh", "utf8")).toContain(
      'mcr.microsoft.com/playwright:v${version}-noble'
    )
  })
})
```

Run: `pnpm vitest run --project unit tests/ci/workflow.test.ts` → FAIL.

- [ ] **Step 2: The local recorder**

```yaml
# docker/visual/compose.yml
# Linux visual baselines (scripts/visual-baselines-linux.sh). Same image,
# architecture and service names as CI's visual job (.github/workflows/ci.yml).
services:
  postgres:
    image: postgres:17-alpine
    platform: linux/amd64
    environment:
      POSTGRES_USER: mk
      POSTGRES_PASSWORD: mk
      POSTGRES_DB: mk_e2e
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mk -d mk_e2e"]
      interval: 5s
      timeout: 5s
      retries: 20
  mailpit:
    image: axllent/mailpit:v1.31.4
    platform: linux/amd64
  runner:
    image: ${PW_IMAGE}
    # CI runners are x86_64; arm64 Chromium can differ by a few pixels.
    platform: linux/amd64
    depends_on:
      postgres:
        condition: service_healthy
      mailpit:
        condition: service_started
    working_dir: /app
    volumes:
      - ${WORK}:/app
      - pnpm-store:/root/.local/share/pnpm/store
    environment:
      CI: "1"
      E2E_SKIP_BUILD: "1"
      DATABASE_URL_E2E: postgres://mk:mk@postgres:5432/mk_e2e
      SMTP_URL_E2E: smtp://mailpit:1025
      MAILPIT_URL: http://mailpit:8025
    command:
      - bash
      - -lc
      - >-
        corepack enable && corepack prepare pnpm@10.32.1 --activate &&
        pnpm install --frozen-lockfile && pnpm build &&
        pnpm test:e2e --project=desktop --project=tablet --project=mobile
        --project=admin-desktop --project=admin-tablet --project=admin-mobile
        --grep "parity:|visual:" --update-snapshots
volumes:
  pnpm-store:
```

```bash
#!/usr/bin/env bash
# scripts/visual-baselines-linux.sh
# Records the Linux visual baselines (public "parity:" and admin "visual:")
# in the Playwright image CI's visual job uses, from the committed HEAD —
# never the working tree — and copies them to tests/e2e/__screenshots__/linux.
# Needs Docker. Slow on Apple Silicon (amd64 emulation): expect 20–40 min.
set -euo pipefail

root=$(git rev-parse --show-toplevel)
version=$(node -p "require('$root/node_modules/@playwright/test/package.json').version")
image="mcr.microsoft.com/playwright:v${version}-noble"
# Under the repo (shared with Docker Desktop by default), ignored by git.
work="$root/node_modules/.cache/linux-baselines"
compose=(docker compose -p mk-baselines -f "$root/docker/visual/compose.yml")

cleanup() { WORK="$work" PW_IMAGE="$image" "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$work" && mkdir -p "$work"
git -C "$root" archive HEAD | tar -x -C "$work"
rm -rf "$work/tests/e2e/__screenshots__/linux"

WORK="$work" PW_IMAGE="$image" "${compose[@]}" run --rm runner

rm -rf "$root/tests/e2e/__screenshots__/linux"
cp -R "$work/tests/e2e/__screenshots__/linux" "$root/tests/e2e/__screenshots__/linux"
echo "Linux baselines written to tests/e2e/__screenshots__/linux ($(find "$root/tests/e2e/__screenshots__/linux" -name '*.png' | wc -l | tr -d ' ') files)"
```

`chmod +x scripts/visual-baselines-linux.sh`. Add `"test:visual:linux": "scripts/visual-baselines-linux.sh"` to `package.json` scripts.

- [ ] **Step 3: Record the baselines**

All of Tasks 2–4 must be committed first (the recorder reads `HEAD`). Run: `pnpm test:visual:linux`
Expected: the run ends with every snapshot "written"; the file count equals the darwin count (`find tests/e2e/__screenshots__/darwin -name '*.png' | wc -l`, 33 before this phase plus any new ones). Open a sample (home desktop, dashboard admin-mobile dark) and check them by eye. Then run the recorder **again** without changing anything and confirm `git status --short tests/e2e/__screenshots__/linux` shows no modified files beyond the first run (determinism check; a flapping snapshot is a bug to fix, not to re-record).

- [ ] **Step 4: CI jobs**

Edit `.github/workflows/ci.yml`:

```yaml
on:
  push:
    branches: [main, feat/platform]
  pull_request:
  workflow_dispatch:
    inputs:
      update_baselines:
        description: "Record Linux visual baselines and upload them as an artifact"
        type: boolean
        default: false
```

In the `e2e` job, change the main step's filter to `--grep-invert "parity:|visual:|lighthouse:|budget:|perf:"`, add the axe titles nowhere (they have no prefix filter and run there), and add after it:

```yaml
      # docs/brief.md §16 Quality row; Ruling R10. Lighthouse 13.5 needs
      # Node ≥ 22.19 (setup-node 22 installs the latest 22.x).
      - name: Quality budgets (Lighthouse, images, JavaScript)
        run: pnpm test:e2e --project=desktop --project=mobile --project=admin-desktop --grep "lighthouse:|budget:"
        env:
          E2E_SKIP_BUILD: "1"
```

Add the job (after `e2e`):

```yaml
  # Ruling R11: snapshots compare only inside the image that recorded them
  # (scripts/visual-baselines-linux.sh uses the same one).
  visual:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.64.0-noble
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: mk
          POSTGRES_PASSWORD: mk
          POSTGRES_DB: mk_e2e
        options: >-
          --health-cmd "pg_isready -U mk -d mk_e2e"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
      mailpit:
        image: axllent/mailpit:v1.31.4
    env:
      DATABASE_URL_E2E: postgres://mk:mk@postgres:5432/mk_e2e
      SMTP_URL_E2E: smtp://mailpit:1025
      MAILPIT_URL: http://mailpit:8025
      HOME: /root
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.32.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Visual parity and admin snapshots (Linux baselines)
        run: >-
          pnpm test:e2e --project=desktop --project=tablet --project=mobile
          --project=admin-desktop --project=admin-tablet --project=admin-mobile
          --grep "parity:|visual:" ${{ inputs.update_baselines && '--update-snapshots' || '' }}
        env:
          E2E_SKIP_BUILD: "1"
      - uses: actions/upload-artifact@v4
        if: ${{ inputs.update_baselines }}
        with:
          name: linux-baselines
          path: tests/e2e/__screenshots__/linux
          retention-days: 14
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: visual-diffs
          path: test-results/
          retention-days: 7
```

`inputs.update_baselines` is empty on `push`/`pull_request`, so the expression yields `''`. Update the comment above the e2e job's main step: "Visual snapshots run in the visual job (Linux image); budgets in the next step." Update `tests/e2e/admin/visual/shell.spec.ts`'s header: "CI runs these in the visual job against the Linux baselines (Phase 11)".

- [ ] **Step 5: Verify and commit**

Run: `pnpm vitest run --project unit tests/ci/workflow.test.ts && pnpm lint && pnpm typecheck`
If `actionlint` is installed (`command -v actionlint`), run `actionlint .github/workflows/ci.yml`; otherwise `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7 -color` (an image, not a project dependency).

```bash
git add scripts/visual-baselines-linux.sh docker/visual/compose.yml tests/ci/workflow.test.ts \
  .github/workflows/ci.yml tests/e2e/admin/visual/shell.spec.ts package.json \
  tests/e2e/__screenshots__/linux
git commit -m "ci: linux visual baselines in the playwright image, budgets in e2e

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Deploy after green CI, deployment id, hero-depth tooling out of the image

**Model:** sonnet

**Files:**
- Create: `scripts/deployment-id.sh`, `tests/ci/deployment-id.test.ts`
- Modify: `.github/workflows/ci.yml` (deploy job), `tests/ci/workflow.test.ts` (deploy tests), `Dockerfile`, `.dockerignore`, `package.json`, `pnpm-lock.yaml`, `scripts/generate-hero-depth.mjs` (header comment only)

**Interfaces:**
- Consumes: `job(name)` from `tests/ci/workflow.test.ts` (Task 5), jobs `check`, `e2e`, `visual`.
- Produces: CI job `deploy`; `scripts/deployment-id.sh [context-dir]` → prints one line; `pnpm hero:depth`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ci/workflow.test.ts`:

```ts
describe("deploy job (Ruling R12)", () => {
  const deploy = job("deploy")

  it("deploys only after check, e2e and visual pass, and only on pushes to main or feat/platform", () => {
    expect(deploy).toContain("needs: [check, e2e, visual]")
    expect(deploy).toContain("github.event_name == 'push'")
    expect(deploy).toContain("refs/heads/main")
    expect(deploy).toContain("refs/heads/feat/platform")
    expect(deploy).not.toContain("pull_request")
  })

  it("targets the GitHub environment of the branch", () => {
    expect(deploy).toContain("environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}")
  })

  it("skips with a warning when the Dokploy secrets are missing", () => {
    expect(deploy).toContain("::warning::")
    expect(deploy).toMatch(/exit 0/)
    // Secrets reach curl through env, never inline in the command.
    expect(deploy).not.toMatch(/curl[^\n]*\$\{\{ secrets\./)
  })

  it("calls Dokploy's deploy API with the application id", () => {
    expect(deploy).toContain('"$DOKPLOY_URL/api/application.deploy"')
    expect(deploy).toContain("x-api-key: $DOKPLOY_API_KEY")
  })
})
```

```ts
// tests/ci/deployment-id.test.ts
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

const SHA = "0123456789abcdef0123456789abcdef01234567"
const run = (dir: string, env: Record<string, string> = {}) =>
  execFileSync("sh", ["scripts/deployment-id.sh", dir], {
    env: { PATH: process.env.PATH!, ...env },
    encoding: "utf8",
  }).trim()

function repo(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), "mk-dpl-"))
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    writeFileSync(path.join(dir, file), content)
  }
  return dir
}

describe("scripts/deployment-id.sh (Ruling R13)", () => {
  it("prefers the build arg", () => {
    expect(run(repo({}), { NEXT_DEPLOYMENT_ID: "abc123" })).toBe("abc123")
  })
  it("reads a branch ref", () => {
    expect(run(repo({ ".git/HEAD": "ref: refs/heads/main\n", ".git/refs/heads/main": `${SHA}\n` }))).toBe(SHA)
  })
  it("reads packed refs", () => {
    expect(
      run(repo({ ".git/HEAD": "ref: refs/heads/main\n", ".git/packed-refs": `# pack-refs\n${SHA} refs/heads/main\n` }))
    ).toBe(SHA)
  })
  it("reads a detached HEAD", () => {
    expect(run(repo({ ".git/HEAD": `${SHA}\n` }))).toBe(SHA)
  })
  it("falls back to a build timestamp", () => {
    expect(run(repo({}))).toMatch(/^build-\d{14}$/)
  })
})
```

Run: `pnpm vitest run --project unit tests/ci` → FAIL.

- [ ] **Step 2: Deployment id script, Dockerfile, .dockerignore**

```sh
#!/bin/sh
# scripts/deployment-id.sh [context-dir]
# The id Next.js uses for version-skew protection (docs/brief.md §17;
# Ruling R13): the NEXT_DEPLOYMENT_ID build arg if set, else the commit of
# the build context's .git, else a build timestamp. POSIX sh (alpine).
set -eu
if [ -n "${NEXT_DEPLOYMENT_ID:-}" ]; then
  printf '%s\n' "$NEXT_DEPLOYMENT_ID"
  exit 0
fi
dir=${1:-.}
sha=
if [ -f "$dir/.git/HEAD" ]; then
  head=$(cat "$dir/.git/HEAD")
  case "$head" in
    "ref: "*)
      ref=${head#ref: }
      if [ -f "$dir/.git/$ref" ]; then
        sha=$(cat "$dir/.git/$ref")
      elif [ -f "$dir/.git/packed-refs" ]; then
        sha=$(grep " $ref\$" "$dir/.git/packed-refs" | head -n 1 | cut -d ' ' -f 1)
      fi
      ;;
    *) sha=$head ;;
  esac
fi
if [ -n "$sha" ]; then
  printf '%s\n' "$sha"
else
  date -u +build-%Y%m%d%H%M%S
fi
```

`.dockerignore`: replace the `.git` line with

```
.git
!.git/HEAD
!.git/refs
!.git/packed-refs
```

`Dockerfile` builder stage — replace the `RUN pnpm build && …` line:

```dockerfile
# Version skew protection (docs/brief.md §17): the build arg wins, else the
# git commit of the build context (scripts/deployment-id.sh).
RUN NEXT_DEPLOYMENT_ID="$(sh scripts/deployment-id.sh .)" && export NEXT_DEPLOYMENT_ID \
  && echo "deployment id: $NEXT_DEPLOYMENT_ID" \
  && pnpm build && pnpm build:migrate && pnpm build:admin-create
```

Keep `ARG NEXT_DEPLOYMENT_ID` / `ENV NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID` above it (an empty ENV makes the script fall through to git).

- [ ] **Step 3: Deploy job**

Append to `.github/workflows/ci.yml`:

```yaml
  # docs/brief.md §16 step 8 (Ruling R12): deploy only after every check is
  # green. Dokploy's own auto-deploy is turned off (docs/runbook.md).
  deploy:
    if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/feat/platform')
    needs: [check, e2e, visual]
    runs-on: ubuntu-latest
    environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
    concurrency:
      group: deploy-${{ github.ref }}
      cancel-in-progress: false
    steps:
      - name: Trigger the Dokploy deploy
        env:
          DOKPLOY_URL: ${{ secrets.DOKPLOY_URL }}
          DOKPLOY_API_KEY: ${{ secrets.DOKPLOY_API_KEY }}
          DOKPLOY_APPLICATION_ID: ${{ secrets.DOKPLOY_APPLICATION_ID }}
        run: |
          if [ -z "$DOKPLOY_URL" ] || [ -z "$DOKPLOY_API_KEY" ] || [ -z "$DOKPLOY_APPLICATION_ID" ]; then
            echo "::warning::Dokploy secrets are not set for this environment; nothing was deployed."
            exit 0
          fi
          curl --fail-with-body -sS -X POST "$DOKPLOY_URL/api/application.deploy" \
            -H "x-api-key: $DOKPLOY_API_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"applicationId\":\"$DOKPLOY_APPLICATION_ID\"}"
          echo "Deploy of ${GITHUB_SHA} requested."
```

Change the workflow's header comment to: "Checks every push and pull request; on pushes to main and feat/platform, deploys through Dokploy once everything is green (docs/brief.md §16)."

- [ ] **Step 4: Hero-depth tooling out of the image**

Run: `pnpm remove @huggingface/transformers`
Add to `package.json` scripts:

```json
"hero:depth": "npm install --no-save --no-package-lock --prefix node_modules/.cache/hero-depth @huggingface/transformers@4.3.0 && cp scripts/generate-hero-depth.mjs node_modules/.cache/hero-depth/ && node node_modules/.cache/hero-depth/generate-hero-depth.mjs"
```

In `scripts/generate-hero-depth.mjs`, replace the usage comment lines with:

```js
//   pnpm hero:depth
//
// @huggingface/transformers is not a project dependency (docs/brief.md §17:
// it stays out of the image build). The script installs it on demand into
// node_modules/.cache/hero-depth and runs a copy from there, so Node resolves
// it next to the script. Paths below are relative to the repo root (the cwd).
```

The code is unchanged. Do **not** run the full model (it downloads ~100 MB); verify the plumbing with `npm install --no-save --no-package-lock --prefix node_modules/.cache/hero-depth @huggingface/transformers@4.3.0 && node -e "import('./node_modules/.cache/hero-depth/node_modules/@huggingface/transformers/package.json', { with: { type: 'json' } }).then(m => console.log(m.default.version))"` → `4.3.0`, then `rm -rf node_modules/.cache/hero-depth`.

- [ ] **Step 5: Verify the image**

Run:

```bash
pnpm vitest run --project unit tests/ci
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm audit --prod --audit-level high
docker build --progress=plain -t mk-app:phase11 . 2>&1 | tee "$TMPDIR/mk-build.log" | grep "deployment id:"
grep -c huggingface "$TMPDIR/mk-build.log" || true
docker run --rm --entrypoint sh mk-app:phase11 -c 'grep -o "\"deploymentId\":\"[^\"]*\"" server.js .next/required-server-files.json | head -2; ls node_modules/@huggingface 2>/dev/null || echo "no transformers"'
```

Expected: `deployment id: <git rev-parse HEAD>`; zero `huggingface` lines in the build log; `deploymentId` equals the same SHA; "no transformers". If `deploymentId` does not appear in either file, find where Next 16.3 records it (`grep -rl "<sha>" .next/standalone | head` inside the container) and assert on that instead.

```bash
git add scripts/deployment-id.sh tests/ci/deployment-id.test.ts tests/ci/workflow.test.ts \
  .github/workflows/ci.yml Dockerfile .dockerignore package.json pnpm-lock.yaml \
  scripts/generate-hero-depth.mjs
git commit -m "ci: deploy through dokploy after green ci, with the git sha as deployment id

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Operations — owner recovery CLI, backup restore drill, runbook

**Model:** sonnet

**Files:**
- Create: `server/modules/users/recover.ts`, `scripts/owner-recover.ts`, `tests/integration/users/recover.test.ts`, `scripts/restore-drill-lib.ts`, `scripts/restore-drill-lib.test.ts`, `scripts/restore-drill.ts`, `docs/runbook.md`
- Modify: `package.json`, `Dockerfile`, `docs/deploy-dokploy.md`

**Interfaces:**
- Consumes: `audit(actor | null, entry, db?)` (`server/lib/audit.ts`), `getAuth()`, `getEnv()`, `parseRoles`, `sessions`, `twoFactors`, `users`, `closeDb`.
- Produces: `recoverOwner(email: string): Promise<{ userId: string; sessionsEnded: number }>`, `class RecoveryError extends Error`; `dumpFormat(buf: Buffer): "custom" | "plain"`, `unwrap(buf: Buffer): Buffer`, `pickLatest(objects: { Key?: string; LastModified?: Date }[]): string | null`, `assertDrillDatabase(url: string): string` (returns the db name); CLIs `pnpm owner:recover`, `pnpm backup:drill`; image file `owner-recover.cjs`.

- [ ] **Step 1: Write the failing recovery test**

```ts
// tests/integration/users/recover.test.ts
import { eq, or } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, sessions, twoFactors, users } from "@/server/db/schema"
import { clearOutbox, readOutbox } from "@/server/lib/email"
import { recoverOwner, RecoveryError } from "@/server/modules/users/recover"

import { createUser, signIn, signInWithTwoFactor, viewAs } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  clearOutbox()
})
afterAll(closeDb)

describe("recoverOwner (runbook: recover the owner account)", () => {
  it("resets two-factor, lifts a ban, ends every session and emails a reset link", async () => {
    const owner = await createUser("owner", "Boss@Example.com".toLowerCase())
    const viewer = await createUser("viewer")
    const cookie = await signInWithTwoFactor("boss@example.com")
    await viewAs(cookie, viewer.id)
    await getDb().insert(twoFactors).values({ userId: owner.id, secret: "s", backupCodes: "c" })
    await getDb()
      .update(users)
      .set({ banned: true, banReason: "test", twoFactorEnabled: true })
      .where(eq(users.id, owner.id))

    const result = await recoverOwner("  BOSS@example.com ")

    expect(result.userId).toBe(owner.id)
    expect(result.sessionsEnded).toBeGreaterThanOrEqual(2)
    const [row] = await getDb().select().from(users).where(eq(users.id, owner.id))
    expect(row).toMatchObject({ banned: false, banReason: null, twoFactorEnabled: false })
    expect(await getDb().select().from(twoFactors).where(eq(twoFactors.userId, owner.id))).toEqual([])
    expect(
      await getDb()
        .select()
        .from(sessions)
        .where(or(eq(sessions.userId, owner.id), eq(sessions.impersonatedBy, owner.id)))
    ).toEqual([])
    const [entry] = await getDb().select().from(auditLogs).where(eq(auditLogs.action, "user.recover"))
    expect(entry).toMatchObject({ actorId: null, entityId: owner.id })
    expect(readOutbox().at(-1)?.to).toContain("boss@example.com")
    // The password still works; the panel then sends them to two-factor setup.
    expect(await signIn("boss@example.com")).toMatch(/mk\.session_token=/)
  })

  it("refuses an unknown email and a non-owner", async () => {
    await createUser("admin")
    await expect(recoverOwner("nobody@example.com")).rejects.toBeInstanceOf(RecoveryError)
    await expect(recoverOwner("admin@example.com")).rejects.toThrow(/not an owner/)
  })
})
```

Match `readOutbox()` entries to their real shape (`to` may be a string or an array; `tests/integration/users/bootstrap.test.ts` reads `readOutbox()[0].subject`). If `signIn` returns the cookie under another prefix, assert on `mk.` generally.

Run: `pnpm vitest run --project integration tests/integration/users/recover.test.ts` → FAIL.

- [ ] **Step 2: Implement recovery and its CLI**

```ts
// server/modules/users/recover.ts
import "server-only"

import { eq, or } from "drizzle-orm"

import { parseRoles } from "@/lib/auth/permissions"
import { getAuth } from "@/server/auth/auth"
import { getDb } from "@/server/db/client"
import { sessions, twoFactors, users } from "@/server/db/schema"
import { getEnv } from "@/server/env"
import { audit } from "@/server/lib/audit"

export class RecoveryError extends Error {}

// Ruling R16 (docs/brief.md §19 "Owner lockout"): an owner who lost their
// two-factor device and backup codes, or who is banned, gets a clean start.
// Command line only: whoever runs it already controls the server.
export async function recoverOwner(rawEmail: string) {
  const email = rawEmail.trim().toLowerCase()
  const user = await getDb().query.users.findFirst({ where: eq(users.email, email) })
  if (!user) {
    throw new RecoveryError(`No account uses ${email}. To create the first owner, run admin-create instead.`)
  }
  if (!parseRoles(user.role).includes("owner")) {
    throw new RecoveryError(`${email} is not an owner. An owner or admin can fix this account in Users & roles.`)
  }
  const sessionsEnded = await getDb().transaction(async (tx) => {
    await tx.delete(twoFactors).where(eq(twoFactors.userId, user.id))
    await tx
      .update(users)
      .set({ twoFactorEnabled: false, banned: false, banReason: null, banExpires: null })
      .where(eq(users.id, user.id))
    const ended = await tx
      .delete(sessions)
      .where(or(eq(sessions.userId, user.id), eq(sessions.impersonatedBy, user.id)))
      .returning({ id: sessions.id })
    await audit(
      null,
      {
        action: "user.recover",
        entityType: "user",
        entityId: user.id,
        summary: `Recovered owner ${email} from the command line (two-factor reset, signed out everywhere)`,
      },
      tx
    )
    return ended.length
  })
  await getAuth().api.requestPasswordReset({
    body: { email, redirectTo: new URL("/admin/reset-password", getEnv().SITE_URL).toString() },
  })
  return { userId: user.id, sessionsEnded }
}
```

```ts
// scripts/owner-recover.ts
import { parseArgs } from "node:util"

import { closeDb } from "@/server/db/client"
import { recoverOwner, RecoveryError } from "@/server/modules/users/recover"

const { values } = parseArgs({ options: { email: { type: "string" } } })

if (!values.email) {
  console.error("Usage: pnpm owner:recover --email owner@example.com")
  console.error("In the container: node owner-recover.cjs --email owner@example.com")
  process.exit(1)
}

recoverOwner(values.email)
  .then(({ sessionsEnded }) => {
    console.log(`Recovered. Two-factor was reset and ${sessionsEnded} session(s) ended.`)
    console.log(`A password-reset link was emailed to ${values.email}. After signing in, set up two-factor again.`)
  })
  .catch((error: unknown) => {
    console.error(error instanceof RecoveryError ? error.message : error)
    process.exitCode = 1
  })
  .finally(closeDb)
```

`package.json` scripts:

```json
"owner:recover": "NODE_OPTIONS=--conditions=react-server dotenv -e .env -- tsx scripts/owner-recover.ts",
"build:owner-recover": "esbuild scripts/owner-recover.ts --bundle --platform=node --target=node22 --format=cjs --alias:server-only=./scripts/server-only-stub.js --outfile=dist/owner-recover.cjs",
"backup:drill": "NODE_OPTIONS=--conditions=react-server tsx scripts/restore-drill.ts"
```

`Dockerfile`: append `&& pnpm build:owner-recover` to the builder's build `RUN`, and in the runner add `COPY --from=builder --chown=nextjs:nodejs /app/dist/owner-recover.cjs ./owner-recover.cjs` after the `admin-create.cjs` line.

Run: `pnpm vitest run --project integration tests/integration/users/recover.test.ts` → PASS.

- [ ] **Step 3: Write the failing drill-library test**

```ts
// scripts/restore-drill-lib.test.ts
import { gzipSync } from "node:zlib"

import { describe, expect, it } from "vitest"

import { assertDrillDatabase, dumpFormat, pickLatest, unwrap } from "./restore-drill-lib"

describe("restore drill helpers (Ruling R15)", () => {
  it("tells pg_dump's custom format from plain SQL, gzipped or not", () => {
    const custom = Buffer.from("PGDMP\x01\x0e\x00")
    const plain = Buffer.from("--\n-- PostgreSQL database dump\n")
    expect(dumpFormat(unwrap(custom))).toBe("custom")
    expect(dumpFormat(unwrap(gzipSync(custom)))).toBe("custom")
    expect(dumpFormat(unwrap(plain))).toBe("plain")
    expect(dumpFormat(unwrap(gzipSync(plain)))).toBe("plain")
  })

  it("picks the newest object", () => {
    expect(
      pickLatest([
        { Key: "a.dump", LastModified: new Date("2026-10-01") },
        { Key: "c.dump", LastModified: new Date("2026-10-03") },
        { Key: "b.dump", LastModified: new Date("2026-10-02") },
        { LastModified: new Date("2026-10-09") },
      ])
    ).toBe("c.dump")
    expect(pickLatest([])).toBeNull()
  })

  it("only ever restores into a *_restore_drill database", () => {
    expect(assertDrillDatabase("postgres://mk:mk@localhost:5432/mk_restore_drill")).toBe("mk_restore_drill")
    expect(() => assertDrillDatabase("postgres://mk:mk@localhost:5432/mk_dev")).toThrow(/_restore_drill/)
  })
})
```

Run: `pnpm vitest run --project unit scripts/restore-drill-lib.test.ts` → FAIL.

- [ ] **Step 4: Implement the drill**

```ts
// scripts/restore-drill-lib.ts
import { gunzipSync } from "node:zlib"

export const unwrap = (buf: Buffer) => (buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf)

export const dumpFormat = (buf: Buffer): "custom" | "plain" =>
  buf.subarray(0, 5).toString("latin1") === "PGDMP" ? "custom" : "plain"

export function pickLatest(objects: { Key?: string; LastModified?: Date }[]): string | null {
  const keyed = objects.filter((o): o is { Key: string; LastModified?: Date } => Boolean(o.Key))
  keyed.sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
  return keyed[0]?.Key ?? null
}

// The drill drops and recreates its database: never let it touch a real one.
export function assertDrillDatabase(url: string) {
  const name = new URL(url).pathname.replace(/^\//, "")
  if (!name.endsWith("_restore_drill")) {
    throw new Error(`Refusing to restore into "${name}": the drill database name must end in _restore_drill`)
  }
  return name
}
```

```ts
// scripts/restore-drill.ts
// docs/runbook.md "Restore a backup" (Ruling R15). Restores a pg_dump into a
// disposable local database and checks it is a working copy of the site.
//   pnpm backup:drill --file backup.dump[.gz] | --file backup.sql[.gz]
//   pnpm backup:drill --latest      (BACKUP_S3_* from your shell, read-only R2 token)
// Needs the local stack (pnpm db:up): psql/pg_restore run in its postgres container.
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { parseArgs } from "node:util"

import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"
import pg from "pg"

import { assertDrillDatabase, dumpFormat, pickLatest, unwrap } from "./restore-drill-lib"

const { values } = parseArgs({
  options: { file: { type: "string" }, latest: { type: "boolean" }, keep: { type: "boolean" } },
})
const url = process.env.DRILL_DATABASE_URL ?? "postgres://mk:mk@localhost:5432/mk_restore_drill"
const db = assertDrillDatabase(url)
const psql = (args: string[], input?: Buffer) => {
  const result = spawnSync("docker", ["compose", "exec", "-T", "postgres", ...args], { input, stdio: ["pipe", "inherit", "inherit"] })
  if (result.status !== 0) throw new Error(`${args[0]} failed (exit ${result.status})`)
}

async function download(): Promise<Buffer> {
  if (values.file) return readFileSync(values.file)
  if (!values.latest) throw new Error("Pass --file <dump> or --latest")
  const env = (name: string) => {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
  }
  const s3 = new S3Client({
    endpoint: env("BACKUP_S3_ENDPOINT"),
    region: process.env.BACKUP_S3_REGION ?? "auto",
    credentials: { accessKeyId: env("BACKUP_S3_ACCESS_KEY_ID"), secretAccessKey: env("BACKUP_S3_SECRET_ACCESS_KEY") },
  })
  const Bucket = env("BACKUP_S3_BUCKET")
  const listed = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: process.env.BACKUP_S3_PREFIX }))
  const Key = pickLatest(listed.Contents ?? [])
  if (!Key) throw new Error("No backups found in the bucket/prefix")
  console.log(`Latest backup: ${Key}`)
  const object = await s3.send(new GetObjectCommand({ Bucket, Key }))
  return Buffer.from(await object.Body!.transformToByteArray())
}

async function verify() {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const journal = JSON.parse(readFileSync("server/db/migrations/meta/_journal.json", "utf8")) as { entries: unknown[] }
    const one = async (sql: string) => Number((await client.query(sql)).rows[0].n)
    const checks = {
      migrations: (await one("select count(*) as n from drizzle.__drizzle_migrations")) === journal.entries.length,
      owner: (await one("select count(*) as n from users where role like '%owner%'")) > 0,
      publishedPages: (await one("select count(*) as n from pages where status = 'published'")) > 0,
    }
    for (const table of ["users", "pages", "articles", "leads", "newsletter_subscribers", "media", "audit_logs"]) {
      console.log(`  ${table}: ${await one(`select count(*) as n from ${table}`)}`)
    }
    console.log(checks)
    if (Object.values(checks).some((ok) => !ok)) throw new Error("Restore drill FAILED")
    console.log("Restore drill PASSED")
  } finally {
    await client.end()
  }
}

const dump = unwrap(await download())
psql(["psql", "-U", "mk", "-d", "postgres", "-c", `drop database if exists ${db}`, "-c", `create database ${db}`])
if (dumpFormat(dump) === "custom") psql(["pg_restore", "-U", "mk", "-d", db, "--no-owner", "--no-acl"], dump)
else psql(["psql", "-U", "mk", "-d", db, "-v", "ON_ERROR_STOP=1", "-q"], dump)
try {
  await verify()
} finally {
  if (!values.keep) psql(["psql", "-U", "mk", "-d", "postgres", "-c", `drop database if exists ${db}`])
}
```

If drizzle's migrations table lives elsewhere (check `server/db/migrate.ts`: `migrationsTable`/`migrationsSchema` options; none are set, so the default `drizzle.__drizzle_migrations` applies), adjust the query.

Run:

```bash
pnpm vitest run --project unit scripts/restore-drill-lib.test.ts
pnpm db:up && pnpm db:migrate && pnpm db:seed
docker compose exec -T postgres pg_dump -U mk -Fc mk_dev > "$TMPDIR/mk-dev.dump"
docker compose exec -T postgres pg_dump -U mk mk_dev | gzip > "$TMPDIR/mk-dev.sql.gz"
pnpm backup:drill --file "$TMPDIR/mk-dev.dump"
pnpm backup:drill --file "$TMPDIR/mk-dev.sql.gz"
```

Expected: both end with `Restore drill PASSED`; `mk_restore_drill` no longer exists afterwards. If the seeded dev database has no owner (`db:seed` may not create one), first run `pnpm admin:create --email you@example.com --name "Drill Owner"` against the dev database, as `docs/deploy-dokploy.md` step 8 does in a container.

- [ ] **Step 5: Write `docs/runbook.md`**

Sections, each a short numbered procedure with the exact commands (write them out in full; no "see elsewhere" without the link):

1. **Environments** — staging (`feat/platform`, `SITE_ENV=staging`, robots disallow, ribbon) and production (`main`, one replica, brief §5.6); where env vars live (Dokploy ▸ app ▸ Environment); health endpoints `/api/v1/health/live` and `/api/v1/health`.
2. **Deploy** — push to the branch; CI (`check`, `e2e`, `visual`) must pass; the `deploy` job calls Dokploy; migrations run at container start under an advisory lock; watch Dokploy ▸ Deployments; smoke test: `/`, `/admin` sign-in, `/api/v1/health` 200, one enquiry to Mailpit/inbox on staging.
3. **Roll back** — Dokploy ▸ Deployments ▸ previous deployment ▸ Redeploy (or `git revert` + push). Migrations are forward-only and additive by convention; a rollback across a destructive migration needs a restore (section 4). Clients on the old build reload automatically (deployment id).
4. **Restore a backup** — Dokploy ▸ Database ▸ Backups ▸ Restore for production; then `pnpm backup:drill --latest` monthly against a read-only R2 token, recording the date and result in the table at the end of this section.
5. **Rotate secrets** — link to `docs/deploy-dokploy.md` "Rotating secrets" (Phase 10 table) and summarise the order: create new → set env → redeploy → revoke old; Better Auth rotation signs everyone out.
6. **Recover the owner account** — (a) backup codes on the two-factor screen; (b) another owner/admin resets them in Users & roles; (c) `docker exec <container> node owner-recover.cjs --email owner@example.com` (R16: resets two-factor, lifts a ban, ends sessions, emails a reset link, audited); (d) no owner exists at all: `node admin-create.cjs --email … --name …`.
7. **Verify the sending domain** — Resend ▸ Domains: add the domain, publish SPF/DKIM/DMARC records (DMARC `p=quarantine` once reports are clean), wait for "Verified", set `EMAIL_DRIVER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` on that domain, redeploy, send a test enquiry.
8. **Set up GTM** — link to `docs/deploy-dokploy.md` "Tracking setup" (container import `docs/gtm-container.json`, GA4 and Meta settings, Basic consent mode).
9. **Media bucket headers** (Phase 4 carry) — Cloudflare ▸ the media domain ▸ Rules ▸ Transform Rules ▸ Modify Response Header, for requests where the URI path does not end in `.pdf`: set `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox`; for `.pdf`: `X-Content-Type-Options: nosniff` only. Verify with `curl -I <MEDIA_PUBLIC_URL>/<an image>`.
10. **Scheduler** — the cron tick (`POST /api/v1/cron/tick` with `Authorization: Bearer $CRON_SECRET`) every minute from Dokploy ▸ Schedules; it publishes scheduled articles and runs the retention purge.
11. **Incidents** — CSP violation (`[csp]` log lines; `CUSTOM_SCRIPT_HOSTS`; emergency Report-Only switch, Phase 10 section), database down (`/api/v1/health` 503; site keeps serving cached pages), email failures (bell + owner email; check Resend status), Meta CAPI failures (bell; re-enter token after `APP_ENCRYPTION_KEY` rotation).
12. **Local setup** — `docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev` (brief §17), `pnpm admin:create`, Mailpit at `http://localhost:8025`.

Append to `docs/deploy-dokploy.md`:

```markdown
## Phase 11 (launch)

- **Deploys wait for CI.** Turn **off** Auto Deploy on both Dokploy apps. Create a Dokploy API key (Settings ▸ Profile ▸ API/CLI). In GitHub ▸ Settings ▸ Environments create `staging` and `production`, each with secrets `DOKPLOY_URL` (e.g. `https://dokploy.example.com`), `DOKPLOY_API_KEY`, `DOKPLOY_APPLICATION_ID` (the app's id from its Dokploy URL or `/api/application.all`). Optionally require a reviewer on `production`. Without the secrets the `deploy` job only warns.
- **Deployment id.** No build arg is needed: the Dockerfile reads the commit from the clone (`scripts/deployment-id.sh`). Leave `NEXT_DEPLOYMENT_ID` unset in Dokploy unless you want to override it.
- **Backups.** Dokploy ▸ the PostgreSQL service ▸ Backups: add an S3 destination for an R2 bucket (endpoint `https://<account>.r2.cloudflarestorage.com`, region `auto`, a token scoped to that bucket), schedule daily (e.g. `0 3 * * *`), keep 30. Run "Backup now" once and confirm the object appears. Then run the restore drill (`docs/runbook.md` §4) with a separate **read-only** token.
- **Owner recovery** ships in the image as `owner-recover.cjs` (`docs/runbook.md` §6).
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm vitest run --project integration tests/integration/users && pnpm build:owner-recover && docker build -t mk-app:phase11 . && docker run --rm --entrypoint sh mk-app:phase11 -c 'ls owner-recover.cjs admin-create.cjs migrate.cjs'`

```bash
git add server/modules/users/recover.ts scripts/owner-recover.ts tests/integration/users/recover.test.ts \
  scripts/restore-drill-lib.ts scripts/restore-drill-lib.test.ts scripts/restore-drill.ts \
  package.json Dockerfile docs/runbook.md docs/deploy-dokploy.md
git commit -m "feat(ops): owner recovery cli, backup restore drill and runbook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Launch acceptance — content QA sheet, §3 checklist, full sweep, phase exit

**Model:** sonnet

**Files:**
- Create: `docs/content-qa.md`, `docs/launch.md`
- Modify: `.superpowers/sdd/plan/progress.md`, `.superpowers/sdd/phase-11-launch/progress.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the acceptance evidence and the user's launch checklist.

- [ ] **Step 1: Write `docs/content-qa.md` (for the client)**

A table with one row per §4.6 finding: **Finding** · **Where in the admin** · **Detected automatically?** (rule id from R5, or "manual") · **Suggested fix** · **Client decision** (blank) · **Done** (blank). Rows: rebrand "James"/"His" (About page story, two testimonials) and `hello@jameswhitfield.ie` (Contact & clinic); footer `[email]`, `[phone]`, `[Dublin, Ireland]` (Footer); online sessions "worldwide" vs "Ireland, UK & USA" (Contact & clinic, Footer, About stats); FAQ #4 duplicates #7 (Collections ▸ FAQs, manual); seven "Book a discovery call" wordings (list each location found by `grep -rn -i "discovery call" server/db/seed`, manual); `story.png` = `step-2.png` (Media, manual); approach-subtitle colon and clinic-address comma (About page, Contact & clinic, manual); the three legal pages (Pages ▸ Privacy Policy / Terms / Disclaimer: placeholder, unpublished). End with: "Legal copy must come from the practice or its adviser; we publish it as provided" and a sign-off block (name, date, "I approve the content above for launch").

- [ ] **Step 2: Write `docs/launch.md`**

1. **§3 acceptance** — a table: criterion (quoted from brief §3) · evidence (the exact command or spec) · result (filled in Step 3):
   - 1 Visual parity → `pnpm test:parity` (darwin) and CI `visual` job (Linux, all six projects).
   - 2 Everything editable → `tests/e2e/admin/content/editing.spec.ts`, `collections.spec.ts`, `settings.spec.ts`, `insights.spec.ts`, `preview.spec.ts` (edit → publish → next request shows it).
   - 3 No database at build → CI `check` job "Build with an unreachable database"; `DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build`.
   - 4 RBAC is provable → `tests/integration/api/permission-matrix.test.ts`, `users-admin.test.ts`, `tests/e2e/admin/content/rbac.spec.ts`, `tests/e2e/admin/users/view-as.spec.ts`.
   - 5 SEO → `tests/e2e/navigation/seo.spec.ts`, `tests/integration/api/sitemap.test.ts`, `seo-health.test.ts`, `tests/e2e/perf/lighthouse-budgets.spec.ts` (SEO 100, a11y ≥ 95, mobile perf ≥ 90), `tests/e2e/perf/images.spec.ts`, dashboard SEO health 100% or listed issues.
   - 6 Tracking → `pnpm test:e2e:tracking`, `tests/integration/api/leads-capi.test.ts`, `consent.test.ts`.
   - 7 The admin wows → `tests/e2e/admin/shell/*`, `tests/e2e/admin/a11y/*`, admin `visual:` baselines on three viewports, `pnpm test:e2e:appearance`; plus the user's own eye check.
   - 8 Operations → local one command (`docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev`), migrations at boot (`docker-entrypoint.sh`, `tests/integration/db/*`), daily backups (Dokploy config: **user step**) and `pnpm backup:drill` result.
2. **Open questions** — Q1–Q4 and the two Phase 10 carries (R8 View-as read-only everywhere?, R15 `CUSTOM_SCRIPT_HOSTS`), each with its default.
3. **User-only launch steps** — the numbered list from this plan's "User-only launch steps" section, as checkboxes.
4. **Cut-over runbook** — freeze content on staging → final backup → open PR `feat/platform` → `main` → CI green → merge → `deploy` job (production) → in the production container `node admin-create.cjs` for the owner → owner signs in, sets up two-factor, invites the team → Search Console/Bing sitemap, verification codes (Admin ▸ SEO ▸ Defaults) → GTM import → DNS to Traefik → smoke test (runbook §2) → watch `[csp]` logs and the bell for a day. Rollback: runbook §3.
5. **Post-launch backlog** — the list from this plan's "Post-launch backlog" section.

- [ ] **Step 3: Full verification**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration
DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build
E2E_SKIP_BUILD=1 pnpm test:e2e --project=desktop --project=admin-desktop --grep-invert "parity:|visual:|lighthouse:|budget:|perf:"
E2E_SKIP_BUILD=1 pnpm test:e2e --project=desktop --project=mobile --project=admin-desktop --grep "lighthouse:|budget:"
E2E_SKIP_BUILD=1 pnpm test:e2e:tracking
E2E_SKIP_BUILD=1 pnpm test:e2e:appearance
pnpm test:parity
pnpm test:visual:linux && git status --short tests/e2e/__screenshots__/linux
git status --short server/db/migrations
```

Expected: all green; parity ≤ 0.1%; the Linux re-record changes nothing (the baselines are current); only `0010_notifications` is new in migrations. Re-seed (`pnpm e2e:seed`) before the shell/a11y runs if activity rows from earlier runs disturb them (Phase 5 note). The user's in-progress `tests/e2e/admin/shell/navigation.spec.ts` may fail for reasons unrelated to this phase; report, don't fix. Fill the "result" column of `docs/launch.md` §1 with pass/fail and the date; criteria that need a user step say "pending: user step N".

- [ ] **Step 4: Record the phase exit**

Append to `.superpowers/sdd/plan/progress.md`:

```
Phase 11 (dashboard data, polish and launch): code complete. Plan docs/plans/phase-11-launch.md. Rulings R1–R17. Carries closed: Phase 2.8 audit (action, created_at) index (R7), Phase 2 P2 Linux visual baselines (R11), Phase 3 Suspense blank-first-paint (Task 4 fix list, if used), Phase 4 R2 nosniff/CSP Transform Rule (runbook §9), Phase 5 bell for review requests and failed schedules (R6), Phase 7 dashboard SEO health + content gauge (R3/R4), Phase 8 CAPI failures in the bell (R6), plan final-review 0.7 Renovate (Dependabot, Phase 10). Launch is waiting on the user steps in docs/launch.md §3 and the client's content and legal sign-off (docs/content-qa.md). Open questions: Q1–Q4 + Phase 10 R8/R15.
```

- [ ] **Step 5: Commit**

```bash
git add docs/content-qa.md docs/launch.md .superpowers/sdd/plan/progress.md \
  .superpowers/sdd/phase-11-launch/progress.md
git commit -m "docs(launch): content QA sheet, launch checklist and phase 11 exit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## User-only launch steps (documented in `docs/launch.md`, never executed by the controller)

1. **Push `feat/platform`** and watch CI: `check`, `e2e` (incl. budgets), `visual`. If `visual` fails only by Linux font/arch drift, run the workflow manually with `update_baselines: true`, download the `linux-baselines` artifact, commit it over `tests/e2e/__screenshots__/linux`, push again.
2. **GitHub environments**: create `staging` and `production`, each with `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_APPLICATION_ID`; optionally require a reviewer on `production` (Q3).
3. **Dokploy**: turn off Auto Deploy on both apps; create the API key; confirm `application.deploy` exists (Q4); create the **production** app on `main` with its env (`SITE_ENV=production`, `SITE_URL`/`BETTER_AUTH_URL` on one origin, new `BETTER_AUTH_SECRET`, `CRON_SECRET`, `APP_ENCRYPTION_KEY`, email, `STORAGE_DRIVER=s3` + R2 media vars, `MEDIA_PUBLIC_URL` build arg), its domain, Traefik `X-Real-IP` overwrite, and the cron schedule.
4. **Backups**: Dokploy PostgreSQL backups → R2 destination (credentials), daily, keep 30; run one; run `pnpm backup:drill --latest` with a read-only token and record the result in the runbook.
5. **Cloudflare R2**: the media Transform Rule (nosniff + CSP for non-PDF objects; runbook §9).
6. **Resend**: verify the sending domain (SPF, DKIM, DMARC), set `EMAIL_DRIVER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`.
7. **Client content QA and legal**: the client works through `docs/content-qa.md` and signs it; the practice supplies approved Privacy/Terms/Disclaimer copy; an editor enters and publishes it; the dashboard's Content health findings list is empty (or every remaining row is an accepted decision).
8. **Staging soak**: a period of real use on staging (CSP `[csp]` logs clean, bell and emails behave) and a manual motion check (magnetic buttons, footer stagger, steps track, rail chapters — Phase 0–1 open item).
9. **Cut-over**: open and merge the PR `feat/platform` → `main`; the production deploy runs from CI; in the production container `node admin-create.cjs --email … --name …`; owner sets up two-factor and invites the team; submit the sitemap to Search Console and Bing and add their codes; import GTM; switch DNS; smoke test.
10. **Answer the open questions** Q1–Q4 and the Phase 10 carries (View-as read-only everywhere?; `CUSTOM_SCRIPT_HOSTS`).

## Post-launch backlog (not in this plan)

- Media orphan GC and byte-level dedupe across filenames (Phase 4 carry; today the same bytes + name + month reuse one row).
- Sidebar "12+" enquiries badge (Phase 2.11 slot) — needs `lib/admin/nav.ts`, which the user is editing.
- `tini` (or `exec`) so `migrate.cjs` is not run under `sh` as PID 1 during boot (plan final-review 1.12).
- Phase 10 parked minors: export `<a download>` saves a 429 body; a one-hour View-as expiry signs the admin out instead of restoring; `resendInvite` outside the lock and not refusing banned users; `authors.user_id` unique index; audit row failure after backup-code regeneration hides the new codes.
- Phase 8 parked: owner landing slugs to GA4 unsanitised; no E2E for analytics-only / marketing-only consent; Tag Assistant CSP reports.
- Phase 5/7 parked: featured-race unique violation reported as slug-taken; unpublish redirect chains not flattened; proxy 301 drops the query string.
- Phase 6 parked: confirm token in the query string; CSV neutralise after leading whitespace.
- Multi-replica caching (Redis `cacheHandlers`), first-party page-view analytics, booking integration (brief §20).

---

## Spec coverage

| Requirement | Tasks |
| --- | --- |
| KPI row: New enquiries (vs last month), published articles, subscribers, SEO health % (§9.3, contract 1) | 1 (R2), 2 |
| Enquiries this week pill chart, hatched = last week (§9.3) | 1, 2 |
| Next up: next scheduled article or oldest uncontacted enquiry, with a CTA (§9.3) | 1, 2 |
| Team activity (§9.3) | 1, 2 |
| Content health gauge: complete / needs work / missing SEO or alt (§9.3, §11) | 1 (R4), 2 |
| RBAC: aggregates only without `lead.read` (§7.2, contract 1) | 1 (R3), 3 (R6) |
| "New article" / "View site" header buttons (§9.3) | 2 |
| §4.6 findings listed in the Content health panel (§2.3 Q3) | 1 (R5), 2, 8 |
| Bell: new enquiries, scheduled publishes, delivery failures (incl. CAPI), 60 s poll, `notificationsSeenAt` (§9.1, §12.5, §8.3, contract 2) | 3 |
| Lighthouse budgets on key pages: SEO 100, a11y ≥ 95, mobile perf ≥ 90 (§3.5, §16) | 4, 5 |
| axe, image audit, bundle check (contract 3) | 4, 5 |
| Full E2E in CI with Linux visual baselines from the Playwright Docker image (contract 4) | 5 |
| Deploy only after green CI, Dokploy auto-deploy off (§16 step 8, contract 4) | 6 (R12), user step 2–3 |
| `NEXT_DEPLOYMENT_ID` = git SHA (§17) | 6 (R13) |
| `@huggingface/transformers` out of the image build (§17) | 6 (R14) |
| `docs/runbook.md`: deploy, roll back, restore, rotate secrets, recover owner, sending domain, GTM (§17) | 7 |
| Daily `pg_dump` to R2 (30 days) and a restore drill (§15, contract 5) | 7 (R15), user step 4 |
| Owner lockout recovery (§19) | 7 (R16) |
| Content QA with the client and legal pages (contract 5, §19) | 1, 8, user step 7 |
| Staging → production cut-over (contract 5) | 8 (checklist), user step 9 |
| Acceptance: every §3 criterion verified; client signs off | 8 (`docs/launch.md` §1), user steps 7 and 9 |

## Facts verified while writing this plan

- `server/modules/dashboard/service.ts` (Phase 2 v1) returns `activeUsers`, `signIns`, `security`, `changes`, `recentActivity`, `nextUp` (two-factor, invite); the route is `GET /api/v1/admin/dashboard` gated by `can({ dashboard: ["view"] })`; `week.ts` exports `DUBLIN` and `weekWindow(now)` (Monday 00:00 Europe/Dublin).
- `admin/modules/dashboard/dashboard-view.tsx` fetches in the browser so the visual suite pins it with `page.route("**/api/v1/admin/dashboard")`; `tests/e2e/fixtures/dashboard.ts` is typed against `DashboardDto`; darwin baselines `dashboard-{light,dark}.png` exist for `admin-{desktop,tablet,mobile}`; 33 darwin PNGs in total; no `linux/` folder.
- `getSeoHealth()` (`server/modules/seo/queries.ts`) is `"use cache"` and returns `{ score, passed, total, entities, issues: SeoIssue[], alt }`; issues carry `kind` (`page` | `article` | `media`), `id`, `check` (`title-length`, `title-unique`, `description`, `og-image`, `alt-text`, `h1`, `indexable`, `internal-link`); score is 100 when nothing is live.
- Audit actions that exist today include `article.publish` (actor `null` = "on schedule"), `article.schedule_failed`, `article.submit`, `tracking.capi_failed`; failed enquiry emails are `lead_activities` rows `type = 'email'`, `data.status = 'failed'`, `data.kind` `notification` | `auto-reply`.
- `admin/components/shell/notifications-button.tsx` is an honest-empty popover ("Phase 11 fills it from GET /api/v1/admin/notifications") and is **not** in the user's modified set; `topbar.tsx` renders it.
- `users` comes from Better Auth's generator (`pnpm auth:generate` → `server/db/schema/auth.ts`); the last migration is `0009_tracking`; drizzle-kit `casing: "snake_case"`.
- Seed: legal pages `/privacy`, `/terms`, `/disclaimer` are drafts with "Placeholder copy: replace before launch." / "… is a placeholder and has not been reviewed."; fixtures still contain "James", `hello@jameswhitfield.ie`, `[email]`/`[phone]`/`[Dublin, Ireland]`, "worldwide" and "Ireland, UK & USA".
- CI today: `check` (audit, lint, typecheck, unit, integration, no-DB build) and `e2e` (desktop + admin-desktop, `--grep-invert "parity:|visual:|lighthouse:|perf:"`, then tracking and appearance configs); no deploy job; no `workflow_dispatch`.
- Playwright `@playwright/test` 1.64.0; `snapshotPathTemplate` `{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}`; `tests/e2e/fixtures/env.ts` reads `DATABASE_URL_E2E`, `SMTP_URL_E2E`, `MAILPIT_URL`; `--grep` never filters dependency projects (`playwright@1.64.0/lib/runner/index.js`, `createRootSuite`).
- `docker info` succeeds locally: Docker 29.7.2 on **arm64** (hence `platform: linux/amd64`).
- `Dockerfile` already takes `ARG NEXT_DEPLOYMENT_ID`; `.dockerignore` excludes `.git`; `docker-entrypoint.sh` runs `node migrate.cjs` then `exec node server.js`; the image ships `migrate.cjs` and `admin-create.cjs`.
- `@huggingface/transformers` `^4.3.0` (installed 4.3.0) is a devDependency used only by `scripts/generate-hero-depth.mjs`; the deps stage installs devDependencies, so it is in the image build today.
- Lighthouse 13.5.0 and `@axe-core/playwright` 4.13.0 are devDependencies; the two Lighthouse specs are local-only today; axe covers only the admin.
- Next 16.3.8 docs: `deploymentId` / `NEXT_DEPLOYMENT_ID` (`?dpl=`, `x-nextjs-deployment-id`, `data-dpl-id`, `'use cache'` keys); `pnpm next experimental-analyze` exists from 16.1.

Plan complete and saved to `docs/plans/phase-11-launch.md`. Recommended execution: **Subagent-driven** (sonnet default; opus for Tasks 1, 3 and 4; fix loops only on Critical/Important findings), because Tasks 2 and 3 consume Task 1's DTO and fixtures, Task 5 records baselines from everything before it, and a mistake in the bell's permission filter or the deploy gate would leak health-adjacent data or ship an untested build.

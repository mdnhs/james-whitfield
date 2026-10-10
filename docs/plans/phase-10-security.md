# Phase 10: Users, Roles and Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner or an admin manages the team from **Admin ▸ Users & roles**: a table of people with role badges, two-factor status, invite state and last activity; an invite dialog; role change (one or several roles), ban with an optional end date, unban, "sign out everywhere", resend invite, link to an Insights author, delete; and **View as**, which opens the admin exactly as that person sees it for up to an hour, under a banner with **Stop viewing**, and is audited at both ends. A read-only **Roles & permissions** tab is generated from `lib/auth/permissions.ts`, so it can never drift from what the API enforces. The service layer enforces the brief's invariants: admins never act on owners or grant the owner role, nobody changes their own access, and the last active owner can never be demoted, banned or deleted, even when two owners act at the same moment. The Activity log gains an entity filter, a before/after field-diff viewer and a CSV export. The Account page gains two-factor management: owners and admins cannot turn it off; everyone can regenerate backup codes. The security pass enforces the CSP (after removing the `eval` report zod causes on every page), adds per-user limits on invites, View-as and exports, wires Better Auth's versioned secret rotation, documents the rotation procedure, and adds Dependabot beside the existing `pnpm audit` CI step.

**Architecture:** Every user-management write goes through new Hono routes in `server/modules/users/routes.ts` → `server/modules/users/manage.ts`, never through Better Auth's HTTP admin endpoints (they stay disabled, Phase 1 ruling). A pure `refusal()` in `server/modules/users/guard.ts` holds the owner/self rules; `manage.ts` runs each write in one transaction that takes `pg_advisory_xact_lock(hashtext('users:access'))`, re-reads the actor's and the target's roles **inside the lock**, applies the guard and the last-owner count, then writes `users`/`sessions` with Drizzle and the audit row in the same transaction. View-as is the one exception: `startViewAs()` checks the same guard and then calls `auth.api.impersonateUser` server-side with the actor's headers, forwarding Better Auth's cookies; Better Auth's own `impersonate-admins` check is a second layer. Isomorphic Zod inputs live in `lib/users/schema.ts`; the matrix generator in `lib/auth/matrix.ts`. Two-factor policy is a Better Auth plugin (`server/auth/two-factor-policy.ts`) like the existing `account-hooks`. The CSP becomes enforcing in `lib/tracking/csp.ts`; `instrumentation-client.ts` sets `z.config({ jitless: true })` before any schema module runs in the browser.

**Tech Stack:** Next.js 16.3.8 (App Router, Cache Components, `instrumentation-client.ts`, `next.config` `headers()`) · Better Auth 1.7.7 (admin + twoFactor plugins, `secrets` option) · Hono 4.13.13 + `@hono/zod-validator` 0.9.1 · Drizzle 0.45.4 · Zod 4.6.5 · TanStack Query 5.104.1 / Table · nuqs · shadcn/ui (dialog, sheet, select, checkbox, tabs, table) · Vitest · Playwright · otpauth (already a dev dependency). **No new dependencies.**

**Spec:** [`docs/brief.md`](../brief.md) (§1 Better Auth bullet, §3 criterion 4 "RBAC is provable", §6.6 `users`/`sessions`/`two_factors` and `audit_logs`, **§7.1 in full**, **§7.2 in full** incl. the invariants, **§7.4 in full**, §8.2 "CSV exports", §8.3 Users and Session rows, §9.3 "Users & roles", "Activity log", "Account" rows, §12.6 CSP, §15 Headers/AuthN/AuthZ/Supply chain, §16 unit/E2E rows, §18 Phase 10 row, §19 "Owner lockout") and the Phase 10 contract in [`docs/plan.md`](../plan.md) ("### Phase 10: Users, roles and security"). Read both first.

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

Phase-10 values from the spec (verbatim):

- "Users table (role badges, 2FA status, last active), invite dialog, role change, ban, sessions, **View as**. A read-only permission-matrix tab" (§9.3)
- "Users | `GET /admin/users` · `POST /invite` · `PATCH /:id/role` · `POST /:id/ban` · `POST /:id/unban` · `DELETE /:id/sessions` · `POST /:id/impersonate` · `DELETE /:id`" (§8.3)
- "| user.* and session.* (invite, role, ban, revoke) | ✓ | ✓ (never on owners) | — | — | — | — | — |" · "| user.impersonate / impersonate-admins | ✓ / ✓ | ✓ / — | — | — | — | — | — |" · "| audit.read | ✓ | ✓ | — | — | — | — | — |" (§7.2)
- "Admins cannot create, modify, ban, impersonate or delete owners, and cannot grant the owner role." · "The last owner cannot be demoted or deleted." · "Nobody can change their own role." · "Every user manages their own profile, password, 2FA and sessions." (§7.2)
- "**2FA.** TOTP with backup codes and 30-day trusted devices. **Mandatory for owner and admin.**" · "**Sessions.** Users list and revoke their own. Admins revoke anyone's. Bans revoke sessions immediately." · "**Impersonation ("View as").** Lasts one hour, shows a sticky banner and is audited." (§7.4)
- "Activity log | Filterable timeline with before/after field diffs" (§9.3) · "**Format.** JSON in and out. The exceptions are the media upload (multipart) and CSV exports." (§8.2)
- "Account | Profile, password, 2FA setup (QR code and backup codes), active sessions" (§9.3)
- "It ships first as **Report-Only**, then is enforced." (§12.6) · "**Supply chain.** Renovate (or Dependabot), plus `pnpm audit` in CI, and pinned majors." (§15) · "Secrets: `BETTER_AUTH_SECRET` (rotation via `BETTER_AUTH_SECRETS`)" (§7.1)
- Contract (plan.md): "1. Users admin … delete, respecting owner invariants and protecting the last owner; **View as** (impersonation banner + audit entry). 2. A read-only permission matrix page, generated from `roles`. 3. Activity log polish: field diff viewer, filters, CSV export. 4. Account security: sessions, 2FA management (owners and admins cannot disable it), backup-code regeneration. 5. Security pass: rate-limit review, `pnpm audit` in CI, the secret-rotation procedure."
- Acceptance (plan.md): "an integration matrix for the user-management endpoints, including the owner and last-owner invariants; an E2E where View as an editor hides admin-only navigation."

**New dependencies:** none. **New environment variables:** `BETTER_AUTH_SECRETS` (optional; Better Auth's own format `"<version>:<secret>,…"`, newest first). **Migrations:** none (every column exists: `users.role|banned|ban_reason|ban_expires|two_factor_enabled`, `sessions.impersonated_by`, `authors.user_id`, `audit_logs.diff|impersonated_by`).

## Review Focus

1. **Two owners at the same moment.** Owner A demotes (or bans, or deletes) owner B while B does the same to A, or an owner is removed while the only other owner is banned. Exactly one request wins; the other gets 403/409; at least one active (unbanned or ban-expired) owner always remains. → Task 1 `users-admin.test.ts` "two owners demoting each other at once leave one owner", "two owners banning each other at once leave one owner"; `manage.test.ts` (integration) "activeOwnersExcept counts only unbanned or ban-expired owners".
2. **A ban that has to bite now.** The banned person has two browsers open, and (if an admin) a View-as session in a third. Every one of those cookies is refused on the very next API call and page load; a later password sign-in is refused; a ban whose end date has passed no longer blocks. → Task 1 "a ban signs the person out everywhere, View-as sessions included", "an expired ban no longer blocks"; Task 2 "a banned person's View-as session ends with the ban".
3. **View-as as a way up.** An admin tries to view as an owner or another admin, an owner views as someone who has not set up the 2FA their role needs, someone already viewing as a person starts another View-as, or (while viewing as an admin) tries user management. All are refused with a clear message, the actor's own session is untouched, and nothing is audited as a View-as start. → Task 2 `users-view-as.test.ts` "an admin cannot view as an owner or another admin", "refuses a target who must still set up two-factor", "refuses while already viewing as someone"; Task 1 "user management refuses a View-as session".
4. **Cookie races on View-as.** The actor's own session is due for its daily refresh at the moment View-as starts, so the session middleware would append a refreshed `mk.session_token` after the impersonated one; stopping must restore the actor, not sign them out; the browser must not keep the impersonated user's cached data. → Task 2 "View-as survives a session refresh on the same response", "stopping restores the actor and audits it"; `view-as-banner.test.tsx` "stopping reloads the admin".
5. **A hostile or huge audit row.** A diff value that is a 200 KB page document, an HTML string, `null`, a non-object, or a field named `__proto__`; a summary starting with `=HYPERLINK(`. The diff viewer shows clipped plain text and never markup; the CSV export neutralises formulas, caps rows and never includes IP hashes or user agents. → Task 5 `diff.test.ts` "clips long values", "renders non-objects and nulls as text", `audit-export.test.ts` "neutralises formulas and never exports ipHash or userAgent", "caps the export".

---

## Rulings (decisions this plan takes; one line each in the hand-off)

| # | Ruling | Tasks |
| --- | --- | --- |
| R1 Writes outside Better Auth | Role, ban, unban, revoke, delete and author-link writes are Drizzle statements in one transaction with the audit row, under `pg_advisory_xact_lock(hashtext('users:access'))`, re-reading actor and target inside the lock. Better Auth's `setRole`/`banUser`/`removeUser` are not used: they check only the caller, and two separate calls cannot make the last-owner check atomic. Sessions live only in Postgres (no secondary storage), so deleting `sessions` rows is complete; every admin read already bypasses the cookie cache. | 1 |
| R2 Invariants | `refusal()`: nobody acts on themselves (except linking themselves to an author); only an owner acts on a user who holds `owner` or grants `owner`; the last **active** owner (`owner` in the comma list, and `banned` not true or `ban_expires` passed) cannot lose `owner`, be banned or be deleted → 409 `CONFLICT` with `details.reason = "LAST_OWNER"`. Because of the self rule this is reachable only through races, which the tests prove. | 1 |
| R3 Roles input | `PATCH /:id/role` takes `{ roles: RoleName[] }` (1–7, unique), stored in `ROLE_NAMES` order joined by `,` (Better Auth's multi-role format). Invite keeps one role. | 1, 4 |
| R4 Ban | `POST /:id/ban { reason?: ≤200 chars, days?: 1–365 \| null }`; `null`/absent = until unbanned. Writes Better Auth's own `banned`, `ban_reason`, `ban_expires` (its sign-in check reads them) and deletes every session of the person **and every View-as session they started** (`sessions.impersonated_by = id`). | 1 |
| R5 Last active | `lastActiveAt` = the newer of the person's latest own (non-View-as) session `updated_at` and their latest `auth.sign_in` audit row (the audit row survives session deletion). `invitePending` = no `accounts` row with `provider_id = 'credential'`. | 1 |
| R6 Author link | `PUT /:id/author { authorId: uuid \| null }` (`user.update`): one author per user — clears the user's existing links, refuses an author linked to someone else (409), audited `user.author_link`. Closes the Phase 5 R4 carry. | 1, 4 |
| R7 View-as | `POST /:id/impersonate` (`user.impersonate`): guard (R2) + target not banned (409) + target not "must set up 2FA" (409) + actor not already viewing (403 `IMPERSONATION_READ_ONLY`); then `auth.api.impersonateUser` with the actor's headers, `asResponse: true`, forwarding its `Set-Cookie`. Better Auth's `impersonate-admins` check stays as the second layer. One hour (`impersonationSessionDuration`). The start is audited by the existing `databaseHooks.session.create` (`auth.impersonate`); stop by a new after-hook (`auth.stop_impersonate`). | 2 |
| R8 View-as is read-only for access control | All `/users/*` writes refuse a View-as session (403 `IMPERSONATION_READ_ONLY`), like account self-service (Phase 2 ruling). Content writes made while viewing stay allowed and are audited with `impersonated_by` (existing behaviour; the role viewed never exceeds the actor's own powers). **Open question for the user:** should View-as be read-only everywhere? | 1, 2 |
| R9 Banner placement | The View-as banner is rendered by `app/(admin)/admin/(panel)/layout.tsx` (not inside the shell files the user is editing) as a fixed, bottom-centred bar (`role="status"`) above the sidebar's z-index. Start and stop do a full `window.location.assign` so no TanStack cache crosses identities. | 2 |
| R10 Session refresh vs Set-Cookie | The Hono `session` middleware no longer appends a refreshed cookie whose name the handler already set (View-as sets `mk.session_token`). | 2 |
| R11 Two-factor policy | New plugin `twoFactorPolicy()`: `/two-factor/disable` refused for roles that require 2FA (`TWO_FACTOR_MANDATORY`); `/two-factor/enable`, `/disable`, `/generate-backup-codes` refused during View-as; successful disable and backup-code regeneration audited (`account.two_factor_disable`, `account.backup_codes_regenerate`); enrolment audited `account.two_factor_enable` from the existing verify-totp after-hook. | 3 |
| R12 Permission matrix | `lib/auth/matrix.ts` derives rows from `statement` × `roles[name].statements`; a static `QUALIFIERS` map marks the service-enforced cells ("own" for author article create/update/delete and media update; "not owners" for admin `user.*`/`session.*`). It is a tab of `/admin/users` (`?tab=roles`), so **no `lib/admin/nav.ts` change**. | 4 |
| R13 Audit API | List gains `entityType`/`entityId` filters (Phase 1.6/2.9 carry), `hasDiff`, `impersonatorName`; `GET /audit/:id` returns the diff; `GET /audit/export.csv` takes the list filters, newest first, **max 10 000 rows**, columns When/Who/Email/Viewing-as by/Action/Entity/Entity ID/Summary, never `ip_hash`/`user_agent`, audited `audit.export`. | 5 |
| R14 Zod and CSP | The `[csp] script-src eval` report is zod 4's `allowsEval` probe (`new Function("")` in `node_modules/zod/v4/core/util.js`), evaluated when the first `z.object` is **constructed** (`schemas.js`: `const fastEnabled = jit && allowsEval.value`), e.g. by `AttributionCapture` in the site layout. `instrumentation-client.ts` calls `z.config({ jitless: true })`; zod then skips the probe (its own comment: "strict CSPs report the caught `new Function`"). Task 6 first proves the source with a violation-recording E2E. | 6 |
| R15 CSP enforcement | The header becomes `Content-Security-Policy` (still with `report-uri`). The brief's "a week of clean reports" is replaced by the zero-violation E2E sweep over every parity route and the main admin screens, because no production traffic exists yet; the staging soak before `main` (Phase 11) is the real-traffic check, and rollback is one line in `lib/tracking/csp.ts`. **Open question for the user:** any `CUSTOM_SCRIPT_HOSTS` (e.g. a GTM-loaded widget) to allow before launch? | 6 |
| R16 Rate-limit review | Kept: Better Auth DB limiter (enabled outside development) on sign-in 5/min, password reset 3/5 min, `/two-factor/*` 5/min; Postgres `api_rate_limits` on public forms/consent/CSP reports; in-memory `takeToken` on ⌘K search (single replica, brief §5.6 rule 8 — documented, not changed). Added: Better Auth `/change-password` and `/reset-password` 5 per 5 min; new DB-backed `actorLimit` (per signed-in user) on invite + resend 20/h, View-as 10/10 min, CSV exports (activity, enquiries, newsletter) 10/10 min. | 7 |
| R17 Secret rotation | `BETTER_AUTH_SECRETS` is validated by `server/env.ts` and passed as `secrets`; `BETTER_AUTH_SECRET` stays required as the legacy key, so 2FA secrets and backup codes encrypted before rotation still decrypt. Signed session cookies use only the newest secret, so **rotation signs everyone out** (documented). The procedure for every secret goes in `docs/deploy-dokploy.md` under a "Phase 10" heading (the runbook is Phase 11). | 7 |
| R18 Supply chain | `pnpm audit --prod --audit-level high` is already in CI (Phase 0.7) and stays; add `.github/dependabot.yml` (npm weekly, grouped minor/patch; ignores `next` minor/major and `hono` major per the Global Constraints; GitHub Actions monthly). | 7 |
| R19 Resend invite | `POST /:id/resend-invite` (`user.create`) for `invitePending` users only (else 409), same template as the invite, audited `user.invite_resend` (Phase 6 carry "resend-invite action"). | 1, 4 |

## File structure

| Files | Responsibility | Task |
| --- | --- | --- |
| `lib/users/schema.ts` (+ test), `server/modules/users/schema.ts` (modify), `server/modules/users/guard.ts` (+ test), `server/modules/users/manage.ts`, `server/modules/users/routes.ts` (modify), `server/api/middleware/view-as.ts`, `server/modules/account/routes.ts` (modify), `server/auth/fresh-session.ts` (modify), `tests/integration/api/users-admin.test.ts`, `tests/integration/users/manage.test.ts` | user list + every access write, invariants, matrix of endpoint tests | 1 |
| `server/modules/users/view-as.ts`, `server/modules/users/routes.ts` (modify), `server/auth/hooks.ts` (modify), `server/api/middleware/auth.ts` (modify), `admin/modules/users/view-as-banner.tsx` (+ test), `app/(admin)/admin/(panel)/layout.tsx` (modify), `tests/integration/api/users-view-as.test.ts` | View-as start/stop, audit, banner | 2 |
| `server/auth/two-factor-policy.ts`, `server/auth/auth.ts` (modify), `server/auth/hooks.ts` (modify), `tests/integration/helpers/two-factor.ts`, `tests/integration/auth/two-factor-policy.test.ts`, `admin/modules/account/two-factor-card.tsx` (+ test), `admin/modules/account/account-view.tsx` (modify) | 2FA management and backup codes | 3 |
| `lib/auth/matrix.ts` (+ test), `lib/auth/role-labels.ts`, `admin/lib/{api,query-keys}.ts` (modify), `admin/modules/users/*` (view, table, dialogs, matrix, queries, present + tests), `app/(admin)/admin/(panel)/users/page.tsx` | Users & roles screen and matrix tab | 4 |
| `server/modules/audit/{schema,repo,service,routes}.ts` (modify), `lib/audit/diff.ts` (+ test), `admin/modules/activity/params.ts`, `admin/modules/activity/queries.ts`, `admin/modules/activity/activity-view.tsx` (modify), `admin/modules/activity/activity-detail.tsx`, `admin/lib/query-keys.ts` (modify), `tests/integration/api/audit.test.ts` (modify), `tests/integration/api/audit-export.test.ts` | Activity filters, diff viewer, CSV | 5 |
| `instrumentation-client.ts`, `lib/tracking/csp.ts` (+ test, modify), `server/modules/security/csp-report.ts` (modify), `tests/integration/api/csp-report.test.ts` (modify), `tests/e2e/navigation/headers.spec.ts` (modify), `tests/e2e/navigation/csp.spec.ts`, `tests/e2e/admin/shell/csp.spec.ts`, `tests/e2e/support/csp.ts` | eval trace, jitless, enforcing CSP | 6 |
| `server/api/middleware/actor-limit.ts`, `server/modules/{users,audit,leads,newsletter}/routes.ts` (modify), `server/auth/auth.ts` (modify), `server/auth/secrets.ts` (+ test), `server/env.ts` (modify), `tests/integration/api/actor-limit.test.ts`, `tests/integration/auth/secret-rotation.test.ts`, `docs/deploy-dokploy.md` (modify), `.github/dependabot.yml` | rate limits, secret rotation, supply chain | 7 |
| `tests/e2e/admin/users/view-as.spec.ts`, `.superpowers/sdd/plan/progress.md` | acceptance E2E, phase exit | 8 |

**Files this plan never touches** (the user's uncommitted work): `admin/components/shell/*` (incl. the new `footer-dock.tsx`, `section-tabs.tsx`), `app/(admin)/admin.css`, `lib/admin/nav.ts`, `admin/modules/pages/page-builder.tsx`, `tests/e2e/admin/shell/navigation.spec.ts`. Stage files by path only (`git add <paths>`), never `git add -A`/`.`.

## Conventions for executing this plan

- Run `pnpm db:up` before integration tests. No migration is generated in this phase; `git status server/db/migrations` must stay clean.
- Integration tests use `resetDb` per test, `cookieFor(role)` / `createUser` / `signIn` / `signInWithTwoFactor` / `viewAs(cookie, userId)` / `adminRequest(path, cookie, { method, body, origin })` from `tests/integration/helpers/auth.ts`, and `readOutbox`/`clearOutbox` from `@/server/lib/email`.
- Better Auth errors from hooks answer `{ code, message }` at the top level (see `tests/integration/api/admin-endpoints.test.ts`); our Hono errors answer `{ error: { code, message, requestId, details? } }`.
- The build has no database: `DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build` must pass after Tasks 2, 4 and 6.
- Admin pages gate with `requirePermission(permissionFor("/admin/…"))` inside Suspense, as `app/(admin)/admin/(panel)/activity/page.tsx` does. `/admin/users` already has a registry entry (`permission: { user: ["list"] }`); the real `users/page.tsx` folder takes precedence over the `[section]` placeholder.
- Commit messages: Conventional Commits, written normally, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Next-specific APIs were checked in `node_modules/next/dist/docs/01-app/`: `03-api-reference/03-file-conventions/instrumentation-client.md` ("side-effects that run before your application becomes interactive … polyfills"), `02-guides/content-security-policy.md` ("Without Nonces"; nonces are incompatible with Partial Prerendering), `02-guides/authentication-with-cache-components.md`. Re-read before changing how any of them is used.
- Better Auth internals this plan relies on were read in `node_modules/better-auth/dist/`: `plugins/admin/routes.mjs` (`impersonateUser` checks `user:["impersonate"]`, and `impersonate-admins` when the target holds an `adminRoles` role; sets `admin_session` and the new session cookie; `stopImpersonating` reads `getSessionFromCtx` and restores `admin_session`), `context/create-context.mjs` + `context/secret-utils.mjs` (`options.secrets ?? parseSecretsEnv(env.BETTER_AUTH_SECRETS)`, legacy `secret` kept for decryption), `plugins/two-factor/*` (TOTP secret and backup codes encrypted with `secretConfig`).

---

### Task 1: User management service and routes — list, roles, ban, unban, sign-out-everywhere, delete, resend invite, author link, invariants

**Model:** opus

**Files:**
- Create: `lib/users/schema.ts`, `lib/users/schema.test.ts`
- Modify: `server/modules/users/schema.ts` (re-export), `server/modules/users/routes.ts`, `server/modules/account/routes.ts` (use the shared middleware), `server/auth/fresh-session.ts` (export `isBanned`)
- Create: `server/modules/users/guard.ts`, `server/modules/users/guard.test.ts`, `server/modules/users/manage.ts`, `server/api/middleware/view-as.ts`
- Test: `tests/integration/api/users-admin.test.ts`, `tests/integration/users/manage.test.ts`

**Interfaces:**
- Consumes: `Actor` (`server/auth/actor.ts`), `hasPermission`, `parseRoles`, `ROLE_NAMES`, `RoleName`, `Permissions` (`lib/auth/permissions.ts`), `audit(actor, entry, db?)` (`server/lib/audit.ts`), `provisionUser`, `inviteUser`, `inviteRedirect` (`server/modules/users/service.ts`), `ApiError` (`server/api/errors.ts`).
- Produces:
  - `lib/users/schema.ts`: `InviteInput`, `RolesInput` (`{ roles: RoleName[] }`), `BanInput` (`{ reason?: string; days?: number | null }`), `AuthorLinkInput` (`{ authorId: string | null }`), `UserListQuery` (`{ page; pageSize; q?; role?; status?: "active" | "banned" | "invited" | "no-2fa" }`), `USER_STATUSES`, and types of the same names.
  - `server/modules/users/guard.ts`: `type ManageAction = "set-role" | "ban" | "unban" | "revoke" | "delete" | "impersonate" | "resend" | "link-author"`, `refusal(actor: GuardActor, target: GuardTarget, action: ManageAction, nextRoles?: readonly RoleName[]): string | null`, `losesOwner(target: GuardTarget, action: ManageAction, nextRoles?: readonly RoleName[]): boolean`.
  - `server/modules/users/manage.ts`: `type UserDto`, `listUsers(query: UserListQuery)`, `getUser(id: string): Promise<UserDto>`, `setRoles(actor, id, input)`, `banUser(actor, id, input)`, `unbanUser(actor, id)`, `revokeUserSessions(actor, id): Promise<{ revoked: number }>`, `deleteUser(actor, id): Promise<{ ok: true }>`, `resendInvite(actor, id): Promise<{ ok: true }>`, `linkAuthor(actor, id, input)`, `activeOwnersExcept(db: DbLike, id: string): Promise<number>`, `loadTarget(id: string): Promise<TargetRow>` (used by Task 2).
  - `server/api/middleware/view-as.ts`: `notViewingAs(message: string)` Hono middleware.
  - `server/modules/users/routes.ts`: `usersRoutes`, `type UsersRoutes`.

- [ ] **Step 1: Write the failing guard unit test**

```ts
// server/modules/users/guard.test.ts
import { describe, expect, it } from "vitest"

import { losesOwner, refusal } from "./guard"

const owner = { userId: "o1", roles: ["owner"] as const }
const admin = { userId: "a1", roles: ["admin"] as const }
const t = (id: string, roles: string[]) =>
  ({ id, roles }) as Parameters<typeof refusal>[1]

describe("refusal", () => {
  it("refuses acting on yourself, except linking an author", () => {
    expect(refusal(owner, t("o1", ["owner"]), "set-role", ["owner"])).toBe(
      "You can't change your own role"
    )
    for (const action of ["ban", "unban", "revoke", "delete", "impersonate"] as const)
      expect(refusal(owner, t("o1", ["owner"]), action)).toMatch(/your own/)
    expect(refusal(owner, t("o1", ["owner"]), "link-author")).toBeNull()
  })

  it("never lets an admin act on an owner, multi-role owners included", () => {
    expect(refusal(admin, t("x", ["owner"]), "ban")).toBe(
      "Only an owner can manage another owner"
    )
    expect(refusal(admin, t("x", ["editor", "owner"]), "delete")).toBe(
      "Only an owner can manage another owner"
    )
  })

  it("never lets an admin grant the owner role", () => {
    expect(
      refusal(admin, t("x", ["editor"]), "set-role", ["editor", "owner"])
    ).toBe("Only an owner can grant the owner role")
  })

  it("lets an owner act on owners and an admin on non-owners", () => {
    expect(refusal(owner, t("o2", ["owner"]), "set-role", ["admin"])).toBeNull()
    expect(refusal(admin, t("e", ["editor"]), "set-role", ["marketer"])).toBeNull()
    expect(refusal(admin, t("a2", ["admin"]), "ban")).toBeNull()
  })
})

describe("losesOwner", () => {
  it("is true only when an owner loses the role or the account", () => {
    const o = t("o2", ["owner"])
    expect(losesOwner(o, "set-role", ["admin"])).toBe(true)
    expect(losesOwner(o, "set-role", ["owner", "editor"])).toBe(false)
    expect(losesOwner(o, "ban")).toBe(true)
    expect(losesOwner(o, "delete")).toBe(true)
    expect(losesOwner(o, "revoke")).toBe(false)
    expect(losesOwner(t("e", ["editor"]), "delete")).toBe(false)
  })
})
```

- [ ] **Step 2: Write the failing schema unit test**

```ts
// lib/users/schema.test.ts
import { describe, expect, it } from "vitest"

import { BanInput, RolesInput, UserListQuery } from "./schema"

describe("RolesInput", () => {
  it("orders roles like ROLE_NAMES and refuses duplicates or none", () => {
    expect(RolesInput.parse({ roles: ["viewer", "editor"] }).roles).toEqual([
      "editor",
      "viewer",
    ])
    expect(RolesInput.safeParse({ roles: [] }).success).toBe(false)
    expect(RolesInput.safeParse({ roles: ["editor", "editor"] }).success).toBe(false)
    expect(RolesInput.safeParse({ roles: ["editor,owner"] }).success).toBe(false)
  })
})

describe("BanInput", () => {
  it("accepts a reason and 1–365 days, or no end date", () => {
    expect(BanInput.parse({})).toEqual({ days: null })
    expect(BanInput.parse({ reason: "  left  ", days: 7 })).toEqual({
      reason: "left",
      days: 7,
    })
    expect(BanInput.safeParse({ days: 0 }).success).toBe(false)
    expect(BanInput.safeParse({ days: 366 }).success).toBe(false)
    expect(BanInput.safeParse({ reason: "x".repeat(201) }).success).toBe(false)
  })
})

describe("UserListQuery", () => {
  it("coerces paging and bounds the search", () => {
    expect(UserListQuery.parse({ page: "2" })).toMatchObject({
      page: 2,
      pageSize: 50,
    })
    expect(UserListQuery.safeParse({ q: "x".repeat(101) }).success).toBe(false)
    expect(UserListQuery.safeParse({ status: "deleted" }).success).toBe(false)
  })
})
```

- [ ] **Step 3: Run both to verify they fail**

Run: `pnpm vitest run --project unit server/modules/users/guard.test.ts lib/users/schema.test.ts`
Expected: FAIL with "Failed to resolve import "./guard"" and "./schema".

- [ ] **Step 4: Implement the schemas and the guard**

```ts
// lib/users/schema.ts
import * as z from "zod"

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"

// Isomorphic: the Users screen validates with the same schemas the API uses.
const Role = z.enum(ROLE_NAMES as [RoleName, ...RoleName[]], {
  error: "Choose a role",
})

export const InviteInput = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter a valid email address" })),
  name: z.string().trim().min(1, "Enter a name").max(120),
  role: Role,
})
export type InviteInput = z.infer<typeof InviteInput>

// Several roles are stored as one comma-separated string (Better Auth's
// format); a fixed order keeps diffs and comparisons stable (Ruling R3).
export const RolesInput = z.object({
  roles: z
    .array(Role)
    .min(1, "Choose at least one role")
    .max(ROLE_NAMES.length)
    .refine((roles) => new Set(roles).size === roles.length, {
      message: "Each role can be chosen once",
    })
    .transform((roles) => ROLE_NAMES.filter((name) => roles.includes(name))),
})
export type RolesInput = z.output<typeof RolesInput>

export const BanInput = z.object({
  reason: z
    .string()
    .trim()
    .max(200, "Keep the reason under 200 characters")
    .optional()
    .transform((value) => value || undefined),
  days: z.number().int().min(1).max(365).nullable().default(null),
})
export type BanInput = z.output<typeof BanInput>

export const AuthorLinkInput = z.object({ authorId: z.uuid().nullable() })
export type AuthorLinkInput = z.infer<typeof AuthorLinkInput>

export const USER_STATUSES = ["active", "banned", "invited", "no-2fa"] as const

export const UserListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().min(1).max(100).optional(),
  role: Role.optional(),
  status: z.enum(USER_STATUSES).optional(),
})
export type UserListQuery = z.output<typeof UserListQuery>
```

`BanInput.parse({ reason: "  left  ", days: 7 })` returns `{ reason: "left", days: 7 }`; `BanInput.parse({})` returns `{ days: null }` because the `reason` transform yields `undefined` and Zod omits undefined optional keys from `toEqual`'s view.

```ts
// server/modules/users/schema.ts
// The schemas are isomorphic (the Users screen uses them too).
export { InviteInput } from "@/lib/users/schema"
export type { InviteInput as InviteInputType } from "@/lib/users/schema"
```

Keep `import type { InviteInput } from "./schema"` working in `service.ts` by changing it to `import type { InviteInput } from "@/lib/users/schema"`, and update `server/modules/users/service.test.ts` imports the same way if it imports from `./schema`.

```ts
// server/modules/users/guard.ts
import "server-only"

import type { RoleName } from "@/lib/auth/permissions"

// docs/brief.md §7.2 invariants that need no database. The last-owner rule
// needs a count, so it lives in manage.ts inside the access lock (R2).
export type ManageAction =
  | "set-role"
  | "ban"
  | "unban"
  | "revoke"
  | "delete"
  | "impersonate"
  | "resend"
  | "link-author"

export type GuardActor = { userId: string; roles: readonly RoleName[] }
export type GuardTarget = { id: string; roles: readonly RoleName[] }

const SELF_ALLOWED: ReadonlySet<ManageAction> = new Set(["link-author"])

export function refusal(
  actor: GuardActor,
  target: GuardTarget,
  action: ManageAction,
  nextRoles?: readonly RoleName[]
): string | null {
  if (actor.userId === target.id && !SELF_ALLOWED.has(action)) {
    return action === "set-role"
      ? "You can't change your own role"
      : "Manage your own account from the Account page"
  }
  const actorIsOwner = actor.roles.includes("owner")
  if (target.roles.includes("owner") && !actorIsOwner)
    return "Only an owner can manage another owner"
  if (nextRoles?.includes("owner") && !actorIsOwner)
    return "Only an owner can grant the owner role"
  return null
}

export function losesOwner(
  target: GuardTarget,
  action: ManageAction,
  nextRoles?: readonly RoleName[]
) {
  if (!target.roles.includes("owner")) return false
  if (action === "ban" || action === "delete") return true
  return action === "set-role" && !nextRoles?.includes("owner")
}
```

Note the self message "Manage your own account from the Account page" matches `/your own/` in the test.

- [ ] **Step 5: Run the unit tests to verify they pass**

Run: `pnpm vitest run --project unit server/modules/users/guard.test.ts lib/users/schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing integration tests**

```ts
// tests/integration/users/manage.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"

import { closeDb, getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"
import { activeOwnersExcept } from "@/server/modules/users/manage"

import { createUser } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("activeOwnersExcept", () => {
  it("counts only unbanned or ban-expired owners, multi-role included", async () => {
    const a = await createUser("owner", "a@example.com")
    const b = await createUser("owner", "b@example.com")
    const c = await createUser("owner", "c@example.com")
    const d = await createUser("editor", "d@example.com")
    const db = getDb()
    await db.update(users).set({ role: "editor,owner" }).where(eq(users.id, d.id))
    // b: banned for good; c: a ban that ended yesterday.
    await db.update(users).set({ banned: true }).where(eq(users.id, b.id))
    await db
      .update(users)
      .set({ banned: true, banExpires: new Date(Date.now() - 86_400_000) })
      .where(eq(users.id, c.id))

    expect(await activeOwnersExcept(db, a.id)).toBe(2) // c, d
    expect(await activeOwnersExcept(db, d.id)).toBe(2) // a, c
  })
})
```

```ts
// tests/integration/api/users-admin.test.ts
import { and, eq } from "drizzle-orm"
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import type { RoleName } from "@/lib/auth/permissions"
import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, authors, sessions, users } from "@/server/db/schema"
import { clearOutbox, readOutbox } from "@/server/lib/email"

import {
  adminRequest,
  cookieFor,
  createUser,
  signIn,
  signInWithTwoFactor,
  viewAs,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterEach(clearOutbox)
afterAll(closeDb)

const ROLES: RoleName[] = ["owner", "admin", "editor", "author", "marketer", "intake", "viewer"]
const json = async (r: Response) => (await r.json()) as Record<string, any>
const roleOf = async (id: string) =>
  (await getDb().query.users.findFirst({ where: eq(users.id, id) }))?.role
const actions = async (action: string) =>
  getDb().select().from(auditLogs).where(eq(auditLogs.action, action))

describe("GET /users (user.list)", () => {
  it.each(ROLES)("as %s", async (role) => {
    const cookie = await cookieFor(role)
    const response = await adminRequest("/users", cookie)
    expect(response.status).toBe(
      role === "owner" || role === "admin" ? 200 : 403
    )
  })

  it("lists roles, 2FA, invite state and last activity, and nothing secret", async () => {
    const cookie = await cookieFor("owner")
    await createUser("editor", "ed@example.com")
    await signIn("ed@example.com")
    await adminRequest("/users/invite", cookie, {
      method: "POST",
      body: { email: "new@example.com", name: "New", role: "viewer" },
    })

    const body = await json(await adminRequest("/users?pageSize=10", cookie))

    expect(body.total).toBe(3)
    const ed = body.items.find((u: any) => u.email === "ed@example.com")
    expect(ed).toMatchObject({
      roles: ["editor"],
      twoFactorEnabled: false,
      banned: false,
      invitePending: false,
      author: null,
    })
    expect(Date.parse(ed.lastActiveAt)).toBeGreaterThan(Date.now() - 60_000)
    const invited = body.items.find((u: any) => u.email === "new@example.com")
    expect(invited).toMatchObject({ invitePending: true, lastActiveAt: null })
    expect(Object.keys(ed).sort()).toEqual(
      [
        "author", "banExpires", "banReason", "banned", "createdAt", "email",
        "id", "invitePending", "lastActiveAt", "name", "roles", "twoFactorEnabled",
      ].sort()
    )
  })

  it("filters by search, role and status", async () => {
    const cookie = await cookieFor("owner")
    await createUser("editor", "zed@example.com")
    const v = await createUser("viewer", "vee@example.com")
    await getDb().update(users).set({ banned: true }).where(eq(users.id, v.id))

    const q = await json(await adminRequest("/users?q=ZED", cookie))
    expect(q.items.map((u: any) => u.email)).toEqual(["zed@example.com"])
    const role = await json(await adminRequest("/users?role=viewer", cookie))
    expect(role.items.map((u: any) => u.email)).toEqual(["vee@example.com"])
    const banned = await json(await adminRequest("/users?status=banned", cookie))
    expect(banned.items.map((u: any) => u.email)).toEqual(["vee@example.com"])
    // A literal % is a search for "%", not a wildcard.
    expect((await json(await adminRequest("/users?q=%25", cookie))).total).toBe(0)
  })
})

describe("PATCH /users/:id/role", () => {
  const setRoles = (cookie: string, id: string, roles: unknown) =>
    adminRequest(`/users/${id}/role`, cookie, { method: "PATCH", body: { roles } })

  it.each(ROLES)("needs user.set-role (as %s)", async (role) => {
    const cookie = await cookieFor(role)
    const target = await createUser("viewer", "t@example.com")
    const response = await setRoles(cookie, target.id, ["editor"])
    expect(response.status).toBe(
      role === "owner" || role === "admin" ? 200 : 403
    )
  })

  it("stores several roles in a fixed order and audits the change", async () => {
    const cookie = await cookieFor("admin")
    const target = await createUser("viewer", "t@example.com")
    const response = await setRoles(cookie, target.id, ["marketer", "editor"])
    expect(response.status).toBe(200)
    expect((await json(response)).roles).toEqual(["editor", "marketer"])
    expect(await roleOf(target.id)).toBe("editor,marketer")
    const [row] = await actions("user.role")
    expect(row).toMatchObject({
      entityId: target.id,
      diff: { role: { from: "viewer", to: "editor,marketer" } },
    })
  })

  it("never lets an admin change an owner or grant owner", async () => {
    const cookie = await cookieFor("admin")
    const owner = await createUser("owner", "o@example.com")
    const editor = await createUser("editor", "e@example.com")
    expect((await setRoles(cookie, owner.id, ["viewer"])).status).toBe(403)
    expect((await setRoles(cookie, editor.id, ["owner"])).status).toBe(403)
    expect(await roleOf(owner.id)).toBe("owner")
    expect(await roleOf(editor.id)).toBe("editor")
  })

  it("lets an owner promote and demote another owner", async () => {
    const cookie = await cookieFor("owner")
    const other = await createUser("editor", "o2@example.com")
    expect((await setRoles(cookie, other.id, ["owner"])).status).toBe(200)
    expect((await setRoles(cookie, other.id, ["admin"])).status).toBe(200)
    expect(await roleOf(other.id)).toBe("admin")
  })

  it("refuses your own role, unknown roles and duplicates", async () => {
    const cookie = await cookieFor("owner")
    const me = await getDb().query.users.findFirst({
      where: eq(users.email, "owner@example.com"),
    })
    const target = await createUser("viewer", "t@example.com")
    expect((await setRoles(cookie, me!.id, ["admin"])).status).toBe(403)
    expect((await setRoles(cookie, target.id, ["root"])).status).toBe(400)
    expect((await setRoles(cookie, target.id, ["editor", "editor"])).status).toBe(400)
    expect((await setRoles(cookie, target.id, [])).status).toBe(400)
  })

  it("404s an unknown person and refuses a cross-origin call", async () => {
    const cookie = await cookieFor("owner")
    const target = await createUser("viewer", "t@example.com")
    expect(
      (await setRoles(cookie, "00000000-0000-4000-8000-000000000000", ["editor"]))
        .status
    ).toBe(404)
    const cross = await adminRequest(`/users/${target.id}/role`, cookie, {
      method: "PATCH",
      body: { roles: ["editor"] },
      origin: "https://evil.example",
    })
    expect(cross.status).toBe(403)
  })

  it("two owners demoting each other at once leave one owner", async () => {
    await createUser("owner", "a@example.com")
    await createUser("owner", "b@example.com")
    const a = await signInWithTwoFactor("a@example.com")
    const b = await signInWithTwoFactor("b@example.com")
    const idOf = async (email: string) =>
      (await getDb().query.users.findFirst({ where: eq(users.email, email) }))!.id
    const [ra, rb] = await Promise.all([
      setRoles(a, await idOf("b@example.com"), ["admin"]),
      setRoles(b, await idOf("a@example.com"), ["admin"]),
    ])
    expect([ra.status, rb.status].sort()).toEqual([200, 403])
    const owners = (await getDb().select().from(users)).filter((u) =>
      (u.role ?? "").split(",").includes("owner")
    )
    expect(owners).toHaveLength(1)
  })
})

describe("ban and unban", () => {
  it("a ban signs the person out everywhere, View-as sessions included", async () => {
    const cookie = await cookieFor("owner")
    const target = await createUser("admin", "ad@example.com")
    const one = await signInWithTwoFactor("ad@example.com")
    const two = await signIn("ad@example.com")
    const editor = await createUser("editor", "ed@example.com")
    const viewing = await viewAs(one, editor.id)

    const response = await adminRequest(`/users/${target.id}/ban`, cookie, {
      method: "POST",
      body: { reason: "Left the practice", days: 30 },
    })

    expect(response.status).toBe(200)
    expect(await json(response)).toMatchObject({
      banned: true,
      banReason: "Left the practice",
    })
    for (const c of [one, two, viewing])
      expect((await adminRequest("/me", c)).status).toBe(401)
    expect(
      await getDb().select().from(sessions).where(eq(sessions.userId, target.id))
    ).toHaveLength(0)
    await expect(
      getAuth().api.signInEmail({
        body: { email: "ad@example.com", password: "correct horse battery staple" },
      })
    ).rejects.toThrow()
    expect(await actions("user.ban")).toHaveLength(1)
  })

  it("an expired ban no longer blocks", async () => {
    const cookie = await cookieFor("owner")
    const target = await createUser("editor", "ed@example.com")
    await adminRequest(`/users/${target.id}/ban`, cookie, { method: "POST", body: { days: 1 } })
    await getDb()
      .update(users)
      .set({ banExpires: new Date(Date.now() - 1000) })
      .where(eq(users.id, target.id))
    const fresh = await signIn("ed@example.com")
    expect((await adminRequest("/me", fresh)).status).toBe(200)
  })

  it("unban clears the ban and is audited", async () => {
    const cookie = await cookieFor("admin")
    const target = await createUser("editor", "ed@example.com")
    await adminRequest(`/users/${target.id}/ban`, cookie, { method: "POST", body: {} })
    const response = await adminRequest(`/users/${target.id}/unban`, cookie, { method: "POST" })
    expect(await json(response)).toMatchObject({ banned: false, banReason: null, banExpires: null })
    expect(await actions("user.unban")).toHaveLength(1)
  })

  it("an admin cannot ban an owner; nobody bans themselves", async () => {
    const admin = await cookieFor("admin")
    const owner = await createUser("owner", "o@example.com")
    expect(
      (await adminRequest(`/users/${owner.id}/ban`, admin, { method: "POST", body: {} })).status
    ).toBe(403)
    const me = await getDb().query.users.findFirst({ where: eq(users.email, "admin@example.com") })
    expect(
      (await adminRequest(`/users/${me!.id}/ban`, admin, { method: "POST", body: {} })).status
    ).toBe(403)
  })

  it("two owners banning each other at once leave one owner", async () => {
    await createUser("owner", "a@example.com")
    await createUser("owner", "b@example.com")
    const a = await signInWithTwoFactor("a@example.com")
    const b = await signInWithTwoFactor("b@example.com")
    const id = async (email: string) =>
      (await getDb().query.users.findFirst({ where: eq(users.email, email) }))!.id
    const [ra, rb] = await Promise.all([
      adminRequest(`/users/${await id("b@example.com")}/ban`, a, { method: "POST", body: {} }),
      adminRequest(`/users/${await id("a@example.com")}/ban`, b, { method: "POST", body: {} }),
    ])
    // The loser's own session was deleted by the winner's ban: 401, or 403/409
    // when it got past the session check before the ban committed.
    expect([ra.status, rb.status].filter((s) => s === 200)).toHaveLength(1)
    const active = (await getDb().select().from(users)).filter((u) => !u.banned)
    expect(active).toHaveLength(1)
  })
})

describe("DELETE /users/:id/sessions (session.revoke)", () => {
  it("signs every device out and reports the count", async () => {
    const cookie = await cookieFor("admin")
    const target = await createUser("editor", "ed@example.com")
    const one = await signIn("ed@example.com")
    const two = await signIn("ed@example.com")
    const response = await adminRequest(`/users/${target.id}/sessions`, cookie, { method: "DELETE" })
    expect(await json(response)).toEqual({ revoked: 2 })
    for (const c of [one, two]) expect((await adminRequest("/me", c)).status).toBe(401)
    expect(await actions("user.sessions_revoke")).toHaveLength(1)
  })

  it.each(ROLES.filter((r) => r !== "owner" && r !== "admin"))(
    "is refused for %s",
    async (role) => {
      const cookie = await cookieFor(role)
      const target = await createUser("viewer", "t@example.com")
      const r = await adminRequest(`/users/${target.id}/sessions`, cookie, { method: "DELETE" })
      expect(r.status).toBe(403)
    }
  )
})

describe("DELETE /users/:id (user.delete)", () => {
  it("deletes a person; their audit rows keep the email", async () => {
    const cookie = await cookieFor("owner")
    const target = await createUser("editor", "ed@example.com")
    const edCookie = await signIn("ed@example.com")
    const response = await adminRequest(`/users/${target.id}`, cookie, { method: "DELETE" })
    expect(response.status).toBe(200)
    expect((await adminRequest("/me", edCookie)).status).toBe(401)
    expect(await getDb().query.users.findFirst({ where: eq(users.id, target.id) })).toBeUndefined()
    const [del] = await actions("user.delete")
    expect(del).toMatchObject({ entityId: target.id, summary: "Deleted ed@example.com" })
  })

  it("an admin cannot delete an owner; nobody deletes themselves", async () => {
    const admin = await cookieFor("admin")
    const owner = await createUser("owner", "o@example.com")
    expect((await adminRequest(`/users/${owner.id}`, admin, { method: "DELETE" })).status).toBe(403)
    const me = await getDb().query.users.findFirst({ where: eq(users.email, "admin@example.com") })
    expect((await adminRequest(`/users/${me!.id}`, admin, { method: "DELETE" })).status).toBe(403)
  })
})

describe("POST /users/:id/resend-invite", () => {
  it("re-sends a pending invite and refuses once a password is set", async () => {
    const cookie = await cookieFor("owner")
    const invited = await json(
      await adminRequest("/users/invite", cookie, {
        method: "POST",
        body: { email: "new@example.com", name: "New", role: "viewer" },
      })
    )
    clearOutbox()
    const again = await adminRequest(`/users/${invited.id}/resend-invite`, cookie, { method: "POST" })
    expect(again.status).toBe(200)
    expect(readOutbox()[0]!.subject).toBe("You're invited to the Magda Kennedy admin")
    const active = await createUser("editor", "ed@example.com")
    const done = await adminRequest(`/users/${active.id}/resend-invite`, cookie, { method: "POST" })
    expect(done.status).toBe(409)
  })
})

describe("PUT /users/:id/author", () => {
  const author = async (slug: string) =>
    (await getDb().insert(authors).values({ slug, name: slug }).returning())[0]!

  it("links one author, moves the link, refuses someone else's, unlinks", async () => {
    const cookie = await cookieFor("admin")
    const writer = await createUser("author", "w@example.com")
    const other = await createUser("author", "x@example.com")
    const a1 = await author("anna")
    const a2 = await author("ben")
    const put = (id: string, authorId: string | null) =>
      adminRequest(`/users/${id}/author`, cookie, { method: "PUT", body: { authorId } })

    expect((await json(await put(writer.id, a1.id))).author).toEqual({ id: a1.id, name: "anna" })
    await put(writer.id, a2.id)
    const linked = await getDb().select().from(authors).where(eq(authors.userId, writer.id))
    expect(linked.map((a) => a.id)).toEqual([a2.id])
    expect((await put(other.id, a2.id)).status).toBe(409)
    expect((await json(await put(writer.id, null))).author).toBeNull()
    expect(await actions("user.author_link")).toHaveLength(3)
  })
})

describe("View-as sessions", () => {
  it("user management refuses a View-as session", async () => {
    const owner = await cookieFor("owner")
    const admin = await createUser("admin", "ad@example.com")
    await getDb().update(users).set({ twoFactorEnabled: true }).where(eq(users.id, admin.id))
    const target = await createUser("viewer", "t@example.com")
    const viewing = await viewAs(owner, admin.id)
    const r = await adminRequest(`/users/${target.id}/role`, viewing, {
      method: "PATCH",
      body: { roles: ["editor"] },
    })
    expect(r.status).toBe(403)
    expect((await json(r)).error.code).toBe("IMPERSONATION_READ_ONLY")
  })
})
```

The tests use `and` only if needed; remove unused imports before committing (ESLint fails on them).

- [ ] **Step 7: Run them to verify they fail**

Run: `pnpm db:up && pnpm vitest run --project integration tests/integration/api/users-admin.test.ts tests/integration/users/manage.test.ts`
Expected: FAIL — `GET /users` answers 404 ("Route not found"), and `@/server/modules/users/manage` cannot be resolved.

- [ ] **Step 8: Implement the shared View-as middleware**

```ts
// server/api/middleware/view-as.ts
import "server-only"

import { createMiddleware } from "hono/factory"

import { ApiError } from "../errors"
import type { AppEnv } from "../types"

// View-as shows what a role can see; it never changes anyone's access or
// account (docs/brief.md §7.4; Rulings R8 and the Phase 2 account ruling).
export const notViewingAs = (message: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (c.get("actor")?.impersonatedBy) {
      throw new ApiError("IMPERSONATION_READ_ONLY", message)
    }
    await next()
  })
```

In `server/modules/account/routes.ts` delete the local `notViewingAs` and its `createMiddleware`/`ApiError` imports, add `import { notViewingAs } from "@/server/api/middleware/view-as"` and `const viewingAs = notViewingAs("Account settings can't be changed while viewing as someone")`, and use `viewingAs` where `notViewingAs` was used (three routes). `tests/integration/api/account-sessions.test.ts` must still pass unchanged.

- [ ] **Step 9: Implement the service**

In `server/auth/fresh-session.ts` change `function isBanned(` to `export function isBanned(` (the lock re-checks the actor's ban; Task 2 reuses it).


```ts
// server/modules/users/manage.ts
import "server-only"

import { and, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm"

import {
  hasPermission,
  parseRoles,
  type Permissions,
  type RoleName,
} from "@/lib/auth/permissions"
import type {
  AuthorLinkInput,
  BanInput,
  RolesInput,
  UserListQuery,
} from "@/lib/users/schema"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getAuth } from "@/server/auth/auth"
import { isBanned } from "@/server/auth/fresh-session"
import { getDb, type DbLike } from "@/server/db/client"
import { accounts, auditLogs, authors, sessions, users } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"

import { losesOwner, refusal, type ManageAction } from "./guard"
import { inviteRedirect } from "./service"

export type UserDto = {
  id: string
  name: string
  email: string
  roles: RoleName[]
  twoFactorEnabled: boolean
  banned: boolean
  banReason: string | null
  banExpires: string | null
  invitePending: boolean
  lastActiveAt: string | null
  createdAt: string
  author: { id: string; name: string } | null
}

export type TargetRow = {
  id: string
  name: string
  email: string
  roles: RoleName[]
  role: string | null
  banned: boolean
  banExpires: Date | null
  twoFactorEnabled: boolean
}

const ownerSql = sql`'owner' = any(string_to_array(${users.role}, ','))`
// Better Auth lifts a ban once ban_expires has passed (Review Focus #2).
const activeSql = sql`(${users.banned} is not true or (${users.banExpires} is not null and ${users.banExpires} <= now()))`

const lastSession = sql<Date | null>`(select max(s.updated_at) from ${sessions} s where s.user_id = ${users.id} and s.impersonated_by is null)`
const lastSignIn = sql<Date | null>`(select max(a.created_at) from ${auditLogs} a where a.entity_type = 'user' and a.entity_id = ${users.id}::text and a.action = 'auth.sign_in')`
const pending = sql<boolean>`not exists (select 1 from ${accounts} ac where ac.user_id = ${users.id} and ac.provider_id = 'credential')`
const linkedAuthor = sql<{ id: string; name: string } | null>`(select json_build_object('id', au.id, 'name', au.name) from ${authors} au where au.user_id = ${users.id} order by au.name limit 1)`

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`)

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null)

function filters(query: UserListQuery): SQL | undefined {
  const parts: SQL[] = []
  if (query.q) {
    const like = `%${escapeLike(query.q)}%`
    parts.push(or(ilike(users.name, like), ilike(users.email, like))!)
  }
  if (query.role)
    parts.push(sql`${query.role} = any(string_to_array(${users.role}, ','))`)
  if (query.status === "banned") parts.push(sql`not ${activeSql}`)
  if (query.status === "active") parts.push(and(activeSql, sql`not ${pending}`)!)
  if (query.status === "invited") parts.push(pending)
  if (query.status === "no-2fa")
    parts.push(sql`${users.twoFactorEnabled} is not true`)
  return parts.length ? and(...parts) : undefined
}

function selectUsers(db: DbLike) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      twoFactorEnabled: users.twoFactorEnabled,
      banned: users.banned,
      banReason: users.banReason,
      banExpires: users.banExpires,
      createdAt: users.createdAt,
      lastSession,
      lastSignIn,
      invitePending: pending,
      author: linkedAuthor,
    })
    .from(users)
}

type Row = Awaited<ReturnType<ReturnType<typeof selectUsers>["where"]>>[number]

function toDto(row: Row): UserDto {
  const times = [row.lastSession, row.lastSignIn]
    .filter((t): t is Date => t != null)
    .map((t) => new Date(t).getTime())
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roles: parseRoles(row.role),
    twoFactorEnabled: Boolean(row.twoFactorEnabled),
    banned: Boolean(row.banned),
    banReason: row.banReason ?? null,
    banExpires: iso(row.banExpires),
    invitePending: Boolean(row.invitePending),
    lastActiveAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    author: row.author ?? null,
  }
}

export async function listUsers(query: UserListQuery) {
  const db = getDb()
  const where = filters(query)
  const [rows, [{ total }]] = await Promise.all([
    selectUsers(db)
      .where(where)
      .orderBy(users.name, users.email)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(users).where(where),
  ])
  return { items: rows.map(toDto), page: query.page, pageSize: query.pageSize, total }
}

export async function getUser(id: string, db: DbLike = getDb()) {
  const [row] = await selectUsers(db).where(eq(users.id, id))
  if (!row) throw new ApiError("NOT_FOUND", "That person no longer has an account")
  return toDto(row)
}

export async function activeOwnersExcept(db: DbLike, id: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(users)
    .where(and(ne(users.id, id), ownerSql, activeSql))
  return n
}

async function readTargets(db: DbLike, ids: string[]) {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      banned: users.banned,
      banExpires: users.banExpires,
      twoFactorEnabled: users.twoFactorEnabled,
    })
    .from(users)
    .where(inArray(users.id, ids))
  return rows.map(
    (r): TargetRow => ({
      ...r,
      roles: parseRoles(r.role),
      banned: Boolean(r.banned),
      twoFactorEnabled: Boolean(r.twoFactorEnabled),
    })
  )
}

export async function loadTarget(id: string): Promise<TargetRow> {
  const [row] = await readTargets(getDb(), [id])
  if (!row) throw new ApiError("NOT_FOUND", "That person no longer has an account")
  return row
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0]

// Ruling R1: one lock serialises every access change, so the guard and the
// last-owner count see the state the write will commit on top of.
async function underAccessLock<T>(
  actor: Actor,
  permission: Permissions,
  id: string,
  action: ManageAction,
  nextRoles: readonly RoleName[] | undefined,
  write: (tx: Tx, target: TargetRow) => Promise<T>
): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('users:access'))`)
    const rows = await readTargets(tx, [actor.userId, id])
    const me = rows.find((r) => r.id === actor.userId)
    const target = rows.find((r) => r.id === id)
    // Roles or a ban may have changed since the request's session was read
    // (a concurrent ban by the other owner, Review Focus #1).
    if (!me || isBanned(me) || !hasPermission(me.roles, permission))
      throw new ApiError("FORBIDDEN", "You don't have permission to do that")
    if (!target) throw new ApiError("NOT_FOUND", "That person no longer has an account")
    const why = refusal({ userId: me.id, roles: me.roles }, target, action, nextRoles)
    if (why) throw new ApiError("FORBIDDEN", why)
    if (losesOwner(target, action, nextRoles) && (await activeOwnersExcept(tx, id)) === 0) {
      throw new ApiError("CONFLICT", "There must always be at least one owner", undefined, {
        reason: "LAST_OWNER",
      })
    }
    return write(tx, target)
  })
}

// The person's devices, and every View-as session they started (R4).
async function dropSessions(tx: DbLike, id: string) {
  const gone = await tx
    .delete(sessions)
    .where(or(eq(sessions.userId, id), eq(sessions.impersonatedBy, id)))
    .returning({ id: sessions.id, userId: sessions.userId })
  return gone.filter((s) => s.userId === id).length
}

export async function setRoles(actor: Actor, id: string, input: RolesInput) {
  return underAccessLock(actor, { user: ["set-role"] }, id, "set-role", input.roles, async (tx, target) => {
    const next = input.roles.join(",")
    if (next !== target.role) {
      await tx.update(users).set({ role: next, updatedAt: new Date() }).where(eq(users.id, id))
      await audit(actor, {
        action: "user.role",
        entityType: "user",
        entityId: id,
        summary: `Changed ${target.email}'s role to ${input.roles.join(", ")}`,
        diff: { role: { from: target.role, to: next } },
      }, tx)
    }
    return getUser(id, tx)
  })
}

export async function banUser(actor: Actor, id: string, input: BanInput) {
  return underAccessLock(actor, { user: ["ban"] }, id, "ban", undefined, async (tx, target) => {
    const banExpires = input.days ? new Date(Date.now() + input.days * 86_400_000) : null
    await tx
      .update(users)
      .set({ banned: true, banReason: input.reason ?? null, banExpires, updatedAt: new Date() })
      .where(eq(users.id, id))
    const revoked = await dropSessions(tx, id)
    await audit(actor, {
      action: "user.ban",
      entityType: "user",
      entityId: id,
      summary: input.days
        ? `Banned ${target.email} for ${input.days} day${input.days === 1 ? "" : "s"}`
        : `Banned ${target.email} until unbanned`,
      diff: { banned: { from: target.banned, to: true }, revokedSessions: { from: null, to: revoked } },
    }, tx)
    return getUser(id, tx)
  })
}

export async function unbanUser(actor: Actor, id: string) {
  return underAccessLock(actor, { user: ["ban"] }, id, "unban", undefined, async (tx, target) => {
    if (target.banned) {
      await tx
        .update(users)
        .set({ banned: false, banReason: null, banExpires: null, updatedAt: new Date() })
        .where(eq(users.id, id))
      await audit(actor, {
        action: "user.unban",
        entityType: "user",
        entityId: id,
        summary: `Unbanned ${target.email}`,
        diff: { banned: { from: true, to: false } },
      }, tx)
    }
    return getUser(id, tx)
  })
}

export async function revokeUserSessions(actor: Actor, id: string) {
  return underAccessLock(actor, { session: ["revoke"] }, id, "revoke", undefined, async (tx, target) => {
    const revoked = await dropSessions(tx, id)
    await audit(actor, {
      action: "user.sessions_revoke",
      entityType: "user",
      entityId: id,
      summary: `Signed ${target.email} out everywhere (${revoked} device${revoked === 1 ? "" : "s"})`,
    }, tx)
    return { revoked }
  })
}

export async function deleteUser(actor: Actor, id: string) {
  return underAccessLock(actor, { user: ["delete"] }, id, "delete", undefined, async (tx, target) => {
    await dropSessions(tx, id)
    // Accounts, sessions and two_factors cascade; authored rows set null.
    await tx.delete(users).where(eq(users.id, id))
    await audit(actor, {
      action: "user.delete",
      entityType: "user",
      entityId: id,
      summary: `Deleted ${target.email}`,
    }, tx)
    return { ok: true as const }
  })
}

export async function resendInvite(actor: Actor, id: string) {
  const target = await loadTarget(id)
  const why = refusal(actor, target, "resend")
  if (why) throw new ApiError("FORBIDDEN", why)
  const { invitePending } = await getUser(id)
  if (!invitePending)
    throw new ApiError("CONFLICT", "They've already set a password and can sign in")
  await getAuth().api.requestPasswordReset({
    body: { email: target.email, redirectTo: inviteRedirect() },
  })
  await audit(actor, {
    action: "user.invite_resend",
    entityType: "user",
    entityId: id,
    summary: `Re-sent the invitation to ${target.email}`,
  })
  return { ok: true as const }
}

export async function linkAuthor(actor: Actor, id: string, input: AuthorLinkInput) {
  return underAccessLock(actor, { user: ["update"] }, id, "link-author", undefined, async (tx, target) => {
    if (input.authorId) {
      const [author] = await tx
        .select({ id: authors.id, userId: authors.userId, name: authors.name })
        .from(authors)
        .where(eq(authors.id, input.authorId))
      if (!author) throw new ApiError("NOT_FOUND", "That author no longer exists")
      if (author.userId && author.userId !== id)
        throw new ApiError("CONFLICT", `${author.name} is already linked to someone else`)
    }
    await tx.update(authors).set({ userId: null }).where(eq(authors.userId, id))
    if (input.authorId)
      await tx.update(authors).set({ userId: id }).where(eq(authors.id, input.authorId))
    await audit(actor, {
      action: "user.author_link",
      entityType: "user",
      entityId: id,
      summary: input.authorId
        ? `Linked ${target.email} to an Insights author`
        : `Unlinked ${target.email} from their Insights author`,
      diff: { authorId: { from: null, to: input.authorId } },
    }, tx)
    return getUser(id, tx)
  })
}
```

Implementation notes the implementer must verify against the code, not assume:
- `desc` is unused above; remove it if ESLint flags it.
- `refusal` takes `GuardActor` (`userId`, `roles`); `Actor` satisfies it structurally.
- If Drizzle's `sql` subqueries typed as `Date` come back as strings from `pg`, `iso()`/`new Date()` already normalise them.
- If `Tx` cannot be inferred this way, use `DbLike` (it already accepts a transaction: `audit(actor, entry, db: DbLike)` is called with transactions elsewhere, e.g. `server/modules/theme/service.ts`).
- `authors` rows: if the table requires other non-null columns (check `server/db/schema/content.ts` `row()`), give the test's `insert` those defaults.

- [ ] **Step 10: Wire the routes**

```ts
// server/modules/users/routes.ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import {
  AuthorLinkInput,
  BanInput,
  InviteInput,
  RolesInput,
  UserListQuery,
} from "@/lib/users/schema"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import { notViewingAs } from "@/server/api/middleware/view-as"
import type { AppEnv } from "@/server/api/types"

import * as manage from "./manage"
import { inviteUser } from "./service"

const IdParam = z.object({ id: z.uuid() })
const id = zValidator("param", IdParam, validationHook)
const viewing = notViewingAs("Access can't be changed while viewing as someone")

// docs/brief.md §8.3. Validate, authorise, call the service.
export const usersRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ user: ["list"] }),
    zValidator("query", UserListQuery, validationHook),
    async (c) => c.json(await manage.listUsers(c.req.valid("query")))
  )
  .post(
    "/invite",
    can({ user: ["create"] }),
    viewing,
    zValidator("json", InviteInput, validationHook),
    async (c) =>
      c.json(
        await inviteUser(c.get("actor")!, c.req.valid("json"), c.req.raw.headers),
        201
      )
  )
  .patch(
    "/:id/role",
    can({ user: ["set-role"] }),
    viewing,
    id,
    zValidator("json", RolesInput, validationHook),
    async (c) =>
      c.json(
        await manage.setRoles(c.get("actor")!, c.req.valid("param").id, c.req.valid("json"))
      )
  )
  .post(
    "/:id/ban",
    can({ user: ["ban"] }),
    viewing,
    id,
    zValidator("json", BanInput, validationHook),
    async (c) =>
      c.json(
        await manage.banUser(c.get("actor")!, c.req.valid("param").id, c.req.valid("json"))
      )
  )
  .post("/:id/unban", can({ user: ["ban"] }), viewing, id, async (c) =>
    c.json(await manage.unbanUser(c.get("actor")!, c.req.valid("param").id))
  )
  .delete("/:id/sessions", can({ session: ["revoke"] }), viewing, id, async (c) =>
    c.json(await manage.revokeUserSessions(c.get("actor")!, c.req.valid("param").id))
  )
  .post("/:id/resend-invite", can({ user: ["create"] }), viewing, id, async (c) =>
    c.json(await manage.resendInvite(c.get("actor")!, c.req.valid("param").id))
  )
  .put(
    "/:id/author",
    can({ user: ["update"] }),
    viewing,
    id,
    zValidator("json", AuthorLinkInput, validationHook),
    async (c) =>
      c.json(
        await manage.linkAuthor(c.get("actor")!, c.req.valid("param").id, c.req.valid("json"))
      )
  )
  .delete("/:id", can({ user: ["delete"] }), viewing, id, async (c) =>
    c.json(await manage.deleteUser(c.get("actor")!, c.req.valid("param").id))
  )

export type UsersRoutes = typeof usersRoutes
```

The `ban` route's body is optional in the tests (`body: {}`); `unban`/`resend-invite`/`DELETE` send no body. The existing invite test (`users-invite.test.ts`) must still pass; its "rejects a multi-role string" case stays a 400.

- [ ] **Step 11: Run all user tests to verify they pass**

Run: `pnpm vitest run --project unit server/modules/users lib/users && pnpm vitest run --project integration tests/integration/api/users-admin.test.ts tests/integration/users/manage.test.ts tests/integration/api/users-invite.test.ts tests/integration/api/account-sessions.test.ts tests/integration/api/admin-endpoints.test.ts`
Expected: PASS. If the race tests are flaky, the lock is not taken before the reads — fix the code, never the test.

- [ ] **Step 12: Lint, typecheck, commit**

Run: `pnpm lint && pnpm typecheck`

```bash
git add lib/users server/modules/users server/api/middleware/view-as.ts \
  server/modules/account/routes.ts server/auth/fresh-session.ts tests/integration/api/users-admin.test.ts \
  tests/integration/users/manage.test.ts
git commit -m "feat(users): user management API with owner and last-owner invariants

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: View as — start, stop, audit, banner

**Model:** opus

**Files:**
- Create: `server/modules/users/view-as.ts`, `admin/modules/users/view-as-banner.tsx`, `admin/modules/users/view-as-banner.test.tsx`
- Modify: `server/modules/users/routes.ts`, `server/auth/hooks.ts` (stop audit), `server/api/middleware/auth.ts` (R10), `app/(admin)/admin/(panel)/layout.tsx`
- Test: `tests/integration/api/users-view-as.test.ts`

**Interfaces:**
- Consumes: `loadTarget(id): Promise<TargetRow>` (Task 1), `refusal()` (Task 1), `mustSetUpTwoFactor` (`lib/auth/two-factor-policy.ts`), `authClient` (`admin/lib/auth-client.ts`), `useActor()` (`admin/lib/actor-context.tsx`).
- Produces: `startViewAs(actor: Actor, id: string, headers: Headers): Promise<string[]>` (Set-Cookie values); route `POST /api/v1/admin/users/:id/impersonate` → `{ ok: true }`; `<ViewAsBanner />` (client, reads `useActor()`); audit actions `auth.impersonate` (existing) and `auth.stop_impersonate` (new).

- [ ] **Step 1: Write the failing integration tests**

```ts
// tests/integration/api/users-view-as.test.ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, sessions, users } from "@/server/db/schema"

import { adminRequest, cookieFor, createUser, ORIGIN } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

// Applies Set-Cookie values to a Cookie header the way a browser does:
// a later value for a name replaces the earlier one; an empty value deletes.
function apply(cookie: string, setCookies: string[]) {
  const jar = new Map(
    cookie.split("; ").filter(Boolean).map((p) => {
      const i = p.indexOf("=")
      return [p.slice(0, i), p.slice(i + 1)] as const
    })
  )
  for (const header of setCookies) {
    const pair = header.split(";")[0]!
    const i = pair.indexOf("=")
    const [name, value] = [pair.slice(0, i), pair.slice(i + 1)]
    if (value) jar.set(name, value)
    else jar.delete(name)
  }
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ")
}

const start = (cookie: string, id: string) =>
  adminRequest(`/users/${id}/impersonate`, cookie, { method: "POST" })

const me = async (cookie: string) => (await adminRequest("/me", cookie)).json()

describe("POST /users/:id/impersonate", () => {
  it("lets an owner view as an editor, for at most an hour, audited", async () => {
    const owner = await cookieFor("owner")
    const editor = await createUser("editor", "ed@example.com")

    const response = await start(owner, editor.id)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true })
    const viewing = apply(owner, response.headers.getSetCookie())
    const who = await me(viewing)
    expect(who.user.email).toBe("ed@example.com")
    expect(who.impersonatedBy).toBeTruthy()
    expect((await adminRequest("/users", viewing)).status).toBe(403)
    const [row] = await getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.userId, editor.id))
    expect(row!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(3600_000)
    const audits = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "auth.impersonate"))
    expect(audits).toHaveLength(1)
    expect(audits[0]!.entityId).toBe(editor.id)
  })

  it("an admin cannot view as an owner or another admin", async () => {
    const admin = await cookieFor("admin")
    const owner = await createUser("owner", "o@example.com")
    const other = await createUser("admin", "a2@example.com")
    await getDb()
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, other.id))
    expect((await start(admin, owner.id)).status).toBe(403)
    expect((await start(admin, other.id)).status).toBe(403)
    expect(
      await getDb().select().from(auditLogs).where(eq(auditLogs.action, "auth.impersonate"))
    ).toHaveLength(0)
  })

  it("lets an owner view as an admin", async () => {
    const owner = await cookieFor("owner")
    const admin = await createUser("admin", "ad@example.com")
    await getDb().update(users).set({ twoFactorEnabled: true }).where(eq(users.id, admin.id))
    expect((await start(owner, admin.id)).status).toBe(200)
  })

  it("refuses yourself, a banned person and a target who must still set up two-factor", async () => {
    const owner = await cookieFor("owner")
    const self = (await getDb().query.users.findFirst({ where: eq(users.email, "owner@example.com") }))!
    const banned = await createUser("editor", "b@example.com")
    await getDb().update(users).set({ banned: true }).where(eq(users.id, banned.id))
    const noTwoFactor = await createUser("admin", "n@example.com")
    expect((await start(owner, self.id)).status).toBe(403)
    expect((await start(owner, banned.id)).status).toBe(409)
    expect((await start(owner, noTwoFactor.id)).status).toBe(409)
  })

  it("refuses while already viewing as someone", async () => {
    const owner = await cookieFor("owner")
    const a = await createUser("admin", "a@example.com")
    await getDb().update(users).set({ twoFactorEnabled: true }).where(eq(users.id, a.id))
    const b = await createUser("editor", "b@example.com")
    const viewing = apply(owner, (await start(owner, a.id)).headers.getSetCookie())
    const again = await start(viewing, b.id)
    expect(again.status).toBe(403)
    expect((await again.json()).error.code).toBe("IMPERSONATION_READ_ONLY")
  })

  it("View-as survives a session refresh on the same response", async () => {
    const owner = await cookieFor("owner")
    const editor = await createUser("editor", "ed@example.com")
    // Due for Better Auth's daily refresh (expiresIn 7d, updateAge 1d).
    await getDb()
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + 5 * 86_400_000) })
    const response = await start(owner, editor.id)
    const viewing = apply(owner, response.headers.getSetCookie())
    expect((await me(viewing)).user.email).toBe("ed@example.com")
  })

  it("stopping restores the actor and audits it", async () => {
    const owner = await cookieFor("owner")
    const editor = await createUser("editor", "ed@example.com")
    const viewing = apply(owner, (await start(owner, editor.id)).headers.getSetCookie())

    const stop = await app.request("/api/auth/admin/stop-impersonating", {
      method: "POST",
      headers: { cookie: viewing, origin: ORIGIN, "content-type": "application/json" },
      body: "{}",
    })

    expect(stop.status).toBe(200)
    expect(JSON.stringify(await stop.json())).not.toMatch(/"token"/)
    const back = apply(viewing, stop.headers.getSetCookie())
    expect((await me(back)).user.email).toBe("owner@example.com")
    const [row] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "auth.stop_impersonate"))
    expect(row).toMatchObject({ entityId: editor.id, summary: "Stopped viewing as editor" })
    expect(row!.actorId).toBe(
      (await getDb().query.users.findFirst({ where: eq(users.email, "owner@example.com") }))!.id
    )
  })

  it("a banned person's View-as session ends with the ban", async () => {
    const owner = await cookieFor("owner")
    const admin = await cookieFor("admin")
    const editor = await createUser("editor", "ed@example.com")
    const viewing = apply(admin, (await start(admin, editor.id)).headers.getSetCookie())
    const adminId = (await getDb().query.users.findFirst({ where: eq(users.email, "admin@example.com") }))!.id
    await adminRequest(`/users/${adminId}/ban`, owner, { method: "POST", body: {} })
    expect((await adminRequest("/me", viewing)).status).toBe(401)
  })
})
```

`createUser(role)` names the user after the role (`name: role`), so the editor's name is `"editor"` and the stop summary is `"Stopped viewing as editor"`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run --project integration tests/integration/api/users-view-as.test.ts`
Expected: FAIL — the impersonate route answers 404.

- [ ] **Step 3: Implement `startViewAs` and the route**

`isBanned` is exported from `server/auth/fresh-session.ts` since Task 1.

```ts
// server/modules/users/view-as.ts
import "server-only"

import { mustSetUpTwoFactor } from "@/lib/auth/two-factor-policy"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getAuth } from "@/server/auth/auth"
import { isBanned } from "@/server/auth/fresh-session"

import { refusal } from "./guard"
import { loadTarget } from "./manage"

// Ruling R7. Our guard first (owners, self, banned, 2FA), then Better Auth's
// own impersonate / impersonate-admins check, then its cookies go back to the
// browser. The start is audited by databaseHooks.session.create (auth.ts).
export async function startViewAs(actor: Actor, id: string, headers: Headers) {
  const target = await loadTarget(id)
  const why = refusal(actor, target, "impersonate")
  if (why) throw new ApiError("FORBIDDEN", why)
  if (isBanned(target))
    throw new ApiError("CONFLICT", "Unban them before viewing as them")
  if (mustSetUpTwoFactor(target))
    throw new ApiError(
      "CONFLICT",
      "They haven't set up two-factor yet, so their view can't open"
    )
  const response = await getAuth().api.impersonateUser({
    body: { userId: id },
    headers,
    asResponse: true,
  })
  if (response.status === 401 || response.status === 403)
    throw new ApiError("FORBIDDEN", "You can't view as this person")
  if (!response.ok) throw new ApiError("BAD_REQUEST", "View as couldn't start")
  return response.headers.getSetCookie()
}
```

Append to the `usersRoutes` chain in `server/modules/users/routes.ts` (before `.delete("/:id", …)` or after — distinct path), importing `startViewAs` from `./view-as`:

```ts
  .post(
    "/:id/impersonate",
    can({ user: ["impersonate"] }),
    notViewingAs("Stop viewing as this person before viewing as someone else"),
    id,
    async (c) => {
      const cookies = await startViewAs(
        c.get("actor")!,
        c.req.valid("param").id,
        c.req.raw.headers
      )
      for (const cookie of cookies) c.header("set-cookie", cookie, { append: true })
      return c.json({ ok: true as const })
    }
  )
```

- [ ] **Step 4: Keep a refreshed cookie from overwriting the View-as cookie (R10)**

In `server/api/middleware/auth.ts`, replace the loop at the end of `session`:

```ts
  await next()
  // A refreshed session cookie must reach the browser, unless the handler
  // set that cookie itself (View-as replaces the session token).
  const set = new Set(
    c.res.headers.getSetCookie().map((cookie) => cookie.split("=")[0])
  )
  for (const cookie of setCookies) {
    if (!set.has(cookie.split("=")[0])) c.res.headers.append("set-cookie", cookie)
  }
```

- [ ] **Step 5: Audit the stop (R7)**

In `server/auth/hooks.ts` add `isAPIError` to the `better-auth/api` import, import `audit` from `@/server/lib/audit`, and replace the top of `afterHook`:

```ts
export const afterHook = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/admin/stop-impersonating") return auditStop(ctx)
  if (ctx.path !== "/two-factor/verify-totp") return
  // …existing enrolment revocation, unchanged…
})

// stopImpersonating reads the View-as session through getSessionFromCtx,
// which leaves it on ctx.context.session; the endpoint then restores the
// real user's session (ctx.context.newSession).
async function auditStop(ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]) {
  const returned = ctx.context.returned
  if (!returned || isAPIError(returned)) return
  const viewed = ctx.context.session as {
    user: { id: string; name: string }
    session: { impersonatedBy?: string | null; ipAddress?: string | null; userAgent?: string | null }
  } | null
  const by = viewed?.session.impersonatedBy
  if (!viewed || !by) return
  await audit(
    { userId: by, ip: viewed.session.ipAddress ?? null, userAgent: viewed.session.userAgent ?? null },
    {
      action: "auth.stop_impersonate",
      entityType: "user",
      entityId: viewed.user.id,
      summary: `Stopped viewing as ${viewed.user.name}`,
    }
  )
}
```

Before relying on `ctx.context.session` here, read `getSessionFromCtx` in `node_modules/better-auth/dist/api/routes/session.mjs` and confirm it assigns `ctx.context.session`. If it does not, read the View-as session in a `before` matcher for `/admin/stop-impersonating` (inside `beforeHook`'s `HTTP_ADMIN_PATHS` branch, before its `return`) and stash `{ userId, name, impersonatedBy }` on a `WeakMap<object, …>` keyed by `ctx.request`, then audit from it in the after-hook. The "stopping restores the actor and audits it" test decides.

- [ ] **Step 6: Run the integration tests to verify they pass**

Run: `pnpm vitest run --project integration tests/integration/api/users-view-as.test.ts tests/integration/api/users-admin.test.ts tests/integration/api/admin-endpoints.test.ts tests/integration/auth`
Expected: PASS.

- [ ] **Step 7: Write the failing banner test**

```tsx
// admin/modules/users/view-as-banner.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"

const stop = vi.fn(async () => ({ data: {}, error: null }))
vi.mock("@/admin/lib/auth-client", () => ({
  authClient: { admin: { stopImpersonating: () => stop() } },
}))

import { ViewAsBanner } from "./view-as-banner"

const me: MePayload = {
  user: { id: "u", email: "ed@example.com", name: "Eddie Editor" },
  roles: ["editor"],
  permissions: {},
  twoFactorEnabled: false,
  impersonatedBy: "owner-id",
}

afterEach(() => vi.unstubAllGlobals())

describe("ViewAsBanner", () => {
  it("says who you are viewing as and stopping reloads the admin", async () => {
    const assign = vi.fn()
    vi.stubGlobal("location", { ...window.location, assign })
    render(
      <AdminActorProvider value={me}>
        <ViewAsBanner />
      </AdminActorProvider>
    )
    expect(screen.getByRole("status")).toHaveTextContent(
      "Viewing as Eddie Editor (editor)"
    )
    await userEvent.click(screen.getByRole("button", { name: "Stop viewing" }))
    expect(stop).toHaveBeenCalledOnce()
    expect(assign).toHaveBeenCalledWith("/admin/users")
  })

  it("renders nothing for a normal session", () => {
    const { container } = render(
      <AdminActorProvider value={{ ...me, impersonatedBy: null }}>
        <ViewAsBanner />
      </AdminActorProvider>
    )
    expect(container).toBeEmptyDOMElement()
  })
})
```

Check how other admin component tests are named/located for the jsdom project (e.g. `admin/modules/account/account-view.test.tsx`) and follow the same setup; if the unit project already includes `admin/**/*.test.tsx`, nothing else is needed.

- [ ] **Step 8: Run it to verify it fails**

Run: `pnpm vitest run --project unit admin/modules/users/view-as-banner.test.tsx`
Expected: FAIL — cannot resolve `./view-as-banner`.

- [ ] **Step 9: Implement the banner and render it**

```tsx
// admin/modules/users/view-as-banner.tsx
"use client"

import { EyeIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { useActor } from "@/admin/lib/actor-context"
import { authClient } from "@/admin/lib/auth-client"
import { Button } from "@/components/ui/button"

// docs/brief.md §7.4: View-as "shows a sticky banner". Fixed and centred at
// the bottom so it never fights the sidebar or the topbar (Ruling R9).
export function ViewAsBanner() {
  const { user, roles, impersonatedBy } = useActor()
  const [busy, setBusy] = useState(false)
  if (!impersonatedBy) return null

  async function stop() {
    setBusy(true)
    const { error } = await authClient.admin.stopImpersonating()
    if (error) {
      setBusy(false)
      toast.error("Couldn't stop viewing. Sign out to end it.")
      return
    }
    // A full load drops every cached query from the viewed identity.
    window.location.assign("/admin/users")
  }

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-60 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border bg-foreground px-4 py-2 text-sm text-background shadow-lg"
    >
      <EyeIcon aria-hidden className="size-4 shrink-0" />
      <span className="truncate">
        Viewing as {user.name} ({roles.join(", ")})
      </span>
      <Button size="sm" variant="secondary" disabled={busy} onClick={stop}>
        Stop viewing
      </Button>
    </div>
  )
}
```

In `app/(admin)/admin/(panel)/layout.tsx`, import `ViewAsBanner` from `@/admin/modules/users/view-as-banner` and render it inside `AdminQueryProvider`, after `AdminShell`:

```tsx
      <AdminQueryProvider>
        <AdminShell defaultOpen={sidebarOpen} siteUrl={getEnv().SITE_URL}>
          {children}
        </AdminShell>
        <ViewAsBanner />
      </AdminQueryProvider>
```

Do **not** edit `admin/components/shell/*` (the user's in-progress files).

- [ ] **Step 10: Run, build without a database, commit**

Run: `pnpm vitest run --project unit admin/modules/users && pnpm lint && pnpm typecheck && DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build`
Expected: PASS; build succeeds.

```bash
git add server/modules/users/view-as.ts server/modules/users/routes.ts \
  server/auth/hooks.ts server/api/middleware/auth.ts \
  admin/modules/users/view-as-banner.tsx admin/modules/users/view-as-banner.test.tsx \
  "app/(admin)/admin/(panel)/layout.tsx" tests/integration/api/users-view-as.test.ts
git commit -m "feat(users): View as with banner, owner guards and stop audit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Account security — two-factor management and backup-code regeneration

**Model:** sonnet

**Files:**
- Create: `server/auth/two-factor-policy.ts`, `tests/integration/helpers/two-factor.ts`, `tests/integration/auth/two-factor-policy.test.ts`, `admin/modules/account/two-factor-card.tsx`, `admin/modules/account/two-factor-card.test.tsx`
- Modify: `server/auth/auth.ts` (register plugin), `server/auth/hooks.ts` (enrolment audit), `admin/modules/account/account-view.tsx` (use the card)

**Interfaces:**
- Consumes: `roleRequiresTwoFactor` (`lib/auth/two-factor-policy.ts`), `audit`, `authClient.twoFactor.disable({ password })`, `authClient.twoFactor.generateBackupCodes({ password })` (Better Auth twoFactorClient).
- Produces: plugin `twoFactorPolicy()`; Better Auth error code `TWO_FACTOR_MANDATORY`; audit actions `account.two_factor_enable`, `account.two_factor_disable`, `account.backup_codes_regenerate`; `enrolTotp(cookie): Promise<{ cookie: string; totp: TOTP; backupCodes: string[] }>` test helper; `<TwoFactorCard />`.

- [ ] **Step 1: Write the test helper**

```ts
// tests/integration/helpers/two-factor.ts
import { TOTP } from "otpauth"

import { app } from "@/server/api/app"

import { ORIGIN, PASSWORD } from "./auth"

export const authPost = (path: string, cookie: string, body: unknown) =>
  app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify(body),
  })

// Later Set-Cookie values replace earlier ones of the same name.
export function mergeCookies(cookie: string, setCookies: string[]) {
  const jar = new Map(
    cookie.split("; ").filter(Boolean).map((p) => [p.split("=")[0]!, p] as const)
  )
  for (const header of setCookies) {
    const pair = header.split(";")[0]!
    const name = pair.split("=")[0]!
    if (pair.endsWith("=")) jar.delete(name)
    else jar.set(name, pair)
  }
  return [...jar.values()].join("; ")
}

// Real TOTP enrolment through Better Auth (enrolment rotates the session).
export async function enrolTotp(cookie: string) {
  const enable = await authPost("/two-factor/enable", cookie, { password: PASSWORD })
  if (!enable.ok) throw new Error(`enable: ${enable.status}`)
  const { totpURI, backupCodes } = (await enable.json()) as {
    totpURI: string
    backupCodes: string[]
  }
  const secret = new URL(totpURI).searchParams.get("secret") ?? ""
  const totp = new TOTP({ secret, digits: 6, period: 30 })
  const verify = await authPost("/two-factor/verify-totp", cookie, { code: totp.generate() })
  if (!verify.ok) throw new Error(`verify: ${verify.status}`)
  return { cookie: mergeCookies(cookie, verify.headers.getSetCookie()), totp, backupCodes }
}
```

- [ ] **Step 2: Write the failing integration tests**

```ts
// tests/integration/auth/two-factor-policy.test.ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, users } from "@/server/db/schema"

import { adminRequest, cookieFor, createUser, PASSWORD, signIn, viewAs } from "../helpers/auth"
import { resetDb } from "../helpers/db"
import { authPost, enrolTotp } from "../helpers/two-factor"

beforeEach(resetDb)
afterAll(closeDb)

const audited = async (action: string) =>
  getDb().select().from(auditLogs).where(eq(auditLogs.action, action))
const flag = async (email: string) =>
  (await getDb().query.users.findFirst({ where: eq(users.email, email) }))!.twoFactorEnabled

describe("two-factor policy", () => {
  it("audits enrolment once", async () => {
    await createUser("editor", "ed@example.com")
    await enrolTotp(await signIn("ed@example.com"))
    expect(await audited("account.two_factor_enable")).toHaveLength(1)
  })

  it("lets an editor turn two-factor off, audited", async () => {
    await createUser("editor", "ed@example.com")
    const { cookie } = await enrolTotp(await signIn("ed@example.com"))
    const response = await authPost("/two-factor/disable", cookie, { password: PASSWORD })
    expect(response.status).toBe(200)
    expect(await flag("ed@example.com")).toBe(false)
    expect(await audited("account.two_factor_disable")).toHaveLength(1)
  })

  it.each(["owner", "admin"] as const)("never lets an %s turn it off", async (role) => {
    await createUser(role, `${role}@example.com`)
    const { cookie } = await enrolTotp(await signIn(`${role}@example.com`))
    const response = await authPost("/two-factor/disable", cookie, { password: PASSWORD })
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe("TWO_FACTOR_MANDATORY")
    expect(await flag(`${role}@example.com`)).toBe(true)
  })

  it("regenerates backup codes for anyone with 2FA, audited", async () => {
    await createUser("owner", "owner@example.com")
    const { cookie, backupCodes } = await enrolTotp(await signIn("owner@example.com"))
    const response = await authPost("/two-factor/generate-backup-codes", cookie, {
      password: PASSWORD,
    })
    expect(response.status).toBe(200)
    const { backupCodes: fresh } = (await response.json()) as { backupCodes: string[] }
    expect(fresh).toHaveLength(10)
    expect(fresh).not.toEqual(backupCodes)
    expect(await audited("account.backup_codes_regenerate")).toHaveLength(1)
  })

  it("refuses two-factor changes while viewing as someone", async () => {
    const owner = await cookieFor("owner")
    const editor = await createUser("editor", "ed@example.com")
    const viewing = await viewAs(owner, editor.id)
    for (const path of ["/two-factor/enable", "/two-factor/disable", "/two-factor/generate-backup-codes"]) {
      const response = await authPost(path, viewing, { password: PASSWORD })
      expect(response.status, path).toBe(403)
      expect((await response.json()).code, path).toBe("IMPERSONATION_READ_ONLY")
    }
  })

  it("a wrong password changes nothing and audits nothing", async () => {
    await createUser("editor", "ed@example.com")
    const { cookie } = await enrolTotp(await signIn("ed@example.com"))
    const response = await authPost("/two-factor/disable", cookie, { password: "wrong password!!" })
    expect(response.ok).toBe(false)
    expect(await flag("ed@example.com")).toBe(true)
    expect(await audited("account.two_factor_disable")).toHaveLength(0)
  })
})
```

`adminRequest` is unused here; drop it from the import if ESLint complains.

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm vitest run --project integration tests/integration/auth/two-factor-policy.test.ts`
Expected: FAIL — owner disable answers 200; no audit rows exist.

- [ ] **Step 4: Implement the plugin and the enrolment audit**

```ts
// server/auth/two-factor-policy.ts
import "server-only"

import type { BetterAuthPlugin } from "better-auth"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api"

import { parseRoles } from "@/lib/auth/permissions"
import { roleRequiresTwoFactor } from "@/lib/auth/two-factor-policy"
import { audit } from "@/server/lib/audit"

// docs/brief.md §7.4 and Ruling R11: owners and admins keep 2FA on; nobody
// changes it for someone else through View-as; changes are audited.
const PATHS = new Set([
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/generate-backup-codes",
])

type Caller = {
  user: { id: string; email: string; role?: string | null }
  session: { impersonatedBy?: string | null; ipAddress?: string | null; userAgent?: string | null }
}

const before = createAuthMiddleware(async (ctx) => {
  const session = (await getSessionFromCtx(ctx, { disableCookieCache: true })) as Caller | null
  if (!session) return
  if (session.session.impersonatedBy) {
    throw new APIError("FORBIDDEN", {
      code: "IMPERSONATION_READ_ONLY",
      message: "Two-factor settings can't be changed while viewing as someone",
    })
  }
  if (ctx.path === "/two-factor/disable" && roleRequiresTwoFactor(parseRoles(session.user.role))) {
    throw new APIError("FORBIDDEN", {
      code: "TWO_FACTOR_MANDATORY",
      message: "Owners and admins must keep two-factor authentication on",
    })
  }
})

const after = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/two-factor/enable") return // audited when verified
  const returned = ctx.context.returned
  if (!returned || isAPIError(returned)) return
  const session = ctx.context.session as Caller | null
  if (!session) return
  await audit(
    {
      userId: session.user.id,
      email: session.user.email,
      ip: session.session.ipAddress ?? null,
      userAgent: session.session.userAgent ?? null,
    },
    ctx.path === "/two-factor/disable"
      ? { action: "account.two_factor_disable", entityType: "user", entityId: session.user.id, summary: "Turned off two-factor authentication" }
      : { action: "account.backup_codes_regenerate", entityType: "user", entityId: session.user.id, summary: "Generated new backup codes" }
  )
})

export const twoFactorPolicy = () =>
  ({
    id: "two-factor-policy",
    hooks: {
      before: [{ matcher: ({ path = "" }) => PATHS.has(path), handler: before }],
      after: [{ matcher: ({ path = "" }) => PATHS.has(path), handler: after }],
    },
  }) satisfies BetterAuthPlugin
```

In `server/auth/auth.ts` import it and add `twoFactorPolicy(),` right after `accountHooks(),` (before `responseScrub()`, which must stay last).

In `server/auth/hooks.ts` `afterHook`, after the `if (others.length) await internalAdapter.deleteSessions(others)` line, add:

```ts
  await audit(
    {
      userId: fresh.user.id,
      email: fresh.user.email,
      ip: fresh.session.ipAddress ?? null,
      userAgent: fresh.session.userAgent ?? null,
    },
    {
      action: "account.two_factor_enable",
      entityType: "user",
      entityId: fresh.user.id,
      summary: "Turned on two-factor authentication",
    }
  )
```

That line is only reached for an enrolment (prior session, new token, `twoFactorEnabled`), so sign-in challenges are not counted.

- [ ] **Step 5: Run to verify they pass**

Run: `pnpm vitest run --project integration tests/integration/auth tests/integration/api/two-factor.test.ts tests/integration/api/account-sessions.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing card test**

```tsx
// admin/modules/account/two-factor-card.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"

const generateBackupCodes = vi.fn(async () => ({
  data: { backupCodes: ["aaaaa-11111", "bbbbb-22222"] },
  error: null,
}))
const disable = vi.fn(async () => ({ data: { status: true }, error: null }))
vi.mock("@/admin/lib/auth-client", () => ({
  authClient: { twoFactor: { generateBackupCodes: (b: unknown) => generateBackupCodes(b), disable: (b: unknown) => disable(b) } },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { TwoFactorCard } from "./two-factor-card"

const actor = (roles: MePayload["roles"], on = true): MePayload => ({
  user: { id: "u", email: "u@example.com", name: "U" },
  roles,
  permissions: {},
  twoFactorEnabled: on,
  impersonatedBy: null,
})

const renderAs = (me: MePayload) =>
  render(<AdminActorProvider value={me}><TwoFactorCard /></AdminActorProvider>)

describe("TwoFactorCard", () => {
  it("explains why an owner cannot turn it off", () => {
    renderAs(actor(["owner"]))
    expect(screen.queryByRole("button", { name: "Turn off" })).toBeNull()
    expect(screen.getByText(/Your role requires two-factor/)).toBeVisible()
  })

  it("shows new backup codes once, after the password", async () => {
    renderAs(actor(["editor"]))
    await userEvent.click(screen.getByRole("button", { name: "New backup codes" }))
    await userEvent.type(screen.getByLabelText("Password"), "a long password!")
    await userEvent.click(screen.getByRole("button", { name: "Generate" }))
    expect(generateBackupCodes).toHaveBeenCalledWith({ password: "a long password!" })
    expect(await screen.findByText("aaaaa-11111")).toBeVisible()
  })

  it("lets an editor turn it off with their password", async () => {
    renderAs(actor(["editor"]))
    await userEvent.click(screen.getByRole("button", { name: "Turn off" }))
    await userEvent.type(screen.getByLabelText("Password"), "a long password!")
    await userEvent.click(screen.getByRole("button", { name: "Turn off two-factor" }))
    expect(disable).toHaveBeenCalledWith({ password: "a long password!" })
  })

  it("offers setup when it is off", () => {
    renderAs(actor(["editor"], false))
    expect(screen.getByRole("link", { name: "Set up two-factor" })).toHaveAttribute("href", "/admin/two-factor-setup")
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm vitest run --project unit admin/modules/account/two-factor-card.test.tsx`
Expected: FAIL — cannot resolve `./two-factor-card`.

- [ ] **Step 8: Implement the card and use it**

```tsx
// admin/modules/account/two-factor-card.tsx
"use client"

import { CopyIcon, DownloadIcon, ShieldCheckIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { LINK_FORM } from "@/admin/components/dashboard/page-header"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { useActor } from "@/admin/lib/actor-context"
import { authClient } from "@/admin/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { roleRequiresTwoFactor } from "@/lib/auth/two-factor-policy"

type Mode = "codes" | "disable" | null

export function TwoFactorCard() {
  const { twoFactorEnabled, roles } = useActor()
  const required = roleRequiresTwoFactor(roles)
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [codes, setCodes] = useState<string[] | null>(null)

  const close = () => {
    setMode(null)
    setPassword("")
    setError(null)
    setCodes(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const result =
      mode === "codes"
        ? await authClient.twoFactor.generateBackupCodes({ password })
        : await authClient.twoFactor.disable({ password })
    setBusy(false)
    if (result.error) {
      setError(result.error.message ?? "That password didn't work")
      return
    }
    if (mode === "codes") {
      setCodes((result.data as { backupCodes: string[] }).backupCodes)
      setPassword("")
      return
    }
    toast.success("Two-factor authentication is off")
    close()
    router.refresh()
  }

  const text = codes?.join("\n") ?? ""

  if (!twoFactorEnabled) {
    return (
      <div className="flex flex-col items-start gap-4">
        <StatusPill tone="warning">Off</StatusPill>
        <p className="text-sm text-muted-foreground">
          A code from an authenticator app is asked for when you sign in on a new device.
        </p>
        <Link href="/admin/two-factor-setup" data-slot="button" className={LINK_FORM}>
          <ShieldCheckIcon data-icon="inline-start" />
          Set up two-factor
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <StatusPill tone="success">On</StatusPill>
      <p className="text-sm text-muted-foreground">
        {required
          ? "Your role requires two-factor authentication, so it can't be turned off."
          : "A code from an authenticator app is asked for when you sign in on a new device."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setMode("codes")}>New backup codes</Button>
        {required ? null : (
          <Button variant="ghost" onClick={() => setMode("disable")}>Turn off</Button>
        )}
      </div>
      <Dialog open={mode !== null} onOpenChange={(open) => (open ? null : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "codes" ? "New backup codes" : "Turn off two-factor"}
            </DialogTitle>
            <DialogDescription>
              {mode === "codes"
                ? "Your old backup codes stop working. Each new code works once."
                : "Signing in will only ask for your password."}
            </DialogDescription>
          </DialogHeader>
          {codes ? (
            <div className="flex flex-col gap-3">
              <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
                {codes.map((code) => <li key={code}>{code}</li>)}
              </ul>
              <DialogFooter>
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Copied"))}>
                  <CopyIcon data-icon="inline-start" /> Copy
                </Button>
                <Button variant="outline" asChild>
                  <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download="magda-kennedy-backup-codes.txt">
                    <DownloadIcon data-icon="inline-start" /> Download
                  </a>
                </Button>
                <Button onClick={close}>I've saved them</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="two-factor-password">Password</FieldLabel>
                <Input id="two-factor-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                {error ? <FieldError>{error}</FieldError> : null}
              </Field>
              <DialogFooter>
                <Button type="submit" disabled={busy || !password}>
                  {mode === "codes" ? "Generate" : "Turn off two-factor"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

Check `components/ui/button.tsx` for `asChild` support (shadcn on Base UI may use `render` instead); if `asChild` is unsupported, render the download `<a>` with `className={buttonVariants({ variant: "outline" })}`. `img-src`/`default-src` do not govern `data:` downloads via `<a download>`, so the CSP (Task 6) does not block it; the admin CSP E2E in Task 6 re-checks the Account page.

In `admin/modules/account/account-view.tsx`, replace the whole body of the `"Two-factor authentication"` `DashboardCard` with `<TwoFactorCard />`, import it from `./two-factor-card`, and remove the now-unused `ShieldCheckIcon`, `Link`, `LINK_FORM`, `StatusPill` and `twoFactorEnabled` references. Run `admin/modules/account/account-view.test.tsx`; update any assertion that depended on the old inline markup to the new text (the "On"/"Off" pill and the setup link keep their names).

- [ ] **Step 9: Run, lint, commit**

Run: `pnpm vitest run --project unit admin/modules/account && pnpm lint && pnpm typecheck`
Expected: PASS.

```bash
git add server/auth/two-factor-policy.ts server/auth/auth.ts server/auth/hooks.ts \
  tests/integration/helpers/two-factor.ts tests/integration/auth/two-factor-policy.test.ts \
  admin/modules/account/two-factor-card.tsx admin/modules/account/two-factor-card.test.tsx \
  admin/modules/account/account-view.tsx admin/modules/account/account-view.test.tsx
git commit -m "feat(account): two-factor management, backup codes and owner/admin lock

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Users & roles screen and the permission matrix

**Model:** sonnet

**Files:**
- Create: `lib/auth/matrix.ts`, `lib/auth/matrix.test.ts`, `lib/auth/role-labels.ts`
- Modify: `admin/lib/api.ts` (`usersApi`), `admin/lib/query-keys.ts` (`users`)
- Create: `admin/modules/users/queries.ts`, `admin/modules/users/present.ts`, `admin/modules/users/present.test.ts`, `admin/modules/users/users-view.tsx`, `admin/modules/users/users-table.tsx`, `admin/modules/users/users-table.test.tsx`, `admin/modules/users/invite-dialog.tsx`, `admin/modules/users/role-dialog.tsx`, `admin/modules/users/ban-dialog.tsx`, `admin/modules/users/author-dialog.tsx`, `admin/modules/users/confirm-dialog.tsx`, `admin/modules/users/permission-matrix.tsx`, `app/(admin)/admin/(panel)/users/page.tsx`

**Interfaces:**
- Consumes: `UsersRoutes`, `UserDto` (Task 1), `POST /users/:id/impersonate` (Task 2), `statement`, `roles`, `ROLE_NAMES`, `RoleName` (`lib/auth/permissions.ts`), `usePermission`, `useActor`, `authorsApi` (`GET /admin/authors`), `DataTable`, `DataTablePagination`, `PageHeader`, `StatusPill`, `EmptyState`, `CardSkeleton`.
- Produces: `permissionMatrix(): MatrixRow[]` with `MatrixRow = { resource: string; action: string; cells: Record<RoleName, Cell> }` and `Cell = "yes" | "no" | "own" | "not-owners"`; `ROLE_LABELS: Record<RoleName, string>`, `ROLE_PURPOSE: Record<RoleName, string>`; `usersApi`; `queryKeys.users.{ all, list(params) }`; `userStatus(u: UserDto, now?: Date): { label: string; tone: StatusTone }`; page `/admin/users` with `?tab=people|roles`.

- [ ] **Step 1: Write the failing matrix and present tests**

```ts
// lib/auth/matrix.test.ts
import { describe, expect, it } from "vitest"

import { permissionMatrix } from "./matrix"
import { ROLE_NAMES, statement } from "./permissions"

const cell = (resource: string, action: string, role: string) =>
  permissionMatrix().find((r) => r.resource === resource && r.action === action)!.cells[
    role as never
  ]

describe("permissionMatrix (docs/brief.md §7.2)", () => {
  it("has one row per statement action and a cell per role", () => {
    const rows = permissionMatrix()
    const expected = Object.values(statement).reduce((n, a) => n + a.length, 0)
    expect(rows).toHaveLength(expected)
    for (const row of rows) expect(Object.keys(row.cells).sort()).toEqual([...ROLE_NAMES].sort())
  })

  it("matches the brief's table at its tricky cells", () => {
    expect(cell("code", "update", "owner")).toBe("yes")
    expect(cell("code", "update", "admin")).toBe("no")
    expect(cell("user", "impersonate-admins", "admin")).toBe("no")
    expect(cell("user", "impersonate", "admin")).toBe("not-owners")
    expect(cell("session", "revoke", "admin")).toBe("not-owners")
    expect(cell("article", "update", "author")).toBe("own")
    expect(cell("article", "publish", "author")).toBe("no")
    expect(cell("media", "update", "author")).toBe("own")
    expect(cell("lead", "read", "marketer")).toBe("no")
    expect(cell("lead", "read", "intake")).toBe("yes")
    expect(cell("globals", "update", "viewer")).toBe("no")
    expect(cell("audit", "read", "admin")).toBe("yes")
  })
})
```

```ts
// admin/modules/users/present.test.ts
import { describe, expect, it } from "vitest"

import { userStatus } from "./present"

const base = {
  id: "u", name: "U", email: "u@example.com", roles: ["editor"] as const,
  twoFactorEnabled: false, banned: false, banReason: null, banExpires: null,
  invitePending: false, lastActiveAt: null, createdAt: "2026-01-01T00:00:00Z", author: null,
}
const now = new Date("2026-10-10T12:00:00Z")

describe("userStatus", () => {
  it("names each state", () => {
    expect(userStatus({ ...base } as never, now)).toEqual({ label: "Active", tone: "success" })
    expect(userStatus({ ...base, invitePending: true } as never, now)).toEqual({ label: "Invite pending", tone: "info" })
    expect(userStatus({ ...base, banned: true } as never, now)).toEqual({ label: "Banned", tone: "danger" })
    expect(
      userStatus({ ...base, banned: true, banExpires: "2026-10-20T09:00:00Z" } as never, now).label
    ).toBe("Banned until 20 Oct 2026")
  })

  it("treats an expired ban as active", () => {
    expect(
      userStatus({ ...base, banned: true, banExpires: "2026-10-01T00:00:00Z" } as never, now).label
    ).toBe("Active")
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run --project unit lib/auth/matrix.test.ts admin/modules/users/present.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the matrix, labels and present helpers**

```ts
// lib/auth/matrix.ts
import { ROLE_NAMES, roles, statement, type RoleName } from "./permissions"

export type Cell = "yes" | "no" | "own" | "not-owners"
export type MatrixRow = { resource: string; action: string; cells: Record<RoleName, Cell> }

// Cells the services narrow further (docs/brief.md §7.2 "own" and "never on
// owners"); everything else is exactly what the role grants (Ruling R12).
const QUALIFIERS: Partial<Record<RoleName, Record<string, Cell>>> = {
  author: {
    "article.create": "own",
    "article.update": "own",
    "article.delete": "own",
    "media.update": "own",
  },
  admin: Object.fromEntries(
    [
      ...statement.user.filter((a) => a !== "impersonate-admins").map((a) => `user.${a}`),
      ...statement.session.map((a) => `session.${a}`),
    ].map((key) => [key, "not-owners" as const])
  ),
}

export function permissionMatrix(): MatrixRow[] {
  return Object.entries(statement).flatMap(([resource, actions]) =>
    (actions as readonly string[]).map((action) => ({
      resource,
      action,
      cells: Object.fromEntries(
        ROLE_NAMES.map((name) => {
          const granted = (
            (roles[name].statements as Record<string, readonly string[] | undefined>)[resource] ?? []
          ).includes(action)
          const qualified = QUALIFIERS[name]?.[`${resource}.${action}`]
          return [name, granted ? (qualified ?? "yes") : "no"]
        })
      ) as Record<RoleName, Cell>,
    }))
  )
}
```

```ts
// lib/auth/role-labels.ts
import type { RoleName } from "./permissions"

export const ROLE_LABELS: Record<RoleName, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  author: "Author",
  marketer: "Marketer",
  intake: "Intake",
  viewer: "Viewer",
}

// docs/brief.md §7.2 "What each role is for".
export const ROLE_PURPOSE: Record<RoleName, string> = {
  owner: "Everything, including other owners and custom code.",
  admin: "Everything except custom code and managing owners.",
  editor: "Pages, articles, collections, site content, media and SEO.",
  author: "Their own articles, without publishing.",
  marketer: "SEO, redirects, tracking and the newsletter list. No enquiries.",
  intake: "The enquiries inbox only.",
  viewer: "Read-only access.",
}
```

```ts
// admin/modules/users/present.ts
import type { StatusTone } from "@/admin/components/dashboard/status-pill"
import type { UserDto } from "@/server/modules/users/manage"

const DAY = new Intl.DateTimeFormat("en-IE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Dublin",
})

export function userStatus(user: UserDto, now = new Date()): { label: string; tone: StatusTone } {
  const banEnd = user.banExpires ? new Date(user.banExpires) : null
  if (user.banned && (!banEnd || banEnd > now)) {
    return { label: banEnd ? `Banned until ${DAY.format(banEnd)}` : "Banned", tone: "danger" }
  }
  if (user.invitePending) return { label: "Invite pending", tone: "info" }
  return { label: "Active", tone: "success" }
}
```

`import type { UserDto } from "@/server/modules/users/manage"` is a type-only import (erased at build), the same pattern `admin/lib/api.ts` uses for route types; it never pulls `server-only` into the client.

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm vitest run --project unit lib/auth/matrix.test.ts admin/modules/users/present.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the client API, keys and queries**

In `admin/lib/api.ts`: `import type { UsersRoutes } from "@/server/modules/users/routes"` and `export const usersApi = hc<UsersRoutes>("/api/v1/admin/users")`.

In `admin/lib/query-keys.ts` add:

```ts
  users: {
    all: ["users"] as const,
    list: (params: Record<string, unknown>) => ["users", "list", params] as const,
  },
```

```ts
// admin/modules/users/queries.ts
import { queryOptions } from "@tanstack/react-query"

import { parseResponse, usersApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import type { RoleName } from "@/lib/auth/permissions"

export type UsersParams = {
  page: number
  pageSize: number
  q?: string
  role?: RoleName
  status?: "active" | "banned" | "invited" | "no-2fa"
}

export const usersListQuery = (params: UsersParams) =>
  queryOptions({
    queryKey: queryKeys.users.list(params),
    queryFn: () =>
      parseResponse(
        usersApi.index.$get({
          query: {
            page: String(params.page),
            pageSize: String(params.pageSize),
            ...(params.q ? { q: params.q } : {}),
            ...(params.role ? { role: params.role } : {}),
            ...(params.status ? { status: params.status } : {}),
          },
        })
      ),
  })
```

- [ ] **Step 6: Write the failing table test**

```tsx
// admin/modules/users/users-table.test.tsx
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"
import { permissionMap, type RoleName } from "@/lib/auth/permissions"

import { UsersTable } from "./users-table"

const me = (id: string, roles: RoleName[]): MePayload => ({
  user: { id, email: `${id}@example.com`, name: id },
  roles,
  permissions: permissionMap(roles),
  twoFactorEnabled: true,
  impersonatedBy: null,
})

const row = (id: string, roles: RoleName[], extra = {}) => ({
  id, name: `Person ${id}`, email: `${id}@example.com`, roles,
  twoFactorEnabled: true, banned: false, banReason: null, banExpires: null,
  invitePending: false, lastActiveAt: null, createdAt: "2026-01-01T00:00:00Z", author: null,
  ...extra,
})

const people = [row("me", ["admin"]), row("o", ["owner"]), row("e", ["editor"])]

function renderAs(actor: MePayload) {
  const onAction = vi.fn()
  render(
    <AdminActorProvider value={actor}>
      <UsersTable users={people as never} onAction={onAction} />
    </AdminActorProvider>
  )
  return onAction
}

const actionsFor = (name: string) =>
  screen.queryByRole("button", { name: `Actions for ${name}` })

describe("UsersTable", () => {
  it("shows role badges and two-factor status", () => {
    renderAs(me("me", ["admin"]))
    const ed = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("Person e"))!
    expect(within(ed).getByText("Editor")).toBeVisible()
    expect(within(ed).getByText("2FA on")).toBeVisible()
  })

  it("gives an admin no actions on an owner or on themselves", () => {
    renderAs(me("me", ["admin"]))
    expect(actionsFor("Person o")).toBeNull()
    expect(actionsFor("Person me")).toBeNull()
    expect(actionsFor("Person e")).not.toBeNull()
  })

  it("gives an owner actions on another owner", () => {
    renderAs(me("me", ["owner"]))
    expect(actionsFor("Person o")).not.toBeNull()
  })
})
```

`DataTable` renders a `role="list"` of cards on small screens and a table on wide ones (read `admin/components/data-table/data-table.tsx` to confirm which markup jsdom gets and adjust the `listitem` lookup to `row` if it renders a table).

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm vitest run --project unit admin/modules/users/users-table.test.tsx`
Expected: FAIL — cannot resolve `./users-table`.

- [ ] **Step 8: Implement the table and dialogs**

```tsx
// admin/modules/users/users-table.tsx
"use client"

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import { MoreHorizontalIcon } from "lucide-react"

import { relativeTime } from "@/admin/components/dashboard/format"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { DataTable } from "@/admin/components/data-table/data-table"
import { useActor } from "@/admin/lib/actor-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { hasPermission } from "@/lib/auth/permissions"
import { ROLE_LABELS } from "@/lib/auth/role-labels"
import type { UserDto } from "@/server/modules/users/manage"

import { userStatus } from "./present"

export type UserAction =
  | "role" | "ban" | "unban" | "revoke" | "delete" | "view-as" | "resend" | "author"

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, UserDto>()

function Roles({ user }: { user: UserDto }) {
  return (
    <span className="flex flex-wrap gap-1">
      {user.roles.map((role) => <Badge key={role} variant="secondary">{ROLE_LABELS[role]}</Badge>)}
    </span>
  )
}

function TwoFactor({ user }: { user: UserDto }) {
  return user.twoFactorEnabled
    ? <StatusPill tone="success">2FA on</StatusPill>
    : <StatusPill tone="warning">2FA off</StatusPill>
}

export function UsersTable({
  users,
  onAction,
  isFetching,
}: {
  users: UserDto[]
  onAction: (action: UserAction, user: UserDto) => void
  isFetching?: boolean
}) {
  const actor = useActor()
  const isOwner = actor.roles.includes("owner")
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(actor.roles, p)

  // Mirrors the server guard (convenience only; the API decides).
  function actionsFor(user: UserDto): UserAction[] {
    if (user.id === actor.user.id) return can({ user: ["update"] }) ? ["author"] : []
    if (user.roles.includes("owner") && !isOwner) return []
    const list: UserAction[] = []
    if (can({ user: ["set-role"] })) list.push("role")
    if (can({ user: ["update"] })) list.push("author")
    if (user.invitePending && can({ user: ["create"] })) list.push("resend")
    if (can({ user: ["impersonate"] }) && !user.banned) list.push("view-as")
    if (can({ session: ["revoke"] })) list.push("revoke")
    if (can({ user: ["ban"] })) list.push(user.banned ? "unban" : "ban")
    if (can({ user: ["delete"] })) list.push("delete")
    return list
  }

  const LABEL: Record<UserAction, string> = {
    role: "Change role", author: "Link to author", resend: "Resend invite",
    "view-as": "View as", revoke: "Sign out everywhere", ban: "Ban",
    unban: "Unban", delete: "Delete",
  }

  function Actions({ user }: { user: UserDto }) {
    const list = actionsFor(user)
    if (list.length === 0) return null
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="icon" variant="ghost" aria-label={`Actions for ${user.name}`} />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {list.map((action) => (
            <span key={action}>
              {action === "ban" || action === "delete" ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                variant={action === "delete" || action === "ban" ? "destructive" : "default"}
                onClick={() => onAction(action, user)}
              >
                {LABEL[action]}
              </DropdownMenuItem>
            </span>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const columns = helper.columns([
    helper.accessor("name", {
      header: "Person",
      cell: (info) => (
        <span className="flex flex-col">
          <span className="font-semibold">{info.getValue()}</span>
          <span className="text-xs text-muted-foreground">{info.row.original.email}</span>
        </span>
      ),
    }),
    helper.display({ id: "roles", header: "Roles", cell: (info) => <Roles user={info.row.original} /> }),
    helper.display({ id: "2fa", header: "Two-factor", cell: (info) => <TwoFactor user={info.row.original} /> }),
    helper.display({
      id: "status",
      header: "Status",
      cell: (info) => {
        const s = userStatus(info.row.original)
        return <StatusPill tone={s.tone}>{s.label}</StatusPill>
      },
    }),
    helper.accessor("lastActiveAt", {
      header: "Last active",
      cell: (info) => (info.getValue() ? relativeTime(info.getValue()!) : "Never"),
    }),
    helper.display({ id: "actions", header: () => <span className="sr-only">Actions</span>, cell: (info) => <Actions user={info.row.original} /> }),
  ])

  const table = useTable({ features, columns, data: users, getRowId: (u) => u.id })

  return (
    <DataTable
      table={table}
      caption="People with admin access"
      isFetching={isFetching}
      empty={<p className="text-sm text-muted-foreground">Nobody matches these filters.</p>}
      renderCard={(row) => {
        const user = row.original
        const s = userStatus(user)
        return (
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5 text-sm">
              <p className="font-semibold">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <Roles user={user} />
              <span className="flex flex-wrap gap-1">
                <TwoFactor user={user} />
                <StatusPill tone={s.tone}>{s.label}</StatusPill>
              </span>
              <p className="text-xs text-muted-foreground">
                Last active {user.lastActiveAt ? relativeTime(user.lastActiveAt) : "never"}
              </p>
            </div>
            <Actions user={user} />
          </div>
        )
      }}
    />
  )
}
```

Check before writing: the exact `relativeTime` signature in `admin/components/dashboard/format.ts`; whether `DropdownMenuTrigger` uses `render` (Base UI) or `asChild` (Radix) in `components/ui/dropdown-menu.tsx`, and whether `DropdownMenuItem` has a `variant="destructive"` prop; and whether `tableFeatures({})` with no features is accepted (else pass `{ rowPaginationFeature }` as `activity-view.tsx` does). Follow what the files say.

```tsx
// admin/modules/users/confirm-dialog.tsx
"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

export function ConfirmDialog({
  open, title, description, confirm, destructive, busy, onConfirm, onClose,
}: {
  open: boolean
  title: string
  description: string
  confirm: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={destructive ? "destructive" : "default"} disabled={busy} onClick={onConfirm}>
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

```tsx
// admin/modules/users/invite-dialog.tsx
"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { parseResponse, usersApi } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { useActor } from "@/admin/lib/actor-context"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { ROLE_LABELS, ROLE_PURPOSE } from "@/lib/auth/role-labels"
import { InviteInput } from "@/lib/users/schema"

export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { roles } = useActor()
  const queryClient = useQueryClient()
  const choices = ROLE_NAMES.filter((r) => r !== "owner" || roles.includes("owner"))
  const [values, setValues] = useState({ email: "", name: "", role: "editor" as RoleName })
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const invite = useMutation({
    mutationFn: (body: InviteInput) => parseResponse(usersApi.invite.$post({ json: body })),
    onSuccess: (user) => {
      toast.success(`Invitation sent to ${user.email}`)
      setValues({ email: "", name: "", role: "editor" })
      onClose()
      return queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
    },
    onError: (error) => {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors)
      else toast.error(error.message)
    },
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = InviteInput.safeParse(values)
    if (!parsed.success) {
      const flat: Record<string, string[]> = {}
      for (const issue of parsed.error.issues) (flat[String(issue.path[0])] ??= []).push(issue.message)
      setErrors(flat)
      return
    }
    setErrors({})
    invite.mutate(parsed.data)
  }

  const err = (k: string) => errors[k]?.[0]

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite someone</DialogTitle></DialogHeader>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <Field data-invalid={err("email") ? true : undefined}>
            <FieldLabel htmlFor="invite-email">Email</FieldLabel>
            <Input id="invite-email" type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} />
            {err("email") ? <FieldError>{err("email")}</FieldError> : null}
          </Field>
          <Field data-invalid={err("name") ? true : undefined}>
            <FieldLabel htmlFor="invite-name">Name</FieldLabel>
            <Input id="invite-name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
            {err("name") ? <FieldError>{err("name")}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="invite-role">Role</FieldLabel>
            <Select
              items={choices.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              value={values.role}
              onValueChange={(v) => setValues({ ...values, role: v as RoleName })}
            >
              <SelectTrigger id="invite-role" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {choices.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
            <FieldDescription>{ROLE_PURPOSE[values.role]}</FieldDescription>
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={invite.isPending}>Send invitation</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

```tsx
// admin/modules/users/role-dialog.tsx
"use client"

import { useState } from "react"

import { useActor } from "@/admin/lib/actor-context"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { ROLE_LABELS, ROLE_PURPOSE } from "@/lib/auth/role-labels"
import type { UserDto } from "@/server/modules/users/manage"

export function RoleDialog({ user, busy, onSave, onClose }: {
  user: UserDto | null
  busy?: boolean
  onSave: (roles: RoleName[]) => void
  onClose: () => void
}) {
  const actor = useActor()
  const [picked, setPicked] = useState<RoleName[]>(user?.roles ?? [])
  const choices = ROLE_NAMES.filter((r) => r !== "owner" || actor.roles.includes("owner"))
  const toggle = (role: RoleName, on: boolean) =>
    setPicked((now) => (on ? [...now, role] : now.filter((r) => r !== role)))
  return (
    <Dialog open={user !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent key={user?.id}>
        <DialogHeader>
          <DialogTitle>Roles for {user?.name}</DialogTitle>
          <DialogDescription>Any role that grants a permission is enough. Owners and admins must use two-factor.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {choices.map((role) => (
            <Field key={role} orientation="horizontal">
              <Checkbox id={`role-${role}`} checked={picked.includes(role)} onCheckedChange={(on) => toggle(role, Boolean(on))} />
              <FieldLabel htmlFor={`role-${role}`} className="flex flex-col items-start">
                <span>{ROLE_LABELS[role]}</span>
                <span className="text-xs font-normal text-muted-foreground">{ROLE_PURPOSE[role]}</span>
              </FieldLabel>
            </Field>
          ))}
        </div>
        <DialogFooter>
          <Button disabled={busy || picked.length === 0} onClick={() => onSave(picked)}>Save roles</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

The `key={user?.id}` resets `picked` when a different person is opened; if `useState` initial value still leaks, render `<RoleDialog key={user?.id} …/>` from the parent instead.

```tsx
// admin/modules/users/ban-dialog.tsx
"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { UserDto } from "@/server/modules/users/manage"

const LENGTHS = [
  { value: "0", label: "Until unbanned" },
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "365", label: "1 year" },
]

export function BanDialog({ user, busy, onBan, onClose }: {
  user: UserDto | null
  busy?: boolean
  onBan: (body: { reason?: string; days: number | null }) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState("")
  const [days, setDays] = useState("0")
  return (
    <Dialog open={user !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban {user?.name}</DialogTitle>
          <DialogDescription>They are signed out everywhere at once and can't sign in until the ban ends.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="ban-reason">Reason (optional)</FieldLabel>
          <Input id="ban-reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="ban-length">How long</FieldLabel>
          <Select items={LENGTHS} value={days} onValueChange={(v) => setDays(String(v))}>
            <SelectTrigger id="ban-length" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{LENGTHS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <DialogFooter>
          <Button variant="destructive" disabled={busy} onClick={() => onBan({ reason: reason || undefined, days: days === "0" ? null : Number(days) })}>
            Ban
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

```tsx
// admin/modules/users/author-dialog.tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { authorsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { UserDto } from "@/server/modules/users/manage"

const NONE = "__none__"

// Phase 5 Ruling R4: linking lets an author-role user edit that byline's articles.
export function AuthorDialog({ user, busy, onSave, onClose }: {
  user: UserDto | null
  busy?: boolean
  onSave: (authorId: string | null) => void
  onClose: () => void
}) {
  const authors = useQuery({
    queryKey: queryKeys.authors,
    queryFn: () => parseResponse(authorsApi.index.$get()),
    enabled: user !== null,
  })
  const [value, setValue] = useState(user?.author?.id ?? NONE)
  const items = [
    { value: NONE, label: "Not linked" },
    ...((authors.data as { id: string; name: string }[] | undefined) ?? []).map((a) => ({ value: a.id, label: a.name })),
  ]
  return (
    <Dialog open={user !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent key={user?.id}>
        <DialogHeader>
          <DialogTitle>Insights author for {user?.name}</DialogTitle>
          <DialogDescription>An author can edit the articles under the byline they are linked to.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="author-link">Author</FieldLabel>
          <Select items={items} value={value} onValueChange={(v) => setValue(String(v))}>
            <SelectTrigger id="author-link" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <DialogFooter>
          <Button disabled={busy} onClick={() => onSave(value === NONE ? null : value)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Read `GET /admin/authors`' actual response shape (`server/modules/taxonomy/service.ts` `listTaxonomy`) and map it accordingly (it may be `{ items }` or rows with `values`); the `as` cast above must match it.

```tsx
// admin/modules/users/permission-matrix.tsx
"use client"

import { CheckIcon, MinusIcon } from "lucide-react"

import { permissionMatrix, type Cell } from "@/lib/auth/matrix"
import { ROLE_NAMES } from "@/lib/auth/permissions"
import { ROLE_LABELS, ROLE_PURPOSE } from "@/lib/auth/role-labels"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const ROWS = permissionMatrix()

function Mark({ cell }: { cell: Cell }) {
  if (cell === "no") return <MinusIcon aria-label="No" className="mx-auto size-4 text-muted-foreground" />
  if (cell === "own") return <span className="text-xs font-semibold">Own only</span>
  if (cell === "not-owners") return <span className="text-xs font-semibold">Not owners</span>
  return <CheckIcon aria-label="Yes" className="mx-auto size-4 text-primary" />
}

// Ruling R12: generated from lib/auth/permissions.ts, the same definitions
// the API authorises with, so it cannot drift.
export function PermissionMatrix() {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ROLE_NAMES.map((r) => (
          <div key={r} className="rounded-card border p-3">
            <dt className="font-semibold">{ROLE_LABELS[r]}</dt>
            <dd className="text-sm text-muted-foreground">{ROLE_PURPOSE[r]}</dd>
          </div>
        ))}
      </dl>
      <div role="region" aria-label="Permission matrix" tabIndex={0} className="overflow-x-auto">
        <Table>
          <TableCaption>What each role can do. Read-only.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Permission</TableHead>
              {ROLE_NAMES.map((r) => <TableHead key={r} scope="col" className="text-center">{ROLE_LABELS[r]}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={`${row.resource}.${row.action}`}>
                <TableHead scope="row"><code className="font-mono text-xs">{row.resource}.{row.action}</code></TableHead>
                {ROLE_NAMES.map((r) => <TableCell key={r} className="text-center"><Mark cell={row.cells[r]} /></TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

The focusable `role="region"` scroll container follows commit `e7e49a7` (axe "scrollable-region-focusable").

- [ ] **Step 9: Implement the view and the page**

```tsx
// admin/modules/users/users-view.tsx
"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { UserPlusIcon } from "lucide-react"
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import { PageHeader } from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { DataTablePagination } from "@/admin/components/data-table/data-table-pagination"
import { usePermission } from "@/admin/lib/actor-context"
import { parseResponse, usersApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import type { UserDto } from "@/server/modules/users/manage"

import { AuthorDialog } from "./author-dialog"
import { BanDialog } from "./ban-dialog"
import { ConfirmDialog } from "./confirm-dialog"
import { InviteDialog } from "./invite-dialog"
import { PermissionMatrix } from "./permission-matrix"
import { usersListQuery } from "./queries"
import { RoleDialog } from "./role-dialog"
import { UsersTable, type UserAction } from "./users-table"

const TABS = ["people", "roles"] as const
const STATUSES = ["active", "banned", "invited", "no-2fa"] as const

export function UsersView() {
  const [state, setState] = useQueryStates(
    {
      tab: parseAsStringLiteral(TABS).withDefault("people"),
      page: parseAsInteger.withDefault(1),
      q: parseAsString,
      role: parseAsStringLiteral(ROLE_NAMES),
      status: parseAsStringLiteral(STATUSES),
    },
    { history: "replace" }
  )
  const params = {
    page: Math.max(1, state.page),
    pageSize: 50,
    q: state.q?.trim().slice(0, 100) || undefined,
    role: (state.role ?? undefined) as RoleName | undefined,
    status: state.status ?? undefined,
  }
  const list = useQuery({ ...usersListQuery(params), placeholderData: keepPreviousData })
  const canInvite = usePermission({ user: ["create"] })
  const queryClient = useQueryClient()
  const [inviting, setInviting] = useState(false)
  const [open, setOpen] = useState<{ action: UserAction; user: UserDto } | null>(null)
  const close = () => setOpen(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all })

  const act = useMutation({
    mutationFn: async ({ action, user, body }: { action: UserAction; user: UserDto; body?: unknown }) => {
      const param = { param: { id: user.id } }
      switch (action) {
        case "role": return parseResponse(usersApi[":id"].role.$patch({ ...param, json: body as { roles: RoleName[] } }))
        case "ban": return parseResponse(usersApi[":id"].ban.$post({ ...param, json: body as { days: number | null } }))
        case "unban": return parseResponse(usersApi[":id"].unban.$post(param))
        case "revoke": return parseResponse(usersApi[":id"].sessions.$delete(param))
        case "resend": return parseResponse(usersApi[":id"]["resend-invite"].$post(param))
        case "author": return parseResponse(usersApi[":id"].author.$put({ ...param, json: body as { authorId: string | null } }))
        case "delete": return parseResponse(usersApi[":id"].$delete(param))
        case "view-as": return parseResponse(usersApi[":id"].impersonate.$post(param))
      }
    },
    onSuccess: (_data, { action, user }) => {
      if (action === "view-as") {
        // Ruling R9: a full load, so no cached data crosses identities.
        window.location.assign("/admin")
        return
      }
      const done: Record<Exclude<UserAction, "view-as">, string> = {
        role: `Roles saved for ${user.name}`, ban: `${user.name} is banned and signed out`,
        unban: `${user.name} can sign in again`, revoke: `${user.name} is signed out everywhere`,
        resend: `Invitation sent again to ${user.email}`, author: "Author link saved",
        delete: `${user.name} no longer has an account`,
      }
      toast.success(done[action])
      close()
      return refresh()
    },
    onError: (error) => toast.error(error.message),
  })

  const run = (body?: unknown) => open && act.mutate({ ...open, body })
  const user = (action: UserAction) => (open?.action === action ? open.user : null)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users & roles"
        description="Who can sign in to the admin, and what each role can do."
        actions={canInvite ? (
          <Button onClick={() => setInviting(true)}><UserPlusIcon data-icon="inline-start" /> Invite</Button>
        ) : null}
      />
      <Tabs value={state.tab} onValueChange={(v) => void setState({ tab: v as (typeof TABS)[number] })}>
        <TabsList>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="roles">Roles & permissions</TabsTrigger>
        </TabsList>
        <TabsContent value="people" className="mt-4 flex flex-col gap-4">
          <div role="group" aria-label="Filters" className="flex flex-wrap items-end gap-3">
            <Input
              aria-label="Search people"
              placeholder="Search by name or email"
              className="w-full sm:w-72"
              defaultValue={state.q ?? ""}
              onChange={(e) => void setState({ q: e.target.value || null, page: 1 })}
            />
          </div>
          {list.isPending ? (
            <CardSkeleton />
          ) : list.isError ? (
            <EmptyState title="The team list didn't load" description={list.error.message} action={<Button onClick={() => list.refetch()}>Try again</Button>} />
          ) : (
            <>
              <UsersTable users={list.data.items} isFetching={list.isFetching} onAction={(action, u) => setOpen({ action, user: u })} />
              <DataTablePagination page={params.page} pageSize={params.pageSize} total={list.data.total} onPageChange={(page) => void setState({ page }, { history: "push" })} />
            </>
          )}
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <PermissionMatrix />
        </TabsContent>
      </Tabs>

      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
      <RoleDialog key={user("role")?.id} user={user("role")} busy={act.isPending} onSave={(roles) => run({ roles })} onClose={close} />
      <BanDialog key={user("ban")?.id} user={user("ban")} busy={act.isPending} onBan={(body) => run(body)} onClose={close} />
      <AuthorDialog key={user("author")?.id} user={user("author")} busy={act.isPending} onSave={(authorId) => run({ authorId })} onClose={close} />
      <ConfirmDialog open={open?.action === "unban"} title={`Unban ${open?.user.name}?`} description="They can sign in again straight away." confirm="Unban" busy={act.isPending} onConfirm={() => run()} onClose={close} />
      <ConfirmDialog open={open?.action === "revoke"} title={`Sign ${open?.user.name} out everywhere?`} description="Every device they're signed in on is signed out. They can sign in again." confirm="Sign out everywhere" busy={act.isPending} onConfirm={() => run()} onClose={close} />
      <ConfirmDialog open={open?.action === "resend"} title={`Resend the invitation to ${open?.user.email}?`} description="The earlier link stops working." confirm="Resend" busy={act.isPending} onConfirm={() => run()} onClose={close} />
      <ConfirmDialog open={open?.action === "view-as"} title={`View as ${open?.user.name}?`} description="For up to an hour you see the admin exactly as they do. You can't change anyone's access meanwhile. It's recorded in the activity log." confirm="View as" busy={act.isPending} onConfirm={() => run()} onClose={close} />
      <ConfirmDialog open={open?.action === "delete"} destructive title={`Delete ${open?.user.name}?`} description="Their account is removed for good. What they wrote stays, and the activity log keeps their email." confirm="Delete" busy={act.isPending} onConfirm={() => run()} onClose={close} />
    </div>
  )
}
```

The role and status filters are in the URL (`?role=`, `?status=`) for the dashboard's links (e.g. `?status=no-2fa`); add two `Select`s for them following the `activity-view.tsx` pattern (`ALL` sentinel) beside the search input. Check `DataTablePagination`'s props in `admin/components/data-table/data-table-pagination.tsx`.

```tsx
// app/(admin)/admin/(panel)/users/page.tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { UsersView } from "@/admin/modules/users/users-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Users & roles" }

export default function UsersPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  // Gated by the registry entry that lists the link (user.list).
  await requirePermission(permissionFor("/admin/users"))
  return <UsersView />
}
```

- [ ] **Step 10: Run, build, commit**

Run: `pnpm vitest run --project unit lib/auth admin/modules/users && pnpm lint && pnpm typecheck && DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build`
Expected: PASS; build succeeds.

```bash
git add lib/auth/matrix.ts lib/auth/matrix.test.ts lib/auth/role-labels.ts \
  admin/lib/api.ts admin/lib/query-keys.ts admin/modules/users \
  "app/(admin)/admin/(panel)/users/page.tsx"
git commit -m "feat(users): users and roles screen with generated permission matrix

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Activity log polish — entity filter, field-diff viewer, CSV export

**Model:** sonnet

**Files:**
- Create: `lib/audit/diff.ts`, `lib/audit/diff.test.ts`, `admin/modules/activity/activity-detail.tsx`, `tests/integration/api/audit-export.test.ts`
- Modify: `server/modules/audit/schema.ts`, `server/modules/audit/repo.ts`, `server/modules/audit/service.ts`, `server/modules/audit/routes.ts`, `admin/modules/activity/params.ts` (+ `params.test.ts`), `admin/modules/activity/queries.ts`, `admin/modules/activity/activity-view.tsx`, `admin/lib/query-keys.ts`, `tests/integration/api/audit.test.ts`

**Interfaces:**
- Consumes: `toCsv(rows, columns)` (`server/modules/leads/csv.ts`), `dublinMidnight`, `audit()`.
- Produces: query params `entityType?` (≤32), `entityId?` (≤64) on `GET /audit` and `GET /audit/export.csv`; list items gain `hasDiff: boolean`, `impersonatorName: string | null`, `entityType`, `entityId` (already present); `GET /audit/:id` → item + `diff`; facets gain `entityTypes: string[]`; `diffRows(diff: unknown): DiffRow[]` with `DiffRow = { field: string; from: string; to: string }`; `exportHref(params: AuditListParams): string`; `AuditListParams` gains `entityType?`.

- [ ] **Step 1: Write the failing diff unit test**

```ts
// lib/audit/diff.test.ts
import { describe, expect, it } from "vitest"

import { diffRows } from "./diff"

describe("diffRows", () => {
  it("lists fields alphabetically with readable values", () => {
    expect(diffRows({ title: { from: "Old", to: "New" }, count: { from: 1, to: 2 } })).toEqual([
      { field: "count", from: "1", to: "2" },
      { field: "title", from: "Old", to: "New" },
    ])
  })

  it("renders non-objects and nulls as text", () => {
    expect(diffRows({ a: { from: null, to: { x: [1] } } })).toEqual([
      { field: "a", from: "—", to: '{\n  "x": [\n    1\n  ]\n}' },
    ])
    expect(diffRows("junk")).toEqual([])
    expect(diffRows(null)).toEqual([])
    expect(diffRows({ broken: 5 })).toEqual([{ field: "broken", from: "—", to: "5" }])
  })

  it("clips long values and keeps markup as text", () => {
    const [row] = diffRows({ body: { from: "<script>x</script>", to: "y".repeat(5000) } })
    expect(row!.from).toBe("<script>x</script>")
    expect(row!.to.length).toBeLessThanOrEqual(2001)
    expect(row!.to.endsWith("…")).toBe(true)
  })

  it("never treats __proto__ as special", () => {
    const diff = JSON.parse('{"__proto__": {"from": 1, "to": 2}}')
    expect(diffRows(diff)).toEqual([{ field: "__proto__", from: "1", to: "2" }])
  })
})
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `pnpm vitest run --project unit lib/audit/diff.test.ts` → FAIL (module not found).

```ts
// lib/audit/diff.ts
// Before/after rows for the Activity log's detail view (docs/brief.md §9.3).
// Values are plain text: React escapes them, and nothing here builds markup.
export type DiffRow = { field: string; from: string; to: string }

const MAX = 2000

const clip = (text: string) => (text.length > MAX ? `${text.slice(0, MAX)}…` : text)

function show(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return clip(value)
  return clip(JSON.stringify(value, null, 2) ?? String(value))
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

export function diffRows(diff: unknown): DiffRow[] {
  if (!isRecord(diff)) return []
  return Object.keys(diff)
    .sort((a, b) => a.localeCompare(b))
    .map((field) => {
      const change = diff[field]
      if (!isRecord(change)) return { field, from: "—", to: show(change) }
      return { field, from: show(change.from), to: show(change.to) }
    })
}
```

Run again → PASS.

- [ ] **Step 3: Write the failing API tests**

Append to `tests/integration/api/audit.test.ts` (read its helpers first; it seeds rows with `audit()` or direct inserts):

```ts
describe("Phase 10 filters and detail", () => {
  it("filters by entity and reports hasDiff and who was viewing", async () => {
    const cookie = await cookieFor("owner")
    const owner = (await getDb().query.users.findFirst({ where: eq(users.email, "owner@example.com") }))!
    await audit({ userId: owner.id }, { action: "page.publish", entityType: "page", entityId: "p1", summary: "Published Home", diff: { title: { from: "A", to: "B" } } })
    await audit({ userId: owner.id, impersonatedBy: owner.id }, { action: "article.create", entityType: "article", entityId: "a1", summary: "Created" })

    const pages = await (await adminRequest("/audit?entityType=page", cookie)).json()
    expect(pages.items).toHaveLength(1)
    expect(pages.items[0]).toMatchObject({ hasDiff: true, entityId: "p1", impersonatorName: null })
    const art = await (await adminRequest("/audit?entityType=article&entityId=a1", cookie)).json()
    expect(art.items[0]).toMatchObject({ hasDiff: false, impersonatorName: "owner" })
    const facets = await (await adminRequest("/audit/facets", cookie)).json()
    expect(facets.entityTypes).toEqual(expect.arrayContaining(["article", "page"]))
  })

  it("GET /audit/:id returns the diff; 404 for unknown; 403 without audit.read", async () => {
    const cookie = await cookieFor("owner")
    const owner = (await getDb().query.users.findFirst({ where: eq(users.email, "owner@example.com") }))!
    await audit({ userId: owner.id }, { action: "page.publish", entityType: "page", entityId: "p1", summary: "x", diff: { title: { from: "A", to: "B" } } })
    const [row] = await getDb().select().from(auditLogs).where(eq(auditLogs.action, "page.publish"))
    const detail = await (await adminRequest(`/audit/${row!.id}`, cookie)).json()
    expect(detail.diff).toEqual({ title: { from: "A", to: "B" } })
    expect(detail).not.toHaveProperty("ipHash")
    expect((await adminRequest("/audit/00000000-0000-4000-8000-000000000000", cookie)).status).toBe(404)
    const editor = await cookieFor("editor")
    expect((await adminRequest(`/audit/${row!.id}`, editor)).status).toBe(403)
  })
})
```

```ts
// tests/integration/api/audit-export.test.ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, users } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("GET /audit/export.csv", () => {
  it("neutralises formulas and never exports ipHash or userAgent", async () => {
    const cookie = await cookieFor("admin")
    const admin = (await getDb().query.users.findFirst({ where: eq(users.email, "admin@example.com") }))!
    await audit(
      { userId: admin.id, email: admin.email, ip: "203.0.113.9", userAgent: "UA-SECRET" },
      { action: "page.publish", entityType: "page", entityId: "p1", summary: '=HYPERLINK("http://x")' }
    )
    const response = await adminRequest("/audit/export.csv?entityType=page", cookie)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/csv")
    expect(response.headers.get("content-disposition")).toMatch(/attachment; filename="activity-\d{4}-\d{2}-\d{2}\.csv"/)
    expect(response.headers.get("cache-control")).toBe("no-store")
    const text = await response.text()
    const [header, line] = text.split("\r\n")
    expect(header).toBe("When,Who,Email,Viewing-as by,Action,Entity,Entity ID,Summary")
    expect(line).toContain(`"'=HYPERLINK(""http://x"")"`)
    expect(text).not.toContain("UA-SECRET")
    expect(text).not.toContain("203.0.113.9")
    const [exported] = await getDb().select().from(auditLogs).where(eq(auditLogs.action, "audit.export"))
    expect(exported).toBeDefined()
  })

  it("caps the export at 10 000 rows, newest first", async () => {
    const cookie = await cookieFor("owner")
    const rows = Array.from({ length: 10_005 }, (_, i) => ({
      action: "seed.row", entityType: "seed", entityId: String(i), summary: `row ${i}`,
      createdAt: new Date(Date.UTC(2026, 0, 1) + i * 1000),
    }))
    for (let i = 0; i < rows.length; i += 2000) await getDb().insert(auditLogs).values(rows.slice(i, i + 2000))
    const text = await (await adminRequest("/audit/export.csv?action=seed.row", cookie)).text()
    const lines = text.split("\r\n")
    expect(lines).toHaveLength(10_001)
    expect(lines[1]).toContain("row 10004")
  })

  it("is refused without audit.read", async () => {
    const cookie = await cookieFor("editor")
    expect((await adminRequest("/audit/export.csv", cookie)).status).toBe(403)
  })
})
```

Run: `pnpm vitest run --project integration tests/integration/api/audit.test.ts tests/integration/api/audit-export.test.ts`
Expected: FAIL (unknown query keys are stripped so filters are ignored; `/audit/:id` and `/export.csv` 404).

- [ ] **Step 4: Implement schema, repo, service and routes**

```ts
// server/modules/audit/schema.ts — replace the object with:
const Filters = {
  actor: z.uuid().optional(),
  action: z.string().trim().min(1).max(64).optional(),
  entityType: z.string().trim().min(1).max(32).optional(),
  entityId: z.string().trim().min(1).max(64).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
}

const ordered = <T extends { from?: string; to?: string }>(q: T) =>
  !q.from || !q.to || q.from <= q.to

export const AuditListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    ...Filters,
  })
  .refine(ordered, { message: "The end date must be on or after the start date", path: ["to"] })
export type AuditListQuery = z.output<typeof AuditListQuery>

export const AuditExportQuery = z
  .object(Filters)
  .refine(ordered, { message: "The end date must be on or after the start date", path: ["to"] })
export type AuditExportQuery = z.output<typeof AuditExportQuery>
```

In `server/modules/audit/repo.ts`:
- `AuditFilters` gains `entityType?: string; entityId?: string`; `where()` pushes `eq(auditLogs.entityType, …)` / `eq(auditLogs.entityId, …)`.
- `import { alias } from "drizzle-orm/pg-core"`; `const impersonator = alias(users, "impersonator")`.
- In `listAudit`'s select add `hasDiff: sql<boolean>\`${auditLogs.diff} is not null\``, `impersonatorName: impersonator.name`, and `.leftJoin(impersonator, eq(impersonator.id, auditLogs.impersonatedBy))`.
- Add:

```ts
export async function getAudit(id: string) {
  const [row] = await getDb()
    .select({
      id: auditLogs.id,
      actorId: auditLogs.actorId,
      actorEmail: auditLogs.actorEmail,
      actorName: users.name,
      impersonatorName: impersonator.name,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      summary: auditLogs.summary,
      diff: auditLogs.diff,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .leftJoin(impersonator, eq(impersonator.id, auditLogs.impersonatedBy))
    .where(eq(auditLogs.id, id))
  return row ?? null
}

export const EXPORT_LIMIT = 10_000

export async function exportAudit(filters: AuditFilters) {
  return getDb()
    .select({
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorEmail: auditLogs.actorEmail,
      impersonatorName: impersonator.name,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      summary: auditLogs.summary,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .leftJoin(impersonator, eq(impersonator.id, auditLogs.impersonatedBy))
    .where(where(filters))
    .orderBy(desc(auditLogs.createdAt))
    .limit(EXPORT_LIMIT)
}
```

- `auditFacets()` adds `db.selectDistinct({ entityType: auditLogs.entityType }).from(auditLogs).orderBy(asc(auditLogs.entityType))` → `entityTypes: string[]`.

In `server/modules/audit/service.ts`:

```ts
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { audit } from "@/server/lib/audit"
import { toCsv } from "@/server/modules/leads/csv"

// listAuditEntries: pass { actorId: actor, action, entityType, entityId, from, to }.

export async function getAuditEntry(id: string) {
  const row = await repo.getAudit(id)
  if (!row) throw new ApiError("NOT_FOUND", "That activity entry no longer exists")
  return { ...row, createdAt: row.createdAt.toISOString() }
}

export async function exportAuditCsv(actor: Actor, query: AuditExportQuery) {
  const { actor: actorId, ...rest } = query
  const rows = await repo.exportAudit({ actorId, ...rest })
  await audit(actor, {
    action: "audit.export",
    entityType: "audit",
    summary: `Exported ${rows.length} activity entr${rows.length === 1 ? "y" : "ies"}`,
  })
  return toCsv(
    rows.map((r) => ({ ...r, who: r.actorName ?? r.actorEmail ?? "System" })),
    [
      { key: "createdAt", label: "When" },
      { key: "who", label: "Who" },
      { key: "actorEmail", label: "Email" },
      { key: "impersonatorName", label: "Viewing-as by" },
      { key: "action", label: "Action" },
      { key: "entityType", label: "Entity" },
      { key: "entityId", label: "Entity ID" },
      { key: "summary", label: "Summary" },
    ]
  )
}
```

`server/modules/leads/csv.ts` is `server-only` and generic; importing it from the audit module is fine (newsletter already does).

In `server/modules/audit/routes.ts`, add before any `/:id` route (Hono matches in order):

```ts
  .get(
    "/export.csv",
    can({ audit: ["read"] }),
    zValidator("query", AuditExportQuery, validationHook),
    async (c) => {
      const csv = await exportAuditCsv(c.get("actor")!, c.req.valid("query"))
      const day = new Date().toISOString().slice(0, 10)
      return c.body(csv, 200, {
        "Cache-Control": "no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="activity-${day}.csv"`,
      })
    }
  )
  .get(
    "/:id",
    can({ audit: ["read"] }),
    zValidator("param", z.object({ id: z.uuid() }), validationHook),
    async (c) => c.json(await getAuditEntry(c.req.valid("param").id))
  )
```

Order: `/`, `/facets`, `/export.csv`, `/:id`.

Run the two integration files → PASS.

- [ ] **Step 5: Write the failing `exportHref` test, then the UI**

Append to `admin/modules/activity/params.test.ts`:

```ts
describe("exportHref", () => {
  it("carries the filters, not the paging", () => {
    expect(
      exportHref({ page: 3, pageSize: 50, action: "page.publish", entityType: "page", from: "2026-01-01" })
    ).toBe("/api/v1/admin/audit/export.csv?action=page.publish&entityType=page&from=2026-01-01")
    expect(exportHref({ page: 1, pageSize: 20 })).toBe("/api/v1/admin/audit/export.csv")
  })
})
```

Run → FAIL. Implement in `admin/modules/activity/params.ts`:
- `activityParsers` gains `entityType: parseAsString`.
- `toAuditParams` gains `entityType: state.entityType?.trim() && state.entityType.length <= 32 ? state.entityType.trim() : undefined` (add `entityType: string | null` to its input type).
- 

```ts
export function exportHref(params: AuditListParams) {
  const query = new URLSearchParams()
  for (const key of ["actor", "action", "entityType", "from", "to"] as const) {
    const value = params[key]
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return `/api/v1/admin/audit/export.csv${qs ? `?${qs}` : ""}`
}
```

`admin/lib/query-keys.ts`: `AuditListParams` gains `entityType?: string`; add `detail: (id: string) => ["audit", "detail", id] as const` under `audit`. `admin/modules/activity/queries.ts`: `toQuery` passes `entityType`; add

```ts
export const auditDetailQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.audit.detail(id),
    queryFn: () => parseResponse(auditApi[":id"].$get({ param: { id } })),
    staleTime: Infinity, // audit rows never change
  })
```

```tsx
// admin/modules/activity/activity-detail.tsx
"use client"

import { useQuery } from "@tanstack/react-query"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { diffRows } from "@/lib/audit/diff"

import { auditDetailQuery } from "./queries"

export function ActivityDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useQuery({ ...auditDetailQuery(id ?? ""), enabled: id !== null })
  const rows = diffRows(detail.data?.diff ?? null)
  return (
    <Sheet open={id !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{detail.data?.summary ?? "Activity"}</SheetTitle>
          <SheetDescription>
            {detail.data ? (
              <>
                <code className="font-mono">{detail.data.action}</code> · {detail.data.entityType}
                {detail.data.entityId ? ` ${detail.data.entityId}` : ""}
                {detail.data.impersonatorName ? ` · by ${detail.data.impersonatorName}, viewing as ${detail.data.actorName ?? detail.data.actorEmail}` : ""}
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        {detail.isPending ? null : rows.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">No field changes were recorded for this entry.</p>
        ) : (
          <dl className="flex flex-col gap-4 px-4 pb-6">
            {rows.map((row) => (
              <div key={row.field} className="flex flex-col gap-1">
                <dt className="font-mono text-xs font-semibold">{row.field}</dt>
                <dd className="grid gap-2 sm:grid-cols-2">
                  <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap"><span className="sr-only">Before: </span>{row.from}</pre>
                  <pre className="overflow-x-auto rounded-md bg-primary/10 p-2 text-xs whitespace-pre-wrap"><span className="sr-only">After: </span>{row.to}</pre>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

In `admin/modules/activity/activity-view.tsx`:
- Add an "Entity" `Select` (items from `facets.data?.entityTypes`, `ALL` sentinel) beside "Action", wired to `filter({ entityType: … })`; the "Reset filters" button also clears `entityType`.
- "Who" cell: `row.impersonatorName ? \`${row.impersonatorName} (viewing as ${who(row)})\` : who(row)`.
- Add a last column "Details" with `<Button variant="ghost" size="sm" onClick={() => setDetail(row.id)} aria-label={\`Details of ${row.summary}\`}>{row.hasDiff ? "Changes" : "Details"}</Button>` (and the same button in `renderCard`), state `const [detail, setDetail] = useState<string | null>(null)`, and render `<ActivityDetail id={detail} onClose={() => setDetail(null)} />`.
- `PageHeader` `actions={<a href={exportHref(params)} download className={SECONDARY_ACTION}>Export CSV</a>}` (import `SECONDARY_ACTION` from `page-header`, as `newsletter-view.tsx` does).

Because columns now need component state (`setDetail`), move the `helper.columns([...])` call inside the component with `useMemo`.

- [ ] **Step 6: Run, lint, commit**

Run: `pnpm vitest run --project unit lib/audit admin/modules/activity && pnpm vitest run --project integration tests/integration/api/audit.test.ts tests/integration/api/audit-export.test.ts && pnpm lint && pnpm typecheck`
Expected: PASS.

```bash
git add lib/audit server/modules/audit admin/modules/activity admin/lib/query-keys.ts \
  tests/integration/api/audit.test.ts tests/integration/api/audit-export.test.ts
git commit -m "feat(activity): entity filter, field diff viewer and CSV export

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: CSP — trace the eval report, make zod jitless, enforce the policy

**Model:** sonnet

**Files:**
- Create: `tests/e2e/support/csp.ts`, `tests/e2e/navigation/csp.spec.ts`, `tests/e2e/admin/shell/csp.spec.ts`, `instrumentation-client.ts`
- Modify: `lib/tracking/csp.ts`, `lib/tracking/csp.test.ts`, `tests/e2e/navigation/headers.spec.ts`, `server/modules/security/csp-report.ts`, `tests/integration/api/csp-report.test.ts`

**Interfaces:**
- Consumes: `PARITY_ROUTES` (`tests/e2e/parity/routes.ts`), `STORAGE.owner` (`tests/e2e/support/storage.ts`), `settle(page)`, `sanitizeUrl`.
- Produces: `recordViolations(page)` / `violations(page)` E2E helpers; `securityHeaders()` emits `Content-Security-Policy` (no `-Report-Only`); CSP report log line gains the sanitised `source-file`.

- [ ] **Step 1: Write the violation recorder and the sweeps (RED: proves the source)**

```ts
// tests/e2e/support/csp.ts
import type { Page } from "@playwright/test"

export type Violation = {
  directive: string
  blocked: string
  source: string
  line: number
  sample: string
}

// Registered before any page script, so violations from the very first
// module evaluation are caught (Ruling R14).
export async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    const list: unknown[] = []
    ;(window as unknown as { __csp: unknown[] }).__csp = list
    document.addEventListener("securitypolicyviolation", (e) => {
      list.push({
        directive: e.effectiveDirective,
        blocked: e.blockedURI,
        source: e.sourceFile,
        line: e.lineNumber,
        sample: e.sample,
      })
    })
  })
}

export const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __csp: Violation[] }).__csp)
```

```ts
// tests/e2e/navigation/csp.spec.ts
import { expect, test } from "@playwright/test"

import { PARITY_ROUTES } from "../parity/routes"
import { recordViolations, violations } from "../support/csp"
import { settle } from "../support/settle"

test.beforeEach(({ page }) => recordViolations(page))

for (const route of PARITY_ROUTES) {
  test(`csp: no violations on ${route.path}`, async ({ page }) => {
    await page.goto(route.path)
    await settle(page)
    expect(await violations(page)).toEqual([])
  })
}

test("csp: no violations through a client-side navigation", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("link", { name: "About" }).first().click()
  await page.waitForURL("**/about")
  await settle(page)
  expect(await violations(page)).toEqual([])
})
```

```ts
// tests/e2e/admin/shell/csp.spec.ts
import { expect, test } from "@playwright/test"

import { recordViolations, violations } from "../../support/csp"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.owner })
test.beforeEach(({ page }) => recordViolations(page))

const SCREENS = [
  "/admin", "/admin/pages", "/admin/insights", "/admin/media", "/admin/leads",
  "/admin/seo", "/admin/marketing", "/admin/appearance", "/admin/account",
  "/admin/users", "/admin/users?tab=roles", "/admin/activity",
]

for (const path of SCREENS) {
  test(`csp: no violations on ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {})
    expect(await violations(page)).toEqual([])
  })
}
```

`/admin/users` exists after Task 4. If a link named "About" does not exist in the header, use the first internal nav link `tests/e2e/navigation/cms.spec.ts` clicks.

Run: `pnpm build && E2E_SKIP_BUILD=1 pnpm test:e2e tests/e2e/navigation/csp.spec.ts tests/e2e/admin/shell/csp.spec.ts --project=desktop --project=admin-desktop`
Expected: FAIL. Record the reported violations (directive `script-src` / blocked `eval`, and their `source` chunk) in `.superpowers/sdd/phase-10-security/progress.md`. Then confirm the source: open the named chunk under `.next/static/chunks/` and find `new F("")` / `allowsEval` (zod). **Decision rule:** if every violation is zod's probe, continue with Step 2. If another source appears, identify its package from the chunk; if it is dev-only or a third-party script the site allowlists (GTM), document it in the progress file and exclude it from the assertion with a comment naming it; otherwise stop and report it to the controller (do not add `'unsafe-eval'`).

- [ ] **Step 2: Make zod jitless before any schema is constructed**

```ts
// instrumentation-client.ts
import * as z from "zod"

// Zod 4 probes `new Function("")` when the first z.object is constructed
// (node_modules/zod/v4/core/util.js `allowsEval`, read by schemas.js at
// construction). Under the CSP that probe is reported as a script-src
// violation on every page even though zod catches it (Ruling R14). Jitless
// mode skips the probe; parsing stays correct, only zod's JIT fast path
// (never available under our CSP anyway) is off. This file runs before the
// app's own modules (instrumentation-client.md: "polyfills").
z.config({ jitless: true })
```

Re-run the two sweeps (rebuild first). Expected: PASS. If violations remain from the same zod probe, the instrumentation file evaluated after a schema module: confirm with the `source`/`line` of the violation, then also add `import "@/instrumentation-client"` as the first import of `features/contact/lib/attribution.ts` and of `admin/lib/query-provider.tsx`, rebuild and re-run. Note which fix was needed in the progress file.

- [ ] **Step 3: Write the failing enforcement unit test**

In `lib/tracking/csp.test.ts` replace the "ships the CSP as Report-Only on every path" test:

```ts
  it("enforces the CSP on every path and still asks for reports", () => {
    const [rule] = find("Content-Security-Policy")
    expect(rule!.source).toBe("/:path*")
    expect(find("Content-Security-Policy-Report-Only")).toHaveLength(0)
    const value = rule!.headers.find((h) => h.key === "Content-Security-Policy")!.value
    expect(value).toContain("report-uri /api/v1/public/csp-report")
    expect(value).not.toContain("'unsafe-eval'")
  })
```

Run: `pnpm vitest run --project unit lib/tracking/csp.test.ts` → FAIL.

- [ ] **Step 4: Enforce**

In `lib/tracking/csp.ts` `securityHeaders`, change the header to:

```ts
        // Enforced from Phase 10 (brief §12.6, Rulings R14/R15). Rollback:
        // rename the key back to Content-Security-Policy-Report-Only.
        { key: "Content-Security-Policy", value: buildCsp(opts) },
```

Update `tests/e2e/navigation/headers.spec.ts`: the first test becomes "public pages carry the enforced CSP and security headers" and asserts `h["content-security-policy"]` contains `https://www.googletagmanager.com` and `h["content-security-policy-report-only"]` is undefined.

In `server/modules/security/csp-report.ts`, add the source file to the log line so production reports name the script (sanitised, no query):

```ts
      console.warn(
        "[csp]",
        text("violated-directive").slice(0, 60),
        sanitizeUrl(text("blocked-uri")) || text("blocked-uri").slice(0, 20),
        sanitizeUrl(text("document-uri")),
        sanitizeUrl(text("source-file")) || "-"
      )
```

Update `tests/integration/api/csp-report.test.ts`'s expected `console.warn` call accordingly (read it first; add a `"source-file": "https://x.test/_next/static/chunks/a.js?v=1"` field to its fixture and expect `https://x.test/_next/static/chunks/a.js` — or whatever `sanitizeUrl` returns for that input).

- [ ] **Step 5: Run everything that touches the public site, commit**

Run:
```bash
pnpm vitest run --project unit lib/tracking && pnpm vitest run --project integration tests/integration/api/csp-report.test.ts
pnpm build && E2E_SKIP_BUILD=1 pnpm test:e2e tests/e2e/navigation tests/e2e/admin/shell/csp.spec.ts --project=desktop --project=admin-desktop
E2E_SKIP_BUILD=1 pnpm test:e2e:tracking
pnpm test:parity
```
Expected: all PASS; parity ≤ 0.1% on every page (the change adds no markup); the tracking suite still loads GTM/consent under the enforced policy.

```bash
git add instrumentation-client.ts lib/tracking/csp.ts lib/tracking/csp.test.ts \
  server/modules/security/csp-report.ts tests/integration/api/csp-report.test.ts \
  tests/e2e/support/csp.ts tests/e2e/navigation/csp.spec.ts tests/e2e/navigation/headers.spec.ts \
  tests/e2e/admin/shell/csp.spec.ts
git commit -m "feat(security): enforce the CSP after silencing zod's eval probe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(If Step 2 needed the import fallback, also stage `features/contact/lib/attribution.ts` and `admin/lib/query-provider.tsx`.)

---

### Task 7: Security pass — per-user limits, auth rate rules, secret rotation, Dependabot

**Model:** sonnet

**Files:**
- Create: `server/api/middleware/actor-limit.ts`, `tests/integration/api/actor-limit.test.ts`, `server/auth/secrets.ts`, `server/auth/secrets.test.ts`, `tests/integration/auth/secret-rotation.test.ts`, `.github/dependabot.yml`
- Modify: `server/modules/users/routes.ts`, `server/modules/audit/routes.ts`, `server/modules/leads/routes.ts`, `server/modules/newsletter/routes.ts`, `server/auth/auth.ts` (custom rules, `secrets`, `resetAuthForTests`), `server/env.ts` (`BETTER_AUTH_SECRETS`), `docs/deploy-dokploy.md`

**Interfaces:**
- Consumes: `hitLimit` (`server/lib/rate-limit-db.ts`), `errorBody`, `resetEnvForTests`, `enrolTotp`, `authPost`, `mergeCookies` (Task 3).
- Produces: `actorLimit(name: string, opts: { limit: number; windowMs: number })`; constants `INVITE_LIMIT`, `VIEW_AS_LIMIT`, `EXPORT_LIMIT_RATE` exported from `actor-limit.ts`; `parseAuthSecrets(raw: string | undefined): { version: number; value: string }[] | undefined`; `resetAuthForTests()`.

- [ ] **Step 1: Write the failing limiter test**

```ts
// tests/integration/api/actor-limit.test.ts
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import { closeDb } from "@/server/db/client"
import { clearOutbox } from "@/server/lib/email"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterEach(clearOutbox)
afterAll(closeDb)

describe("per-user limits (Ruling R16)", () => {
  it("allows 20 invites an hour, then 429 with Retry-After", async () => {
    const cookie = await cookieFor("owner")
    for (let i = 0; i < 20; i++) {
      const r = await adminRequest("/users/invite", cookie, {
        method: "POST",
        body: { email: `p${i}@example.com`, name: `P${i}`, role: "viewer" },
      })
      expect(r.status, `invite ${i}`).toBe(201)
    }
    const over = await adminRequest("/users/invite", cookie, {
      method: "POST",
      body: { email: "p20@example.com", name: "P20", role: "viewer" },
    })
    expect(over.status).toBe(429)
    expect(Number(over.headers.get("retry-after"))).toBeGreaterThan(0)
    expect((await over.json()).error.code).toBe("RATE_LIMITED")
  })

  it("counts each person separately", async () => {
    const a = await cookieFor("owner", "a@example.com")
    const b = await cookieFor("admin", "b@example.com")
    for (let i = 0; i < 10; i++) await adminRequest("/audit/export.csv", a)
    expect((await adminRequest("/audit/export.csv", a)).status).toBe(429)
    expect((await adminRequest("/audit/export.csv", b)).status).toBe(200)
  })

  it("never limits a request it refuses first", async () => {
    const viewer = await cookieFor("viewer")
    for (let i = 0; i < 15; i++) expect((await adminRequest("/audit/export.csv", viewer)).status).toBe(403)
  })
})
```

Run → FAIL (21st invite is 201).

- [ ] **Step 2: Implement `actorLimit` and apply it**

```ts
// server/api/middleware/actor-limit.ts
import "server-only"

import { createMiddleware } from "hono/factory"

import { errorBody } from "@/server/api/errors"
import type { AppEnv } from "@/server/api/types"
import { hitLimit } from "@/server/lib/rate-limit-db"

// Ruling R16. Per signed-in user, in Postgres (survives restarts and would
// survive a second replica). Placed after can(), so refused calls cost nothing.
export const INVITE_LIMIT = { limit: 20, windowMs: 60 * 60_000 }
export const VIEW_AS_LIMIT = { limit: 10, windowMs: 10 * 60_000 }
export const EXPORT_LIMIT_RATE = { limit: 10, windowMs: 10 * 60_000 }

export const actorLimit = (name: string, opts: { limit: number; windowMs: number }) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const actor = c.get("actor")
    if (!actor) return next()
    const { allowed, retryAfterSec } = await hitLimit(`${name}:user:${actor.userId}`, opts)
    if (!allowed) {
      return c.json(
        errorBody("RATE_LIMITED", "Too many requests. Wait a moment and try again.", c.get("requestId")),
        429,
        { "Retry-After": String(retryAfterSec) }
      )
    }
    await next()
  })
```

Apply (each right after the route's `can(...)`/`viewing` middleware, before validation):
- `server/modules/users/routes.ts`: `/invite` and `/:id/resend-invite` → `actorLimit("invite", INVITE_LIMIT)` (shared bucket); `/:id/impersonate` → `actorLimit("view-as", VIEW_AS_LIMIT)`.
- `server/modules/audit/routes.ts` `/export.csv` → `actorLimit("export", EXPORT_LIMIT_RATE)`.
- `server/modules/leads/routes.ts` `/export.csv` and `/dsar` → `actorLimit("export", EXPORT_LIMIT_RATE)`; `server/modules/newsletter/routes.ts` `/export.csv` → same.

`hitLimit` already runs one atomic upsert; expired rows are purged by `server/modules/leads/retention.ts`. The existing `users-invite.test.ts`, `leads-admin.test.ts` and `newsletter.test.ts` must still pass (each test resets the DB, so buckets start empty).

Run the limiter test and those three files → PASS.

- [ ] **Step 3: Tighten Better Auth's own rules**

In `server/auth/auth.ts` `rateLimit.customRules` add:

```ts
        "/change-password": { window: 300, max: 5 },
        "/reset-password": { window: 300, max: 5 },
```

(They are enforced only where `rateLimit.enabled` is true, i.e. staging and production; no test change.)

- [ ] **Step 4: Write the failing secrets unit test**

```ts
// server/auth/secrets.test.ts
import { describe, expect, it } from "vitest"

import { parseAuthSecrets } from "./secrets"

const s = (n: number) => String(n).repeat(40)

describe("parseAuthSecrets", () => {
  it("reads Better Auth's versioned list, newest first", () => {
    expect(parseAuthSecrets(`2:${s(2)}, 1:${s(1)}`)).toEqual([
      { version: 2, value: s(2) },
      { version: 1, value: s(1) },
    ])
    expect(parseAuthSecrets(undefined)).toBeUndefined()
    expect(parseAuthSecrets("")).toBeUndefined()
  })

  it.each([
    ["no version", s(1)],
    ["short secret", "1:short"],
    ["duplicate version", `1:${s(1)},1:${s(2)}`],
    ["negative version", `-1:${s(1)}`],
  ])("refuses %s", (_label, raw) => {
    expect(() => parseAuthSecrets(raw)).toThrow(/BETTER_AUTH_SECRETS/)
  })
})
```

Run → FAIL (module not found).

- [ ] **Step 5: Implement, validate in env, pass to Better Auth**

```ts
// server/auth/secrets.ts
import "server-only"

// Better Auth's BETTER_AUTH_SECRETS format: "<version>:<secret>,…", newest
// first (node_modules/better-auth/dist/context/secret-utils.mjs). Parsed here
// so a typo fails at startup with our message, not deep inside Better Auth.
export function parseAuthSecrets(raw: string | undefined) {
  if (!raw?.trim()) return undefined
  const seen = new Set<number>()
  return raw.split(",").map((entry) => {
    const match = /^\s*(\d+):(.+?)\s*$/.exec(entry)
    if (!match) throw new Error(`BETTER_AUTH_SECRETS: expected "<version>:<secret>", got "${entry.trim().slice(0, 8)}…"`)
    const version = Number(match[1])
    const value = match[2]!
    if (value.length < 32) throw new Error(`BETTER_AUTH_SECRETS: version ${version} is shorter than 32 characters`)
    if (seen.has(version)) throw new Error(`BETTER_AUTH_SECRETS: version ${version} appears twice`)
    seen.add(version)
    return { version, value }
  })
}
```

`-1:…` fails the `^\d+:` match, so it throws the "expected" message.

In `server/env.ts` add to the schema (after `BETTER_AUTH_URL`):

```ts
    // Rotation (docs/brief.md §7.1): "2:<new>,1:<old>". BETTER_AUTH_SECRET
    // stays set as the legacy key so data encrypted before rotation decrypts.
    BETTER_AUTH_SECRETS: z.string().optional(),
```

and in `superRefine`:

```ts
    try {
      parseAuthSecrets(env.BETTER_AUTH_SECRETS)
    } catch (error) {
      ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_SECRETS"], message: (error as Error).message })
    }
```

`server/env.ts` is `server-only`; importing `./auth/secrets` from it is fine (both server-only, no cycle: secrets imports nothing).

In `server/auth/auth.ts`: import `parseAuthSecrets`, add `secrets: parseAuthSecrets(env.BETTER_AUTH_SECRETS),` next to `secret:`, and add:

```ts
// Tests rebuild Better Auth after changing its secrets; the app never calls this.
export function resetAuthForTests() {
  instance = undefined
}
```

Run `pnpm vitest run --project unit server/auth/secrets.test.ts` → PASS.

- [ ] **Step 6: Write and pass the rotation integration test**

```ts
// tests/integration/auth/secret-rotation.test.ts
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import { getAuth, resetAuthForTests } from "@/server/auth/auth"
import { closeDb } from "@/server/db/client"
import { resetEnvForTests } from "@/server/env"

import { adminRequest, createUser, PASSWORD, signIn } from "../helpers/auth"
import { resetDb } from "../helpers/db"
import { authPost, enrolTotp, mergeCookies } from "../helpers/two-factor"

const NEW = "n".repeat(20) + "0123456789abcdefghijklmnop"

beforeEach(resetDb)
afterEach(() => {
  delete process.env.BETTER_AUTH_SECRETS
  resetEnvForTests()
  resetAuthForTests()
})
afterAll(closeDb)

function rotate() {
  process.env.BETTER_AUTH_SECRETS = `2:${NEW}`
  resetEnvForTests()
  resetAuthForTests()
}

describe("BETTER_AUTH_SECRETS rotation (Ruling R17)", () => {
  it("signs everyone out but keeps two-factor working", async () => {
    await createUser("editor", "ed@example.com")
    const { cookie, totp } = await enrolTotp(await signIn("ed@example.com"))

    rotate()

    // Session cookies were signed with the old secret.
    expect((await adminRequest("/me", cookie)).status).toBe(401)
    // A password sign-in opens the 2FA challenge…
    const challenge = await getAuth().api.signInEmail({
      body: { email: "ed@example.com", password: PASSWORD },
      asResponse: true,
    })
    const pending = mergeCookies("", challenge.headers.getSetCookie())
    // …and the TOTP secret encrypted under the old key still decrypts.
    const verify = await authPost("/two-factor/verify-totp", pending, { code: totp.generate() })
    expect(verify.status).toBe(200)
    const fresh = mergeCookies(pending, verify.headers.getSetCookie())
    expect((await adminRequest("/me", fresh)).status).toBe(200)
  })
})
```

If the in-process `app` keeps a reference to the first auth instance (it calls `getAuth()` per request in `server/api/app.ts`, so it should not), the 401 assertion will fail — fix by keeping `getAuth()` per request, never by caching the handler. If TOTP verification fails within the same 30-second step as enrolment due to Better Auth's replay protection, wait for the next period with `await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 500))` and give the test a 45 s timeout.

Run: `pnpm vitest run --project integration tests/integration/auth/secret-rotation.test.ts` → PASS.

- [ ] **Step 7: Document the rotation procedure and add Dependabot**

Append to `docs/deploy-dokploy.md`:

```markdown
## Phase 10 (users, roles and security)

### Rotating secrets

| Secret | How to rotate | Effect |
| --- | --- | --- |
| Better Auth (`BETTER_AUTH_SECRET`, `BETTER_AUTH_SECRETS`) | Generate a new value (`openssl rand -base64 48`). Set `BETTER_AUTH_SECRETS="<n+1>:<new>,<n>:<previous>…"` (newest first; on the first rotation just `"1:<new>"`). **Keep `BETTER_AUTH_SECRET` unchanged** — it is the legacy key that decrypts two-factor secrets and backup codes created before rotation. Redeploy. | Everyone is signed out (session cookies are signed with the newest secret only) and signs in again; two-factor keeps working. Never remove an old version while two-factor data encrypted with it exists. |
| `APP_ENCRYPTION_KEY` | Set the new key, redeploy, then re-enter the Meta CAPI token on **Marketing ▸ Tracking** (it is encrypted with this key). | Server-side conversions pause until the token is saved again. |
| `CRON_SECRET` | Update the Dokploy env and the scheduler's `Authorization: Bearer` header together. | Scheduled publishing and purges fail until both match. |
| IP-hash salt | **Site settings ▸ Privacy ▸ Rotate salt**. | New rate-limit buckets and hashes; old hashes stop matching. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Create a new R2 token, update env, redeploy, then revoke the old token. | None if done in that order. |
| `SMTP_URL` / `RESEND_API_KEY`, `TURNSTILE_*` | Create the new credential, update env, redeploy, revoke the old one. | None if done in that order. |

### Content-Security-Policy

The CSP is **enforced** from Phase 10. Violations still arrive in the app log as `[csp] <directive> <blocked> <page> <script>`. If a legitimate script is blocked after launch, add its host to `CUSTOM_SCRIPT_HOSTS` (`lib/tracking/hosts.ts`); in an emergency, rename the header back to `Content-Security-Policy-Report-Only` in `lib/tracking/csp.ts` and redeploy.

### Rate limits

Sign-in 5/min, password reset 3 per 5 min, `/two-factor/*` 5/min, password change and reset 5 per 5 min (Better Auth, database-backed, on in staging and production); invites 20/hour, View as 10 per 10 min and CSV exports 10 per 10 min per admin user; public forms per IP hash. ⌘K search is limited in memory (one replica).
```

Check the actual name of the privacy salt control in `admin/modules/globals` (or wherever the Privacy settings page lives) and use its real label.

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
    groups:
      minor-and-patch:
        update-types: [minor, patch]
    ignore:
      # docs/plan.md Global Constraints: Next 16.3.x and Hono 4 only.
      - dependency-name: next
        update-types: [version-update:semver-minor, version-update:semver-major]
      - dependency-name: eslint-config-next
        update-types: [version-update:semver-minor, version-update:semver-major]
      - dependency-name: hono
        update-types: [version-update:semver-major]
      - dependency-name: better-auth
        update-types: [version-update:semver-minor, version-update:semver-major]
      - dependency-name: drizzle-orm
        update-types: [version-update:semver-minor, version-update:semver-major]
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
```

Run: `pnpm audit --prod --audit-level high` — expected exit 0 (the CI step from Phase 0.7). If it reports a high advisory, record it in the progress file and stop for the controller; do not add overrides silently.

- [ ] **Step 8: Lint, typecheck, commit**

Run: `pnpm lint && pnpm typecheck && pnpm vitest run --project integration tests/integration/api/actor-limit.test.ts tests/integration/api/users-invite.test.ts tests/integration/api/leads-admin.test.ts tests/integration/api/newsletter.test.ts tests/integration/auth`

```bash
git add server/api/middleware/actor-limit.ts tests/integration/api/actor-limit.test.ts \
  server/modules/users/routes.ts server/modules/audit/routes.ts server/modules/leads/routes.ts \
  server/modules/newsletter/routes.ts server/auth/auth.ts server/auth/secrets.ts \
  server/auth/secrets.test.ts server/env.ts tests/integration/auth/secret-rotation.test.ts \
  docs/deploy-dokploy.md .github/dependabot.yml
git commit -m "feat(security): per-user limits, secret rotation and dependabot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Acceptance E2E — View as an editor hides admin-only navigation — and phase exit

**Model:** sonnet

**Files:**
- Create: `tests/e2e/admin/users/view-as.spec.ts`
- Modify: `.superpowers/sdd/plan/progress.md`

**Interfaces:**
- Consumes: `/admin/users` (Task 4), View-as (Task 2), `STORAGE.owner` (signed-in `shellOwner` with 2FA), `E2E_USERS.editor` ("Eddie Editor").
- Produces: the plan.md acceptance E2E.

- [ ] **Step 1: Write the acceptance spec**

```ts
// tests/e2e/admin/users/view-as.spec.ts
import { expect, test } from "@playwright/test"

import { E2E_USERS } from "../../support/admin"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.owner })

// docs/plan.md Phase 10 acceptance: View as an editor hides admin-only
// navigation. The owner's own session is untouched: View-as runs on a new
// session and Stop viewing restores the original one.
test("View as an editor hides admin-only navigation, and Stop viewing restores it", async ({ page }) => {
  const editor = E2E_USERS.editor
  await page.goto("/admin/users")
  await expect(page.getByRole("heading", { name: "Users & roles" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Users & roles" })).toBeVisible()

  await page.getByRole("button", { name: `Actions for ${editor.name}` }).click()
  await page.getByRole("menuitem", { name: "View as" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "View as" }).click()

  await page.waitForURL(/\/admin$/)
  await expect(page.getByRole("status").filter({ hasText: `Viewing as ${editor.name}` })).toBeVisible()
  for (const name of ["Users & roles", "Activity log", "Appearance", "Enquiries", "Site settings", "Marketing"]) {
    await expect(page.getByRole("link", { name, exact: true }), name).toHaveCount(0)
  }
  await expect(page.getByRole("link", { name: "Pages", exact: true }).first()).toBeVisible()
  // The API agrees with the navigation.
  expect((await page.request.get("/api/v1/admin/users")).status()).toBe(403)

  await page.getByRole("button", { name: "Stop viewing" }).click()
  await page.waitForURL(/\/admin\/users$/)
  await expect(page.getByRole("status").filter({ hasText: "Viewing as" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Users & roles" })).toBeVisible()
})

test("the roles tab shows the generated matrix", async ({ page }) => {
  await page.goto("/admin/users?tab=roles")
  const matrix = page.getByRole("region", { name: "Permission matrix" })
  await expect(matrix.getByRole("rowheader", { name: "code.update" })).toBeVisible()
  await expect(matrix.getByRole("columnheader", { name: "Intake" })).toBeVisible()
})
```

The sidebar's "Users & roles" and "Activity log" links live in the footer dock the user is building (`admin/components/shell/footer-dock.tsx`, uncommitted). The assertion needs them to be links with those accessible names (an icon link needs `aria-label`). If the dock renders them differently, **do not edit the shell files**: report to the controller, who coordinates with the user, and meanwhile assert on the API (`/api/v1/admin/users` 403) plus the links that live in the main menu (`Enquiries`, `Appearance`, `Marketing`, `Site settings`).

- [ ] **Step 2: Run it**

Run: `pnpm build && E2E_SKIP_BUILD=1 pnpm test:e2e tests/e2e/admin/users --project=admin-desktop`
Expected: PASS. The spec only changes the owner's browser context; the shared storage files are not rewritten.

- [ ] **Step 3: Run the full verification**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration
DATABASE_URL=postgres://x@127.0.0.1:1/x pnpm build
E2E_SKIP_BUILD=1 pnpm test:e2e --project=desktop --project=admin-desktop --grep-invert "parity:|visual:|lighthouse:|perf:"
E2E_SKIP_BUILD=1 pnpm test:e2e:tracking
E2E_SKIP_BUILD=1 pnpm test:e2e:appearance
pnpm test:parity
git status --short server/db/migrations
```
Expected: all green; parity ≤ 0.1% on every page; no migration changes. Re-seed (`pnpm e2e:seed`) before the shell/a11y runs if activity rows from earlier runs disturb them (Phase 5 note). The user's in-progress `tests/e2e/admin/shell/navigation.spec.ts` may fail for reasons unrelated to this phase; report, don't fix.

- [ ] **Step 4: Record the phase exit**

Append to `.superpowers/sdd/plan/progress.md`:

```
Phase 10 (users, roles and security): complete. Plan docs/plans/phase-10-security.md. Rulings R1–R19. Carries closed: Phase 1.1/1.7 owner invariants (R1/R2), Phase 1.3 BETTER_AUTH_SECRETS rotation (R17), Phase 1.6/2.9 audit entity filter (R13), Phase 1.11 owner protection on admin update-user (HTTP admin endpoints stay disabled; our routes never write email/2FA), Phase 2 "View-as/list-users unavailable until Phase 10" (R7), Phase 2.8 Security/Changes KPI targets now real pages, Phase 5 R4 user↔author link UI (R6), Phase 6 resend-invite (R19), Phase 8 CSP enforcement + eval trace (R14/R15), F8b audit for role/ban changes. Kept: in-memory ⌘K/test-event limiters (single replica, R16). Open questions for the user: R8 View-as read-only everywhere?; R15 CUSTOM_SCRIPT_HOSTS before launch.
```

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/admin/users/view-as.spec.ts .superpowers/sdd/plan/progress.md
git commit -m "test(users): View as acceptance e2e and phase 10 exit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Spec coverage

| Requirement | Tasks |
| --- | --- |
| Users list: role badges, 2FA status, last active (§9.3, contract 1) | 1 (`listUsers`, R5), 4 |
| Invite dialog (Task 1.7 API) | 4 (`InviteDialog`), 7 (limit) |
| Role change, ban/unban, revoke sessions (§8.3) | 1, 4 |
| Delete respecting owner invariants, last owner protected (§7.2) | 1 (R1/R2, race tests) |
| View as: banner + audit entry, one hour (§7.4) | 2, 4, 8 |
| Read-only permission matrix generated from `roles` (contract 2) | 4 (R12) |
| Activity log: field diff viewer, filters, CSV export (contract 3, §9.3, §8.2) | 5 |
| Account security: sessions (existing), 2FA management, owners/admins can't disable, backup-code regeneration (contract 4) | 3 |
| Security pass: rate-limit review, `pnpm audit` in CI, secret rotation (contract 5, §15) | 7 (R16–R18) |
| CSP Report-Only → enforced (§12.6, Phase 8 carry) | 6 |
| Acceptance 1: integration matrix incl. owner and last-owner invariants | 1 (`users-admin.test.ts`), 2 (`users-view-as.test.ts`) |
| Acceptance 2: E2E View as an editor hides admin-only navigation | 8 |

## Facts verified while writing this plan

- `server/auth/hooks.ts` refuses every HTTP `/admin/*` Better Auth path except `/admin/stop-impersonating` (`ADMIN_ENDPOINT_DISABLED`) and the device endpoints; server-side `auth.api.*` calls carry no `request` and pass, still subject to the 2FA rule.
- `lib/auth/permissions.ts`: admin = owner's statements with `user`/`session` from Better Auth's `adminAc` (no `impersonate-admins`) and `code: []`; `parseRoles` splits on `,` without trimming.
- `users` has `role`, `banned`, `ban_reason`, `ban_expires`, `two_factor_enabled`; `sessions.impersonated_by` is `text` with no FK; every FK to `users.id` outside the auth tables is `on delete set null`, so deleting a user never fails on authored rows.
- `getFreshSession` treats a banned user (no end date, or end date in the future) as anonymous; every Hono and DAL read uses it (`disableCookieCache: true`).
- `server/modules/account/routes.ts` already refuses account self-service during View-as; `server/auth/account-hooks.ts` does the same for `/change-password` and `/update-user`.
- `tests/integration/helpers/auth.ts` exposes `viewAs(cookie, userId)` (server-side `impersonateUser`, `asResponse: true`), proving the server-side start works.
- Better Auth 1.7.7 `create-context.mjs`: `options.secrets ?? parseSecretsEnv(env.BETTER_AUTH_SECRETS)`; legacy `secret` kept in `secretConfig.legacySecret`; signed cookies use `ctx.context.secret` (newest only); two-factor TOTP and backup codes use `secretConfig`.
- zod 4.6.5: `allowsEval` returns false under `globalConfig.jitless`; `$ZodObjectJIT` reads `allowsEval.value` at construction; `globalConfig` lives on `globalThis.__zod_globalConfig`, so one `z.config()` call covers every copy of zod in the bundle.
- `components/attribution-capture.tsx` (in the site layout, every page) calls `Attribution.parse({})`; the CSP has `'unsafe-eval'` only in development.
- CI already runs `pnpm audit --prod --audit-level high` (`.github/workflows/ci.yml`); there is no Dependabot or Renovate config.
- `lib/admin/nav.ts` (working tree) has `users` → `/admin/users` (`user.list`, `dock: true`) and `activity` → `/admin/activity` (`audit.read`, `dock: true`); no change is needed for the matrix tab.

Plan complete and saved to `docs/plans/phase-10-security.md`. Recommended execution: **Subagent-driven** (sonnet default; opus for Tasks 1 and 2; fix loops only on Critical/Important findings), because Tasks 2, 4, 7 and 8 consume Task 1's exact names and a mistake in the access lock or the View-as cookie handling would let an admin lock out the owner or keep a banned person signed in.

# Staging on Dokploy (one-time setup)

1. Create a PostgreSQL 17 service and copy its internal connection URL.
2. Create an application from this repo: branch `feat/platform`, build type Dockerfile.
3. Set the environment variables from `.env.example` at runtime:
   - `SITE_ENV=staging`, a new 48-character `BETTER_AUTH_SECRET`, `DATABASE_URL` from step 1.
   - `SITE_URL` and `BETTER_AUTH_URL` must share one origin (same-origin checks use `SITE_URL`), and `BETTER_AUTH_URL` must be `https://` whenever `SITE_ENV` is not `development`.
   - `EMAIL_DRIVER=smtp` with `SMTP_URL` (until Phase 6); `EMAIL_DRIVER=log` is rejected when `SITE_ENV=production`.
   - `EMAIL_FROM`.
4. Build arg `NEXT_DEPLOYMENT_ID`: set it to a unique value per deploy (for example the git SHA) so Next.js can protect against version skew between old clients and new servers.
5. Health endpoints: use `/api/v1/health/live` (liveness, no database; this is the image's Docker `HEALTHCHECK`, so a database blip never restarts the container) for container/restart checks, and `/api/v1/health` (readiness, 503 when the database is down) for the Traefik/Dokploy routing check and uptime monitors. Attach the staging domain.
6. Proxy headers: Traefik must set or overwrite `X-Real-IP` and `X-Forwarded-For` (never pass through client-supplied values). Better Auth keys its rate limits on them.
7. Deploy. The container applies pending migrations (advisory-locked) before the server starts.
8. Create the owner once, inside the running container, so it uses the container's own env (database, email driver, URLs):

   ```bash
   docker exec <container> node admin-create.cjs --email you@example.com --name "Your Name"
   ```

   Do not run `pnpm admin:create` from a laptop against the staging database.

## Phase 6 (enquiries, forms and email)

- `CRON_SECRET` (Phase 5) is required in every non-development environment: the scheduler tick (`/api/v1/cron/tick`) rejects calls without it. Set it before deploying if it is not already.
- No other new required env. Optional:
  - `EMAIL_DRIVER=resend` + `RESEND_API_KEY`. Verify the sending domain in Resend (SPF, DKIM, DMARC) first; `EMAIL_FROM` must use it.
  - `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` (both or neither). The widget loads from `challenges.cloudflare.com`, so the Phase 8 CSP must allow it (script, frame and connect) once CSP ships.
- Traefik must overwrite `X-Real-IP` with the real client address. The enquiry and newsletter limiters key on it; if it is missing, every visitor shares one bucket of 5 per 10 minutes.
- Set the notification recipients in Admin → Site settings → Notifications (they fall back to the contact email).
- The retention purge (closed and spam enquiries, unconfirmed subscriptions, spent rate-limit windows) runs inside the existing cron tick: no new schedule.

## Phase 7

- No new environment variables. `SITE_ENV=staging` on staging makes `robots.txt` disallow everything; production must run `SITE_ENV=production` and a correct `SITE_URL` (canonicals, sitemap and share-card URLs use it).
- Proxy now calls `GET /api/v1/resolve` over loopback for every public page; if the container does not listen on `127.0.0.1:$PORT`, set `INTERNAL_ORIGIN` (Phase 5 note). A slow or failing resolver only costs real 404s/redirects (fail-open), never availability.
- After the first production deploy: submit `<SITE_URL>/sitemap.xml` in Google Search Console and Bing Webmaster Tools, add their verification codes in Admin → SEO → Defaults, and run the Rich Results Test on `/` and one article.
- The share-card fonts ship under `assets/fonts` (SIL OFL 1.1, licence files alongside).

## Phase 8 (marketing and tracking)

Environment (both optional):

| Variable                 | Purpose                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENCRYPTION_KEY`     | Encrypts the Meta Conversions API token at rest. Generate with `openssl rand -base64 32`. Set it before saving a CAPI token; rotating it means re-entering the token. |
| `DISABLE_CUSTOM_SCRIPTS` | Kill switch: set to stop every custom code snippet from loading, whatever the owner has saved.                                                                        |

### Tracking setup

1. **GTM:** Admin → Import Container → `docs/gtm-container.json` → Merge → "Rename conflicting". Leave the Meta tags paused unless the site's own Pixel is switched off (Ruling R7). Anyone who can publish the container must use 2FA (brief §12.6).
2. **GA4 property:** Google signals off; ads personalisation off; enhanced measurement on for scrolls, outbound clicks and file downloads, with "Page changes based on browser history events" off, form interactions off and **"Site search" off** (otherwise the insights `q` parameter would be sent as `search_term`); mark `generate_lead` as a key event. Mental-health counselling is a Google Ads sensitive category: no remarketing audiences, no Customer Match.
3. **Meta Events Manager:** Automatic Advanced Matching off; no custom conversions on URLs.
4. **HSTS:** the app sends `Strict-Transport-Security` with `includeSubDomains`, so every subdomain of the site domain must serve valid HTTPS before the first deploy; browsers refuse plain HTTP on any of them.
5. **CSP:** the header is Report-Only. Reports arrive in the app log as `[csp] ...`; after a clean week, Phase 10 switches the header to enforcing.
6. Enhanced matching stays off unless the practice's DPO or legal adviser approves (brief §2.3 Q6).

## Phase 10 (users, roles and security)

### Rotating secrets

| Secret                                                    | How to rotate                                                                                                                                                                                                                                                                                                         | Effect                                                                                                                                                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Better Auth (`BETTER_AUTH_SECRET`, `BETTER_AUTH_SECRETS`) | Generate a new value (`openssl rand -base64 48`). Set `BETTER_AUTH_SECRETS="<n+1>:<new>,<n>:<previous>…"` (newest first; on the first rotation just `"1:<new>"`). **Keep `BETTER_AUTH_SECRET` unchanged** — it is the legacy key that decrypts two-factor secrets and backup codes created before rotation. Redeploy. | Everyone is signed out (session cookies are signed with the newest secret only) and signs in again; two-factor keeps working. Never remove an old version while two-factor data encrypted with it exists. |
| `APP_ENCRYPTION_KEY`                                      | Set the new key, redeploy, then re-enter the Meta CAPI token on **Marketing ▸ Tracking** (it is encrypted with this key).                                                                                                                                                                                             | Server-side conversions pause until the token is saved again.                                                                                                                                             |
| `CRON_SECRET`                                             | Update the Dokploy env and the scheduler's `Authorization: Bearer` header together.                                                                                                                                                                                                                                   | Scheduled publishing and purges fail until both match.                                                                                                                                                    |
| IP-hash key                                               | Derived from `BETTER_AUTH_SECRET` (no separate admin control). Changing `BETTER_AUTH_SECRET` also changes it, and breaks pre-rotation two-factor data, so do not rotate it for this purpose.                                                                                                                          | —                                                                                                                                                                                                         |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`               | Create a new R2 token, update env, redeploy, then revoke the old token.                                                                                                                                                                                                                                               | None if done in that order.                                                                                                                                                                               |
| `SMTP_URL` / `RESEND_API_KEY`, `TURNSTILE_*`              | Create the new credential, update env, redeploy, revoke the old one.                                                                                                                                                                                                                                                  | None if done in that order.                                                                                                                                                                               |

### Content-Security-Policy

The CSP is **enforced** from Phase 10. Violations still arrive in the app log as `[csp] <directive> <blocked> <page> <script>`. If a legitimate script is blocked after launch, add its host to `CUSTOM_SCRIPT_HOSTS` (`lib/tracking/hosts.ts`); in an emergency, rename the header back to `Content-Security-Policy-Report-Only` in `lib/tracking/csp.ts` and redeploy.

### Rate limits

Sign-in 5/min, password reset 3 per 5 min, `/two-factor/*` 5/min, password change and reset 5 per 5 min (Better Auth, database-backed, on in staging and production); invites 20/hour, View as 10 per 10 min and CSV exports 10 per 10 min per admin user; public forms per IP hash. ⌘K search is limited in memory (one replica).

## Phase 11 (launch)

- **Deploys wait for CI.** Turn **off** Auto Deploy on both Dokploy apps. Create a Dokploy API key (Settings ▸ Profile ▸ API/CLI). In GitHub ▸ Settings ▸ Environments create `staging` and `production`, each with secrets `DOKPLOY_URL` (e.g. `https://dokploy.example.com`), `DOKPLOY_API_KEY`, `DOKPLOY_APPLICATION_ID` (the app's id from its Dokploy URL or `/api/application.all`). Optionally require a reviewer on `production`. Without the secrets the `deploy` job only warns.
- **Deployment id.** No build arg is needed: the Dockerfile reads the commit from the clone (`scripts/deployment-id.sh`). Leave `NEXT_DEPLOYMENT_ID` unset in Dokploy unless you want to override it.
- **Backups.** Dokploy ▸ the PostgreSQL service ▸ Backups: add an S3 destination for an R2 bucket (endpoint `https://<account>.r2.cloudflarestorage.com`, region `auto`, a token scoped to that bucket), schedule daily (e.g. `0 3 * * *`), keep 30. Run "Backup now" once and confirm the object appears. Then run the restore drill ([runbook §4](./runbook.md#4-restore-a-backup)) with a separate **read-only** token. This is a manual setup step; nothing in the repo configures it.
- **Owner recovery** ships in the image as `owner-recover.cjs` ([runbook §6](./runbook.md#6-recover-the-owner-account)); it needs `--email` and `--confirm`.
- **Environment checklist.** `CRON_SECRET` (32+ characters, required outside development) with a Dokploy schedule calling `/api/v1/cron/tick` every minute. Traefik must overwrite `X-Real-IP` and `X-Forwarded-For` (rate limits key on them). Optional: `BETTER_AUTH_SECRETS` (rotation, see "Rotating secrets"), `APP_ENCRYPTION_KEY`, `TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY`, `RESEND_API_KEY` with `EMAIL_DRIVER=resend`, `DISABLE_CUSTOM_SCRIPTS`, S3/R2 media settings.
- **Media bucket headers (R2).** Add Cloudflare Transform Rules on the media domain: for paths not ending in `.pdf`, `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox`; for `.pdf`, `nosniff` only ([runbook §9](./runbook.md#9-media-bucket-headers)).
- **Notification bell mount.** The bell is built but not mounted, because the admin shell files are being edited. In `admin/components/shell/notifications-button.tsx` replace the component body with:
  ```tsx
  "use client"
  import { NotificationsBell } from "@/admin/modules/notifications/notifications-bell"
  import { ICON_BUTTON } from "./constants"
  export function NotificationsButton() {
    return <NotificationsBell className={ICON_BUTTON} />
  }
  ```
  Or in `topbar.tsx` swap `<NotificationsButton />` for `<NotificationsBell className={ICON_BUTTON} />`. Then change `test.fixme(` to `test(` in `tests/e2e/admin/content/notifications.spec.ts` and run it with `axe.spec.ts` (`--project=admin-desktop`).
- **Admin visual baselines.** After shell edits, re-record them with `pnpm test:visual:linux` and commit the PNGs ([runbook §2](./runbook.md#2-deploy)).

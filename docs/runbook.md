# Runbook

Operating the Magda Kennedy site. Deployment details live in [deploy-dokploy.md](./deploy-dokploy.md); the spec is [brief.md](./brief.md).

## 1. Environments

1. **Staging**: branch `feat/platform`, `SITE_ENV=staging`. Robots disallow everything and a ribbon marks the site.
2. **Production**: branch `main`, `SITE_ENV=production`, one replica (brief §5.6; ⌘K search and some caches are in memory).
3. Environment variables live in Dokploy ▸ the app ▸ Environment. Changing one needs a redeploy.
4. Health: `/api/v1/health/live` (liveness, no database) and `/api/v1/health` (readiness, 503 when the database is down).

## 2. Deploy

1. Push to the branch.
2. CI must pass: `check`, `e2e`, `visual`.
3. The `deploy` job calls Dokploy. Migrations run at container start under an advisory lock.
4. Watch Dokploy ▸ Deployments until the new one is "Done".
5. Smoke test: `/` loads; `/admin` signs in; `curl -i https://<host>/api/v1/health` returns 200; on staging, submit one enquiry and see it in Mailpit or the inbox.
6. After any edit to the admin shell, re-record the admin visual baselines (they are pixel-compared in CI): `pnpm test:visual:linux` (Linux baselines in the Playwright image, `scripts/visual-baselines-linux.sh`), review the image diff, commit the updated PNGs.

## 3. Roll back

1. Dokploy ▸ Deployments ▸ the previous deployment ▸ Redeploy. Or `git revert <sha>` and push.
2. Migrations are forward-only and additive by convention. A rollback across a destructive migration needs a restore (section 4).
3. Clients on the old build are not reloaded automatically; the deployment id makes their next client-side navigation fall back to a full page load, so open tabs recover then.

## 4. Restore a backup

Backups are Dokploy scheduled backups to R2 (see [deploy-dokploy.md](./deploy-dokploy.md) "Phase 11").

1. Production restore: Dokploy ▸ the PostgreSQL service ▸ Backups ▸ pick the backup ▸ Restore. Redeploy the app afterwards.
2. Monthly drill, against a **read-only** R2 token, with the local stack running (`pnpm db:up`):
   ```bash
   export BACKUP_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
   export BACKUP_S3_BUCKET=<bucket> BACKUP_S3_ACCESS_KEY_ID=<read-only id> BACKUP_S3_SECRET_ACCESS_KEY=<read-only secret>
   # optional: BACKUP_S3_PREFIX, BACKUP_S3_REGION (default auto)
   pnpm backup:drill --latest
   ```
   Or from a downloaded file (`.dump` or `.sql`, optionally `.gz`): `pnpm backup:drill --file backup.dump.gz`.
3. The drill restores into `mk_restore_drill` in the local Docker Postgres, prints row counts, checks migrations, an owner and published pages, prints `Restore drill PASSED`, then drops that database. It refuses any database not named `*_restore_drill` (`DRILL_DATABASE_URL` overrides the default) and never touches `mk_dev`. `--keep` leaves the drill database for inspection.
4. Record the result:

| Date | Backup file | Result | By  |
| ---- | ----------- | ------ | --- |
|      |             |        |     |

## 5. Rotate secrets

Table and per-secret effects: [deploy-dokploy.md "Rotating secrets"](./deploy-dokploy.md#rotating-secrets).

1. Create the new credential.
2. Set it in Dokploy ▸ Environment.
3. Redeploy.
4. Revoke the old credential.

`BETTER_AUTH_SECRETS` rotation (`"<n+1>:<new>,<n>:<previous>"`, newest first, `BETTER_AUTH_SECRET` left unchanged) signs everyone out; two-factor keeps working.

## 6. Recover the owner account

Try in order:

1. Backup codes on the two-factor screen.
2. Another owner or admin resets the two-factor in Users & roles.
3. Command line (R16): resets two-factor, lifts a ban, ends every session, writes an audit entry (`user.recover`) and emails a password-reset link. It prints its target and does nothing without `--confirm`:
   ```bash
   docker exec <container> node owner-recover.cjs --email owner@example.com --confirm
   ```
   Sign in with the emailed link, then set up two-factor again. Only works for an existing owner.
4. No owner exists at all:
   ```bash
   docker exec <container> node admin-create.cjs --email you@example.com --name "Your Name"
   ```

## 7. Verify the sending domain

1. Resend ▸ Domains: add the domain.
2. Publish the SPF and DKIM records, and a DMARC record (`p=quarantine` once reports are clean).
3. Wait for "Verified".
4. Set `EMAIL_DRIVER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM` on that domain. Redeploy.
5. Send a test enquiry and confirm delivery.

## 8. Set up GTM

[deploy-dokploy.md "Tracking setup"](./deploy-dokploy.md#tracking-setup): import `docs/gtm-container.json`, set GA4 and Meta, Basic consent mode.

## 9. Media bucket headers

Cloudflare ▸ the media domain ▸ Rules ▸ Transform Rules ▸ Modify Response Header.

1. Rule A, when the URI path does **not** end in `.pdf`: set `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox`.
2. Rule B, when the URI path ends in `.pdf`: set `X-Content-Type-Options: nosniff` only.
3. Verify: `curl -I <MEDIA_PUBLIC_URL>/<an image>` shows both headers; a PDF shows only `nosniff`.

## 10. Scheduler

`POST /api/v1/cron/tick` with `Authorization: Bearer $CRON_SECRET`, every minute, from Dokploy ▸ Schedules (for example `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/v1/cron/tick`). It publishes scheduled articles and runs the retention purge. `CRON_SECRET` (32+ characters) is required outside development.

## 11. Incidents

1. **CSP violation**: look for `[csp]` log lines. Legitimate host: add it to `CUSTOM_SCRIPT_HOSTS` (`lib/tracking/hosts.ts`) and redeploy. Emergency: switch to `Content-Security-Policy-Report-Only` ([deploy-dokploy.md "Content-Security-Policy"](./deploy-dokploy.md#content-security-policy)). `DISABLE_CUSTOM_SCRIPTS=true` stops all custom snippets.
2. **Database down**: `/api/v1/health` returns 503; the site keeps serving cached pages. Check the PostgreSQL service in Dokploy; restore (section 4) if the data is damaged.
3. **Email failures**: the notification bell and an owner email report them. Check Resend status and the API key; see section 7.
4. **Meta CAPI failures**: reported in the bell. After an `APP_ENCRYPTION_KEY` rotation, re-enter the token on Marketing ▸ Tracking.

## 12. Local setup

```bash
docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev
pnpm admin:create --email you@example.com --name "Your Name"
```

Mailpit inbox: http://localhost:8025.

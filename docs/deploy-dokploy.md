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

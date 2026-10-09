# Staging on Dokploy (one-time setup)

1. Create a PostgreSQL 17 service and copy its internal connection URL.
2. Create an application from this repo: branch `feat/platform`, build type Dockerfile.
3. Set the environment variables from `.env.example` at runtime:
   - `SITE_ENV=staging`, a new 48-character `BETTER_AUTH_SECRET`, `DATABASE_URL` from step 1.
   - `SITE_URL` and `BETTER_AUTH_URL` must share one origin (same-origin checks use `SITE_URL`), and `BETTER_AUTH_URL` must be `https://` whenever `SITE_ENV` is not `development`.
   - `EMAIL_DRIVER=smtp` with `SMTP_URL` (until Phase 6); `EMAIL_DRIVER=log` is rejected when `SITE_ENV=production`.
   - `EMAIL_FROM`.
4. Build arg `NEXT_DEPLOYMENT_ID`: set it to a unique value per deploy (for example the git SHA) so Next.js can protect against version skew between old clients and new servers.
5. Set the health check path to `/api/v1/health` and attach the staging domain.
6. Proxy headers: Traefik must set or overwrite `X-Real-IP` and `X-Forwarded-For` (never pass through client-supplied values). Better Auth keys its rate limits on them.
7. Deploy. The container applies pending migrations (advisory-locked) before the server starts.
8. Create the owner once, inside the running container, so it uses the container's own env (database, email driver, URLs):

   ```bash
   docker exec <container> node admin-create.cjs --email you@example.com --name "Your Name"
   ```

   Do not run `pnpm admin:create` from a laptop against the staging database.

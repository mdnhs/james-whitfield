# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat \
  && corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# Version skew protection: pass a unique id per deploy (e.g. the git SHA).
ARG NEXT_DEPLOYMENT_ID
ENV NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID
# The s3 media driver's public URL: next.config.ts allows its host for
# next/image at build. Dokploy passes it as a build arg (unset = local driver).
ARG MEDIA_PUBLIC_URL
ENV MEDIA_PUBLIC_URL=$MEDIA_PUBLIC_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No secrets and no database at build: env and auth are read lazily at runtime.
# Version skew protection (docs/brief.md §17): the build arg wins, else the
# git commit of the build context (scripts/deployment-id.sh).
RUN NEXT_DEPLOYMENT_ID="$(sh scripts/deployment-id.sh .)" && export NEXT_DEPLOYMENT_ID \
  && echo "deployment id: $NEXT_DEPLOYMENT_ID" \
  && pnpm build && pnpm build:migrate && pnpm build:admin-create && pnpm build:owner-recover

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
# The local media driver's default MEDIA_LOCAL_DIR; mount a volume here.
RUN mkdir -p /app/storage && chown nextjs:nodejs /app/storage
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migrations run at boot, before the server accepts traffic.
COPY --from=builder --chown=nextjs:nodejs /app/dist/migrate.cjs ./migrate.cjs
COPY --from=builder --chown=nextjs:nodejs /app/dist/admin-create.cjs ./admin-create.cjs
COPY --from=builder --chown=nextjs:nodejs /app/dist/owner-recover.cjs ./owner-recover.cjs
COPY --from=builder --chown=nextjs:nodejs /app/server/db/migrations ./server/db/migrations
COPY --chown=nextjs:nodejs --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health/live > /dev/null || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]

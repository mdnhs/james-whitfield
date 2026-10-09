# Magda Kennedy Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static Next.js 16 marketing site into a database-driven full-stack app: PostgreSQL content, a Hono API inside Next, Better Auth with RBAC, an Evergreen-styled shadcn admin panel, SEO and tracking managed from the admin, and theme customisation. The public site must keep looking and moving exactly as it does today.

**Architecture:** This is a single Next.js 16.3 app with three parts, each with its own entry point:

- `app/(site)` is the public site. It reads PostgreSQL through tag-cached `'use cache'` queries, and only after `await io()`, so nothing touches the database at build time.
- `app/(admin)` is the admin. Its shell is a guarded React Server Component; its client UI talks to Hono through a typed RPC client.
- `app/api/[...route]` mounts Hono, which hosts Better Auth, the admin API, public form endpoints and cron.

Every write goes through a service layer. Services write the audit log and invalidate cache tags with `revalidateTag(tag, { expire: 0 })`.

**Tech Stack:** Next.js 16.3 (Cache Components, `proxy.ts`) · React 19.2 · TypeScript 5.9 (strict) · Tailwind CSS 4 · shadcn/ui 4 `base-nova` (Base UI) · Hono 4.13 + `@hono/vercel` + `@hono/zod-validator` · Better Auth 1.7 (admin + two-factor plugins) · Drizzle ORM 0.45 + drizzle-kit 0.31 + `pg` · PostgreSQL 17 · Zod 4.6 · Vitest · Playwright · pnpm 10.32 · Node 22 · Docker on Dokploy.

**Spec:** [`docs/brief.md`](./brief.md). Read it before any task. Section numbers below (§x.y) refer to it.

## Global Constraints

Every task's requirements implicitly include everything in this section.

**Versions**

- Next.js `16.3.x` App Router with `cacheComponents: true`, on the Node runtime only. Do not upgrade to 16.4 inside this plan.
- `proxy.ts` sits at the repo root (no `src/`). It does optimistic cookie checks only and **never touches the database**.
- Hono `4.13.x` with `@hono/vercel` `1.0.x` and `@hono/zod-validator` `0.9.x`. **No Hono v5**, and never import `hono/vercel`.
- Better Auth `1.7.x`. The CLI is the `auth` package (`pnpm dlx auth@1.7.7 …`), not `@better-auth/cli`.
- Drizzle ORM `0.45.x`, drizzle-kit `0.31.x`, `pg` `8.x`. Use the 0.45 APIs (`relations()`, `migrate(db, { migrationsFolder })`). Drizzle's website documents the v1 RC by default, so `defineRelations` and `drizzle-orm/zod` **do not exist** for us.
- Zod `4.6.x`, always imported as `import * as z from "zod"`.

**Configuration values**

- Database casing is `snake_case`, primary keys are `uuid`, and timestamps are `timestamptz`.
- Better Auth settings: `usePlural: true`, `advanced.database.generateId: "uuid"`, `advanced.cookiePrefix: "mk"`.

**Architecture rules**

- **No database access at build time.** Every DB read is a `'use cache'` query called after `await io()` inside a `<Suspense>` boundary. Never read env or the DB at module scope. CI builds with an unreachable `DATABASE_URL`.
- Never use `NEXT_PUBLIC_*` env vars. Client-visible values are passed down from the server as props.
- Every `server/**` module begins with `import "server-only"`, and client components never import it. Node scripts that load server modules run with `NODE_OPTIONS=--conditions=react-server`.
- Public pages never `fetch` our own `/api/*`. Hono serves only the admin, the forms and cron.
- Hono route handlers do three things: validate (Zod), authorise (`can()`), call a service. Services own the audit log and cache invalidation.
- Client code never queries `document` for page content. It uses `findTarget()` and `activePageRoot()` from `lib/page-root.ts`, because Cache Components keeps hidden routes in the DOM through `<Activity>`.

**UI rules**

- shadcn `base-nova` is built on Base UI. Compose with the `render` prop (never `asChild`), and pass `nativeButton={false}` when rendering a non-button.
- The public site is light-only. The admin supports light, dark and system. No single-key hotkeys.
- Every public site section aligns to `components/layout/container.tsx` (max width 1440px, 66px gutter).

**Code style**

- Prettier: no semicolons, double quotes, `trailingComma: "es5"`, width 80.
- File names are kebab-case.
- Use named exports. Default exports are only for `page`, `layout` and `route` files and configs.
- Comments explain *why*.

**Quality gates**

- Any task that touches the public site must pass `pnpm test:parity` at ≤ 0.1% pixel difference per page.
- Every task ends green on `pnpm lint`, `pnpm typecheck`, its tests and `pnpm build`, then makes one Conventional Commit.

## Review Focus

These five inputs and failure modes follow from the spec, are the most likely to hurt a real user, and are not obvious from any single task. Each one is pinned by a test in the task named after the arrow.

1. **Shared section ids across routes.** After a client navigation `/` → `/contact` (both contain `#faq`), the journey rail and hash links must scroll the *visible* page, not a copy Activity has hidden. → Task 0.5, `activity.spec.ts` and `page-root.test.ts`.
2. **Chrome-level anchors.** A rail "Contact" chapter (`#contact`, which lives in the layout footer) must still work after navigating, when no page root contains it. → Task 0.5.
3. **Stale permissions.** After a role change or a ban, the very next admin API call must reflect it, even though Better Auth's 5-minute cookie cache would still accept the old session. → Task 1.5.
4. **Privilege escalation and duplicates.** An admin must not be able to invite an owner. Inviting `Editor@Example.com` when `editor@example.com` exists returns 409. A cross-site POST is rejected. → Task 1.7.
5. **Database down.** `next build` must pass with no database reachable, and at runtime `/api/v1/health` must return a 503 JSON envelope instead of crashing. → Task 0.7 (CI build) and Task 1.4.

---

## How to use this plan

**The spec spans twelve subsystems** (§18), so this file contains:

1. the **phase map** with scope and acceptance criteria for every phase;
2. **step-level, test-first tasks for Phases 0 and 1**, the foundation everything else stands on.

Phases 2–11 each get their own step-level plan, written with `superpowers:writing-plans` when the previous phase is merged and saved as `docs/plans/phase-NN-<name>.md`. The scope bullets below are the agreed contract for those plans.

**Branching.**

- Work on a `feat/platform` branch, using a git worktree through `superpowers:using-git-worktrees`.
- Production (`main`, auto-deployed by Dokploy) stays untouched until Phase 3 reaches visual parity.
- Point a **staging** Dokploy app at `feat/platform` from Task 1.12 onwards.

**Per-task definition of done:**

- the new tests fail first, then pass;
- `pnpm lint && pnpm typecheck && pnpm test:unit` are green;
- integration and E2E suites are green where the task touches them;
- `pnpm test:parity` is green when the site is touched;
- one commit.

### Phase map

| Phase | Name                              | Depends on | Detail in                        |
| ----- | --------------------------------- | ---------- | -------------------------------- |
| 0     | Foundations and guardrails        | —          | this file                        |
| 1     | Auth, RBAC and API core           | 0          | this file                        |
| 2     | Admin shell and design system     | 1          | `docs/plans/phase-02-admin-shell.md` |
| 3     | Content platform (DB-driven site) | 1          | `docs/plans/phase-03-content-platform.md` |
| 4     | Content editing                   | 2, 3       | `docs/plans/phase-04-content-editing.md` |
| 5     | Insights                          | 4          | `docs/plans/phase-05-insights.md` |
| 6     | Enquiries, forms and email        | 3, 2       | `docs/plans/phase-06-enquiries.md` |
| 7     | SEO center                        | 4, 5       | `docs/plans/phase-07-seo.md`     |
| 8     | Marketing and tracking            | 6, 7       | `docs/plans/phase-08-marketing.md` |
| 9     | Appearance (theme customisation)  | 3, 2       | `docs/plans/phase-09-appearance.md` |
| 10    | Users, roles and security         | 2          | `docs/plans/phase-10-users-security.md` |
| 11    | Dashboard data, polish and launch | all        | `docs/plans/phase-11-launch.md`  |

Phases 2 and 3 can run in parallel once Phase 1 is merged. So can Phases 9 and 10.

---

## File structure (Phases 0–1)

| Path                                           | Responsibility                                                                     | Task |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- | ---- |
| `vitest.config.ts`                             | Vitest `unit` + `integration` projects, `@` alias, `server-only` stub, test env      | 0.1, 0.6 |
| `tests/stubs/server-only.ts`                   | Empty stand-in for `server-only` under Vitest                                      | 0.1  |
| `playwright.config.ts`                         | Desktop/tablet/mobile projects, `webServer` on port 3100, E2E database env         | 0.2, 1.10 |
| `tests/e2e/parity/*`                           | Visual-parity baseline of every public route                                       | 0.2  |
| `app/(site)/**`                                | Public site moved into its own root layout (`site.css`)                            | 0.3  |
| `components/copyright-year.tsx`                | Cached year for the footer (Cache Components safe)                                 | 0.4  |
| `lib/page-root.ts`                             | `activePageRoot()`, `findTarget()`: Activity-safe DOM lookups                      | 0.5  |
| `components/page-motion.tsx`                   | Page-scoped GSAP motion (replaces the global `ScrollMotion`)                       | 0.5  |
| `tests/e2e/navigation/activity.spec.ts`        | Client-navigation regression tests                                                 | 0.5  |
| `server/env.ts`                                | Lazy, Zod-validated environment                                                    | 0.6, 1.3 |
| `docker-compose.yml`, `docker/postgres/init/*` | Local PostgreSQL 17 (dev/test/e2e databases) + Mailpit                             | 0.6  |
| `drizzle.config.ts`                            | drizzle-kit config (`server/db/migrations`)                                        | 0.6  |
| `server/db/{client,migrate}.ts`, `server/db/schema/*` | Pool + Drizzle client, programmatic migrations, table definitions          | 0.6, 1.3, 1.6 |
| `tests/integration/**`                         | Global setup (fresh schema + migrations), DB reset helper, integration tests      | 0.6+ |
| `.github/workflows/ci.yml`                     | Lint, typecheck, unit, integration (Postgres service), build with no database     | 0.7  |
| `lib/auth/permissions.ts`                      | Access-control statement, 7 roles, `hasPermission`, `parseRoles`, `permissionMap`  | 1.1  |
| `server/lib/email/*`                           | `sendEmail` with `log` / `smtp` drivers, invite and reset templates                | 1.2  |
| `server/auth/{auth,cli,actor,session}.ts`      | Better Auth factory, CLI entry, `Actor` mapping, RSC data-access layer             | 1.3, 1.5 |
| `server/api/**`                                | Hono app, error envelope, middleware (`session`, `signedIn`, `can`, `sameOrigin`), routes | 1.4–1.7 |
| `app/api/[...route]/route.ts`                  | Mounts Hono for every HTTP method                                                  | 1.4  |
| `server/lib/{audit,crypto}.ts`, `server/db/schema/audit.ts` | Audit log writes, IP hashing                                          | 1.6  |
| `server/modules/users/*`                       | Invite schema, service and routes; owner bootstrap                                 | 1.7, 1.8 |
| `scripts/{admin-create,migrate,e2e-seed}.ts`   | CLI entry points                                                                   | 1.8, 1.10, 1.12 |
| `proxy.ts`                                     | Optimistic `/admin` gate + `X-Robots-Tag`                                          | 1.9  |
| `app/(admin)/**`, `admin/**`                   | Admin root layout, auth pages, guarded panel, two-factor setup                     | 1.10, 1.11 |
| `lib/auth/{safe-next,two-factor-policy}.ts`    | Redirect sanitising; which roles require 2FA                                       | 1.10, 1.11 |
| `Dockerfile`, `docker-entrypoint.sh`           | Migrations at boot (advisory lock), HEALTHCHECK                                    | 1.12 |

---

## Phase 0: Foundations and guardrails

**Outcome:**

- a test toolchain;
- a visual-parity safety net captured from today's site;
- separate root layouts;
- Cache Components switched on, with motion that is safe under Activity;
- local PostgreSQL and migrations;
- a CI pipeline that proves the build needs no database.

The public site must look identical when this phase is done.

### Task 0.1: Test tooling, fresh-checkout typecheck, workspace hygiene

**Files:**

- Modify: `package.json` (scripts, dependencies)
- Modify: `tsconfig.json` (`exclude`)
- Modify: `eslint.config.mjs` (ignores)
- Modify: `.gitignore`
- Create: `vitest.config.ts`
- Create: `tests/stubs/server-only.ts`
- Test: `lib/utils.test.ts`

**Interfaces:**

- Consumes: `slugify(label: string): string` from `lib/utils.ts` (existing).
- Produces:
  - scripts `test`, `test:unit`, `test:watch` and `typecheck`;
  - the Vitest project `unit`;
  - the `@` alias (repo root);
  - the `server-only` stub, used by every later task.

- [ ] **Step 1: Install the tooling**

```bash
pnpm add server-only
pnpm add -D vitest jsdom
```

Vitest must be ≥ 3.2, because the `projects` API is used. `jsdom` is needed by Task 0.5.

- [ ] **Step 2: Write the first test**

Create `lib/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { slugify } from "./utils"

describe("slugify", () => {
  it("turns a label into a URL-safe slug", () => {
    expect(slugify("Anxiety & Stress")).toBe("anxiety-stress")
  })

  it("trims leading and trailing separators", () => {
    expect(slugify("  Sleep / Rest! ")).toBe("sleep-rest")
  })

  it("keeps digits", () => {
    expect(slugify("Top 10 Habits")).toBe("top-10-habits")
  })
})
```

- [ ] **Step 3: Run it to verify the toolchain is missing**

Run: `pnpm test:unit`
Expected: FAIL with `ERR_PNPM_NO_SCRIPT  Missing script: test:unit`.

- [ ] **Step 4: Add the Vitest config, the stub and the scripts**

Create `tests/stubs/server-only.ts`:

```ts
// Vitest runs in plain Node, where the real `server-only` throws on import.
export {}
```

Create `vitest.config.ts`:

```ts
import path from "node:path"

import { defineConfig } from "vitest/config"

const root = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // `server-only` throws outside a React Server Component bundle.
      "server-only": path.join(root, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["**/*.test.{ts,tsx}"],
          exclude: [
            "node_modules/**",
            ".next/**",
            ".kilo/**",
            "tests/integration/**",
            "tests/e2e/**",
          ],
        },
      },
    ],
  },
})
```

In `package.json`, replace the `scripts` block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "format": "prettier --write \"**/*.{ts,tsx}\"",
  "typecheck": "next typegen && tsc --noEmit",
  "test": "vitest run",
  "test:unit": "vitest run --project unit",
  "test:watch": "vitest"
}
```

The typecheck fix: `next-env.d.ts` and `.next/types` are gitignored. On a fresh checkout (CI), `tsc` alone fails with TS2307 on `@/public/*.png` imports and TS2304 on `PageProps`. `next typegen` generates both.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:unit`
Expected: PASS, `3 passed` (project `unit`).

- [ ] **Step 6: Exclude the local `.kilo/` worktree copies from tooling**

`.kilo/worktrees/*` holds full copies of the repo. `tsconfig`'s `**/*.ts` include and ESLint would otherwise sweep them in.

In `tsconfig.json`, change `"exclude": ["node_modules"]` to:

```json
"exclude": ["node_modules", ".kilo"]
```

In `eslint.config.mjs`, replace the `globalIgnores([...])` call with:

```js
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local tooling output and editor worktrees:
    ".kilo/**",
    "dist/**",
    "playwright-report/**",
    "test-results/**",
  ]),
```

Append to `.gitignore`:

```
# test output
/playwright-report
/test-results

# bundled scripts
/dist

# local media storage (driver "local")
/storage

# keep the documented example env
!.env.example
```

- [ ] **Step 7: Verify typecheck on a clean tree, plus lint**

Run: `rm -rf .next next-env.d.ts && pnpm typecheck && pnpm lint`
Expected: both exit 0. `next typegen` prints that it generated route types.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts tests/stubs/server-only.ts lib/utils.test.ts tsconfig.json eslint.config.mjs .gitignore
git commit -m "chore: add vitest, fix fresh-checkout typecheck, ignore local worktrees"
```

---

### Task 0.2: Visual-parity baseline of today's site

**Files:**

- Create: `playwright.config.ts`
- Create: `tests/e2e/support/settle.ts`
- Create: `tests/e2e/parity/routes.ts`
- Create: `tests/e2e/parity/visual-parity.spec.ts`
- Create: `tests/e2e/__screenshots__/**` (generated baselines, committed)
- Modify: `package.json` (scripts)

**Interfaces:**

- Produces:
  - `pnpm test:parity` and `pnpm test:parity:update`;
  - `settle(page: Page): Promise<void>`;
  - Playwright projects `desktop` (1440×900), `tablet` (834×1112) and `mobile` (Pixel 7);
  - a `webServer` on port 3100.
- Every later task that touches the public site runs `pnpm test:parity`.

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: Write the config, helper and spec**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test"

const PORT = 3100

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Baselines are per platform: macOS and Linux render fonts differently.
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.001,
      animations: "disabled",
      caret: "hide",
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 834, height: 1112 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // `next start` prints a warning about `output: "standalone"`; it still serves.
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})
```

Create `tests/e2e/support/settle.ts`:

```ts
import type { Page } from "@playwright/test"

// Full-page screenshots only compare once nothing is still arriving: scroll
// the page once so lazy images load, return to the top, then wait for fonts
// and every image.
export async function settle(page: Page) {
  await page.evaluate(async () => {
    const step = window.innerHeight
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
    window.scrollTo(0, 0)
    await document.fonts.ready
  })
  await page.waitForLoadState("networkidle")
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete)
  )
  await page.waitForTimeout(400)
}
```

Create `tests/e2e/parity/routes.ts`:

```ts
// Every public route as it exists before the content platform (Phase 3).
export const PARITY_ROUTES = [
  { name: "home", path: "/" },
  { name: "about", path: "/about" },
  { name: "services", path: "/services" },
  { name: "how-it-works", path: "/how-it-works" },
  { name: "insights", path: "/insights" },
  { name: "article", path: "/insights/calm-is-a-skill" },
  { name: "contact", path: "/contact" },
] as const
```

Create `tests/e2e/parity/visual-parity.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { settle } from "../support/settle"
import { PARITY_ROUTES } from "./routes"

// With reduced motion the GSAP reveals never hide anything, so full-page
// shots are deterministic. The WebGL hero canvas is masked because its
// shader animates on a clock.
test.use({ reducedMotion: "reduce" })

for (const route of PARITY_ROUTES) {
  test(`parity: ${route.name}`, async ({ page }) => {
    await page.goto(route.path)
    await settle(page)
    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      fullPage: true,
      mask: [page.locator("canvas")],
    })
  })
}
```

Add these to `package.json` `scripts`:

```json
"test:e2e": "playwright test",
"test:parity": "playwright test tests/e2e/parity",
"test:parity:update": "playwright test tests/e2e/parity --update-snapshots"
```

- [ ] **Step 3: Run it to verify it fails without baselines**

Locally, `reuseExistingServer` reuses anything already listening on port 3100. Stop such a server first, so the suite builds the current code.

Run: `pnpm test:parity`
Expected: FAIL, 21 tests (7 routes × 3 projects), each with `A snapshot doesn't exist at …/<route>.png, writing actual.`

- [ ] **Step 4: Record the baselines from today's site**

Run: `pnpm test:parity:update`
Expected: 21 PNGs written under `tests/e2e/__screenshots__/darwin/{desktop,tablet,mobile}/`.

- [ ] **Step 5: Run twice more to prove the suite is stable**

Run: `pnpm test:parity && pnpm test:parity`
Expected: PASS, `21 passed`, both times.

If a page diffs between runs, open `test-results/**/<route>-diff.png`, find the moving element and add its locator to that test's `mask` array. Re-run Step 4, then this step.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e package.json pnpm-lock.yaml
git commit -m "test: record visual-parity baseline for every public route"
```

---

### Task 0.3: Give the public site its own root layout

**Files:**

- Move: `app/layout.tsx` → `app/(site)/layout.tsx`
- Move: `app/page.tsx` → `app/(site)/page.tsx`
- Move: `app/{about,contact,how-it-works,insights,services}/` → `app/(site)/…`
- Move: `app/globals.css` → `app/(site)/site.css`
- Keep: `app/favicon.ico`, which must stay at the top level of `app/`
- Modify: `app/(site)/layout.tsx`
- Modify: `features/navbar/components/site-header.tsx:14`
- Modify: `features/footer/components/site-footer.tsx:19`
- Modify: `components.json`
- Modify: `.prettierrc`

**Interfaces:**

- Produces:
  - the root layout `app/(site)/layout.tsx`;
  - the stylesheet `app/(site)/site.css`;
  - the attribute `data-site-chrome` on the site `<header>` and `<footer>`, which Task 0.5 uses for motion scoping.
- The admin gets its own root layout in Task 1.10. Navigating between root layouts is a full page load, which is intended.

- [ ] **Step 1: Confirm the safety net is green before refactoring**

Run: `pnpm test:parity`
Expected: PASS, `21 passed`.

- [ ] **Step 2: Move the files**

```bash
mkdir -p "app/(site)"
git mv app/layout.tsx "app/(site)/layout.tsx"
git mv app/page.tsx "app/(site)/page.tsx"
git mv app/globals.css "app/(site)/site.css"
for d in about contact how-it-works insights services; do git mv "app/$d" "app/(site)/$d"; done
```

- [ ] **Step 3: Make the site layout light-only and point it at `site.css`**

In `app/(site)/layout.tsx`, make five edits.

Replace `import "./globals.css"` with:

```tsx
import "./site.css"
```

Delete the line `import { ThemeProvider } from "@/components/theme-provider"`.

Replace the component signature line `export default function RootLayout({` with:

```tsx
// The public site has a single light design. The admin has its own root
// layout with light/dark support (Task 1.10), so next-themes is not used here.
export default function SiteLayout({
```

Replace:

```tsx
    <html
      lang="en"
      suppressHydrationWarning
```

with:

```tsx
    <html
      lang="en-IE"
```

Replace the body content:

```tsx
        <NuqsAdapter>
          <SmoothScroll>
            <ThemeProvider>
              <SiteHeader />
              {children}
              <SiteFooter />
              <ScrollMotion />
            </ThemeProvider>
          </SmoothScroll>
        </NuqsAdapter>
```

with:

```tsx
        <NuqsAdapter>
          <SmoothScroll>
            <SiteHeader />
            {children}
            <SiteFooter />
            <ScrollMotion />
          </SmoothScroll>
        </NuqsAdapter>
```

- [ ] **Step 4: Mark the shared chrome for motion scoping**

In `features/navbar/components/site-header.tsx`, replace:

```tsx
      <header
        className={cn(
```

with:

```tsx
      <header
        data-site-chrome
        className={cn(
```

In `features/footer/components/site-footer.tsx`, replace:

```tsx
    <footer id="contact" className="bg-pine pt-16 pb-12 lg:pt-24">
```

with:

```tsx
    <footer id="contact" data-site-chrome className="bg-pine pt-16 pb-12 lg:pt-24">
```

- [ ] **Step 5: Point tooling at the moved stylesheet**

In `components.json`, change `"css": "app/globals.css"` to `"css": "app/(site)/site.css"`.

In `.prettierrc`, change `"tailwindStylesheet": "app/globals.css"` to `"tailwindStylesheet": "app/(site)/site.css"`.

- [ ] **Step 6: Build and verify parity**

Run: `pnpm build && pnpm test:parity`
Expected:

- The build lists the same routes as before (`/`, `/about`, `/contact`, `/how-it-works`, `/insights`, `/insights/[slug]`, `/services`).
- Parity: PASS, `21 passed`.

- [ ] **Step 7: Verify lint and types**

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add -A app features/navbar/components/site-header.tsx features/footer/components/site-footer.tsx components.json .prettierrc
git commit -m "refactor: move the public site into its own (site) root layout"
```

---

### Task 0.4: Switch on Cache Components

**Files:**

- Create: `components/copyright-year.tsx`
- Modify: `features/footer/components/site-footer.tsx:85-87`
- Modify: `next.config.ts`
- Modify: `app/(site)/insights/[slug]/page.tsx:18-19`

**Interfaces:**

- Produces: `CopyrightYear(): Promise<JSX.Element>`, an async server component cached with `cacheLife("days")`.
- Produces: `cacheComponents: true`. Every later server component must respect the §5.6 rules.

- [ ] **Step 1: Enable the flag and watch the build fail**

In `next.config.ts`, add this after `compress: true,`:

```ts
  // Pages render from tag-cached data at request time (docs/brief.md §5.6).
  cacheComponents: true,
```

Run: `pnpm build`
Expected: FAIL. The build reports `Route segment config "dynamicParams" is not compatible with nextConfig.cacheComponents` for `/insights/[slug]`. Once that is fixed, it reports a prerender error for synchronous current time (`new Date()`) in `SiteFooter`.

- [ ] **Step 2: Remove `dynamicParams` from the article route**

In `app/(site)/insights/[slug]/page.tsx`, replace:

```ts
// Every article is known at build time; any other slug is a 404.
export const dynamicParams = false
```

with:

```ts
// Known slugs prerender at build. Any other slug renders on request and hits
// notFound() below (dynamicParams is not allowed with Cache Components).
```

- [ ] **Step 3: Cache the copyright year**

Create `components/copyright-year.tsx`:

```tsx
import { cacheLife } from "next/cache"

// A bare `new Date()` fails prerendering under Cache Components. Captured in a
// cache scope, the year lands in the static shell and refreshes daily.
export async function CopyrightYear() {
  "use cache"
  cacheLife("days")
  return <>{new Date().getFullYear()}</>
}
```

In `features/footer/components/site-footer.tsx`, add `import { CopyrightYear } from "@/components/copyright-year"` after the `Container` import, and replace:

```tsx
          <p className="font-plex-mono">
            © {new Date().getFullYear()} Magda Kennedy
          </p>
```

with:

```tsx
          <p className="font-plex-mono">
            © <CopyrightYear /> Magda Kennedy
          </p>
```

- [ ] **Step 4: Build again**

Run: `pnpm build`
Expected: PASS. The route table marks the pages as prerendered or partially prerendered.

If the build instead reports a blocking route for `/insights/[slug]`, wrap the page's returned `<main>` in `<Suspense>` from `react` (with fallback `null`) and rebuild.

- [ ] **Step 5: Verify parity**

Run: `pnpm test:parity`
Expected: PASS, `21 passed`.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts components/copyright-year.tsx features/footer/components/site-footer.tsx "app/(site)/insights/[slug]/page.tsx"
git commit -m "feat: enable cache components"
```

---

### Task 0.5: Activity-safe, page-scoped motion

With Cache Components on, a client navigation keeps the previous route in the DOM, hidden by `<Activity>`. The current `ScrollMotion` lives in the layout and queries `document`, so it would animate hidden copies. `JourneyRail` and hash links resolve `getElementById` across hidden pages, which have duplicate ids such as `faq` and `how-it-works`.

This task:

- scopes every lookup to the visible page;
- moves motion into each page's own tree, so Activity's hide and show tears motion down and rebuilds it.

**Files:**

- Create: `lib/page-root.ts`
- Test: `lib/page-root.test.ts`
- Move and modify: `components/scroll-motion.tsx` → `components/page-motion.tsx`
- Modify: `components/journey-rail.tsx:54,68`
- Modify: `components/smooth-scroll.tsx:32-35`
- Modify: `features/how-it-works/components/steps-story.tsx:72-84`
- Modify: `components/stack-card.tsx:4`
- Modify: `app/(site)/layout.tsx`
- Modify: all 7 page files under `app/(site)/` (`page.tsx`, `about/`, `services/`, `how-it-works/`, `insights/`, `insights/[slug]/`, `contact/`)
- Test: `tests/e2e/navigation/activity.spec.ts`

**Interfaces:**

- Produces:
  - `activePageRoot(): HTMLElement | null`;
  - `findTarget(id: string, from?: Element | null): HTMLElement | null`;
  - `PageMotion()`, a client component that renders a hidden marker span;
  - the markup contract `<main data-page-root>`.
- Phase 3's `BlockRenderer` renders `<main data-page-root>` and `<PageMotion />` instead of each page file.

- [ ] **Step 1: Write the failing unit tests**

Create `lib/page-root.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"

import { activePageRoot, findTarget } from "./page-root"

// jsdom has no layout, so nothing has client rects. Mark what a browser would
// render; Activity-hidden routes (display: none) have none.
function markRendered(selector: string) {
  document.querySelectorAll(selector).forEach((element) => {
    Object.defineProperty(element, "getClientRects", {
      value: () => ({ length: 1 }),
    })
  })
}

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("activePageRoot", () => {
  it("skips page roots hidden by Activity", () => {
    document.body.innerHTML = `
      <main data-page-root id="previous"></main>
      <main data-page-root id="current"></main>`
    markRendered("#current")
    expect(activePageRoot()?.id).toBe("current")
  })

  it("returns null when no page root is rendered", () => {
    document.body.innerHTML = `<main data-page-root></main>`
    expect(activePageRoot()).toBeNull()
  })
})

describe("findTarget", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main data-page-root id="home-page">
        <section id="faq" data-from="home"></section>
      </main>
      <main data-page-root id="contact-page">
        <section id="faq" data-from="contact"></section>
        <button id="rail"></button>
      </main>
      <footer id="contact"></footer>`
    markRendered("#contact-page, #contact-page *, footer")
  })

  it("resolves a shared id inside the visible page", () => {
    expect(findTarget("faq")?.dataset.from).toBe("contact")
  })

  it("resolves inside the page that owns the clicked element", () => {
    const rail = document.getElementById("rail")
    expect(findTarget("faq", rail)?.dataset.from).toBe("contact")
  })

  it("falls back to rendered shared chrome such as the footer", () => {
    expect(findTarget("contact")?.tagName).toBe("FOOTER")
  })

  it("ignores ids that only exist in hidden pages", () => {
    document.body.innerHTML = `
      <main data-page-root id="previous"><section id="story"></section></main>
      <main data-page-root id="current"></main>`
    markRendered("#current")
    expect(findTarget("story")).toBeNull()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run --project unit lib/page-root.test.ts`
Expected: FAIL, `Failed to resolve import "./page-root"`.

- [ ] **Step 3: Implement the helpers**

Create `lib/page-root.ts`:

```ts
// Cache Components keeps visited routes in the DOM, hidden by React
// <Activity> (display: none). Lookups for page content must resolve inside the
// page the reader can see, never across the whole document.
const PAGE_ROOT = "[data-page-root]"

const isRendered = (element: Element) => element.getClientRects().length > 0

// Ids are validated kebab-case (blocks schema); quotes are escaped anyway.
const byId = (id: string) => `[id="${id.replace(/"/g, '\\"')}"]`

export function activePageRoot(): HTMLElement | null {
  for (const root of document.querySelectorAll<HTMLElement>(PAGE_ROOT)) {
    if (isRendered(root)) return root
  }
  return null
}

// A section id for rails and hash links: first inside the page that owns
// `from` (or the visible page), then in shared chrome such as the footer.
export function findTarget(
  id: string,
  from?: Element | null
): HTMLElement | null {
  const root = from?.closest<HTMLElement>(PAGE_ROOT) ?? activePageRoot()
  const inPage = root?.querySelector<HTMLElement>(byId(id))
  if (inPage) return inPage
  const anywhere = document.getElementById(id)
  return anywhere && isRendered(anywhere) ? anywhere : null
}
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `pnpm vitest run --project unit lib/page-root.test.ts`
Expected: PASS, `6 passed`.

- [ ] **Step 5: Write the navigation regression tests**

Create `tests/e2e/navigation/activity.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

// Cache Components keeps the previous route in the DOM, hidden. The rail and
// hash links must reach the page the reader is on, not the hidden copy.
test.use({ viewport: { width: 1440, height: 900 } })

const mainNav = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Main" })

const openRail = async (page: import("@playwright/test").Page) => {
  // The rail joins once the reader has left the hero.
  await page.mouse.wheel(0, 1400)
  const rail = page.getByRole("navigation", { name: "Page sections" })
  await expect(rail).toBeVisible()
  return rail
}

test("rail targets the visible page after navigating between pages that share #faq", async ({
  page,
}) => {
  await page.goto("/")
  await mainNav(page).getByRole("link", { name: "Contact" }).click()
  await expect(page).toHaveURL(/\/contact$/)
  const rail = await openRail(page)
  await rail.getByRole("button", { name: "FAQ" }).click()
  await expect(page.locator("#faq:visible")).toBeInViewport()
})

test("rail reaches the footer-level #contact after navigating", async ({
  page,
}) => {
  await page.goto("/about")
  await mainNav(page).getByRole("link", { name: "Services" }).click()
  await expect(page).toHaveURL(/\/services$/)
  const rail = await openRail(page)
  await rail.getByRole("button", { name: "Contact" }).click()
  await expect(page.locator("footer#contact")).toBeInViewport()
})

test("a preserved route still reveals its hero after going back", async ({
  page,
}) => {
  await page.goto("/")
  await mainNav(page).getByRole("link", { name: "About" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "About" })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
})
```

- [ ] **Step 6: Run them to verify the bug**

Run: `pnpm test:e2e tests/e2e/navigation --project desktop`
Expected: FAIL on the first test, because `#faq:visible` is not in the viewport (the rail resolved the hidden home page's `#faq`).

If it passes (the DOM order happened to favour the new page), keep it as a regression guard; the Step 1 unit tests pin the behaviour.

- [ ] **Step 7: Turn `ScrollMotion` into the page-scoped `PageMotion`**

```bash
git mv components/scroll-motion.tsx components/page-motion.tsx
```

In `components/page-motion.tsx`, make these edits.

1. Replace `import { usePathname } from "next/navigation"` with:

```tsx
import { useRef } from "react"
import { usePathname } from "next/navigation"
```

2. Delete the module-level selector (old lines 33–34):

```tsx
const select = (token: string) =>
  gsap.utils.toArray<HTMLElement>(`[data-motion~="${token}"]`)
```

3. Replace:

```tsx
export function ScrollMotion() {
  // Lives in the root layout, so it rebuilds for each page's markup.
  const pathname = usePathname()

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
```

with:

```tsx
// Rendered as the last child of each page's <main data-page-root>. Motion is
// built for that page plus the shared header and footer ([data-site-chrome]),
// and torn down when the page unmounts or Activity hides it, so a hidden
// route's markup is never animated or measured.
export function PageMotion() {
  const marker = useRef<HTMLSpanElement>(null)
  const pathname = usePathname()

  useGSAP(
    () => {
      const root = marker.current?.closest<HTMLElement>("[data-page-root]")
      if (!root) return
      const scopes: ParentNode[] = [
        root,
        ...document.querySelectorAll<HTMLElement>("[data-site-chrome]"),
      ]
      const query = (selector: string) =>
        scopes.flatMap((scope) =>
          Array.from(scope.querySelectorAll<HTMLElement>(selector))
        )
      const select = (token: string) => query(`[data-motion~="${token}"]`)

      const mm = gsap.matchMedia()
```

4. Replace (old line 82):

```tsx
          const stacks = gsap.utils.toArray<HTMLElement>("[data-stack]")
```

with:

```tsx
          const stacks = Array.from(
            root.querySelectorAll<HTMLElement>("[data-stack]")
          )
```

5. Replace (old line 403):

```tsx
            gsap.utils.toArray<HTMLElement>("[data-magnetic]").forEach((el) => {
```

with:

```tsx
            query("[data-magnetic]").forEach((el) => {
```

6. Replace the final `return null` of the component with:

```tsx
  return <span ref={marker} hidden data-page-motion />
```

- [ ] **Step 8: Scope the rail, hash links and the steps story**

In `components/journey-rail.tsx`, add `import { findTarget } from "@/lib/page-root"` below the `cn` import. Replace both occurrences of:

```tsx
      const el = document.getElementById(target)
```

and

```tsx
    const el = document.getElementById(target)
```

with, respectively:

```tsx
      const el = findTarget(target, rail.current)
```

and

```tsx
    const el = findTarget(target, rail.current)
```

In `components/smooth-scroll.tsx`, add `import { findTarget } from "@/lib/page-root"` below the `gsap` import, and replace:

```ts
      const target =
        url.hash &&
        document.getElementById(decodeURIComponent(url.hash.slice(1)))
```

with:

```ts
      const target =
        url.hash && findTarget(decodeURIComponent(url.hash.slice(1)), link)
```

In `features/how-it-works/components/steps-story.tsx`, add this inside `StepsStory`, after `const desktop = useDesktop()`:

```tsx
  // Later cards are resolved inside this section's own track when the
  // timeline is built (Scrollytelling reads `.current` lazily). A global
  // selector could hit a copy of this section kept in a hidden route.
  const stepAt = (index: number) =>
    ({
      get current() {
        return track.current?.querySelectorAll("li").item(index) ?? null
      },
    }) as React.RefObject<HTMLElement>
```

Then replace:

```tsx
              target: `#how-it-works li:nth-child(${i + 2})`,
```

with:

```tsx
              target: stepAt(i + 1),
```

- [ ] **Step 9: Render `PageMotion` inside every page**

In `app/(site)/layout.tsx`, delete `import { ScrollMotion } from "@/components/scroll-motion"` and the `<ScrollMotion />` line.

In each of the 7 page files under `app/(site)/` (`page.tsx`, `about/page.tsx`, `services/page.tsx`, `how-it-works/page.tsx`, `insights/page.tsx`, `insights/[slug]/page.tsx`, `contact/page.tsx`):

- add `import { PageMotion } from "@/components/page-motion"` after the `JourneyRail` import;
- replace `<main className="bg-ink">` with `<main data-page-root className="bg-ink">`;
- replace `<JourneyRail chapters={CHAPTERS} />` with:

```tsx
      <JourneyRail chapters={CHAPTERS} />
      <PageMotion />
```

In `components/stack-card.tsx`, change the comment `ScrollMotion finds [data-stack]` to `PageMotion finds [data-stack]`.

- [ ] **Step 10: Run unit, navigation and parity tests**

Run: `pnpm test:unit && pnpm test:e2e tests/e2e/navigation --project desktop && pnpm test:parity`
Expected:

- unit: PASS;
- navigation: PASS, `3 passed`;
- parity: PASS, `21 passed`.

- [ ] **Step 11: Manual motion check**

Run `pnpm build && pnpm start`. Open http://localhost:3000 with motion allowed, scroll the home page, then go home → About → Services → back. Check that:

- the stacked cards sink and shade;
- words brighten and cards deal;
- the footer columns stagger in;
- "Book a Call" is magnetic;
- the steps track scrolls sideways on `/how-it-works`;
- every rail chapter scrolls to the right section on each page.

- [ ] **Step 12: Commit**

```bash
git add -A lib/page-root.ts lib/page-root.test.ts components features/how-it-works/components/steps-story.tsx app tests/e2e/navigation
git commit -m "refactor: page-scoped motion and lookups that ignore Activity-hidden routes"
```

---

### Task 0.6: Environment, local PostgreSQL and the migration toolchain

**Files:**

- Create: `server/env.ts`
- Test: `server/env.test.ts`
- Create: `docker-compose.yml`
- Create: `docker/postgres/init/01-databases.sql`
- Create: `.env.example`
- Create: `drizzle.config.ts`
- Create: `server/db/client.ts`
- Create: `server/db/migrate.ts`
- Create: `server/db/schema/index.ts`
- Create: `server/db/schema/settings.ts`
- Create: `server/db/migrations/*` (generated)
- Create: `scripts/migrate.ts`
- Create: `tests/test-env.ts`
- Create: `tests/integration/setup/global-setup.ts`
- Create: `tests/integration/helpers/db.ts`
- Test: `tests/integration/db/settings.test.ts`
- Modify: `vitest.config.ts`
- Modify: `package.json`

**Interfaces:**

- Produces:
  - `getEnv(): Env` and `resetEnvForTests(): void`;
  - `getDb(): Db` and `closeDb(): Promise<void>`;
  - `type Db = NodePgDatabase<typeof schema>`;
  - `runMigrations(databaseUrl: string, migrationsFolder?: string): Promise<void>`;
  - `settings` (pgTable);
  - `resetDb(): Promise<void>`;
  - `TEST_ENV` and `TEST_DATABASE_URL`;
  - scripts `db:up`, `db:generate`, `db:migrate`, `db:studio` and `test:integration`.

- [ ] **Step 1: Install**

```bash
pnpm add drizzle-orm@0.45.4 pg@8.23.1 zod@4.6.5
pnpm add -D drizzle-kit@0.31.11 @types/pg tsx dotenv-cli
```

- [ ] **Step 2: Write the failing env tests**

Create `server/env.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"

import { getEnv, resetEnvForTests } from "./env"

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvForTests()
})

describe("getEnv", () => {
  it("parses the runtime environment and applies defaults", () => {
    vi.stubEnv("SITE_URL", "https://www.example.ie")
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@db:5432/app")
    vi.stubEnv("SITE_ENV", undefined)
    const env = getEnv()
    expect(env.SITE_URL).toBe("https://www.example.ie")
    expect(env.SITE_ENV).toBe("development")
  })

  it("names every invalid variable in one error", () => {
    vi.stubEnv("SITE_URL", "not a url")
    vi.stubEnv("DATABASE_URL", "")
    expect(() => getEnv()).toThrow(/SITE_URL/)
    resetEnvForTests()
    expect(() => getEnv()).toThrow(/DATABASE_URL/)
  })
})
```

Run: `pnpm vitest run --project unit server/env.test.ts`
Expected: FAIL, `Failed to resolve import "./env"`.

- [ ] **Step 3: Implement the env module**

Create `server/env.ts`:

```ts
import "server-only"

import * as z from "zod"

// Validated lazily on first use, never at module scope: `next build` runs
// without production secrets or a database (docs/brief.md §5.6).
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SITE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  SITE_URL: z.url(),
  DATABASE_URL: z.url(),
})

export type Env = z.infer<typeof EnvSchema>

let cached: Env | undefined

export function getEnv(): Env {
  if (cached) return cached
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(parsed.error)}`
    )
  }
  cached = parsed.data
  return cached
}

// Tests change process.env between cases; the app never calls this.
export function resetEnvForTests() {
  cached = undefined
}
```

Run: `pnpm vitest run --project unit server/env.test.ts`
Expected: PASS, `2 passed`.

- [ ] **Step 4: Add the local services and the example env**

Create `docker-compose.yml`:

```yaml
# Local services only. Production runs on Dokploy (docs/brief.md §17).
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: mk
      POSTGRES_PASSWORD: mk
      POSTGRES_DB: mk_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mk -d mk_dev"]
      interval: 5s
      timeout: 5s
      retries: 10
  mailpit:
    image: axllent/mailpit:v1.31.4
    ports:
      - "1025:1025" # SMTP
      - "8025:8025" # web inbox
volumes:
  postgres-data:
```

Create `docker/postgres/init/01-databases.sql`:

```sql
-- Separate databases so tests never touch development data.
CREATE DATABASE mk_test;
CREATE DATABASE mk_e2e;
```

Create `.env.example`:

```bash
# Copy to .env for local development: cp .env.example .env
SITE_URL=http://localhost:3000
SITE_ENV=development
DATABASE_URL=postgres://mk:mk@localhost:5432/mk_dev

# Test databases (created by docker/postgres/init)
DATABASE_URL_TEST=postgres://mk:mk@localhost:5432/mk_test
DATABASE_URL_E2E=postgres://mk:mk@localhost:5432/mk_e2e
```

Run: `cp .env.example .env && docker compose up -d --wait`
Expected: `postgres` reports Healthy and `mailpit` reports Started.

- [ ] **Step 5: Write the failing integration test and its harness**

Create `tests/test-env.ts`:

```ts
// The one place that decides what env every test process sees.
export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgres://mk:mk@localhost:5432/mk_test"

export const TEST_ENV = {
  NODE_ENV: "test",
  SITE_ENV: "development",
  SITE_URL: "http://localhost:3000",
  DATABASE_URL: TEST_DATABASE_URL,
  BETTER_AUTH_SECRET: "test-secret-0123456789-abcdefghij-klmnop",
  BETTER_AUTH_URL: "http://localhost:3000",
  EMAIL_DRIVER: "log",
  EMAIL_FROM: "Magda Kennedy <hello@example.com>",
} as const
```

Create `tests/integration/setup/global-setup.ts`:

```ts
import { Pool } from "pg"

import { runMigrations } from "../../../server/db/migrate"
import { TEST_DATABASE_URL } from "../../test-env"

// Every run starts from an empty schema, so migrations are exercised from zero.
export default async function setup() {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL })
  await pool.query("drop schema if exists public cascade")
  await pool.query("drop schema if exists drizzle cascade")
  await pool.query("create schema public")
  await pool.end()
  await runMigrations(TEST_DATABASE_URL)
}
```

Create `tests/integration/helpers/db.ts`:

```ts
import { sql } from "drizzle-orm"

import { getDb } from "@/server/db/client"

// Empties every application table between tests (migrations stay applied).
export async function resetDb() {
  const db = getDb()
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`
  )
  if (rows.length === 0) return
  const tables = rows.map((row) => `"public"."${row.tablename}"`).join(", ")
  await db.execute(sql.raw(`truncate table ${tables} restart identity cascade`))
}
```

Create `tests/integration/db/settings.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("settings table", () => {
  it("stores and reads a JSON document by key", async () => {
    const db = getDb()
    await db
      .insert(settings)
      .values({ key: "site", value: { name: "Magda Kennedy" } })

    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "site"))

    expect(row.value).toEqual({ name: "Magda Kennedy" })
    expect(row.version).toBe(1)
    expect(row.updatedAt).toBeInstanceOf(Date)
  })
})
```

Update `vitest.config.ts` to the final shape:

```ts
import path from "node:path"

import { defineConfig } from "vitest/config"

import { TEST_ENV } from "./tests/test-env"

const root = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // `server-only` throws outside a React Server Component bundle.
      "server-only": path.join(root, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    env: { ...TEST_ENV },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["**/*.test.{ts,tsx}"],
          exclude: [
            "node_modules/**",
            ".next/**",
            ".kilo/**",
            "tests/integration/**",
            "tests/e2e/**",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/setup/global-setup.ts"],
          // One shared database: files run one after another.
          fileParallelism: false,
          hookTimeout: 30_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
})
```

Add to `package.json` `scripts`:

```json
"test:integration": "vitest run --project integration",
"db:up": "docker compose up -d --wait",
"db:generate": "drizzle-kit generate",
"db:migrate": "dotenv -e .env -- tsx scripts/migrate.ts",
"db:studio": "dotenv -e .env -- drizzle-kit studio"
```

Run: `pnpm test:integration`
Expected: FAIL, `Failed to resolve import "../../../server/db/migrate"`.

- [ ] **Step 6: Implement the database layer**

Create `server/db/migrate.ts`. It has no `server-only`, because CLI scripts and the Docker entrypoint use it:

```ts
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

// Arbitrary constant. Concurrent boots (two replicas, a deploy overlapping a
// restart) queue on this lock instead of racing through the same migration.
const MIGRATION_LOCK = 727_274

export async function runMigrations(
  databaseUrl: string,
  migrationsFolder = "server/db/migrations"
) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 })
  const client = await pool.connect()
  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK])
    await migrate(drizzle({ client }), { migrationsFolder })
  } finally {
    await client
      .query("select pg_advisory_unlock($1)", [MIGRATION_LOCK])
      .catch(() => undefined)
    client.release()
    await pool.end()
  }
}
```

Create `server/db/schema/settings.ts`:

```ts
import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

// One row per global document (docs/brief.md §6.4). `value` is validated by
// the owning module's Zod schema; `draft` is only used by the theme.
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().$type<unknown>().notNull(),
  draft: jsonb().$type<unknown>(),
  version: integer().notNull().default(1),
  // Attribution only. The users table arrives in Task 1.3, and the audit log
  // is the source of truth for who changed what.
  updatedBy: uuid(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
```

Create `server/db/schema/index.ts`:

```ts
export * from "./settings"
```

Create `server/db/client.ts`:

```ts
import "server-only"

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { getEnv } from "@/server/env"

import * as schema from "./schema"

export type Db = NodePgDatabase<typeof schema>

// One pool per process, created on first use (never at import, so builds need
// no database). Kept on globalThis so dev hot reloads don't leak pools.
const store = globalThis as unknown as { mkPool?: Pool; mkDb?: Db }

export function getDb(): Db {
  if (store.mkDb) return store.mkDb
  const pool =
    store.mkPool ??
    new Pool({ connectionString: getEnv().DATABASE_URL, max: 10 })
  store.mkPool = pool
  store.mkDb = drizzle({ client: pool, schema, casing: "snake_case" })
  return store.mkDb
}

export async function closeDb() {
  await store.mkPool?.end()
  store.mkPool = undefined
  store.mkDb = undefined
}
```

Create `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema/index.ts",
  out: "./server/db/migrations",
  casing: "snake_case",
  strict: true,
  verbose: true,
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
})
```

Create `scripts/migrate.ts`:

```ts
import { runMigrations } from "../server/db/migrate"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("[migrate] DATABASE_URL is not set")
  process.exit(1)
}

runMigrations(url, process.env.MIGRATIONS_DIR)
  .then(() => console.log("[migrate] database is up to date"))
  .catch((error: unknown) => {
    console.error("[migrate] failed", error)
    process.exit(1)
  })
```

- [ ] **Step 7: Generate the first migration and run the tests**

Run: `pnpm db:generate --name settings`
Expected: `server/db/migrations/0000_settings.sql` contains `CREATE TABLE "settings"`, with the columns `key`, `value`, `draft`, `version`, `updated_by` and `updated_at`.

Run: `pnpm test:integration`
Expected: PASS, `1 passed`.

Run: `pnpm db:migrate`
Expected: `[migrate] database is up to date`.

- [ ] **Step 8: Prove the build still needs no database**

Run: `docker compose stop postgres && pnpm build; docker compose start postgres`
Expected: the build passes, because nothing touches the database at build time.

- [ ] **Step 9: Lint and types, then commit**

Run: `pnpm lint && pnpm typecheck && pnpm test:unit`
Expected: exit 0.

```bash
git add server tests docker docker-compose.yml drizzle.config.ts scripts/migrate.ts .env.example vitest.config.ts package.json pnpm-lock.yaml
git commit -m "feat: postgres, drizzle migrations and the integration test harness"
```

---

### Task 0.7: CI that proves tests pass and the build needs no database

**Files:**

- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: the `lint`, `typecheck`, `test:unit`, `test:integration` and `build` scripts from Tasks 0.1–0.6.

- [ ] **Step 1: Replace the workflow**

Replace `.github/workflows/ci.yml` with:

```yaml
name: CI

# Checks every push and pull request. Deploys stay with Dokploy; Phase 11 makes
# them wait for this workflow (docs/brief.md §16).
on:
  push:
    branches: [main, feat/platform]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: mk
          POSTGRES_PASSWORD: mk
          POSTGRES_DB: mk_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U mk -d mk_test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL_TEST: postgres://mk:mk@localhost:5432/mk_test
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
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test:unit
      - run: pnpm test:integration
      # Guardrail: the build must never need a database (brief §5.6).
      - name: Build with an unreachable database
        run: pnpm build
        env:
          DATABASE_URL: postgres://nobody:nothing@127.0.0.1:1/unreachable
          SITE_URL: https://example.com
```

- [ ] **Step 2: Reproduce the guardrail locally**

Run: `DATABASE_URL=postgres://nobody:nothing@127.0.0.1:1/unreachable SITE_URL=https://example.com pnpm build`
Expected: PASS.

- [ ] **Step 3: Commit and confirm on GitHub**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run unit and integration tests, build with no database"
git push -u origin feat/platform
```

Expected: the `CI / check` run on `feat/platform` is green.

---

## Phase 1: Auth, RBAC and API core

**Outcome:**

- Better Auth on PostgreSQL;
- the seven-role permission matrix, proven by tests;
- a Hono API with an error envelope, session, permission and same-origin middleware;
- an audit log;
- owner invites;
- `proxy.ts`;
- working admin sign-in, reset and two-factor screens;
- a container that migrates on boot.

### Task 1.1: Permission model (seven roles)

**Files:**

- Create: `lib/auth/permissions.ts`
- Test: `lib/auth/permissions.test.ts`

**Interfaces:**

- Produces:
  - `statement` (const) and `ac`;
  - `roles` (owner, admin, editor, author, marketer, intake, viewer);
  - `type RoleName`, `type Resource`, `type Permissions`;
  - `ROLE_NAMES: RoleName[]`;
  - `parseRoles(value: string | null | undefined): RoleName[]`;
  - `hasPermission(userRoles: readonly RoleName[], permissions: Permissions): boolean`;
  - `permissionMap(userRoles: readonly RoleName[]): Permissions`.
- The module is isomorphic, with no `server-only`: the auth client (Task 1.10) passes `ac` and `roles` to `adminClient`.

- [ ] **Step 1: Install Better Auth**

```bash
pnpm add better-auth@1.7.7
```

- [ ] **Step 2: Write the failing matrix test**

Create `lib/auth/permissions.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  hasPermission,
  parseRoles,
  permissionMap,
  type Permissions,
  type RoleName,
} from "./permissions"

const ALL: RoleName[] = [
  "owner",
  "admin",
  "editor",
  "author",
  "marketer",
  "intake",
  "viewer",
]

// Mirrors docs/brief.md §7.2. Ownership ("own") rules are enforced by the
// services; at this layer the role only needs the base permission.
const MATRIX: [Permissions, RoleName[]][] = [
  [{ dashboard: ["view"] }, ALL],
  [{ page: ["read"] }, ["owner", "admin", "editor", "author", "marketer", "viewer"]],
  [{ page: ["update"] }, ["owner", "admin", "editor"]],
  [{ page: ["publish"] }, ["owner", "admin", "editor"]],
  [{ page: ["create", "delete"] }, ["owner", "admin", "editor"]],
  [{ article: ["read"] }, ["owner", "admin", "editor", "author", "marketer", "viewer"]],
  [{ article: ["create", "update"] }, ["owner", "admin", "editor", "author"]],
  [{ article: ["publish"] }, ["owner", "admin", "editor"]],
  [{ article: ["delete"] }, ["owner", "admin", "editor", "author"]],
  [{ collection: ["read"] }, ["owner", "admin", "editor", "author", "marketer", "viewer"]],
  [{ collection: ["create", "update", "delete"] }, ["owner", "admin", "editor"]],
  [{ globals: ["read"] }, ["owner", "admin", "editor", "marketer", "viewer"]],
  [{ globals: ["update"] }, ["owner", "admin", "editor"]],
  [{ media: ["read", "upload"] }, ["owner", "admin", "editor", "author", "marketer"]],
  [{ media: ["update"] }, ["owner", "admin", "editor", "author", "marketer"]],
  [{ media: ["delete"] }, ["owner", "admin", "editor"]],
  [{ lead: ["read", "update"] }, ["owner", "admin", "intake"]],
  [{ lead: ["export"] }, ["owner", "admin"]],
  [{ lead: ["delete"] }, ["owner", "admin"]],
  [{ newsletter: ["read", "export"] }, ["owner", "admin", "marketer"]],
  [{ newsletter: ["delete"] }, ["owner", "admin"]],
  [{ seo: ["read"] }, ["owner", "admin", "editor", "marketer", "viewer"]],
  [{ seo: ["update"] }, ["owner", "admin", "editor", "marketer"]],
  [{ redirect: ["read", "manage"] }, ["owner", "admin", "editor", "marketer"]],
  [{ tracking: ["read", "update"] }, ["owner", "admin", "marketer"]],
  [{ code: ["update"] }, ["owner"]],
  [{ appearance: ["read", "update", "publish"] }, ["owner", "admin"]],
  [{ settings: ["read", "update"] }, ["owner", "admin"]],
  [{ audit: ["read"] }, ["owner", "admin"]],
  [{ user: ["create", "list", "set-role", "ban"] }, ["owner", "admin"]],
  [{ session: ["list", "revoke"] }, ["owner", "admin"]],
  [{ user: ["impersonate"] }, ["owner", "admin"]],
  [{ user: ["impersonate-admins"] }, ["owner"]],
]

describe("permission matrix (brief §7.2)", () => {
  for (const [permission, allowed] of MATRIX) {
    for (const role of ALL) {
      const expected = allowed.includes(role)
      it(`${role} ${expected ? "can" : "cannot"} ${JSON.stringify(permission)}`, () => {
        expect(hasPermission([role], permission)).toBe(expected)
      })
    }
  }
})

describe("users with several roles", () => {
  it("are allowed when any one role grants the permission", () => {
    expect(hasPermission(["intake", "marketer"], { lead: ["read"] })).toBe(true)
    expect(hasPermission(["intake", "marketer"], { tracking: ["update"] })).toBe(true)
  })

  it("need one role that covers every resource of a single check", () => {
    // Same semantics as Better Auth: resources inside one check are ANDed.
    expect(
      hasPermission(["intake", "marketer"], { lead: ["read"], tracking: ["update"] })
    ).toBe(false)
  })
})

describe("parseRoles", () => {
  it("splits Better Auth's comma-separated role column and drops unknown roles", () => {
    expect(parseRoles("editor, author,ghost")).toEqual(["editor", "author"])
    expect(parseRoles(null)).toEqual([])
  })
})

describe("permissionMap", () => {
  it("unions the actions of every role a user holds", () => {
    const map = permissionMap(["intake", "viewer"])
    expect(map.lead).toEqual(["read", "update"])
    expect(map.page).toEqual(["read"])
    expect(map.code ?? []).toEqual([])
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run --project unit lib/auth/permissions.test.ts`
Expected: FAIL, `Failed to resolve import "./permissions"`.

- [ ] **Step 4: Implement the access-control statement and roles**

Create `lib/auth/permissions.ts`:

```ts
import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"

// docs/brief.md §7.2. Isomorphic: the server authorises with it, and the
// admin client uses it for adminClient({ ac, roles }) and UI gating.
export const statement = {
  ...defaultStatements,
  dashboard: ["view"],
  page: ["read", "create", "update", "publish", "delete"],
  article: ["read", "create", "update", "publish", "delete"],
  collection: ["read", "create", "update", "delete"],
  globals: ["read", "update"],
  media: ["read", "upload", "update", "delete"],
  lead: ["read", "update", "export", "delete"],
  newsletter: ["read", "export", "delete"],
  seo: ["read", "update"],
  redirect: ["read", "manage"],
  tracking: ["read", "update"],
  code: ["update"],
  appearance: ["read", "update", "publish"],
  settings: ["read", "update"],
  audit: ["read"],
} as const

export const ac = createAccessControl(statement)

type Statement = typeof statement
export type Resource = keyof Statement
export type Permissions = { [R in Resource]?: Statement[R][number][] }

const owner = ac.newRole({
  user: [...statement.user],
  session: [...statement.session],
  dashboard: ["view"],
  page: ["read", "create", "update", "publish", "delete"],
  article: ["read", "create", "update", "publish", "delete"],
  collection: ["read", "create", "update", "delete"],
  globals: ["read", "update"],
  media: ["read", "upload", "update", "delete"],
  lead: ["read", "update", "export", "delete"],
  newsletter: ["read", "export", "delete"],
  seo: ["read", "update"],
  redirect: ["read", "manage"],
  tracking: ["read", "update"],
  code: ["update"],
  appearance: ["read", "update", "publish"],
  settings: ["read", "update"],
  audit: ["read"],
})

// Everything an owner has, except custom code and impersonating admins.
// Owner protection (no acting on owners) lives in the users service.
const admin = ac.newRole({
  ...owner.statements,
  user: [...adminAc.statements.user],
  session: [...adminAc.statements.session],
  code: [],
})

const editor = ac.newRole({
  dashboard: ["view"],
  page: ["read", "create", "update", "publish", "delete"],
  article: ["read", "create", "update", "publish", "delete"],
  collection: ["read", "create", "update", "delete"],
  globals: ["read", "update"],
  media: ["read", "upload", "update", "delete"],
  seo: ["read", "update"],
  redirect: ["read", "manage"],
})

// Articles and media are limited to the author's own records by the services.
const author = ac.newRole({
  dashboard: ["view"],
  page: ["read"],
  article: ["read", "create", "update", "delete"],
  collection: ["read"],
  media: ["read", "upload", "update"],
})

// SEO and ads people: no access to enquiries (health-adjacent data).
const marketer = ac.newRole({
  dashboard: ["view"],
  page: ["read"],
  article: ["read"],
  collection: ["read"],
  globals: ["read"],
  media: ["read", "upload", "update"],
  newsletter: ["read", "export"],
  seo: ["read", "update"],
  redirect: ["read", "manage"],
  tracking: ["read", "update"],
})

const intake = ac.newRole({
  dashboard: ["view"],
  lead: ["read", "update"],
})

const viewer = ac.newRole({
  dashboard: ["view"],
  page: ["read"],
  article: ["read"],
  collection: ["read"],
  globals: ["read"],
  seo: ["read"],
})

export const roles = { owner, admin, editor, author, marketer, intake, viewer }
export type RoleName = keyof typeof roles
export const ROLE_NAMES = Object.keys(roles) as RoleName[]

const isRoleName = (value: string): value is RoleName => value in roles

// Better Auth stores several roles as one comma-separated string.
export function parseRoles(value: string | null | undefined): RoleName[] {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter(isRoleName)
}

export function hasPermission(
  userRoles: readonly RoleName[],
  permissions: Permissions
): boolean {
  return userRoles.some((name) => roles[name].authorize(permissions).success)
}

export function permissionMap(userRoles: readonly RoleName[]): Permissions {
  const merged = new Map<string, Set<string>>()
  for (const name of userRoles) {
    for (const [resource, actions] of Object.entries(roles[name].statements)) {
      const set = merged.get(resource) ?? new Set<string>()
      for (const action of actions as readonly string[]) set.add(action)
      merged.set(resource, set)
    }
  }
  return Object.fromEntries(
    [...merged].map(([resource, set]) => [resource, [...set]])
  ) as Permissions
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm vitest run --project unit lib/auth/permissions.test.ts`
Expected: PASS, `235 passed` (33 × 7 matrix cases + 4).

- [ ] **Step 6: Commit**

```bash
git add lib/auth package.json pnpm-lock.yaml
git commit -m "feat: seven-role access control with a tested permission matrix"
```

---

### Task 1.2: Email delivery core

**Files:**

- Create: `server/lib/email/index.ts`
- Create: `server/lib/email/templates.ts`
- Test: `server/lib/email/email.test.ts`
- Modify: `server/env.ts`
- Modify: `.env.example`

**Interfaces:**

- Consumes: `getEnv()`.
- Produces:
  - `sendEmail(message: EmailMessage): Promise<void>`;
  - `type EmailMessage = { to: string; subject: string; html: string; text: string }`;
  - `readOutbox()` and `clearOutbox()`, for tests on the log driver;
  - `inviteEmail({ name, url })` and `passwordResetEmail({ name, url })`, both returning `{ subject, html, text }`;
  - env: `EMAIL_DRIVER` (`"log" | "smtp"`), `SMTP_URL?`, `EMAIL_FROM`.
- Phase 6 adds the Resend driver and React Email templates.

- [ ] **Step 1: Install**

```bash
pnpm add nodemailer
```

Nodemailer 10 is a TypeScript rewrite with its own types. Add `@types/nodemailer` only if `pnpm typecheck` reports missing declarations.

- [ ] **Step 2: Write the failing tests**

Create `server/lib/email/email.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest"

import { clearOutbox, readOutbox, sendEmail } from "./index"
import { inviteEmail, passwordResetEmail } from "./templates"

afterEach(clearOutbox)

describe("sendEmail with the log driver", () => {
  it("delivers with the configured sender", async () => {
    await sendEmail({
      to: "ann@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    })
    expect(readOutbox()).toEqual([
      {
        to: "ann@example.com",
        from: "Magda Kennedy <hello@example.com>",
        subject: "Hi",
        html: "<p>Hi</p>",
        text: "Hi",
      },
    ])
  })
})

describe("templates", () => {
  it("escapes user-supplied names and URLs in HTML", () => {
    const message = inviteEmail({
      name: "<script>x</script>",
      url: "https://example.com/r?token=1&x=2",
    })
    expect(message.html).not.toContain("<script>")
    expect(message.html).toContain("&lt;script&gt;")
    expect(message.html).toContain("https://example.com/r?token=1&amp;x=2")
    expect(message.text).toContain("https://example.com/r?token=1&x=2")
  })

  it("words the reset email for an existing account", () => {
    expect(
      passwordResetEmail({ name: "Ann", url: "https://example.com/r" }).subject
    ).toBe("Reset your admin password")
  })
})
```

Run: `pnpm vitest run --project unit server/lib/email`
Expected: FAIL, `Failed to resolve import "./index"`.

- [ ] **Step 3: Extend the env schema**

In `server/env.ts`, replace the `EnvSchema` declaration with:

```ts
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SITE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  SITE_URL: z.url(),
  DATABASE_URL: z.url(),
  // "resend" is added in Phase 6.
  EMAIL_DRIVER: z.enum(["log", "smtp"]).default("log"),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().min(3).default("Magda Kennedy <hello@localhost>"),
})
```

Append to `.env.example`:

```bash
# Email: "smtp" delivers to Mailpit locally (http://localhost:8025)
EMAIL_DRIVER=smtp
SMTP_URL=smtp://localhost:1025
EMAIL_FROM="Magda Kennedy <hello@localhost>"
```

- [ ] **Step 4: Implement the drivers and templates**

Create `server/lib/email/index.ts`:

```ts
import "server-only"

import nodemailer from "nodemailer"

import { getEnv } from "@/server/env"

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text: string
}

type Envelope = EmailMessage & { from: string }
type EmailDriver = { send(message: Envelope): Promise<void> }

// The log driver keeps messages in memory (tests read them) and prints them in
// development, so invite links are usable without a mail server.
const outbox: Envelope[] = []

const logDriver: EmailDriver = {
  async send(message) {
    outbox.push(message)
    if (getEnv().NODE_ENV !== "test") {
      console.info(
        `[email] to=${message.to} subject="${message.subject}"\n${message.text}`
      )
    }
  },
}

const smtpDriver = (url: string): EmailDriver => {
  const transport = nodemailer.createTransport(url)
  return {
    async send(message) {
      await transport.sendMail(message)
    },
  }
}

let driver: EmailDriver | undefined

function getDriver(): EmailDriver {
  if (driver) return driver
  const env = getEnv()
  driver =
    env.EMAIL_DRIVER === "smtp" && env.SMTP_URL
      ? smtpDriver(env.SMTP_URL)
      : logDriver
  return driver
}

export async function sendEmail(message: EmailMessage) {
  await getDriver().send({ ...message, from: getEnv().EMAIL_FROM })
}

export const readOutbox = () => [...outbox]
export const clearOutbox = () => {
  outbox.length = 0
}
```

Create `server/lib/email/templates.ts`:

```ts
import "server-only"

// Plain transactional templates. Phase 6 replaces them with React Email.
const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)

const layout = (title: string, body: string) =>
  `<!doctype html><html><body style="margin:0;background:#f2f3f2;padding:24px;font-family:Arial,sans-serif;color:#111411">` +
  `<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">` +
  `<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>${body}</div></body></html>`

const button = (url: string, label: string) =>
  `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#16823a;color:#ffffff;padding:12px 20px;border-radius:12px;text-decoration:none">${escapeHtml(label)}</a></p>`

type LinkEmail = { name: string; url: string }

export function inviteEmail({ name, url }: LinkEmail) {
  return {
    subject: "You're invited to the Magda Kennedy admin",
    html: layout(
      "You're invited",
      `<p>Hi ${escapeHtml(name)},</p><p>You now have access to the website admin. Choose a password to get started. The link works for 24 hours.</p>${button(url, "Set your password")}`
    ),
    text: `Hi ${name},\n\nYou now have access to the website admin. Choose a password (the link works for 24 hours):\n${url}\n`,
  }
}

export function passwordResetEmail({ name, url }: LinkEmail) {
  return {
    subject: "Reset your admin password",
    html: layout(
      "Reset your password",
      `<p>Hi ${escapeHtml(name)},</p><p>Someone asked to reset your password. If it was you, use the button below; the link works for 24 hours. If it wasn't, you can ignore this email.</p>${button(url, "Reset password")}`
    ),
    text: `Hi ${name},\n\nReset your password (the link works for 24 hours):\n${url}\n\nIf you didn't ask for this, ignore this email.\n`,
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit server/lib/email server/env.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/lib/email server/env.ts .env.example package.json pnpm-lock.yaml
git commit -m "feat: email delivery core with log and smtp drivers"
```

---

### Task 1.3: Better Auth on PostgreSQL

**Files:**

- Create: `server/auth/auth.ts`
- Create: `server/auth/cli.ts`
- Create: `server/db/schema/auth.ts` (generated by the Better Auth CLI)
- Create: `server/db/migrations/0001_auth.sql` (generated by drizzle-kit)
- Modify: `server/db/schema/index.ts`
- Modify: `server/env.ts`
- Modify: `.env.example`
- Modify: `package.json`
- Test: `tests/integration/auth/auth.test.ts`

**Interfaces:**

- Consumes:
  - `ac` and `roles` (Task 1.1);
  - `sendEmail`, `inviteEmail` and `passwordResetEmail` (Task 1.2);
  - `getDb()`.
- Produces:
  - `buildAuth()`, `getAuth(): Auth` and `type Auth`;
  - the tables `users`, `sessions`, `accounts`, `verifications`, `twoFactors` and `rateLimits` (generated export names; check the generated file);
  - env: `BETTER_AUTH_SECRET` (≥ 32 chars) and `BETTER_AUTH_URL`;
  - the script `auth:generate`.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/auth/auth.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { getAuth } from "@/server/auth/auth"
import { closeDb } from "@/server/db/client"

import { resetDb } from "../helpers/db"

const PASSWORD = "correct horse battery staple"

beforeEach(resetDb)
afterAll(closeDb)

describe("Better Auth", () => {
  it("lets a created user sign in with email and password", async () => {
    const auth = getAuth()
    await auth.api.createUser({
      body: { email: "editor@example.com", password: PASSWORD, name: "Ed Itor", role: "editor" },
    })

    const response = await auth.api.signInEmail({
      body: { email: "editor@example.com", password: PASSWORD },
      asResponse: true,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toMatch(/mk\.session_token=/)
  })

  it("stores uuid ids", async () => {
    const { user } = await getAuth().api.createUser({
      body: { email: "viewer@example.com", password: PASSWORD, name: "Vi", role: "viewer" },
    })
    expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it("rejects public sign-up", async () => {
    const response = await getAuth().handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "x@example.com", password: PASSWORD, name: "X" }),
      })
    )
    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})
```

Run: `pnpm test:integration`
Expected: FAIL, `Failed to resolve import "@/server/auth/auth"`.

- [ ] **Step 2: Extend the env schema**

In `server/env.ts`, add these two keys to the `EnvSchema` object, after `DATABASE_URL`:

```ts
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
```

Append to `.env.example`:

```bash
# Auth: generate a secret with `openssl rand -base64 48`
BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters
BETTER_AUTH_URL=http://localhost:3000
```

Copy the same two lines into your local `.env`, with a real random secret.

- [ ] **Step 3: Implement the auth factory**

Create `server/auth/auth.ts`:

```ts
import "server-only"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, twoFactor } from "better-auth/plugins"

import { ac, roles } from "@/lib/auth/permissions"
import { getDb } from "@/server/db/client"
import * as schema from "@/server/db/schema"
import { getEnv } from "@/server/env"
import { sendEmail } from "@/server/lib/email"
import { inviteEmail, passwordResetEmail } from "@/server/lib/email/templates"

// Invites reuse the reset flow (docs/brief.md §7.4). Their redirect target
// carries ?invite=1, so the email can be worded as an invitation.
const isInviteLink = (url: string) =>
  decodeURIComponent(url).includes("invite=1")

export function buildAuth() {
  const env = getEnv()
  return betterAuth({
    appName: "Magda Kennedy Admin",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.SITE_URL],
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
      usePlural: true,
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      // Accounts exist only through invitation.
      disableSignUp: true,
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60 * 24,
      sendResetPassword: async ({ user, url }) => {
        const message = isInviteLink(url)
          ? inviteEmail({ name: user.name, url })
          : passwordResetEmail({ name: user.name, url })
        // Not awaited (avoids a timing side channel); failures are logged.
        void sendEmail({ to: user.email, ...message }).catch((error) =>
          console.error("[auth] could not send email", error)
        )
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      // Cheap reads for the UI. Admin checks bypass it (disableCookieCache).
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      // On for staging and production. Local and E2E runs sign in many times.
      enabled: env.SITE_ENV !== "development",
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
        "/two-factor/*": { window: 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: "mk",
      database: { generateId: "uuid" },
      // Behind Traefik on Dokploy; X-Forwarded-For chains are not trusted.
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    },
    plugins: [
      admin({
        ac,
        roles,
        defaultRole: "viewer",
        adminRoles: ["owner", "admin"],
        impersonationSessionDuration: 60 * 60,
      }),
      twoFactor({ issuer: "Magda Kennedy Admin" }),
    ],
  })
}

export type Auth = ReturnType<typeof buildAuth>

let instance: Auth | undefined

// Built on first use: importing this module at build time needs no secrets.
export function getAuth(): Auth {
  instance ??= buildAuth()
  return instance
}
```

Create `server/auth/cli.ts`:

```ts
// Entry point for the Better Auth CLI (`pnpm auth:generate`), which needs an
// exported instance. The app always goes through getAuth().
import { buildAuth } from "./auth"

export const auth = buildAuth()
```

Add to `package.json` `scripts`:

```json
"auth:generate": "NODE_OPTIONS=--conditions=react-server dotenv -e .env -- pnpm dlx auth@1.7.7 generate --config server/auth/cli.ts --output server/db/schema/auth.ts -y"
```

`--conditions=react-server` makes `server-only` resolve to its empty build in plain Node.

- [ ] **Step 4: Generate the auth schema and migration**

Run: `pnpm auth:generate`
Expected: `server/db/schema/auth.ts` is written.

Open the file and check that it contains `pgTable("users"`, `"sessions"`, `"accounts"`, `"verifications"`, `"two_factors"` (or the CLI's plural for the two-factor table) and `"rate_limits"`. User ids should be `uuid` with a `gen_random_uuid()` default. `users` should have `role`, `banned`, `ban_reason`, `ban_expires` and `two_factor_enabled`, and `sessions` should have `impersonated_by`.

Replace `server/db/schema/index.ts` with:

```ts
export * from "./auth"
export * from "./settings"
```

Run: `pnpm db:generate --name auth && pnpm db:migrate`
Expected: `server/db/migrations/0001_auth.sql` is created, then `[migrate] database is up to date`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:integration`
Expected: PASS, the auth tests plus the settings test.

- [ ] **Step 6: Prove the build still needs no secrets**

Run: `DATABASE_URL=postgres://nobody:nothing@127.0.0.1:1/x SITE_URL=https://example.com pnpm build`
Expected: PASS, with no Better Auth secret error, because `getAuth()` is never called at build.

- [ ] **Step 7: Commit**

```bash
git add server/auth server/db tests/integration/auth server/env.ts .env.example package.json pnpm-lock.yaml
git commit -m "feat: better auth with drizzle, admin and two-factor plugins"
```

---

### Task 1.4: Hono app core and the error envelope

**Files:**

- Create: `server/api/types.ts`
- Create: `server/api/errors.ts`
- Create: `server/api/routes/health.ts`
- Create: `server/api/app.ts`
- Create: `app/api/[...route]/route.ts`
- Test: `server/api/routes/health.test.ts` (unit, DB mocked)
- Test: `tests/integration/api/health.test.ts`

**Interfaces:**

- Produces:
  - `type AppEnv`;
  - `ApiError(code, message, fieldErrors?)` and `type ErrorCode`;
  - `errorBody(code, message, requestId, fieldErrors?)`;
  - `handleError(err, c)` and `validationHook(result, c)`;
  - `app` (`Hono<AppEnv>` with `basePath("/api")`) and `type AppType`;
  - `GET /api/v1/health` → `200 { status: "ok", db: "ok" }` or `503` envelope.
- Error envelope: `{ error: { code, message, requestId, fieldErrors? } }`.

- [ ] **Step 1: Install**

```bash
pnpm add hono@4.13.13 @hono/vercel@1.0.1 @hono/zod-validator@0.9.1
```

- [ ] **Step 2: Write the failing tests**

Create `server/api/routes/health.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

vi.mock("@/server/db/client", () => ({
  getDb: () => ({
    execute: () => Promise.reject(new Error("connect ECONNREFUSED")),
  }),
}))

const { app } = await import("@/server/api/app")

describe("GET /api/v1/health when the database is down", () => {
  it("answers 503 with the error envelope instead of crashing", async () => {
    const response = await app.request("/api/v1/health")
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.error.code).toBe("UNAVAILABLE")
    expect(body.error.requestId).toEqual(expect.any(String))
  })
})
```

Create `tests/integration/api/health.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { closeDb } from "@/server/db/client"

afterAll(closeDb)

describe("api core", () => {
  it("reports a healthy database", async () => {
    const response = await app.request("/api/v1/health")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "ok", db: "ok" })
  })

  it("returns the error envelope for unknown routes", async () => {
    const response = await app.request("/api/v1/nope")
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toMatchObject({ code: "NOT_FOUND" })
    expect(body.error.requestId).toEqual(expect.any(String))
  })

  it("sets security headers", async () => {
    const response = await app.request("/api/v1/health")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
  })
})
```

Run: `pnpm vitest run --project unit server/api && pnpm test:integration`
Expected: FAIL, `Failed to resolve import "@/server/api/app"`.

- [ ] **Step 3: Implement types, errors, health and the app**

Create `server/api/types.ts`:

```ts
import type { RequestIdVariables } from "hono/request-id"

import type { Actor } from "@/server/auth/actor"

export type AppEnv = {
  Variables: RequestIdVariables & { actor: Actor | null }
}
```

Create `server/auth/actor.ts` now, because `AppEnv` needs the type (Task 1.5 adds `toActor`):

```ts
import type { RoleName } from "@/lib/auth/permissions"

// The authenticated user as the API and services see them.
export type Actor = {
  userId: string
  email: string
  name: string
  roles: RoleName[]
  twoFactorEnabled: boolean
  sessionId: string
  impersonatedBy: string | null
  ip: string | null
  userAgent: string | null
}
```

Create `server/api/errors.ts`:

```ts
import "server-only"

import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as z from "zod"

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "INTERNAL"

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
  INTERNAL: 500,
}

// Thrown by middleware and services; rendered by handleError.
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message)
  }

  get status() {
    return STATUS[this.code]
  }
}

export function errorBody(
  code: ErrorCode,
  message: string,
  requestId: string,
  fieldErrors?: Record<string, string[]>
) {
  return { error: { code, message, requestId, ...(fieldErrors && { fieldErrors }) } }
}

const CODE_FOR_STATUS: Partial<Record<number, ErrorCode>> = {
  400: "VALIDATION_FAILED",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
}

export function handleError(error: Error, c: Context) {
  const requestId = String(c.get("requestId") ?? "")
  if (error instanceof ApiError) {
    return c.json(
      errorBody(error.code, error.message, requestId, error.fieldErrors),
      error.status
    )
  }
  if (error instanceof HTTPException) {
    const code = CODE_FOR_STATUS[error.status] ?? "INTERNAL"
    return c.json(errorBody(code, error.message || code, requestId), error.status)
  }
  console.error(`[api] ${requestId}`, error)
  return c.json(errorBody("INTERNAL", "Something went wrong", requestId), 500)
}

// @hono/zod-validator hook: field-level messages in the common envelope.
export function validationHook(
  result: { success: boolean; error?: z.ZodError },
  _c: Context
) {
  if (!result.success && result.error) {
    const { fieldErrors } = z.flattenError(result.error)
    throw new ApiError(
      "VALIDATION_FAILED",
      "Some fields need attention",
      fieldErrors as Record<string, string[]>
    )
  }
}
```

Create `server/api/routes/health.ts`:

```ts
import "server-only"

import { sql } from "drizzle-orm"
import { Hono } from "hono"

import { getDb } from "@/server/db/client"

import { errorBody } from "../errors"
import type { AppEnv } from "../types"

// Used by the Docker HEALTHCHECK and uptime monitors (brief §15).
export const health = new Hono<AppEnv>().get("/", async (c) => {
  try {
    await getDb().execute(sql`select 1`)
    return c.json({ status: "ok" as const, db: "ok" as const })
  } catch {
    return c.json(
      errorBody("UNAVAILABLE", "Database unreachable", c.get("requestId")),
      503
    )
  }
})
```

Create `server/api/app.ts`:

```ts
import "server-only"

import { Hono } from "hono"
import { requestId } from "hono/request-id"
import { secureHeaders } from "hono/secure-headers"

import { errorBody, handleError } from "./errors"
import { health } from "./routes/health"
import type { AppEnv } from "./types"

// docs/brief.md §8.1. Routes are chained so `AppType` carries their types to
// the admin RPC client.
export const app = new Hono<AppEnv>()
  .basePath("/api")
  .use(requestId())
  .use(secureHeaders())
  .route("/v1/health", health)

app.onError(handleError)
app.notFound((c) =>
  c.json(errorBody("NOT_FOUND", "Route not found", c.get("requestId")), 404)
)

export type AppType = typeof app
```

Create `app/api/[...route]/route.ts`:

```ts
import { handle } from "@hono/vercel"

import { app } from "@/server/api/app"

// Every /api/* request is served by Hono (server/api); Next only hosts it.
const handler = handle(app)

export {
  handler as DELETE,
  handler as GET,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit server/api && pnpm test:integration`
Expected: PASS.

- [ ] **Step 5: Check it through Next**

Run: `pnpm build && pnpm start`, then in another shell `curl -s http://localhost:3000/api/v1/health`
Expected: `{"status":"ok","db":"ok"}`. Stop the server afterwards.

- [ ] **Step 6: Commit**

```bash
git add server/api server/auth/actor.ts "app/api/[...route]/route.ts" tests/integration/api package.json pnpm-lock.yaml
git commit -m "feat: hono api core with error envelope and health check"
```

---

### Task 1.5: Session, permission and same-origin middleware; `/me`; the data-access layer

**Files:**

- Modify: `server/auth/actor.ts` (add `toActor`)
- Create: `server/auth/session.ts`
- Create: `server/api/middleware/auth.ts`
- Create: `server/api/middleware/same-origin.ts`
- Create: `server/api/routes/admin.ts`
- Modify: `server/api/app.ts`
- Create: `tests/integration/helpers/auth.ts`
- Test: `tests/integration/api/me.test.ts`

**Interfaces:**

- Consumes: `getAuth()`, `parseRoles`, `hasPermission`, `permissionMap`, `ApiError`, `getEnv()`.
- Produces:
  - `toActor(session: SessionLike): Actor`;
  - `getSession()` (React `cache`, `disableCookieCache`);
  - `requireActor(next?: string): Promise<Actor>` (data-access layer, for Server Components), which redirects to sign-in;
  - Hono middleware `session`, `signedIn` and `can(permissions: Permissions)`. The middleware is deliberately not called `requireActor`, to avoid confusion with the data-access-layer function;
  - `sameOrigin`;
  - `adminRoutes` (`GET /api/v1/admin/me`);
  - `/api/auth/*` mounted.
- Test helpers: `PASSWORD`, `ORIGIN`, `createUser(role, email?)`, `signIn(email)` (returns a cookie header) and `adminRequest(path, cookie, init?)`.

- [ ] **Step 1: Write the test helpers and the failing tests**

Create `tests/integration/helpers/auth.ts`:

```ts
import type { RoleName } from "@/lib/auth/permissions"
import { app } from "@/server/api/app"
import { getAuth } from "@/server/auth/auth"

export const PASSWORD = "correct horse battery staple"
export const ORIGIN = "http://localhost:3000"

export async function createUser(role: RoleName, email = `${role}@example.com`) {
  const { user } = await getAuth().api.createUser({
    body: { email, password: PASSWORD, name: role, role },
  })
  return user
}

// Signs in through Better Auth and returns a Cookie header for app.request.
export async function signIn(email: string, password = PASSWORD) {
  const response = await getAuth().api.signInEmail({
    body: { email, password },
    asResponse: true,
  })
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")
}

export function adminRequest(
  path: string,
  cookie: string,
  init: { method?: string; body?: unknown; origin?: string } = {}
) {
  return app.request(`/api/v1/admin${path}`, {
    method: init.method ?? "GET",
    headers: {
      cookie,
      origin: init.origin ?? ORIGIN,
      "content-type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}
```

Create `tests/integration/api/me.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"

import { adminRequest, createUser, signIn } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("GET /api/v1/admin/me", () => {
  it("rejects anonymous requests with 401", async () => {
    const response = await adminRequest("/me", "")
    expect(response.status).toBe(401)
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED")
  })

  it("returns the actor's roles and merged permissions", async () => {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")

    const response = await adminRequest("/me", cookie)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.roles).toEqual(["viewer"])
    expect(body.permissions.page).toEqual(["read"])
    expect(body.permissions.lead).toBeUndefined()
  })

  it("reflects a role change on the very next request despite the cookie cache", async () => {
    await createUser("editor")
    const cookie = await signIn("editor@example.com")
    await getDb()
      .update(users)
      .set({ role: "viewer" })
      .where(eq(users.email, "editor@example.com"))

    const body = await (await adminRequest("/me", cookie)).json()

    expect(body.roles).toEqual(["viewer"])
  })

  it("locks out a banned user immediately", async () => {
    await createUser("owner")
    const target = await createUser("viewer")
    const ownerCookie = await signIn("owner@example.com")
    const viewerCookie = await signIn("viewer@example.com")

    await getAuth().api.banUser({
      body: { userId: target.id, banReason: "test" },
      headers: new Headers({ cookie: ownerCookie }),
    })

    expect((await adminRequest("/me", viewerCookie)).status).toBe(401)
  })
})
```

Run: `pnpm test:integration`
Expected: FAIL. `/api/v1/admin/me` returns 404, because the route does not exist yet.

- [ ] **Step 2: Map sessions to actors**

Replace `server/auth/actor.ts` with:

```ts
import { parseRoles, type RoleName } from "@/lib/auth/permissions"

// The authenticated user as the API and services see them.
export type Actor = {
  userId: string
  email: string
  name: string
  roles: RoleName[]
  twoFactorEnabled: boolean
  sessionId: string
  impersonatedBy: string | null
  ip: string | null
  userAgent: string | null
}

// The fields we read from Better Auth's session (admin and two-factor
// plugins add role, twoFactorEnabled and impersonatedBy).
export type SessionLike = {
  user: {
    id: string
    email: string
    name: string
    role?: string | null
    twoFactorEnabled?: boolean | null
  }
  session: {
    id: string
    ipAddress?: string | null
    userAgent?: string | null
    impersonatedBy?: string | null
  }
}

export function toActor({ user, session }: SessionLike): Actor {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    roles: parseRoles(user.role),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    sessionId: session.id,
    impersonatedBy: session.impersonatedBy ?? null,
    ip: session.ipAddress ?? null,
    userAgent: session.userAgent ?? null,
  }
}
```

- [ ] **Step 3: Implement the middleware, `/me` and the data-access layer**

Create `server/api/middleware/auth.ts`:

```ts
import "server-only"

import { createMiddleware } from "hono/factory"

import { hasPermission, type Permissions } from "@/lib/auth/permissions"
import { toActor } from "@/server/auth/actor"
import { getAuth } from "@/server/auth/auth"

import { ApiError } from "../errors"
import type { AppEnv } from "../types"

// Full session check against the database: the 5-minute cookie cache is
// bypassed, so bans and role changes apply on the next request.
export const session = createMiddleware<AppEnv>(async (c, next) => {
  const result = await getAuth().api.getSession({
    headers: c.req.raw.headers,
    query: { disableCookieCache: true },
  })
  c.set("actor", result ? toActor(result) : null)
  await next()
})

export const signedIn = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("actor")) throw new ApiError("UNAUTHENTICATED", "Sign in to continue")
  await next()
})

export const can = (permissions: Permissions) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const actor = c.get("actor")
    if (!actor) throw new ApiError("UNAUTHENTICATED", "Sign in to continue")
    if (!hasPermission(actor.roles, permissions)) {
      throw new ApiError("FORBIDDEN", "You don't have permission to do that")
    }
    await next()
  })
```

Create `server/api/middleware/same-origin.ts`:

```ts
import "server-only"

import { createMiddleware } from "hono/factory"

import { getEnv } from "@/server/env"

import { ApiError } from "../errors"
import type { AppEnv } from "../types"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

// Cookie-authenticated mutations must come from our own pages (CSRF defence
// in depth on top of SameSite=Lax cookies).
export const sameOrigin = createMiddleware<AppEnv>(async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method)) {
    const origin = c.req.header("origin")
    const fetchSite = c.req.header("sec-fetch-site")
    const expected = new URL(getEnv().SITE_URL).origin
    const allowed = origin ? origin === expected : fetchSite === "same-origin"
    if (!allowed) throw new ApiError("FORBIDDEN", "Cross-site request blocked")
  }
  await next()
})
```

Create `server/api/routes/admin.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { permissionMap } from "@/lib/auth/permissions"

import { session, signedIn } from "../middleware/auth"
import { sameOrigin } from "../middleware/same-origin"
import type { AppEnv } from "../types"

export const adminRoutes = new Hono<AppEnv>()
  .use(session, signedIn, sameOrigin)
  .get("/me", (c) => {
    const actor = c.get("actor")!
    return c.json({
      user: { id: actor.userId, email: actor.email, name: actor.name },
      roles: actor.roles,
      permissions: permissionMap(actor.roles),
      twoFactorEnabled: actor.twoFactorEnabled,
      impersonatedBy: actor.impersonatedBy,
    })
  })
```

In `server/api/app.ts`, add the imports `import { getAuth } from "@/server/auth/auth"` and `import { adminRoutes } from "./routes/admin"`, then replace the chain with:

```ts
export const app = new Hono<AppEnv>()
  .basePath("/api")
  .use(requestId())
  .use(secureHeaders())
  .on(["GET", "POST"], "/auth/*", (c) => getAuth().handler(c.req.raw))
  .route("/v1/health", health)
  .route("/v1/admin", adminRoutes)
```

Create `server/auth/session.ts`, the data-access layer for Server Components (always inside `<Suspense>`):

```ts
import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { toActor, type Actor } from "./actor"
import { getAuth } from "./auth"

// One full (database-checked) session read per request.
export const getSession = cache(async () =>
  getAuth().api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  })
)

export async function requireActor(next = "/admin"): Promise<Actor> {
  const session = await getSession()
  if (!session) redirect(`/admin/sign-in?next=${encodeURIComponent(next)}`)
  return toActor(session)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:integration && pnpm vitest run --project unit`
Expected: PASS. `me.test.ts` passes all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add server/auth server/api tests/integration
git commit -m "feat: session, permission and same-origin middleware with /me"
```

---

### Task 1.6: Audit log

**Files:**

- Create: `server/db/schema/audit.ts`
- Modify: `server/db/schema/index.ts`
- Create: `server/db/migrations/0002_audit.sql` (generated)
- Create: `server/lib/crypto.ts`
- Create: `server/lib/audit.ts`
- Create: `server/modules/audit/service.ts`
- Create: `server/modules/audit/routes.ts`
- Modify: `server/auth/auth.ts` (`databaseHooks`)
- Modify: `server/api/routes/admin.ts`
- Test: `server/lib/crypto.test.ts`
- Test: `tests/integration/api/audit.test.ts`

**Interfaces:**

- Produces:
  - the `auditLogs` table;
  - `hashIp(ip: string): string`;
  - `audit(actor: AuditActor | null, entry: AuditEntry, db?: Db): Promise<void>`;
  - `type AuditActor = { userId: string; email?: string | null; ip?: string | null; userAgent?: string | null }`;
  - `type AuditEntry = { action: string; entityType: string; entityId?: string | null; summary: string; diff?: Record<string, { from: unknown; to: unknown }> | null }`;
  - `listAuditEntries({ page, pageSize })` → `{ items, page, pageSize, total }`;
  - `GET /api/v1/admin/audit` (requires `audit.read`).
- From here on, every service mutation calls `audit()`.

- [ ] **Step 1: Write the failing tests**

Create `server/lib/crypto.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { hashIp } from "./crypto"

describe("hashIp", () => {
  it("is stable, opaque and never the raw address", () => {
    const hash = hashIp("203.0.113.7")
    expect(hash).toBe(hashIp("203.0.113.7"))
    expect(hash).not.toContain("203.0.113.7")
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
    expect(hashIp("203.0.113.8")).not.toBe(hash)
  })
})
```

Create `tests/integration/api/audit.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb } from "@/server/db/client"

import { adminRequest, createUser, signIn } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("GET /api/v1/admin/audit", () => {
  it("is forbidden without audit.read", async () => {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")
    expect((await adminRequest("/audit", cookie)).status).toBe(403)
  })

  it("lists sign-ins newest first for an owner", async () => {
    await createUser("owner")
    await createUser("editor")
    await signIn("editor@example.com")
    const cookie = await signIn("owner@example.com")

    const response = await adminRequest("/audit?page=1&pageSize=10", cookie)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.total).toBe(2)
    expect(body.items.map((item: { action: string }) => item.action)).toEqual([
      "auth.sign_in",
      "auth.sign_in",
    ])
    expect(new Date(body.items[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(body.items[1].createdAt).getTime()
    )
  })

  it("validates paging input", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")
    const response = await adminRequest("/audit?pageSize=500", cookie)
    expect(response.status).toBe(400)
    expect((await response.json()).error.fieldErrors.pageSize).toBeDefined()
  })
})
```

Run: `pnpm vitest run --project unit server/lib/crypto.test.ts && pnpm test:integration`
Expected: FAIL. `./crypto` is missing, and `/audit` returns 404.

- [ ] **Step 2: Implement the table, helpers, service and route**

Create `server/db/schema/audit.ts`:

```ts
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { users } from "./auth"

// Who changed what, when (docs/brief.md §6.6). Never store enquiry content.
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    actorEmail: text(),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    summary: text().notNull(),
    diff: jsonb().$type<Record<string, { from: unknown; to: unknown }>>(),
    ipHash: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_created_at_idx").on(table.createdAt.desc()),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ]
)
```

Replace `server/db/schema/index.ts` with:

```ts
export * from "./audit"
export * from "./auth"
export * from "./settings"
```

Create `server/lib/crypto.ts`:

```ts
import "server-only"

import { createHmac } from "node:crypto"

import { getEnv } from "@/server/env"

// Keyed hash: enough to spot repeated abuse, impossible to reverse into an
// address without the server secret (privacy by design, brief §15).
export function hashIp(ip: string) {
  return createHmac("sha256", getEnv().BETTER_AUTH_SECRET)
    .update(ip)
    .digest("hex")
    .slice(0, 32)
}
```

Create `server/lib/audit.ts`:

```ts
import "server-only"

import { getDb, type Db } from "@/server/db/client"
import { auditLogs } from "@/server/db/schema"

import { hashIp } from "./crypto"

export type AuditActor = {
  userId: string
  email?: string | null
  ip?: string | null
  userAgent?: string | null
}

export type AuditEntry = {
  action: string
  entityType: string
  entityId?: string | null
  summary: string
  diff?: Record<string, { from: unknown; to: unknown }> | null
}

export async function audit(
  actor: AuditActor | null,
  entry: AuditEntry,
  db: Db = getDb()
) {
  await db.insert(auditLogs).values({
    actorId: actor?.userId ?? null,
    actorEmail: actor?.email ?? null,
    ipHash: actor?.ip ? hashIp(actor.ip) : null,
    userAgent: actor?.userAgent ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    diff: entry.diff ?? null,
  })
}
```

Create `server/modules/audit/service.ts`:

```ts
import "server-only"

import { count, desc } from "drizzle-orm"

import { getDb } from "@/server/db/client"
import { auditLogs } from "@/server/db/schema"

export async function listAuditEntries({
  page,
  pageSize,
}: {
  page: number
  pageSize: number
}) {
  const db = getDb()
  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(auditLogs),
  ])
  return { items, page, pageSize, total }
}
```

Create `server/modules/audit/routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { listAuditEntries } from "./service"

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const auditRoutes = new Hono<AppEnv>().get(
  "/",
  can({ audit: ["read"] }),
  zValidator("query", ListQuery, validationHook),
  async (c) => c.json(await listAuditEntries(c.req.valid("query")))
)
```

In `server/api/routes/admin.ts`, add `import { auditRoutes } from "@/server/modules/audit/routes"` and append `.route("/audit", auditRoutes)` to the chain, after `.get("/me", …)`.

In `server/auth/auth.ts`, add `import { audit } from "@/server/lib/audit"`, then add this key to the `betterAuth({ … })` options, after `session`:

```ts
    databaseHooks: {
      session: {
        create: {
          // Sign-ins and impersonation starts land in the audit log.
          after: async (created) => {
            const impersonatedBy = (created as { impersonatedBy?: string | null })
              .impersonatedBy
            await audit(
              {
                userId: impersonatedBy ?? created.userId,
                ip: created.ipAddress ?? null,
                userAgent: created.userAgent ?? null,
              },
              impersonatedBy
                ? {
                    action: "auth.impersonate",
                    entityType: "user",
                    entityId: created.userId,
                    summary: "Started a View-as session",
                  }
                : {
                    action: "auth.sign_in",
                    entityType: "user",
                    entityId: created.userId,
                    summary: "Signed in",
                  }
            )
          },
        },
      },
    },
```

- [ ] **Step 3: Generate the migration and run the tests**

Run: `pnpm db:generate --name audit && pnpm db:migrate`
Expected: `0002_audit.sql` creates `audit_logs` and its two indexes.

Run: `pnpm vitest run --project unit server/lib && pnpm test:integration`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server tests/integration/api/audit.test.ts
git commit -m "feat: audit log with sign-in tracking and an admin listing"
```

---

### Task 1.7: Invite users, with owner protection

**Files:**

- Create: `server/modules/users/schema.ts`
- Create: `server/modules/users/service.ts`
- Create: `server/modules/users/routes.ts`
- Modify: `server/api/routes/admin.ts`
- Test: `tests/integration/api/users-invite.test.ts`

**Interfaces:**

- Consumes:
  - `getAuth()`;
  - `audit()`;
  - `can()`, `validationHook` and `ApiError`;
  - `readOutbox()` and `clearOutbox()`, in tests;
  - the `users` table.
- Produces:
  - `InviteInput` (Zod: email lowercased and trimmed, name, role);
  - `inviteUser(actor: Actor, input: InviteInput, headers: Headers)` → `{ id, email, name, role }`;
  - `POST /api/v1/admin/users/invite` → `201`, `400`, `403` or `409`.

- [ ] **Step 1: Write the failing tests**

Create `tests/integration/api/users-invite.test.ts`:

```ts
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import { closeDb } from "@/server/db/client"
import { clearOutbox, readOutbox } from "@/server/lib/email"

import { adminRequest, createUser, signIn } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterEach(clearOutbox)
afterAll(closeDb)

const invite = (cookie: string, body: unknown, origin?: string) =>
  adminRequest("/users/invite", cookie, { method: "POST", body, origin })

describe("POST /api/v1/admin/users/invite", () => {
  it("lets an owner invite an admin and emails a set-password link", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")

    const response = await invite(cookie, {
      email: "  New.Admin@Example.com ",
      name: "Nia",
      role: "admin",
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      email: "new.admin@example.com",
      role: "admin",
    })
    const [message] = readOutbox()
    expect(message.to).toBe("new.admin@example.com")
    expect(message.subject).toBe("You're invited to the Magda Kennedy admin")
    expect(message.text).toContain("/reset-password/")
  })

  it("does not let an admin invite an owner", async () => {
    await createUser("admin")
    const cookie = await signIn("admin@example.com")
    const response = await invite(cookie, { email: "x@example.com", name: "X", role: "owner" })
    expect(response.status).toBe(403)
  })

  it("is forbidden for an editor", async () => {
    await createUser("editor")
    const cookie = await signIn("editor@example.com")
    const response = await invite(cookie, { email: "x@example.com", name: "X", role: "viewer" })
    expect(response.status).toBe(403)
  })

  it("treats emails case-insensitively when checking for duplicates", async () => {
    await createUser("owner")
    await createUser("editor", "editor@example.com")
    const cookie = await signIn("owner@example.com")
    const response = await invite(cookie, {
      email: "Editor@Example.com",
      name: "Dup",
      role: "viewer",
    })
    expect(response.status).toBe(409)
  })

  it("rejects a cross-site request even with a valid session", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")
    const response = await invite(
      cookie,
      { email: "x@example.com", name: "X", role: "viewer" },
      "https://evil.example"
    )
    expect(response.status).toBe(403)
  })

  it("returns field errors for invalid input", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")
    const response = await invite(cookie, { email: "nope", name: "", role: "chief" })
    expect(response.status).toBe(400)
    const { error } = await response.json()
    expect(Object.keys(error.fieldErrors).sort()).toEqual(["email", "name", "role"])
  })
})
```

Run: `pnpm test:integration`
Expected: FAIL, `/users/invite` returns 404.

- [ ] **Step 2: Implement the schema, service and route**

Create `server/modules/users/schema.ts`:

```ts
import * as z from "zod"

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"

export const InviteInput = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter a valid email address" })),
  name: z.string().trim().min(1, "Enter a name").max(120),
  role: z.enum(ROLE_NAMES as [RoleName, ...RoleName[]], {
    error: "Choose a role",
  }),
})

export type InviteInput = z.infer<typeof InviteInput>
```

Create `server/modules/users/service.ts`:

```ts
import "server-only"

import { eq } from "drizzle-orm"

import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getAuth } from "@/server/auth/auth"
import { getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"
import { getEnv } from "@/server/env"
import { audit } from "@/server/lib/audit"

import type { InviteInput } from "./schema"

export function inviteRedirect() {
  return new URL("/admin/reset-password?invite=1", getEnv().SITE_URL).toString()
}

// docs/brief.md §7.4: create the account without a password, then send the
// reset link as an invitation. Only an owner may create another owner.
export async function inviteUser(actor: Actor, input: InviteInput, headers: Headers) {
  if (input.role === "owner" && !actor.roles.includes("owner")) {
    throw new ApiError("FORBIDDEN", "Only an owner can invite another owner")
  }

  const existing = await getDb().query.users.findFirst({
    where: eq(users.email, input.email),
  })
  if (existing) {
    throw new ApiError("CONFLICT", "Someone with that email already has an account")
  }

  const auth = getAuth()
  // Passing the actor's headers makes Better Auth apply RBAC as well.
  const { user } = await auth.api.createUser({
    body: { email: input.email, name: input.name, role: input.role },
    headers,
  })
  await auth.api.requestPasswordReset({
    body: { email: input.email, redirectTo: inviteRedirect() },
  })
  await audit(actor, {
    action: "user.invite",
    entityType: "user",
    entityId: user.id,
    summary: `Invited ${input.email} as ${input.role}`,
  })

  return { id: user.id, email: user.email, name: user.name, role: input.role }
}
```

Create `server/modules/users/routes.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { InviteInput } from "./schema"
import { inviteUser } from "./service"

export const usersRoutes = new Hono<AppEnv>().post(
  "/invite",
  can({ user: ["create"] }),
  zValidator("json", InviteInput, validationHook),
  async (c) => {
    const actor = c.get("actor")!
    const result = await inviteUser(actor, c.req.valid("json"), c.req.raw.headers)
    return c.json(result, 201)
  }
)
```

In `server/api/routes/admin.ts`, add `import { usersRoutes } from "@/server/modules/users/routes"` and append `.route("/users", usersRoutes)` to the chain.

- [ ] **Step 3: Run the tests to verify they pass**

Run: `pnpm test:integration`
Expected: PASS. `users-invite.test.ts` passes all 6 tests.

- [ ] **Step 4: Commit**

```bash
git add server/modules/users server/api/routes/admin.ts tests/integration/api/users-invite.test.ts
git commit -m "feat: invite users by email with owner protection"
```

---

### Task 1.8: Bootstrap the first owner

**Files:**

- Create: `server/modules/users/bootstrap.ts`
- Create: `scripts/admin-create.ts`
- Modify: `package.json`
- Test: `tests/integration/users/bootstrap.test.ts`

**Interfaces:**

- Consumes: `getAuth()`, `inviteRedirect()`, the `users` table.
- Produces:
  - `createOwner({ email, name }): Promise<{ userId: string }>`, which throws if the email exists;
  - the CLI `pnpm admin:create --email <e> --name <n>`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/users/bootstrap.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"
import { clearOutbox, readOutbox } from "@/server/lib/email"
import { createOwner } from "@/server/modules/users/bootstrap"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterEach(clearOutbox)
afterAll(closeDb)

describe("createOwner", () => {
  it("creates an owner without a password and emails the set-password link", async () => {
    await createOwner({ email: "Magda@Example.ie", name: "Magda Kennedy" })

    const user = await getDb().query.users.findFirst({
      where: eq(users.email, "magda@example.ie"),
    })
    expect(user?.role).toBe("owner")
    expect(readOutbox()[0].subject).toBe("You're invited to the Magda Kennedy admin")
  })

  it("refuses to run twice for the same email", async () => {
    await createOwner({ email: "magda@example.ie", name: "Magda" })
    await expect(createOwner({ email: "magda@example.ie", name: "Magda" })).rejects.toThrow(
      /already has an account/
    )
  })
})
```

Run: `pnpm test:integration`
Expected: FAIL, `Failed to resolve import "@/server/modules/users/bootstrap"`.

- [ ] **Step 2: Implement the bootstrap and the CLI**

Create `server/modules/users/bootstrap.ts`:

```ts
import "server-only"

import { eq } from "drizzle-orm"

import { getAuth } from "@/server/auth/auth"
import { getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"

import { inviteRedirect } from "./service"

// The first owner, created from the command line. Server-side createUser
// without headers skips RBAC, which is why it is only ever called here.
export async function createOwner({ email, name }: { email: string; name: string }) {
  const normalized = email.trim().toLowerCase()
  const existing = await getDb().query.users.findFirst({
    where: eq(users.email, normalized),
  })
  if (existing) throw new Error(`${normalized} already has an account`)

  const auth = getAuth()
  const { user } = await auth.api.createUser({
    body: { email: normalized, name, role: "owner" },
  })
  await auth.api.requestPasswordReset({
    body: { email: normalized, redirectTo: inviteRedirect() },
  })
  return { userId: user.id }
}
```

Create `scripts/admin-create.ts`:

```ts
import { parseArgs } from "node:util"

import { closeDb } from "@/server/db/client"
import { createOwner } from "@/server/modules/users/bootstrap"

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" } },
})

if (!values.email || !values.name) {
  console.error('Usage: pnpm admin:create --email you@example.com --name "Your Name"')
  process.exit(1)
}

createOwner({ email: values.email, name: values.name })
  .then(() => {
    console.log(`Owner created. A set-password link was sent to ${values.email}.`)
    console.log("With EMAIL_DRIVER=log the link is printed above.")
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(closeDb)
```

Add to `package.json` `scripts`:

```json
"admin:create": "NODE_OPTIONS=--conditions=react-server dotenv -e .env -- tsx scripts/admin-create.ts"
```

- [ ] **Step 3: Run the tests, then the CLI by hand**

Run: `pnpm test:integration`
Expected: PASS.

Run: `pnpm admin:create --email you@example.com --name "You"`
Expected: `Owner created…`, and the invite email appears in Mailpit at http://localhost:8025.

- [ ] **Step 4: Commit**

```bash
git add server/modules/users/bootstrap.ts scripts/admin-create.ts package.json tests/integration/users
git commit -m "feat: admin:create bootstraps the first owner"
```

---

### Task 1.9: `proxy.ts`, the optimistic admin gate

**Files:**

- Create: `proxy.ts`
- Test: `proxy.test.ts`

**Interfaces:**

- Produces:
  - `proxy(request: NextRequest): NextResponse`;
  - `config.matcher = ["/admin", "/admin/:path*"]`.
- `/api` is deliberately not matched: the proxy buffers request bodies up to 10 MB, and the API authenticates itself.

- [ ] **Step 1: Write the failing test**

Create `proxy.test.ts`:

```ts
import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { proxy } from "./proxy"

const request = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie } : {},
  })

describe("proxy", () => {
  it("sends signed-out visitors to sign-in with a return path", () => {
    const response = proxy(request("/admin/pages?tab=draft"))
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin/sign-in?next=%2Fadmin%2Fpages%3Ftab%3Ddraft"
    )
  })

  it("lets a request with a session cookie through", () => {
    const response = proxy(request("/admin", "mk.session_token=abc"))
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("recognises the production __Secure- cookie", () => {
    const response = proxy(request("/admin", "__Secure-mk.session_token=abc"))
    expect(response.headers.get("location")).toBeNull()
  })

  it("keeps the auth pages public", () => {
    expect(proxy(request("/admin/forgot-password")).headers.get("location")).toBeNull()
    expect(proxy(request("/admin/reset-password?token=t")).headers.get("location")).toBeNull()
  })

  it("moves a signed-in user away from sign-in", () => {
    const response = proxy(request("/admin/sign-in", "mk.session_token=abc"))
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin")
  })

  it("marks every admin response noindex", () => {
    expect(proxy(request("/admin/sign-in")).headers.get("x-robots-tag")).toBe(
      "noindex, nofollow"
    )
  })
})
```

Run: `pnpm vitest run --project unit proxy.test.ts`
Expected: FAIL, `Failed to resolve import "./proxy"`.

- [ ] **Step 2: Implement the proxy**

Create `proxy.ts`:

```ts
import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

// Next 16 guidance: an optimistic cookie check only, never the database.
// Every admin layout, page and API call verifies the session itself.
const PUBLIC_ADMIN_PATHS = [
  "/admin/sign-in",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/two-factor",
]

const isPublic = (pathname: string) =>
  PUBLIC_ADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const signedIn = Boolean(getSessionCookie(request, { cookiePrefix: "mk" }))

  let response: NextResponse
  if (!isPublic(pathname) && !signedIn) {
    const url = new URL("/admin/sign-in", request.url)
    url.searchParams.set("next", `${pathname}${search}`)
    response = NextResponse.redirect(url)
  } else if (pathname === "/admin/sign-in" && signedIn) {
    response = NextResponse.redirect(new URL("/admin", request.url))
  } else {
    response = NextResponse.next()
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow")
  return response
}

export const config = { matcher: ["/admin", "/admin/:path*"] }
```

Note that `/admin/two-factor-setup` (Task 1.11) does *not* match `/admin/two-factor/`, so it stays gated.

- [ ] **Step 3: Run the tests to verify they pass**

Run: `pnpm vitest run --project unit proxy.test.ts`
Expected: PASS, `6 passed`.

- [ ] **Step 4: Commit**

```bash
git add proxy.ts proxy.test.ts
git commit -m "feat: proxy.ts optimistic admin gate with noindex headers"
```

---

### Task 1.10: Admin root layout, sign-in, password reset and the guarded panel

**Files:**

- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/admin.css`
- Modify: `components.json` (`css` → `app/(admin)/admin.css`)
- Create (shadcn): `components/ui/{input,label,card,field,separator,sonner}.tsx`
- Create: `admin/lib/auth-client.ts`
- Create: `lib/auth/safe-next.ts`
- Test: `lib/auth/safe-next.test.ts`
- Create: `app/(admin)/admin/(auth)/layout.tsx`
- Create: `app/(admin)/admin/(auth)/sign-in/page.tsx`
- Create: `app/(admin)/admin/(auth)/forgot-password/page.tsx`
- Create: `app/(admin)/admin/(auth)/reset-password/page.tsx`
- Create: `admin/modules/auth/{sign-in-form,forgot-password-form,reset-password-form,sign-out-button}.tsx`
- Create: `app/(admin)/admin/(panel)/layout.tsx`
- Create: `app/(admin)/admin/(panel)/page.tsx`
- Create: `tests/e2e/fixtures/{env,users}.ts`
- Create: `tests/e2e/global-setup.ts`
- Create: `scripts/e2e-seed.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json`
- Test: `tests/e2e/admin/sign-in.spec.ts`

**Interfaces:**

- Consumes: `requireActor()` from `server/auth/session.ts`, `ac` and `roles`, `/api/auth/*`.
- Produces:
  - `authClient` (better-auth/react with `adminClient` and `twoFactorClient`);
  - `safeNext(next, fallback?)`;
  - the admin root layout (`<html data-theme="admin">`, Plus Jakarta Sans and Geist Mono, `admin.css` with the Evergreen tokens);
  - the routes `/admin/sign-in`, `/admin/forgot-password`, `/admin/reset-password` and `/admin` (panel);
  - the E2E database seeding (`pnpm e2e:seed`).
- Phase 2 replaces the panel placeholder with the full shell.

- [ ] **Step 1: Write the failing redirect-sanitising test**

Create `lib/auth/safe-next.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { safeNext } from "./safe-next"

describe("safeNext", () => {
  it("keeps admin paths", () => {
    expect(safeNext("/admin/pages?tab=draft")).toBe("/admin/pages?tab=draft")
  })

  it("falls back for anything that could leave the admin", () => {
    expect(safeNext("https://evil.example")).toBe("/admin")
    expect(safeNext("//evil.example/admin")).toBe("/admin")
    expect(safeNext("/about")).toBe("/admin")
    expect(safeNext(null)).toBe("/admin")
  })
})
```

Run: `pnpm vitest run --project unit lib/auth/safe-next.test.ts`
Expected: FAIL, `Failed to resolve import "./safe-next"`.

Create `lib/auth/safe-next.ts`:

```ts
// Post-sign-in destinations are limited to admin paths on this origin, so
// ?next= can never become an open redirect.
export function safeNext(next: string | null | undefined, fallback = "/admin") {
  if (!next || next.startsWith("//") || !next.startsWith("/admin")) return fallback
  return next
}
```

Run: `pnpm vitest run --project unit lib/auth/safe-next.test.ts`
Expected: PASS.

- [ ] **Step 2: Create the admin stylesheet and point shadcn at it**

Create `app/(admin)/admin.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

/* "Evergreen" admin tokens (docs/brief.md §9.2). Static for now; Phase 9
   generates them from the theme engine. */
@theme inline {
  --font-sans: var(--font-jakarta);
  --font-mono: var(--font-geist-mono);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root[data-theme="admin"] {
  --radius: 0.75rem;
  --background: #f2f3f2;
  --foreground: #111411;
  --card: #ffffff;
  --card-foreground: #111411;
  --popover: #ffffff;
  --popover-foreground: #111411;
  --primary: #16823a;
  --primary-foreground: #ffffff;
  --secondary: #e9ece9;
  --secondary-foreground: #111411;
  --muted: #eef0ee;
  --muted-foreground: #6b716c;
  --accent: #e6f4eb;
  --accent-foreground: #14532d;
  --destructive: #dc2626;
  --border: #e5e8e5;
  --input: #e5e8e5;
  --ring: #22a055;
  --chart-1: #1e6b35;
  --chart-2: #3f9d5e;
  --chart-3: #6cc08c;
  --chart-4: #2f4f38;
  --chart-5: #a7d9b8;
  --sidebar: #f7f8f7;
  --sidebar-foreground: #111411;
  --sidebar-primary: #16823a;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #e6f4eb;
  --sidebar-accent-foreground: #14532d;
  --sidebar-border: #e5e8e5;
  --sidebar-ring: #22a055;
}

:root[data-theme="admin"].dark {
  --background: #0c100d;
  --foreground: #eef2ee;
  --card: #151c17;
  --card-foreground: #eef2ee;
  --popover: #151c17;
  --popover-foreground: #eef2ee;
  --primary: #34b567;
  --primary-foreground: #06130a;
  --secondary: #1c241e;
  --secondary-foreground: #eef2ee;
  --muted: #1c241e;
  --muted-foreground: #9aa39c;
  --accent: #18301f;
  --accent-foreground: #c9ecd6;
  --destructive: #f87171;
  --border: #243026;
  --input: #243026;
  --ring: #3fcb75;
  --chart-1: #3fcb75;
  --chart-2: #6cc08c;
  --chart-3: #a7d9b8;
  --chart-4: #2f7a45;
  --chart-5: #1f4a2b;
  --sidebar: #111712;
  --sidebar-foreground: #eef2ee;
  --sidebar-primary: #34b567;
  --sidebar-primary-foreground: #06130a;
  --sidebar-accent: #18301f;
  --sidebar-accent-foreground: #c9ecd6;
  --sidebar-border: #243026;
  --sidebar-ring: #3fcb75;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background font-sans text-foreground antialiased;
  }
  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }
}
```

In `components.json`, change `"css": "app/(site)/site.css"` to `"css": "app/(admin)/admin.css"`. New shadcn items are for the admin; the site keeps its existing components.

Run: `pnpm exec shadcn add input label card field separator sonner --yes`
Expected: the files are created in `components/ui/`. If asked about overwriting `button.tsx`, answer **no**.

- [ ] **Step 3: Create the admin root layout and the auth client**

Create `app/(admin)/layout.tsx`:

```tsx
import type { Metadata } from "next"
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"

import "./admin.css"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
})

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: { template: "%s · Admin", default: "Admin" },
  robots: { index: false, follow: false },
}

// Separate root layout: no Lenis, GSAP or site chrome, and its own tokens.
export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IE" data-theme="admin" className={cn(sans.variable, mono.variable)}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

Create `admin/lib/auth-client.ts`:

```ts
import { adminClient, twoFactorClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { ac, roles } from "@/lib/auth/permissions"

// Same origin, so cookies flow automatically and no base URL is needed.
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [adminClient({ ac, roles }), twoFactorClient()],
})
```

- [ ] **Step 4: Build the auth screens**

Create `app/(admin)/admin/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh gap-4 bg-background p-4 lg:grid-cols-2">
      <section
        aria-hidden
        className="relative hidden flex-col justify-between overflow-hidden rounded-3xl bg-[linear-gradient(140deg,#0f3d1f_0%,#16823a_62%,#3f9d5e_100%)] p-10 text-white lg:flex"
      >
        <p className="text-lg font-semibold tracking-tight">Magda Kennedy · Admin</p>
        <p className="max-w-sm text-3xl leading-tight font-semibold">
          Your website, beautifully under control.
        </p>
      </section>
      <section className="flex items-center justify-center py-12">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  )
}
```

Create `admin/modules/auth/sign-in-form.tsx`:

```tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { authClient } from "@/admin/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { safeNext } from "@/lib/auth/safe-next"

export function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const { data, error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    })
    setPending(false)
    // Generic on purpose: never reveal which accounts exist.
    if (error) return setError("That email and password don't match an account.")
    const next = safeNext(params.get("next"))
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      return router.push(`/admin/two-factor?next=${encodeURIComponent(next)}`)
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={error ? true : undefined}
          />
          {error && <FieldError errors={[{ message: error }]} />}
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </FieldGroup>
    </form>
  )
}
```

Create `app/(admin)/admin/(auth)/sign-in/page.tsx`:

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { SignInForm } from "@/admin/modules/auth/sign-in-form"

export const metadata: Metadata = { title: "Sign in" }

export default function SignInPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to manage the website.</p>
      </header>
      {/* useSearchParams needs a Suspense boundary under Cache Components. */}
      <Suspense>
        <SignInForm />
      </Suspense>
      <Link href="/admin/forgot-password" className="text-sm text-primary hover:underline">
        Forgot your password?
      </Link>
    </div>
  )
}
```

Create `admin/modules/auth/forgot-password-form.tsx`:

```tsx
"use client"

import { useState } from "react"

import { authClient } from "@/admin/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    await authClient.requestPasswordReset({
      email: String(new FormData(event.currentTarget).get("email")),
      redirectTo: "/admin/reset-password",
    })
    setPending(false)
    // Same message whether or not the account exists.
    setSent(true)
  }

  if (sent) {
    return (
      <p role="status" className="text-sm">
        If that email has an account, a reset link is on its way.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Button type="submit" disabled={pending}>
          Send reset link
        </Button>
      </FieldGroup>
    </form>
  )
}
```

Create `app/(admin)/admin/(auth)/forgot-password/page.tsx`:

```tsx
import type { Metadata } from "next"

import { ForgotPasswordForm } from "@/admin/modules/auth/forgot-password-form"

export const metadata: Metadata = { title: "Forgot password" }

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground">We'll email you a link to choose a new one.</p>
      </header>
      <ForgotPasswordForm />
    </div>
  )
}
```

Create `admin/modules/auth/reset-password-form.tsx`:

```tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { authClient } from "@/admin/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token")
  const invite = params.get("invite") === "1"
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!token) {
    return <p className="text-sm">This link is incomplete. Ask for a new one.</p>
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password"))
    if (password !== String(form.get("confirm"))) {
      return setError("The two passwords don't match.")
    }
    setPending(true)
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! })
    setPending(false)
    if (error) return setError("This link has expired or was already used. Ask for a new one.")
    router.replace("/admin/sign-in")
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">{invite ? "Choose a password" : "New password"}</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required />
          <FieldDescription>At least 12 characters.</FieldDescription>
        </Field>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="confirm">Repeat password</FieldLabel>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required aria-invalid={error ? true : undefined} />
          {error && <FieldError errors={[{ message: error }]} />}
        </Field>
        <Button type="submit" disabled={pending}>
          {invite ? "Set password" : "Update password"}
        </Button>
      </FieldGroup>
    </form>
  )
}
```

Create `app/(admin)/admin/(auth)/reset-password/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { ResetPasswordForm } from "@/admin/modules/auth/reset-password-form"

export const metadata: Metadata = { title: "Set password" }

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Set your password</h1>
      </header>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
```

Create `admin/modules/auth/sign-out-button.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"

import { authClient } from "@/admin/lib/auth-client"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  const router = useRouter()
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await authClient.signOut()
        router.replace("/admin/sign-in")
      }}
    >
      Sign out
    </Button>
  )
}
```

- [ ] **Step 5: Build the guarded panel**

Create `app/(admin)/admin/(panel)/layout.tsx`:

```tsx
import { Suspense } from "react"

import { requireActor } from "@/server/auth/session"

// The session read is request-time data, so it sits behind Suspense (Cache
// Components). This check is for UX; the API authorises every call itself.
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <Guarded>{children}</Guarded>
    </Suspense>
  )
}

async function Guarded({ children }: { children: React.ReactNode }) {
  await requireActor()
  return <div className="min-h-svh bg-background p-4">{children}</div>
}
```

Create `app/(admin)/admin/(panel)/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { SignOutButton } from "@/admin/modules/auth/sign-out-button"
import { requireActor } from "@/server/auth/session"

export const metadata: Metadata = { title: "Dashboard" }

// Placeholder until the Phase 2 dashboard.
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Welcome />
    </Suspense>
  )
}

async function Welcome() {
  const actor = await requireActor()
  return (
    <section className="flex flex-col items-start gap-4 rounded-2xl bg-card p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome, {actor.name}</h1>
      <p className="text-sm text-muted-foreground">Roles: {actor.roles.join(", ")}</p>
      <SignOutButton />
    </section>
  )
}
```

- [ ] **Step 6: E2E database seeding**

Create `tests/e2e/fixtures/env.ts`:

```ts
// E2E runs `next start` against its own database (created by docker init).
export const E2E_PORT = 3100
export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`

export const E2E_ENV = {
  SITE_URL: E2E_ORIGIN,
  SITE_ENV: "development",
  DATABASE_URL:
    process.env.DATABASE_URL_E2E ?? "postgres://mk:mk@localhost:5432/mk_e2e",
  BETTER_AUTH_URL: E2E_ORIGIN,
  BETTER_AUTH_SECRET: "e2e-secret-0123456789-abcdefghij-klmnopq",
  EMAIL_DRIVER: "log",
  EMAIL_FROM: "Magda Kennedy <hello@example.com>",
}
```

Create `tests/e2e/fixtures/users.ts`:

```ts
export const E2E_USERS = {
  editor: {
    email: "editor@e2e.test",
    password: "e2e-password-editor",
    name: "Eddie Editor",
    role: "editor",
  },
  owner: {
    email: "owner@e2e.test",
    password: "e2e-password-owner",
    name: "Olive Owner",
    role: "owner",
  },
} as const
```

Create `scripts/e2e-seed.ts`:

```ts
import { sql } from "drizzle-orm"

import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { runMigrations } from "@/server/db/migrate"
import { E2E_USERS } from "@/tests/e2e/fixtures/users"

// Fresh, migrated E2E database with one user per scenario.
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required")
  await runMigrations(url)
  const db = getDb()
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`
  )
  if (rows.length > 0) {
    const tables = rows.map((row) => `"public"."${row.tablename}"`).join(", ")
    await db.execute(sql.raw(`truncate table ${tables} restart identity cascade`))
  }
  for (const user of Object.values(E2E_USERS)) {
    await getAuth().api.createUser({ body: { ...user } })
  }
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(closeDb)
```

Create `tests/e2e/global-setup.ts`:

```ts
import { execSync } from "node:child_process"

import { E2E_ENV } from "./fixtures/env"

export default function globalSetup() {
  execSync("pnpm e2e:seed", { stdio: "inherit", env: { ...process.env, ...E2E_ENV } })
}
```

In `playwright.config.ts`:

- add the import `import { E2E_ENV, E2E_PORT } from "./tests/e2e/fixtures/env"`;
- replace `const PORT = 3100` with `const PORT = E2E_PORT`;
- add `globalSetup: "./tests/e2e/global-setup.ts",` after `testDir`;
- add `env: E2E_ENV,` inside `webServer`.

Add to `package.json` `scripts`:

```json
"e2e:seed": "NODE_OPTIONS=--conditions=react-server tsx scripts/e2e-seed.ts"
```

From this task on, every E2E run (including `test:parity`) needs `pnpm db:up` first.

- [ ] **Step 7: Write the E2E test and run it**

Create `tests/e2e/admin/sign-in.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test"

import { E2E_USERS } from "../fixtures/users"

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Password").fill(user.password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

test("a signed-out visit to /admin goes through sign-in and back", async ({ page }) => {
  await page.goto("/admin")
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/)
  await signIn(page, E2E_USERS.editor)
  await expect(page).toHaveURL(/\/admin$/)
  await expect(
    page.getByRole("heading", { name: `Welcome, ${E2E_USERS.editor.name}` })
  ).toBeVisible()
})

test("a wrong password shows a generic error", async ({ page }) => {
  await page.goto("/admin/sign-in")
  await signIn(page, { email: E2E_USERS.editor.email, password: "not-the-password" })
  await expect(
    page.getByText("That email and password don't match an account.")
  ).toBeVisible()
})

test("signing out returns to sign-in and the panel is gated again", async ({ page }) => {
  await page.goto("/admin/sign-in")
  await signIn(page, E2E_USERS.editor)
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/admin\/sign-in/)
  await page.goto("/admin")
  await expect(page).toHaveURL(/\/admin\/sign-in/)
})
```

Run: `pnpm db:up && pnpm test:e2e tests/e2e/admin --project desktop`
Expected: PASS, `3 passed`.

- [ ] **Step 8: Full check and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:parity`
Expected: exit 0, and parity still `21 passed` (the site is untouched).

```bash
git add app/\(admin\) admin components/ui components.json lib/auth tests/e2e scripts/e2e-seed.ts playwright.config.ts package.json pnpm-lock.yaml
git commit -m "feat: admin root layout, sign-in, password reset and guarded panel"
```

---

### Task 1.11: Two-factor authentication, mandatory for owners and admins

**Files:**

- Create: `lib/auth/two-factor-policy.ts`
- Test: `lib/auth/two-factor-policy.test.ts`
- Create: `admin/modules/auth/two-factor-form.tsx`
- Create: `admin/modules/auth/two-factor-setup.tsx`
- Create: `app/(admin)/admin/(auth)/two-factor/page.tsx`
- Create: `app/(admin)/admin/(auth)/two-factor-setup/page.tsx`
- Modify: `app/(admin)/admin/(panel)/layout.tsx`
- Test: `tests/e2e/admin/two-factor.spec.ts`

**Interfaces:**

- Consumes: `authClient.twoFactor.*`, `requireActor()` (with `actor.twoFactorEnabled`), `safeNext`.
- Produces:
  - `roleRequiresTwoFactor(roles: readonly RoleName[]): boolean`;
  - `mustSetUpTwoFactor(actor: { roles: readonly RoleName[]; twoFactorEnabled: boolean }): boolean`;
  - the routes `/admin/two-factor` (second sign-in step) and `/admin/two-factor-setup`.

- [ ] **Step 1: Write the failing policy test**

Create `lib/auth/two-factor-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { mustSetUpTwoFactor, roleRequiresTwoFactor } from "./two-factor-policy"

describe("two-factor policy (brief §7.4)", () => {
  it("requires two-factor for owners and admins only", () => {
    expect(roleRequiresTwoFactor(["owner"])).toBe(true)
    expect(roleRequiresTwoFactor(["editor", "admin"])).toBe(true)
    expect(roleRequiresTwoFactor(["editor", "marketer"])).toBe(false)
  })

  it("sends privileged users without two-factor to setup", () => {
    expect(mustSetUpTwoFactor({ roles: ["owner"], twoFactorEnabled: false })).toBe(true)
    expect(mustSetUpTwoFactor({ roles: ["owner"], twoFactorEnabled: true })).toBe(false)
    expect(mustSetUpTwoFactor({ roles: ["intake"], twoFactorEnabled: false })).toBe(false)
  })
})
```

Run: `pnpm vitest run --project unit lib/auth/two-factor-policy.test.ts`
Expected: FAIL, `Failed to resolve import "./two-factor-policy"`.

Create `lib/auth/two-factor-policy.ts`:

```ts
import type { RoleName } from "./permissions"

// Roles that can change who has access, or run custom code, must use 2FA.
const REQUIRED: readonly RoleName[] = ["owner", "admin"]

export const roleRequiresTwoFactor = (roles: readonly RoleName[]) =>
  roles.some((role) => REQUIRED.includes(role))

export const mustSetUpTwoFactor = (actor: {
  roles: readonly RoleName[]
  twoFactorEnabled: boolean
}) => roleRequiresTwoFactor(actor.roles) && !actor.twoFactorEnabled
```

Run: `pnpm vitest run --project unit lib/auth/two-factor-policy.test.ts`
Expected: PASS.

- [ ] **Step 2: Install the QR and TOTP libraries**

```bash
pnpm add qrcode
pnpm add -D @types/qrcode otpauth
```

- [ ] **Step 3: Build the setup and verification screens**

Create `admin/modules/auth/two-factor-setup.tsx`:

```tsx
"use client"

import QRCode from "qrcode"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { authClient } from "@/admin/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Step = "password" | "scan" | "codes"

export function TwoFactorSetup() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("password")
  const [secret, setSecret] = useState("")
  const [qr, setQr] = useState("")
  const [codes, setCodes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  async function enable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const password = String(new FormData(event.currentTarget).get("password"))
    const { data, error } = await authClient.twoFactor.enable({ password })
    if (error || !data) return setError("That password is not correct.")
    setSecret(new URL(data.totpURI).searchParams.get("secret") ?? "")
    setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 192 }))
    setCodes(data.backupCodes)
    setStep("scan")
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const code = String(new FormData(event.currentTarget).get("code"))
    const { error } = await authClient.twoFactor.verifyTotp({ code })
    if (error) return setError("That code didn't work. Check your phone's clock and try again.")
    setStep("codes")
  }

  if (step === "password") {
    return (
      <form onSubmit={enable} noValidate>
        <FieldGroup>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="password">Current password</FieldLabel>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
            {error && <FieldError errors={[{ message: error }]} />}
          </Field>
          <Button type="submit">Continue</Button>
        </FieldGroup>
      </form>
    )
  }

  if (step === "scan") {
    return (
      <form onSubmit={verify} noValidate className="flex flex-col gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
        <img src={qr} alt="QR code for your authenticator app" width={192} height={192} className="rounded-xl bg-white p-2" />
        <p className="text-sm text-muted-foreground">
          Can't scan? Enter this key instead:{" "}
          <code data-testid="totp-secret" className="font-mono text-foreground">
            {secret}
          </code>
        </p>
        <FieldGroup>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="code">6-digit code</FieldLabel>
            <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required />
            <FieldDescription>From your authenticator app.</FieldDescription>
            {error && <FieldError errors={[{ message: error }]} />}
          </Field>
          <Button type="submit">Verify</Button>
        </FieldGroup>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Save your backup codes</h2>
      <p className="text-sm text-muted-foreground">
        Each code works once if you lose your phone. Store them somewhere safe.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <Button
        onClick={() => {
          router.replace("/admin")
          router.refresh()
        }}
      >
        I've saved them
      </Button>
    </div>
  )
}
```

Create `app/(admin)/admin/(auth)/two-factor-setup/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { TwoFactorSetup } from "@/admin/modules/auth/two-factor-setup"
import { requireActor } from "@/server/auth/session"

export const metadata: Metadata = { title: "Set up two-factor" }

export default function TwoFactorSetupPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Protect your account</h1>
        <p className="text-sm text-muted-foreground">
          Your role can change who has access, so two-factor authentication is required.
        </p>
      </header>
      <Suspense fallback={null}>
        <Gate />
      </Suspense>
    </div>
  )
}

// Signed in, but deliberately not behind the panel's 2FA enforcement.
async function Gate() {
  await requireActor("/admin/two-factor-setup")
  return <TwoFactorSetup />
}
```

Create `admin/modules/auth/two-factor-form.tsx`:

```tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { authClient } from "@/admin/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { safeNext } from "@/lib/auth/safe-next"

export function TwoFactorForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [backup, setBackup] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const code = String(form.get("code")).trim()
    const trustDevice = form.get("trust") === "on"
    const { error } = backup
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice })
    if (error) return setError("That code didn't work. Try again.")
    router.replace(safeNext(params.get("next")))
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="code">{backup ? "Backup code" : "6-digit code"}</FieldLabel>
          <Input id="code" name="code" autoComplete="one-time-code" required autoFocus />
          {error && <FieldError errors={[{ message: error }]} />}
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="trust" name="trust" />
          <FieldLabel htmlFor="trust">Trust this device for 30 days</FieldLabel>
        </Field>
        <Button type="submit">Verify</Button>
        <Button type="button" variant="link" onClick={() => setBackup((value) => !value)}>
          {backup ? "Use your authenticator app" : "Use a backup code"}
        </Button>
      </FieldGroup>
    </form>
  )
}
```

Run: `pnpm exec shadcn add checkbox --yes`

Create `app/(admin)/admin/(auth)/two-factor/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { TwoFactorForm } from "@/admin/modules/auth/two-factor-form"

export const metadata: Metadata = { title: "Two-factor" }

export default function TwoFactorPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Check your authenticator</h1>
        <p className="text-sm text-muted-foreground">Enter the code from your app to finish signing in.</p>
      </header>
      <Suspense>
        <TwoFactorForm />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 4: Enforce setup in the panel**

In `app/(admin)/admin/(panel)/layout.tsx`, add the imports `import { redirect } from "next/navigation"` and `import { mustSetUpTwoFactor } from "@/lib/auth/two-factor-policy"`, then replace the body of `Guarded` with:

```tsx
  const actor = await requireActor()
  if (mustSetUpTwoFactor(actor)) redirect("/admin/two-factor-setup")
  return <div className="min-h-svh bg-background p-4">{children}</div>
```

- [ ] **Step 5: Write the E2E test and run it**

Create `tests/e2e/admin/two-factor.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test"
import { TOTP } from "otpauth"

import { E2E_USERS } from "../fixtures/users"

async function signIn(page: Page) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(E2E_USERS.owner.email)
  await page.getByLabel("Password").fill(E2E_USERS.owner.password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

test("an owner must set up two-factor, then signs in with a code", async ({ page }) => {
  await signIn(page)
  await expect(page).toHaveURL(/\/admin\/two-factor-setup$/)

  await page.getByLabel("Current password").fill(E2E_USERS.owner.password)
  await page.getByRole("button", { name: "Continue" }).click()
  const secret = (await page.getByTestId("totp-secret").textContent())?.trim() ?? ""
  const totp = new TOTP({ secret, digits: 6, period: 30 })

  await page.getByLabel("6-digit code").fill(totp.generate())
  await page.getByRole("button", { name: "Verify" }).click()
  await expect(page.getByRole("heading", { name: "Save your backup codes" })).toBeVisible()
  await page.getByRole("button", { name: "I've saved them" }).click()
  await expect(page).toHaveURL(/\/admin$/)

  await page.getByRole("button", { name: "Sign out" }).click()
  await signIn(page)
  await expect(page).toHaveURL(/\/admin\/two-factor/)
  // Next period's code: valid within the verification window and never a
  // replay of the code used during setup.
  await page.getByLabel("6-digit code").fill(totp.generate({ timestamp: Date.now() + 30_000 }))
  await page.getByRole("button", { name: "Verify" }).click()
  await expect(page).toHaveURL(/\/admin$/)
})
```

Run: `pnpm test:e2e tests/e2e/admin --project desktop`
Expected: PASS, `4 passed`. The editor tests from Task 1.10 still pass because editors are not forced into 2FA.

- [ ] **Step 6: Commit**

```bash
git add lib/auth admin app/\(admin\) components/ui tests/e2e/admin/two-factor.spec.ts package.json pnpm-lock.yaml
git commit -m "feat: two-factor authentication, mandatory for owners and admins"
```

---

### Task 1.12: Container that migrates on boot and reports health

**Files:**

- Modify: `Dockerfile`
- Create: `docker-entrypoint.sh`
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `.env.example`

**Interfaces:**

- Consumes: `scripts/migrate.ts` and `runMigrations` (Task 0.6), `/api/v1/health` (Task 1.4).
- Produces:
  - `pnpm build:migrate` → `dist/migrate.cjs`;
  - an image that runs `node migrate.cjs && exec node server.js`;
  - a Docker `HEALTHCHECK`.

- [ ] **Step 1: Bundle the migrator**

```bash
pnpm add -D esbuild
```

In `pnpm-workspace.yaml`, add `esbuild: true` under `allowBuilds:`.

Add to `package.json` `scripts`:

```json
"build:migrate": "esbuild scripts/migrate.ts --bundle --platform=node --target=node22 --format=cjs --outfile=dist/migrate.cjs"
```

Run: `pnpm build:migrate && DATABASE_URL=postgres://mk:mk@localhost:5432/mk_dev node dist/migrate.cjs`
Expected: `[migrate] database is up to date`.

- [ ] **Step 2: Update the image**

Replace `Dockerfile` with:

```dockerfile
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
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No secrets and no database at build: env and auth are read lazily at runtime.
RUN pnpm build && pnpm build:migrate

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migrations run at boot, before the server accepts traffic.
COPY --from=builder --chown=nextjs:nodejs /app/dist/migrate.cjs ./migrate.cjs
COPY --from=builder --chown=nextjs:nodejs /app/server/db/migrations ./server/db/migrations
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health > /dev/null || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
```

Create `docker-entrypoint.sh`:

```sh
#!/bin/sh
set -e
# Apply pending migrations (advisory-locked), then hand PID 1 to the server.
node migrate.cjs
exec node server.js
```

Run: `chmod +x docker-entrypoint.sh`

Append to `.env.example`:

```bash
# Docker/Dokploy: the container reads all of the above at runtime.
# Required in production: SITE_URL, SITE_ENV, DATABASE_URL, BETTER_AUTH_SECRET,
# BETTER_AUTH_URL, EMAIL_DRIVER, SMTP_URL (until Phase 6), EMAIL_FROM.
```

- [ ] **Step 3: Build and run the image locally**

```bash
docker build -t mk-platform .
docker run --rm -p 3000:3000 \
  -e SITE_URL=http://localhost:3000 -e SITE_ENV=development \
  -e DATABASE_URL=postgres://mk:mk@host.docker.internal:5432/mk_dev \
  -e BETTER_AUTH_URL=http://localhost:3000 \
  -e BETTER_AUTH_SECRET=local-docker-secret-0123456789-abcdefgh \
  -e EMAIL_DRIVER=log -e EMAIL_FROM="Magda Kennedy <hello@localhost>" \
  mk-platform
```

Expected:

- the logs show `[migrate] database is up to date`, then the Next.js ready line;
- `curl -s http://localhost:3000/api/v1/health` prints `{"status":"ok","db":"ok"}`;
- http://localhost:3000 renders the site;
- http://localhost:3000/admin redirects to sign-in.

- [ ] **Step 4: Staging on Dokploy (one-time, manual)**

1. Create a PostgreSQL 17 service and copy its internal connection URL.
2. Create an application from this repo, with branch `feat/platform` and build type Dockerfile.
3. Set the environment variables listed in `.env.example`, using `SITE_ENV=staging` and a new 48-character `BETTER_AUTH_SECRET`.
4. Set the health check path to `/api/v1/health`, and attach the staging domain.
5. Deploy, then run `pnpm admin:create` once against the staging `DATABASE_URL` from your machine (or with the container shell's `node`) to create the owner.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-entrypoint.sh package.json pnpm-lock.yaml pnpm-workspace.yaml .env.example
git commit -m "build: migrate on boot, health check, bundled migrator"
```

---

## Phases 2–11: scope and acceptance criteria

Each phase below becomes its own step-level plan (`docs/plans/phase-NN-*.md`), written with `superpowers:writing-plans` once the previous phase is merged. Those plans must cover every listed task, keep the Global Constraints, and prove every acceptance criterion with a test where one is automatable.

### Phase 2: Admin shell and design system

**Goal:** the Evergreen admin experience (§9), so the client sees the finished frame early.

1. **Tokens and typography.**
   - Complete the `admin.css` light and dark tokens.
   - Add a hatch utility and the soft status tokens (`--success`, `--warning`, `--danger`, plus `-soft` variants).
   - Scope Tailwind sources with `@source not`: site CSS ignores `admin/**`, admin CSS ignores `features/**`.
   - Add a `next-themes` provider in the admin (system default) and remove `ThemeHotkey` from `components/theme-provider.tsx`.
2. **shadcn base-nova components:**
   sidebar, avatar, badge, breadcrumb, button-group, chart, command, dialog, dropdown-menu, empty, item, kbd, popover, scroll-area, select, sheet, skeleton, spinner, switch, table, tabs, textarea, toggle-group, tooltip, input-group, radio-group.
3. **Shell** (`admin/components/shell/*`):
   - a permission-filtered sidebar following §9.1, with the active-bar indicator, badge slot, "Your website" promo card and a mobile sheet;
   - persisted sidebar state;
   - a topbar with the ⌘K search pill, icon buttons and a user menu with theme switch and sign-out;
   - `AdminActorProvider`, which receives the `/me` payload from the guarded layout, plus a `usePermission()` hook;
   - `requirePermission(permissions)` in the data-access layer (`server/auth/session.ts`), so pages can gate on the server with a "no access" screen, in line with brief §7.3.
4. **⌘K command palette.** A navigation and actions registry, plus `GET /api/v1/admin/search` returning navigation hits. Later phases add content sources.
5. **Data layer:**
   - TanStack Query provider (`getQueryClient`, `queryClient.query()` for prefetch);
   - typed `hc` clients per sub-app;
   - a query-key factory;
   - `parseResponse` → `ApiError`;
   - nuqs-backed table state.
6. **Dashboard primitives:** PageHeader, KpiCard (hero gradient and default), PillBarChart (Recharts 3: `radius={999}`, SVG-pattern hatching, value tag), Gauge (semicircle `RadialBarChart`, segments, legend), StatusPill, ActivityFeed, EmptyState, skeletons. Also an owner-only `/admin/design` showcase page for client demos and visual tests.
7. **Dashboard v1, with data that exists in Phase 2.** `GET /api/v1/admin/dashboard` returns:
   - active users;
   - sign-ins this week vs last week (pill chart);
   - 2FA coverage (gauge: "Security health");
   - recent activity;
   - a setup checklist ("Next up").
   Phase 11 adds the enquiry and content KPIs.
8. **DataTable** (TanStack Table v9 `useTable` + `tableFeatures`, URL state through nuqs) and the `/admin/activity` page over the audit API, with actor, action and date filters.
9. **SchemaForm foundation:**
   - a Zod UI registry → `z.toJSONSchema(schema, { io: "input", override })` → widgets (text, textarea with counter, number, toggle, select, sortable list, group);
   - validation with `zodResolver` on the same schema;
   - an Account page (profile, password change, sessions list with revoke) built with it.
10. **Visual QA.** Playwright screenshots of the shell and dashboard (light and dark × 3 viewports), plus axe checks.

**Acceptance:**

- side-by-side review against the inspiration image signed off;
- full keyboard navigation;
- axe reports no serious or critical violations;
- dark mode complete;
- per-role navigation visibility proven by E2E (intake sees only Dashboard and Enquiries; viewer has no edit actions);
- Lighthouse accessibility ≥ 95 on `/admin`.

### Phase 3: Content platform (database-driven site)

**Goal:** the public site renders entirely from PostgreSQL and is visually identical to the Phase 0 baseline (§5.6, §5.7, §6, §10.3).

1. **Media.** The `media` table, the `static` driver, sharp metadata (width, height, blur, dominant colour), and `<MediaImage>` (next/image with blur and focal-point `object-position`).
2. **Block registry** (`blocks/`). `defineBlock`, the `BlockInstance` schema and the 22 block schemas with item-count and length limits (§6.2). Fixture-validation tests.
3. **Collections.**
   - Tables, repos and cached queries for services, plans, testimonials, faqs, process_steps, cta_bands, articles (published columns + `draft` JSONB + generated `tsvector` with a GIN index), article_categories and authors.
   - `server/lib/cache.ts` (tag constants and `invalidate()` → `revalidateTag(tag, { expire: 0 })`).
4. **Pages and settings.**
   - The `pages` and `revisions` tables.
   - `getPublishedPage(path)` and the routes map.
   - Zod schemas and seeds for every global in §6.4.
   - `getSetting(key)`, using cached queries that read draft documents in draft mode.
5. **Seed (`pnpm db:seed`, idempotent).**
   - Move the fixtures out of `features/*/data`.
   - Register the media.
   - Convert article bodies to TipTap JSON (unit-tested: the first paragraph becomes the lead, the "bold up to `. `" list rule becomes real bold marks).
   - Create the six system pages and three flagged legal pages, mirroring today's ids, chapters and numeric tints.
   - Write the globals.
6. **`SiteFrame`.**
   - Suspense + `io()`, the theme `<style>`, and header and footer from the globals.
   - The root `generateMetadata` (`metadataBase`, title template).
   - `htmlLimitedBots: /.*/` and `cacheMaxMemorySize: 128 MB`.
7. **Props-driven sections**, one task per feature group: hero/credibility/about, how-it-works/testimonials/enterprise/faq, about-page, services/plans, insights/article, contact/clinic, header/footer.
   - No component imports `features/*/data` any more.
   - Client components receive data as props: contact params are built from props, the insights browser gets summaries only, `StepsStory` takes a `count`.
   - React keys come from ids.
8. **Routing.** `BlockRenderer` (StackCard grouping, derived JourneyRail chapters, `<main data-page-root>` + `<PageMotion />`) and `CmsPage`. `app/(site)/[...slug]` plus the home and insights entry points. The article template reads from the database. `notFound()` covers unknown paths; the redirect lookup arrives in Phase 7.
9. **Robustness (§5.7):**
   - `StepsStory` beats and spacer are derived from the item count;
   - dividers move to CSS;
   - testimonials split into columns automatically;
   - `FitSection` accepts lists of unequal length;
   - count-up supports decimals, prefix and suffix;
   - a failsafe reveal animation.
10. **Tokenise the site (§10.3).**
    - Semantic colour tokens.
    - An icon registry of inline SVG components using `currentColor`.
    - Numeric tints; `#315d44` mapped to a token.
    - Trimmed font preloads: drop Geist Mono, and set `preload: false` on rarely used families.
11. **Verification:**
    - parity 21/21;
    - the no-database build in CI;
    - the navigation E2E suite;
    - warm-cache TTFB under 200 ms locally;
    - delete `features/*/data`.

**Acceptance:**

- parity ≤ 0.1% on every route and viewport;
- no content literals left in `features/**/components` (a CI grep check against the fixtures' strings);
- running `pnpm db:seed` twice leaves identical row counts;
- the build passes with no database;
- motion QA checklist signed off.

### Phase 4: Content editing

1. **Pages API and service** (§8.3): list, get, draft `PATCH` with `version`, publish, discard, revisions, restore, `seo` `PATCH`, and custom page create/delete. Integration tests cover RBAC, the 409 conflict, revision snapshots and invalidation.
2. **Preview.** Enable and exit draft mode (validated internal paths only), and show a preview bar on the site.
3. **SchemaForm widgets:** media picker, link (internal page + anchor picker), icon picker, stat, mini rich text, collection picker, colour, character counters, limit hints.
4. **Page builder** (§9.3):
   - a dnd-kit outline with an add-block library;
   - the block form pane;
   - a live preview iframe with desktop, tablet and phone sizes, refreshed on autosave;
   - a toolbar with status, "Saved n s ago", Publish, Discard and a History drawer;
   - a basic SEO tab.
5. **Collections.** A generic API driven by the collection registry (`/admin/collections/:name`, with `order`), and its UI: sortable tables, drawer forms, visibility toggles and "used on" hints.
6. **Globals editors** for every key in §6.4 (structured opening hours included), with revisions and rollback, each behind its per-key permission.
7. **Media library** (§14):
   - multipart upload through Hono (20 MB) → sharp (orient, **strip EXIF/GPS**, downscale above 4000 px, blur, dominant colour) → content-hashed key → `local` or `s3` driver;
   - the `s3` driver targets the R2 EU endpoint `https://<account>.eu.r2.cloudflarestorage.com` with `requestChecksumCalculation: "WHEN_REQUIRED"`;
   - grid with search and filters, a details drawer (alt, caption, focal point), replace that keeps the id, a usage scan with delete guard, and a step-frame cropper (react-easy-crop).

**Acceptance (E2E):**

- edit the hero → preview shows the draft → publish → the public page updates on the next request;
- an author gets 403 on publish;
- concurrent edits produce the 409 dialog;
- a 15 MB JPEG with GPS EXIF uploads, and the stored file has no GPS tags.

### Phase 5: Insights

1. **Articles API and service:** CRUD, publish, schedule, unpublish, archive, revisions, author ownership and "submit for review". A slug change creates a 301.
2. **TipTap 3 editor** (StarterKit, Image from the library, Link, Placeholder, bubble menu, live reading time). Server rendering through `@tiptap/static-renderer/pm/react`, mapped to the site's typography (lead paragraph, clay blockquote, lists), with fixture render tests.
3. **Categories, authors and the article template.** The insights browser is fed summaries from the database. Related articles come by category. The featured flag allows a single article.
4. **Scheduler.** `instrumentation.ts` ticks every 60 s → `POST /api/v1/cron/tick` (`CRON_SECRET`) → advisory lock → publish due articles → invalidate. Integration test with a controlled clock.
5. **Search.** Postgres full-text (`websearch_to_tsquery`) for the admin list and ⌘K.

**Acceptance:**

- an article scheduled 2 minutes ahead appears after the tick;
- an author cannot publish;
- the old URL 301s to the new one after a rename;
- the article page matches its Phase 0 parity baseline.

### Phase 6: Enquiries, forms and email

1. **Tables and the public endpoint.** `leads`, `lead_activities` and `api_rate_limits`. `POST /api/v1/public/leads` runs these checks:
   - the shared Zod schema;
   - a honeypot;
   - an HMAC-signed render timestamp (at least 3 s before submit);
   - a Postgres fixed-window rate limit on the hashed IP and on the email;
   - optional Turnstile (`siteverify` with `action` and `hostname` checks; Cloudflare test keys in tests).
2. **Contact form wiring.** Field errors from the API, the success state, an `event_id` for tracking, and prefill from props.
3. **Email v2.**
   - React Email 6 (`react-email` package) templates: invite, reset, new enquiry (no message by default), auto-reply, newsletter confirmation, delivery failure. An `email:dev` preview.
   - The Resend 6 driver (`{ data, error }` result handling, idempotency keys).
   - Mailpit pinned to `axllent/mailpit:v1.31.4`.
4. **Enquiries admin.** Kanban and table views, a detail drawer (message, mailto/tel, consent record, source and UTM, a notes and status timeline, assignee), CSV export (`lead.export`), GDPR erase, a spam folder, and the sidebar badge.
5. **Newsletter.** Double opt-in (hashed token), confirm and unsubscribe endpoints and pages, the band wiring, and the admin list with export and delete.
6. **Retention.** A purge in the cron tick (closed and spam leads) and DSAR export/erase by email.

**Acceptance (E2E):**

- a form submission appears in the inbox;
- the Mailpit notification has no message body;
- a honeypot submission returns success but is stored as spam;
- the 6th submission within 10 minutes gets 429.

### Phase 7: SEO center

1. **Metadata.** `buildMetadata` and gated `generateMetadata` on every route; the canonical policy; verification codes.
2. **`sitemap.ts`, `robots.ts` and `manifest.ts`.** A non-production `SITE_ENV` disallows everything.
3. **OG images** for pages and articles, using committed TTF fonts and the theme colours.
4. **JSON-LD builders** (`schema-dts`): WebSite + SearchAction, ProfessionalService/LocalBusiness (hours, geo), Person, BreadcrumbList, BlogPosting, Service + Offer and FAQPage, with tests for `<` escaping.
5. **SEO panels** in the page and article editors (SERP preview, social card, counters), and the SEO defaults UI.
6. **Health score.** A service that runs the §11 checks, plus the SEO center: gauge, issues with deep links, alt coverage.
7. **Redirects.** CRUD, a resolver in `[...slug]` through a cached map, hit counting with `after()`, automatic creation on slug change, and a warning when a source path is a live page.

**Acceptance:**

- Rich Results Test passes for the home and article pages;
- Lighthouse SEO 100 on the 5 key pages;
- a test asserts unique titles across the sitemap;
- the staging robots file disallows everything.

### Phase 8: Marketing and tracking (consent-first)

1. **Consent.**
   - Cookie `mk_consent` (`{ id, v, ts, a, m }`, 180 days, `Secure; SameSite=Lax`, readable by the bootstrap script), re-prompted when the revision changes.
   - A site-styled banner with Accept all / Reject all / Customise, all with **equal prominence on the first layer**.
   - A footer "Cookie settings" link.
   - An append-only `consent_events` log (`POST /api/v1/public/consent`, no raw IP).
   - Withdrawing clears `_ga*`, `_gcl_*`, `_fbp` and `_fbc`.
2. **Tracking bootstrap.** One server-rendered inline script at the top of `SiteFrame`:
   - Consent Mode v2 defaults, globally denied, with `ads_data_redaction: true` and no `url_passthrough` (it clashes with nuqs);
   - the stored-choice update;
   - `__loadGtm()`. This is **Basic consent mode**: GTM never loads before consent.
   - IDs are regex-validated (`^GTM-[A-Z0-9]+$`, `^G-[A-Z0-9]+$`, `^\d{10,20}$`) and passed through `JSON.stringify`.
3. **Client tracking.**
   - `RouteTracker` pushes `virtual_page_view` on pathname change. It is nuqs-safe; GTM History Change triggers would also fire on `replaceState`.
   - A typed `track()` with namespaced `event_params` (cleared before each push) and an `event_id`.
   - Instrumentation for `generate_lead`, `contact_click`, `book_appointment`, `sign_up` (newsletter) and `share`.
   - A URL sanitiser that strips query and hash and collapses article slugs for ad platforms.
4. **Meta Pixel and CAPI.**
   - The Pixel loads **only after marketing consent**, with `autoConfig` off, manual PageView, a route allowlist, standard events only and `eventID` deduplication.
   - CAPI posts to `https://graph.facebook.com/v26.0/<pixel>/events` inside `after()`, only when consent is still granted (re-checked on the server).
   - By default `user_data` = `fbp`, `fbc`, hashed lead id (`external_id`), IP and user agent. **No email or phone hashes** unless the owner enables "enhanced matching" after a legal acknowledgement (GDPR Art. 9, CJEU C-21/23).
   - The token is encrypted (AES-256-GCM with `APP_ENCRYPTION_KEY`); there is a test-event button.
5. **Admin screens.**
   - Tracking settings with format validation and status.
   - A consent-banner editor with live preview.
   - The custom-code manager: owner-only, structured entries (`placement`, `src` (https, allowlisted host) or inline, consent category, routes, enabled), injected with `next/script`, with a `DISABLE_CUSTOM_SCRIPTS` kill switch.
   - An event catalogue page.
   - `docs/gtm-container.json`, an importable workspace: GA4 Google tag with `send_page_view: false`, GA4 events, Meta tags requiring additional consent.
6. **Headers and property settings.**
   - An allowlist CSP plus security headers in `next.config` `headers()`, Report-Only first. Nonce CSP is rejected because it requires fully dynamic rendering and is incompatible with Partial Prerendering.
   - A setup note for the GA4 property: Google signals and ads personalisation off. Mental-health counselling is a Google Ads sensitive category, so there is no remarketing.

**Acceptance (E2E with network assertions):**

- no request to `googletagmanager.com` or `connect.facebook.net` before consent;
- Accept loads GTM; Reject loads nothing;
- withdrawal deletes the cookies;
- a unit test proves the default CAPI payload has no email, phone or condition-revealing URL.

### Phase 9: Appearance (theme customisation)

1. **Theme engine** (`lib/theme`, culori 4): OKLCH normalisation and gamut mapping, 11-step scales, `onColor`, WCAG contrast, the six presets. Unit tests cover the contrast guarantees and preset snapshots.
2. **Delivery.** `settings.theme` draft and published. `SiteFrame` and `AdminFrame` emit `<style>` built from the validated config. Draft mode uses the draft theme, and the Appearance page previews live.
3. **Appearance UI:**
   - preset gallery;
   - pickers (react-colorful + OKLCH readout) with AA/AAA badges and "fix automatically";
   - radius control;
   - a live preview canvas with real site and admin components;
   - publish, reset and revisions;
   - logo and favicon (wired into the manifest and `icons`).

**Acceptance:**

- change the brand colour → preview → publish → the site's CSS variables change on the next request;
- failing contrast blocks publishing with an explanation;
- parity is unchanged while the theme is the Teal Sage default.

### Phase 10: Users, roles and security

1. **Users admin:**
   - list (role badges, 2FA status, last active) and an invite dialog (Task 1.7 API);
   - role change, ban/unban, revoke sessions;
   - delete, respecting owner invariants and protecting the last owner;
   - **View as** (impersonation banner + audit entry).
2. **A read-only permission matrix page**, generated from `roles`.
3. **Activity log polish:** field diff viewer, filters, CSV export.
4. **Account security:** sessions, 2FA management (owners and admins cannot disable it), backup-code regeneration.
5. **Security pass:** rate-limit review, `pnpm audit` in CI, the secret-rotation procedure.

**Acceptance:**

- an integration matrix for the user-management endpoints, including the owner and last-owner invariants;
- an E2E where View as an editor hides admin-only navigation.

### Phase 11: Dashboard data, polish and launch

1. **Dashboard KPIs:**
   - new enquiries, with the change vs last month;
   - published articles;
   - subscribers;
   - SEO health;
   - the enquiries-this-week pill chart (hatched = last week);
   - Next up;
   - team activity;
   - the content-health gauge.
   All widgets are RBAC-aware: aggregates only without `lead.read`.
2. **Notifications.** A bell for new enquiries, scheduled publishes and delivery failures, polled every 60 s, with a `notificationsSeenAt` user field.
3. **Performance and accessibility pass:** Lighthouse CI budgets, axe, image audit, bundle check.
4. **CI and deploys.**
   - Full E2E in CI, with Linux visual baselines generated in the Playwright Docker image.
   - The Dokploy deploy runs only after green CI (webhook), with `NEXT_DEPLOYMENT_ID` set to the git SHA.
   - `@huggingface/transformers` moves out of the image build.
5. **Launch:**
   - `docs/runbook.md`;
   - daily `pg_dump` to R2 and a restore drill;
   - content QA with the client (the §4.6 findings) and legal pages;
   - the staging → production cut-over (`feat/platform` → `main`).

**Acceptance:** every §3 success criterion verified, and the client signs off.

---

## Spec coverage map

| Brief section                                | Implemented in                                    |
| -------------------------------------------- | ------------------------------------------------- |
| §2 decisions D1–D14                          | D1 1.12 · D2 0.6 · D3 1.4 · D4 3.4–3.8 · D5 0.4, 0.7, 3.6 · D6 3.2, 4.4 · D7 4.1, 5.1, 9.2 · D8 1.1 · D9 4.7 · D10 1.2, 6.3 · D11 0.3, 2.1 · D12 8.1–8.2 · D13 3.2 · D14 1.10 |
| §3 success criteria                          | 1 → 0.2, 3.11 · 2 → 3–4 · 3 → 0.7 · 4 → 1.1, 1.5–1.7, 10 · 5 → 7 · 6 → 8 · 7 → 2, 4, 9 · 8 → 0.6, 1.12, 11 |
| §4.7 hotspots                                | typecheck 0.1 · client data imports 3.7 · simulated forms 6.1–6.2, 6.5 · slug coupling 3.3, 3.7 · `new Date()` 0.4 · CTA duplication 3.10 |
| §5.4 layering rules                          | enforced from 1.4 onward; lint rule added in 2.5   |
| §5.5 flows                                   | (a) 3.6–3.8 · (b) 4.1 · (c) 4.2 · (d) 6.1–6.3, 8.4 · (e) 1.5, 1.9–1.11 · (f) 5.4 |
| §5.6 rendering and caching                   | 0.4, 0.6, 0.7, 3.3, 3.6, 3.8                       |
| §5.7 motion                                  | 0.5, 3.8, 3.9                                     |
| §6 content model                             | 3.1–3.5, 4.1, 4.5–4.7, 5.1–5.3                     |
| §7 authentication and RBAC                   | 1.1, 1.3, 1.5–1.11, 10.1–10.4                      |
| §8 API                                       | 1.4–1.7, then each phase's API tasks              |
| §9 admin panel                               | 1.10, 2.1–2.10, 4.3–4.7, 5.2, 6.4, 7.5–7.6, 8.5, 9.3, 10.1–10.4, 11.1–11.2 |
| §10 theme customisation                      | 3.10, 9.1–9.3                                     |
| §11 SEO                                      | 3.6, 7.1–7.7                                      |
| §12 marketing and tracking                   | 8.1–8.6                                           |
| §13 forms, enquiries, newsletter and email   | 1.2, 6.1–6.6                                      |
| §14 media                                    | 3.1, 4.7                                          |
| §15 security and privacy                     | 1.5, 1.6, 1.9, 1.11, 6.1, 6.6, 8.4–8.6, 10.5       |
| §16 testing                                  | 0.1, 0.2, 0.5, 0.6, 0.7, 2.10, 11.3–11.4           |
| §17 deployment and operations                | 0.6, 1.12, 11.4–11.5                               |

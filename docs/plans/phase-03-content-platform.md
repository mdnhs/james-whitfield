# Phase 3: Content Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The public site renders entirely from PostgreSQL (pages as block documents, collections, globals, media) and stays pixel-identical to the Phase 0 parity baseline.

**Architecture:** Isomorphic Zod schemas (`blocks/`, `lib/content/`) describe every block, page document and global. Drizzle tables hold pages, collections, articles, media and settings; `server/modules/content/repo.ts` is the only Drizzle code, and `queries.ts` wraps it in `'use cache'` + `cacheTag` + `cacheLife`. The `(site)` layout renders `<SiteFrame>` inside `<Suspense>` after `await io()`; `<CmsPage>` loads the published page and `<BlockRenderer>` turns it into `StackCard`s, derived `JourneyRail` chapters and `<PageMotion />`. Sections are refactored to props first (Tasks 4–5, fed by the old fixtures) so that the switch to the database (Tasks 8–9) changes data sources, not markup.

**Tech Stack:** Next.js 16.3.8 (Cache Components, `io()`, `cacheTag`, `cacheLife`, `revalidateTag(tag, { expire: 0 })`), React 19.2, Drizzle ORM 0.45.4 + drizzle-kit 0.31, PostgreSQL 17, Zod 4.6 (`import * as z from "zod"`), sharp 0.35, nuqs 2.10, Vitest 5, Playwright.

**Spec:** [`docs/brief.md`](../brief.md) §4.2–4.4, §5.6, §5.7, §6.1–6.7, §10.3, §14. Phase contract: [`docs/plan.md`](../plan.md) "Phase 3: Content platform". Prior rulings: `.superpowers/sdd/plan/progress.md`, `.superpowers/sdd/phase-02-admin-shell/progress.md`.

**Branch:** `feat/platform` in place (HEAD `4bf000b`), same as Phases 0–2.

## Global Constraints

Copied verbatim from `docs/plan.md` § Global Constraints (the lines that bind this phase). Every task's requirements implicitly include all of them.

- Next.js `16.3.x` App Router with `cacheComponents: true`, on the Node runtime only. Do not upgrade to 16.4 inside this plan.
- `proxy.ts` sits at the repo root (no `src/`). It does optimistic cookie checks only and **never touches the database**.
- Drizzle ORM `0.45.x`, drizzle-kit `0.31.x`, `pg` `8.x`. Use the 0.45 APIs (`relations()`, `migrate(db, { migrationsFolder })`). Drizzle's website documents the v1 RC by default, so `defineRelations` and `drizzle-orm/zod` **do not exist** for us.
- Zod `4.6.x`, always imported as `import * as z from "zod"`.
- Database casing is `snake_case`, primary keys are `uuid`, and timestamps are `timestamptz`.
- **No database access at build time.** Every DB read is a `'use cache'` query called after `await io()` inside a `<Suspense>` boundary. Never read env or the DB at module scope. CI builds with an unreachable `DATABASE_URL`.
- Never use `NEXT_PUBLIC_*` env vars. Client-visible values are passed down from the server as props.
- Every `server/**` module begins with `import "server-only"`, and client components never import it. Node scripts that load server modules run with `NODE_OPTIONS=--conditions=react-server`.
- Public pages never `fetch` our own `/api/*`. Hono serves only the admin, the forms and cron.
- Client code never queries `document` for page content. It uses `findTarget()` and `activePageRoot()` from `lib/page-root.ts`, because Cache Components keeps hidden routes in the DOM through `<Activity>`.
- The public site is light-only. The admin supports light, dark and system. No single-key hotkeys.
- Every public site section aligns to `components/layout/container.tsx` (max width 1440px, 66px gutter).
- Prettier: no semicolons, double quotes, `trailingComma: "es5"`, width 80.
- File names are kebab-case.
- Use named exports. Default exports are only for `page`, `layout` and `route` files and configs.
- Comments explain *why*.
- Any task that touches the public site must pass `pnpm test:parity` at ≤ 0.1% pixel difference per page.
- Every task ends green on `pnpm lint`, `pnpm typecheck`, its tests and `pnpm build`, then makes one Conventional Commit.

Rulings carried from earlier phases (binding):

- **F6:** `server-only` is required in `server/**` modules used by the Next runtime; pure Drizzle schema files are exempt (loaded by drizzle-kit and Node CLIs).
- **F7 / P11:** the `'use cache'` + `io()` rule binds public-site DB reads only.
- **Parity is darwin-only.** CI never runs `parity:`/`visual:`/`lighthouse:` (and, from Task 10, `perf:`) titles.
- **Prettier:** every task runs `pnpm exec prettier --check` on the files it touched (`pnpm lint` does not run Prettier).
- **E2E DB:** `tests/e2e/global-setup.ts` runs `pnpm e2e:seed`, which truncates every table. From Task 7 on, `e2e:seed` must also seed content, or parity renders an empty site.
- **Commit trailer:** end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

The five failure modes most likely to hurt a real visitor that no single section of the spec spells out. Each is pinned by a test in the task after the arrow. (Parity drift from the props refactor is not listed: the parity gate in every public-site task already pins it.)

1. **A database read sneaks into the build.** A cached query called without `await io()` (layout metadata, `global-not-found`, a block) runs during `next build`, which CI runs with `DATABASE_URL` on a closed port; the build must still pass. → Task 9: `app/(site)/io-gate.test.ts` plus the unreachable-DB build in Tasks 8, 9 and 10.
2. **The site stays empty after seeding a running server.** Requests that arrive before `pnpm db:seed` cache "no page" / "no rows" / "no setting". Those misses must expire within a minute, and publish-style invalidation of `routes` must clear them, so content appears without a restart. → Task 6: `server/modules/content/queries.test.ts` (misses use `MISS_LIFE`, hits use `"max"`, both carry the right tags) and `server/lib/cache.test.ts`.
3. **Two CMS pages share one route segment.** `/about` → `/services` are both `app/(site)/[...slug]`. After that client navigation the rail must list the *new* page's chapters and scroll the visible copy of a shared id (`#faq`), never the copy Activity hid. → Task 9: two new tests in `tests/e2e/navigation/activity.spec.ts`.
4. **Unknown or unpublished paths answer 200.** `/no-such-page`, `/insights/nope` and the draft legal page `/privacy` must return HTTP **404** with the site's not-found page, not a soft 404 streamed as 200. → Task 9: `tests/e2e/navigation/cms.spec.ts`.
5. **Re-running the seed duplicates or clobbers content.** `pnpm db:seed` twice must leave identical row counts and must not overwrite a row an editor already changed. → Task 7: `tests/integration/seed/seed.test.ts`.

---

## File Structure

| Path | Responsibility | Task |
| --- | --- | --- |
| `app/(site)/site.css` | Semantic colour tokens; failsafe reveal keyframes | 1, 2 |
| `app/(site)/fonts.ts` | Drop Geist Mono; `preload: false` on rarely used families | 1 |
| `scripts/generate-icons.mjs` | Converts content SVGs into inline `currentColor` components | 1 |
| `components/icons/content-icons.tsx` | Generated icon components (do not edit) | 1 |
| `components/icons/icon.tsx` | `<Icon name>` renderer | 1 |
| `lib/icons.ts` | `ICON_NAMES`, `IconName` (isomorphic; also the admin icon picker list) | 1 |
| `lib/tint.ts` | `tintStyle(tint)`: numeric tint → same colour as `bg-pine/NN` | 1 |
| `lib/count.ts` | `StatValue` types, `statText`, `countAttrs`, `formatCount` | 2 |
| `lib/layout-math.ts` | `stepsTimeline`, `splitColumns`, `pairRows` | 2 |
| `components/stat-value.tsx` | Renders a stat with count-up data attributes | 2 |
| `blocks/fields.ts` | Shared Zod field schemas (link, stat, media ref, icon, tint, selection) | 3 |
| `blocks/rich-text.ts` | TipTap-compatible JSON schema (`RichTextDoc`) | 3 |
| `blocks/define-block.ts` | `defineBlock` + `PageKind` | 3 |
| `blocks/{home,about,services,insights,contact,richtext}.ts` | The 22 block definitions, grouped by section family | 3 |
| `blocks/registry.ts` | `BLOCKS`, `BlockInstance`, `BlockType`, `BlockData` | 3 |
| `blocks/page.ts` | `PageDocument`, `PageSeo`, `PageSettings`, `pageDocumentFor(kind)` | 3 |
| `blocks/media-refs.ts` | `Resolve<T>`, `BlockView<T>`, `collectMediaIds`, `resolveMedia` | 3 |
| `lib/media.ts` | `MediaAsset`, `fromPath` (transitional) | 3 |
| `lib/content/globals.ts` | Zod schema + defaults for every §6.4 global; `SITE_TOKENS` | 3 |
| `lib/content/types.ts` | View DTOs shared by server and components | 3 |
| `lib/content/frame.ts` | `cropToFrame`, `frameStyle` | 4 |
| `lib/contact-href.ts` | Prefilled contact links (same output as before) | 4 |
| `lib/fill.ts` | `fill("Showing {shown} of {total}", vars)` | 5 |
| `components/media-image.tsx` | `next/image` from a `MediaAsset` (blur, focal → `object-position`) | 4 |
| `app/(site)/_legacy/views.ts` | Transitional fixture → view builders (deleted in Task 9) | 4, 5 |
| `features/**/components/*.tsx` | Props-driven sections | 4, 5 |
| `features/site/data/{site,microcopy}.ts` | New fixtures for copy that lived inside components | 5 |
| `features/insights/components/rich-text.tsx` | Server renderer for `RichTextDoc` (article body + `richtext` block) | 5 |
| `features/contact/lib/contact-params.ts` | nuqs parsers built from props | 5 |
| `server/db/schema/{media,content,pages}.ts` | Tables (§6.6) | 6 |
| `server/db/migrations/0004_content.sql` | Generated migration | 6 |
| `server/lib/cache.ts` | Tag catalogue, `MISS_LIFE`, `invalidate()` | 6 |
| `lib/format-date.ts` | `articleDate(date)` → `{ iso, label }` ("2nd Sep, 2026") | 6 |
| `server/modules/content/repo.ts` | All content Drizzle queries → DTOs | 6 |
| `server/modules/content/queries.ts` | `'use cache'` wrappers | 6 |
| `server/lib/media/probe.ts` | sharp: size, 16 px WebP blur, dominant colour | 7 |
| `server/db/seed/*.ts` | `seedContent()`: media, collections, articles, pages, globals | 7 |
| `scripts/seed.ts` | `pnpm db:seed` entry | 7 |
| `lib/content/theme.ts` | `themeCss(tokens)` | 8 |
| `app/(site)/_cms/site-frame.tsx` | Suspense-gated chrome from globals | 8 |
| `app/(site)/_cms/{cms-page,block-renderer,resolve-block}.tsx` | Page → cards → sections | 9 |
| `lib/content/page-layout.ts` | `groupCards`, `pageChapters`, `sectionId` | 9 |
| `app/(site)/[...slug]/page.tsx`, `not-found.tsx` | CMS catch-all, site 404 | 9 |
| `server/db/seed/fixtures/*.ts` | The old `features/*/data/*.ts`, moved | 10 |
| `tests/lint/content-literals.test.ts` | No fixture string inside components | 10 |
| `tests/e2e/perf/ttfb.spec.ts` | Warm-cache TTFB < 200 ms (local only) | 10 |

**Deviations from brief §5.3, decided here:**

- Block definitions live in six family files (`blocks/home.ts` …) instead of 22 `blocks/<type>/{schema,meta}.ts` folders. `blocks/registry.ts` is still the single entry point.
- The renderer lives in `app/(site)/_cms/`, not `blocks/render.tsx`: the layering lint forbids `blocks/**` from importing `@/server/**`, and the renderer must call cached queries. `app/**` is outside that lint (Phase 2 ruling).
- `defineBlock` has no `defaults` yet; the add-block library that needs them is Phase 4.

---

## Task 1: Tokenise the site (colours, icons, tints, fonts)

Zero-visual-diff refactor (brief §10.3). No database.

**Files:**
- Modify: `app/(site)/site.css` (the `@theme` block)
- Modify: `app/(site)/fonts.ts`
- Create: `scripts/generate-icons.mjs`, `components/icons/content-icons.tsx` (generated), `components/icons/icon.tsx`, `lib/icons.ts`, `lib/tint.ts`
- Modify: every `features/**/components/*.tsx`, `components/*.tsx` (not `components/ui/**`) and `app/global-not-found.tsx` that contains a tokenised hex
- Modify: `features/credibility/data/credentials.ts`, `features/about-page/data/about-page-content.ts`, `features/services/data/services-content.ts`, `features/contact/data/contact-content.ts` (icon fields → icon names)
- Modify: `features/credibility/components/credential-item.tsx`, `features/about-page/components/approach-section.tsx`, `features/services/components/services-grid.tsx`, `features/contact/components/contact-section.tsx` (render `<Icon>`)
- Modify: `features/enterprise/components/enterprise-section.tsx`, `features/insights/components/newsletter-band.tsx`, `app/(site)/about/page.tsx` (numeric tint)
- Test: `tests/css/site-tokens.test.ts` (+ helper `tests/css/site-sources.ts`), `components/icons/icon.test.tsx`, `lib/tint.test.ts`

**Interfaces:**
- Produces: `ICON_NAMES`, `type IconName` (`lib/icons.ts`); `<Icon name className? width? height? />` (`components/icons/icon.tsx`); `tintStyle(tint: number, token?: string): React.CSSProperties` (`lib/tint.ts`); Tailwind colour tokens `text-strong`, `text-muted`, `text-subtle`, `line`, `line-soft`, `line-neutral`, `line-faint`, `line-rule`, `surface-soft`, `surface-warm`, `hero-base`, `moss`, `spruce`.
- `EnterpriseSection` prop `tint` changes from `string` (class) to `number` (0–0.9), default `0.9`.

**Token table** (values are today's literals, so swapping a literal for its token changes no pixel). The brief's grouping of several greys into one token and of `#315d44` into `pine`/`forest` would change pixels, which §10.3 forbids; each distinct literal gets its own token instead.

| Literal | Token (`--color-…`) | Class fragment replacing `[#hex]` |
| --- | --- | --- |
| `#0c0c0c` | `text-strong` | `text-strong` |
| `#525252` | `text-muted` | `text-muted` |
| `#8a8f88` | `text-subtle` | `text-subtle` |
| `#dfe2d8` | `line` | `line` |
| `#e7e9e0` | `line-soft` | `line-soft` |
| `#ececec` | `line-neutral` | `line-neutral` |
| `#f2f2f2` | `line-faint` | `line-faint` |
| `#d8dccf` | `line-rule` | `line-rule` |
| `#f8f9f5` | `surface-soft` | `surface-soft` |
| `#fcfaf7` | `surface-warm` | `surface-warm` |
| `#0d120f` | `hero-base` | `hero-base` |
| `#315d44` | `moss` | `moss` |
| `#002620` | `spruce` | `spruce` |

One-off literals (count 1, e.g. `#e5e2dc`, `#021019`) stay for Phase 9's theme work; the token test lists only the table above.

- [ ] **Step 1: Write the failing token test**

```ts
// tests/css/site-tokens.test.ts
import { readFile } from "node:fs/promises"
import path from "node:path"

import tailwind from "@tailwindcss/postcss"
import postcss from "postcss"
import { describe, expect, it } from "vitest"

import { siteSources } from "./site-sources"

const root = path.join(import.meta.dirname, "../..")

// docs/brief.md §10.3: these literals now live in site.css as tokens, so the
// theme engine (Phase 9) can override them at runtime.
const TOKENS: Record<string, string> = {
  "text-strong": "#0c0c0c",
  "text-muted": "#525252",
  "text-subtle": "#8a8f88",
  line: "#dfe2d8",
  "line-soft": "#e7e9e0",
  "line-neutral": "#ececec",
  "line-faint": "#f2f2f2",
  "line-rule": "#d8dccf",
  "surface-soft": "#f8f9f5",
  "surface-warm": "#fcfaf7",
  "hero-base": "#0d120f",
  moss: "#315d44",
  spruce: "#002620",
}

describe("site colour tokens", () => {
  it("site.css defines every token with today's value", async () => {
    const from = path.join(root, "app/(site)/site.css")
    const { css } = await postcss([tailwind({ base: root })]).process(
      await readFile(from, "utf8"),
      { from }
    )
    for (const [name, hex] of Object.entries(TOKENS)) {
      expect(css).toContain(`--color-${name}: ${hex}`)
    }
  }, 60_000)

  it("no site component hardcodes a tokenised colour", async () => {
    const files = await siteSources()
    const offenders: string[] = []
    for (const file of files) {
      const source = (await readFile(path.join(root, file), "utf8")).toLowerCase()
      for (const hex of Object.values(TOKENS)) {
        if (source.includes(hex)) offenders.push(`${file}: ${hex}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
```

Shared helper (Task 10's content-literal test reuses it):

```ts
// tests/css/site-sources.ts
import { readdir } from "node:fs/promises"
import path from "node:path"

const root = path.join(import.meta.dirname, "../..")

// Public-site component sources, relative to the repo root. components/ui is
// shadcn's (shared with the admin), not site content.
export async function siteSources() {
  const files: string[] = ["app/global-not-found.tsx"]
  for (const dir of ["features", "components", "app/(site)"]) {
    const entries = await readdir(path.join(root, dir), { recursive: true })
    for (const entry of entries) {
      const file = path.join(dir, entry)
      if (!file.endsWith(".tsx") || file.endsWith(".test.tsx")) continue
      if (file.startsWith(path.join("components", "ui"))) continue
      files.push(file)
    }
  }
  return files
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run --project unit tests/css/site-tokens.test.ts`
Expected: FAIL. Both tests fail: the tokens are missing and the offenders list names about 60 literals.

- [ ] **Step 3: Add the tokens to `@theme` in `app/(site)/site.css`**

Append inside the existing `@theme { … }` block, after `--color-ink-muted`:

```css
  /* Semantic tokens (docs/brief.md §10.3). Each holds the exact literal it
     replaced, so tokenising changes no pixel; Phase 9 overrides them. */
  --color-text-strong: #0c0c0c;
  --color-text-muted: #525252;
  --color-text-subtle: #8a8f88;
  --color-line: #dfe2d8;
  --color-line-soft: #e7e9e0;
  --color-line-neutral: #ececec;
  --color-line-faint: #f2f2f2;
  --color-line-rule: #d8dccf;
  --color-surface-soft: #f8f9f5;
  --color-surface-warm: #fcfaf7;
  --color-hero-base: #0d120f;
  --color-moss: #315d44;
  --color-spruce: #002620;
```

- [ ] **Step 4: Replace the literals**

Every occurrence is an arbitrary Tailwind value (`text-[#525252]`, `border-[#dfe2d8]`, `placeholder:text-[#8a8f88]`, `text-[#525252]/70` …). Replacing the bracketed literal with the token name turns `text-[#525252]` into `text-text-muted` and keeps any `/NN` modifier.

```bash
FILES=$(grep -rliE '#(0c0c0c|525252|8a8f88|dfe2d8|e7e9e0|ececec|f2f2f2|d8dccf|f8f9f5|fcfaf7|0d120f|315d44|002620)' features components/*.tsx components/layout 'app/(site)' app/global-not-found.tsx --include=*.tsx)
for pair in 0c0c0c:text-strong 525252:text-muted 8a8f88:text-subtle dfe2d8:line e7e9e0:line-soft ececec:line-neutral f2f2f2:line-faint d8dccf:line-rule f8f9f5:surface-soft fcfaf7:surface-warm 0d120f:hero-base 315d44:moss 002620:spruce; do
  hex=${pair%%:*}; token=${pair##*:}
  # macOS sed has no case-insensitive flag; the census found lowercase only.
  sed -i '' -E "s/\[#${hex}\]/${token}/g" $FILES
done
grep -rniE '#(0c0c0c|525252|8a8f88|dfe2d8|e7e9e0|ececec|f2f2f2|d8dccf|f8f9f5|fcfaf7|0d120f|315d44|002620)' $FILES
```

Expected: the final `grep` prints nothing. If it prints a literal that is not inside `[...]` (an inline `style`), replace it by hand with `var(--color-<token>)`.

- [ ] **Step 5: Write the icon generator**

The 17 content icons (credibility, approach, services, contact channels) each use a single baked colour: `#002620` (credibility) or `#1E4F50` (`pine`, the rest). Inline components with `currentColor` let the theme recolour them and let the admin pick them by name.

```js
// scripts/generate-icons.mjs
// Converts the content SVGs in public/images into inline React components
// that paint with currentColor (docs/brief.md §10.3). Run after changing an
// icon: node scripts/generate-icons.mjs && pnpm exec prettier --write components/icons/content-icons.tsx
import { readFile, writeFile } from "node:fs/promises"

const ICONS = {
  shield: "credibility/shield.svg",
  mind: "credibility/mind.svg",
  brain: "credibility/brain.svg",
  lock: "credibility/lock.svg",
  evidence: "about/icon-evidence.svg",
  control: "about/icon-control.svg",
  "real-life": "about/icon-real-life.svg",
  anxiety: "services/icon-anxiety.svg",
  confidence: "services/icon-confidence.svg",
  performance: "services/icon-performance.svg",
  habits: "services/icon-habits.svg",
  sleep: "services/icon-sleep.svg",
  workplace: "services/icon-workplace.svg",
  email: "contact/icon-email.svg",
  phone: "contact/icon-phone.svg",
  clinic: "contact/icon-clinic.svg",
  hours: "contact/icon-hours.svg",
}

const BAKED = /#(002620|1e4f50)/gi
const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

function convert(name, svg) {
  const attr = (key) => svg.match(new RegExp(`<svg[^>]*\\s${key}="([^"]+)"`))?.[1]
  const width = Number(attr("width"))
  const height = Number(attr("height"))
  const viewBox = attr("viewBox") ?? `0 0 ${width} ${height}`
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(BAKED, "currentColor")
    // Ids must not collide between icons rendered on the same page.
    .replace(/\sid="([^"]+)"/g, ` id="icon-${name}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#icon-${name}-$1)`)
    .replace(/\s([a-z]+(?:-[a-z]+)+)=/g, (_, a) => ` ${camel(a)}=`)
    .replace(/\sxlink:href=/g, " href=")
    .replace(/\sclass=/g, " className=")
    .trim()
  return `  "${name}": {
    width: ${width},
    height: ${height},
    Svg: (props: SVGProps<SVGSVGElement>) => (
      <svg width={${width}} height={${height}} viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        ${inner}
      </svg>
    ),
  },`
}

const entries = []
for (const [name, file] of Object.entries(ICONS)) {
  entries.push(convert(name, await readFile(`public/images/${file}`, "utf8")))
}

await writeFile(
  "components/icons/content-icons.tsx",
  `// Generated by scripts/generate-icons.mjs from public/images. Do not edit.
import type { SVGProps } from "react"

import type { IconName } from "@/lib/icons"

export const CONTENT_ICONS: Record<
  IconName,
  {
    width: number
    height: number
    Svg: (props: SVGProps<SVGSVGElement>) => React.ReactElement
  }
> = {
${entries.join("\n")}
}
`
)
console.log(`Wrote ${entries.length} icons.`)
```

- [ ] **Step 6: Write the icon names and the `<Icon>` test**

```ts
// lib/icons.ts
// Content icons, by name. Block schemas and the admin icon picker use this
// list; components/icons/content-icons.tsx holds the drawings.
export const ICON_NAMES = [
  "shield",
  "mind",
  "brain",
  "lock",
  "evidence",
  "control",
  "real-life",
  "anxiety",
  "confidence",
  "performance",
  "habits",
  "sleep",
  "workplace",
  "email",
  "phone",
  "clinic",
  "hours",
] as const

export type IconName = (typeof ICON_NAMES)[number]
```

```tsx
// components/icons/icon.test.tsx
// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ICON_NAMES } from "@/lib/icons"

import { CONTENT_ICONS } from "./content-icons"
import { Icon } from "./icon"

describe("Icon", () => {
  it("has a drawing for every icon name and nothing else", () => {
    expect(Object.keys(CONTENT_ICONS).sort()).toEqual([...ICON_NAMES].sort())
  })

  it("renders at the SVG's own size and paints with currentColor", () => {
    const { container } = render(<Icon name="shield" className="text-spruce" />)
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("width")).toBe("14.0909")
    expect(svg.getAttribute("height")).toBe("17.6136")
    expect(svg.getAttribute("aria-hidden")).toBe("true")
    expect(svg.getAttribute("class")).toBe("text-spruce")
    expect(container.innerHTML).not.toMatch(/#002620|#1e4f50/i)
    expect(container.innerHTML).toContain("currentColor")
  })
})
```

Run: `pnpm vitest run --project unit components/icons/icon.test.tsx` → FAIL (`./content-icons` missing).

- [ ] **Step 7: Generate and implement `<Icon>`**

```bash
node scripts/generate-icons.mjs && pnpm exec prettier --write components/icons/content-icons.tsx
```

```tsx
// components/icons/icon.tsx
import type { IconName } from "@/lib/icons"

import { CONTENT_ICONS } from "./content-icons"

// Content icons are inline SVG painted with currentColor, so the colour comes
// from the surrounding text colour (and from the theme, Phase 9).
export function Icon({
  name,
  className,
  width,
  height,
}: {
  name: IconName
  className?: string
  width?: number
  height?: number
}) {
  const { Svg, width: w, height: h } = CONTENT_ICONS[name]
  return (
    <Svg
      aria-hidden
      focusable="false"
      className={className}
      width={width ?? w}
      height={height ?? h}
    />
  )
}
```

Run the icon test again → PASS. If `pnpm typecheck` later flags something in the generated file (for example a `style="…"` string attribute, which JSX does not accept), fix the generator, not the output, and regenerate.

- [ ] **Step 8: Switch fixtures and components to icon names**

Fixtures (data stays data; only the icon field changes):

- `features/credibility/data/credentials.ts`: `Credential.icon` becomes `IconName` (import type from `@/lib/icons`); values `"shield"`, `"mind"`, `"brain"`, `"lock"`.
- `features/about-page/data/about-page-content.ts`: principles' `icon` → `"evidence"`, `"control"`, `"real-life"`.
- `features/services/data/services-content.ts`: delete the `icon()` helper; items' `icon` → `"anxiety"`, `"confidence"`, `"performance"`, `"habits"`, `"sleep"`, `"workplace"`; `Service.icon: IconName`.
- `features/contact/data/contact-content.ts`: items' `icon` → `"email"`, `"phone"`, `"clinic"`, `"hours"`.

Components: replace the `<Image src={icon} … />` of each with `<Icon name={icon} … />`, keeping the `width`/`height` the `<Image>` had **only if** they differ from the SVG's own size (check the table the generator printed into `content-icons.tsx`):

| File | Old | New |
| --- | --- | --- |
| `credibility/components/credential-item.tsx` | `<Image src={icon.src} alt="" width={icon.width} height={icon.height} />` | `<Icon name={icon} className="text-spruce" />` |
| `about-page/components/approach-section.tsx` | `<Image src={icon} … />` | `<Icon name={icon} className="text-pine" />` (+ width/height if they differed) |
| `services/components/services-grid.tsx` | `<Image src={service.icon} … />` | `<Icon name={service.icon} className="text-pine" />` |
| `contact/components/contact-section.tsx` | `<Image src={icon} alt="" width={22} height={22} />` | `<Icon name={icon} className="text-pine" />` |

Remove `next/image` imports that become unused.

- [ ] **Step 9: Numeric tints**

```ts
// lib/tint.ts
import type { CSSProperties } from "react"

// A tint is a number (0–1) so it can come from the database. This is the
// exact colour Tailwind 4 emits for `bg-pine/90` in browsers with color-mix,
// so swapping the class for this style changes no pixel.
export function tintStyle(tint: number, token = "pine"): CSSProperties {
  const percent = Math.round(Math.min(1, Math.max(0, tint)) * 1000) / 10
  return {
    backgroundColor: `color-mix(in oklab, var(--color-${token}) ${percent}%, transparent)`,
  }
}
```

```ts
// lib/tint.test.ts
import { describe, expect, it } from "vitest"

import { tintStyle } from "./tint"

describe("tintStyle", () => {
  it("matches Tailwind's bg-pine/90 colour", () => {
    expect(tintStyle(0.9)).toEqual({
      backgroundColor:
        "color-mix(in oklab, var(--color-pine) 90%, transparent)",
    })
  })
  it("clamps and keeps one decimal", () => {
    expect(tintStyle(0.625).backgroundColor).toContain(" 62.5%")
    expect(tintStyle(2).backgroundColor).toContain(" 100%")
  })
})
```

Before editing, confirm the Tailwind output once: `pnpm build && grep -o 'bg-pine\\/90[^}]*}[^}]*}' .next/static/css/*.css | head -2` must show `color-mix(in oklab,var(--color-pine) 90%,transparent)`. If it shows a different colour space, use that one in `tintStyle` and its test.

Edits:

- `enterprise-section.tsx`: prop `tint?: number` default `0.9`; `<div className="absolute inset-0" style={tintStyle(tint)} />`; drop `cn` if unused.
- `newsletter-band.tsx`: `<div className="absolute inset-0 bg-pine/90" />` → `<div className="absolute inset-0" style={tintStyle(0.9)} />`.
- `app/(site)/about/page.tsx`: `tint="bg-pine/70"` → `tint={0.7}`.

- [ ] **Step 10: Trim font preloads**

In `app/(site)/fonts.ts`: delete the `Geist_Mono` import, the `fontMono` constant and `fontMono.variable` from `siteFontClassName`; add `preload: false` to `jakarta`, `dmMono` and `plexMono` (used by 2–3 elements each; they still load on the pages that use them). First confirm nothing on the site uses `--font-mono` or `font-mono`:

```bash
grep -rn 'font-mono\|--font-mono' features components 'app/(site)' app/global-not-found.tsx --include=*.tsx --include=*.css
```

Expected: no output. If anything matches, keep Geist Mono and report it.

- [ ] **Step 11: Verify**

```bash
pnpm vitest run --project unit tests/css lib/tint.test.ts components/icons
pnpm lint && pnpm typecheck && pnpm build
pnpm test:parity
pnpm exec prettier --check $(git diff --name-only HEAD -- '*.ts' '*.tsx' '*.mjs' '*.css')
```

Expected: all PASS; parity 21/21 (7 routes × desktop/tablet/mobile).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor(site): tokenise colours, inline currentColor icons, numeric tints

Each distinct literal becomes its own token with the same value so the
change is pixel-identical (brief §10.3). Drops Geist Mono and preloading
of rarely used families.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Robustness of the motion and layout system (§5.7)

Count-agnostic layouts and count-up data, still fed by fixtures. Zero visual diff.

**Files:**
- Create: `lib/count.ts`, `lib/count.test.ts`, `lib/layout-math.ts`, `lib/layout-math.test.ts`, `components/stat-value.tsx`, `tests/e2e/navigation/failsafe.spec.ts`
- Modify: `components/page-motion.tsx:345-367`, `features/hero/components/hero-motion.tsx:80-96`, `features/hero/components/member-badge.tsx`, `features/hero/data/hero-content.ts`
- Modify: `features/how-it-works/components/{steps-story,how-it-works-section,fit-section}.tsx`
- Modify: `features/credibility/components/{credibility-section,credential-item}.tsx`, `features/about-page/components/{stats-band,story-section}.tsx`, `features/about/components/{about-section,stat-card}.tsx`
- Modify: `features/testimonials/components/testimonials-section.tsx`, `features/testimonials/data/testimonials.ts`
- Modify: `features/about-page/data/about-page-content.ts`, `features/about/data/about-content.ts` (stat values)
- Modify: `app/(site)/site.css` (failsafe reveal)

**Interfaces:**
- Produces (`lib/count.ts`): `type CountStat = { kind: "count"; value: number; decimals: number; prefix: string; suffix: string }`, `type TextStat = { kind: "text"; text: string }`, `type StatValue = CountStat | TextStat`, `formatCount(value: number, decimals: number): string`, `statText(stat: StatValue): string`, `countAttrs(stat: StatValue): Record<string, string>`.
- Produces (`lib/layout-math.ts`): `stepsTimeline(count: number): { beat: number; spacer: string; surface(i: number): { start: number; end: number } }`, `splitColumns<T>(items: T[], columns: number): T[][]`, `pairRows<A, B>(a: A[], b: B[]): [A | null, B | null][]`.
- Produces: `<StatValue stat className? motion? />` rendering `statText` with `data-motion="count"` + `countAttrs` for count stats.
- `StepsStory` gains a required `count: number` prop. Testimonials fixture becomes a flat `TESTIMONIALS: Testimonial[]` (left column first, then right).

- [ ] **Step 1: Write the failing unit tests**

```ts
// lib/count.test.ts
import { describe, expect, it } from "vitest"

import { countAttrs, formatCount, statText, type StatValue } from "./count"

const count = (value: number, decimals = 0, prefix = "", suffix = "") =>
  ({ kind: "count", value, decimals, prefix, suffix }) satisfies StatValue

describe("count stats", () => {
  it("renders today's stat strings exactly", () => {
    expect(statText(count(10, 0, "", "+"))).toBe("10+")
    expect(statText(count(800, 0, "", "+"))).toBe("800+")
    expect(statText(count(3))).toBe("3")
    expect(statText(count(4.9, 1, "", "/5"))).toBe("4.9/5")
    expect(statText({ kind: "text", text: "ICF / EMCC" })).toBe("ICF / EMCC")
  })

  it("groups thousands and keeps decimals while counting", () => {
    expect(formatCount(1200, 0)).toBe("1,200")
    expect(formatCount(2.45, 1)).toBe("2.5")
    expect(formatCount(0, 1)).toBe("0.0")
  })

  it("exposes count data to the motion layer and nothing for text stats", () => {
    expect(countAttrs(count(4.9, 1, "", "/5"))).toEqual({
      "data-motion": "count",
      "data-count-value": "4.9",
      "data-count-decimals": "1",
      "data-count-prefix": "",
      "data-count-suffix": "/5",
    })
    expect(countAttrs({ kind: "text", text: "Certified" })).toEqual({})
  })
})
```

```ts
// lib/layout-math.test.ts
import { describe, expect, it } from "vitest"

import { pairRows, splitColumns, stepsTimeline } from "./layout-math"

describe("stepsTimeline", () => {
  it("reproduces the values tuned for four steps", () => {
    const t = stepsTimeline(4)
    expect(t.beat).toBe(24)
    expect(t.spacer).toBe("260svh")
    expect([1, 2, 3].map(t.surface)).toEqual([
      { start: 8, end: 28 },
      { start: 32, end: 52 },
      { start: 56, end: 76 },
    ])
  })
  it("keeps every window inside the pin for 3 to 6 steps", () => {
    for (const n of [3, 5, 6]) {
      const t = stepsTimeline(n)
      expect(t.surface(n - 1).end).toBeLessThanOrEqual(100)
      expect(t.spacer).toBe(`${65 * n}svh`)
    }
  })
})

describe("splitColumns", () => {
  it("fills the left column first, as the old pre-split data did", () => {
    expect(splitColumns([1, 2, 3, 4, 5, 6, 7], 2)).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7],
    ])
  })
  it("drops empty columns", () => {
    expect(splitColumns([1], 2)).toEqual([[1]])
    expect(splitColumns([], 2)).toEqual([])
  })
})

describe("pairRows", () => {
  it("pads the shorter list with null", () => {
    expect(pairRows(["a", "b", "c"], ["x"])).toEqual([
      ["a", "x"],
      ["b", null],
      ["c", null],
    ])
  })
})
```

Run: `pnpm vitest run --project unit lib/count.test.ts lib/layout-math.test.ts` → FAIL (modules missing).

- [ ] **Step 2: Implement `lib/count.ts` and `lib/layout-math.ts`**

```ts
// lib/count.ts
// Counters are stored as numbers plus formatting (docs/brief.md §5.7), so
// "4.9/5" and "1,200+" count up correctly instead of parsing a leading integer.
export type CountStat = {
  kind: "count"
  value: number
  decimals: number
  prefix: string
  suffix: string
}
export type TextStat = { kind: "text"; text: string }
export type StatValue = CountStat | TextStat

const formatters = new Map<number, Intl.NumberFormat>()

export function formatCount(value: number, decimals: number) {
  let format = formatters.get(decimals)
  if (!format) {
    format = new Intl.NumberFormat("en-IE", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    formatters.set(decimals, format)
  }
  return format.format(value)
}

export function statText(stat: StatValue) {
  if (stat.kind === "text") return stat.text
  return `${stat.prefix}${formatCount(stat.value, stat.decimals)}${stat.suffix}`
}

// Read by PageMotion's count-up; text stats do not animate.
export function countAttrs(stat: StatValue): Record<string, string> {
  if (stat.kind === "text") return {}
  return {
    "data-motion": "count",
    "data-count-value": String(stat.value),
    "data-count-decimals": String(stat.decimals),
    "data-count-prefix": stat.prefix,
    "data-count-suffix": stat.suffix,
  }
}
```

```ts
// lib/layout-math.ts
// The steps pin was tuned by hand for four cards: 24% of the pinned scroll
// per card and a 260svh spacer. Deriving both from the count keeps the same
// pace per card for any 3–6 steps, and gives back exactly the tuned values
// at four.
export function stepsTimeline(count: number) {
  const beat = 96 / count
  return {
    beat,
    spacer: `${65 * count}svh`,
    surface: (i: number) => ({ start: (i - 1) * beat + 8, end: i * beat + 4 }),
  }
}

// Left column first: the reading order the hand-split data used to encode.
export function splitColumns<T>(items: T[], columns: number): T[][] {
  const size = Math.ceil(items.length / columns)
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

// The fit table compares two lists row by row; either may be longer.
export function pairRows<A, B>(a: A[], b: B[]): [A | null, B | null][] {
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [
    a[i] ?? null,
    b[i] ?? null,
  ])
}
```

Run the tests again → PASS.

- [ ] **Step 3: `<StatValue>` and the stat fixtures**

```tsx
// components/stat-value.tsx
import { countAttrs, statText, type StatValue as Stat } from "@/lib/count"

// Server-rendered final value; PageMotion counts up from the data attributes.
export function StatValue({
  stat,
  className,
}: {
  stat: Stat
  className?: string
}) {
  return (
    <span className={className} {...countAttrs(stat)}>
      {statText(stat)}
    </span>
  )
}
```

Fixture values (import `type StatValue` from `@/lib/count`; build with a local `const count = (value: number, suffix = "", decimals = 0): StatValue => ({ kind: "count", value, decimals, prefix: "", suffix })`):

| Fixture | Old | New |
| --- | --- | --- |
| `ABOUT_STATS[].value` | `"10+"`, `"800+"`, `"3"`, `"4.9/5"` | `count(10, "+")`, `count(800, "+")`, `count(3)`, `count(4.9, "/5", 1)` |
| `ABOUT_STORY.badge.value` | `"10+"` | `count(10, "+")` |
| `ABOUT_CONTENT.stats[].value` | `"10+"`, `"ICF / EMCC"`, `"Certified"` | `count(10, "+")`, `{ kind: "text", text: "ICF / EMCC" }`, `{ kind: "text", text: "Certified" }` (drop `as const` on `ABOUT_CONTENT`) |
| `HERO_CONTENT.members.count` | `"800+"` | `count(800, "+")` (drop `as const`) |

Components: each `<span data-motion="count" className="…">{value}</span>` becomes `<StatValue stat={value} className="…" />` (same classes) in `stats-band.tsx`, `story-section.tsx` (badge), `stat-card.tsx` (prop type `value: StatValue`). In `member-badge.tsx` the hero has its own intro timeline, so keep `data-hero="count"` and add the count data: `<span data-hero="count" className="…" {...countAttrs(count)}>{statText(count)}</span>` — but **without** `data-motion` (spread `{ ...countAttrs(count), "data-motion": undefined }`), so PageMotion does not count it twice.

- [ ] **Step 4: Count-up reads the data attributes**

Replace `components/page-motion.tsx` lines 345–367 (`select("count").forEach(…)`) with:

```ts
          select("count").forEach((el) => {
            const target = Number(el.dataset.countValue)
            if (!Number.isFinite(target)) return
            const decimals = Number(el.dataset.countDecimals ?? 0)
            const prefix = el.dataset.countPrefix ?? ""
            const suffix = el.dataset.countSuffix ?? ""
            const counter = { n: 0 }
            ScrollTrigger.create({
              trigger: el,
              start: enter(el, 0.9),
              once: true,
              onEnter: () =>
                gsap.to(counter, {
                  n: target,
                  duration: 2,
                  ease: "power2.out",
                  onUpdate: () => {
                    el.textContent = `${prefix}${formatCount(counter.n, decimals)}${suffix}`
                  },
                }),
            })
          })
```

Add `import { formatCount } from "@/lib/count"`. Update the header comment line for `count` to "counts up from data-count-* (value, decimals, prefix, suffix)".

In `features/hero/components/hero-motion.tsx` replace the block at lines 80–96 (`// Count up "800+" …`) with the same data-attribute read (`count.dataset.countValue` etc.), keeping `duration: 1.6` and the `2.15` position argument, and `formatCount(counter.n, decimals)` in `onUpdate`.

- [ ] **Step 5: Count-agnostic layouts**

1. **StepsStory** (`steps-story.tsx`): remove the `STEPS` import, `BEAT` and `surface`; add prop `count: number`; `const { surface } = stepsTimeline(count)`; render `Array.from({ length: count - 1 }, (_, i) => <Scrollytelling.Animation key={i + 1} tween={{ ...surface(i + 1), target: stepAt(i + 1), … }} />)` with the same `fromTo`.
2. **HowItWorksSection**: pass `count={STEPS.length}` to `StepsStory`; replace the class `lg:[--steps-spacer:260svh]` with `lg:[--steps-spacer:var(--steps-spacer-lg)]` and add `style={{ "--steps-spacer-lg": stepsTimeline(STEPS.length).spacer } as React.CSSProperties}` on the `<section>`.
3. **Credibility dividers** (`credibility-section.tsx`): delete the per-item `className` logic and the `className` prop use; on the `<ul>` add `xl:[&>li+li]:border-l xl:[&>li+li]:border-[#e5e2dc] xl:[&>li+li]:pl-[17.966px]`. `credential-item.tsx` keeps accepting `className` (unused now, remove the prop).
4. **Stats band dividers** (`stats-band.tsx`): every `<li>` gets one class string `flex flex-col gap-2 border-line-rule py-2 pr-5 lg:pr-8`; the `<ul>` gets `[&>li:nth-child(even)]:border-l [&>li:nth-child(even)]:pl-5 lg:[&>li:nth-child(even)]:pl-8 lg:[&>li:nth-child(odd):not(:first-child)]:border-l lg:[&>li:nth-child(odd):not(:first-child)]:pl-8` and its desktop column count from the item count: `{ 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" }[stats.length] ?? "lg:grid-cols-4"`. These rules reproduce the old per-index classes exactly (item 2 and 4: `border-l px-5 lg:px-8`; item 3: `pr-5 lg:border-l lg:px-8`; item 1: `pr-5 lg:pr-8`).
5. **Testimonials**: `features/testimonials/data/testimonials.ts` exports `TESTIMONIALS: Testimonial[]` = the old left column then the old right column (7 items, same order); delete `TESTIMONIAL_COLUMNS`. The section renders `splitColumns(TESTIMONIALS, 2).map((column, i) => …)` with the same markup; card keys become `j` → use `` `${i}-${j}` `` until Task 4 gives items ids.
6. **FitSection**: `const rows = pairRows(good.items, poor.items)`; row `key={i}`; render `<Item good>{yes}</Item>` only when `yes !== null` (same for `no`); `i === rows.length - 1` logic unchanged.

- [ ] **Step 6: Failsafe reveal (CSS) and its E2E test**

In `app/(site)/site.css` replace the `[data-reveal]` rule with:

```css
@media (prefers-reduced-motion: no-preference) {
  [data-reveal] {
    visibility: hidden;
    /* Failsafe (docs/brief.md §5.7): if JavaScript never runs or a trigger
       is missed, the element still appears. An animation outranks the inline
       visibility GSAP sets, but opacity still hides an element mid-reveal. */
    animation: reveal-failsafe 0s linear 2.5s forwards;
  }
}

@keyframes reveal-failsafe {
  to {
    visibility: visible;
  }
}
```

```ts
// tests/e2e/navigation/failsafe.spec.ts
import { expect, test } from "@playwright/test"

// JavaScript is on but its chunks never arrive, so no reveal ever runs
// (and <noscript> does not apply). The CSS failsafe must still show the hero.
test.use({ reducedMotion: "no-preference" })

test("hero copy appears without its animation script", async ({ page }) => {
  // Scripts only: Turbopack also serves CSS from /_next/static/chunks.
  await page.route(/\/_next\/static\/chunks\/.*\.js(\?.*)?$/, (route) => route.abort())
  await page.goto("/about")
  const title = page.getByRole("heading", { level: 1, name: "About" })
  await expect(title).toBeHidden()
  await expect(title).toBeVisible({ timeout: 5_000 })
})
```

- [ ] **Step 7: Verify**

```bash
pnpm vitest run --project unit lib
pnpm lint && pnpm typecheck && pnpm build
pnpm exec playwright test tests/e2e/navigation/failsafe.spec.ts --project=desktop
pnpm test:parity
pnpm exec prettier --check $(git diff --name-only HEAD -- '*.ts' '*.tsx' '*.css')
```

Expected: PASS; parity 21/21. Then check motion by eye on `pnpm dev`: `/about` stats count up (`4.9/5` animates through decimals), home hero member count, `/how-it-works` steps pin walks four cards at the old pace.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(motion): count-agnostic layouts and structured count-up

StepsStory derives beats from its count, dividers move to CSS, testimonials
split automatically, the fit table pads unequal lists, counters store
value/decimals/prefix/suffix, and a CSS failsafe reveals [data-reveal]
(brief §5.7).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 3: Content schemas — block registry, page documents, globals, view types

Isomorphic Zod (no React, no server imports). Everything later tasks validate or render against.

**Files:**
- Create: `blocks/fields.ts`, `blocks/rich-text.ts`, `blocks/define-block.ts`, `blocks/home.ts`, `blocks/about.ts`, `blocks/services.ts`, `blocks/insights.ts`, `blocks/contact.ts`, `blocks/richtext.ts`, `blocks/registry.ts`, `blocks/page.ts`, `blocks/media-refs.ts`
- Create: `lib/media.ts`, `lib/content/globals.ts`, `lib/content/types.ts`
- Test: `blocks/registry.test.ts`, `blocks/page.test.ts`, `blocks/media-refs.test.ts`, `lib/content/globals.test.ts`

**Interfaces:**
- Consumes: `ICON_NAMES` (Task 1), `type StatValue` (Task 2).
- Produces (`blocks/fields.ts`): `text(max)`, `optionalText(max)`, `Anchor`, `Href`, `LinkValue`, `MediaRef` (`{ mediaId: uuid }`), `Focal`, `Tint`, `IconField`, `StatValue`, `Stat`, `Selection` (`{ mode: "all" } | { mode: "chosen"; ids: uuid[] }`), `Variant` (`"home" | "page"`).
- Produces (`blocks/registry.ts`): `BLOCKS` (22), `BLOCK_BY_TYPE`, `type BlockType`, `BlockInstance` (schema + type), `type BlockData<T>`.
- Produces (`blocks/page.ts`): `PageDocument`, `PageSeo`, `PageSettings` (schemas + types), `pageDocumentFor(kind: PageKind)`; (`blocks/define-block.ts`): `PAGE_KINDS`, `type PageKind`, `defineBlock`.
- Produces (`blocks/media-refs.ts`): `type Resolve<T>`, `type BlockView<T extends BlockType>`, `collectMediaIds(value): string[]`, `resolveMedia<T>(value, assets: ReadonlyMap<string, MediaAsset>): Resolve<T>`.
- Produces (`lib/media.ts`): `type MediaAsset = { id: string | null; src: string; width: number; height: number; blurDataURL: string | null; alt: string; focal: { x: number; y: number } | null }`, `fromPath(src): MediaAsset` (transitional, removed in Task 10).
- Produces (`lib/content/globals.ts`): one schema per §6.4 key, `GLOBALS`, `type GlobalKey`, `type GlobalValue<K>`, `PUBLIC_GLOBAL_KEYS`, `type PublicGlobalKey`, `parseGlobal(key, value)`, `SITE_TOKENS`.
- Produces (`lib/content/types.ts`): `ServiceView`, `PlanView`, `TestimonialView`, `FaqView`, `StepFrame`, `ProcessStepView`, `CtaBandView`, `CategoryView`, `ArticleSummary`, `ArticleDetail`, `ContactOption`, `PlanOption`, `PublishedPage`, `Chapter`, `GlobalView<K>`.

- [ ] **Step 1: Write the failing tests**

```ts
// blocks/registry.test.ts
import { describe, expect, it } from "vitest"

import { Href, StatValue, Anchor } from "./fields"
import { aboutApproach } from "./about"
import { credibility } from "./home"
import { BLOCKS, BlockInstance } from "./registry"
import { RichTextDoc } from "./rich-text"

describe("block registry", () => {
  it("declares the 22 section types once each", () => {
    const types = BLOCKS.map((block) => block.type)
    expect(types).toHaveLength(22)
    expect(new Set(types).size).toBe(22)
  })

  it("rejects empty data for every block that has required fields", () => {
    for (const block of BLOCKS) {
      expect(block.schema.safeParse({}).success, block.type).toBe(false)
    }
  })

  it("holds item counts to what the layout can carry", () => {
    const badge = { title: "Badge", subtitle: "Sub", icon: "shield" }
    const ok = (n: number) =>
      credibility.schema.safeParse({ badges: Array(n).fill(badge) }).success
    expect([ok(2), ok(3), ok(5), ok(6)]).toEqual([false, true, true, false])

    const principle = { icon: "evidence", title: "T", body: "B" }
    const three = (n: number) =>
      aboutApproach.schema.safeParse({
        eyebrow: "E",
        title: "T",
        subtitle: "S",
        principles: Array(n).fill(principle),
      }).success
    expect([three(2), three(3), three(4)]).toEqual([false, true, false])
  })

  it("only accepts safe hrefs", () => {
    for (const href of ["/contact", "/contact?topic=sleep-rest", "#faq"]) {
      expect(Href.safeParse(href).success, href).toBe(true)
    }
    for (const href of ["javascript:alert(1)", "//evil.example", "http://x.ie", ""]) {
      expect(Href.safeParse(href).success, href).toBe(false)
    }
  })

  it("accepts kebab-case anchors only", () => {
    expect(Anchor.safeParse("how-it-works").success).toBe(true)
    expect(Anchor.safeParse("How It Works").success).toBe(false)
    expect(Anchor.safeParse("-faq").success).toBe(false)
  })

  it("stores counters as numbers", () => {
    expect(
      StatValue.safeParse({ kind: "count", value: 4.9, decimals: 1, prefix: "", suffix: "/5" }).success
    ).toBe(true)
    expect(StatValue.safeParse({ kind: "count", value: "10+" }).success).toBe(false)
  })

  it("validates TipTap documents", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Lead." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "H" }] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Bold.", marks: [{ type: "bold" }] },
                    { type: "text", text: " Rest" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    expect(RichTextDoc.safeParse(doc).success).toBe(true)
    const h1 = { type: "doc", content: [{ type: "heading", attrs: { level: 1 } }] }
    expect(RichTextDoc.safeParse(h1).success).toBe(false)
  })

  it("discriminates instances by type", () => {
    const parsed = BlockInstance.safeParse({
      id: "home-faq",
      type: "faq",
      anchor: "faq",
      chapter: "FAQ",
      hidden: false,
      joinPrevious: false,
      data: { variant: "home", title: "FAQ", subtitle: "S", selection: { mode: "all" }, initiallyOpen: 0 },
    })
    expect(parsed.success).toBe(true)
  })
})
```

```ts
// blocks/page.test.ts
import { describe, expect, it } from "vitest"

import { pageDocumentFor } from "./page"

const MEDIA = { mediaId: "00000000-0000-4000-8000-000000000001" }
const hero = {
  id: "about-home",
  type: "hero.page",
  anchor: "home",
  chapter: "Welcome",
  hidden: false,
  joinPrevious: false,
  data: { title: "About", subtitle: "S", image: MEDIA, focal: null, tint: 0.32, mirror: false },
}
const faq = (anchor: string, extra = {}) => ({
  id: `about-${anchor}`,
  type: "faq",
  anchor,
  chapter: null,
  hidden: false,
  joinPrevious: false,
  data: { variant: "page", title: "FAQ", subtitle: "S", selection: { mode: "all" }, initiallyOpen: 0 },
  ...extra,
})
const messages = (kind: Parameters<typeof pageDocumentFor>[0], blocks: unknown[]) => {
  const result = pageDocumentFor(kind).safeParse({ blocks })
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe("page document rules", () => {
  it("accepts a well-formed page", () => {
    expect(messages("about", [hero, faq("faq")])).toEqual([])
  })
  it("rejects duplicate anchors", () => {
    expect(messages("about", [hero, faq("faq"), faq("faq", { id: "about-faq-2" })])).toContain(
      'Anchor "faq" is already used on this page'
    )
  })
  it('reserves "home" for the hero, and gives every hero that anchor', () => {
    expect(messages("about", [faq("home")])).toContain('"home" is reserved for the page hero')
    expect(messages("about", [{ ...hero, anchor: "top" }])).toContain('A hero\'s anchor is "home"')
  })
  const grid = (anchor: string) => ({
    id: `services-${anchor}`,
    type: "services.grid",
    anchor,
    chapter: null,
    hidden: false,
    joinPrevious: false,
    data: { eyebrow: "E", title: "T", intro: "I", more: { label: "More", href: "#formats" } },
  })
  it("keeps heroes first and blocks on the pages they belong to", () => {
    expect(messages("about", [faq("faq"), { ...hero, anchor: "top" }])).toContain(
      "Page hero must be the first block"
    )
    expect(messages("about", [hero, grid("services")])).toContain(
      "Services grid is not allowed on this page"
    )
  })
  it("caps per-type counts", () => {
    expect(messages("services", [hero, grid("a"), grid("b")])).toContain(
      "At most 1 Services grid per page"
    )
  })
  it("never lets the first block join a previous card", () => {
    expect(messages("about", [{ ...hero, joinPrevious: true }])).toContain(
      "The first block cannot join a previous card"
    )
  })
})
```

```ts
// blocks/media-refs.test.ts
import { describe, expect, it } from "vitest"

import type { MediaAsset } from "@/lib/media"

import { collectMediaIds, resolveMedia } from "./media-refs"

const A = "00000000-0000-4000-8000-00000000000a"
const asset: MediaAsset = {
  id: A,
  src: "/images/a.png",
  width: 10,
  height: 20,
  blurDataURL: null,
  alt: "",
  focal: { x: 0.5, y: 0.5 },
}

describe("media references", () => {
  const data = { image: { mediaId: A }, list: [{ avatar: { mediaId: A } }], title: "T" }

  it("collects each id once, at any depth", () => {
    expect(collectMediaIds(data)).toEqual([A])
  })
  it("swaps references for assets and leaves the rest", () => {
    expect(resolveMedia(data, new Map([[A, asset]]))).toEqual({
      image: asset,
      list: [{ avatar: asset }],
      title: "T",
    })
  })
  it("fails loudly on a missing asset", () => {
    expect(() => resolveMedia(data, new Map())).toThrow(/Media .* is missing/)
  })
})
```

```ts
// lib/content/globals.test.ts
import { describe, expect, it } from "vitest"

import { GLOBALS, parseGlobal } from "./globals"

describe("globals", () => {
  it("every key parses an empty document to safe defaults", () => {
    for (const key of Object.keys(GLOBALS) as (keyof typeof GLOBALS)[]) {
      expect(() => parseGlobal(key, undefined), key).not.toThrow()
    }
    expect(parseGlobal("navigation", undefined)).toEqual({
      links: [],
      cta: { label: "", href: "" },
    })
  })
  it("theme accepts hex colours only (it is written into a <style> tag)", () => {
    expect(() => parseGlobal("theme", { site: { brand: "#336060" } })).not.toThrow()
    expect(() => parseGlobal("theme", { site: { brand: "red" } })).toThrow()
    expect(() =>
      parseGlobal("theme", { site: { brand: "#000000;}</style>" } })
    ).toThrow()
  })
  it("rejects a malformed E.164 number and a title template without %s", () => {
    expect(() => parseGlobal("contact", { phone: { e164: "01 234" } })).toThrow()
    expect(() => parseGlobal("seo", { titleTemplate: "Magda" })).toThrow()
  })
})
```

Run: `pnpm vitest run --project unit blocks lib/content` → FAIL (modules missing).

- [ ] **Step 2: Shared fields, rich text, `defineBlock`, `MediaAsset`**

```ts
// blocks/fields.ts
import * as z from "zod"

import type { StatValue as StatValueType } from "@/lib/count"
import { ICON_NAMES } from "@/lib/icons"

// Limits are what the design can carry (docs/brief.md §5.7 rule 7): longer
// copy or more items wrap into layouts that were never drawn for them.
export const text = (max: number) => z.string().trim().min(1).max(max)
export const optionalText = (max: number) => z.string().trim().max(max)

// Section ids: unique per page (blocks/page.ts) and used by the JourneyRail.
export const Anchor = z
  .string()
  .max(40)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, "Use lower-case kebab-case, e.g. how-it-works")

// Site paths, in-page anchors, https, mailto and tel only, so no
// javascript: or protocol-relative URL can reach an href.
export const Href = z
  .string()
  .trim()
  .max(300)
  .regex(/^(\/(?!\/)|#[a-z]|https:\/\/|mailto:|tel:)/, "Use /path, #anchor, https://, mailto: or tel:")

export const LinkValue = z.object({ label: text(60), href: Href })
export const MediaRef = z.object({ mediaId: z.uuid() })
export const Focal = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
export const Tint = z.number().min(0).max(0.9)
export const IconField = z.enum(ICON_NAMES)

export const StatValue = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("count"),
    value: z.number().nonnegative().max(1e9),
    decimals: z.number().int().min(0).max(2),
    prefix: z.string().max(4),
    suffix: z.string().max(8),
  }),
  z.object({ kind: z.literal("text"), text: text(16) }),
]) satisfies z.ZodType<StatValueType>

export const Stat = z.object({ value: StatValue, label: text(60) })

export const Selection = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({ mode: z.literal("chosen"), ids: z.array(z.uuid()).min(1).max(24) }),
])

export const Variant = z.enum(["home", "page"])
```

```ts
// blocks/rich-text.ts
import * as z from "zod"

import { Href } from "./fields"

// The subset of TipTap/ProseMirror JSON the site renders (article bodies and
// the richtext block). Phase 5's editor produces exactly these nodes.
const Mark = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("link"), attrs: z.object({ href: Href }) }),
])
const TextNode = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(5000),
  marks: z.array(Mark).max(3).optional(),
})
const Paragraph = z.object({
  type: z.literal("paragraph"),
  content: z.array(TextNode).max(50).optional(),
})
const Heading = z.object({
  type: z.literal("heading"),
  attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
  content: z.array(TextNode).max(20).optional(),
})
const ListItem = z.object({
  type: z.literal("listItem"),
  content: z.array(Paragraph).min(1).max(5),
})
const BulletList = z.object({
  type: z.literal("bulletList"),
  content: z.array(ListItem).min(1).max(30),
})
const Blockquote = z.object({
  type: z.literal("blockquote"),
  content: z.array(Paragraph).min(1).max(5),
})

export const RichTextDoc = z.object({
  type: z.literal("doc"),
  content: z
    .array(z.discriminatedUnion("type", [Paragraph, Heading, BulletList, Blockquote]))
    .max(400),
})

export type RichTextDoc = z.infer<typeof RichTextDoc>
export type RichTextNode = RichTextDoc["content"][number]
export type RichTextInline = z.infer<typeof TextNode>
```

```ts
// blocks/define-block.ts
import type * as z from "zod"

// What a page is, for block placement rules. System pages have fixed keys;
// everything an editor creates is "custom".
export const PAGE_KINDS = [
  "home",
  "about",
  "services",
  "how-it-works",
  "insights",
  "contact",
  "custom",
] as const
export type PageKind = (typeof PAGE_KINDS)[number]

export type BlockDefinition<T extends string, S extends z.ZodType> = {
  type: T
  label: string
  // lucide-react icon name for the admin block library (Phase 4).
  icon: string
  schema: S
  allowedOn: "*" | readonly PageKind[]
  max?: number
  first?: boolean
  // Cache tags the block reads (docs/brief.md §5.6), for invalidation audits.
  uses: readonly string[]
}

export function defineBlock<const T extends string, S extends z.ZodType>(
  definition: BlockDefinition<T, S>
) {
  return definition
}
```

```ts
// lib/media.ts
// What a section needs to draw an image. Built from a `media` row by the
// content repo; blocks store only { mediaId } (blocks/media-refs.ts).
export type MediaAsset = {
  id: string | null
  src: string
  width: number
  height: number
  blurDataURL: string | null
  alt: string
  focal: { x: number; y: number } | null
}

// Transitional (Tasks 4–9): pages still feed sections from fixtures, which
// hold public paths. Sections that use it either `fill` or pass their own
// width/height. Removed in Task 10.
export const fromPath = (src: string): MediaAsset => ({
  id: null,
  src,
  width: 0,
  height: 0,
  blurDataURL: null,
  alt: "",
  focal: null,
})
```

- [ ] **Step 3: The 22 block definitions**

```ts
// blocks/home.ts
import * as z from "zod"

import { defineBlock } from "./define-block"
import {
  IconField,
  LinkValue,
  MediaRef,
  Selection,
  Stat,
  StatValue,
  Tint,
  Variant,
  optionalText,
  text,
} from "./fields"

export const heroHome = defineBlock({
  type: "hero.home",
  label: "Home hero",
  icon: "Sparkles",
  schema: z.object({
    eyebrow: text(40),
    headline: z.object({ lead: text(40), muted: text(60), tail: text(80) }),
    description: text(240),
    primaryCta: LinkValue,
    secondaryCta: LinkValue,
    members: z.object({
      count: StatValue,
      label: text(30),
      avatars: z.array(MediaRef).length(3),
    }),
  }),
  // The WebGL background is bound to its depth and hair maps (D13): only the
  // copy is editable.
  allowedOn: ["home"],
  first: true,
  max: 1,
  uses: ["media"],
})

export const credibility = defineBlock({
  type: "credibility",
  label: "Credibility badges",
  icon: "BadgeCheck",
  schema: z.object({
    badges: z
      .array(z.object({ title: text(40), subtitle: text(40), icon: IconField }))
      .min(3)
      .max(5),
  }),
  allowedOn: "*",
  uses: [],
})

export const aboutIntro = defineBlock({
  type: "about.intro",
  label: "About intro",
  icon: "UserRound",
  schema: z.object({
    eyebrow: text(40),
    headline: text(120),
    quote: text(160),
    paragraphs: z.array(text(600)).min(1).max(3),
    stats: z.array(Stat).min(2).max(4),
    cta: LinkValue,
  }),
  allowedOn: "*",
  uses: [],
})

// Not `process`: that would shadow Node's global in every importer.
export const processBlock = defineBlock({
  type: "process",
  label: "Process steps",
  icon: "Footprints",
  schema: z.object({
    variant: Variant,
    // Pill above the heading; shown on the "page" variant only.
    tag: optionalText(30),
    title: text(60),
    subtitle: text(240),
    cta: LinkValue,
  }),
  allowedOn: "*",
  // One StepsStory pin per page.
  max: 1,
  uses: ["collection:steps", "media"],
})

export const testimonials = defineBlock({
  type: "testimonials",
  label: "Testimonials",
  icon: "Quote",
  schema: z.object({
    variant: Variant,
    eyebrow: text(40),
    title: text(80),
    selection: Selection,
  }),
  allowedOn: "*",
  uses: ["collection:testimonials", "media"],
})

export const band = defineBlock({
  type: "band",
  label: "Call-to-action band",
  icon: "Megaphone",
  schema: z.object({ bandId: z.uuid(), tint: Tint.nullable() }),
  allowedOn: "*",
  uses: ["collection:bands", "media"],
})

export const insightsLatest = defineBlock({
  type: "insights.latest",
  label: "Latest insights",
  icon: "Newspaper",
  schema: z.object({
    title: text(60),
    subtitle: text(200),
    cta: LinkValue,
    count: z.number().int().min(1).max(6),
    // "all" shows the newest; "chosen" shows those articles in that order.
    selection: Selection,
  }),
  allowedOn: "*",
  uses: ["articles", "categories", "authors", "media"],
})

export const faq = defineBlock({
  type: "faq",
  label: "FAQ",
  icon: "CircleHelp",
  schema: z.object({
    variant: Variant,
    title: text(80),
    subtitle: text(200),
    selection: Selection,
    // Index of the item open on load; null starts all closed.
    initiallyOpen: z.number().int().min(0).max(23).nullable(),
  }),
  allowedOn: "*",
  uses: ["collection:faqs"],
})
```

```ts
// blocks/about.ts
import * as z from "zod"

import { defineBlock } from "./define-block"
import { Focal, Href, IconField, LinkValue, MediaRef, Stat, text } from "./fields"

export const heroPage = defineBlock({
  type: "hero.page",
  label: "Page hero",
  icon: "PanelTop",
  schema: z.object({
    title: text(40),
    subtitle: text(200),
    image: MediaRef,
    // Per-page crop; null uses the image's own focal point.
    focal: Focal.nullable(),
    tint: z.number().min(0).max(0.9),
    mirror: z.boolean(),
  }),
  allowedOn: "*",
  first: true,
  max: 1,
  uses: ["media", "settings:microcopy"],
})

export const aboutStory = defineBlock({
  type: "about.story",
  label: "Story",
  icon: "BookOpen",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    paragraphs: z.array(text(600)).min(1).max(4),
    quote: text(240),
    badge: Stat,
    role: text(60),
    photo: MediaRef,
  }),
  allowedOn: "*",
  uses: ["media", "settings:site"],
})

export const aboutStats = defineBlock({
  type: "about.stats",
  label: "Stats band",
  icon: "ChartNoAxesColumn",
  schema: z.object({ stats: z.array(Stat).min(3).max(4) }),
  allowedOn: "*",
  uses: [],
})

export const aboutApproach = defineBlock({
  type: "about.approach",
  label: "Approach",
  icon: "Compass",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(240),
    principles: z
      .array(z.object({ icon: IconField, title: text(60), body: text(240) }))
      .length(3),
  }),
  allowedOn: "*",
  uses: [],
})

export const aboutCredentials = defineBlock({
  type: "about.credentials",
  label: "Credentials",
  icon: "GraduationCap",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(240),
    cta: LinkValue,
    items: z
      .array(
        z.object({
          year: z.string().regex(/^\d{4}$/),
          title: text(80),
          issuer: text(80),
          url: Href.nullable(),
        })
      )
      .min(3)
      .max(8),
  }),
  allowedOn: "*",
  uses: [],
})
```

```ts
// blocks/services.ts
import * as z from "zod"

import { defineBlock } from "./define-block"
import { LinkValue, text } from "./fields"

export const servicesGrid = defineBlock({
  type: "services.grid",
  label: "Services grid",
  icon: "LayoutGrid",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    intro: text(400),
    more: LinkValue,
  }),
  allowedOn: ["services"],
  max: 1,
  uses: ["collection:services"],
})

export const servicesPlans = defineBlock({
  type: "services.plans",
  label: "Formats & investment",
  icon: "Tags",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(240),
    featuredTag: text(20),
  }),
  allowedOn: "*",
  max: 1,
  uses: ["collection:plans"],
})

export const sessionTimeline = defineBlock({
  type: "session.timeline",
  label: "Session timeline",
  icon: "Clock",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(240),
    beats: z
      .array(z.object({ time: text(20), title: text(60), body: text(200) }))
      .min(3)
      .max(6),
  }),
  allowedOn: "*",
  uses: [],
})

const FitList = z.object({
  heading: text(60),
  items: z.array(text(100)).min(2).max(6),
})

export const fit = defineBlock({
  type: "fit",
  label: "Honest fit",
  icon: "Scale",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(240),
    good: FitList,
    poor: FitList,
  }),
  allowedOn: "*",
  uses: [],
})
```

```ts
// blocks/insights.ts
import * as z from "zod"

import { defineBlock } from "./define-block"
import { optionalText, text } from "./fields"

export const insightsBrowser = defineBlock({
  type: "insights.browser",
  label: "Insights browser",
  icon: "LibraryBig",
  schema: z.object({
    heading: text(60),
    pageSize: z.number().int().min(3).max(12),
  }),
  allowedOn: ["insights"],
  max: 1,
  uses: ["articles", "categories", "authors", "media", "settings:microcopy"],
})

export const newsletter = defineBlock({
  type: "newsletter",
  label: "Newsletter band",
  icon: "Mail",
  schema: z.object({
    // Empty fields fall back to the newsletter global.
    override: z
      .object({
        eyebrow: optionalText(40),
        title: optionalText(120),
        subtitle: optionalText(240),
      })
      .nullable(),
  }),
  allowedOn: "*",
  uses: ["settings:newsletter", "media"],
})
```

```ts
// blocks/contact.ts
import * as z from "zod"

import { defineBlock } from "./define-block"
import { MediaRef, text } from "./fields"

export const contactDetails = defineBlock({
  type: "contact.details",
  label: "Contact details & form",
  icon: "MessageSquareText",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(300),
  }),
  allowedOn: ["contact"],
  max: 1,
  uses: [
    "settings:contact",
    "settings:contactForm",
    "settings:microcopy",
    "collection:services",
    "collection:plans",
  ],
})

export const contactClinic = defineBlock({
  type: "contact.clinic",
  label: "Clinic",
  icon: "MapPin",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(300),
    photo: MediaRef,
  }),
  allowedOn: "*",
  uses: ["settings:contact", "settings:microcopy", "media"],
})
```

```ts
// blocks/richtext.ts
import * as z from "zod"

import { defineBlock } from "./define-block"
import { RichTextDoc } from "./rich-text"

export const richtext = defineBlock({
  type: "richtext",
  label: "Rich text",
  icon: "Pilcrow",
  schema: z.object({ doc: RichTextDoc, width: z.enum(["narrow", "wide"]) }),
  allowedOn: ["custom"],
  uses: [],
})
```

- [ ] **Step 4: Registry, page documents, media references**

```ts
// blocks/registry.ts
import * as z from "zod"

import { aboutApproach, aboutCredentials, aboutStats, aboutStory, heroPage } from "./about"
import { contactClinic, contactDetails } from "./contact"
import { Anchor } from "./fields"
import {
  aboutIntro,
  band,
  credibility,
  faq,
  heroHome,
  insightsLatest,
  processBlock,
  testimonials,
} from "./home"
import { insightsBrowser, newsletter } from "./insights"
import { richtext } from "./richtext"
import { fit, servicesGrid, servicesPlans, sessionTimeline } from "./services"

// One entry per existing section design (docs/brief.md §6.2). API validation,
// admin forms, the renderer and the types all read this list.
export const BLOCKS = [
  heroHome,
  heroPage,
  credibility,
  aboutIntro,
  processBlock,
  testimonials,
  band,
  insightsLatest,
  faq,
  aboutStory,
  aboutStats,
  aboutApproach,
  aboutCredentials,
  servicesGrid,
  servicesPlans,
  sessionTimeline,
  fit,
  insightsBrowser,
  newsletter,
  contactDetails,
  contactClinic,
  richtext,
] as const

type AnyBlock = (typeof BLOCKS)[number]
export type BlockType = AnyBlock["type"]

export const BLOCK_BY_TYPE = Object.fromEntries(
  BLOCKS.map((block) => [block.type, block])
) as { [B in AnyBlock as B["type"]]: B }

const base = {
  // Stable across edits so the editor can follow a block. Seeded ids are
  // "<page>-<anchor>"; Phase 4 mints nanoids.
  id: z.string().regex(/^[A-Za-z0-9_-]{4,48}$/),
  anchor: Anchor,
  // JourneyRail label; null keeps the block out of the rail.
  chapter: z.string().trim().min(1).max(24).nullable(),
  hidden: z.boolean(),
  // Render inside the previous StackCard (e.g. Credibility + About intro).
  joinPrevious: z.boolean(),
}

const instance = <const T extends string, S extends z.ZodType>(block: {
  type: T
  schema: S
}) => z.object({ ...base, type: z.literal(block.type), data: block.schema })

export const BlockInstance = z.discriminatedUnion("type", [
  instance(heroHome),
  instance(heroPage),
  instance(credibility),
  instance(aboutIntro),
  instance(processBlock),
  instance(testimonials),
  instance(band),
  instance(insightsLatest),
  instance(faq),
  instance(aboutStory),
  instance(aboutStats),
  instance(aboutApproach),
  instance(aboutCredentials),
  instance(servicesGrid),
  instance(servicesPlans),
  instance(sessionTimeline),
  instance(fit),
  instance(insightsBrowser),
  instance(newsletter),
  instance(contactDetails),
  instance(contactClinic),
  instance(richtext),
])

export type BlockInstance = z.infer<typeof BlockInstance>
export type BlockData<T extends BlockType> = Extract<BlockInstance, { type: T }>["data"]
```

```ts
// blocks/page.ts
import * as z from "zod"

import type { PageKind } from "./define-block"
import { MediaRef } from "./fields"
import { BLOCK_BY_TYPE, BlockInstance, type BlockType } from "./registry"

export const PageDocument = z.object({
  blocks: z.array(BlockInstance).min(1).max(40),
})
export type PageDocument = z.infer<typeof PageDocument>

// Live on save, separate from the document (docs/brief.md §6.5).
export const PageSeo = z.object({
  title: z.string().trim().max(70).nullable().default(null),
  description: z.string().trim().max(200).nullable().default(null),
  ogImage: MediaRef.nullable().default(null),
  noindex: z.boolean().default(false),
})
export type PageSeo = z.infer<typeof PageSeo>

export const PageSettings = z.object({
  // Adds the footer's "Contact" chapter to the rail.
  showContactChapter: z.boolean().default(true),
  // Seeded placeholder copy (legal pages) that an editor must replace.
  needsReview: z.boolean().default(false),
})
export type PageSettings = z.infer<typeof PageSettings>

// Rules no single block can check: anchors are section ids and must be
// unique, "home" belongs to the first card, and placement/limits hold.
export function pageDocumentFor(kind: PageKind) {
  return PageDocument.superRefine((doc, ctx) => {
    const seen = new Set<string>()
    const counts = new Map<BlockType, number>()
    doc.blocks.forEach((block, i) => {
      const def = BLOCK_BY_TYPE[block.type]
      const issue = (message: string, field: string) =>
        ctx.addIssue({ code: "custom", path: ["blocks", i, field], message })
      if (seen.has(block.anchor)) {
        issue(`Anchor "${block.anchor}" is already used on this page`, "anchor")
      }
      seen.add(block.anchor)
      // The first card is always #home (BlockRenderer). Heroes own that id and
      // render none of their own; every other section renders its anchor.
      const hero = block.type === "hero.home" || block.type === "hero.page"
      if (hero && block.anchor !== "home") issue('A hero\'s anchor is "home"', "anchor")
      if (!hero && block.anchor === "home") {
        issue('"home" is reserved for the page hero', "anchor")
      }
      if (i === 0 && block.joinPrevious) {
        issue("The first block cannot join a previous card", "joinPrevious")
      }
      if (def.first && i !== 0) issue(`${def.label} must be the first block`, "type")
      if (def.allowedOn !== "*" && !def.allowedOn.includes(kind)) {
        issue(`${def.label} is not allowed on this page`, "type")
      }
      const n = (counts.get(block.type) ?? 0) + 1
      counts.set(block.type, n)
      if (def.max && n > def.max) issue(`At most ${def.max} ${def.label} per page`, "type")
    })
  })
}
```

```ts
// blocks/media-refs.ts
import type { MediaAsset } from "@/lib/media"

import type { BlockData, BlockType } from "./registry"

// Blocks and globals store images as { mediaId }. The renderer swaps every
// reference for its asset before a section sees the data.
export type Resolve<T> = T extends { mediaId: string }
  ? MediaAsset
  : T extends readonly (infer U)[]
    ? Resolve<U>[]
    : T extends object
      ? { [K in keyof T]: Resolve<T[K]> }
      : T

export type BlockView<T extends BlockType> = Resolve<BlockData<T>>

const isRef = (value: unknown): value is { mediaId: string } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { mediaId?: unknown }).mediaId === "string"

export function collectMediaIds(value: unknown): string[] {
  const ids = new Set<string>()
  const walk = (node: unknown) => {
    if (isRef(node)) ids.add(node.mediaId)
    else if (Array.isArray(node)) node.forEach(walk)
    else if (node && typeof node === "object") Object.values(node).forEach(walk)
  }
  walk(value)
  return [...ids]
}

// A missing asset is a broken reference (Phase 4's delete guard prevents
// it); fail loudly rather than render an image with no source.
export function resolveMedia<T>(
  value: T,
  assets: ReadonlyMap<string, MediaAsset>
): Resolve<T> {
  const walk = (node: unknown): unknown => {
    if (isRef(node)) {
      const asset = assets.get(node.mediaId)
      if (!asset) throw new Error(`Media ${node.mediaId} is missing`)
      return asset
    }
    if (Array.isArray(node)) return node.map(walk)
    if (node && typeof node === "object") {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]))
    }
    return node
  }
  return walk(value) as Resolve<T>
}
```

- [ ] **Step 5: Globals**

Every field has a default so that a missing row (before the seed) parses to an empty, renderable document; nested objects use Zod 4's `.prefault({})`, which runs the defaults inside them (`.default({})` would return `{}` unparsed).

```ts
// lib/content/globals.ts
import * as z from "zod"

import { Href, MediaRef } from "@/blocks/fields"

const s = (max: number) => z.string().trim().max(max).default("")
const Link = z.object({ label: s(60), href: Href.or(z.literal("")).default("") })
const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
// ISO weekday: 1 = Monday … 7 = Sunday.
const Day = z.number().int().min(1).max(7)
const Hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a #rrggbb colour")

// Site colour tokens the theme can override (app/(site)/site.css @theme).
export const SITE_TOKENS = [
  "brand",
  "brand-mint",
  "cream",
  "brand-deep",
  "clay",
  "stone",
  "mist",
  "forest",
  "pine",
  "ink",
  "ink-muted",
  "text-strong",
  "text-muted",
  "text-subtle",
  "line",
  "line-soft",
  "line-neutral",
  "line-faint",
  "line-rule",
  "surface-soft",
  "surface-warm",
  "hero-base",
  "moss",
  "spruce",
] as const

export const SiteGlobal = z.object({
  name: s(80),
  legalName: s(120),
  professionalTitle: s(120),
  logo: MediaRef.nullable().default(null),
  icon: MediaRef.nullable().default(null),
  locale: z.literal("en-IE").default("en-IE"),
  timeZone: z.literal("Europe/Dublin").default("Europe/Dublin"),
  social: z.array(z.object({ label: s(40), url: z.url() })).max(10).default([]),
})

export const ContactGlobal = z.object({
  email: z.email().or(z.literal("")).default(""),
  phone: z
    .object({
      display: s(40),
      e164: z.string().regex(/^(\+[1-9]\d{6,14})?$/, "Use E.164, e.g. +35312345678").default(""),
    })
    .prefault({}),
  address: z
    .object({
      lines: z.array(s(80)).max(4).default([]),
      city: s(60),
      eircode: s(10),
      country: s(60),
    })
    .prefault({}),
  hours: z
    .object({
      weekly: z
        .array(z.object({ days: z.array(Day).min(1).max(7), opens: Time, closes: Time }))
        .max(7)
        .default([]),
      // How the site prints the hours; the structured list feeds JSON-LD (Phase 7).
      summary: s(120),
      note: s(200),
    })
    .prefault({}),
  clinic: z
    .object({
      name: s(80),
      description: s(400),
      photo: MediaRef.nullable().default(null),
      onlineNote: s(200),
      geo: z
        .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
        .nullable()
        .default(null),
    })
    .prefault({}),
})

export const NavigationGlobal = z.object({
  links: z.array(Link).max(7).default([]),
  cta: Link.prefault({}),
})

export const FooterGlobal = z.object({
  blurb: s(300),
  columns: z
    .array(
      z.object({
        title: s(40),
        // "navigation" appends the header links after `links` (auto sitemap).
        source: z.enum(["navigation", "links"]).default("links"),
        links: z.array(Link).max(10).default([]),
      })
    )
    .max(4)
    .default([]),
  contactLines: z.array(s(80)).max(4).default([]),
  contactNote: s(200),
  legalLinks: z.array(Link).max(6).default([]),
  copyrightName: s(80),
})

export const NewsletterGlobal = z.object({
  eyebrow: s(40),
  title: s(120),
  subtitle: s(240),
  emailLabel: s(40),
  placeholder: s(60),
  button: s(30),
  success: s(200),
  image: MediaRef.nullable().default(null),
  tint: z.number().min(0).max(0.9).default(0.9),
  confirmationEmail: z.object({ subject: s(120), body: s(2000) }).prefault({}),
})

export const ContactFormGlobal = z.object({
  title: s(80),
  labels: z
    .object({ name: s(40), email: s(40), phone: s(40), topic: s(60), format: s(40), message: s(40) })
    .prefault({}),
  placeholders: z
    .object({ name: s(60), email: s(60), phone: s(30), topic: s(60), message: s(160) })
    .prefault({}),
  // Topics beyond the services collection ("Something else").
  extraTopics: z.array(s(60)).max(4).default([]),
  formats: z.array(s(60)).max(6).default([]),
  consent: s(300),
  button: s(40),
  sendAnother: s(40),
  success: z.object({ title: s(120), body: s(300) }).prefault({}),
  errors: z
    .object({ name: s(80), email: s(80), topic: s(80), consent: s(80) })
    .prefault({}),
  // "{name}", "{price}" and "{unit}" come from the plan in ?plan=.
  planMessage: s(200),
})

export const MicrocopyGlobal = z.object({
  breadcrumbHome: s(30),
  breadcrumbInsights: s(30),
  featured: s(30),
  featuredLabel: s(40),
  readArticle: s(40),
  // "{minutes}" is replaced.
  readTime: s(30),
  allArticles: s(30),
  filterLabel: s(40),
  searchLabel: s(40),
  searchPlaceholder: s(40),
  // "{shown}" and "{total}" are replaced.
  showing: s(60),
  noResults: s(80),
  clearFilters: s(30),
  pagination: s(30),
  previousPage: s(30),
  nextPage: s(30),
  // "{n}" is replaced.
  pageLabel: s(30),
  writtenBy: s(30),
  share: s(30),
  copyLink: s(30),
  linkCopied: s(30),
  shareEmail: s(30),
  allInsights: s(40),
  keepReading: s(40),
  viewAllInsights: s(40),
  articleCta: z.object({ title: s(80), body: s(300), button: s(40) }).prefault({}),
  directions: s(40),
  contactChannels: z
    .object({ email: s(20), phone: s(20), clinic: s(20), hours: s(20) })
    .prefault({}),
  contactChapter: s(24),
  articleChapters: z
    .object({ welcome: s(24), article: s(24), keepReading: s(24), newsletter: s(24) })
    .prefault({}),
})

export const SeoGlobal = z.object({
  titleTemplate: z
    .string()
    .max(60)
    .refine((v) => v === "" || v.includes("%s"), 'The template needs "%s"')
    .default(""),
  defaultTitle: s(70),
  defaultDescription: s(200),
  defaultOgImage: MediaRef.nullable().default(null),
  robots: z.enum(["index", "noindex"]).default("index"),
  verification: z.object({ google: s(100), bing: s(100) }).prefault({}),
  business: z
    .object({
      type: z.enum(["ProfessionalService", "LocalBusiness"]).default("ProfessionalService"),
      priceRange: s(10),
      sameAs: z.array(z.url()).max(10).default([]),
    })
    .prefault({}),
})

export const TrackingGlobal = z.object({
  gtmId: s(20),
  ga4Id: s(20),
  metaPixelId: s(20),
  // Encrypted at rest (Phase 8); never sent to the browser.
  capiTokenEncrypted: z.string().nullable().default(null),
  testEventCode: s(40),
  enabled: z
    .object({
      gtm: z.boolean().default(false),
      ga4: z.boolean().default(false),
      meta: z.boolean().default(false),
      capi: z.boolean().default(false),
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
  policyHref: Href.or(z.literal("")).default(""),
  categories: z.object({ analytics: s(300), marketing: s(300) }).prefault({}),
  reconsentMonths: z.number().int().min(1).max(24).default(12),
  version: z.number().int().min(1).default(1),
})

export const ScriptsGlobal = z.object({
  snippets: z
    .array(
      z.object({
        name: s(60),
        placement: z.enum(["head", "body-start", "body-end"]),
        category: z.enum(["necessary", "analytics", "marketing"]),
        code: z.string().max(20_000),
      })
    )
    .max(20)
    .default([]),
})

export const ThemeGlobal = z.object({
  // Written into a <style> tag by SiteFrame, so only #rrggbb is accepted.
  site: z.partialRecord(z.enum(SITE_TOKENS), Hex).default({}),
  // Admin tokens arrive with the theme engine (Phase 9).
  admin: z.record(z.string(), z.string()).default({}),
})

export const NotificationsGlobal = z.object({
  recipients: z.array(z.email()).max(10).default([]),
  autoReply: z
    .object({ enabled: z.boolean().default(false), subject: s(120), body: s(2000) })
    .prefault({}),
})

export const PrivacyGlobal = z.object({
  enquiryRetentionMonths: z.number().int().min(1).max(120).default(24),
  newsletterDoubleOptIn: z.boolean().default(true),
  ipSaltRotatedAt: z.iso.datetime().nullable().default(null),
})

export const GLOBALS = {
  site: SiteGlobal,
  contact: ContactGlobal,
  navigation: NavigationGlobal,
  footer: FooterGlobal,
  newsletter: NewsletterGlobal,
  contactForm: ContactFormGlobal,
  microcopy: MicrocopyGlobal,
  seo: SeoGlobal,
  tracking: TrackingGlobal,
  consent: ConsentGlobal,
  scripts: ScriptsGlobal,
  theme: ThemeGlobal,
  notifications: NotificationsGlobal,
  privacy: PrivacyGlobal,
} as const

export type GlobalKey = keyof typeof GLOBALS
export type GlobalValue<K extends GlobalKey> = z.infer<(typeof GLOBALS)[K]>

// Read by public rendering. Tracking secrets and operator-only settings stay
// out (docs/brief.md §6.4).
export const PUBLIC_GLOBAL_KEYS = [
  "site",
  "contact",
  "navigation",
  "footer",
  "newsletter",
  "contactForm",
  "microcopy",
  "seo",
  "consent",
  "scripts",
  "theme",
] as const satisfies readonly GlobalKey[]
export type PublicGlobalKey = (typeof PUBLIC_GLOBAL_KEYS)[number]

export function parseGlobal<K extends GlobalKey>(key: K, value: unknown): GlobalValue<K> {
  return GLOBALS[key].parse(value ?? {}) as GlobalValue<K>
}
```

- [ ] **Step 6: View types**

```ts
// lib/content/types.ts
// What the content repo hands to sections. Shared by server and client code;
// it holds no values, only shapes.
import type { Resolve } from "@/blocks/media-refs"
import type { PageDocument, PageSeo, PageSettings } from "@/blocks/page"
import type { RichTextDoc } from "@/blocks/rich-text"
import type { IconName } from "@/lib/icons"
import type { MediaAsset } from "@/lib/media"

import type { GlobalKey, GlobalValue } from "./globals"

export type GlobalView<K extends GlobalKey> = Resolve<GlobalValue<K>>

export type ServiceView = { id: string; slug: string; title: string; body: string; icon: IconName }

export type PlanView = {
  id: string
  slug: string
  name: string
  priceLabel: string
  unit: string
  summary: string
  features: string[]
  ctaLabel: string
  featured: boolean
}

export type TestimonialView = { id: string; quote: string; name: string; role: string; avatar: MediaAsset }

export type FaqView = { id: string; question: string; answer: string }

// Crop rectangle of a step photo inside its media slot, as fractions.
export type StepFrame = { x: number; y: number; w: number; h: number }

export type ProcessStepView = {
  id: string
  title: string
  description: string
  image: MediaAsset
  frame: StepFrame
}

export type CtaBandView = {
  id: string
  eyebrow: string
  title: string
  bullets: string[]
  cta: { label: string; href: string }
  image: MediaAsset
  tint: number
}

export type CategoryView = { id: string; slug: string; name: string }

export type ArticleSummary = {
  id: string
  slug: string
  title: string
  excerpt: string
  image: MediaAsset
  category: { slug: string; name: string }
  author: { name: string; avatar: MediaAsset }
  date: { iso: string; label: string }
  readingMinutes: number
  featured: boolean
}

export type ArticleDetail = ArticleSummary & {
  body: RichTextDoc
  // Service slug for the closing CTA's ?topic= (category → related service).
  topicSlug: string | null
}

export type ContactOption = { slug: string; label: string }
export type PlanOption = { slug: string; name: string; priceLabel: string; unit: string }

export type PublishedPage = {
  id: string
  path: string
  title: string
  systemKey: string | null
  document: PageDocument
  seo: PageSeo
  settings: PageSettings
}

export type Chapter = { label: string; target: string }
```

- [ ] **Step 7: Verify**

```bash
pnpm vitest run --project unit blocks lib/content
pnpm lint && pnpm typecheck && pnpm build
pnpm exec prettier --check blocks lib/content lib/media.ts
```

Expected: PASS. (No site change, so parity is not required.) The fixture-validation half of "22 block schemas … fixture-validation tests" runs in Task 7, once the fixture → document mapping exists: every seeded page must pass `pageDocumentFor(kind)`.

- [ ] **Step 8: Commit**

```bash
git add blocks lib/media.ts lib/content
git commit -m "feat(content): block registry, page documents and global schemas

22 isomorphic block definitions with item-count and length limits, page
rules (unique anchors, placement, per-type caps), media references, and a
defaulted Zod schema for every global (brief §6.2, §6.4).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## The props-driven section pattern (Tasks 4 and 5)

Both tasks apply one mechanical pattern. The goal is that Task 9 swaps the *source* of props (fixtures → database) without touching markup.

1. **Data in, no imports.** A section takes its content as props typed from the registry: `BlockView<"faq">` for its own block data, view DTOs from `lib/content/types.ts` for collection rows, `GlobalView<…>`/`GlobalValue<…>` for globals. It never imports `features/*/data` (`import type` of a fixture type is also gone: use the view types).
2. **Anchors.** Every non-hero section takes `id: string` and renders it on its root `<section>` (or, for `InsightsBrowser`, its first `<section>`). Heading ids become `` `${id}-heading` `` (and `aria-labelledby` follows). Heroes take no id: the first `StackCard` is `#home`.
3. **Images.** `next/image` of content becomes `<MediaImage media={…} />` (Task 4) with the same `sizes`, `fill`, `priority`, `className`, `draggable`, and `blur` where the old code had `placeholder="blur"`. Brand assets that are not content (logo mark, arrow, check/cross icons, navbar texture, the WebGL hero) keep their paths.
4. **Keys.** Collection items use `item.id`. Lists of plain strings inside one block (paragraphs, bullets, features) use the index: they never reorder on the client, and content strings repeat (two testimonials share a quote).
5. **Copy.** Every user-visible literal moves to block data, a global (`microcopy`, `contactForm`, `site`, `navigation`, `footer`, `newsletter`, `contact`), or the fixture that seeds it. Accessible names that are not content (`aria-label="Main"`, `"Open menu"`) may stay.
6. **Client components** receive only what they render (the insights browser gets summaries, never bodies; the contact form gets option lists, never collections).
7. **Pages** (transitional) build the props from fixtures through `app/(site)/_legacy/views.ts` and keep their `CHAPTERS` until Task 9. Each page's JSX keeps the same `StackCard` structure.

Parity 21/21 is the acceptance test of both tasks. A diff means the markup changed: compare the DOM of the failing route before/after (`git stash` + `curl -s localhost:3000/<route>`), not the screenshot.

---

## Task 4: Props-driven sections — home, about and shared sections

**Files:**
- Create: `components/media-image.tsx`, `components/media-image.test.tsx`, `lib/content/frame.ts`, `lib/content/frame.test.ts`, `lib/contact-href.ts`, `lib/contact-href.test.ts`, `app/(site)/_legacy/views.ts`, `features/site/data/site.ts`, `features/site/data/microcopy.ts`
- Modify (components): `components/page-hero.tsx`; `features/hero/components/{hero-section,hero-content,member-badge}.tsx`; `features/credibility/components/{credibility-section,credential-item}.tsx`; `features/about/components/{about-section,stat-card}.tsx`; `features/how-it-works/components/{how-it-works-section,step-card,steps-story}.tsx`; `features/testimonials/components/{testimonials-section,testimonial-card}.tsx`; `features/enterprise/components/enterprise-section.tsx`; `features/faq/components/{faq-section,faq-accordion}.tsx`; `features/about-page/components/{story-section,stats-band,approach-section,credentials-section}.tsx`
- Modify (fixtures): `features/hero/data/hero-content.ts`, `features/how-it-works/data/{steps,session}.ts`, `features/about/data/about-content.ts`, `features/about-page/data/about-page-content.ts`, `features/enterprise/data/enterprise-content.ts`, `features/services/data/services-content.ts` (`SERVICES_HERO` only), `features/contact/data/contact-content.ts` (`CONTACT_HERO` only), `features/insights/data/articles.ts` (`INSIGHTS_HERO` only), `features/testimonials/data/testimonials.ts`
- Modify (pages): every `app/(site)/**/page.tsx` that renders a section changed here
- Modify (barrels): `features/about-page/index.ts`, `features/how-it-works/index.ts`, `features/contact/index.ts`, `features/services/index.ts`, `features/insights/index.ts` (stop re-exporting fixtures; pages import fixtures from their `data/` path)

**Interfaces:**
- Consumes: `BlockView<T>`, view types, `MediaAsset`, `fromPath` (Task 3); `Icon`, `tintStyle` (Task 1); `StatValue`, `splitColumns`, `stepsTimeline` (Task 2).
- Produces: `<MediaImage media blur? focal? alt? …ImageProps />`; `cropToFrame(crop): StepFrame`, `frameStyle(frame): { left; top; width; height }`; `contactHref(values: { topic?; format?; plan? }): string`; `SITE` (`{ name, legalName, professionalTitle }`) and `MICROCOPY` (a full `GlobalValue<"microcopy">`) fixtures; the section signatures in the checklist below.

- [ ] **Step 1: Write the failing helper tests**

```tsx
// components/media-image.test.tsx
// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { MediaAsset } from "@/lib/media"

import { MediaImage } from "./media-image"

const media: MediaAsset = {
  id: "m1",
  src: "/images/contact/contact-hero.png",
  width: 1600,
  height: 900,
  blurDataURL: "data:image/webp;base64,AAAA",
  alt: "The clinic room",
  focal: { x: 0.5, y: 0.5 },
}

describe("MediaImage", () => {
  it("maps the focal point to object-position (a per-use focal wins)", () => {
    const { container } = render(
      <MediaImage media={media} focal={{ x: 0.5, y: 0.38 }} fill sizes="100vw" />
    )
    expect(container.querySelector("img")!.style.objectPosition).toBe("50% 38%")
  })
  it("uses the asset's alt and size unless overridden", () => {
    const { container } = render(<MediaImage media={media} width={56} height={56} alt="" />)
    const img = container.querySelector("img")!
    expect(img.getAttribute("alt")).toBe("")
    expect(img.getAttribute("width")).toBe("56")
  })
  it("adds the blur placeholder only when asked", () => {
    const plain = render(<MediaImage media={media} fill sizes="100vw" />)
    expect(plain.container.querySelector("img")!.style.backgroundImage).toBe("")
    const blurred = render(<MediaImage media={media} fill sizes="100vw" blur />)
    expect(blurred.container.querySelector("img")!.style.backgroundImage).toContain("data:image")
  })
})
```

```ts
// lib/content/frame.test.ts
import { describe, expect, it } from "vitest"

import { cropToFrame, frameStyle } from "./frame"

describe("step frames", () => {
  it("round-trips today's hand-tuned crop boxes exactly", () => {
    for (const crop of [
      { left: "-11%", top: "-25.93%", width: "135.17%", height: "159.26%" },
      { left: "0.07%", top: "-8.8%", width: "100.07%", height: "117.59%" },
      { left: "0%", top: "0%", width: "113.16%", height: "133.33%" },
    ]) {
      expect(frameStyle(cropToFrame(crop))).toEqual(crop)
    }
  })
})
```

```ts
// lib/contact-href.test.ts
import { describe, expect, it } from "vitest"

import { contactHref } from "./contact-href"

describe("contactHref", () => {
  it("builds the same URLs the site links to today", () => {
    expect(contactHref({ topic: "workplace-wellbeing" })).toBe("/contact?topic=workplace-wellbeing")
    expect(contactHref({ plan: "discovery-call", topic: undefined })).toBe("/contact?plan=discovery-call")
    // Parser order (topic, format, plan) decides the order, not the argument's.
    expect(contactHref({ plan: "discovery-call", topic: "sleep-rest" })).toBe(
      "/contact?topic=sleep-rest&plan=discovery-call"
    )
  })
})
```

Run: `pnpm vitest run --project unit components/media-image.test.tsx lib/content/frame.test.ts lib/contact-href.test.ts` → FAIL (modules missing).

- [ ] **Step 2: Implement the helpers**

```tsx
// components/media-image.tsx
import Image, { type ImageProps } from "next/image"

import type { MediaAsset } from "@/lib/media"

type Props = Omit<ImageProps, "src" | "alt" | "placeholder" | "blurDataURL"> & {
  media: MediaAsset
  // Static imports used placeholder="blur"; keep it where the design had it.
  blur?: boolean
  // Crop for this use only; otherwise the asset's own focal point.
  focal?: { x: number; y: number } | null
  alt?: string
}

const percent = (n: number) => `${Math.round(n * 10_000) / 100}%`

export function MediaImage({
  media,
  blur = false,
  focal,
  alt,
  fill,
  width,
  height,
  style,
  ...rest
}: Props) {
  const point = focal ?? media.focal
  const size = fill
    ? { fill: true }
    : { width: width ?? media.width, height: height ?? media.height }
  return (
    <Image
      src={media.src}
      alt={alt ?? media.alt}
      {...size}
      placeholder={blur && media.blurDataURL ? "blur" : "empty"}
      blurDataURL={media.blurDataURL ?? undefined}
      style={
        point
          ? { objectPosition: `${percent(point.x)} ${percent(point.y)}`, ...style }
          : style
      }
      {...rest}
    />
  )
}
```

```ts
// lib/content/frame.ts
import type { StepFrame } from "./types"

const fraction = (value: string) => Number.parseFloat(value) / 100
// Two decimals, as the design's crop boxes were written.
const percent = (n: number) => `${Math.round(n * 10_000) / 100}%`

// The fixtures' "%"-string crop boxes become fractions in the database
// (docs/brief.md §6.3, process_steps.frame).
export const cropToFrame = (crop: {
  left: string
  top: string
  width: string
  height: string
}): StepFrame => ({
  x: fraction(crop.left),
  y: fraction(crop.top),
  w: fraction(crop.width),
  h: fraction(crop.height),
})

export const frameStyle = (frame: StepFrame) => ({
  left: percent(frame.x),
  top: percent(frame.y),
  width: percent(frame.w),
  height: percent(frame.h),
})
```

```ts
// lib/contact-href.ts
import { createSerializer, parseAsString } from "nuqs/server"

// Links that open the contact form pre-filled. The keys and their order match
// what the form reads (features/contact/lib/contact-params.ts), so the URLs
// are exactly the ones the site used before.
const serialize = createSerializer({
  topic: parseAsString,
  format: parseAsString,
  plan: parseAsString,
})

export const contactHref = (values: {
  topic?: string | null
  format?: string | null
  plan?: string | null
}) => serialize("/contact", values)
```

Run the three tests → PASS.

- [ ] **Step 3: Fixture shape edits (content unchanged)**

| Fixture | Change |
| --- | --- |
| `how-it-works/data/steps.ts` | Delete the four `@/public/...png` imports and `StaticImageData`; `Step.image: string` with `"/images/hero/hero-bg.png"`, `"/images/how-it-works/step-2.png"`, `"/images/how-it-works/step-3.png"`, `"/images/how-it-works/step-4.png"`. Keep `crop` strings. |
| `about-page/data/about-page-content.ts` | `ABOUT_HERO` gains `image: "/images/hero/hero-bg.png", focal: null, tint: 0.32, mirror: false`; `ABOUT_STORY.body` → `paragraphs`, gains `photo: "/images/about/story.png"`; `ABOUT_CREDENTIALS.items[]` gain `url: null`; `ABOUT_CTA` gains `image: "/images/enterprise/enterprise-bg.png", tint: 0.9`. |
| `about/data/about-content.ts` | `body` → `paragraphs`. |
| `enterprise/data/enterprise-content.ts` | Import `contactHref` from `@/lib/contact-href`; add `image: "/images/enterprise/enterprise-bg.png", tint: 0.9`; drop `as const`. |
| `how-it-works/data/session.ts` | `HOW_IT_WORKS_HERO` gains `image: "/images/insights/post-decision-fatigue.png", focal: null, tint: 0.32, mirror: true`. |
| `services/data/services-content.ts` | `SERVICES_HERO` gains `image: "/images/enterprise/enterprise-bg.png", focal: { x: 0.5, y: 0.29 }, tint: 0.32, mirror: false`. |
| `contact/data/contact-content.ts` | `CONTACT_HERO` gains `image: "/images/contact/contact-hero.png", focal: { x: 0.5, y: 0.38 }, tint: 0.32, mirror: false`. |
| `insights/data/articles.ts` | `INSIGHTS_HERO` gains `image: "/images/insights/post-agency-expertise.png", focal: null, tint: 0.62, mirror: false`. |
| `testimonials/data/testimonials.ts` | Unchanged shape (flat list from Task 2). |

`"center 38%"` and `"50% 38%"` are the same `object-position`; the default `"center"` is `50% 50%`, which `MediaImage` produces from the asset's focal point.

New fixtures:

```ts
// features/site/data/site.ts
// Seed input for the `site` global (docs/brief.md §6.4).
export const SITE = {
  name: "Magda Kennedy",
  legalName: "Magda Kennedy",
  professionalTitle: "Coach & Clinical Hypnotherapist",
}
```

```ts
// features/site/data/microcopy.ts
import type { GlobalValue } from "@/lib/content/globals"

// UI copy that used to be written inside components (docs/brief.md §4.2),
// now the seed input for the `microcopy` global.
export const MICROCOPY: GlobalValue<"microcopy"> = {
  breadcrumbHome: "Home",
  breadcrumbInsights: "Insights",
  featured: "Featured",
  featuredLabel: "Featured article",
  readArticle: "Read article →",
  readTime: "{minutes} min read",
  allArticles: "All articles",
  filterLabel: "Filter by category",
  searchLabel: "Search articles",
  searchPlaceholder: "Search articles",
  showing: "Showing {shown} of {total}",
  noResults: "No articles match that yet.",
  clearFilters: "Clear filters",
  pagination: "Pagination",
  previousPage: "Previous page",
  nextPage: "Next page",
  pageLabel: "Page {n}",
  writtenBy: "Written by",
  share: "Share",
  copyLink: "Copy link",
  linkCopied: "Link copied",
  shareEmail: "Email",
  allInsights: "← All insights",
  keepReading: "Keep reading",
  viewAllInsights: "View all insights →",
  articleCta: {
    title: "Ready to talk it through?",
    body: "A free, no-pressure discovery call is the easiest first step. We will talk about what is going on and whether working together is the right fit.",
    button: "Book a discovery call →",
  },
  directions: "Get Directions  ↗",
  contactChannels: { email: "Email", phone: "Phone", clinic: "Clinic", hours: "Hours" },
  contactChapter: "Contact",
  articleChapters: {
    welcome: "Welcome",
    article: "Article",
    keepReading: "Keep reading",
    newsletter: "Newsletter",
  },
}
```

- [ ] **Step 4: Transitional view builders**

```ts
// app/(site)/_legacy/views.ts
// Transitional (Tasks 4–8): builds, from the old fixtures, exactly the props
// the database supplies from Task 9 on. Deleted in Task 9.
import type { BlockView } from "@/blocks/media-refs"
import { cropToFrame } from "@/lib/content/frame"
import type { CtaBandView, FaqView, ProcessStepView, TestimonialView } from "@/lib/content/types"
import { fromPath } from "@/lib/media"
import { ABOUT_CONTENT } from "@/features/about/data/about-content"
import {
  ABOUT_APPROACH,
  ABOUT_CREDENTIALS,
  ABOUT_CTA,
  ABOUT_STATS,
  ABOUT_STORY,
} from "@/features/about-page/data/about-page-content"
import { CREDENTIALS } from "@/features/credibility/data/credentials"
import { ENTERPRISE_CONTENT } from "@/features/enterprise/data/enterprise-content"
import { FAQ_HEADER, FAQS } from "@/features/faq/data/faqs"
import { HERO_CONTENT } from "@/features/hero/data/hero-content"
import { HOW_IT_WORKS, STEPS } from "@/features/how-it-works/data/steps"
import { TESTIMONIALS, TESTIMONIALS_HEADER } from "@/features/testimonials/data/testimonials"

type HeroFixture = Omit<BlockView<"hero.page">, "image"> & { image: string }
type Variant = "home" | "page"

export const pageHero = (hero: HeroFixture): BlockView<"hero.page"> => ({
  ...hero,
  image: fromPath(hero.image),
})

export const heroHome = (): BlockView<"hero.home"> => ({
  ...HERO_CONTENT,
  members: { ...HERO_CONTENT.members, avatars: HERO_CONTENT.members.avatars.map(fromPath) },
})

export const credibility = (): BlockView<"credibility"> => ({ badges: CREDENTIALS })
export const aboutIntro = (): BlockView<"about.intro"> => ABOUT_CONTENT

export const processBlock = (variant: Variant): BlockView<"process"> => ({
  variant,
  tag: variant === "page" ? HOW_IT_WORKS.page.tag : "",
  title: variant === "page" ? HOW_IT_WORKS.page.title : HOW_IT_WORKS.title,
  subtitle: HOW_IT_WORKS.subtitle,
  cta: HOW_IT_WORKS.cta,
})

export const processSteps = (): ProcessStepView[] =>
  STEPS.map((step, i) => ({
    id: `step-${i}`,
    title: step.title,
    description: step.description,
    image: fromPath(step.image),
    frame: cropToFrame(step.crop),
  }))

export const testimonialsBlock = (variant: Variant): BlockView<"testimonials"> => ({
  variant,
  ...TESTIMONIALS_HEADER,
  selection: { mode: "all" },
})

export const testimonialItems = (): TestimonialView[] =>
  TESTIMONIALS.map((t, i) => ({ id: `testimonial-${i}`, ...t, avatar: fromPath(t.avatar) }))

export const ctaBand = (key: "enterprise" | "about"): CtaBandView => {
  const band = key === "enterprise" ? ENTERPRISE_CONTENT : ABOUT_CTA
  return { id: `band-${key}`, ...band, bullets: [...band.bullets], image: fromPath(band.image) }
}

export const faqBlock = (variant: Variant): BlockView<"faq"> => ({
  variant,
  ...FAQ_HEADER,
  selection: { mode: "all" },
  initiallyOpen: 0,
})

export const faqItems = (): FaqView[] => FAQS.map((faq, i) => ({ id: `faq-${i}`, ...faq }))

export const aboutStory = (): BlockView<"about.story"> => ({
  ...ABOUT_STORY,
  photo: fromPath(ABOUT_STORY.photo),
})
export const aboutStats = (): BlockView<"about.stats"> => ({ stats: ABOUT_STATS })
export const aboutApproach = (): BlockView<"about.approach"> => ABOUT_APPROACH
export const aboutCredentials = (): BlockView<"about.credentials"> => ABOUT_CREDENTIALS
```

If a fixture literal widens a union (e.g. `icon: string` instead of `IconName`), type the fixture constant (`satisfies` the view type) rather than casting in the builder.

- [ ] **Step 5: Refactor the sections (checklist)**

Apply the pattern to each row. "Literals out" lists copy that must leave the component.

| Component | New signature | Also |
| --- | --- | --- |
| `PageHero` | `({ content, homeLabel }: { content: BlockView<"hero.page">; homeLabel: string })` | `<MediaImage media={content.image} focal={content.focal} fill priority blur sizes="100vw" className={content.mirror ? "-scale-x-100 object-cover" : "object-cover"} />`; tint from `content.tint`; literal out: `Home` → `homeLabel`. |
| `HeroSection` | `({ content }: { content: BlockView<"hero.home"> })` | Passes `content` to `HeroContent` and `content.members` to `MemberBadge`. |
| `HeroContent` | `({ content }: { content: BlockView<"hero.home"> })` | — |
| `MemberBadge` | `({ members, className }: { members: BlockView<"hero.home">["members"]; className?: string })` | Avatars: `<MediaImage media={a} width={56} height={56} alt="" data-hero="avatar" className=… />`, `key={i}`. Count from Task 2 stays. |
| `CredibilitySection` | `({ id, content }: { id: string; content: BlockView<"credibility"> })` | `id` on `<section>`; `key={i}`. |
| `CredentialItem` | `({ badge }: { badge: BlockView<"credibility">["badges"][number] })` | — |
| `AboutSection` | `({ id, content }: { id: string; content: BlockView<"about.intro"> })` | `paragraphs` (was `body`); stats `key={i}`. |
| `StatCard` | `({ stat }: { stat: { value: StatValue; label: string } })` | — |
| `HowItWorksSection` | `({ id, content, steps }: { id: string; content: BlockView<"process">; steps: ProcessStepView[] })` | `page = content.variant === "page"`; heading text is `content.title`; tag pill renders when `page && content.tag`; `count={steps.length}` for `StepsStory` and the spacer style; `key={step.id}`. |
| `StepCard` | `({ step, index }: { step: ProcessStepView; index: number })` | `<div className="absolute" style={frameStyle(step.frame)}><MediaImage media={step.image} fill sizes="520px" blur draggable={false} className="object-cover" /></div>`. |
| `StepsStory` | unchanged from Task 2 (`count`) | — |
| `TestimonialsSection` | `({ id, content, items }: { id: string; content: BlockView<"testimonials">; items: TestimonialView[] })` | `splitColumns(items, 2)`; `key={t.id}`; selection is applied by the caller. |
| `TestimonialCard` | `({ item }: { item: TestimonialView })` | `<MediaImage media={item.avatar} width={60} height={60} alt="" className="size-15 shrink-0 rounded-full" />`. |
| `EnterpriseSection` | `({ id, band, tint }: { id: string; band: CtaBandView; tint?: number \| null })` | `tintStyle(tint ?? band.tint)`; `<MediaImage media={band.image} fill sizes="100vw" blur className="object-cover" />`; bullets `key={i}`. |
| `FaqSection` | `({ id, content, items }: { id: string; content: BlockView<"faq">; items: FaqView[] })` | `page = content.variant === "page"`. |
| `FaqAccordion` | `({ items, initiallyOpen }: { items: FaqView[]; initiallyOpen: number \| null })` | `defaultValue={initiallyOpen === null ? [] : [initiallyOpen]}`; `key={faq.id}`. |
| `StorySection` | `({ id, content, siteName }: { id: string; content: BlockView<"about.story">; siteName: string })` | photo via `MediaImage … fill blur sizes="(min-width: 1024px) 568px, 100vw"`; literal out: `Magda Kennedy` → `siteName`; paragraphs `key={i}`. |
| `StatsBand` | `({ id, content }: { id: string; content: BlockView<"about.stats"> })` | Keeps `aria-label`. |
| `ApproachSection` | `({ id, content }: { id: string; content: BlockView<"about.approach"> })` | `key={i}`. |
| `CredentialsSection` | `({ id, content }: { id: string; content: BlockView<"about.credentials"> })` | `key={i}`; if `item.url`, the title becomes an `<a href>` (no seeded item has one, so parity is unaffected). |

Remove every `features/*/data` import from these files and from the barrels listed under **Files**.

- [ ] **Step 6: Wire the pages (transitional)**

Example, `app/(site)/page.tsx` (other rows follow the same shape; `InsightsSection` is still fixture-driven until Task 5):

```tsx
import * as legacy from "./_legacy/views"
// … existing imports minus the fixtures …

export default function Page() {
  return (
    <main data-page-root className="bg-ink">
      <StackCard id="home" rounded={false}>
        <HeroSection content={legacy.heroHome()} />
      </StackCard>
      <StackCard>
        <CredibilitySection id="credibility" content={legacy.credibility()} />
        <AboutSection id="about" content={legacy.aboutIntro()} />
      </StackCard>
      <StackCard>
        <HowItWorksSection
          id="how-it-works"
          content={legacy.processBlock("home")}
          steps={legacy.processSteps()}
        />
      </StackCard>
      <StackCard>
        <TestimonialsSection
          id="testimonials"
          content={legacy.testimonialsBlock("home")}
          items={legacy.testimonialItems()}
        />
      </StackCard>
      <StackCard>
        <EnterpriseSection id="enterprise" band={legacy.ctaBand("enterprise")} />
      </StackCard>
      <StackCard>
        <InsightsSection />
      </StackCard>
      <StackCard last>
        <FaqSection id="faq" content={legacy.faqBlock("home")} items={legacy.faqItems()} />
      </StackCard>
      <JourneyRail chapters={CHAPTERS} />
      <PageMotion />
    </main>
  )
}
```

Per page (only the sections this task changes):

| Page | Props |
| --- | --- |
| `/about` | `PageHero content={legacy.pageHero(ABOUT_HERO)} homeLabel={MICROCOPY.breadcrumbHome}`; the `StackCard id="story"` loses its id (StorySection now renders `id="story"`); `StorySection id="story" content={legacy.aboutStory()} siteName={SITE.name}`; `StatsBand id="practice-in-numbers" content={legacy.aboutStats()}`; `StackCard id="approach"` / `id="credentials"` lose their ids to `ApproachSection id="approach"` / `CredentialsSection id="credentials"`; `TestimonialsSection id="testimonials" content={legacy.testimonialsBlock("page")}`; `EnterpriseSection id="next-step" band={legacy.ctaBand("about")} tint={0.7}`. |
| `/how-it-works` | `PageHero` from `HOW_IT_WORKS_HERO`; `HowItWorksSection` variant `"page"`; `StackCard id="session"` / `id="fit"` keep their ids until Task 5; `FaqSection` variant `"page"`; `EnterpriseSection id="next-step" band={legacy.ctaBand("about")}`. |
| `/services` | `PageHero` from `SERVICES_HERO`; `EnterpriseSection id="enterprise" band={legacy.ctaBand("enterprise")}`; `FaqSection` variant `"page"`. |
| `/contact` | `PageHero` from `CONTACT_HERO`; `FaqSection id="faq"` variant `"home"` (the contact page uses the home variant today). |
| `/insights` | `PageHero` from `INSIGHTS_HERO`. |

Moving an id from a `StackCard` to the first section inside it changes no pixel and no scroll target: the section is the card's first child, and `JourneyRail` triggers on `closest("[data-stack]")`.

- [ ] **Step 7: Verify**

```bash
pnpm vitest run --project unit
pnpm lint && pnpm typecheck && pnpm build
pnpm test:parity
pnpm exec playwright test tests/e2e/navigation --project=desktop
grep -rn 'from "\.\./data/\|features/.*/data' features/{hero,credibility,about,about-page,how-it-works,testimonials,enterprise,faq}/components components/page-hero.tsx
pnpm exec prettier --check $(git diff --name-only HEAD -- '*.ts' '*.tsx')
```

Expected: tests PASS; parity 21/21; the `grep` prints nothing.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(site): props-driven home, about and shared sections

Sections take registry-typed block data and view DTOs instead of importing
fixtures; images go through MediaImage, ids come from anchors, keys from
item ids. Pages feed them from the fixtures until the database arrives.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Props-driven sections — services, how-it-works, insights, article, contact, chrome

Same pattern as Task 4 (read "The props-driven section pattern" above). Adds the rich-text renderer and the TipTap conversion the article page needs.

**Files:**
- Create: `lib/fill.ts`, `lib/fill.test.ts`, `lib/content/address.ts`, `lib/content/address.test.ts`, `features/contact/lib/contact-params.ts`, `features/insights/components/rich-text.tsx`, `server/db/seed/tiptap.ts`, `server/db/seed/tiptap.test.ts`
- Modify (components): `features/services/components/{services-grid,formats-section}.tsx`; `features/how-it-works/components/{session-timeline,fit-section}.tsx`; `features/insights/components/{insights-section,post-card,insights-browser,article-card,featured-article,newsletter-band,article-hero,article-body,related-articles,share-links}.tsx`; `features/contact/components/{contact-section,contact-form,clinic-section}.tsx`; `features/navbar/components/{site-header,mobile-nav,book-call-button}.tsx`; `features/footer/components/site-footer.tsx`; `components/brand.tsx`
- Modify (fixtures): `features/contact/data/contact-content.ts`, `features/navbar/data/nav-links.ts`, `features/footer/data/footer-links.ts`, `features/insights/data/articles.ts`
- Delete: `features/contact/data/contact-params.ts`
- Modify (pages): `app/(site)/{services,how-it-works,insights,contact}/page.tsx`, `app/(site)/insights/[slug]/page.tsx`, `app/(site)/page.tsx` (insights teaser), `app/(site)/layout.tsx`, `app/global-not-found.tsx`; `app/(site)/_legacy/views.ts` (more builders)

**Interfaces:**
- Consumes: everything from Tasks 3–4.
- Produces: `fill(template, values)`; `formatAddress(address)`, `clinicAddress(address)`, `mapsUrl(address)`; `contactParams(topics, formats, plans)`; `<RichText doc />` (server); `toTipTap(blocks: LegacyBlock[]): RichTextDoc`, `plainText(doc): string`, `readingMinutes(text): number` (`server/db/seed/tiptap.ts`, used again by Task 7); fixtures `CONTACT` (`GlobalValue<"contact">` minus media), `CONTACT_FORM` (`GlobalValue<"contactForm">`), `NAVIGATION`, `FOOTER`, `NEWSLETTER` (global shapes, image as a path).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/fill.test.ts
import { describe, expect, it } from "vitest"

import { fill } from "./fill"

describe("fill", () => {
  it("replaces known placeholders and leaves unknown ones", () => {
    expect(fill("Showing {shown} of {total}", { shown: 6, total: 6 })).toBe("Showing 6 of 6")
    expect(fill("{minutes} min read {x}", { minutes: 4 })).toBe("4 min read {x}")
  })
})
```

```ts
// lib/content/address.test.ts
import { describe, expect, it } from "vitest"

import { clinicAddress, formatAddress, mapsUrl } from "./address"

const address = { lines: ["28 Merrion Square", "Dublin 2"], city: "Dublin", eircode: "D02 X285", country: "Ireland" }

describe("address formatting", () => {
  it("prints the contact and clinic lines exactly as today", () => {
    expect(formatAddress(address)).toBe("28 Merrion Square, Dublin 2, D02 X285")
    // Today's clinic card has no comma before the country (a copy finding
    // for the client, brief §4.6); parity keeps it.
    expect(clinicAddress(address)).toBe("28 Merrion Square, Dublin 2, D02 X285 Ireland")
  })
  it("derives the directions link", () => {
    expect(mapsUrl(address)).toBe(
      "https://www.google.com/maps/search/?api=1&query=28%20Merrion%20Square%2C%20Dublin%202%2C%20D02%20X285"
    )
  })
})
```

```ts
// server/db/seed/tiptap.test.ts
import { describe, expect, it } from "vitest"

import { plainText, readingMinutes, toTipTap } from "./tiptap"

describe("article bodies → TipTap JSON", () => {
  const doc = toTipTap([
    { type: "p", text: "The lead paragraph." },
    { type: "h2", text: "A heading" },
    { type: "quote", text: "A quote." },
    { type: "list", items: ["Lower the stakes. Shrink the next step.", "Single sentence"] },
  ])

  it("keeps the first paragraph first, so it renders as the lead", () => {
    expect(doc.content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "The lead paragraph." }],
    })
  })

  it("maps headings and quotes", () => {
    expect(doc.content[1]).toEqual({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "A heading" }],
    })
    expect(doc.content[2]).toEqual({
      type: "blockquote",
      content: [{ type: "paragraph", content: [{ type: "text", text: "A quote." }] }],
    })
  })

  it('turns the "bold up to the first ". "" rule into a real bold mark', () => {
    const list = doc.content[3]
    expect(list.type).toBe("bulletList")
    if (list.type !== "bulletList") return
    expect(list.content[0].content[0].content).toEqual([
      { type: "text", text: "Lower the stakes.", marks: [{ type: "bold" }] },
      { type: "text", text: " Shrink the next step." },
    ])
    expect(list.content[1].content[0].content).toEqual([{ type: "text", text: "Single sentence" }])
  })

  it("measures reading time the way the site always has (words ÷ 220)", () => {
    expect(plainText(doc)).toBe(
      "The lead paragraph. A heading A quote. Lower the stakes. Shrink the next step. Single sentence"
    )
    expect(readingMinutes("word ".repeat(660).trim())).toBe(3)
    expect(readingMinutes("one")).toBe(1)
  })
})
```

Run: `pnpm vitest run --project unit lib/fill.test.ts lib/content/address.test.ts server/db/seed/tiptap.test.ts` → FAIL.

- [ ] **Step 2: Implement the helpers**

```ts
// lib/fill.ts
// Fills "{name}" placeholders in editable copy (microcopy, form messages).
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  )
```

```ts
// lib/content/address.ts
type Address = { lines: string[]; city: string; eircode: string; country: string }

export const formatAddress = (address: Address) =>
  [...address.lines, address.eircode].filter(Boolean).join(", ")

export const clinicAddress = (address: Address) =>
  [formatAddress(address), address.country].filter(Boolean).join(" ")

// The directions link is derived, never stored (docs/brief.md §6.4).
export const mapsUrl = (address: Address) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(address))}`
```

```ts
// server/db/seed/tiptap.ts
import "server-only"

import type { RichTextDoc, RichTextNode } from "@/blocks/rich-text"

// The fixtures' article bodies (features/insights/data/article-bodies.ts).
export type LegacyBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] }

const text = (value: string) => ({ type: "text" as const, text: value })
const paragraph = (value: string) => ({ type: "paragraph" as const, content: [text(value)] })

// List items scanned as headed steps: the old renderer set everything up to
// the first ". " in bold. That becomes a real bold mark.
function listItem(value: string) {
  const cut = value.indexOf(". ")
  const content =
    cut === -1
      ? [text(value)]
      : [
          { ...text(value.slice(0, cut + 1)), marks: [{ type: "bold" as const }] },
          text(value.slice(cut + 1)),
        ]
  return { type: "listItem" as const, content: [{ type: "paragraph" as const, content }] }
}

function node(block: LegacyBlock): RichTextNode {
  switch (block.type) {
    case "p":
      return paragraph(block.text)
    case "h2":
      return { type: "heading", attrs: { level: 2 }, content: [text(block.text)] }
    case "quote":
      return { type: "blockquote", content: [paragraph(block.text)] }
    case "list":
      return { type: "bulletList", content: block.items.map(listItem) }
  }
}

export const toTipTap = (blocks: LegacyBlock[]): RichTextDoc => ({
  type: "doc",
  content: blocks.map(node),
})

const inline = (content?: { text: string }[]) => (content ?? []).map((t) => t.text).join("")

// One string per top-level block and per list item, joined by spaces: the
// same text the old read-time helper counted, so reading times do not move.
export function plainText(doc: RichTextDoc) {
  return doc.content
    .flatMap((n) => {
      if (n.type === "bulletList") return n.content.map((item) => inline(item.content[0].content))
      if (n.type === "blockquote") return n.content.map((p) => inline(p.content))
      return [inline(n.content)]
    })
    .join(" ")
}

export const readingMinutes = (value: string) =>
  Math.max(1, Math.round(value.split(/\s+/).length / 220))
```

Run the tests → PASS.

- [ ] **Step 3: Rich-text renderer**

`features/insights/components/rich-text.tsx` is a server component that reproduces `ArticleBody`'s `BlockView` markup node for node, so the article page renders identically from TipTap JSON:

```tsx
// features/insights/components/rich-text.tsx
import Link from "next/link"
import { Fragment } from "react"

import type { RichTextDoc, RichTextInline, RichTextNode } from "@/blocks/rich-text"

// Text runs render as fragments: a list item must stay `<strong>` followed by
// a bare text node, exactly as the old renderer wrote it.
function Inline({ nodes }: { nodes?: RichTextInline[] }) {
  return (nodes ?? []).map((n, i) => {
    let out: React.ReactNode = n.text
    for (const mark of n.marks ?? []) {
      if (mark.type === "bold") out = <strong className="font-semibold text-ink">{out}</strong>
      if (mark.type === "italic") out = <em>{out}</em>
      if (mark.type === "link") {
        out = (
          <Link href={mark.attrs.href} className="text-clay underline underline-offset-4">
            {out}
          </Link>
        )
      }
    }
    return <Fragment key={i}>{out}</Fragment>
  })
}

// Same markup as the old article-body BlockView, node for node.
function Node({ node }: { node: RichTextNode }) {
  switch (node.type) {
    case "heading":
      return (
        <h2
          data-motion="words"
          className="pt-6 text-[26px] leading-[1.25] font-semibold tracking-[-0.5px] text-ink sm:text-[32px]"
        >
          <Inline nodes={node.content} />
        </h2>
      )
    case "blockquote":
      return (
        <blockquote className="relative my-4 py-1 pl-6 sm:pl-8">
          <span aria-hidden data-motion="grow" className="absolute inset-y-0 left-0 w-0.5 bg-clay" />
          {node.content.map((p, i) => (
            <p
              key={i}
              data-motion="words"
              className="font-display text-[24px] leading-[1.35] font-semibold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[30px]"
            >
              <Inline nodes={p.content} />
            </p>
          ))}
        </blockquote>
      )
    case "bulletList":
      return (
        <ul data-motion="stagger" className="flex flex-col gap-4">
          {node.content.map((item, i) => (
            <li key={i} className="flex gap-4">
              <span aria-hidden className="mt-2.75 size-1.5 shrink-0 rounded-full bg-clay" />
              <span>
                <Inline nodes={item.content[0].content} />
              </span>
            </li>
          ))}
        </ul>
      )
    case "paragraph":
      return (
        <p data-motion="rise">
          <Inline nodes={node.content} />
        </p>
      )
  }
}

// The first paragraph is the article's lead, as before.
export function RichText({ doc }: { doc: RichTextDoc }) {
  const [first, ...rest] = doc.content
  const lead = first?.type === "paragraph" ? first : null
  return (
    <>
      {lead && (
        <p data-motion="words" className="pb-2 text-[21px] leading-[1.6] text-ink sm:text-[23px]">
          <Inline nodes={lead.content} />
        </p>
      )}
      {(lead ? rest : doc.content).map((node, i) => (
        <Node key={i} node={node} />
      ))}
    </>
  )
}
```

Before relying on it, diff these class strings against the current `article-body.tsx` (after Task 1) and copy any difference from there. `ArticleBody` renders `<RichText doc={article.body} />` where the lead and `BlockView` code were.

- [ ] **Step 4: Fixture edits**

- `features/contact/data/contact-content.ts`:
  - `CONTACT_INFO` → `{ eyebrow, title, subtitle }` (the `contact.details` block data).
  - New `CONTACT` (the `contact` global, `photo` as a path): `email: "hello@jameswhitfield.ie"`, `phone: { display: "+353 1 234 5678", e164: "+35312345678" }`, `address: { lines: ["28 Merrion Square", "Dublin 2"], city: "Dublin", eircode: "D02 X285", country: "Ireland" }`, `hours: { weekly: [{ days: [1, 2, 3, 4], opens: "08:00", closes: "19:00" }, { days: [5], opens: "08:00", closes: "14:00" }], summary: "Mon – Thu 8am–7pm  •  Fri 8am–2pm", note: "" }`, `clinic: { name: "Merrion Square Clinic", description: "", photo: "/images/insights/post-host-podcast.png", onlineNote: "Online sessions available worldwide via secure Zoom.", geo: null }`. Keep the "confirm before launch" comment.
  - `CLINIC` → `{ eyebrow, title, subtitle, photo: "/images/insights/post-host-podcast.png" }`.
  - `CONTACT_FORM` → the full `contactForm` global: `title: "Send a message"`, `labels: { name: "Full name", email: "Email", phone: "Phone", topic: "I’d like help with", format: "Preferred format", message: "Message" }`, `placeholders: { name: "Your name", email: "you@example.com", phone: "+353", topic: "Choose a topic", message: "Tell me a little about what is bringing you here…" }`, `extraTopics: ["Something else"]`, `formats` (unchanged), `consent` (unchanged), `button: "Send Message  →"`, `sendAnother: "Send another message"`, `success` (unchanged), `errors: { name: "Please add your name.", email: "Please add a valid email address.", topic: "Please choose a topic.", consent: "Please confirm so I can reply to you." }`, `planMessage: "I’d like to ask about the {name} ({price} {unit})."`. Copy each string from the component before deleting it there; the table above is the checklist.
  - Remove the `SERVICES` import.
- `features/navbar/data/nav-links.ts`: `NAVIGATION = { links: NAV_LINKS, cta: { label: "Book a Call", href: "/contact" } }`; delete `BOOK_CALL_HREF`.
- `features/footer/data/footer-links.ts`: import `NAV_LINKS` from `../../navbar/data/nav-links` (not the barrel: the seed loads fixtures in Node and must not pull in components); export `FOOTER = { blurb: FOOTER_BLURB, columns: [{ title: "Sitemap", source: "navigation", links: [{ label: "Home", href: "/" }] }, { title: "Services", source: "links", links: [...] }], contactLines: [...], contactNote: "…", legalLinks: LEGAL_LINKS, copyrightName: "Magda Kennedy" }`.
- `features/insights/data/articles.ts`: `NEWSLETTER` gains `emailLabel: "Email address"`, `image: "/images/enterprise/enterprise-bg.png"`, `tint: 0.9`, `confirmationEmail: { subject: "Confirm your subscription", body: "Please confirm your subscription to the monthly letter." }`; rename `NEWSLETTER.submit` → `button`. Leave `readTime` alone: fixtures (under `features/**`) may not import `@/server/**` (layering lint), so reading minutes are computed in `_legacy/views.ts` (under `app/**`) with `readingMinutes(plainText(toTipTap(getArticleBody(slug))))`.

- [ ] **Step 5: Refactor the sections (checklist)**

| Component | New signature | Also |
| --- | --- | --- |
| `ServicesGrid` | `({ id, content, services }: { id: string; content: BlockView<"services.grid">; services: ServiceView[] })` | `key={s.id}`; icon from Task 1. |
| `FormatsSection` / `PlanCard` | `({ id, content, plans }: { id: string; content: BlockView<"services.plans">; plans: PlanView[] })` / `({ plan, featuredTag })` | `Most chosen` → `content.featuredTag`; `href={contactHref({ plan: plan.slug })}`; `price` → `plan.priceLabel`; `cta.label` → `plan.ctaLabel`; `key={plan.id}`, features `key={i}`. |
| `SessionTimeline` (client) | `({ id, content }: { id: string; content: BlockView<"session.timeline"> })` | Beats `key={i}`; the `StackCard id="session"` on `/how-it-works` loses its id. |
| `FitSection` | `({ id, content }: { id: string; content: BlockView<"fit"> })` | The `StackCard id="fit"` loses its id. |
| `InsightsSection` | `({ id, content, articles }: { id: string; content: BlockView<"insights.latest">; articles: ArticleSummary[] })` | `PostCard({ article })`, `key={a.id}`. |
| `PostCard`, `ArticleCard`, `Byline` | take `ArticleSummary` (or its `author`/`date`) | Images via `MediaImage` (`fill` or the old explicit size). |
| `InsightsBrowser` (client) | `({ id, content, articles, categories, copy, featured }: { id: string; content: BlockView<"insights.browser">; articles: ArticleSummary[]; categories: CategoryView[]; copy: GlobalValue<"microcopy">; featured: React.ReactNode })` | Build `PARAMS`, `BY_SLUG` and `FILTERS` inside the component with `useMemo` from `categories` and pass them down to `UrlBound`/`useBrowserState` (no module-level fixture state); filter on `article.category.slug`; search `title`, `excerpt`, `category.name`; page size `content.pageSize`; heading `content.heading`; every literal → `copy` (`allArticles`, `filterLabel`, `searchLabel`, `searchPlaceholder`, `showing` via `fill`, `noResults`, `clearFilters`, `pagination`, `previousPage`, `nextPage`, `pageLabel` via `fill`, `featuredLabel`); `id` on the first `<section>`; `key={a.id}`; the search icon stays a path. |
| `FeaturedArticle` | `({ article, copy }: { article: ArticleSummary; copy: GlobalValue<"microcopy"> })` | `fill(copy.readTime, { minutes: article.readingMinutes })`; `Featured`, `Read article →` from `copy`; image `MediaImage fill priority` with the existing `objectPosition: "44% 0%"` style (a design crop, not content). |
| `NewsletterBand` (client) | `({ id, content }: { id: string; content: NewsletterView })` where `type NewsletterView = Omit<GlobalView<"newsletter">, "confirmationEmail">` (export it from the component) | `tintStyle(content.tint)`; image `MediaImage fill blur sizes="100vw"` when `content.image`; `Email address` → `content.emailLabel`; `submit` → `content.button`. |
| `ArticleHero` | `({ article, copy }: { article: ArticleSummary; copy: GlobalValue<"microcopy"> })` | `Home`/`Insights` → `copy.breadcrumbHome`/`copy.breadcrumbInsights`; read time via `fill`. |
| `ArticleBody` | `({ article, copy, ctaHref }: { article: ArticleDetail; copy: GlobalValue<"microcopy">; ctaHref: string })` | `<RichText doc={article.body} />`; `TOPIC_FOR` and `contactHref` leave the component (the page passes `ctaHref`); `Written by`, `Share`, `← All insights`, CTA title/body/button → `copy`. |
| `RelatedArticles` | `({ articles, copy })` | `Keep reading`, `View all insights →` → `copy`. |
| `ShareLinks` (client) | `({ title, copy }: { title: string; copy: { copyLink: string; linkCopied: string; shareEmail: string } })` | — |
| `ContactSection` | `({ id, content, contact, channels, form }: { id: string; content: BlockView<"contact.details">; contact: GlobalView<"contact">; channels: GlobalValue<"microcopy">["contactChannels"]; form: React.ComponentProps<typeof ContactForm> })` | Items built in the component: email (`mailto:`), phone (`tel:${e164}`), clinic (`formatAddress`, `href: "#clinic"`), hours (`contact.hours.summary`), icons `"email" \| "phone" \| "clinic" \| "hours"`; `key={item.icon}`. |
| `ContactForm` (client) | `({ copy, topics, formats, plans }: { copy: GlobalValue<"contactForm">; topics: ContactOption[]; formats: ContactOption[]; plans: PlanOption[] })` | `contactParams(topics, formats, plans)` via `useMemo`; prefill maps slugs back through the option lists; plan message `fill(copy.planMessage, { name, price: plan.priceLabel, unit: plan.unit })`; every label, placeholder and error from `copy`. |
| `ClinicSection` | `({ id, content, contact, directionsLabel }: { id: string; content: BlockView<"contact.clinic">; contact: GlobalView<"contact">; directionsLabel: string })` | Name, `clinicAddress(contact.address)`, `contact.clinic.onlineNote`, `mapsUrl(contact.address)`; photo `MediaImage fill blur`. |
| `SiteHeader` | `({ site, navigation, className }: { site: { name: string }; navigation: GlobalValue<"navigation">; className?: string })` | Links `key={link.href}` (hrefs are unique in the nav). |
| `MobileNav` (client) | `({ links, cta }: { links: …; cta: … })` | — |
| `BookCallButton` | `({ cta, className }: { cta: { label: string; href: string }; className?: string })` | `Book a Call` → `cta.label`. |
| `Brand` | `({ name }: { name: string })` | — |
| `SiteFooter` | `({ site, footer, navigation }: { site: { name: string }; footer: GlobalValue<"footer">; navigation: GlobalValue<"navigation"> })` | Column links: `source === "navigation" ? [...column.links, ...navigation.links] : column.links`; `© <CopyrightYear /> {footer.copyrightName}`; the `Contact` column title stays (layout label); keys by index. |

```ts
// features/contact/lib/contact-params.ts
import { parseAsStringLiteral } from "nuqs"

import type { ContactOption, PlanOption } from "@/lib/content/types"

// Values in the URL are slugs of the form's own options; anything unknown is
// ignored. Read one way only: choices are never written back to the URL,
// because a topic like anxiety is personal.
export const contactParams = (
  topics: ContactOption[],
  formats: ContactOption[],
  plans: PlanOption[]
) => ({
  topic: parseAsStringLiteral(topics.map((t) => t.slug)),
  format: parseAsStringLiteral(formats.map((f) => f.slug)),
  plan: parseAsStringLiteral(plans.map((p) => p.slug)),
})
```

- [ ] **Step 6: Wire the pages and chrome (transitional)**

Add builders to `app/(site)/_legacy/views.ts`: `services()` (`ServiceView[]` from `SERVICES.items`, `slug: slugify(title)`, `id: slug`), `plans()` (`PlanView[]` from `FORMATS.plans`), `servicesGrid()`, `servicesPlans()` (`featuredTag: "Most chosen"` — add that string to the `FORMATS` fixture as `featuredTag` first), `sessionTimeline()`, `fit()`, `articleSummary(a)` (`id: a.slug`, `category: { slug: slugify(a.category), name: a.category }`, images via `fromPath`, `readingMinutes: readingMinutes(plainText(toTipTap(getArticleBody(a.slug))))`, `featured: a.slug === FEATURED_ARTICLE.slug`), `articleDetail(slug)` (summary + `body: toTipTap(getArticleBody(slug))` + `topicSlug` from the old `TOPIC_FOR` map, moved here), `categories()`, `insightsLatest()`, `insightsBrowser()` (`heading: "Latest articles", pageSize: PAGE_SIZE`), `newsletter()`, `contactDetails()`, `contactClinic()`, `contactForm()` (`topics` = services as options + `extraTopics` slugified, `formats` slugified, `plans` as `PlanOption`), `contact()` (`CONTACT` with `photo` via `fromPath`).

Pages: `/services` (`ServicesGrid id="services"`, `FormatsSection id="formats"`), `/how-it-works` (`SessionTimeline id="session"`, `FitSection id="fit"`), `/insights` (`InsightsBrowser id="articles"` — the `StackCard id="articles"` loses its id — with `featured={<FeaturedArticle … />}`, `NewsletterBand id="newsletter"`), `/insights/[slug]` (keep `generateStaticParams` until Task 9; `ArticleHero`, `ArticleBody` with `ctaHref={contactHref({ plan: "discovery-call", topic: detail.topicSlug })}`, `RelatedArticles` from the old `relatedArticles(slug)` mapped through `articleSummary`, `NewsletterBand`), `/contact` (`ContactSection id="get-in-touch"`, `ClinicSection id="clinic"`), `/` (`InsightsSection id="insights"` with the first three summaries). `app/(site)/layout.tsx` and `app/global-not-found.tsx` pass `SITE`, `NAVIGATION`, `FOOTER` to the header and footer.

- [ ] **Step 7: Verify**

```bash
pnpm vitest run --project unit
pnpm lint && pnpm typecheck && pnpm build
pnpm test:parity
pnpm exec playwright test tests/e2e/navigation --project=desktop
grep -rln 'features/[a-z-]*/data\|from "\.\./data/' features/*/components components | grep -v '^$'
pnpm exec prettier --check $(git diff --name-only HEAD -- '*.ts' '*.tsx')
```

Expected: tests PASS; parity 21/21; the `grep` prints nothing (no component imports a fixture). By eye on `pnpm dev`: `/contact?topic=sleep-rest&plan=change-programme` pre-fills the topic and the plan message; `/insights?category=sleep&q=calm` filters; the article page's list items keep their bold lead-ins.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(site): props-driven services, insights, article, contact and chrome

The remaining sections take registry-typed props; UI copy moves into
microcopy/contactForm/navigation/footer fixtures; article bodies render
from TipTap JSON (first paragraph as lead, list lead-ins as bold marks).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 6: Data layer — tables, migration, cache tags, repo, cached queries

**Files:**
- Create: `server/db/schema/media.ts`, `server/db/schema/content.ts`, `server/db/schema/pages.ts`; modify `server/db/schema/index.ts`
- Create (generated): `server/db/migrations/0004_content.sql` + `meta/0004_snapshot.json` + journal entry
- Create: `server/lib/cache.ts`, `server/lib/cache.test.ts`, `lib/format-date.ts`, `lib/format-date.test.ts`, `server/modules/content/repo.ts`, `server/modules/content/queries.ts`, `server/modules/content/queries.test.ts`
- Test: `tests/integration/db/content-schema.test.ts`, `tests/integration/content/repo.test.ts`

**Interfaces:**
- Consumes: `PageDocument`, `PageSeo`, `PageSettings`, `RichTextDoc`, `IconField` (Task 3); view types (Task 3); `getDb`, `type Db` (`server/db/client.ts`); `users` (`server/db/schema/auth.ts`).
- Produces (tables, all exported from `@/server/db/schema`): `media`, `services`, `plans`, `testimonials`, `faqs`, `processSteps`, `ctaBands`, `articleCategories`, `authors`, `articles`, `pages`, `revisions`.
- Produces (`server/lib/cache.ts`): `tags` (`setting(key)`, `page(id)`, `routes`, `articles`, `article(id)`, `categories`, `authors`, `collection(name)`, `media`, `redirects`), `type CollectionName = "services" | "plans" | "testimonials" | "faqs" | "steps" | "bands"`, `MISS_LIFE`, `invalidate(tags: readonly string[]): void`.
- Produces (`lib/format-date.ts`): `articleDate(date: Date): { iso: string; label: string }`.
- Produces (`repo.ts`, each takes an optional `db = getDb()`): `findMedia(ids)`, `findPageByPath(path, { draft })`, `findSetting(key)`, `listServices()`, `listPlans()`, `listTestimonials()`, `listFaqs()`, `listProcessSteps()`, `findCtaBand(id)`, `listCategories()`, `listArticleSummaries()`, `findArticleBySlug(slug)`.
- Produces (`queries.ts`, all `'use cache'`): `getMedia(ids)`, `getPublishedPage(path)`, `getSetting(key)`, `getServices()`, `getPlans()`, `getTestimonials()`, `getFaqs()`, `getProcessSteps()`, `getCtaBand(id)`, `getCategories()`, `getArticleSummaries()`, `getArticle(slug)`, `getRelatedArticles(slug, count)`.

- [ ] **Step 1: Write the failing schema integration test**

```ts
// tests/integration/db/content-schema.test.ts
import { sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { articleCategories, articles, authors, media, pages } from "@/server/db/schema"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

async function seedArticle(title: string, bodyText: string) {
  const db = getDb()
  const [image] = await db
    .insert(media)
    .values({ driver: "static", key: "/images/a.png", url: "/images/a.png", filename: "a.png", mimeType: "image/png", sizeBytes: 1 })
    .returning()
  const [category] = await db.insert(articleCategories).values({ slug: "sleep", name: "Sleep" }).returning()
  const [author] = await db.insert(authors).values({ slug: "magda", name: "Magda", avatarId: image.id }).returning()
  const doc = { type: "doc" as const, content: [] }
  return db
    .insert(articles)
    .values({ slug: "a", title, excerpt: "Rest well", coverId: image.id, categoryId: category.id, authorId: author.id, body: doc, bodyText })
    .returning()
}

describe("content schema", () => {
  it("maintains a weighted search vector behind a GIN index", async () => {
    await seedArticle("Calm is a skill", "breathing practice")
    const { rows } = await getDb().execute<{ hit: boolean }>(
      sql`select search @@ websearch_to_tsquery('english', 'breathing') as hit from articles`
    )
    expect(rows[0].hit).toBe(true)
    const index = await getDb().execute<{ indexdef: string }>(
      sql`select indexdef from pg_indexes where indexname = 'articles_search_idx'`
    )
    expect(index.rows[0].indexdef).toMatch(/USING gin/)
  })

  it("refuses to delete media still used by an article", async () => {
    await seedArticle("T", "")
    // Drizzle 0.45 wraps driver errors (DrizzleQueryError); the pg code is on `cause`.
    await expect(getDb().delete(media)).rejects.toMatchObject({ cause: { code: "23503" } })
  })

  it("keeps page paths and system keys unique", async () => {
    const doc = { blocks: [] }
    await getDb().insert(pages).values({ path: "/about", systemKey: "about", title: "About", draft: doc })
    await expect(
      getDb().insert(pages).values({ path: "/about", title: "Again", draft: doc })
    ).rejects.toMatchObject({ cause: { code: "23505" } })
  })
})
```

Run: `pnpm test:integration tests/integration/db/content-schema.test.ts` → FAIL (`articles` not exported).

- [ ] **Step 2: The tables**

```ts
// server/db/schema/media.ts
import { boolean, integer, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { users } from "./auth"

// Every image the site shows (docs/brief.md §6.6, §14). `static` rows point at
// public/images (seeded); uploads arrive in Phase 4.
export const media = pgTable("media", {
  id: uuid().primaryKey().defaultRandom(),
  driver: text({ enum: ["static", "local", "s3"] }).notNull(),
  // Content-hashed for uploads; the public path for static assets.
  key: text().notNull().unique(),
  url: text().notNull(),
  filename: text().notNull(),
  mimeType: text().notNull(),
  sizeBytes: integer().notNull(),
  width: integer(),
  height: integer(),
  blurDataUrl: text(),
  dominantColor: text(),
  alt: text().notNull().default(""),
  caption: text(),
  focalX: real().notNull().default(0.5),
  focalY: real().notNull().default(0.5),
  isDecorative: boolean().notNull().default(false),
  // Seeded assets whose alt text was not obvious from context.
  needsAlt: boolean().notNull().default(false),
  createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp({ withTimezone: true }),
})
```

```ts
// server/db/schema/content.ts
import { sql, type SQL } from "drizzle-orm"
import { boolean, customType, index, integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core"

import type { RichTextDoc } from "@/blocks/rich-text"
import type { StepFrame } from "@/lib/content/types"

import { users } from "./auth"
import { media } from "./media"

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
})

// Fresh builders per table: Drizzle column builders must not be shared.
const stamps = () => ({
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
  updatedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  version: integer().notNull().default(1),
})

// Shared by every collection row (docs/brief.md §6.3). Saving goes live;
// is_visible is the soft unpublish.
const row = () => ({
  id: uuid().primaryKey().defaultRandom(),
  sort: integer().notNull().default(0),
  isVisible: boolean().notNull().default(true),
  ...stamps(),
})

// Media in use cannot be deleted (the Phase 4 delete guard relies on it).
const image = () => uuid().notNull().references(() => media.id, { onDelete: "restrict" })

export const services = pgTable("services", {
  ...row(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  body: text().notNull(),
  icon: text().notNull(),
})

export const plans = pgTable("plans", {
  ...row(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  priceLabel: text().notNull(),
  // For JSON-LD offers (Phase 7); the label is what the site prints.
  priceCents: integer(),
  unit: text().notNull(),
  summary: text().notNull(),
  features: jsonb().$type<string[]>().notNull().default([]),
  ctaLabel: text().notNull(),
  featured: boolean().notNull().default(false),
})

export const testimonials = pgTable("testimonials", {
  ...row(),
  quote: text().notNull(),
  authorName: text().notNull(),
  authorRole: text().notNull(),
  avatarId: image(),
})

export const faqs = pgTable("faqs", {
  ...row(),
  question: text().notNull(),
  answer: text().notNull(),
})

export const processSteps = pgTable("process_steps", {
  ...row(),
  title: text().notNull(),
  description: text().notNull(),
  imageId: image(),
  frame: jsonb().$type<StepFrame>().notNull(),
})

export const ctaBands = pgTable("cta_bands", {
  ...row(),
  name: text().notNull(),
  eyebrow: text().notNull(),
  title: text().notNull(),
  bullets: jsonb().$type<string[]>().notNull().default([]),
  cta: jsonb().$type<{ label: string; href: string }>().notNull(),
  imageId: image(),
  tint: real().notNull().default(0.9),
})

export const articleCategories = pgTable("article_categories", {
  ...row(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull().default(""),
  // Replaces TOPIC_FOR: the article CTA pre-fills this service.
  relatedServiceId: uuid().references(() => services.id, { onDelete: "set null" }),
})

export const authors = pgTable("authors", {
  ...row(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  roleTitle: text().notNull().default(""),
  bio: text().notNull().default(""),
  avatarId: image(),
  userId: uuid().references(() => users.id, { onDelete: "set null" }),
})

export const articles = pgTable(
  "articles",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    excerpt: text().notNull(),
    coverId: image(),
    categoryId: uuid().notNull().references(() => articleCategories.id, { onDelete: "restrict" }),
    authorId: uuid().notNull().references(() => authors.id, { onDelete: "restrict" }),
    // Published copy in typed columns (what the site reads and searches);
    // the editor's working copy lives in `draft` (docs/brief.md §6.5).
    body: jsonb().$type<RichTextDoc>().notNull(),
    bodyText: text().notNull().default(""),
    readingMinutes: integer().notNull().default(1),
    featured: boolean().notNull().default(false),
    status: text({ enum: ["draft", "scheduled", "published", "archived"] }).notNull().default("draft"),
    publishedAt: timestamp({ withTimezone: true }),
    scheduledFor: timestamp({ withTimezone: true }),
    draft: jsonb().$type<unknown>(),
    seo: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ...stamps(),
    // Unqualified column names: Postgres generated columns may only use
    // their own row, and a qualified reference adds nothing.
    search: tsvector().generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') || setweight(to_tsvector('english', coalesce(body_text, '')), 'C')`
    ),
  },
  (table) => [
    index("articles_search_idx").using("gin", table.search),
    index("articles_status_published_idx").on(table.status, table.publishedAt.desc()),
  ]
)
```

```ts
// server/db/schema/pages.ts
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import type { PageDocument, PageSeo, PageSettings } from "@/blocks/page"

import { users } from "./auth"

// A URL whose document is an ordered list of blocks (docs/brief.md §6.1).
// `draft` is always the working copy; `published` is what the site serves.
export const pages = pgTable("pages", {
  id: uuid().primaryKey().defaultRandom(),
  // Fixed keys for system pages (cannot be deleted); null for custom pages.
  systemKey: text().unique(),
  path: text().notNull().unique(),
  title: text().notNull(),
  status: text({ enum: ["draft", "published"] }).notNull().default("draft"),
  draft: jsonb().$type<PageDocument>().notNull(),
  published: jsonb().$type<PageDocument>(),
  seo: jsonb().$type<Partial<PageSeo>>().notNull().default({}),
  settings: jsonb().$type<Partial<PageSettings>>().notNull().default({}),
  version: integer().notNull().default(1),
  publishedAt: timestamp({ withTimezone: true }),
  publishedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
  updatedBy: uuid().references(() => users.id, { onDelete: "set null" }),
})

// Publish snapshots (last 50 per entity, Phase 4) and global rollbacks.
export const revisions = pgTable(
  "revisions",
  {
    id: uuid().primaryKey().defaultRandom(),
    entityType: text().notNull(),
    entityId: text().notNull(),
    version: integer().notNull(),
    snapshot: jsonb().$type<unknown>().notNull(),
    note: text(),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("revisions_entity_idx").on(table.entityType, table.entityId, table.createdAt.desc()),
  ]
)
```

`server/db/schema/index.ts`: add `export * from "./content"`, `export * from "./media"`, `export * from "./pages"` (alphabetical with the existing lines).

The schema files import types from `@/blocks` and `@/lib` with `import type` only, so drizzle-kit (which loads them in Node) never evaluates those modules.

- [ ] **Step 3: Generate and apply the migration**

```bash
pnpm db:generate --name content
cat server/db/migrations/0004_content.sql
pnpm db:migrate
```

Expected: `0004_content.sql` creates the 12 tables; the `search` column reads `"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || …) STORED`; every timestamp is `timestamp with time zone`. If drizzle-kit quotes the type oddly or omits `STORED`, fix the SQL by hand (the migrator only runs the file) and keep the snapshot as generated.

Run the schema test again → PASS.

- [ ] **Step 4: Cache tags, write the failing unit tests**

```ts
// server/lib/cache.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => next)

import { invalidate, tags } from "./cache"

beforeEach(() => next.revalidateTag.mockReset())

describe("invalidate", () => {
  it("expires each tag once, immediately", () => {
    invalidate([tags.page("p1"), tags.routes, tags.routes])
    expect(next.revalidateTag.mock.calls).toEqual([
      ["page:p1", { expire: 0 }],
      ["routes", { expire: 0 }],
    ])
  })
  it("names tags as the catalogue does (docs/brief.md §5.6)", () => {
    expect([tags.setting("footer"), tags.collection("steps"), tags.article("a1")]).toEqual([
      "settings:footer",
      "collection:steps",
      "article:a1",
    ])
  })
})
```

```ts
// server/modules/content/queries.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock("next/cache", () => next)
vi.mock("next/headers", () => ({ draftMode: async () => ({ isEnabled: false }) }))
const repo = vi.hoisted(() => ({
  findPageByPath: vi.fn(),
  findSetting: vi.fn(),
  listServices: vi.fn(),
}))
vi.mock("./repo", () => repo)

import { MISS_LIFE } from "@/server/lib/cache"

import { getPublishedPage, getServices, getSetting } from "./queries"

const tagsOf = () => next.cacheTag.mock.calls.flat()

beforeEach(() => {
  vi.clearAllMocks()
})

// Review Focus 2: requests before `pnpm db:seed` must not pin "nothing"
// for a year.
describe("cached content queries", () => {
  it("caches a missing page briefly, under the routes tag", async () => {
    repo.findPageByPath.mockResolvedValue(null)
    expect(await getPublishedPage("/nope")).toBeNull()
    expect(next.cacheLife).toHaveBeenCalledWith(MISS_LIFE)
    expect(tagsOf()).toContain("routes")
  })
  it("caches a found page for good, under its own tag and routes", async () => {
    repo.findPageByPath.mockResolvedValue({ id: "p1", path: "/about" })
    await getPublishedPage("/about")
    expect(next.cacheLife).toHaveBeenCalledWith("max")
    expect(tagsOf()).toEqual(expect.arrayContaining(["routes", "page:p1"]))
  })
  it("treats an empty collection as a miss", async () => {
    repo.listServices.mockResolvedValue([])
    await getServices()
    expect(next.cacheLife).toHaveBeenCalledWith(MISS_LIFE)
    expect(tagsOf()).toContain("collection:services")
  })
  it("parses a missing setting to its defaults, briefly", async () => {
    repo.findSetting.mockResolvedValue(null)
    expect(await getSetting("navigation")).toEqual({ links: [], cta: { label: "", href: "" } })
    expect(next.cacheLife).toHaveBeenCalledWith(MISS_LIFE)
    expect(tagsOf()).toContain("settings:navigation")
  })
})
```

```ts
// lib/format-date.test.ts
import { describe, expect, it } from "vitest"

import { articleDate } from "./format-date"

describe("articleDate", () => {
  it("prints the labels the articles show today, in Dublin time", () => {
    const at = (iso: string) => articleDate(new Date(`${iso}T12:00:00Z`))
    expect(at("2026-09-02")).toEqual({ iso: "2026-09-02", label: "2nd Sep, 2026" })
    expect(at("2026-08-24").label).toBe("24th Aug, 2026")
    expect(at("2026-08-01").label).toBe("1st Aug, 2026")
    expect(at("2026-07-22").label).toBe("22nd Jul, 2026")
    expect(at("2026-07-13").label).toBe("13th Jul, 2026")
    expect(at("2026-07-11").label).toBe("11th Jul, 2026")
  })
  it("uses the Dublin calendar day, not UTC", () => {
    expect(articleDate(new Date("2026-08-31T23:30:00Z")).iso).toBe("2026-09-01")
  })
})
```

Run: `pnpm vitest run --project unit server/lib/cache.test.ts server/modules/content lib/format-date.test.ts` → FAIL (modules missing).

- [ ] **Step 5: Implement `cache.ts` and `format-date.ts`**

```ts
// server/lib/cache.ts
import "server-only"

import { revalidateTag } from "next/cache"

export type CollectionName = "services" | "plans" | "testimonials" | "faqs" | "steps" | "bands"

// The cache tag catalogue (docs/brief.md §5.6). Queries tag what they read;
// services invalidate what they write.
export const tags = {
  setting: (key: string) => `settings:${key}`,
  page: (id: string) => `page:${id}`,
  routes: "routes",
  articles: "articles",
  article: (id: string) => `article:${id}`,
  categories: "categories",
  authors: "authors",
  collection: (name: CollectionName) => `collection:${name}`,
  media: "media",
  redirects: "redirects",
} as const

// "Nothing here" is cached briefly: content seeded or published after the
// first visit must appear without a restart (and publishing invalidates the
// tags these entries carry anyway).
export const MISS_LIFE = { stale: 30, revalidate: 30, expire: 60 } as const

// Route Handlers cannot use updateTag; { expire: 0 } means the next request
// re-renders instead of being served stale content.
export function invalidate(list: readonly string[]) {
  for (const tag of new Set(list)) revalidateTag(tag, { expire: 0 })
}
```

```ts
// lib/format-date.ts
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const dublin = new Intl.DateTimeFormat("en-IE", {
  timeZone: "Europe/Dublin",
  year: "numeric",
  month: "numeric",
  day: "numeric",
})

const ordinal = (day: number) => {
  if (day % 100 >= 11 && day % 100 <= 13) return "th"
  return ["th", "st", "nd", "rd"][day % 10] ?? "th"
}

// "2nd Sep, 2026". Month names are fixed: ICU's en-IE short month for
// September is "Sept", which would change every label.
export function articleDate(date: Date) {
  const parts = Object.fromEntries(dublin.formatToParts(date).map((p) => [p.type, p.value]))
  const day = Number(parts.day)
  const month = Number(parts.month)
  return {
    iso: `${parts.year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    label: `${day}${ordinal(day)} ${MONTHS[month - 1]}, ${parts.year}`,
  }
}
```

Run `cache.test.ts` and `format-date.test.ts` → PASS.

- [ ] **Step 6: The repo (the only Drizzle code for content)**

```ts
// server/modules/content/repo.ts
import "server-only"

import { and, asc, desc, eq, getTableColumns, inArray, isNull } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"

import { IconField } from "@/blocks/fields"
import { PageDocument, PageSeo, PageSettings } from "@/blocks/page"
import type {
  ArticleDetail,
  ArticleSummary,
  CategoryView,
  CtaBandView,
  FaqView,
  PlanView,
  ProcessStepView,
  PublishedPage,
  ServiceView,
  TestimonialView,
} from "@/lib/content/types"
import { articleDate } from "@/lib/format-date"
import type { MediaAsset } from "@/lib/media"
import { getDb } from "@/server/db/client"
import * as t from "@/server/db/schema"

type MediaRow = typeof t.media.$inferSelect

export const toMediaAsset = (r: MediaRow): MediaAsset => ({
  id: r.id,
  src: r.url,
  width: r.width ?? 0,
  height: r.height ?? 0,
  blurDataURL: r.blurDataUrl,
  alt: r.isDecorative ? "" : r.alt,
  focal: { x: r.focalX, y: r.focalY },
})

export async function findMedia(ids: string[], db = getDb()) {
  if (ids.length === 0) return new Map<string, MediaAsset>()
  const rows = await db
    .select()
    .from(t.media)
    .where(and(inArray(t.media.id, ids), isNull(t.media.deletedAt)))
  return new Map(rows.map((r) => [r.id, toMediaAsset(r)]))
}

const need = (assets: Map<string, MediaAsset>, id: string) => {
  const asset = assets.get(id)
  if (!asset) throw new Error(`Media ${id} is missing`)
  return asset
}

export async function findPageByPath(
  path: string,
  { draft }: { draft: boolean },
  db = getDb()
): Promise<PublishedPage | null> {
  const [row] = await db.select().from(t.pages).where(eq(t.pages.path, path)).limit(1)
  const document = draft ? row?.draft : row?.published
  if (!row || !document) return null
  return {
    id: row.id,
    path: row.path,
    title: row.title,
    systemKey: row.systemKey,
    // Validated on write; parsing again turns a hand-edited row into a clear
    // error instead of a broken render.
    document: PageDocument.parse(document),
    seo: PageSeo.parse(row.seo),
    settings: PageSettings.parse(row.settings),
  }
}

export async function findSetting(key: string, db = getDb()) {
  const [row] = await db.select().from(t.settings).where(eq(t.settings.key, key)).limit(1)
  return row ?? null
}

const visible = (table: { isVisible: AnyPgColumn }) => eq(table.isVisible, true)

export async function listServices(db = getDb()): Promise<ServiceView[]> {
  const rows = await db
    .select()
    .from(t.services)
    .where(visible(t.services))
    .orderBy(asc(t.services.sort))
  return rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, body: r.body, icon: IconField.parse(r.icon) }))
}

export async function listPlans(db = getDb()): Promise<PlanView[]> {
  const rows = await db.select().from(t.plans).where(visible(t.plans)).orderBy(asc(t.plans.sort))
  return rows.map(({ id, slug, name, priceLabel, unit, summary, features, ctaLabel, featured }) => ({
    id, slug, name, priceLabel, unit, summary, features, ctaLabel, featured,
  }))
}

export async function listTestimonials(db = getDb()): Promise<TestimonialView[]> {
  const rows = await db
    .select()
    .from(t.testimonials)
    .where(visible(t.testimonials))
    .orderBy(asc(t.testimonials.sort))
  const assets = await findMedia(rows.map((r) => r.avatarId), db)
  return rows.map((r) => ({ id: r.id, quote: r.quote, name: r.authorName, role: r.authorRole, avatar: need(assets, r.avatarId) }))
}

export async function listFaqs(db = getDb()): Promise<FaqView[]> {
  const rows = await db.select().from(t.faqs).where(visible(t.faqs)).orderBy(asc(t.faqs.sort))
  return rows.map(({ id, question, answer }) => ({ id, question, answer }))
}

export async function listProcessSteps(db = getDb()): Promise<ProcessStepView[]> {
  const rows = await db
    .select()
    .from(t.processSteps)
    .where(visible(t.processSteps))
    .orderBy(asc(t.processSteps.sort))
  const assets = await findMedia(rows.map((r) => r.imageId), db)
  return rows.map((r) => ({ id: r.id, title: r.title, description: r.description, image: need(assets, r.imageId), frame: r.frame }))
}

export async function findCtaBand(id: string, db = getDb()): Promise<CtaBandView | null> {
  const [r] = await db
    .select()
    .from(t.ctaBands)
    .where(and(eq(t.ctaBands.id, id), visible(t.ctaBands)))
    .limit(1)
  if (!r) return null
  const assets = await findMedia([r.imageId], db)
  return { id: r.id, eyebrow: r.eyebrow, title: r.title, bullets: r.bullets, cta: r.cta, image: need(assets, r.imageId), tint: r.tint }
}

export async function listCategories(db = getDb()): Promise<CategoryView[]> {
  const rows = await db
    .select()
    .from(t.articleCategories)
    .where(visible(t.articleCategories))
    .orderBy(asc(t.articleCategories.sort))
  return rows.map(({ id, slug, name }) => ({ id, slug, name }))
}

// Summaries never carry bodies: they feed client components (§4.7).
const { body: _body, draft: _draft, search: _search, ...summaryColumns } = getTableColumns(t.articles)

function articleQuery(db: ReturnType<typeof getDb>) {
  return db
    .select({ a: summaryColumns, category: t.articleCategories, author: t.authors, topic: t.services.slug })
    .from(t.articles)
    .innerJoin(t.articleCategories, eq(t.articles.categoryId, t.articleCategories.id))
    .innerJoin(t.authors, eq(t.articles.authorId, t.authors.id))
    .leftJoin(t.services, eq(t.articleCategories.relatedServiceId, t.services.id))
}

type ArticleRow = Awaited<ReturnType<ReturnType<typeof articleQuery>["execute"]>>[number]

function toSummary(r: ArticleRow, assets: Map<string, MediaAsset>): ArticleSummary {
  return {
    id: r.a.id,
    slug: r.a.slug,
    title: r.a.title,
    excerpt: r.a.excerpt,
    image: need(assets, r.a.coverId),
    category: { slug: r.category.slug, name: r.category.name },
    author: { name: r.author.name, avatar: need(assets, r.author.avatarId) },
    date: articleDate(r.a.publishedAt ?? r.a.createdAt),
    readingMinutes: r.a.readingMinutes,
    featured: r.a.featured,
  }
}

const mediaOf = (rows: ArticleRow[]) => rows.flatMap((r) => [r.a.coverId, r.author.avatarId])

// Published, newest first: the order the fixtures listed them in.
export async function listArticleSummaries(db = getDb()): Promise<ArticleSummary[]> {
  const rows = await articleQuery(db)
    .where(eq(t.articles.status, "published"))
    .orderBy(desc(t.articles.publishedAt))
  const assets = await findMedia(mediaOf(rows), db)
  return rows.map((r) => toSummary(r, assets))
}

export async function findArticleBySlug(slug: string, db = getDb()): Promise<ArticleDetail | null> {
  const [r] = await articleQuery(db)
    .where(and(eq(t.articles.slug, slug), eq(t.articles.status, "published")))
    .limit(1)
  if (!r) return null
  const [{ body }] = await db.select({ body: t.articles.body }).from(t.articles).where(eq(t.articles.id, r.a.id))
  const assets = await findMedia(mediaOf([r]), db)
  return { ...toSummary(r, assets), body, topicSlug: r.topic }
}
```

`ArticleRow` derives the row type from the query builder; if TypeScript cannot infer it through `.execute`, declare it explicitly as `{ a: …; category: typeof t.articleCategories.$inferSelect; author: typeof t.authors.$inferSelect; topic: string | null }` with `a: Omit<typeof t.articles.$inferSelect, "body" | "draft" | "search">`. Prefix the three discarded columns with `_` as shown so the unused-variable lint stays quiet (or add `// eslint-disable-next-line @typescript-eslint/no-unused-vars` if the config flags them).

- [ ] **Step 7: Cached queries**

```ts
// server/modules/content/queries.ts
import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { draftMode } from "next/headers"

import { parseGlobal, type GlobalValue, type PublicGlobalKey } from "@/lib/content/globals"
import { MISS_LIFE, tags } from "@/server/lib/cache"

import * as repo from "./repo"

// Callers must `await io()` first (docs/brief.md §5.6): these run at build
// otherwise, and the build has no database.
const lifetime = (found: boolean) => cacheLife(found ? "max" : MISS_LIFE)

export async function getMedia(ids: string[]) {
  "use cache"
  cacheTag(tags.media)
  const assets = await repo.findMedia(ids)
  lifetime(assets.size === ids.length)
  return assets
}

export async function getPublishedPage(path: string) {
  "use cache"
  // Draft mode may be read inside a cache scope; Next then skips storing.
  const { isEnabled: draft } = await draftMode()
  cacheTag(tags.routes)
  const page = await repo.findPageByPath(path, { draft })
  if (page) cacheTag(tags.page(page.id))
  lifetime(page !== null)
  return page
}

export async function getSetting<K extends PublicGlobalKey>(key: K): Promise<GlobalValue<K>> {
  "use cache"
  cacheTag(tags.setting(key))
  const { isEnabled: draft } = await draftMode()
  const row = await repo.findSetting(key)
  lifetime(row !== null)
  return parseGlobal(key, draft && row?.draft != null ? row.draft : row?.value)
}

const collection = <T>(name: Parameters<typeof tags.collection>[0], load: () => Promise<T[]>) =>
  async () => {
    cacheTag(tags.collection(name))
    const rows = await load()
    lifetime(rows.length > 0)
    return rows
  }

export async function getServices() {
  "use cache"
  return collection("services", repo.listServices)()
}
export async function getPlans() {
  "use cache"
  return collection("plans", repo.listPlans)()
}
export async function getTestimonials() {
  "use cache"
  cacheTag(tags.media)
  return collection("testimonials", repo.listTestimonials)()
}
export async function getFaqs() {
  "use cache"
  return collection("faqs", repo.listFaqs)()
}
export async function getProcessSteps() {
  "use cache"
  cacheTag(tags.media)
  return collection("steps", repo.listProcessSteps)()
}

export async function getCtaBand(id: string) {
  "use cache"
  cacheTag(tags.collection("bands"), tags.media)
  const band = await repo.findCtaBand(id)
  lifetime(band !== null)
  return band
}

export async function getCategories() {
  "use cache"
  cacheTag(tags.categories)
  const rows = await repo.listCategories()
  lifetime(rows.length > 0)
  return rows
}

export async function getArticleSummaries() {
  "use cache"
  cacheTag(tags.articles, tags.categories, tags.authors, tags.media)
  const rows = await repo.listArticleSummaries()
  lifetime(rows.length > 0)
  return rows
}

export async function getArticle(slug: string) {
  "use cache"
  cacheTag(tags.articles, tags.categories, tags.authors, tags.media)
  const article = await repo.findArticleBySlug(slug)
  if (article) cacheTag(tags.article(article.id))
  lifetime(article !== null)
  return article
}

// Same category first, then the newest of the rest (the old helper's rule).
export async function getRelatedArticles(slug: string, count: number) {
  "use cache"
  cacheTag(tags.articles, tags.categories, tags.authors, tags.media)
  const all = await repo.listArticleSummaries()
  const current = all.find((a) => a.slug === slug)
  const others = all.filter((a) => a.slug !== slug)
  lifetime(all.length > 0)
  return [
    ...others.filter((a) => a.category.slug === current?.category.slug),
    ...others.filter((a) => a.category.slug !== current?.category.slug),
  ].slice(0, count)
}
```

`'use cache'` return values must be serialisable: a `Map` is (React serialises `Map`). If the build rejects it, return `[...assets]` and rebuild the map in the caller.

Run `pnpm vitest run --project unit server/modules/content` → PASS.

- [ ] **Step 8: Repo integration test**

```ts
// tests/integration/content/repo.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { faqs, media, pages, services, settings } from "@/server/db/schema"
import { findPageByPath, findSetting, listFaqs, listServices } from "@/server/modules/content/repo"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

const MEDIA_ID = "00000000-0000-4000-8000-000000000001"
const doc = (title: string) => ({
  blocks: [
    {
      id: "about-home",
      type: "hero.page" as const,
      anchor: "home",
      chapter: "Welcome",
      hidden: false,
      joinPrevious: false,
      data: { title, subtitle: "S", image: { mediaId: MEDIA_ID }, focal: null, tint: 0.32, mirror: false },
    },
  ],
})

describe("content repo", () => {
  it("serves the published document, or the draft in draft mode", async () => {
    await getDb().insert(pages).values({ path: "/about", title: "About", draft: doc("Draft"), published: doc("Live") })
    const live = await findPageByPath("/about", { draft: false })
    const draft = await findPageByPath("/about", { draft: true })
    expect(live?.document.blocks[0].data).toMatchObject({ title: "Live" })
    expect(draft?.document.blocks[0].data).toMatchObject({ title: "Draft" })
    expect(live?.settings).toEqual({ showContactChapter: true, needsReview: false })
  })

  it("treats an unpublished page as missing", async () => {
    await getDb().insert(pages).values({ path: "/privacy", title: "Privacy", draft: doc("Draft") })
    expect(await findPageByPath("/privacy", { draft: false })).toBeNull()
    expect(await findPageByPath("/nope", { draft: false })).toBeNull()
  })

  it("lists visible collection rows in sort order", async () => {
    await getDb().insert(services).values([
      { slug: "b", title: "B", body: "b", icon: "sleep", sort: 2 },
      { slug: "a", title: "A", body: "a", icon: "anxiety", sort: 1 },
      { slug: "c", title: "C", body: "c", icon: "habits", sort: 0, isVisible: false },
    ])
    expect((await listServices()).map((s) => s.slug)).toEqual(["a", "b"])
    await getDb().insert(faqs).values({ question: "Q", answer: "A" })
    expect(await listFaqs()).toHaveLength(1)
  })

  it("reads a setting row", async () => {
    await getDb().insert(settings).values({ key: "site", value: { name: "Magda Kennedy" } })
    expect((await findSetting("site"))?.value).toEqual({ name: "Magda Kennedy" })
    expect(await findSetting("footer")).toBeNull()
  })

  it("keeps the media id stable for references", async () => {
    await getDb().insert(media).values({ id: MEDIA_ID, driver: "static", key: "/images/x.png", url: "/images/x.png", filename: "x.png", mimeType: "image/png", sizeBytes: 1 })
    const [row] = await getDb().select().from(media)
    expect(row.id).toBe(MEDIA_ID)
  })
})
```

(Articles are covered end to end by the seed test in Task 7.)

- [ ] **Step 9: Verify**

```bash
pnpm test:integration
pnpm vitest run --project unit
pnpm lint && pnpm typecheck && pnpm build
DATABASE_URL=postgres://nobody:nothing@127.0.0.1:1/unreachable SITE_URL=https://example.com pnpm build
pnpm exec prettier --check server lib/format-date.ts lib/format-date.test.ts tests/integration
```

Expected: PASS (nothing on the site reads the database yet, so the unreachable-DB build is a baseline).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(content): content tables, cache tags, repo and cached queries

Media, collections, articles (generated weighted tsvector + GIN), pages and
revisions (migration 0004). Repo returns view DTOs; queries tag by the
§5.6 catalogue, cache hits for good and misses for a minute.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 7: Media registration and the content seed (`pnpm db:seed`)

**Files:**
- Create: `server/lib/media/probe.ts`, `server/lib/media/probe.test.ts`
- Create: `server/db/seed/ids.ts`, `server/db/seed/media.ts`, `server/db/seed/collections.ts`, `server/db/seed/pages.ts`, `server/db/seed/globals.ts`, `server/db/seed/index.ts`, `scripts/seed.ts`
- Modify: `package.json` (`db:seed`), `scripts/e2e-seed.ts`
- Test: `tests/integration/seed/seed.test.ts`

**Interfaces:**
- Consumes: tables (Task 6); `pageDocumentFor`, `RichTextDoc`, `parseGlobal`, `SITE_TOKENS` (Task 3); `toTipTap`, `plainText`, `readingMinutes` (Task 5); every fixture under `features/*/data` and `features/site/data` (shapes from Tasks 1–5).
- Produces: `probeImage(input: Buffer, { raster }): Promise<{ width; height; blurDataUrl; dominantColor }>` (reused by the Phase 4 upload pipeline); `seedId(kind, key): string` (deterministic uuid); `mediaRef(path): { mediaId }`; `BAND_IDS`; `SYSTEM_PAGES`, `LEGAL_PAGES`; `seedContent(db?): Promise<Record<string, number>>`.

**Idempotency rule.** Every row gets a deterministic id (`seedId`) and is inserted with `onConflictDoNothing()`. A second run inserts nothing and never overwrites an editor's change. Fixture edits after the first seed do not propagate (this seed is a one-time migration; editing is Phase 4). No transaction: each insert is idempotent, so a failed run is finished by running it again. The owner account is not seeded here; `pnpm admin:create` (Phase 1) covers brief §6.7 step 6.

- [ ] **Step 1: Write the failing tests**

```ts
// server/lib/media/probe.test.ts
import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { probeImage } from "./probe"

describe("probeImage", () => {
  it("reads size, a 16 px WebP blur and the dominant colour", async () => {
    const png = await sharp({ create: { width: 32, height: 16, channels: 3, background: { r: 230, g: 20, b: 20 } } })
      .png()
      .toBuffer()
    const probe = await probeImage(png)
    expect(probe.width).toBe(32)
    expect(probe.height).toBe(16)
    expect(probe.blurDataUrl).toMatch(/^data:image\/webp;base64,/)
    expect(probe.dominantColor).toMatch(/^#[0-9a-f]{6}$/)
    expect(Number.parseInt(probe.dominantColor!.slice(1, 3), 16)).toBeGreaterThan(200)
  })
  it("only measures vector images", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"></svg>')
    expect(await probeImage(svg, { raster: false })).toEqual({ width: 24, height: 24, blurDataUrl: null, dominantColor: null })
  })
})
```

```ts
// tests/integration/seed/seed.test.ts
import { readdir, readFile } from "node:fs/promises"

import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { pageDocumentFor } from "@/blocks/page"
import { ARTICLE_BODIES } from "@/features/insights/data/article-bodies"
import { ALL_ARTICLES } from "@/features/insights/data/articles"
import { closeDb, getDb } from "@/server/db/client"
import { pages, services, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { findArticleBySlug, listArticleSummaries } from "@/server/modules/content/repo"

import { resetDb } from "../helpers/db"

const TABLES = ["media", "services", "plans", "testimonials", "faqs", "process_steps", "cta_bands", "article_categories", "authors", "articles", "pages", "settings"]

async function counts() {
  const out: Record<string, number> = {}
  for (const table of TABLES) {
    const { rows } = await getDb().execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(table)}`)
    out[table] = rows[0].n
  }
  return out
}

beforeAll(async () => {
  await resetDb()
  await seedContent()
})
afterAll(closeDb)

// Review Focus 5.
describe("content seed", () => {
  it("fills every table, and a second run changes nothing", async () => {
    const images = (await readdir("public/images", { recursive: true })).filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f))
    const first = await counts()
    expect(first).toEqual({
      media: images.length,
      services: 6,
      plans: 3,
      testimonials: 7,
      faqs: 7,
      process_steps: 4,
      cta_bands: 2,
      article_categories: 5,
      authors: 4,
      articles: 7,
      pages: 9,
      settings: 14,
    })
    await seedContent()
    expect(await counts()).toEqual(first)
  })

  it("never overwrites a row an editor changed", async () => {
    await getDb().update(services).set({ title: "Edited" }).where(eq(services.slug, "sleep-rest"))
    await seedContent()
    const [row] = await getDb().select().from(services).where(eq(services.slug, "sleep-rest"))
    expect(row.title).toBe("Edited")
  })

  it("seeds documents that pass their page rules (fixture validation)", async () => {
    for (const page of await getDb().select().from(pages)) {
      const kind = (page.systemKey ?? "custom") as Parameters<typeof pageDocumentFor>[0]
      expect(pageDocumentFor(kind).safeParse(page.draft).success, page.path).toBe(true)
    }
  })

  it("keeps the legal pages as flagged drafts", async () => {
    const legal = await getDb().select().from(pages).where(sql`${pages.path} in ('/privacy', '/terms', '/disclaimer')`)
    expect(legal).toHaveLength(3)
    for (const page of legal) {
      expect(page.status).toBe("draft")
      expect(page.published).toBeNull()
      expect(page.settings).toMatchObject({ needsReview: true })
    }
  })

  it("keeps article order, date labels and reading times", async () => {
    const summaries = await listArticleSummaries()
    expect(summaries.map((a) => a.slug)).toEqual(ALL_ARTICLES.map((a) => a.slug))
    expect(summaries.map((a) => a.date.label)).toEqual(ALL_ARTICLES.map((a) => a.date.label))
    for (const a of summaries) {
      const words = ARTICLE_BODIES[a.slug]
        .flatMap((b) => (b.type === "list" ? b.items : [b.text]))
        .join(" ")
        .split(/\s+/).length
      expect(a.readingMinutes, a.slug).toBe(Math.max(1, Math.round(words / 220)))
    }
    expect((await findArticleBySlug("calm-is-a-skill"))?.topicSlug).toBe("anxiety-stress")
  })

  it("seeds the theme with exactly the values in site.css", async () => {
    const css = await readFile("app/(site)/site.css", "utf8")
    const [row] = await getDb().select().from(settings).where(eq(settings.key, "theme"))
    for (const [name, value] of Object.entries((row.value as { site: Record<string, string> }).site)) {
      expect(css, name).toMatch(new RegExp(`--color-${name}: ${value};`, "i"))
    }
  })
})
```

Run: `pnpm vitest run --project unit server/lib/media && pnpm test:integration tests/integration/seed` → FAIL (modules missing).

- [ ] **Step 2: Probe, ids, media registration**

```ts
// server/lib/media/probe.ts
import "server-only"

import sharp from "sharp"

export type ImageProbe = {
  width: number
  height: number
  blurDataUrl: string | null
  dominantColor: string | null
}

// Size, a 16 px WebP blur placeholder and the dominant colour (docs/brief.md
// §14). Vector images are measured only.
export async function probeImage(
  input: Buffer,
  { raster = true }: { raster?: boolean } = {}
): Promise<ImageProbe> {
  const { width = 0, height = 0 } = await sharp(input).metadata()
  if (!raster) return { width, height, blurDataUrl: null, dominantColor: null }
  const [blur, stats] = await Promise.all([
    sharp(input).resize(16, 16, { fit: "inside" }).webp({ quality: 50 }).toBuffer(),
    sharp(input).stats(),
  ])
  const hex = [stats.dominant.r, stats.dominant.g, stats.dominant.b]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
  return { width, height, blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`, dominantColor: `#${hex}` }
}
```

```ts
// server/db/seed/ids.ts
import "server-only"

import { createHash } from "node:crypto"

// Deterministic ids keep seeded rows, and the block documents that point at
// them, identical on every run (docs/brief.md §6.7: upsert by stable keys).
// Shaped as an RFC 9562 v4 uuid so uuid columns and z.uuid() accept it.
export function seedId(kind: string, key: string) {
  const h = createHash("sha256").update(`mk-seed:${kind}:${key}`).digest("hex")
  const variant = ((Number.parseInt(h[16], 16) & 0x3) | 0x8).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`
}
```

```ts
// server/db/seed/media.ts
import "server-only"

import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"

import type { Db } from "@/server/db/client"
import { media } from "@/server/db/schema"
import { probeImage } from "@/server/lib/media/probe"

import { seedId } from "./ids"

export const mediaRef = (url: string) => ({ mediaId: seedId("media", url) })

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
}

// Backgrounds and line art carry no information; everything else is flagged
// "needs alt" for an editor (docs/brief.md §6.7 step 2).
const DECORATIVE = new Set([
  "/images/hero/hero-bg.png",
  "/images/hero/hero-depth.png",
  "/images/hero/hero-hair.png",
  "/images/hero/navbar-bg.png",
  "/images/enterprise/enterprise-bg.png",
])

export async function seedMedia(db: Db, publicDir = "public") {
  const root = path.join(publicDir, "images")
  const files = (await readdir(root, { recursive: true })).filter((f) => MIME[path.extname(f).toLowerCase()])
  const rows = []
  for (const file of files) {
    const url = `/images/${file.split(path.sep).join("/")}`
    const absolute = path.join(root, file)
    const vector = url.endsWith(".svg")
    const probe = await probeImage(await readFile(absolute), { raster: !vector })
    const decorative = vector || DECORATIVE.has(url)
    rows.push({
      id: seedId("media", url),
      driver: "static" as const,
      key: url,
      url,
      filename: path.basename(file),
      mimeType: MIME[path.extname(file).toLowerCase()],
      sizeBytes: (await stat(absolute)).size,
      ...probe,
      isDecorative: decorative,
      needsAlt: !decorative,
    })
  }
  await db.insert(media).values(rows).onConflictDoNothing()
  return rows.length
}
```

- [ ] **Step 3: Collections and articles**

```ts
// server/db/seed/collections.ts
import "server-only"

import { RichTextDoc } from "@/blocks/rich-text"
import { ABOUT_CTA } from "@/features/about-page/data/about-page-content"
import { ENTERPRISE_CONTENT } from "@/features/enterprise/data/enterprise-content"
import { FAQS } from "@/features/faq/data/faqs"
import { STEPS } from "@/features/how-it-works/data/steps"
import { ARTICLE_BODIES } from "@/features/insights/data/article-bodies"
import { ALL_ARTICLES, CATEGORIES, FEATURED_ARTICLE } from "@/features/insights/data/articles"
import { FORMATS, SERVICES } from "@/features/services/data/services-content"
import { TESTIMONIALS } from "@/features/testimonials/data/testimonials"
import { cropToFrame } from "@/lib/content/frame"
import { slugify } from "@/lib/utils"
import type { Db } from "@/server/db/client"
import * as t from "@/server/db/schema"

import { seedId } from "./ids"
import { mediaRef } from "./media"
import { plainText, readingMinutes, toTipTap } from "./tiptap"

export const BAND_IDS = { enterprise: seedId("band", "enterprise"), about: seedId("band", "next-step") }

// The article CTA's ?topic= used to come from TOPIC_FOR; it is now the
// category's related service.
const RELATED_SERVICE: Record<string, string> = {
  "Anxiety & Stress": "anxiety-stress",
  Leadership: "performance-leadership",
  Sleep: "sleep-rest",
}

const cents = (label: string) => (label === "Free" ? 0 : Number(label.replace(/[^\d]/g, "")) * 100)
const media = (url: string) => mediaRef(url).mediaId

export async function seedCollections(db: Db) {
  await db.insert(t.services).values(
    SERVICES.items.map((s, i) => ({ id: seedId("service", slugify(s.title)), slug: slugify(s.title), title: s.title, body: s.body, icon: s.icon, sort: i }))
  ).onConflictDoNothing()

  await db.insert(t.plans).values(
    FORMATS.plans.map((p, i) => ({
      id: seedId("plan", slugify(p.name)),
      slug: slugify(p.name),
      name: p.name,
      priceLabel: p.price,
      priceCents: cents(p.price),
      unit: p.unit,
      summary: p.summary,
      features: p.features,
      ctaLabel: p.cta.label,
      featured: p.featured ?? false,
      sort: i,
    }))
  ).onConflictDoNothing()

  // Left column first, then right: splitColumns gives back today's columns.
  await db.insert(t.testimonials).values(
    TESTIMONIALS.map((x, i) => ({ id: seedId("testimonial", String(i)), quote: x.quote, authorName: x.name, authorRole: x.role, avatarId: media(x.avatar), sort: i }))
  ).onConflictDoNothing()

  await db.insert(t.faqs).values(
    FAQS.map((f, i) => ({ id: seedId("faq", String(i)), question: f.question, answer: f.answer, sort: i }))
  ).onConflictDoNothing()

  await db.insert(t.processSteps).values(
    STEPS.map((s, i) => ({ id: seedId("step", String(i)), title: s.title, description: s.description, imageId: media(s.image), frame: cropToFrame(s.crop), sort: i }))
  ).onConflictDoNothing()

  await db.insert(t.ctaBands).values(
    [
      { id: BAND_IDS.enterprise, name: "Enterprise", band: ENTERPRISE_CONTENT },
      { id: BAND_IDS.about, name: "Next step", band: ABOUT_CTA },
    ].map(({ id, name, band }, i) => ({
      id,
      name,
      eyebrow: band.eyebrow,
      title: band.title,
      bullets: [...band.bullets],
      cta: band.cta,
      imageId: media(band.image),
      tint: band.tint,
      sort: i,
    }))
  ).onConflictDoNothing()

  await db.insert(t.articleCategories).values(
    CATEGORIES.map((name, i) => ({
      id: seedId("category", slugify(name)),
      slug: slugify(name),
      name,
      relatedServiceId: RELATED_SERVICE[name] ? seedId("service", RELATED_SERVICE[name]) : null,
      sort: i,
    }))
  ).onConflictDoNothing()

  // The fixtures sign the same person with four avatars; each pairing is
  // its own author row so every byline renders as before (a content finding
  // for the client).
  const authors = new Map<string, { name: string; avatar: string }>()
  for (const a of ALL_ARTICLES) authors.set(`${a.author.name}|${a.author.avatar}`, a.author)
  const authorId = (a: { name: string; avatar: string }) => seedId("author", `${a.name}|${a.avatar}`)
  await db.insert(t.authors).values(
    [...authors.values()].map((a, i) => ({
      id: authorId(a),
      slug: slugify(`${a.name} ${a.avatar.split("/").pop()!.replace(/\.\w+$/, "")}`),
      name: a.name,
      avatarId: media(a.avatar),
      sort: i,
    }))
  ).onConflictDoNothing()

  await db.insert(t.articles).values(
    ALL_ARTICLES.map((a) => {
      const body = RichTextDoc.parse(toTipTap(ARTICLE_BODIES[a.slug] ?? []))
      const text = plainText(body)
      return {
        id: seedId("article", a.slug),
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        coverId: media(a.image),
        categoryId: seedId("category", slugify(a.category)),
        authorId: authorId(a.author),
        body,
        bodyText: text,
        readingMinutes: readingMinutes(text),
        featured: a.slug === FEATURED_ARTICLE.slug,
        status: "published" as const,
        // Midday UTC is the same calendar day in Dublin all year.
        publishedAt: new Date(`${a.date.iso}T12:00:00Z`),
      }
    })
  ).onConflictDoNothing()
}
```

- [ ] **Step 4: Pages**

```ts
// server/db/seed/pages.ts
import "server-only"

import type { PageKind } from "@/blocks/define-block"
import { pageDocumentFor, type PageDocument } from "@/blocks/page"
import type { BlockData, BlockInstance, BlockType } from "@/blocks/registry"
import { ABOUT_CONTENT } from "@/features/about/data/about-content"
import { ABOUT_APPROACH, ABOUT_CREDENTIALS, ABOUT_HERO, ABOUT_STATS, ABOUT_STORY } from "@/features/about-page/data/about-page-content"
import { CLINIC, CONTACT_HERO, CONTACT_INFO } from "@/features/contact/data/contact-content"
import { CREDENTIALS } from "@/features/credibility/data/credentials"
import { FAQ_HEADER } from "@/features/faq/data/faqs"
import { HERO_CONTENT } from "@/features/hero/data/hero-content"
import { FIT, HOW_IT_WORKS_HERO, SESSION } from "@/features/how-it-works/data/session"
import { HOW_IT_WORKS } from "@/features/how-it-works/data/steps"
import { INSIGHTS_HERO, PAGE_SIZE } from "@/features/insights/data/articles"
import { INSIGHTS_HEADER } from "@/features/insights/data/posts"
import { FORMATS, SERVICES, SERVICES_HERO } from "@/features/services/data/services-content"
import { TESTIMONIALS_HEADER } from "@/features/testimonials/data/testimonials"
import type { Db } from "@/server/db/client"
import { pages } from "@/server/db/schema"

import { BAND_IDS } from "./collections"
import { seedId } from "./ids"
import { mediaRef } from "./media"

type Spec = {
  [T in BlockType]: { type: T; anchor: string; chapter: string | null; data: BlockData<T>; joinPrevious?: boolean }
}[BlockType]

type HeroFixture = { title: string; subtitle: string; image: string; focal: { x: number; y: number } | null; tint: number; mirror: boolean }

const ALL = { mode: "all" } as const
const hero = (h: HeroFixture): Spec => ({ type: "hero.page", anchor: "home", chapter: "Welcome", data: { ...h, image: mediaRef(h.image) } })
const faq = (variant: "home" | "page"): Spec => ({ type: "faq", anchor: "faq", chapter: "FAQ", data: { variant, ...FAQ_HEADER, selection: ALL, initiallyOpen: 0 } })
const processSpec = (variant: "home" | "page"): Spec => ({
  type: "process",
  anchor: "how-it-works",
  chapter: "Process",
  data: {
    variant,
    tag: variant === "page" ? HOW_IT_WORKS.page.tag : "",
    title: variant === "page" ? HOW_IT_WORKS.page.title : HOW_IT_WORKS.title,
    subtitle: HOW_IT_WORKS.subtitle,
    cta: HOW_IT_WORKS.cta,
  },
})
const band = (anchor: string, chapter: string, bandId: string, tint: number | null): Spec => ({ type: "band", anchor, chapter, data: { bandId, tint } })

type PageSeed = { kind: PageKind; path: string; title: string; description: string; contact: boolean; specs: Spec[] }

// Today's composition, ids, chapter labels and tints (docs/brief.md §6.7 step 4).
export const SYSTEM_PAGES: PageSeed[] = [
  {
    kind: "home", path: "/", title: "Home", description: HERO_CONTENT.description, contact: true,
    specs: [
      { type: "hero.home", anchor: "home", chapter: "Welcome", data: { ...HERO_CONTENT, members: { ...HERO_CONTENT.members, avatars: HERO_CONTENT.members.avatars.map(mediaRef) } } },
      { type: "credibility", anchor: "credibility", chapter: null, data: { badges: CREDENTIALS } },
      { type: "about.intro", anchor: "about", chapter: "About", joinPrevious: true, data: ABOUT_CONTENT },
      processSpec("home"),
      { type: "testimonials", anchor: "testimonials", chapter: "Stories", data: { variant: "home", ...TESTIMONIALS_HEADER, selection: ALL } },
      band("enterprise", "Organisations", BAND_IDS.enterprise, null),
      { type: "insights.latest", anchor: "insights", chapter: "Insights", data: { ...INSIGHTS_HEADER, count: 3, selection: ALL } },
      faq("home"),
    ],
  },
  {
    kind: "about", path: "/about", title: ABOUT_HERO.title, description: ABOUT_HERO.subtitle, contact: true,
    specs: [
      hero(ABOUT_HERO),
      { type: "about.story", anchor: "story", chapter: "Story", data: { ...ABOUT_STORY, photo: mediaRef(ABOUT_STORY.photo) } },
      { type: "about.stats", anchor: "practice-in-numbers", chapter: null, joinPrevious: true, data: { stats: ABOUT_STATS } },
      { type: "about.approach", anchor: "approach", chapter: "Approach", data: ABOUT_APPROACH },
      { type: "about.credentials", anchor: "credentials", chapter: "Credentials", data: ABOUT_CREDENTIALS },
      { type: "testimonials", anchor: "testimonials", chapter: "Stories", data: { variant: "page", ...TESTIMONIALS_HEADER, selection: ALL } },
      band("next-step", "Next step", BAND_IDS.about, 0.7),
    ],
  },
  {
    kind: "services", path: "/services", title: SERVICES_HERO.title, description: SERVICES_HERO.subtitle, contact: true,
    specs: [
      hero(SERVICES_HERO),
      { type: "services.grid", anchor: "services", chapter: "Services", data: { eyebrow: SERVICES.eyebrow, title: SERVICES.title, intro: SERVICES.intro, more: SERVICES.more } },
      { type: "services.plans", anchor: "formats", chapter: "Formats", data: { eyebrow: FORMATS.eyebrow, title: FORMATS.title, subtitle: FORMATS.subtitle, featuredTag: FORMATS.featuredTag } },
      band("enterprise", "Organisations", BAND_IDS.enterprise, null),
      faq("page"),
    ],
  },
  {
    kind: "how-it-works", path: "/how-it-works", title: HOW_IT_WORKS_HERO.title, description: HOW_IT_WORKS_HERO.subtitle, contact: true,
    specs: [
      hero(HOW_IT_WORKS_HERO),
      processSpec("page"),
      { type: "session.timeline", anchor: "session", chapter: "A session", data: SESSION },
      { type: "fit", anchor: "fit", chapter: "Fit", data: FIT },
      faq("page"),
      band("next-step", "Next step", BAND_IDS.about, null),
    ],
  },
  {
    kind: "insights", path: "/insights", title: INSIGHTS_HERO.title, description: INSIGHTS_HERO.subtitle, contact: true,
    specs: [
      hero(INSIGHTS_HERO),
      { type: "insights.browser", anchor: "articles", chapter: "Articles", data: { heading: "Latest articles", pageSize: PAGE_SIZE } },
      { type: "newsletter", anchor: "newsletter", chapter: "Newsletter", data: { override: null } },
    ],
  },
  {
    kind: "contact", path: "/contact", title: CONTACT_HERO.title, description: CONTACT_HERO.subtitle, contact: false,
    specs: [
      hero(CONTACT_HERO),
      { type: "contact.details", anchor: "get-in-touch", chapter: "Get in touch", data: CONTACT_INFO },
      { type: "contact.clinic", anchor: "clinic", chapter: "Clinic", data: { eyebrow: CLINIC.eyebrow, title: CLINIC.title, subtitle: CLINIC.subtitle, photo: mediaRef(CLINIC.photo) } },
      faq("home"),
    ],
  },
]

// Footer links point here; until an editor writes real copy and publishes,
// they stay drafts and keep answering 404 (as they do today).
export const LEGAL_PAGES: PageSeed[] = [
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms"],
  ["/disclaimer", "Disclaimer"],
].map(([path, title]) => ({
  kind: "custom",
  path,
  title,
  description: "",
  contact: true,
  specs: [
    hero({ title, subtitle: "Placeholder copy: replace before launch.", image: "/images/hero/hero-bg.png", focal: null, tint: 0.32, mirror: false }),
    {
      type: "richtext",
      anchor: "content",
      chapter: null,
      data: {
        doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `This ${title.toLowerCase()} is a placeholder and has not been reviewed.` }] }] },
        width: "narrow",
      },
    },
  ],
}))

const documentOf = (seed: PageSeed): PageDocument =>
  // Throws on a fixture the registry rejects: this is the fixture validation.
  pageDocumentFor(seed.kind).parse({
    blocks: seed.specs.map(
      (spec): BlockInstance => ({ id: `${seed.kind}-${spec.anchor}`, hidden: false, ...spec, joinPrevious: spec.joinPrevious ?? false }) as BlockInstance
    ),
  })

export async function seedPages(db: Db) {
  const rows = [...SYSTEM_PAGES, ...LEGAL_PAGES].map((seed) => {
    const document = documentOf(seed)
    const live = seed.kind !== "custom"
    return {
      id: seedId("page", seed.path),
      systemKey: live ? seed.kind : null,
      path: seed.path,
      title: seed.title,
      status: live ? ("published" as const) : ("draft" as const),
      draft: document,
      published: live ? document : null,
      seo: { description: seed.description || null },
      settings: { showContactChapter: seed.contact, needsReview: !live },
      publishedAt: live ? new Date() : null,
    }
  })
  await db.insert(pages).values(rows).onConflictDoNothing()
  return rows.length
}
```

Block ids are `${kind}-${anchor}`; the three legal pages share `kind: "custom"`, which is fine because ids only need to be unique within a page. `FORMATS.featuredTag` was added in Task 5.

- [ ] **Step 5: Globals and the entry point**

```ts
// server/db/seed/globals.ts
import "server-only"

import { CONTACT, CONTACT_FORM } from "@/features/contact/data/contact-content"
import { FOOTER } from "@/features/footer/data/footer-links"
import { HERO_CONTENT } from "@/features/hero/data/hero-content"
import { NEWSLETTER } from "@/features/insights/data/articles"
import { NAVIGATION } from "@/features/navbar/data/nav-links"
import { MICROCOPY } from "@/features/site/data/microcopy"
import { SITE } from "@/features/site/data/site"
import { parseGlobal, SITE_TOKENS, type GlobalKey } from "@/lib/content/globals"
import type { Db } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { mediaRef } from "./media"

// Today's palette (app/(site)/site.css @theme), published as the site theme.
const SITE_THEME: Record<(typeof SITE_TOKENS)[number], string> = {
  brand: "#336060",
  "brand-mint": "#d6e8e4",
  cream: "#faf6f0",
  "brand-deep": "#245f60",
  clay: "#b55441",
  stone: "#f3f4ee",
  mist: "#d9e5e5",
  forest: "#245333",
  pine: "#1e4f50",
  ink: "#030303",
  "ink-muted": "#3d3d3d",
  "text-strong": "#0c0c0c",
  "text-muted": "#525252",
  "text-subtle": "#8a8f88",
  line: "#dfe2d8",
  "line-soft": "#e7e9e0",
  "line-neutral": "#ececec",
  "line-faint": "#f2f2f2",
  "line-rule": "#d8dccf",
  "surface-soft": "#f8f9f5",
  "surface-warm": "#fcfaf7",
  "hero-base": "#0d120f",
  moss: "#315d44",
  spruce: "#002620",
}

const VALUES: Record<GlobalKey, unknown> = {
  site: { ...SITE, logo: mediaRef("/images/hero/logo-mark.svg") },
  contact: { ...CONTACT, clinic: { ...CONTACT.clinic, photo: mediaRef(CONTACT.clinic.photo) } },
  navigation: NAVIGATION,
  footer: FOOTER,
  newsletter: { ...NEWSLETTER, image: mediaRef(NEWSLETTER.image) },
  contactForm: CONTACT_FORM,
  microcopy: MICROCOPY,
  seo: {
    titleTemplate: `%s | ${SITE.name}`,
    defaultTitle: `${SITE.name}: ${SITE.professionalTitle}`,
    defaultDescription: HERO_CONTENT.description,
    business: { type: "ProfessionalService", priceRange: "€€" },
  },
  tracking: {},
  consent: {},
  scripts: {},
  theme: { site: SITE_THEME, admin: {} },
  notifications: {},
  privacy: {},
}

export async function seedGlobals(db: Db) {
  const rows = (Object.keys(VALUES) as GlobalKey[]).map((key) => ({ key, value: parseGlobal(key, VALUES[key]) }))
  await db.insert(settings).values(rows).onConflictDoNothing()
  return rows.length
}
```

```ts
// server/db/seed/index.ts
import "server-only"

import { getDb, type Db } from "@/server/db/client"

import { seedCollections } from "./collections"
import { seedGlobals } from "./globals"
import { seedMedia } from "./media"
import { seedPages } from "./pages"

// docs/brief.md §6.7. Media first: every other table references it.
export async function seedContent(db: Db = getDb()) {
  const media = await seedMedia(db)
  await seedCollections(db)
  const pages = await seedPages(db)
  const globals = await seedGlobals(db)
  return { media, pages, globals }
}
```

```ts
// scripts/seed.ts
import { closeDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"

// A running server caches "no content" for up to a minute (MISS_LIFE), so
// the site fills in shortly after this finishes; restart to see it at once.
seedContent()
  .then((counts) => console.log("[seed] content is in place", counts))
  .catch((error: unknown) => {
    console.error("[seed] failed", error)
    process.exitCode = 1
  })
  .finally(closeDb)
```

`package.json` scripts: add `"db:seed": "NODE_OPTIONS=--conditions=react-server dotenv -e .env -- tsx scripts/seed.ts"`.

`scripts/e2e-seed.ts`: after the user loop add `await seedContent()` (import from `@/server/db/seed`) and log the counts. From now on every E2E and parity run starts from seeded content.

- [ ] **Step 6: Verify**

```bash
pnpm vitest run --project unit server/lib/media
pnpm test:integration
pnpm db:seed && pnpm db:seed
pnpm e2e:seed
pnpm lint && pnpm typecheck && pnpm build
pnpm test:parity
pnpm exec prettier --check server scripts tests/integration
```

Expected: PASS. Running `db:seed` twice under `tsx` proves the fixture graph loads in Node (no component or image imports) and is idempotent; the second run prints the same counts and inserts nothing (check with `select count(*) from pages`). Parity still 21/21 (the site does not read the database yet; this run proves the reseeded E2E database does not disturb it).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(content): idempotent content seed from today's fixtures

Registers public/images as static media (sharp size, blur, dominant
colour), converts article bodies to TipTap JSON, and seeds collections,
six system pages, three draft legal pages and every global with stable
ids and insert-if-missing (brief §6.7).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: `SiteFrame` — chrome and theme from the database

**Files:**
- Create: `lib/content/theme.ts`, `lib/content/theme.test.ts`, `app/(site)/_cms/site-frame.tsx`
- Modify: `app/(site)/layout.tsx`, `app/global-not-found.tsx`, `next.config.ts`

**Interfaces:**
- Consumes: `getSetting` (Task 6); `SiteHeader`, `SiteFooter` props (Task 5); `SITE_TOKENS` (Task 3).
- Produces: `themeCss(tokens): string`; `<SiteFrame>{children}</SiteFrame>` (async server component; must sit inside `<Suspense>`).

- [ ] **Step 1: Write the failing test**

```ts
// lib/content/theme.test.ts
import { describe, expect, it } from "vitest"

import { themeCss } from "./theme"

describe("themeCss", () => {
  it("writes valid tokens as :root custom properties", () => {
    expect(themeCss({ brand: "#336060", clay: "#b55441" })).toBe(":root{--color-brand:#336060;--color-clay:#b55441}")
  })
  it("never writes anything but a hex colour into the style tag", () => {
    expect(themeCss({ brand: "#000000;}</style><script>" } as never)).toBe("")
    expect(themeCss({})).toBe("")
  })
})
```

Run: `pnpm vitest run --project unit lib/content/theme.test.ts` → FAIL.

- [ ] **Step 2: Implement `themeCss` and `SiteFrame`**

```ts
// lib/content/theme.ts
import { SITE_TOKENS, type GlobalValue } from "./globals"

const HEX = /^#[0-9a-f]{6}$/i

// The published site theme as :root overrides of the @theme tokens. The
// schema already allows only hex, and this string lands in a <style> tag,
// so it is checked again here.
export function themeCss(tokens: GlobalValue<"theme">["site"]) {
  const declarations = SITE_TOKENS.flatMap((name) => {
    const value = tokens[name]
    return value && HEX.test(value) ? [`--color-${name}:${value}`] : []
  })
  return declarations.length ? `:root{${declarations.join(";")}}` : ""
}
```

```tsx
// app/(site)/_cms/site-frame.tsx
import { io } from "next/cache"

import { SmoothScroll } from "@/components/smooth-scroll"
import { SiteFooter } from "@/features/footer"
import { SiteHeader } from "@/features/navbar"
import { themeCss } from "@/lib/content/theme"
import { getSetting } from "@/server/modules/content/queries"

// Site chrome from the globals (docs/brief.md §5.5a). io() suspends during
// prerender, so the build never reaches the database; at request time the
// settings come from the tag cache.
export async function SiteFrame({ children }: { children: React.ReactNode }) {
  await io()
  const [site, navigation, footer, theme] = await Promise.all([
    getSetting("site"),
    getSetting("navigation"),
    getSetting("footer"),
    getSetting("theme"),
  ])
  const css = themeCss(theme.site)
  return (
    <>
      {css && <style>{css}</style>}
      <SmoothScroll>
        <SiteHeader site={site} navigation={navigation} />
        {children}
        <SiteFooter site={site} footer={footer} navigation={navigation} />
      </SmoothScroll>
    </>
  )
}
```

- [ ] **Step 3: Layout, root metadata, config**

```tsx
// app/(site)/layout.tsx
import type { Metadata } from "next"
import { io } from "next/cache"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { Suspense } from "react"

import { getEnv } from "@/server/env"
import { getSetting } from "@/server/modules/content/queries"

import { SiteFrame } from "./_cms/site-frame"
import { siteFontClassName } from "./fonts"

import "./site.css"

// Root metadata: metadataBase fixes og:image URLs, and the title template
// comes from the SEO global (Phase 7 adds the rest).
export async function generateMetadata(): Promise<Metadata> {
  await io()
  const seo = await getSetting("seo")
  return {
    metadataBase: new URL(getEnv().SITE_URL),
    title: seo.titleTemplate
      ? { default: seo.defaultTitle, template: seo.titleTemplate }
      : seo.defaultTitle,
    description: seo.defaultDescription || undefined,
  }
}

// The public site has a single light design. The admin has its own root
// layout with light/dark support, so next-themes is not used here.
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IE" className={siteFontClassName}>
      <body>
        <noscript>
          <style>{"[data-reveal]{visibility:visible!important}"}</style>
        </noscript>
        <NuqsAdapter>
          <Suspense fallback={null}>
            <SiteFrame>{children}</SiteFrame>
          </Suspense>
        </NuqsAdapter>
      </body>
    </html>
  )
}
```

`app/global-not-found.tsx`: drop the header, footer and their fixture imports; keep the fonts, `site.css`, `<main data-page-root>` and the message. With the `[...slug]` catch-all (Task 9) it only renders for URLs no route matches at all; site 404s render `app/(site)/not-found.tsx` inside the layout above, chrome included. A prerendered page cannot wait for the database, which is why it carries no chrome.

`next.config.ts`, inside `nextConfig`:

```ts
  // Metadata blocks for every user agent (docs/brief.md §5.6 rule 5): it is
  // cached, so this costs almost nothing, and crawlers always see full tags.
  // It also lets generateMetadata's notFound() set a real 404 status.
  htmlLimitedBots: /.*/,
  // One replica holds the whole tag cache in memory (docs/brief.md §5.6 rule 8).
  cacheMaxMemorySize: 128 * 1024 * 1024,
```

Remove the `SITE`/`NAVIGATION`/`FOOTER` imports the layout used in Task 5.

- [ ] **Step 4: Verify**

```bash
pnpm vitest run --project unit lib/content
pnpm lint && pnpm typecheck && pnpm build
DATABASE_URL=postgres://nobody:nothing@127.0.0.1:1/unreachable SITE_URL=https://example.com pnpm build
pnpm test:parity
pnpm exec playwright test tests/e2e/navigation --project=desktop
pnpm exec prettier --check lib/content 'app/(site)' app/global-not-found.tsx next.config.ts
```

Expected: both builds pass (the second proves the layout's database reads are gated); parity 21/21 with header and footer now from the database; `curl -s localhost:3000/ | grep -o '<title>[^<]*'` shows the default title.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(site): site frame, theme and root metadata from the database

SiteFrame awaits io() inside Suspense and renders header, footer and the
published theme tokens from cached globals. Root metadata gets metadataBase
and the title template; metadata blocks for every agent.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 9: CMS routing — `BlockRenderer`, `CmsPage`, `[...slug]`, article template from the database

**Files:**
- Create: `lib/content/page-layout.ts`, `tests/content/page-layout.test.ts` (under `tests/`: it imports the seed, which `lib/**` may not), `app/(site)/_cms/cms-page.tsx`, `app/(site)/_cms/block-renderer.tsx`, `app/(site)/_cms/resolve-block.tsx`, `features/richtext/components/rich-text-section.tsx`, `features/richtext/index.ts`, `app/(site)/[...slug]/page.tsx`, `app/(site)/not-found.tsx`, `app/(site)/io-gate.test.ts`, `tests/e2e/navigation/cms.spec.ts`
- Modify: `app/(site)/page.tsx`, `app/(site)/insights/page.tsx`, `app/(site)/insights/[slug]/page.tsx`, `tests/e2e/navigation/activity.spec.ts`
- Delete: `app/(site)/{about,services,how-it-works,contact}/page.tsx` (the catch-all serves them), `app/(site)/_legacy/`

**Interfaces:**
- Consumes: every query (Task 6), `BlockView`/`collectMediaIds`/`resolveMedia` (Task 3), section signatures (Tasks 4–5), `SiteFrame` (Task 8), `contactHref`, `slugify`.
- Produces: `groupCards(blocks)`, `pageChapters(blocks, contactLabel)` (`lib/content/page-layout.ts`); `<CmsPage path />`, `cmsMetadata(path)`; `<BlockRenderer page contactLabel />`; `<ResolvedBlock block />`.

- [ ] **Step 1: Write the failing layout test (the rail must not move)**

```ts
// tests/content/page-layout.test.ts
import { describe, expect, it } from "vitest"

import { LEGAL_PAGES, SYSTEM_PAGES } from "@/server/db/seed/pages"

import { groupCards, pageChapters } from "@/lib/content/page-layout"

const blocksOf = (path: string) =>
  SYSTEM_PAGES.find((p) => p.path === path)!.specs.map((s, i) => ({
    ...s,
    id: String(i),
    hidden: false,
    joinPrevious: s.joinPrevious ?? false,
  }))

// The CHAPTERS arrays the pages had before Phase 3, verbatim.
const BEFORE: Record<string, [string, string][]> = {
  "/": [["Welcome", "home"], ["About", "about"], ["Process", "how-it-works"], ["Stories", "testimonials"], ["Organisations", "enterprise"], ["Insights", "insights"], ["FAQ", "faq"], ["Contact", "contact"]],
  "/about": [["Welcome", "home"], ["Story", "story"], ["Approach", "approach"], ["Credentials", "credentials"], ["Stories", "testimonials"], ["Next step", "next-step"], ["Contact", "contact"]],
  "/services": [["Welcome", "home"], ["Services", "services"], ["Formats", "formats"], ["Organisations", "enterprise"], ["FAQ", "faq"], ["Contact", "contact"]],
  "/how-it-works": [["Welcome", "home"], ["Process", "how-it-works"], ["A session", "session"], ["Fit", "fit"], ["FAQ", "faq"], ["Next step", "next-step"], ["Contact", "contact"]],
  "/insights": [["Welcome", "home"], ["Articles", "articles"], ["Newsletter", "newsletter"], ["Contact", "contact"]],
  "/contact": [["Welcome", "home"], ["Get in touch", "get-in-touch"], ["Clinic", "clinic"], ["FAQ", "faq"]],
}

describe("page layout", () => {
  it.each(Object.entries(BEFORE))("derives the old rail for %s", (path, expected) => {
    const page = SYSTEM_PAGES.find((p) => p.path === path)!
    const chapters = pageChapters(blocksOf(path), page.contact ? "Contact" : null)
    expect(chapters.map((c) => [c.label, c.target])).toEqual(expected)
  })

  it("groups joined blocks into one card and skips hidden ones", () => {
    const cards = groupCards(blocksOf("/"))
    expect(cards.map((card) => card.map((b) => b.anchor))).toEqual([
      ["home"], ["credibility", "about"], ["how-it-works"], ["testimonials"], ["enterprise"], ["insights"], ["faq"],
    ])
    const hidden = blocksOf("/").map((b) => (b.anchor === "enterprise" ? { ...b, hidden: true } : b))
    expect(groupCards(hidden).flat().map((b) => b.anchor)).not.toContain("enterprise")
    expect(pageChapters(hidden, null).map((c) => c.target)).not.toContain("enterprise")
  })

  it("keeps legal pages out of the rail except Welcome and Contact", () => {
    const blocks = LEGAL_PAGES[0].specs.map((s, i) => ({ ...s, id: String(i), hidden: false, joinPrevious: false }))
    expect(pageChapters(blocks, "Contact").map((c) => c.target)).toEqual(["home", "contact"])
  })
})
```

Run: `pnpm vitest run --project unit tests/content/page-layout.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement `page-layout.ts`**

```ts
// lib/content/page-layout.ts
import type { Chapter } from "./types"

type Placed = { anchor: string; chapter: string | null; hidden: boolean; joinPrevious: boolean }

// Consecutive joinPrevious blocks share one StackCard (docs/brief.md §6.2).
export function groupCards<T extends Placed>(blocks: T[]): T[][] {
  const cards: T[][] = []
  for (const block of blocks) {
    if (block.hidden) continue
    const last = cards.at(-1)
    if (block.joinPrevious && last) last.push(block)
    else cards.push([block])
  }
  return cards
}

// JourneyRail chapters come from the blocks (§5.7 rule 8). The first card is
// #home; "Contact" targets the footer, which lives in the layout.
export function pageChapters(blocks: Placed[], contactLabel: string | null): Chapter[] {
  const chapters = blocks
    .filter((block) => !block.hidden)
    .flatMap((block, i) =>
      block.chapter ? [{ label: block.chapter, target: i === 0 ? "home" : block.anchor }] : []
    )
  if (contactLabel) chapters.push({ label: contactLabel, target: "contact" })
  return chapters
}
```

Run the test → PASS.

- [ ] **Step 3: Rich-text section, block resolver, renderer, page**

```tsx
// features/richtext/components/rich-text-section.tsx
import { Container } from "@/components/layout/container"
import { RichText } from "@/features/insights/components/rich-text"
import type { BlockView } from "@/blocks/media-refs"
import { cn } from "@/lib/utils"

// Legal and custom pages: the article's reading typography in a plain section.
export function RichTextSection({ id, content }: { id: string; content: BlockView<"richtext"> }) {
  return (
    <section id={id} className="bg-white py-20 lg:py-30">
      <Container>
        <div className={cn("flex flex-col gap-6 text-[17px] leading-[1.75] text-ink-muted", content.width === "narrow" ? "max-w-180" : "max-w-260")}>
          <RichText doc={content.doc} />
        </div>
      </Container>
    </section>
  )
}
```

`features/richtext/index.ts`: `export { RichTextSection } from "./components/rich-text-section"`.

```tsx
// app/(site)/_cms/resolve-block.tsx
import type { BlockInstance } from "@/blocks/registry"
import { collectMediaIds, resolveMedia } from "@/blocks/media-refs"
import { PageHero } from "@/components/page-hero"
import { ApproachSection, CredentialsSection, StatsBand, StorySection } from "@/features/about-page"
import { AboutSection } from "@/features/about"
import { ClinicSection, ContactSection } from "@/features/contact"
import { CredibilitySection } from "@/features/credibility"
import { EnterpriseSection } from "@/features/enterprise"
import { FaqSection } from "@/features/faq"
import { HeroSection } from "@/features/hero"
import { FitSection, HowItWorksSection, SessionTimeline } from "@/features/how-it-works"
import { FeaturedArticle, InsightsBrowser, InsightsSection, NewsletterBand } from "@/features/insights"
import { RichTextSection } from "@/features/richtext"
import { FormatsSection, ServicesGrid } from "@/features/services"
import { TestimonialsSection } from "@/features/testimonials"
import { slugify } from "@/lib/utils"
import * as q from "@/server/modules/content/queries"

const withMedia = async <T,>(value: T) => resolveMedia(value, await q.getMedia(collectMediaIds(value)))

// "all" keeps the collection's order; "chosen" keeps the editor's order.
const select = <T extends { id: string }>(items: T[], selection: { mode: "all" } | { mode: "chosen"; ids: string[] }) =>
  selection.mode === "all" ? items : selection.ids.flatMap((id) => items.filter((item) => item.id === id))

// One block → its section, with the collection rows and globals it uses.
// Heroes render no id: the first StackCard is #home.
export async function ResolvedBlock({ block }: { block: BlockInstance }) {
  const id = block.anchor
  switch (block.type) {
    case "hero.home":
      return <HeroSection content={await withMedia(block.data)} />
    case "hero.page": {
      const [content, copy] = await Promise.all([withMedia(block.data), q.getSetting("microcopy")])
      return <PageHero content={content} homeLabel={copy.breadcrumbHome} />
    }
    case "credibility":
      return <CredibilitySection id={id} content={block.data} />
    case "about.intro":
      return <AboutSection id={id} content={block.data} />
    case "process": {
      const steps = (await q.getProcessSteps()).slice(0, 6)
      return <HowItWorksSection id={id} content={block.data} steps={steps} />
    }
    case "testimonials": {
      const items = select(await q.getTestimonials(), block.data.selection)
      return <TestimonialsSection id={id} content={block.data} items={items} />
    }
    case "band": {
      const band = await q.getCtaBand(block.data.bandId)
      return band ? <EnterpriseSection id={id} band={band} tint={block.data.tint} /> : null
    }
    case "insights.latest": {
      const all = await q.getArticleSummaries()
      const articles = select(all, block.data.selection).slice(0, block.data.count)
      return <InsightsSection id={id} content={block.data} articles={articles} />
    }
    case "faq": {
      const items = select(await q.getFaqs(), block.data.selection)
      return <FaqSection id={id} content={block.data} items={items} />
    }
    case "about.story": {
      const [content, site] = await Promise.all([withMedia(block.data), q.getSetting("site")])
      return <StorySection id={id} content={content} siteName={site.name} />
    }
    case "about.stats":
      return <StatsBand id={id} content={block.data} />
    case "about.approach":
      return <ApproachSection id={id} content={block.data} />
    case "about.credentials":
      return <CredentialsSection id={id} content={block.data} />
    case "services.grid":
      return <ServicesGrid id={id} content={block.data} services={await q.getServices()} />
    case "services.plans":
      return <FormatsSection id={id} content={block.data} plans={(await q.getPlans()).slice(0, 4)} />
    case "session.timeline":
      return <SessionTimeline id={id} content={block.data} />
    case "fit":
      return <FitSection id={id} content={block.data} />
    case "insights.browser": {
      const [all, categories, copy] = await Promise.all([q.getArticleSummaries(), q.getCategories(), q.getSetting("microcopy")])
      const featured = all.find((a) => a.featured)
      return (
        <InsightsBrowser
          id={id}
          content={block.data}
          articles={all.filter((a) => !a.featured)}
          categories={categories}
          copy={copy}
          featured={featured ? <FeaturedArticle article={featured} copy={copy} /> : null}
        />
      )
    }
    case "newsletter": {
      const global = await withMedia(await q.getSetting("newsletter"))
      const override = block.data.override
      const content = {
        ...global,
        eyebrow: override?.eyebrow || global.eyebrow,
        title: override?.title || global.title,
        subtitle: override?.subtitle || global.subtitle,
      }
      return <NewsletterBand id={id} content={content} />
    }
    case "contact.details": {
      const [contact, copy, form, services, plans] = await Promise.all([
        q.getSetting("contact").then(withMedia),
        q.getSetting("microcopy"),
        q.getSetting("contactForm"),
        q.getServices(),
        q.getPlans(),
      ])
      const option = (label: string) => ({ slug: slugify(label), label })
      return (
        <ContactSection
          id={id}
          content={block.data}
          contact={contact}
          channels={copy.contactChannels}
          form={{
            copy: form,
            topics: [...services.map((s) => ({ slug: s.slug, label: s.title })), ...form.extraTopics.map(option)],
            formats: form.formats.map(option),
            plans: plans.map(({ slug, name, priceLabel, unit }) => ({ slug, name, priceLabel, unit })),
          }}
        />
      )
    }
    case "contact.clinic": {
      const [content, contact, copy] = await Promise.all([
        withMedia(block.data),
        q.getSetting("contact").then(withMedia),
        q.getSetting("microcopy"),
      ])
      return <ClinicSection id={id} content={content} contact={contact} directionsLabel={copy.directions} />
    }
    case "richtext":
      return <RichTextSection id={id} content={block.data} />
    default:
      return block satisfies never
  }
}
```

The `NewsletterBand` prop drops `confirmationEmail` by type (`NewsletterView`); pass `content` as built (extra keys are fine for an object literal assigned through a variable). `getSetting("contact")` is not generic over `withMedia`; if inference fails, `await` it first and call `withMedia(contact)` on the next line.

```tsx
// app/(site)/_cms/block-renderer.tsx
import { JourneyRail } from "@/components/journey-rail"
import { PageMotion } from "@/components/page-motion"
import { StackCard } from "@/components/stack-card"
import { groupCards, pageChapters } from "@/lib/content/page-layout"
import type { PublishedPage } from "@/lib/content/types"

import { ResolvedBlock } from "./resolve-block"

// Cards, rail and motion for one page (docs/brief.md §5.7). `key` remounts the
// page root when two CMS paths share the [...slug] segment, so the rail and
// PageMotion rebuild for the new page instead of keeping the old chapters.
export function BlockRenderer({ page, contactLabel }: { page: PublishedPage; contactLabel: string }) {
  const { blocks } = page.document
  const cards = groupCards(blocks)
  return (
    <main key={page.path} data-page-root className="bg-ink">
      {cards.map((card, i) => (
        <StackCard key={card[0].id} id={i === 0 ? "home" : undefined} rounded={i !== 0} last={i === cards.length - 1}>
          {card.map((block) => (
            <ResolvedBlock key={block.id} block={block} />
          ))}
        </StackCard>
      ))}
      <JourneyRail chapters={pageChapters(blocks, page.settings.showContactChapter ? contactLabel : null)} />
      <PageMotion />
    </main>
  )
}
```

```tsx
// app/(site)/_cms/cms-page.tsx
import type { Metadata } from "next"
import { io } from "next/cache"
import { notFound } from "next/navigation"

import { getPublishedPage, getSetting } from "@/server/modules/content/queries"

import { BlockRenderer } from "./block-renderer"

// Inside the layout's Suspense (SiteFrame). io() keeps the read out of the
// build; the redirect lookup arrives with Phase 7.
export async function CmsPage({ path }: { path: string }) {
  await io()
  const [page, copy] = await Promise.all([getPublishedPage(path), getSetting("microcopy")])
  if (!page) notFound()
  return <BlockRenderer page={page} contactLabel={copy.contactChapter} />
}

// Metadata blocks for every agent (htmlLimitedBots), so a notFound() here
// runs before the body streams and the response is a real 404.
export async function cmsMetadata(path: string): Promise<Metadata> {
  await io()
  const page = await getPublishedPage(path)
  if (!page) notFound()
  const description = page.seo.description ?? undefined
  // The home page keeps the site's default title (root layout).
  return page.systemKey === "home" ? { description } : { title: page.seo.title ?? page.title, description }
}
```

- [ ] **Step 4: Routes**

```tsx
// app/(site)/[...slug]/page.tsx
import { CmsPage, cmsMetadata } from "../_cms/cms-page"

// Every page that is not home, the insights index or an article: system
// pages, legal and custom pages. No generateStaticParams: paths come from the
// database at request time (docs/brief.md §5.6 rule 6).
const toPath = (slug: string[]) => `/${slug.join("/")}`

export async function generateMetadata({ params }: PageProps<"/[...slug]">) {
  const { slug } = await params
  return cmsMetadata(toPath(slug))
}

export default async function Page({ params }: PageProps<"/[...slug]">) {
  const { slug } = await params
  return <CmsPage path={toPath(slug)} />
}
```

`app/(site)/page.tsx`:

```tsx
import { CmsPage, cmsMetadata } from "./_cms/cms-page"

export const generateMetadata = () => cmsMetadata("/")

export default function Page() {
  return <CmsPage path="/" />
}
```

`app/(site)/insights/page.tsx`: the same with `"/insights"`.

`app/(site)/not-found.tsx` (renders inside the site layout, so the chrome comes from `SiteFrame`):

```tsx
import Link from "next/link"

import { Container } from "@/components/layout/container"

export default function NotFound() {
  return (
    <main data-page-root>
      <Container className="py-32 text-center">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="mt-4">This page does not exist.</p>
        <Link href="/" className="mt-8 inline-block underline">
          Back to home
        </Link>
      </Container>
    </main>
  )
}
```

`app/(site)/insights/[slug]/page.tsx` (fixed template, brief §6.2):

```tsx
import type { Metadata } from "next"
import { io } from "next/cache"
import { notFound } from "next/navigation"

import { JourneyRail } from "@/components/journey-rail"
import { PageMotion } from "@/components/page-motion"
import { StackCard } from "@/components/stack-card"
import { ArticleBody, ArticleHero, NewsletterBand, RelatedArticles } from "@/features/insights"
import { contactHref } from "@/lib/contact-href"
import { resolveMedia, collectMediaIds } from "@/blocks/media-refs"
import { getArticle, getMedia, getRelatedArticles, getSetting } from "@/server/modules/content/queries"

// No generateStaticParams: articles render on request from cached data, and
// unknown slugs 404 from generateMetadata (docs/brief.md §5.6 rule 6).
export async function generateMetadata({ params }: PageProps<"/insights/[slug]">): Promise<Metadata> {
  await io()
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) notFound()
  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      publishedTime: article.date.iso,
      authors: [article.author.name],
      images: [article.image.src],
    },
  }
}

export default async function ArticlePage({ params }: PageProps<"/insights/[slug]">) {
  await io()
  const { slug } = await params
  const [article, related, copy, newsletter] = await Promise.all([
    getArticle(slug),
    getRelatedArticles(slug, 3),
    getSetting("microcopy"),
    getSetting("newsletter"),
  ])
  if (!article) notFound()
  const band = resolveMedia(newsletter, await getMedia(collectMediaIds(newsletter)))
  const chapters = [
    { label: copy.articleChapters.welcome, target: "home" },
    { label: copy.articleChapters.article, target: "article" },
    { label: copy.articleChapters.keepReading, target: "keep-reading" },
    { label: copy.articleChapters.newsletter, target: "newsletter" },
    { label: copy.contactChapter, target: "contact" },
  ]
  return (
    <main key={slug} data-page-root className="bg-ink">
      <StackCard id="home" rounded={false}>
        <ArticleHero article={article} copy={copy} />
      </StackCard>
      <StackCard id="article">
        <ArticleBody article={article} copy={copy} ctaHref={contactHref({ plan: "discovery-call", topic: article.topicSlug })} />
      </StackCard>
      <StackCard>
        <RelatedArticles articles={related} copy={copy} />
      </StackCard>
      <StackCard last>
        <NewsletterBand id="newsletter" content={band} />
      </StackCard>
      <JourneyRail chapters={chapters} />
      <PageMotion />
    </main>
  )
}
```

Delete `app/(site)/{about,services,how-it-works,contact}/` and `app/(site)/_legacy/`. Delete the barrel re-exports of fixture helpers that are now unused (`ALL_ARTICLES`, `getArticle`, `getArticleBody`, `readTime`/`readMinutes`, `relatedArticles`, `INSIGHTS_HERO` … from `features/insights/index.ts`).

- [ ] **Step 5: Pin the build gate, 404s and Activity**

```ts
// app/(site)/io-gate.test.ts
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { describe, expect, it } from "vitest"

// Review Focus 1: a database read in the public site must follow `await
// io()`, or `next build` (which has no database in CI) runs it.
describe("public-site database reads", () => {
  it("every file that calls a cached query awaits io() first", async () => {
    const dir = path.join(import.meta.dirname)
    const files = (await readdir(dir, { recursive: true })).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"))
    const offenders: string[] = []
    for (const file of files) {
      const source = await readFile(path.join(dir, file), "utf8")
      if (!source.includes("@/server/modules/content/queries")) continue
      if (file.endsWith("resolve-block.tsx")) continue // only rendered under CmsPage, which awaits io()
      const reads = source.match(/export (default )?async function \w*[\s\S]*?\n}/g) ?? []
      for (const fn of reads) {
        if (/\bget[A-Z]\w*\(/.test(fn) && !/await io\(\)/.test(fn)) offenders.push(`${file}: ${fn.split("(")[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
```

```ts
// tests/e2e/navigation/cms.spec.ts
import { expect, test } from "@playwright/test"

// Review Focus 4: missing and unpublished paths are real 404s, rendered with
// the site chrome.
for (const path of ["/no-such-page", "/insights/nope", "/privacy", "/about/extra"]) {
  test(`${path} answers 404`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status()).toBe(404)
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Main" })).toBeAttached()
  })
}

test("published CMS pages answer 200", async ({ request }) => {
  for (const path of ["/", "/about", "/services", "/how-it-works", "/insights", "/contact", "/insights/calm-is-a-skill"]) {
    expect((await request.get(path)).status(), path).toBe(200)
  }
})
```

Add to `tests/e2e/navigation/activity.spec.ts` (Review Focus 3; desktop project, reusing its `mainNav`/`openRail` helpers):

```ts
test("the rail follows a client navigation between two CMS pages", async ({ page }) => {
  await page.goto("/about")
  await mainNav(page).getByRole("link", { name: "Services" }).click()
  await expect(page).toHaveURL(/\/services$/)
  const rail = await openRail(page)
  await expect(rail.getByRole("button", { name: "Formats" })).toBeVisible()
  await expect(rail.getByRole("button", { name: "Story" })).toHaveCount(0)
})

test("a shared #faq resolves inside the visible CMS page", async ({ page }) => {
  await page.goto("/services")
  await mainNav(page).getByRole("link", { name: "How It Works" }).click()
  await expect(page).toHaveURL(/\/how-it-works$/)
  const rail = await openRail(page)
  await rail.getByRole("button", { name: "FAQ" }).click()
  await expect(page.locator("#faq:visible")).toBeInViewport()
})
```

If a 404 test sees status 200, the not-found ran after streaming began: check that the route's `generateMetadata` calls `cmsMetadata`/`notFound()` and that `htmlLimitedBots: /.*/` is set. Do not weaken the assertion; report it to the controller if it persists (the fallback is a proxy-level check, which needs a ruling because `proxy.ts` must not touch the database).

- [ ] **Step 6: Verify**

```bash
pnpm vitest run --project unit
pnpm test:integration
pnpm lint && pnpm typecheck && pnpm build
DATABASE_URL=postgres://nobody:nothing@127.0.0.1:1/unreachable SITE_URL=https://example.com pnpm build
pnpm exec playwright test tests/e2e/navigation --project=desktop
pnpm exec playwright test tests/e2e/navigation/cms.spec.ts
pnpm test:parity
pnpm exec prettier --check 'app/(site)' app/global-not-found.tsx lib/content features/richtext tests/e2e
```

Expected: everything PASS; parity 21/21 now rendered entirely from PostgreSQL; the unreachable-DB build passes. By eye on `pnpm build && pnpm start`: every page's rail, stack cards, count-ups, the steps pin, the insights filters and the contact prefill behave as before.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(site): render every public page from the database

BlockRenderer groups blocks into StackCards and derives the JourneyRail;
CmsPage serves system and custom pages through [...slug]; the article
template reads articles from PostgreSQL. Unknown and unpublished paths
return 404 from blocking metadata.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10: Move the fixtures, guard against content literals, verify the phase

**Files:**
- Move: `features/*/data/*.ts` and `features/site/data/*.ts` → `server/db/seed/fixtures/` (`git mv`, one file per fixture)
- Modify: imports in `server/db/seed/**`, `tests/content/page-layout.test.ts`, `tests/integration/seed/seed.test.ts`
- Delete: `features/*/data/` directories, `fromPath` in `lib/media.ts`, the fixture helper functions no seed file uses
- Create: `tests/lint/content-literals.test.ts`, `tests/e2e/perf/ttfb.spec.ts`
- Modify: `.github/workflows/ci.yml` (`--grep-invert` adds `perf:`)

**Interfaces:**
- Consumes: everything. Produces: no new code interfaces; fixtures live at `@/server/db/seed/fixtures/<file>`.

- [ ] **Step 1: Write the failing literal check**

```ts
// tests/lint/content-literals.test.ts
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { siteSources } from "../css/site-sources"

const root = path.join(import.meta.dirname, "../..")
const FIXTURES = path.join(root, "server/db/seed/fixtures")

// Every string a fixture holds, however deep.
function strings(value: unknown, out: Set<string>) {
  if (typeof value === "string") out.add(value.trim())
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out))
  else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out))
}

describe("content literals", () => {
  it("no site component contains a fixture's copy (docs/plan.md Phase 3 acceptance)", async () => {
    const copy = new Set<string>()
    for (const file of await readdir(FIXTURES)) {
      strings(await import(path.join(FIXTURES, file)), copy)
    }
    // Paths, slugs and tiny labels ("Email") are not distinctive copy.
    const needles = [...copy].filter((s) => s.length >= 12 && !s.startsWith("/") && !s.startsWith("#"))
    expect(needles.length).toBeGreaterThan(100)
    const offenders: string[] = []
    for (const file of (await siteSources()).filter((f) => !f.startsWith("app/"))) {
      const source = await readFile(path.join(root, file), "utf8")
      for (const needle of needles) if (source.includes(needle)) offenders.push(`${file}: "${needle}"`)
    }
    expect(offenders).toEqual([])
  })
})
```

Run: `pnpm vitest run --project unit tests/lint/content-literals.test.ts` → FAIL (`server/db/seed/fixtures` does not exist yet).

- [ ] **Step 2: Move the fixtures**

```bash
mkdir -p server/db/seed/fixtures
for f in features/*/data/*.ts; do git mv "$f" "server/db/seed/fixtures/$(basename "$f")"; done
rmdir features/*/data
grep -rl '@/features/[a-z-]*/data/' server tests lib app features | xargs sed -i '' -E 's#@/features/[a-z-]+/data/#@/server/db/seed/fixtures/#g'
grep -rln '\.\./data/\|\./\(articles\|article-bodies\|session\|steps\|contact-content\|services-content\|nav-links\)"' server/db/seed/fixtures
```

Fix the relative imports between fixtures the last `grep` lists (e.g. `articles.ts` → `./article-bodies`, `footer-links.ts` → `./nav-links`, `contact-content.ts` no longer imports services). File names stay unique (no two fixtures share a basename; check with `ls server/db/seed/fixtures | sort | uniq -d`, expected empty).

Then delete what no seed file uses: in `articles.ts` the helpers `getArticle`, `getArticleBody`, `readTime`, `relatedArticles`; `fromPath` in `lib/media.ts`. `grep -rnE 'fromPath|readTime\(|relatedArticles' app components features lib server` must print nothing.

Fixtures keep `import "server-only"`? No: they are pure data loaded by the seed (Node) and by the literal test; ruling F6 exempts pure modules.

Run the literal test → PASS. If it lists offenders, move each string out of the component (pattern rule 5) rather than shortening the needle filter.

- [ ] **Step 3: TTFB check (local only)**

```ts
// tests/e2e/perf/ttfb.spec.ts
import { expect, test } from "@playwright/test"

import { PARITY_ROUTES } from "../parity/routes"

// docs/plan.md Phase 3: warm-cache TTFB under 200 ms locally. Titled "perf:"
// so CI (shared runners) skips it.
test.describe.configure({ mode: "serial" })

test("perf: warm-cache TTFB stays under 200 ms", async ({ request }) => {
  for (const { path } of PARITY_ROUTES) await request.get(path)
  for (const { path } of PARITY_ROUTES) {
    const started = performance.now()
    const response = await request.get(path)
    const elapsed = performance.now() - started
    expect(response.status(), path).toBe(200)
    expect(elapsed, path).toBeLessThan(200)
  }
})
```

In `.github/workflows/ci.yml` change the E2E `--grep-invert` to `"parity:|visual:|lighthouse:|perf:"` and its step name to mention perf.

- [ ] **Step 4: Full verification**

```bash
pnpm lint && pnpm typecheck
pnpm test:unit && pnpm test:integration
pnpm build
DATABASE_URL=postgres://nobody:nothing@127.0.0.1:1/unreachable SITE_URL=https://example.com pnpm build
pnpm db:seed && pnpm db:seed
pnpm test:e2e --project=desktop --project=admin-desktop --grep-invert "parity:|visual:|lighthouse:"
pnpm exec playwright test tests/e2e/navigation tests/e2e/perf --project=desktop
pnpm test:parity
pnpm exec prettier --check $(git diff --name-only 4bf000b -- '*.ts' '*.tsx' '*.mjs' '*.css' '*.yml')
ls features/*/data 2>/dev/null
```

Expected: everything PASS; parity 21/21; TTFB < 200 ms on every route; the last `ls` prints nothing.

- [ ] **Step 5: Motion QA checklist (human sign-off, record the result in the SDD ledger)**

On `pnpm build && pnpm start`, desktop (fine pointer) and a phone emulation:

1. Home hero intro plays, member count counts to `800+`, WebGL background moves.
2. Stack cards stick and sink on every page; no seam opens on a fast scroll up.
3. `/about` stats count up, `4.9/5` passes through decimals; the story badge counts to `10+`.
4. `/how-it-works` and `/` steps pin walks four cards at the old pace; on mobile the steps swipe.
5. JourneyRail: appears after the hero, highlights the current chapter, every chapter button scrolls to its section; "Contact" reaches the footer.
6. Navigate `/` → `/about` → `/services` → back: hero reveals replay, the rail lists the current page's chapters, `#faq` links land on the visible page.
7. `/insights`: filters, search and pagination animate the grid; back from an article restores the filter.
8. `/contact?topic=sleep-rest&plan=change-programme` pre-fills; the form validates and confirms.
9. Block scripts (DevTools request blocking: `/_next/static/chunks/*.js`): hero copy appears within 3 s.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(content): move fixtures into the seed and guard against literals

features/*/data now lives in server/db/seed/fixtures as seed input only.
A unit test fails if any fixture string appears in a site component; a
local perf check holds warm-cache TTFB under 200 ms.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Spec coverage

| Requirement (docs/plan.md Phase 3 / brief) | Task |
| --- | --- |
| 1. Media: `media` table, `static` driver, sharp metadata, `<MediaImage>` (blur, focal → `object-position`) | 6 (table), 7 (probe, registration), 4 (`MediaImage`) |
| 2. Block registry: `defineBlock`, `BlockInstance`, 22 schemas with limits, fixture validation | 3; fixture validation in 7 (`seed.test.ts`) |
| 3. Collections tables/repos/cached queries; articles with draft JSONB, generated `tsvector` + GIN; `server/lib/cache.ts` | 6 |
| 4. `pages`, `revisions`; `getPublishedPage(path)`; routes map; global schemas and seeds; `getSetting` with draft mode | 6 (tables, queries; the `routes` tag is the routes map until Phase 7's sitemap), 3 (globals), 7 (seeds) |
| 5. Idempotent seed: fixtures moved, media registered, TipTap conversion (lead, bold rule), 6 system + 3 flagged legal pages, globals | 5 (TipTap), 7, 10 (move) |
| 6. `SiteFrame` (Suspense + `io()`, theme `<style>`, chrome); root `generateMetadata`; `htmlLimitedBots`, `cacheMaxMemorySize` | 8 |
| 7. Props-driven sections, no `features/*/data` imports, client props (contact params, summaries only, `StepsStory count`), keys from ids | 4, 5, 10 |
| 8. `BlockRenderer` (StackCard grouping, derived chapters, `data-page-root`, `PageMotion`), `CmsPage`, `[...slug]`, home/insights entries, article from DB, `notFound()` | 9 |
| 9. Robustness: StepsStory from count, CSS dividers, auto testimonial columns, unequal fit lists, count-up decimals/prefix/suffix, failsafe reveal | 2 |
| 10. Tokenise: semantic tokens, icon registry with `currentColor`, numeric tints, `#315d44` token, trimmed preloads | 1 |
| 11. Verification: parity 21/21, no-DB build, navigation E2E, TTFB < 200 ms, delete `features/*/data` | every public task; 9, 10 |
| Acceptance: no content literals in `features/**/components` (CI check) | 10 (`content-literals.test.ts`, runs in `pnpm test:unit`) |
| Acceptance: `pnpm db:seed` twice → identical row counts | 7 |
| Acceptance: build passes with no database | 6, 8, 9, 10 + CI job |
| Acceptance: motion QA checklist signed off | 10 Step 5 |
| Brief §5.6 cache tag catalogue | 6 (`tags`) |
| Brief §5.7 rules 1–2 (per-page controller, scoped queries) | done in Phase 0; kept by 9 (`key` on `<main>`, Activity tests) |
| Brief §6.5 draft/publish (data model only; editing is Phase 4) | 6 (`draft`/`published`, draft mode in queries) |

## Self-check notes (already applied above)

- APIs checked against the installed packages: `io`, `cacheTag`, `cacheLife(profile | { stale, revalidate, expire })` from `next/cache` (16.3.8 `cache.d.ts`); `revalidateTag(tag, { expire: 0 })`; `draftMode()` is allowed inside `'use cache'`; `notFound()` inside Suspense streams a 200, which is why the 404 comes from `generateMetadata` under `htmlLimitedBots: /.*/` (that setting bypasses the PPR shell, `app-page-runtime.js` `shouldForceDynamicPPRRender`); an empty `generateStaticParams` is a build error, so `[slug]` routes have none. nuqs 2.10's serializer orders keys by the parser object, which `contactHref` relies on.
- Repo files reused as they are: `getDb`/`closeDb`/`type Db` (`server/db/client.ts`), `resetDb` (`tests/integration/helpers/db.ts`), `users` (`server/db/schema/auth.ts`), `settings`, `PageProps<…>` (typegen), `slugify` (`lib/utils.ts`), `findTarget`-based `JourneyRail` and pathname-keyed `PageMotion`, `tests/e2e/parity/routes.ts`, the Playwright `desktop`/`tablet`/`mobile` projects, the CI unreachable-DB build step.
- Zod 4: nested defaults use `.prefault({})`; `z.partialRecord`, `z.iso.datetime()`, `z.uuid()`, `z.email()` exist in 4.6. Drizzle 0.45: `customType`, `.generatedAlwaysAs(() => sql…)`, `index().using("gin", …)`, `getTableColumns`, `text({ enum })`, `$onUpdate`, `onConflictDoNothing()`.

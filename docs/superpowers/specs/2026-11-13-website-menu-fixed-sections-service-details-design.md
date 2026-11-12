# Website menu, fixed sections and service detail pages

Date: 2026-11-13 · Status: draft for approval

## Why

The admin feels confusing and complex. Editing one public page means visiting
several menus (Pages, Collections, Site settings), and the page builder lets an
editor add, delete, hide and reorder blocks, which can break a page the
designer composed. The owner wants the admin to read like the site: one
**Website** menu with an entry per public page, where everything that page shows
is edited in one place, sections fixed by design, all copy dynamic. VANTAGE
(`~/ireland/VANTAGE/src/lib/admin/nav.ts`) is the model for the menu.

Separately, services have no designed detail page. Each service should get a
themed details page at `/services/<slug>`, created, edited and deleted from the
admin.

## Goals

1. **Website menu.** One sidebar group entry "Website" whose children are the
   public pages. Everything a page renders is edited from that page's screen.
2. **Fixed sections everywhere.** No editor can add, delete, hide or reorder
   sections on any page. They edit the content of each section only.
3. **Service detail pages.** A fixed, themed template per service, edited from
   Website → Services, with add / edit / delete.

## Non-goals

- No new public pages besides service detail pages.
- No visual redesign of existing pages.
- No change to roles/permissions semantics (existing `page` / `collection`
  permissions keep gating the same things).
- No Lottie player (separate request).

## Anti-goals (a failure even if it works)

- An editor can still change a page's structure through any path (API, history
  restore, duplicate, AI assistant tool).
- Shared content (a FAQ, testimonial, plan) edited on one page silently
  diverges from the same item on another page.
- A service detail page that looks like a different site: it must use the
  existing theme tokens, fonts, `Container` (66 px gutter, see memory
  "sections use shared container") and existing section patterns.

## Part 1: Website menu (owner decided)

Sidebar after the change:

- **Dashboard**
- **Website**:
  - Home, About, Services, How it works, Contact
  - Insights (Articles, Categories, Authors stay as today, nested here)
  - Legal pages (Privacy, Terms, Disclaimer)
  - Header & footer (today's Settings → Navigation and Footer)
- **Media**, **Enquiries**, **Newsletter**: unchanged
- Growth: **SEO**, **Marketing**: unchanged
- **Settings**: Identity, Contact & clinic, Forms & microcopy, Notifications,
  Privacy, AI assistant, Appearance (Appearance moves under Settings)
- **Users & roles**, **Activity log**: unchanged

The top-level **Pages** and **Collections** entries disappear. The registry in
`lib/admin/nav.ts` stays the single source for the sidebar, command palette and
page guard, so the guard and palette follow automatically.

Each page entry opens that page's editor (today's `/admin/pages/[id]` builder,
minus structure controls). Old URLs (`/admin/pages`, `/admin/collections/*`)
redirect to the matching Website entry so bookmarks and links in emails keep
working.

**Shared collection items are edited inside the page (owner decided).** A
section that shows collection items (testimonials, FAQs, steps, plans, CTA
bands, services) lets the editor edit, add and remove those items right in the
section's form. Items stay rows in their collection, so editing a FAQ on the
Home page changes it everywhere that FAQ appears. The form says so next to a
shared item ("Also shown on: Contact"). There is no separate central place for
collections.

## Part 2: Fixed sections (owner decided)

- The page editor loses: **Add block**, the block **delete** button, the
  **hide** (eye) toggle and **drag to reorder**. The block list stays as a
  read-only outline for navigation; selecting a block opens its content form.
- The **New page** button and page delete go away for normal pages. The only
  pages an editor can create or delete are service detail pages (Part 3).
- Enforcement is on the server, not only in the UI: saving a page whose block
  list differs from its stored structure (types, anchors, order, hidden flags,
  count) is refused. This covers the page API, history/revision restore, and
  any AI assistant tool that writes pages.
- A page's structure is whatever it has today at deploy time (system pages from
  `server/db/seed/pages.ts`, legal pages, and any custom pages already
  created). Blocks that are hidden today stay hidden and are simply not shown
  in the editor outline.
- Developers still change structure through code (seed + migration), as with
  any design change.

## Part 3: Service detail pages

**Where it is edited (owner decided).** Website → Services shows the services
page's own sections (as today), and the list of services. Each service has a
"Details page" switch. Turning it on creates the service's detail page from the
fixed template; turning it off deletes that page (with confirmation). Deleting
a service also deletes its detail page. Opening a service's details page goes
to the same fixed-section editor as every other page.

**URL.** `/services/<slug>`, using the service's slug. The existing
`/services/[slug]` route and `pagePath` link on services stay in use: the
services grid's "Learn more" goes to the detail page when it exists. The
`pagePath` field is set automatically, no longer typed by hand.

**Sections (owner agreed to this list), in order:**

1. **Hero**: title, intro line, image, "Book a discovery call" button
2. **What it is & who it's for**: rich text plus a short "this is for you if"
   list
3. **Benefits**: a list of benefits (icon from the code icon registry, title,
   one-line text)
4. **How sessions work**: steps
5. **Formats & investment**: plans
6. **FAQ**: questions and answers
7. **Call-to-action band**

All copy and images are editable. Every service page shares this structure;
only content differs.

**Each service's content is its own (owner decided).** The hypnotherapy page
has hypnotherapy FAQs, steps and plans; the coaching page has coaching ones.
They are written on that service's page and are not shared with other pages,
so the "Also shown on" rule (Part 1) does not apply to them. Deleting the
service (or switching its details page off) deletes them with the page.

*My call:* store these lists inline in the service page's blocks (like the
`journey` block's inline steps), not as rows in the global `faqs` / `steps` /
`plans` collections. Per-service content then needs no cross-page bookkeeping,
copies and restores with the page's revisions, and the global collections keep
serving the shared pages. Sections 4–7 use the same visual components as the
existing `journey`, `services.plans`, `faq` and `band` sections, fed from
inline data. The hero image lives in the page's hero block only; the service
card in the grid keeps its icon. SEO tab (title, description, share image) works as for
other pages, and the existing sitemap / `llms.txt` / JSON-LD handling of
`/services/<slug>` pages keeps applying.

**Look.** Same theme as the rest of the site: tokens, fonts, `Container`,
section spacing, the page hero pattern used by About / How it works, and the
journey rail chapters. New sections (2 and 3) are designed to match existing
ones, not invented in a new style.

## Decisions made during review (my calls, check while reading)

- **Structure lock** compares each block's type, anchor, order and hidden flag,
  and the block count. Block ids are not locked. Restoring a revision whose
  structure differs from the page's current structure is refused with a plain
  message ("This version has a different layout and can't be restored").
- **Existing custom pages** (editor-made pages outside `/services/`) appear
  under Website → "Other pages" with the same content-only editor. They can
  still be deleted, since removing a whole page is not a layout change; no new
  ones can be created.
- **Existing `/services/<slug>` pages and hand-typed `pagePath` values** are
  left as they are: a service already linked to a page keeps that link, and its
  switch shows "on". Those pages keep their current blocks (locked like every
  page). Only pages created through the switch use the new template.
- **Slug change** moves the details page to the new `/services/<slug>` and adds
  a redirect from the old path. **A hidden service** (`isVisible` off) makes
  its details page 404 and drops it from the sitemap, `llms.txt` and JSON-LD.
- **Permissions:** editing shared collection items from a page screen needs
  both `page` and `collection` edit permission; with only `page` the items are
  shown read-only. Service detail pages need `page` permission to edit and
  `collection` permission to create or delete (it is tied to the service).
- **AI assistant:** its page-writing tool is told each page's fixed sections
  and edits content only; a structural change is refused with a clear error.

## Constraints

- Next.js in this repo has breaking changes: read
  `node_modules/next/dist/docs/` before writing route code (AGENTS.md).
- Cache Components: public pages render from tag-cached data; new data must be
  tagged and invalidated like existing content.
- Migrations must not break existing published pages or their revisions.
- All admin copy goes through microcopy where the rest of the admin does.

## Left to the builder

- Data model for service detail pages (a `pages` row per service with a
  template key is the obvious fit, since the route, SEO, preview, autosave and
  revisions already work for pages; a builder may choose otherwise with reason).
- How structure is stored and compared for enforcement.
- Exact field lists of the two new sections, within the descriptions above.
- Redirect mechanics for old admin URLs.
- How "Also shown on" is computed.
- Splitting into implementation phases (suggested order: menu, fixed sections,
  service details).

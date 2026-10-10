// server/modules/ai/tools.ts
import "server-only"

import { tool, type ToolSet } from "ai"
import * as z from "zod"

import { hasPermission } from "@/lib/auth/permissions"
import type { Actor } from "@/server/auth/actor"

import { errorTag, ToolFailure } from "./errors"
import type { AiStored } from "./settings"
import {
  dashboardSummary,
  ENQUIRY_RANGES,
  enquiryStats,
  readArticle,
  readPage,
  searchContent,
  seoHealth,
  type ToolResult,
} from "./tool-data"

// A failing lookup reaches the model and the sheet as one generic message;
// the server log keeps the tool name and error class/code, never the text.
function guard<I>(
  name: string,
  run: (input: I) => Promise<ToolResult>
): (input: I) => Promise<ToolResult> {
  return async (input) => {
    try {
      return await run(input)
    } catch (error) {
      console.error(`[ai] tool ${name} failed`, errorTag(error))
      throw new ToolFailure(name)
    }
  }
}

// Spec §5: read-only, run with the requesting person's actor, and only the
// tools their role could use are offered at all.
export function buildTools({
  actor,
  settings,
}: {
  actor: Actor
  settings: AiStored
}): ToolSet {
  const can = (p: Parameters<typeof hasPermission>[1]) =>
    hasPermission(actor.roles, p)
  const tools: ToolSet = {}
  if (can({ page: ["read"] }) || can({ article: ["read"] }))
    tools.searchContent = tool({
      description:
        "Search the site's pages and articles (drafts included) by words in the title or path. Returns titles, paths, status and ids.",
      inputSchema: z.object({ query: z.string().trim().min(2).max(100) }),
      execute: guard("searchContent", ({ query }) =>
        searchContent(actor, query)
      ),
    })
  if (can({ page: ["read"] }))
    tools.getPage = tool({
      description:
        "Read one page by its id or path (for example /about): title, SEO fields and its text (up to 8 000 characters).",
      inputSchema: z.object({ idOrPath: z.string().trim().min(1).max(200) }),
      execute: guard("getPage", ({ idOrPath }) => readPage(actor, idOrPath)),
    })
  if (can({ article: ["read"] }))
    tools.getArticle = tool({
      description:
        "Read one Insights article by id or slug: title, excerpt, status, SEO fields and body text (up to 8 000 characters).",
      inputSchema: z.object({ idOrSlug: z.string().trim().min(1).max(200) }),
      execute: guard("getArticle", ({ idOrSlug }) =>
        readArticle(actor, idOrSlug)
      ),
    })
  if (can({ seo: ["read"] }))
    tools.getSeoHealth = tool({
      description:
        "Get the site's SEO health score and the list of SEO issues by page.",
      inputSchema: z.object({}),
      execute: guard("getSeoHealth", () => seoHealth(actor)),
    })
  tools.getDashboardSummary = tool({
    description:
      "Get the dashboard's key numbers for this person's role: enquiries, articles, subscribers, SEO and content health.",
    inputSchema: z.object({}),
    execute: guard("getDashboardSummary", () => dashboardSummary(actor)),
  })
  tools.getEnquiryStats = tool({
    description:
      "Count enquiries by status, topic and week for a period. Personal details are never included unless the owner allowed it.",
    inputSchema: z.object({
      range: z
        .enum(
          Object.keys(ENQUIRY_RANGES) as [
            keyof typeof ENQUIRY_RANGES,
            ...(keyof typeof ENQUIRY_RANGES)[],
          ]
        )
        .default("30d"),
    }),
    execute: guard("getEnquiryStats", ({ range }) =>
      enquiryStats(actor, settings, range)
    ),
  })
  return tools
}

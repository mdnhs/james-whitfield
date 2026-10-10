// lib/ai/labels.ts
// "Looked at: …" fallbacks when a tool result carries no label (isomorphic).
export const TOOL_LABELS = {
  searchContent: "a search of pages and articles",
  getPage: "a page",
  getArticle: "an article",
  getSeoHealth: "SEO health",
  getDashboardSummary: "the dashboard",
  getEnquiryStats: "enquiry numbers",
} as const
export type ToolName = keyof typeof TOOL_LABELS

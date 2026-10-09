export { cn } from "cn"

// URL-friendly form of a label: "Anxiety & Stress" → "anxiety-stress".
export const slugify = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

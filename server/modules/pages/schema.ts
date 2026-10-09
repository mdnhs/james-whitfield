import "server-only"

import * as z from "zod"

import { DraftDocument } from "@/blocks/page"

export { NewPageInput as CreatePageInput } from "@/lib/content/page-path"
export { PageMetaPatch } from "@/blocks/page"

export const PageIdParam = z.object({ id: z.uuid() })
export const RevisionParam = z.object({ id: z.uuid(), rev: z.uuid() })
export const VersionInput = z.object({ version: z.number().int().min(1) })
export const DraftInput = VersionInput.extend({ document: DraftDocument })

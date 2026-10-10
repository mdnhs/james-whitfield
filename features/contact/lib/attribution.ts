import type * as z from "zod"
import { Attribution } from "@/lib/leads/schema"
import { ATTRIBUTION_KEY as KEY } from "./capture-attribution"

export { captureAttribution } from "./capture-attribution"

type AttributionValue = z.infer<typeof Attribution>
const EMPTY = (): AttributionValue => Attribution.parse({})

export function readAttribution(storage: Storage): AttributionValue {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return EMPTY()
    const parsed = Attribution.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : EMPTY()
  } catch {
    return EMPTY()
  }
}

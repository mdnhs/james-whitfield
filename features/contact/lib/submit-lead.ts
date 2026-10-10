import type { LeadSubmission } from "@/lib/leads/schema"

export type SubmitResult =
  | { ok: true }
  | { ok: false; kind: "fields"; fieldErrors: Record<string, string[]> }
  | { ok: false; kind: "rate-limited" }
  | { ok: false; kind: "error" }

export async function fetchStamp(): Promise<string> {
  try {
    const res = await fetch("/api/v1/public/leads/stamp", { cache: "no-store" })
    return res.ok ? ((await res.json()) as { stamp: string }).stamp : ""
  } catch {
    return ""
  }
}

export async function submitLead(
  payload: LeadSubmission
): Promise<SubmitResult> {
  try {
    const res = await fetch("/api/v1/public/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (res.status === 201) return { ok: true }
    if (res.status === 429) return { ok: false, kind: "rate-limited" }
    const body = (await res.json().catch(() => ({}))) as {
      error?: { fieldErrors?: Record<string, string[]> }
    }
    if (res.status === 400 && body.error?.fieldErrors)
      return { ok: false, kind: "fields", fieldErrors: body.error.fieldErrors }
    return { ok: false, kind: "error" }
  } catch {
    return { ok: false, kind: "error" }
  }
}

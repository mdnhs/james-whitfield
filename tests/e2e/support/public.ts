import type { APIRequestContext } from "@playwright/test"

export async function publicStamp(request: APIRequestContext) {
  const res = await request.get("/api/v1/public/leads/stamp")
  return ((await res.json()) as { stamp: string }).stamp
}

export const postLead = (
  request: APIRequestContext,
  data: Record<string, unknown>,
  ip: string
) =>
  request.post("/api/v1/public/leads", {
    data,
    headers: { "x-real-ip": ip },
  })

// A distinct client per test so parallel workers never share a rate-limit
// bucket (Ruling R4). IPv6 documentation range: effectively collision-free.
const hex4 = () => Math.floor(Math.random() * 0xffff).toString(16)
export const testIp = () => `2001:db8::${hex4()}:${hex4()}`

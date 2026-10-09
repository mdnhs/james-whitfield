import type { RequestIdVariables } from "hono/request-id"

import type { Actor } from "@/server/auth/actor"

export type AppEnv = {
  Variables: RequestIdVariables & { actor: Actor | null }
}

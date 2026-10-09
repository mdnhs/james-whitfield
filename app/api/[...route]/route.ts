import { handle } from "@hono/vercel"

import { app } from "@/server/api/app"

// Every /api/* request is served by Hono (server/api); Next only hosts it.
const handler = handle(app)

export {
  handler as DELETE,
  handler as GET,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
}

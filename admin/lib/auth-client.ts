import { adminClient, twoFactorClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { ac, roles } from "@/lib/auth/permissions"

// Same origin, so cookies flow automatically and no base URL is needed.
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [adminClient({ ac, roles }), twoFactorClient()],
})

import type { RoleName } from "@/lib/auth/permissions"

// The authenticated user as the API and services see them.
export type Actor = {
  userId: string
  email: string
  name: string
  roles: RoleName[]
  twoFactorEnabled: boolean
  sessionId: string
  impersonatedBy: string | null
  ip: string | null
  userAgent: string | null
}

import { parseRoles, type RoleName } from "@/lib/auth/permissions"

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

// The fields we read from Better Auth's session (admin and two-factor
// plugins add role, twoFactorEnabled and impersonatedBy).
export type SessionLike = {
  user: {
    id: string
    email: string
    name: string
    role?: string | null
    twoFactorEnabled?: boolean | null
  }
  session: {
    id: string
    ipAddress?: string | null
    userAgent?: string | null
    impersonatedBy?: string | null
  }
}

export function toActor({ user, session }: SessionLike): Actor {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    roles: parseRoles(user.role),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    sessionId: session.id,
    impersonatedBy: session.impersonatedBy ?? null,
    ip: session.ipAddress ?? null,
    userAgent: session.userAgent ?? null,
  }
}

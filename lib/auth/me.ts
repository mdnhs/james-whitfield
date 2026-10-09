import { permissionMap, type Permissions, type RoleName } from "./permissions"

// The `GET /api/v1/admin/me` body (docs/brief.md §8.3). The panel layout
// builds the same object on the server and hands it to the client, so the
// shell never waits on a request to know who is signed in.
export type MePayload = {
  user: { id: string; email: string; name: string }
  roles: RoleName[]
  permissions: Permissions
  twoFactorEnabled: boolean
  impersonatedBy: string | null
}

export function toMePayload(actor: {
  userId: string
  email: string
  name: string
  roles: RoleName[]
  twoFactorEnabled: boolean
  impersonatedBy: string | null
}): MePayload {
  return {
    user: { id: actor.userId, email: actor.email, name: actor.name },
    roles: actor.roles,
    permissions: permissionMap(actor.roles),
    twoFactorEnabled: actor.twoFactorEnabled,
    impersonatedBy: actor.impersonatedBy,
  }
}

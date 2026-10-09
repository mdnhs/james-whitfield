import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"

// docs/brief.md §7.2. Isomorphic: the server authorises with it, and the
// admin client uses it for adminClient({ ac, roles }) and UI gating.
export const statement = {
  ...defaultStatements,
  dashboard: ["view"],
  page: ["read", "create", "update", "publish", "delete"],
  article: ["read", "create", "update", "publish", "delete"],
  collection: ["read", "create", "update", "delete"],
  globals: ["read", "update"],
  media: ["read", "upload", "update", "delete"],
  lead: ["read", "update", "export", "delete"],
  newsletter: ["read", "export", "delete"],
  seo: ["read", "update"],
  redirect: ["read", "manage"],
  tracking: ["read", "update"],
  code: ["update"],
  appearance: ["read", "update", "publish"],
  settings: ["read", "update"],
  audit: ["read"],
} as const

export const ac = createAccessControl(statement)

type Statement = typeof statement
export type Resource = keyof Statement
export type Permissions = { [R in Resource]?: Statement[R][number][] }

// Derived from the full statement so new resources cannot be missing from owner.
const owner = ac.newRole(
  Object.fromEntries(
    Object.entries(statement).map(([resource, actions]) => [
      resource,
      [...actions],
    ])
  ) as { [R in Resource]: Statement[R][number][] }
)

// Everything an owner has, except custom code and impersonating admins.
// Owner protection (no acting on owners) lives in the users service.
const admin = ac.newRole({
  ...owner.statements,
  user: [...adminAc.statements.user],
  session: [...adminAc.statements.session],
  code: [],
})

const editor = ac.newRole({
  dashboard: ["view"],
  page: ["read", "create", "update", "publish", "delete"],
  article: ["read", "create", "update", "publish", "delete"],
  collection: ["read", "create", "update", "delete"],
  globals: ["read", "update"],
  media: ["read", "upload", "update", "delete"],
  seo: ["read", "update"],
  redirect: ["read", "manage"],
})

// Articles and media are limited to the author's own records by the services.
const author = ac.newRole({
  dashboard: ["view"],
  page: ["read"],
  article: ["read", "create", "update", "delete"],
  collection: ["read"],
  media: ["read", "upload", "update"],
})

// SEO and ads people: no access to enquiries (health-adjacent data).
const marketer = ac.newRole({
  dashboard: ["view"],
  page: ["read"],
  article: ["read"],
  collection: ["read"],
  globals: ["read"],
  media: ["read", "upload", "update"],
  newsletter: ["read", "export"],
  seo: ["read", "update"],
  redirect: ["read", "manage"],
  tracking: ["read", "update"],
})

const intake = ac.newRole({
  dashboard: ["view"],
  lead: ["read", "update"],
})

const viewer = ac.newRole({
  dashboard: ["view"],
  page: ["read"],
  article: ["read"],
  collection: ["read"],
  globals: ["read"],
  seo: ["read"],
})

export const roles = { owner, admin, editor, author, marketer, intake, viewer }
export type RoleName = keyof typeof roles
export const ROLE_NAMES = Object.keys(roles) as RoleName[]

const isRoleName = (value: string): value is RoleName =>
  Object.hasOwn(roles, value)

// Better Auth stores several roles as one comma-separated string and splits
// it on "," without trimming; match that exactly so we never grant more.
export function parseRoles(value: string | null | undefined): RoleName[] {
  return (value ?? "").split(",").filter(isRoleName)
}

export function hasPermission(
  userRoles: readonly RoleName[],
  permissions: Permissions
): boolean {
  return userRoles.some((name) => roles[name].authorize(permissions).success)
}

export function permissionMap(userRoles: readonly RoleName[]): Permissions {
  const merged = new Map<string, Set<string>>()
  for (const name of userRoles) {
    for (const [resource, actions] of Object.entries(roles[name].statements)) {
      const set = merged.get(resource) ?? new Set<string>()
      for (const action of actions as readonly string[]) set.add(action)
      merged.set(resource, set)
    }
  }
  return Object.fromEntries(
    [...merged].map(([resource, set]) => [resource, [...set]])
  ) as Permissions
}

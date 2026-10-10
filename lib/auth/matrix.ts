import { ROLE_NAMES, roles, statement, type RoleName } from "./permissions"

export type Cell = "yes" | "no" | "own" | "not-owners"
export type MatrixRow = {
  resource: string
  action: string
  cells: Record<RoleName, Cell>
}

// Cells the services narrow further (docs/brief.md §7.2 "own" and "never on
// owners"); everything else is exactly what the role grants (Ruling R12).
const QUALIFIERS: Partial<Record<RoleName, Record<string, Cell>>> = {
  author: {
    "article.create": "own",
    "article.update": "own",
    "article.delete": "own",
    "media.update": "own",
  },
  admin: Object.fromEntries(
    [
      ...statement.user
        .filter((a) => a !== "impersonate-admins")
        .map((a) => `user.${a}`),
      ...statement.session.map((a) => `session.${a}`),
    ].map((key) => [key, "not-owners" as const])
  ),
}

export function permissionMatrix(): MatrixRow[] {
  return Object.entries(statement).flatMap(([resource, actions]) =>
    (actions as readonly string[]).map((action) => ({
      resource,
      action,
      cells: Object.fromEntries(
        ROLE_NAMES.map((name) => {
          const granted = (
            (
              roles[name].statements as Record<
                string,
                readonly string[] | undefined
              >
            )[resource] ?? []
          ).includes(action)
          const qualified = QUALIFIERS[name]?.[`${resource}.${action}`]
          return [name, granted ? (qualified ?? "yes") : "no"]
        })
      ) as Record<RoleName, Cell>,
    }))
  )
}

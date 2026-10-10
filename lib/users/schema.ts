import * as z from "zod"

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"

// Isomorphic: the Users screen validates with the same schemas the API uses.
const Role = z.enum(ROLE_NAMES as [RoleName, ...RoleName[]], {
  error: "Choose a role",
})

export const InviteInput = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter a valid email address" })),
  name: z.string().trim().min(1, "Enter a name").max(120),
  role: Role,
})
export type InviteInput = z.infer<typeof InviteInput>

// Several roles are stored as one comma-separated string (Better Auth's
// format); a fixed order keeps diffs and comparisons stable (Ruling R3).
export const RolesInput = z.object({
  roles: z
    .array(Role)
    .min(1, "Choose at least one role")
    .max(ROLE_NAMES.length)
    .refine((roles) => new Set(roles).size === roles.length, {
      message: "Each role can be chosen once",
    })
    .transform((roles) => ROLE_NAMES.filter((name) => roles.includes(name))),
})
export type RolesInput = z.output<typeof RolesInput>

export const BanInput = z.object({
  reason: z
    .string()
    .trim()
    .max(200, "Keep the reason under 200 characters")
    .optional()
    .transform((value) => value || undefined),
  days: z.number().int().min(1).max(365).nullable().default(null),
})
export type BanInput = z.output<typeof BanInput>

export const AuthorLinkInput = z.object({ authorId: z.uuid().nullable() })
export type AuthorLinkInput = z.infer<typeof AuthorLinkInput>

export const USER_STATUSES = ["active", "banned", "invited", "no-2fa"] as const

export const UserListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().min(1).max(100).optional(),
  role: Role.optional(),
  status: z.enum(USER_STATUSES).optional(),
})
export type UserListQuery = z.output<typeof UserListQuery>

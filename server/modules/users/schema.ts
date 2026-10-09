import * as z from "zod"

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"

export const InviteInput = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter a valid email address" })),
  name: z.string().trim().min(1, "Enter a name").max(120),
  role: z.enum(ROLE_NAMES as [RoleName, ...RoleName[]], {
    error: "Choose a role",
  }),
})

export type InviteInput = z.infer<typeof InviteInput>

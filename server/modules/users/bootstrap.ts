import "server-only"

import { audit } from "@/server/lib/audit"

import { provisionUser } from "./service"

// The first owner, created from the command line. Provisioning with
// `{ as: "system" }` skips RBAC, which is why it is only ever called here.
// Throws ApiError CONFLICT ("... already has an account") if the email exists.
export async function createOwner({
  email,
  name,
}: {
  email: string
  name: string
}) {
  const user = await provisionUser(
    { email, name, role: "owner" },
    { as: "system" }
  )
  await audit(null, {
    action: "user.bootstrap-owner",
    entityType: "user",
    entityId: user.id,
    summary: `Bootstrapped owner ${user.email} from the CLI`,
  })
  return { userId: user.id }
}

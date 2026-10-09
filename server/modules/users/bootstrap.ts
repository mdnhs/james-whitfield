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
  // The owner and invite already exist; a failed audit row must not turn
  // this one-off bootstrap into a failure that blocks reruns.
  try {
    await audit(null, {
      action: "user.bootstrap-owner",
      entityType: "user",
      entityId: user.id,
      summary: `Bootstrapped owner ${user.email} from the CLI`,
    })
  } catch (error) {
    console.warn(
      "owner created and invite sent, but the audit entry failed:",
      error instanceof Error ? error.message : error
    )
  }
  return { userId: user.id }
}

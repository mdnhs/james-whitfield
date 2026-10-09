import type { RoleName } from "./permissions"

// Roles that can change who has access, or run custom code, must use 2FA.
const REQUIRED: readonly RoleName[] = ["owner", "admin"]

export const roleRequiresTwoFactor = (roles: readonly RoleName[]) =>
  roles.some((role) => REQUIRED.includes(role))

export const mustSetUpTwoFactor = (actor: {
  roles: readonly RoleName[]
  twoFactorEnabled: boolean
}) => roleRequiresTwoFactor(actor.roles) && !actor.twoFactorEnabled

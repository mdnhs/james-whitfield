import type { RoleName } from "./permissions"

// Change (2026-10-11), per the product owner: two-factor authentication is
// optional for every role. Nobody is forced to set it up, and anyone may turn
// it off. Roles that can change who has access, or run custom code, are only
// urged more strongly to turn it on.
const RECOMMENDED: readonly RoleName[] = ["owner", "admin"]

export const roleRecommendsTwoFactor = (roles: readonly RoleName[]) =>
  roles.some((role) => RECOMMENDED.includes(role))

// Where Account ▸ Security lives: the place to turn 2FA on or off.
export const SECURITY_SETTINGS_PATH = "/admin/account?tab=security"

// The optional enrolment flow (QR code, verification, backup codes).
export const TWO_FACTOR_SETUP_PATH = "/admin/two-factor-setup"

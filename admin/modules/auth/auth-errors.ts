export const RATE_LIMITED = "Too many attempts — try again in a minute."
// Better Auth's two-factor lockout: 10 wrong codes in a row lock the
// account's 2FA for accountLockout.durationSeconds (default 900).
export const LOCKED =
  "Too many wrong codes. Two-factor sign-in is locked for 15 minutes."
export const UNREACHABLE =
  "Couldn't reach the server. Check your connection and try again."

export type AuthFailure =
  | { kind: "rate-limited"; message: string }
  | { kind: "locked"; message: string }
  | { kind: "unreachable"; message: string }
  // The server answered "no" (bad credentials, expired token…): the caller
  // words it, since only it knows what the request was. `code` is Better
  // Auth's error code (e.g. INVALID_TWO_FACTOR_COOKIE) when it sends one.
  // `fieldErrors` when the server names the fields at fault (our hooks do,
  // e.g. INVALID_PROFILE).
  | {
      kind: "rejected"
      message: null
      code?: string
      fieldErrors?: Record<string, string[]>
    }

type AuthResult<T> = {
  data: T | null
  error: { status?: number; code?: string; fieldErrors?: unknown } | null
}

function asFieldErrors(value: unknown) {
  if (typeof value !== "object" || value === null) return undefined
  const entries = Object.entries(value)
  const valid = entries.every(
    ([, messages]) =>
      Array.isArray(messages) && messages.every((m) => typeof m === "string")
  )
  return valid && entries.length > 0
    ? (value as Record<string, string[]>)
    : undefined
}

// Wraps an authClient call so a rate limit or an outage is never shown as
// "wrong password" or "check your inbox". Network failures reject the
// promise; Better Auth reports everything else as `error.status`.
export async function authRequest<T>(
  call: () => Promise<AuthResult<T>>
): Promise<{ data: T | null; failure: AuthFailure | null }> {
  let result: AuthResult<T>
  try {
    result = await call()
  } catch {
    return {
      data: null,
      failure: { kind: "unreachable", message: UNREACHABLE },
    }
  }
  const { data, error } = result
  if (!error) return { data, failure: null }
  const status = error.status ?? 0
  if (status === 429 && error.code === "ACCOUNT_TEMPORARILY_LOCKED") {
    return { data, failure: { kind: "locked", message: LOCKED } }
  }
  if (status === 429) {
    return { data, failure: { kind: "rate-limited", message: RATE_LIMITED } }
  }
  if (status === 0 || status >= 500) {
    return { data, failure: { kind: "unreachable", message: UNREACHABLE } }
  }
  const fieldErrors = asFieldErrors(error.fieldErrors)
  return {
    data,
    failure: {
      kind: "rejected",
      message: null,
      code: error.code,
      ...(fieldErrors && { fieldErrors }),
    },
  }
}

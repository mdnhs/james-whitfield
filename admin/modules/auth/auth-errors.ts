export const RATE_LIMITED = "Too many attempts — try again in a minute."
export const UNREACHABLE =
  "Couldn't reach the server. Check your connection and try again."

export type AuthFailure =
  | { kind: "rate-limited"; message: string }
  | { kind: "unreachable"; message: string }
  // The server answered "no" (bad credentials, expired token…): the caller
  // words it, since only it knows what the request was. `code` is Better
  // Auth's error code (e.g. INVALID_TWO_FACTOR_COOKIE) when it sends one.
  | { kind: "rejected"; message: null; code?: string }

type AuthResult<T> = {
  data: T | null
  error: { status?: number; code?: string } | null
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
  if (status === 429) {
    return { data, failure: { kind: "rate-limited", message: RATE_LIMITED } }
  }
  if (status === 0 || status >= 500) {
    return { data, failure: { kind: "unreachable", message: UNREACHABLE } }
  }
  return {
    data,
    failure: { kind: "rejected", message: null, code: error.code },
  }
}

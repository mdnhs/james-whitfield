import "server-only"

// Better Auth BETTER_AUTH_SECRETS format: "<version>:<secret>,…", newest
// first (node_modules/better-auth/dist/context/secret-utils.mjs). Parsed here
// so a typo fails at startup with our message, not deep inside Better Auth.
export function parseAuthSecrets(raw: string | undefined) {
  if (!raw?.trim()) return undefined
  const seen = new Set<number>()
  return raw.split(",").map((entry) => {
    const match = /^\s*(\d+):(.+?)\s*$/.exec(entry)
    if (!match)
      throw new Error(
        `BETTER_AUTH_SECRETS: expected "<version>:<secret>", got "${entry.trim().slice(0, 8)}…"`
      )
    const version = Number(match[1])
    const value = match[2]!
    if (value.length < 32)
      throw new Error(
        `BETTER_AUTH_SECRETS: version ${version} is shorter than 32 characters`
      )
    if (seen.has(version))
      throw new Error(`BETTER_AUTH_SECRETS: version ${version} appears twice`)
    seen.add(version)
    return { version, value }
  })
}

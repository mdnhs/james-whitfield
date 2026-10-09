const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
]
// Order matters: iOS and Android user agents also mention Mac and Linux.
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
]

// "Chrome on macOS" for the sessions list. Enough to recognise a device,
// not a fingerprint.
export function describeAgent(agent: string | null | undefined) {
  if (!agent) return "Unknown device"
  const browser = BROWSERS.find(([pattern]) => pattern.test(agent))?.[1]
  const system = SYSTEMS.find(([pattern]) => pattern.test(agent))?.[1]
  if (browser && system) return `${browser} on ${system}`
  return browser ?? system ?? "Unknown device"
}

import "server-only"

// Stub: Task 5 replaces these bodies.
export type BotOutcome = "replied" | "skipped" | "handoff" | "failed"

export async function isActive(): Promise<boolean> {
  return false
}

export async function maybeReply(_id: string): Promise<BotOutcome> {
  return "skipped"
}

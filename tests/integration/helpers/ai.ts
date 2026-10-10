// tests/integration/helpers/ai.ts
import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { encryptSecret } from "@/server/lib/secrets"
import { AI_KEY_PURPOSE } from "@/server/modules/ai/settings"

export const FAKE_KEY = "AIza-integration-fake-key-WXYZ"

// An enabled Google setup with an encrypted key, plus any overrides.
export async function seedAi(value: Record<string, unknown> = {}) {
  const doc = {
    enabled: true,
    provider: "google",
    model: "gemini-flash-latest",
    apiKeyEncrypted: encryptSecret(FAKE_KEY, AI_KEY_PURPOSE),
    apiKeyHint: "WXYZ",
    ...value,
  }
  await getDb()
    .insert(settings)
    .values({ key: "ai", value: doc, version: 1 })
    .onConflictDoUpdate({ target: settings.key, set: { value: doc } })
}

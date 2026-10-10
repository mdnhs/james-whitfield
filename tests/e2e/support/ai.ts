import { request as playwrightRequest } from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"
import { api } from "./api"
import { STORAGE } from "./storage"

const SETTINGS = {
  provider: "google",
  model: "gemini-flash-latest",
  baseUrl: "",
  allowedRoles: ["editor", "author", "marketer", "intake", "viewer"],
  systemPrompt: "",
  maxOutputTokens: 1024,
}

async function put(enabled: boolean, apiKey?: string) {
  const req = await playwrightRequest.newContext({
    baseURL: E2E_ORIGIN,
    storageState: STORAGE.owner,
  })
  const doc = await api<{ version: number }>(req, "GET", "/ai/settings")
  await api(req, "PUT", "/ai/settings", {
    ...SETTINGS,
    version: doc.version,
    enabled,
    ...(apiKey ? { apiKey } : {}),
  })
  await req.dispose()
}

export const enableAi = () => put(true, "e2e-not-a-real-key-0000")
export const disableAi = () => put(false)

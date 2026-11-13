import { request as playwrightRequest } from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"
import { api } from "./api"
import { STORAGE } from "./storage"

// Turns the chat (and, optionally, the bot) on or off through the admin API.
// The bot also needs the AI assistant configured: see enableAi().
export async function setChat(enabled: boolean, bot: boolean) {
  const req = await playwrightRequest.newContext({
    baseURL: E2E_ORIGIN,
    storageState: STORAGE.owner,
  })
  const doc = await api<{ version: number }>(req, "GET", "/globals/chat")
  await api(req, "PUT", "/globals/chat", {
    version: doc.version,
    value: {
      enabled,
      welcome: "Hi, how can we help?",
      offlineNote:
        "No one is online right now. Leave your email and Magda's team will reply.",
      bot: {
        enabled: bot,
        name: "Assistant",
        extraInstructions: "",
        maxAiReplies: 20,
      },
    },
  })
  await req.dispose()
}

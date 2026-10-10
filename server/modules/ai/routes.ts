// server/modules/ai/routes.ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { AiSettingsUpdate, ListModelsInput } from "@/lib/ai/schema"
import { validationHook } from "@/server/api/errors"
import { actorLimit } from "@/server/api/middleware/actor-limit"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import {
  getAiAdmin,
  getAiStatus,
  listModelsFor,
  saveAiSettings,
  testConnection,
} from "./service"

// Ruling R11.
export const AI_CHAT_LIMIT = { limit: 30, windowMs: 10 * 60_000 }
export const AI_TEST_LIMIT = { limit: 5, windowMs: 60_000 }
export const AI_MODELS_LIMIT = { limit: 10, windowMs: 60_000 }

export const aiRoutes = new Hono<AppEnv>()
  .get("/status", can({ ai: ["use"] }), async (c) =>
    c.json(await getAiStatus(c.get("actor")!))
  )
  .get("/settings", can({ ai: ["manage"] }), async (c) =>
    c.json(await getAiAdmin())
  )
  .put(
    "/settings",
    can({ ai: ["manage"] }),
    zValidator("json", AiSettingsUpdate, validationHook),
    async (c) =>
      c.json(await saveAiSettings(c.get("actor")!, c.req.valid("json")))
  )
  .post(
    "/settings/models",
    can({ ai: ["manage"] }),
    actorLimit("ai-models", AI_MODELS_LIMIT),
    zValidator("json", ListModelsInput, validationHook),
    async (c) =>
      c.json(await listModelsFor(c.get("actor")!, c.req.valid("json")))
  )
  .post(
    "/settings/test",
    can({ ai: ["manage"] }),
    actorLimit("ai-test", AI_TEST_LIMIT),
    async (c) => c.json(await testConnection(c.get("actor")!))
  )

export type AiRoutes = typeof aiRoutes

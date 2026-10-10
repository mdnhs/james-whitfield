import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { PRESET_IDS } from "@/lib/theme/presets"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import {
  discardThemeDraft,
  getThemeAdmin,
  publishedColors,
  publishTheme,
  resetThemeDraft,
  restoreThemeRevision,
  saveThemeDraft,
  themeRevisions,
} from "./service"

const Version = z.object({ version: z.number().int().min(0) })
const DraftInput = Version.extend({ draft: z.unknown() })
const ResetInput = Version.extend({
  preset: z.enum(PRESET_IDS),
  scope: z.enum(["site", "admin", "both"]).default("both"),
})
const RevisionParam = z.object({ rev: z.uuid() })

// brief §8.3 Appearance row, plus discard, revisions and colours (R8, R14).
// admin.ts already requires a signed-in, 2FA-complete session.
export const themeRoutes = new Hono<AppEnv>()
  .get("/", can({ appearance: ["read"] }), async (c) =>
    c.json(await getThemeAdmin())
  )
  .get("/colors", async (c) => c.json(await publishedColors()))
  .put(
    "/draft",
    can({ appearance: ["update"] }),
    zValidator("json", DraftInput, validationHook),
    async (c) =>
      c.json(await saveThemeDraft(c.get("actor")!, c.req.valid("json")))
  )
  .post(
    "/publish",
    can({ appearance: ["publish"] }),
    zValidator("json", Version, validationHook),
    async (c) =>
      c.json(await publishTheme(c.get("actor")!, c.req.valid("json")))
  )
  .post(
    "/reset",
    can({ appearance: ["update"] }),
    zValidator("json", ResetInput, validationHook),
    async (c) =>
      c.json(await resetThemeDraft(c.get("actor")!, c.req.valid("json")))
  )
  .post(
    "/discard",
    can({ appearance: ["update"] }),
    zValidator("json", Version, validationHook),
    async (c) =>
      c.json(await discardThemeDraft(c.get("actor")!, c.req.valid("json")))
  )
  .get("/revisions", can({ appearance: ["read"] }), async (c) =>
    c.json(await themeRevisions())
  )
  .post(
    "/revisions/:rev/restore",
    can({ appearance: ["update"] }),
    zValidator("param", RevisionParam, validationHook),
    zValidator("json", Version, validationHook),
    async (c) =>
      c.json(
        await restoreThemeRevision(
          c.get("actor")!,
          c.req.valid("param").rev,
          c.req.valid("json").version
        )
      )
  )

export type ThemeRoutes = typeof themeRoutes

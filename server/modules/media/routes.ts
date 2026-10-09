import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono, type Context } from "hono"
import * as z from "zod"

import { ApiError, validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import * as service from "./service"

const Id = z.object({ id: z.uuid() })
const hook = validationHook

// The client's Content-Type and filename are never trusted: the service
// sniffs the bytes (server/lib/media/sniff.ts).
async function fileFrom(c: Context<AppEnv>) {
  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) {
    throw new ApiError("VALIDATION_FAILED", "Choose a file to upload", {
      file: ["Choose a file to upload"],
    })
  }
  return file
}

export const mediaRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ media: ["read"] }),
    zValidator("query", service.MediaListQuery, hook),
    async (c) => c.json(await service.listMedia(c.req.valid("query")))
  )
  .post("/", can({ media: ["upload"] }), async (c) =>
    c.json(await service.uploadMedia(c.get("actor")!, await fileFrom(c)), 201)
  )
  .patch(
    "/:id",
    can({ media: ["update"] }),
    zValidator("param", Id, hook),
    zValidator("json", service.MediaPatch, hook),
    async (c) =>
      c.json(
        await service.updateMedia(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json")
        )
      )
  )
  .post(
    "/:id/replace",
    can({ media: ["update"] }),
    zValidator("param", Id, hook),
    async (c) =>
      c.json(
        await service.replaceMedia(
          c.get("actor")!,
          c.req.valid("param").id,
          await fileFrom(c)
        )
      )
  )
  .get(
    "/:id/usage",
    can({ media: ["read"] }),
    zValidator("param", Id, hook),
    async (c) => c.json(await service.usageOf(c.req.valid("param").id))
  )
  .delete(
    "/:id",
    can({ media: ["delete"] }),
    zValidator("param", Id, hook),
    async (c) =>
      c.json(
        await service.deleteMedia(c.get("actor")!, c.req.valid("param").id)
      )
  )

export type MediaRoutes = typeof mediaRoutes

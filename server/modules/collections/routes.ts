import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { COLLECTION_NAMES } from "@/lib/content/collections"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import * as service from "./service"

const Name = z.object({ name: z.enum(COLLECTION_NAMES) })
const Item = Name.extend({ id: z.uuid() })
const Source = z.object({
  name: z.enum([...COLLECTION_NAMES, "articles"] as const),
})
const hook = validationHook

export const collectionsRoutes = new Hono<AppEnv>()
  .get(
    "/:name/options",
    can({ collection: ["read"] }),
    zValidator("param", Source, hook),
    async (c) =>
      c.json(
        await service.itemOptions(c.get("actor")!, c.req.valid("param").name)
      )
  )
  .get(
    "/:name",
    can({ collection: ["read"] }),
    zValidator("param", Name, hook),
    async (c) => c.json(await service.listItems(c.req.valid("param").name))
  )
  .post(
    "/:name",
    can({ collection: ["create"] }),
    zValidator("param", Name, hook),
    zValidator(
      "json",
      z.object({ values: z.record(z.string(), z.unknown()) }),
      hook
    ),
    async (c) =>
      c.json(
        await service.createItem(
          c.get("actor")!,
          c.req.valid("param").name,
          c.req.valid("json").values
        ),
        201
      )
  )
  // Registered before /:name/:id so "order" never reads as an id.
  .patch(
    "/:name/order",
    can({ collection: ["update"] }),
    zValidator("param", Name, hook),
    zValidator("json", z.object({ ids: z.array(z.uuid()).max(500) }), hook),
    async (c) =>
      c.json(
        await service.reorderItems(
          c.get("actor")!,
          c.req.valid("param").name,
          c.req.valid("json").ids
        )
      )
  )
  .patch(
    "/:name/:id",
    can({ collection: ["update"] }),
    zValidator("param", Item, hook),
    zValidator(
      "json",
      z.object({
        version: z.number().int().min(1),
        values: z.record(z.string(), z.unknown()),
      }),
      hook
    ),
    async (c) => {
      const { name, id } = c.req.valid("param")
      return c.json(
        await service.updateItem(c.get("actor")!, name, id, c.req.valid("json"))
      )
    }
  )
  .delete(
    "/:name/:id",
    can({ collection: ["delete"] }),
    zValidator("param", Item, hook),
    async (c) => {
      const { name, id } = c.req.valid("param")
      return c.json(await service.deleteItem(c.get("actor")!, name, id))
    }
  )

export type CollectionsRoutes = typeof collectionsRoutes

import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import type { Taxonomy } from "@/lib/content/taxonomy"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import * as service from "./service"

const IdParam = z.object({ id: z.uuid() })
const Fields = z.record(z.string(), z.unknown())
const UpdateInput = z.object({
  version: z.number().int().min(1),
  values: Fields,
})
// Ruling R3: everyone who reads articles reads these; editors and up manage them.
const read = can({ article: ["read"] })
const manage = can({ article: ["publish"] })

const routesFor = (name: Taxonomy) =>
  new Hono<AppEnv>()
    .get("/", read, async (c) => c.json(await service.listTaxonomy(name)))
    .post("/", manage, zValidator("json", Fields, validationHook), async (c) =>
      c.json(
        await service.createTaxonomy(
          c.get("actor")!,
          name,
          c.req.valid("json")
        ),
        201
      )
    )
    .patch(
      "/:id",
      manage,
      zValidator("param", IdParam, validationHook),
      zValidator("json", UpdateInput, validationHook),
      async (c) =>
        c.json(
          await service.updateTaxonomy(
            c.get("actor")!,
            name,
            c.req.valid("param").id,
            c.req.valid("json")
          )
        )
    )
    .delete(
      "/:id",
      manage,
      zValidator("param", IdParam, validationHook),
      async (c) =>
        c.json(
          await service.deleteTaxonomy(
            c.get("actor")!,
            name,
            c.req.valid("param").id
          )
        )
    )

export const categoriesRoutes = routesFor("categories")
export const authorsRoutes = routesFor("authors")
export type TaxonomyRoutes = typeof categoriesRoutes

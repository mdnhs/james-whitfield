// server/modules/ai/context.ts
import "server-only"

import type { ChatContext } from "@/lib/ai/schema"
import { hasPermission } from "@/lib/auth/permissions"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getArticle } from "@/server/modules/articles/service"
import { getPage } from "@/server/modules/pages/service"

import { errorTag } from "./errors"

export type ContextSubject = {
  kind: "page" | "article"
  id: string
  title: string
}

// The screen the person is on, as one subject the model may look up: the
// title only, read with the person's own permissions. Anything they can't
// read, or that is gone, is simply left out, as is any lookup that fails.
export async function contextSubject(
  actor: Actor,
  context: ChatContext | undefined
): Promise<ContextSubject | null> {
  const entity = context?.entity
  if (!entity) return null
  try {
    if (entity.type === "page") {
      if (!hasPermission(actor.roles, { page: ["read"] })) return null
      const page = await getPage(entity.id)
      return { kind: "page", id: page.id, title: page.title }
    }
    if (!hasPermission(actor.roles, { article: ["read"] })) return null
    const article = await getArticle(actor, entity.id)
    return { kind: "article", id: article.id, title: article.draft.title }
  } catch (error) {
    if (!(error instanceof ApiError))
      console.error("[ai] could not read the chat context", errorTag(error))
    return null
  }
}

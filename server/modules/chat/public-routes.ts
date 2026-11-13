import "server-only"

import { Hono } from "hono"
import { getCookie, setCookie } from "hono/cookie"

import { EmailInput, SendInput, StartChatInput } from "@/lib/chat/schema"
import { ApiError, invalid } from "@/server/api/errors"
import { publicLimit } from "@/server/api/middleware/public-limit"
import { sameOrigin } from "@/server/api/middleware/same-origin"
import type { AppEnv } from "@/server/api/types"
import { getEnv } from "@/server/env"
import { clientIp } from "@/server/lib/client-ip"
import { turnstileEnabled, verifyTurnstile } from "@/server/lib/turnstile"

import {
  CHAT_COOKIE,
  CHAT_COOKIE_MAX_AGE,
  CHAT_COOKIE_PATH,
  START_LIMIT,
  end,
  findByToken,
  pollLimit,
  requireChat,
  requireEnabled,
  send,
  setEmail,
  siteStartLimit,
  start,
  status,
  view,
} from "./visitor"

const isHoneypot = (raw: unknown) =>
  !!raw &&
  typeof raw === "object" &&
  typeof (raw as { website?: unknown }).website === "string" &&
  (raw as { website: string }).website.trim() !== ""

export const chatPublicRoutes = new Hono<AppEnv>()
  .use(sameOrigin)
  .get("/status", async (c) => c.json(await status()))
  .post("/start", publicLimit("chat-start", START_LIMIT), async (c) => {
    await requireEnabled()
    const raw = await c.req.json().catch(() => ({}))
    // Honeypot: look like a success, store nothing.
    if (isHoneypot(raw)) return c.json({ ok: true as const }, 201)
    // An open chat for this cookie is returned as is: no second chat.
    const existing = await findByToken(getCookie(c, CHAT_COOKIE))
    if (existing && existing.status === "open") {
      // The typed message is appended through the normal send path (limits,
      // crisis check, bot reply); a missing or invalid one just shows the chat.
      const typed = SendInput.safeParse({
        body: (raw as { message?: unknown }).message,
      })
      if (typed.success) {
        await send(
          existing,
          typed.data.body,
          clientIp(c.req.raw.headers) ?? "unknown"
        )
      }
      return c.json(
        await view((await findByToken(getCookie(c, CHAT_COOKIE))) ?? existing),
        201
      )
    }
    const parsed = StartChatInput.safeParse(raw)
    if (!parsed.success) throw invalid(parsed.error)
    await siteStartLimit()
    if (turnstileEnabled()) {
      const result = await verifyTurnstile(
        parsed.data.turnstileToken,
        clientIp(c.req.raw.headers),
        "chat"
      )
      if (result === "fail") {
        throw new ApiError("VALIDATION_FAILED", "Verification failed")
      }
    }
    const { token, view: v } = await start(parsed.data)
    setCookie(c, CHAT_COOKIE, token, {
      httpOnly: true,
      secure: getEnv().SITE_ENV !== "development",
      sameSite: "Lax",
      path: CHAT_COOKIE_PATH,
      maxAge: CHAT_COOKIE_MAX_AGE,
    })
    return c.json(v, 201)
  })
  .get("/conversation", async (c) => {
    await requireEnabled()
    // No cookie: 404 before any database write (the rate limit stores a row).
    const token = getCookie(c, CHAT_COOKIE)
    if (!token) throw new ApiError("NOT_FOUND", "Chat not found")
    await pollLimit(clientIp(c.req.raw.headers) ?? "unknown")
    const chat = await requireChat(token)
    const after = Number.parseInt(c.req.query("after") ?? "", 10)
    return c.json(await view(chat, after > 0 ? after : 0))
  })
  .post("/messages", async (c) => {
    await requireEnabled()
    const chat = await requireChat(getCookie(c, CHAT_COOKIE))
    const parsed = SendInput.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) throw invalid(parsed.error)
    const row = await send(
      chat,
      parsed.data.body,
      clientIp(c.req.raw.headers) ?? "unknown"
    )
    return c.json({ ok: true as const, id: row.id }, 201)
  })
  .post("/email", async (c) => {
    await requireEnabled()
    const chat = await requireChat(getCookie(c, CHAT_COOKIE))
    const parsed = EmailInput.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) throw invalid(parsed.error)
    await setEmail(chat, parsed.data)
    return c.json({ ok: true as const })
  })
  .post("/end", async (c) => {
    await requireEnabled()
    const chat = await requireChat(getCookie(c, CHAT_COOKIE))
    await end(chat)
    return c.json({ ok: true as const })
  })

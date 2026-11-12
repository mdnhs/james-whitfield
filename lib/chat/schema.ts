import * as z from "zod"

const s = (min: number, max: number) => z.string().trim().min(min).max(max)
const Email = z.string().trim().toLowerCase().max(254).pipe(z.email())

export const CHAT_SENDERS = ["visitor", "staff", "ai", "system"] as const
export type ChatSender = (typeof CHAT_SENDERS)[number]

export const StartChatInput = z.object({
  name: s(1, 80),
  email: Email.or(z.literal("")).optional(),
  message: s(1, 2000),
  consent: z.literal(true),
  sourcePath: z.string().max(200).startsWith("/").optional(),
  turnstileToken: z.string().max(4096).optional(),
  website: z.string().optional(),
})
export type StartChatInput = z.infer<typeof StartChatInput>

export const SendInput = z.object({ body: s(1, 2000) })
export type SendInput = z.infer<typeof SendInput>

export const EmailInput = z.object({ email: Email })
export type EmailInput = z.infer<typeof EmailInput>

export type VisitorMessage = {
  id: number
  sender: ChatSender
  senderName: string | null
  body: string
  createdAt: string
}

export type VisitorView = {
  id: string
  status: "open" | "closed"
  botActive: boolean
  needsHuman: boolean
  agentName: string | null
  messages: VisitorMessage[]
  lastId: number
}

export type ChatStatus = {
  enabled: boolean
  online: boolean
  botActive: boolean
  welcome: string
  offlineNote: string
  botName: string
  turnstileSiteKey: string | null
}

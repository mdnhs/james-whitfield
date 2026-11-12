"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type {
  StartChatInput,
  VisitorMessage,
  VisitorView,
} from "@/lib/chat/schema"

import {
  getConversation,
  saveEmail as apiSaveEmail,
  sendMessage,
  startChat,
  type ApiResult,
} from "./api"

export type ChatNotice = "offline" | "rate" | "ended" | null

const OPEN_MS = 3000
const CLOSED_MS = 20_000
const MAX_BACKOFF_MS = 30_000

const merge = (prev: VisitorMessage[], incoming: VisitorMessage[]) => {
  if (!incoming.length) return prev
  const byId = new Map(prev.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

// Owns the visitor's conversation: cookie-backed restore on mount, polling
// (3 s open, 20 s closed with a chat, paused while hidden, backed off on
// errors) and the visitor's actions. The panel module is presentational.
export function useChat(open: boolean) {
  const [messages, setMessages] = useState<VisitorMessage[]>([])
  const [meta, setMeta] = useState({
    closed: false,
    botActive: false,
    needsHuman: false,
    agentName: null as string | null,
  })
  const [exists, setExists] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [notice, setNotice] = useState<ChatNotice>(null)
  const [unread, setUnread] = useState(false)
  const [emailSaved, setEmailSaved] = useState(false)

  // Opening the panel reads everything: adjust during render, not in an effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setUnread(false)
  }

  const lastId = useRef(0)
  const known = useRef(new Set<number>())
  const existsRef = useRef(false)
  const loadedRef = useRef(false)
  const closedRef = useRef(false)
  const openRef = useRef(open)
  const firstLoad = useRef(true)
  const engine = useRef({
    poll: async () => {},
    schedule: () => {},
  })

  const apply = useCallback((view: VisitorView) => {
    const fresh = view.messages.filter((m) => !known.current.has(m.id))
    for (const m of view.messages) known.current.add(m.id)
    if (
      !firstLoad.current &&
      !openRef.current &&
      fresh.some((m) => m.sender !== "visitor")
    ) {
      setUnread(true)
    }
    firstLoad.current = false
    lastId.current = Math.max(
      lastId.current,
      view.lastId,
      ...view.messages.map((m) => m.id)
    )
    setMessages((prev) => merge(prev, view.messages))
    closedRef.current = view.status === "closed"
    setMeta({
      closed: view.status === "closed",
      botActive: view.botActive,
      needsHuman: view.needsHuman,
      agentName: view.agentName,
    })
    existsRef.current = true
    setExists(true)
  }, [])

  // Polling engine. Lives in one effect so poll and schedule can call each
  // other; actions reach it through `engine`.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let inflight = false
    let failures = 0
    let alive = true

    const schedule = () => {
      clearTimeout(timer)
      if (!alive || document.hidden) return
      if (closedRef.current) return
      if (loadedRef.current && !existsRef.current) return
      const delay = failures
        ? Math.min(OPEN_MS * 2 ** (failures - 1), MAX_BACKOFF_MS)
        : openRef.current
          ? OPEN_MS
          : CLOSED_MS
      // Re-check at fire time: the tab may have been hidden since scheduling.
      timer = setTimeout(() => {
        if (!document.hidden) void poll()
      }, delay)
    }

    const poll = async () => {
      if (inflight) return
      inflight = true
      clearTimeout(timer)
      const result = await getConversation(lastId.current)
      inflight = false
      if (!alive) return
      if (result.ok) {
        failures = 0
        setReconnecting(false)
        loadedRef.current = true
        setLoaded(true)
        apply(result.data)
      } else if (result.kind === "notfound") {
        failures = 0
        setReconnecting(false)
        loadedRef.current = true
        setLoaded(true)
        existsRef.current = false
        setExists(false)
      } else {
        failures += 1
        setReconnecting(result.kind === "network")
      }
      schedule()
    }

    const wake = () => {
      if (document.hidden) return
      if (loadedRef.current && !existsRef.current) return
      if (closedRef.current) return
      void poll()
    }

    engine.current = { poll, schedule }
    void poll()
    document.addEventListener("visibilitychange", wake)
    window.addEventListener("online", wake)
    window.addEventListener("focus", wake)
    return () => {
      alive = false
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", wake)
      window.removeEventListener("online", wake)
      window.removeEventListener("focus", wake)
    }
  }, [apply])

  useEffect(() => {
    openRef.current = open
    if (open) {
      if (existsRef.current && !closedRef.current) void engine.current.poll()
    } else {
      engine.current.schedule()
    }
  }, [open])

  const start = useCallback(
    async (input: StartChatInput): Promise<ApiResult<unknown>> => {
      const result = await startChat(input)
      if (result.ok) {
        const data = result.data
        if ("id" in data) {
          known.current = new Set()
          lastId.current = 0
          firstLoad.current = true
          setMessages([])
          apply(data)
          loadedRef.current = true
          setLoaded(true)
          setNotice(null)
          setEmailSaved(Boolean(input.email))
          engine.current.schedule()
        }
      } else if (result.kind === "network") setNotice("offline")
      else if (result.kind === "rate") setNotice("rate")
      return result
    },
    [apply]
  )

  const send = useCallback(async (body: string): Promise<boolean> => {
    const result = await sendMessage(body)
    if (result.ok) {
      setNotice(null)
      void engine.current.poll()
      return true
    }
    if (result.kind === "network") setNotice("offline")
    else if (result.kind === "rate") setNotice("rate")
    else if (result.kind === "ended") {
      closedRef.current = true
      setMeta((m) => ({ ...m, closed: true }))
      setNotice("ended")
    } else if (result.kind === "notfound") {
      existsRef.current = false
      setExists(false)
    }
    return false
  }, [])

  const saveEmail = useCallback(async (email: string) => {
    const result = await apiSaveEmail(email)
    if (result.ok) setEmailSaved(true)
    return result
  }, [])

  // Ended chat: forget it so the start form shows. The next /start replaces
  // the cookie server-side.
  const startNew = useCallback(() => {
    known.current = new Set()
    lastId.current = 0
    firstLoad.current = true
    existsRef.current = false
    closedRef.current = false
    setMessages([])
    setMeta({
      closed: false,
      botActive: false,
      needsHuman: false,
      agentName: null,
    })
    setExists(false)
    setNotice(null)
    setEmailSaved(false)
  }, [])

  return {
    messages,
    exists,
    loaded,
    reconnecting,
    notice,
    unread,
    emailSaved,
    ended: meta.closed,
    botActive: meta.botActive,
    needsHuman: meta.needsHuman,
    agentName: meta.agentName,
    start,
    send,
    saveEmail,
    startNew,
  }
}

export type ChatApi = ReturnType<typeof useChat>

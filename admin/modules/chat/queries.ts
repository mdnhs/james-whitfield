import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"
import { toast } from "sonner"

import { chatApi, parseResponse } from "@/admin/lib/api"
import type { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"

export type ChatStatus = "open" | "closed"
export type ChatPage = InferResponseType<typeof chatApi.index.$get, 200>
// The list rows carry `unread` at runtime (repo.listForStaff); the service's
// toStaff() widens the static type, so it is restated here.
export type ChatListItem = ChatPage["items"][number] & { unread: boolean }
export type ChatDetail = InferResponseType<(typeof chatApi)[":id"]["$get"], 200>
export type ChatMessage = ChatDetail["messages"][number]

// Open threads and the list refresh every 4 s in view, every 30 s behind
// another tab.
export const pollInterval = (visible: boolean) => (visible ? 4_000 : 30_000)

export const chatListQuery = (status: ChatStatus, visible = true) =>
  infiniteQueryOptions({
    queryKey: queryKeys.chat.list(status),
    queryFn: ({ pageParam }) =>
      parseResponse(
        chatApi.index.$get({
          query: { status, ...(pageParam ? { cursor: pageParam } : {}) },
        })
      ),
    initialPageParam: "",
    getNextPageParam: (last) => last.next ?? undefined,
    refetchInterval: pollInterval(visible),
    refetchIntervalInBackground: true,
  })

export const chatDetailQuery = (id: string, visible = true) =>
  queryOptions({
    queryKey: queryKeys.chat.detail(id),
    // Asks only for messages newer than the ones already held, and appends.
    queryFn: async ({ client }) => {
      const prev = client.getQueryData<ChatDetail>(queryKeys.chat.detail(id))
      const after = prev?.messages.at(-1)?.id ?? 0
      const next = await parseResponse(
        chatApi[":id"].$get({ param: { id }, query: { after: String(after) } })
      )
      const held = prev?.messages ?? []
      const seen = new Set(held.map((m) => m.id))
      return {
        ...next,
        messages: [...held, ...next.messages.filter((m) => !seen.has(m.id))],
      }
    },
    refetchInterval: pollInterval(visible),
    refetchIntervalInBackground: true,
  })

export const chatUnreadQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: queryKeys.chat.unread,
    queryFn: () => parseResponse(chatApi.unread.$get()),
    enabled,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  })

export function useChatActions(id: string) {
  const client = useQueryClient()
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.chat.detail(id) }),
      client.invalidateQueries({ queryKey: ["chat", "list"] }),
      client.invalidateQueries({ queryKey: queryKeys.chat.unread }),
    ])
  const opts = {
    onSuccess: refresh,
    onError: (error: ApiError) => toast.error(error.message),
  }
  const param = { id }
  return {
    takeover: useMutation({
      mutationFn: () => parseResponse(chatApi[":id"].takeover.$post({ param })),
      ...opts,
    }),
    handback: useMutation({
      mutationFn: () => parseResponse(chatApi[":id"].handback.$post({ param })),
      ...opts,
    }),
    assign: useMutation({
      mutationFn: (userId: string | null) =>
        parseResponse(
          chatApi[":id"].assign.$post({ param, json: { userId } })
        ),
      ...opts,
    }),
    close: useMutation({
      mutationFn: () => parseResponse(chatApi[":id"].close.$post({ param })),
      ...opts,
    }),
    remove: useMutation({
      mutationFn: () => parseResponse(chatApi[":id"].$delete({ param })),
      onSuccess: () => {
        client.removeQueries({ queryKey: queryKeys.chat.detail(id) })
        return Promise.all([
          client.invalidateQueries({ queryKey: ["chat", "list"] }),
          client.invalidateQueries({ queryKey: queryKeys.chat.unread }),
        ])
      },
      onError: opts.onError,
    }),
    // The server also takes the chat over for the sender. The caller shows
    // the error inline and keeps the draft, so there is no toast here.
    reply: useMutation({
      mutationFn: (body: string) =>
        parseResponse(
          chatApi[":id"].messages.$post({ param, json: { body } })
        ),
      onSuccess: refresh,
    }),
    // Only called while the tab is visible; failures are silent and retried
    // on the next new message.
    markRead: useMutation({
      mutationFn: (upTo: number) =>
        parseResponse(chatApi[":id"].read.$post({ param, json: { upTo } })),
      onSuccess: () =>
        Promise.all([
          client.invalidateQueries({ queryKey: ["chat", "list"] }),
          client.invalidateQueries({ queryKey: queryKeys.chat.unread }),
        ]),
    }),
  }
}

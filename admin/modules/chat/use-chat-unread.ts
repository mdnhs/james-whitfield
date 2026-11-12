"use client"

import { useQuery } from "@tanstack/react-query"

import { chatUnreadQuery } from "./queries"

// The sidebar badge: chats waiting for a first look.
export function useChatUnread(enabled: boolean) {
  const { data } = useQuery(chatUnreadQuery(enabled))
  return data?.count
}

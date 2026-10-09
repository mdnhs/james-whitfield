"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MonitorSmartphoneIcon } from "lucide-react"
import { toast } from "sonner"

import { relativeTime } from "@/admin/components/dashboard/format"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { accountApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button } from "@/components/ui/button"

// docs/brief.md §7.4: users list and revoke their own sessions, through
// /api/v1/admin/account/sessions. The server sends a device summary per
// session, never its token or IP address.
export function SessionsList() {
  const queryClient = useQueryClient()
  const sessions = useQuery({
    queryKey: queryKeys.account.sessions,
    queryFn: () => parseResponse(accountApi.sessions.$get()),
  })
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.account.sessions })
  const revoke = useMutation({
    mutationFn: (id: string) =>
      parseResponse(accountApi.sessions[":id"].$delete({ param: { id } })),
    onSuccess: () => {
      toast.success("Signed out of that device")
      return refresh()
    },
    onError: (error) => {
      // Signed out elsewhere or expired: the list was stale, nothing failed.
      if (error instanceof ApiError && error.code === "NOT_FOUND") {
        toast.info("That device was already signed out")
      } else {
        toast.error(error.message)
      }
      return refresh()
    },
  })
  const revokeOthers = useMutation({
    mutationFn: () =>
      parseResponse(accountApi.sessions["revoke-others"].$post()),
    onSuccess: () => {
      toast.success("Signed out of your other devices")
      return refresh()
    },
    onError: (error) => toast.error(error.message),
  })

  if (sessions.isPending) return <CardSkeleton className="h-40" />
  if (sessions.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {sessions.error.message}
      </p>
    )
  }

  // "Last active" as of when the list was fetched: render stays pure, and
  // the list refetches on focus, which moves both together.
  const now = sessions.dataUpdatedAt
  // The server sorts this device first, then the most recently active.
  const list = sessions.data
  const busy = revoke.isPending || revokeOthers.isPending
  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Signed-in devices" className="flex flex-col divide-y">
        {list.map((session) => (
          <li
            key={session.id}
            className="flex flex-wrap items-center gap-3 py-3"
          >
            <MonitorSmartphoneIcon
              aria-hidden
              className="size-5 text-muted-foreground"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{session.device}</span>
              <span className="text-xs text-muted-foreground">
                Last active {relativeTime(session.lastActiveAt, now)}
              </span>
            </div>
            {/* Signing this device out is the user menu's "Sign out". */}
            {session.current ? (
              <StatusPill tone="success">This device</StatusPill>
            ) : (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => revoke.mutate(session.id)}
              >
                Sign out
                <span className="sr-only"> {session.device}</span>
              </Button>
            )}
          </li>
        ))}
      </ul>
      {list.length > 1 ? (
        <div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => revokeOthers.mutate()}
          >
            Sign out other devices
          </Button>
        </div>
      ) : null}
    </div>
  )
}

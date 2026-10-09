"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MonitorSmartphoneIcon } from "lucide-react"
import { toast } from "sonner"

import { relativeTime } from "@/admin/components/dashboard/format"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { authClient } from "@/admin/lib/auth-client"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button } from "@/components/ui/button"

import { describeAgent } from "./describe-agent"

type ClientError = { message?: string; code?: string }

class AuthCallError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message)
  }
}

// Better Auth's client resolves to { data, error } instead of throwing;
// TanStack Query needs a thrown error to show its error state.
async function unwrap<T>(
  call: Promise<{ data: T; error: null } | { data: null; error: ClientError }>,
  fallback: string
): Promise<T> {
  const result = await call
  if (result.error) {
    throw new AuthCallError(result.error.message ?? fallback, result.error.code)
  }
  return result.data as T
}

// The server refuses a device that is no longer this user's (signed out
// elsewhere, or expired): the list is stale, not the request wrong.
const GONE = "SESSION_NOT_FOUND"

// docs/brief.md §7.4: users list and revoke their own sessions. Better Auth
// returns each session's IP address too; it is never shown here.
export function SessionsList() {
  const queryClient = useQueryClient()
  const { data: current, isPending: currentPending } = authClient.useSession()
  const sessions = useQuery({
    queryKey: queryKeys.account.sessions,
    queryFn: () =>
      unwrap(authClient.listSessions(), "Couldn't load your devices"),
  })
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.account.sessions })
  const revoke = useMutation({
    mutationFn: (token: string) =>
      unwrap(
        authClient.revokeSession({ token }),
        "Couldn't sign that device out"
      ),
    onSuccess: () => {
      toast.success("Signed out of that device")
      return refresh()
    },
    onError: (error) => {
      if (error instanceof AuthCallError && error.code === GONE) {
        toast.info("That device was already signed out")
      } else {
        toast.error(error.message)
      }
      return refresh()
    },
  })
  const revokeOthers = useMutation({
    mutationFn: () =>
      unwrap(
        authClient.revokeOtherSessions(),
        "Couldn't sign the other devices out"
      ),
    onSuccess: () => {
      toast.success("Signed out of your other devices")
      return refresh()
    },
    onError: (error) => toast.error(error.message),
  })

  // Until the current session is known, this device would show a
  // "Sign out" button like any other.
  if (sessions.isPending || currentPending) {
    return <CardSkeleton className="h-40" />
  }
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
  const currentId = current?.session.id
  // This device first, then the most recently active.
  const list = [...(sessions.data ?? [])].sort(
    (a, b) =>
      Number(b.id === currentId) - Number(a.id === currentId) ||
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Signed-in devices" className="flex flex-col divide-y">
        {list.map((session) => {
          const device = describeAgent(session.userAgent)
          return (
            <li
              key={session.id}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <MonitorSmartphoneIcon
                aria-hidden
                className="size-5 text-muted-foreground"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{device}</span>
                <span className="text-xs text-muted-foreground">
                  Last active{" "}
                  {relativeTime(new Date(session.updatedAt).toISOString(), now)}
                </span>
              </div>
              {/* Signing this device out is the user menu's "Sign out". */}
              {session.id === currentId ? (
                <StatusPill tone="success">This device</StatusPill>
              ) : (
                <Button
                  variant="outline"
                  disabled={revoke.isPending || revokeOthers.isPending}
                  onClick={() => revoke.mutate(session.token)}
                >
                  Sign out
                  <span className="sr-only"> {device}</span>
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {list.length > 1 ? (
        <div>
          <Button
            variant="outline"
            disabled={revoke.isPending || revokeOthers.isPending}
            onClick={() => revokeOthers.mutate()}
          >
            Sign out other devices
          </Button>
        </div>
      ) : null}
    </div>
  )
}

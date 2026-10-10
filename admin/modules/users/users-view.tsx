"use client"

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { PlusIcon, UsersIcon } from "lucide-react"
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import {
  PageHeader,
  PRIMARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { DataTablePagination } from "@/admin/components/data-table/data-table-pagination"
import { useActor, usePermission } from "@/admin/lib/actor-context"
import { parseResponse, usersApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { useResetOnHide } from "@/admin/lib/use-reset-on-hide"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { ROLE_LABELS } from "@/lib/auth/role-labels"
import { USER_STATUSES } from "@/lib/users/schema"
import { cn } from "@/lib/utils"
import type { UserDto } from "@/server/modules/users/manage"

import { AuthorDialog } from "./author-dialog"
import { BanDialog } from "./ban-dialog"
import { ConfirmDialog } from "./confirm-dialog"
import { InviteDialog } from "./invite-dialog"
import { PermissionMatrix } from "./permission-matrix"
import type { UserAction } from "./present"
import { usersListQuery, type UsersParams } from "./queries"
import { RoleDialog } from "./role-dialog"
import { UsersTable } from "./users-table"

const PAGE_SIZE = 25
const ALL = "__all__"
const STATUS_LABELS: Record<(typeof USER_STATUSES)[number], string> = {
  active: "Active",
  banned: "Banned",
  invited: "Invite pending",
  "no-2fa": "No two-factor",
}
const params = {
  tab: parseAsStringLiteral(["people", "roles"] as const).withDefault("people"),
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  role: parseAsStringLiteral(ROLE_NAMES),
  status: parseAsStringLiteral(USER_STATUSES),
}

type Open = { action: UserAction; user: UserDto } | null

export function UsersView() {
  const [state, setState] = useQueryStates(params, { history: "replace" })
  const actor = useActor()
  const canInvite = usePermission({ user: ["create"] }) && !actor.impersonatedBy
  const client = useQueryClient()
  const [inviting, setInviting] = useState(false)
  const [open, setOpen] = useState<Open>(null)
  useResetOnHide(() => {
    setInviting(false)
    setOpen(null)
  })

  const listParams: UsersParams = {
    page: Math.max(1, state.page),
    pageSize: PAGE_SIZE,
    q: state.q || undefined,
    role: (state.role as RoleName | null) ?? undefined,
    status: state.status ?? undefined,
  }
  const list = useQuery({
    ...usersListQuery(listParams),
    placeholderData: keepPreviousData,
  })

  const [search, setSearch] = useState(state.q)
  useEffect(() => {
    if (search === state.q) return
    const timer = setTimeout(() => void setState({ q: search, page: 1 }), 300)
    return () => clearTimeout(timer)
  }, [search, state.q, setState])

  const total = list.data?.total
  const lastPage =
    total === undefined ? undefined : Math.max(1, Math.ceil(total / PAGE_SIZE))
  useEffect(() => {
    if (lastPage !== undefined && state.page > lastPage)
      void setState({ page: lastPage })
  }, [lastPage, state.page, setState])

  const refresh = () =>
    client.invalidateQueries({ queryKey: queryKeys.users.all })

  const run = useMutation({
    mutationFn: async ({
      action,
      user,
    }: {
      action: UserAction
      user: UserDto
    }) => {
      const param = { id: user.id }
      if (action === "unban")
        return parseResponse(usersApi[":id"].unban.$post({ param }))
      if (action === "resend")
        return parseResponse(usersApi[":id"]["resend-invite"].$post({ param }))
      if (action === "revoke")
        return parseResponse(usersApi[":id"].sessions.$delete({ param }))
      if (action === "delete")
        return parseResponse(usersApi[":id"].$delete({ param }))
      if (action === "view-as")
        return parseResponse(usersApi[":id"].impersonate.$post({ param }))
      throw new Error(`No direct request for ${action}`)
    },
    onSuccess: (_result, { action, user }) => {
      if (action === "view-as") {
        // A full load, so no cached query outlives the identity switch.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full document load on purpose: see above
        window.location.assign("/admin")
        return
      }
      toast.success(
        {
          unban: `${user.name} can sign in again`,
          resend: `Invite sent to ${user.email}`,
          revoke: `${user.name} is signed out everywhere`,
          delete: `${user.name} was deleted`,
        }[action as "unban" | "resend" | "revoke" | "delete"]
      )
      setOpen(null)
      void refresh()
    },
    onError: (error) => {
      setOpen(null)
      toast.error(error.message)
    },
  })

  function onAction(action: UserAction, user: UserDto) {
    if (action === "unban" || action === "resend" || action === "view-as") {
      run.mutate({ action, user })
      return
    }
    setOpen({ action, user })
  }

  const roleItems = [
    { value: ALL, label: "All roles" },
    ...ROLE_NAMES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
  ]
  const statusItems = [
    { value: ALL, label: "Any status" },
    ...USER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
  ]
  const filter = (values: Partial<typeof state>) =>
    void setState({ ...values, page: 1 })
  const target = open?.user

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users & roles"
        description="Who can sign in, and what each role is allowed to do."
        actions={
          canInvite ? (
            <Button
              className={cn(PRIMARY_ACTION)}
              onClick={() => setInviting(true)}
            >
              <PlusIcon aria-hidden />
              Invite someone
            </Button>
          ) : null
        }
      />
      <Tabs
        value={state.tab}
        onValueChange={(value) =>
          void setState({ tab: value as "people" | "roles" })
        }
      >
        <TabsList>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
        <TabsContent value="people" className="flex flex-col gap-6 pt-4">
          <div
            role="group"
            aria-label="Filters"
            className="flex flex-wrap items-center gap-3"
          >
            <Input
              type="search"
              aria-label="Search people"
              placeholder="Search name or email"
              className="w-full sm:w-72"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              items={roleItems}
              value={state.role ?? ALL}
              onValueChange={(value) =>
                filter({ role: value === ALL ? null : (value as RoleName) })
              }
            >
              <SelectTrigger aria-label="Filter by role" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={statusItems}
              value={state.status ?? ALL}
              onValueChange={(value) =>
                filter({
                  status:
                    value === ALL
                      ? null
                      : (value as (typeof USER_STATUSES)[number]),
                })
              }
            >
              <SelectTrigger aria-label="Filter by status" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {list.isPending ? (
            <CardSkeleton />
          ) : list.isError ? (
            <EmptyState
              title="People didn't load"
              description={list.error.message}
              action={<Button onClick={() => list.refetch()}>Try again</Button>}
            />
          ) : list.data.items.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="Nobody matches these filters"
              description="Try a different search or clear the filters."
            />
          ) : (
            <>
              <div
                aria-busy={list.isFetching || undefined}
                className={cn(list.isFetching && "opacity-70")}
              >
                <UsersTable users={list.data.items} onAction={onAction} />
              </div>
              <DataTablePagination
                page={listParams.page}
                pageSize={PAGE_SIZE}
                total={list.data.total}
                onPageChange={(page) =>
                  void setState({ page }, { history: "push" })
                }
              />
            </>
          )}
        </TabsContent>
        <TabsContent value="roles" className="pt-4">
          <PermissionMatrix />
        </TabsContent>
      </Tabs>

      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
      <RoleDialog
        user={open?.action === "roles" ? open.user : null}
        onClose={() => setOpen(null)}
      />
      <BanDialog
        user={open?.action === "ban" ? open.user : null}
        onClose={() => setOpen(null)}
      />
      <AuthorDialog
        user={open?.action === "author" ? open.user : null}
        onClose={() => setOpen(null)}
      />
      <ConfirmDialog
        open={open?.action === "revoke" || open?.action === "delete"}
        title={
          open?.action === "delete"
            ? `Delete ${target?.name}?`
            : `Sign ${target?.name} out everywhere?`
        }
        description={
          open?.action === "delete"
            ? `${target?.name} (${target?.email}) will lose access for good. Their past activity stays in the log. This can't be undone.`
            : `${target?.name} is signed out on every device and has to sign in again.`
        }
        confirmLabel={open?.action === "delete" ? "Delete" : "Sign out"}
        pending={run.isPending}
        onClose={() => setOpen(null)}
        onConfirm={() => open && run.mutate(open)}
      />
    </div>
  )
}

import { queryOptions } from "@tanstack/react-query"

import { parseResponse, usersApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import type { RoleName } from "@/lib/auth/permissions"

export type UsersParams = {
  page: number
  pageSize: number
  q?: string
  role?: RoleName
  status?: "active" | "banned" | "invited" | "no-2fa"
}

export const usersListQuery = (params: UsersParams) =>
  queryOptions({
    queryKey: queryKeys.users.list(params),
    queryFn: () =>
      parseResponse(
        usersApi.index.$get({
          query: {
            page: String(params.page),
            pageSize: String(params.pageSize),
            ...(params.q ? { q: params.q } : {}),
            ...(params.role ? { role: params.role } : {}),
            ...(params.status ? { status: params.status } : {}),
          },
        })
      ),
  })

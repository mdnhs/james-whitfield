"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { leadsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import type { LeadStatus } from "@/lib/leads/schema"

import type { LeadsPage } from "./queries"

type Patch = { status?: LeadStatus; assignedTo?: string | null }

// Status and assignee changes. A status change shows at once on every cached
// list and rolls back with a toast when the server refuses it; settling
// refreshes lists, the open detail and the sidebar count (queryKeys.leads.all
// covers stats).
export function useUpdateLead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Patch }) =>
      parseResponse(leadsApi[":id"].$patch({ param: { id }, json: patch })),
    onMutate: async ({ id, patch }) => {
      if (!patch.status) return { snapshots: [] }
      await client.cancelQueries({ queryKey: queryKeys.leads.all })
      const snapshots = client.getQueriesData<LeadsPage>({
        queryKey: ["leads", "list"],
      })
      client.setQueriesData<LeadsPage>(
        { queryKey: ["leads", "list"] },
        (page) =>
          page
            ? {
                ...page,
                items: page.items.map((item) =>
                  item.id === id ? { ...item, status: patch.status! } : item
                ),
              }
            : page
      )
      return { snapshots }
    },
    onError: (error, _vars, context) => {
      for (const [key, data] of context?.snapshots ?? [])
        client.setQueryData(key, data)
      toast.error(error.message)
    },
    onSettled: () =>
      client.invalidateQueries({ queryKey: queryKeys.leads.all }),
  })
}

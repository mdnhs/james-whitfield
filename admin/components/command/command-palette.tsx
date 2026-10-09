"use client"

import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query"
import { ArrowUpRightIcon, SparklesIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useDeferredValue, useMemo, useState } from "react"

import { parseResponse, searchApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { useResetOnHide } from "@/admin/lib/use-reset-on-hide"
import { useSignOut } from "@/admin/modules/auth/use-sign-out"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

import { buildActions, matchesQuery } from "./actions"
import { useCommandPalette } from "./palette-context"

const searchQuery = (q: string) =>
  queryOptions({
    queryKey: queryKeys.search(q),
    queryFn: () => parseResponse(searchApi.index.$get({ query: { q } })),
    staleTime: 60_000,
  })

export function CommandPalette({ siteUrl }: { siteUrl: string }) {
  const { open, setOpen } = useCommandPalette()
  const [q, setQ] = useState("")
  const term = useDeferredValue(q)
  const router = useRouter()
  const { setTheme } = useTheme()
  const { signOut } = useSignOut()
  const { data, isError } = useQuery({
    ...searchQuery(term),
    enabled: open,
    placeholderData: keepPreviousData,
  })
  // A hidden route (<Activity>) must not come back with the palette open.
  useResetOnHide(() => {
    setOpen(false)
  })

  const actions = useMemo(
    () =>
      buildActions({ setTheme, signOut, siteUrl }).filter((action) =>
        matchesQuery(q, action.label, action.keywords)
      ),
    [q, setTheme, signOut, siteUrl]
  )

  // One close path: Escape, a selection, the overlay and ⌘K all land here.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) setQ("")
  }

  function close() {
    setOpen(false)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      title="Search the admin"
      description="Jump to a page or run an action"
      className="sm:max-w-xl"
    >
      {/* The server already filtered navigation by role and query. */}
      <Command shouldFilter={false} loop>
        <CommandInput
          placeholder="Search pages and actions…"
          value={q}
          onValueChange={setQ}
        />
        <CommandList>
          <CommandEmpty>
            {isError
              ? "Search is unavailable right now. Try again in a moment."
              : data
                ? `Nothing matches “${q}”.`
                : "Searching…"}
          </CommandEmpty>
          {data?.items.length ? (
            <CommandGroup heading="Go to">
              {data.items.map((hit) => (
                <CommandItem
                  key={hit.id}
                  value={hit.id}
                  onSelect={() => {
                    close()
                    router.push(hit.href)
                  }}
                >
                  <ArrowUpRightIcon aria-hidden />
                  {hit.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {actions.length ? (
            <CommandGroup heading="Actions">
              {actions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={action.id}
                  onSelect={() => {
                    close()
                    action.run()
                  }}
                >
                  <SparklesIcon aria-hidden />
                  {action.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

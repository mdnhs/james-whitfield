import { CheckIcon, MinusIcon } from "lucide-react"

import { permissionMatrix, type Cell } from "@/lib/auth/matrix"
import { ROLE_NAMES } from "@/lib/auth/permissions"
import { ROLE_LABELS, ROLE_PURPOSE } from "@/lib/auth/role-labels"

const WORDS: Record<Cell, string> = {
  yes: "Allowed",
  no: "Not allowed",
  own: "Their own only",
  "not-owners": "Allowed, but not on owners",
}
const SHORT: Partial<Record<Cell, string>> = {
  own: "Own",
  "not-owners": "Not owners",
}

const title = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, " ")

// Derived from the roles the server enforces (Ruling R12), so it can't drift.
export function PermissionMatrix() {
  const rows = permissionMatrix()
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {ROLE_NAMES.map((role) => (
          <div key={role}>
            <dt className="inline font-semibold">{ROLE_LABELS[role]}: </dt>
            <dd className="inline text-muted-foreground">
              {ROLE_PURPOSE[role]}
            </dd>
          </div>
        ))}
      </dl>
      <div className="rounded-card overflow-x-auto bg-card">
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="sr-only">What each role can do</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="h-12 px-4 font-semibold">
                Area and action
              </th>
              {ROLE_NAMES.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="h-12 px-2 text-center font-semibold"
                >
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.resource}.${row.action}`}
                className="border-t border-border"
              >
                <th scope="row" className="px-4 py-2 text-left font-normal">
                  <span className="font-semibold">{title(row.resource)}</span>{" "}
                  <span className="text-muted-foreground">
                    {title(row.action).toLowerCase()}
                  </span>
                </th>
                {ROLE_NAMES.map((role) => {
                  const cell = row.cells[role]
                  return (
                    <td key={role} className="px-2 py-2 text-center">
                      <span className="sr-only">{WORDS[cell]}</span>
                      <span
                        aria-hidden
                        className="inline-flex items-center justify-center text-xs"
                      >
                        {cell === "yes" ? (
                          <CheckIcon className="text-success size-4" />
                        ) : cell === "no" ? (
                          <MinusIcon className="size-4 text-muted-foreground" />
                        ) : (
                          <span className="bg-warning-soft text-warning rounded-full px-2 py-0.5 font-semibold whitespace-nowrap">
                            {SHORT[cell]}
                          </span>
                        )}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  describeIssue,
  fixAll,
  fixIssue,
  pairRatings,
  tokenLabel,
} from "@/lib/theme/checks"
import type { ThemeConfigValue } from "@/lib/theme/schema"
import { cn } from "@/lib/utils"

const BADGE = { AAA: "AAA", AA: "AA", fail: "Fails" } as const
const MODE = { site: "", "admin-light": "Light · ", "admin-dark": "Dark · " }

export function ContrastPanel({
  config,
  scope,
  onChange,
}: {
  config: ThemeConfigValue
  scope: "site" | "admin"
  onChange(config: ThemeConfigValue): void
}) {
  const [stuck, setStuck] = useState<string[]>([])
  const rows = pairRatings(config).filter((r) =>
    scope === "site" ? r.scope === "site" : r.scope !== "site"
  )
  const failing = rows.filter((r) => r.rating === "fail").length
  const key = (r: (typeof rows)[number]) => `${r.scope}:${r.text}:${r.surface}`

  return (
    <section
      aria-label="Contrast"
      className="rounded-card flex flex-col gap-3 bg-card p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-card-title">Contrast</h2>
        <Button
          type="button"
          variant="outline"
          disabled={failing === 0}
          onClick={() => onChange(fixAll(config).config)}
        >
          Fix all
        </Button>
      </div>
      <ul className="flex flex-col divide-y">
        {rows.map((row) => {
          const failed = row.rating === "fail"
          return (
            <li key={key(row)} className="flex flex-col gap-1 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>
                  {MODE[row.scope]}
                  {tokenLabel(row.scope, row.text)} on{" "}
                  {tokenLabel(row.scope, row.surface)}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums">{row.ratio.toFixed(2)}</span>
                  <Badge
                    variant={failed ? "destructive" : "secondary"}
                    className={cn(!failed && "bg-success-soft text-success")}
                  >
                    {BADGE[row.rating]}
                  </Badge>
                </span>
              </div>
              {failed ? (
                <div className="text-danger flex flex-wrap items-center justify-between gap-2">
                  <p>{describeIssue(row)}</p>
                  {stuck.includes(key(row)) ? (
                    <span className="text-muted-foreground">
                      Pick a different colour
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const next = fixIssue(config, row)
                        if (next) onChange(next)
                        else setStuck((s) => [...s, key(row)])
                      }}
                    >
                      Fix automatically
                    </Button>
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

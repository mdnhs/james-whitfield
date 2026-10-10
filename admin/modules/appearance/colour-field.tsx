"use client"

import { LockIcon, LockOpenIcon } from "lucide-react"
import { useId, useState } from "react"
import { HexColorPicker } from "react-colorful"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatOklch, parseColor, toHex, type Oklch } from "@/lib/theme/color"
import { cn } from "@/lib/utils"

const INVALID = "Use a #rrggbb or oklch(L C H) colour"

// A stored value, or the resolved fallback while nothing is stored. Emits
// canonical oklch() strings only; typed text commits on blur or Enter.
export function ColourField({
  label,
  value,
  fallback,
  onChange,
  lock,
  clearable,
}: {
  label: string
  value: string | null
  fallback: Oklch
  onChange(value: string | null): void
  lock?: { locked: boolean; onToggle(): void }
  clearable?: boolean
}) {
  const id = useId()
  const current = (value && parseColor(value)) || fallback
  const hex = toHex(current)
  const [typed, setTyped] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const commit = () => {
    if (typed === null) return
    const parsed = parseColor(typed)
    if (!parsed) return setError(true)
    setError(false)
    setTyped(null)
    onChange(formatOklch(parsed))
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={`Open the ${label} picker`}
                className="size-9 shrink-0 rounded-lg border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                style={{ backgroundColor: hex }}
              />
            }
          />
          <PopoverContent align="start" className="w-auto items-center p-3">
            <HexColorPicker
              color={hex}
              onChange={(next) => {
                const parsed = parseColor(next)
                if (!parsed) return
                setTyped(null)
                setError(false)
                onChange(formatOklch(parsed))
              }}
            />
          </PopoverContent>
        </Popover>
        <Input
          id={id}
          value={typed ?? hex}
          aria-invalid={error || undefined}
          aria-describedby={`${id}-readout`}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 font-mono"
          onChange={(event) => {
            setTyped(event.target.value)
            setError(false)
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              commit()
            }
          }}
        />
        {clearable && value ? (
          <Button type="button" variant="ghost" onClick={() => onChange(null)}>
            Clear
          </Button>
        ) : null}
        {lock ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Lock ${label}`}
            aria-pressed={lock.locked}
            onClick={lock.onToggle}
          >
            {lock.locked ? (
              <LockIcon aria-hidden />
            ) : (
              <LockOpenIcon aria-hidden />
            )}
          </Button>
        ) : null}
      </div>
      <p
        id={`${id}-readout`}
        className={cn(
          "truncate text-xs",
          error ? "text-danger" : "text-muted-foreground"
        )}
      >
        {error ? INVALID : `${formatOklch(current)} · ${hex}`}
      </p>
    </div>
  )
}

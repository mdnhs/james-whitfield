"use client"

import { buildAdminTokens } from "@/lib/theme/admin"
import { toHex } from "@/lib/theme/color"
import { PRESET_IDS, PRESETS, type PresetId } from "@/lib/theme/presets"
import { ThemeConfig } from "@/lib/theme/schema"
import { presetSiteTheme, resolveSiteTokens } from "@/lib/theme/site"
import { cn } from "@/lib/utils"

function swatches(scope: "site" | "admin", id: PresetId): string[] {
  if (scope === "site") {
    const t = resolveSiteTokens(presetSiteTheme(id))
    return [t.brand, t.cream, t.clay].map(toHex)
  }
  const t = buildAdminTokens(
    ThemeConfig.parse({ admin: { preset: id } }).admin,
    "light"
  )
  return [t.primary, t.background, t.accent].map(toHex)
}

export function PresetGallery({
  scope,
  value,
  onPick,
}: {
  scope: "site" | "admin"
  value: PresetId
  onPick(id: PresetId): void
}) {
  return (
    <div
      role="group"
      aria-label={`${scope === "site" ? "Site" : "Admin"} presets`}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
    >
      {PRESET_IDS.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onPick(id)}
          className={cn(
            "flex flex-col gap-2 rounded-xl border bg-card p-3 text-left text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            value === id
              ? "border-primary ring-2 ring-primary"
              : "hover:bg-muted"
          )}
        >
          <span aria-hidden className="flex">
            {swatches(scope, id).map((hex, i) => (
              <span
                key={i}
                className="-ml-1 size-6 rounded-full border first:ml-0"
                style={{ backgroundColor: hex }}
              />
            ))}
          </span>
          {PRESETS[id].label}
        </button>
      ))}
    </div>
  )
}

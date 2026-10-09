"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const subscribe = () => () => {}

// The saved choice only exists in the browser; render after mount so the
// server and client never disagree about which item is pressed.
export function ThemePreference() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
  const { theme, setTheme } = useTheme()
  if (!mounted) return <Skeleton className="h-9 w-64" />
  return (
    <ToggleGroup
      aria-label="Theme"
      value={[theme ?? "system"]}
      onValueChange={(value) => {
        if (value[0]) setTheme(String(value[0]))
      }}
      variant="outline"
    >
      <ToggleGroupItem value="light">
        <SunIcon aria-hidden /> Light
      </ToggleGroupItem>
      <ToggleGroupItem value="dark">
        <MoonIcon aria-hidden /> Dark
      </ToggleGroupItem>
      <ToggleGroupItem value="system">
        <MonitorIcon aria-hidden /> System
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

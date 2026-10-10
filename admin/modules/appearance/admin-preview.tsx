"use client"

import { useTheme } from "next-themes"
import { useEffect } from "react"

import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { liveDeclarations } from "@/lib/theme/css"
import type { AdminThemeConfig } from "@/lib/theme/schema"

import { applyLive } from "./live-tokens"

const CHARTS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
]

// While mounted, the draft is the admin itself (inline on <html>, which beats
// the published <style>). The cleanup returns the page to the published one.
export function useLiveAdmin(admin: AdminThemeConfig) {
  const { resolvedTheme } = useTheme()
  const mode = resolvedTheme === "dark" ? "dark" : "light"
  useEffect(
    () => applyLive(document.documentElement, liveDeclarations(admin, mode)),
    [admin, mode]
  )
}

export function AdminPreview() {
  return (
    <Card aria-label="Admin preview" role="group">
      <CardHeader>
        <CardTitle>Admin preview</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button">Primary</Button>
          <Button type="button" variant="secondary">
            Secondary
          </Button>
          <Button type="button" variant="outline">
            Outline
          </Button>
          <Badge>Badge</Badge>
        </div>
        <Input aria-label="Sample input" defaultValue="Sample text" />
        <label className="flex items-center gap-2 text-sm">
          <Switch defaultChecked aria-label="Sample switch" /> Switch
        </label>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="success">Published</StatusPill>
          <StatusPill tone="warning">In progress</StatusPill>
          <StatusPill tone="danger">Failed</StatusPill>
        </div>
        <div aria-hidden className="flex gap-2">
          {CHARTS.map((swatch) => (
            <span key={swatch} className={`h-8 flex-1 rounded-md ${swatch}`} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

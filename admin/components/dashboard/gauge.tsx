"use client"

import { useId } from "react"
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts"

import { useReducedMotion } from "@/admin/lib/use-reduced-motion"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

import { gaugeSummary, type GaugePart } from "./chart-math"
import { formatNumber, formatPercent } from "./format"

const SWATCH: Record<GaugePart["tone"], string> = {
  solid: "bg-chart-2",
  dark: "bg-chart-4",
  hatched: "bg-hatch",
}

// Semicircle of stacked solid, dark and hatched arcs with a big centred
// percentage and a legend (docs/brief.md §9.2, signature component 4).
export function Gauge({
  title,
  parts,
  centerLabel,
  headlineKey,
}: {
  title: string
  parts: readonly GaugePart[]
  // Says what the percentage is, e.g. "Complete".
  centerLabel: string
  // Key of the part whose share is the centred percentage. Defaults to the
  // first part.
  headlineKey?: string
}) {
  const hatchId = `gauge-hatch-${useId().replace(/:/g, "")}`
  const reduced = useReducedMotion()
  const summary = gaugeSummary(parts, headlineKey)
  const fill: Record<GaugePart["tone"], string> = {
    solid: "var(--chart-2)",
    dark: "var(--chart-4)",
    hatched: `url(#${hatchId})`,
  }
  const row: Record<string, number> = summary.total
    ? Object.fromEntries(summary.parts.map((part) => [part.key, part.value]))
    : { empty: 1 }
  const config = Object.fromEntries(
    summary.parts.map((part) => [part.key, { label: part.label }])
  ) satisfies ChartConfig

  return (
    <figure className="flex flex-1 flex-col items-center justify-center gap-5">
      <div className="relative w-full max-w-sm">
        <ChartContainer
          config={config}
          className="aspect-[2/1] w-full"
          aria-hidden
        >
          <RadialBarChart
            data={[row]}
            startAngle={180}
            endAngle={0}
            cy="100%"
            innerRadius="150%"
            outerRadius="200%"
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            accessibilityLayer={false}
          >
            <defs>
              <pattern
                id={hatchId}
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect
                  width="8"
                  height="8"
                  fill="var(--hatch)"
                  fillOpacity={0.25}
                />
                <rect width="3.5" height="8" fill="var(--hatch)" />
              </pattern>
            </defs>
            {/* The arcs together span the half circle exactly. */}
            <PolarAngleAxis
              type="number"
              domain={[0, summary.total || 1]}
              tick={false}
              axisLine={false}
            />
            {summary.total ? (
              summary.parts.map((part) => (
                <RadialBar
                  key={part.key}
                  dataKey={part.key}
                  stackId="gauge"
                  fill={fill[part.tone]}
                  cornerRadius={12}
                  // A card-coloured edge opens the small gap between arcs.
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={!reduced}
                />
              ))
            ) : (
              <RadialBar
                dataKey="empty"
                // A neutral track: nothing to measure yet.
                fill="var(--skeleton)"
                cornerRadius={12}
                isAnimationActive={false}
              />
            )}
          </RadialBarChart>
        </ChartContainer>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <p className="text-kpi tabular-nums">
            {formatPercent(summary.ratio)}
          </p>
          <p className="text-sm text-muted-foreground">{centerLabel}</p>
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Part</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          {summary.parts.map((part) => (
            <tr key={part.key}>
              <th scope="row">{part.label}</th>
              <td>{part.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Last child of the figure: a figcaption must be first or last. */}
      <figcaption>
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium">
          {summary.parts.map((part) => (
            <li key={part.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn("size-4 rounded-full", SWATCH[part.tone])}
              />
              {part.label}
              <span className="text-muted-foreground tabular-nums">
                {formatNumber(part.value)}
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}

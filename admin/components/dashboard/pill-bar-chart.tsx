"use client"

import { useId } from "react"
import {
  Bar,
  BarChart,
  Rectangle,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts"

import { useReducedMotion } from "@/admin/lib/use-reduced-motion"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

import { peakIndex } from "./chart-math"
import { formatNumber } from "./format"

// At least 1, so an all-zero week keeps a real scale instead of [0, 0].
const maxDomain = (dataMax: number) => Math.max(1, dataMax)

export type PillBarDatum = {
  key: string
  label: string
  current: number
  previous: number
}

// Capsule bars, hatched for the comparison period, with a floating value
// tag on the busiest bar (docs/brief.md §9.2, signature component 3). The
// SVG is hidden from assistive tech; the table below carries the numbers.
export function PillBarChart({
  title,
  data,
  currentLabel,
  previousLabel,
}: {
  title: string
  data: readonly PillBarDatum[]
  currentLabel: string
  previousLabel: string
}) {
  const hatchId = `hatch-${useId().replace(/:/g, "")}`
  const reduced = useReducedMotion()
  const currents = data.map((datum) => datum.current)
  // A quiet week (all zeros) has no busiest day, so no tag.
  const busiest = peakIndex(currents)
  const peak = (currents[busiest] ?? 0) > 0 ? busiest : -1
  const config = {
    current: { label: currentLabel, color: "var(--chart-2)" },
    previous: { label: previousLabel, color: "var(--hatch)" },
  } satisfies ChartConfig

  return (
    <figure className="flex flex-col gap-4">
      <ChartContainer
        config={config}
        className="aspect-auto h-72 w-full"
        aria-hidden
      >
        <BarChart
          data={[...data]}
          barGap={4}
          barCategoryGap="14%"
          margin={{ top: 44, right: 4, bottom: 0, left: 4 }}
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
                fill="var(--color-previous)"
                fillOpacity={0.25}
              />
              <rect width="3.5" height="8" fill="var(--color-previous)" />
            </pattern>
          </defs>
          {/* Tallest bar meets the top margin, which the value tag uses. */}
          <YAxis hide domain={[0, maxDomain]} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <Bar
            dataKey="previous"
            fill={`url(#${hatchId})`}
            radius={999}
            isAnimationActive={!reduced}
          />
          <Bar
            dataKey="current"
            fill="var(--color-current)"
            radius={999}
            isAnimationActive={!reduced}
            shape={(props: BarShapeProps) => (
              <PillWithTag {...props} showTag={props.index === peak} />
            )}
          />
        </BarChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">{currentLabel}</th>
            <th scope="col">{previousLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.key}>
              <th scope="row">{datum.label}</th>
              <td>{datum.current}</td>
              <td>{datum.previous}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Last child of the figure: a figcaption must be first or last. */}
      <figcaption className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full bg-chart-2" />
          {currentLabel}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="bg-hatch size-3 rounded-full" />
          {previousLabel}
        </span>
      </figcaption>
    </figure>
  )
}

function PillWithTag({
  showTag,
  ...props
}: BarShapeProps & { showTag: boolean }) {
  const { x, y, width, height, fill } = props
  const value = formatNumber((props.payload as PillBarDatum).current)
  const tagWidth = Math.max(36, value.length * 8 + 18)
  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        radius={999}
      />
      {showTag ? (
        <g transform={`translate(${x + width / 2}, ${y - 10})`}>
          <rect
            x={-tagWidth / 2}
            y={-26}
            width={tagWidth}
            height={22}
            rx={8}
            fill="var(--accent)"
            stroke="var(--chart-3)"
          />
          <text
            y={-11}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="var(--accent-foreground)"
          >
            {value}
          </text>
          <circle
            r={4}
            fill="var(--card)"
            stroke="var(--color-current)"
            strokeWidth={2}
          />
        </g>
      ) : null}
    </g>
  )
}

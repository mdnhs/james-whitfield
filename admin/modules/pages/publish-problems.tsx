import { TriangleAlertIcon } from "lucide-react"

import type { PublishProblem } from "./builder-state"

const DEVELOPER = "This page has a layout problem a developer needs to fix: "

// Every error a failed publish reported, including those on hidden
// sections and anchors, which no block form shows.
export function PublishProblems({ problems }: { problems: PublishProblem[] }) {
  if (problems.length === 0) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
    >
      <TriangleAlertIcon
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold">This page can&apos;t be published yet.</p>
        <ul className="list-disc space-y-1 pl-4">
          {problems.map((problem, i) => (
            <li key={i}>
              {problem.developer ? `${DEVELOPER}${problem.text}` : problem.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

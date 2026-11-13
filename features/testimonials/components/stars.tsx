const STAR =
  "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z"

// Five stars filled in proportion to `value` (halves allowed). The row is
// decorative; callers give it a label where it carries meaning.
export function Stars({
  value,
  className = "size-4",
}: {
  value: number
  className?: string
}) {
  return (
    <span aria-hidden className="inline-flex gap-0.5 text-clay">
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.round(Math.min(1, Math.max(0, value - i)) * 100)
        return (
          <svg key={i} viewBox="0 0 24 24" className={className}>
            <path d={STAR} className="fill-current opacity-25" />
            <svg
              viewBox="0 0 24 24"
              width={`${fill}%`}
              height="24"
              overflow="hidden"
            >
              <path d={STAR} className="fill-current" />
            </svg>
          </svg>
        )
      })}
    </span>
  )
}

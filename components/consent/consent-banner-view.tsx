import type { GlobalValue } from "@/lib/content/globals"
import type { ConsentChoice } from "@/lib/tracking/consent"

export type ConsentCopy = Pick<
  GlobalValue<"consent">,
  | "title"
  | "body"
  | "accept"
  | "reject"
  | "customise"
  | "save"
  | "policyLabel"
  | "policyHref"
  | "categories"
>

// Same class for every choice: equal prominence (no primary styling).
const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-(--color-pine) bg-(--color-cream) px-6 text-sm font-semibold text-(--color-pine) transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-pine) motion-reduce:transition-none"

const ROWS = [
  ["necessary", "Necessary"],
  ["analytics", "Analytics"],
  ["marketing", "Marketing"],
] as const

export function ConsentBannerView({
  copy,
  mode,
  choice,
  onAccept,
  onReject,
  onCustomise,
  onSave,
  onToggle,
  headingRef,
  inline,
}: {
  copy: ConsentCopy
  mode: "first" | "custom"
  choice: ConsentChoice
  onAccept: () => void
  onReject: () => void
  onCustomise: () => void
  onSave: () => void
  onToggle: (category: "analytics" | "marketing", on: boolean) => void
  headingRef?: React.Ref<HTMLHeadingElement>
  // Admin preview: positioned inside its box instead of the viewport.
  inline?: boolean
}) {
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="mk-consent-title"
      aria-describedby="mk-consent-body"
      className={`${inline ? "absolute" : "fixed"} inset-x-0 bottom-0 z-50`}
    >
      <div className="mx-auto w-full max-w-360 px-4 pb-4 sm:px-6 lg:px-16.5">
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-2xl border border-(--color-line) bg-(--color-cream) p-5 text-(--color-pine) shadow-lg sm:p-6">
          <h2
            id="mk-consent-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-(family-name:--font-display) text-xl outline-none"
          >
            {copy.title}
          </h2>
          <p id="mk-consent-body" className="text-sm leading-relaxed">
            {copy.body}
            {copy.policyHref ? (
              <>
                {" "}
                <a href={copy.policyHref} className="underline">
                  {copy.policyLabel}
                </a>
              </>
            ) : null}
          </p>
          {mode === "custom" ? (
            <div className="flex flex-col gap-3">
              {ROWS.map(([key, name]) => (
                <label
                  key={key}
                  className="flex min-h-11 items-start gap-3 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 accent-(--color-pine)"
                    checked={key === "necessary" ? true : choice[key]}
                    disabled={key === "necessary"}
                    onChange={
                      key === "necessary"
                        ? undefined
                        : (e) => onToggle(key, e.target.checked)
                    }
                  />
                  <span>
                    <span className="font-semibold">{name}</span>
                    <br />
                    {copy.categories[key]}
                  </span>
                </label>
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            {mode === "first" ? (
              <>
                <button type="button" className={BUTTON} onClick={onAccept}>
                  {copy.accept}
                </button>
                <button type="button" className={BUTTON} onClick={onReject}>
                  {copy.reject}
                </button>
                <button type="button" className={BUTTON} onClick={onCustomise}>
                  {copy.customise}
                </button>
              </>
            ) : (
              <>
                <button type="button" className={BUTTON} onClick={onSave}>
                  {copy.save}
                </button>
                <button type="button" className={BUTTON} onClick={onReject}>
                  {copy.reject}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

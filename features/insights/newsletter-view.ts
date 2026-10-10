import type { GlobalView } from "@/lib/content/types"

// What the browser may receive: the confirmation email and the state-page copy
// are server-side (or page-level) content and never ship in the band's props.
export type NewsletterView = Omit<
  GlobalView<"newsletter">,
  "confirmationEmail" | "pages"
>

export function toNewsletterView(
  global: GlobalView<"newsletter">
): NewsletterView {
  const view: Partial<GlobalView<"newsletter">> = { ...global }
  delete view.confirmationEmail
  delete view.pages
  return view as NewsletterView
}

import Link from "next/link"

import { Container } from "@/components/layout/container"

import { UnsubscribeForm } from "./unsubscribe-form"

type Copy = { title: string; body: string }
type Props =
  | { state: "confirmed" | "invalid" | "unsubscribed"; copy: Copy }
  | {
      state: "unsubscribe"
      copy: Copy & { button: string }
      invalid: Copy
    }

// Landing pages for the newsletter links in an email. Static copy from the
// newsletter global; nothing here depends on who is looking.
export function NewsletterState(props: Props) {
  const { copy } = props
  return (
    <section aria-labelledby="newsletter-state-heading" className="py-32">
      <Container>
        <div className="mx-auto flex max-w-150 flex-col items-center gap-6 text-center">
          <h1
            id="newsletter-state-heading"
            className="font-display text-[34px] leading-[1.15] font-bold text-pine sm:text-[50px]"
          >
            {copy.title}
          </h1>
          <p className="text-base leading-[1.5] text-pine">{copy.body}</p>
          {props.state === "unsubscribe" ? (
            <UnsubscribeForm
              button={props.copy.button}
              invalid={props.invalid}
            />
          ) : null}
          <Link
            href="/"
            className="text-[15px] font-semibold text-moss underline underline-offset-4"
          >
            Back to the homepage
          </Link>
        </div>
      </Container>
    </section>
  )
}

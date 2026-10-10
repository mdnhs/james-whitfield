import { Button, Link, Text } from "react-email"

import { EmailLayout } from "./layout"
import { theme } from "./theme"

export type NewsletterConfirmationProps = {
  confirmUrl: string
  unsubscribeUrl: string
  subject: string
  body: string
}

export const subject = ({
  subject,
}: Pick<NewsletterConfirmationProps, "subject">) => subject

export default function NewsletterConfirmation(
  props: NewsletterConfirmationProps
) {
  const paragraphs = props.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  return (
    <EmailLayout
      preview={props.subject}
      title={props.subject}
      footer={<Link href={props.unsubscribeUrl}>Unsubscribe</Link>}
    >
      {paragraphs.map((p, i) => (
        <Text key={i} style={{ whiteSpace: "pre-wrap" }}>
          {p}
        </Text>
      ))}
      <Button href={props.confirmUrl} style={theme.button}>
        Confirm my subscription
      </Button>
    </EmailLayout>
  )
}

NewsletterConfirmation.PreviewProps = {
  subject: "Please confirm your subscription",
  body: "Thanks for signing up. Please confirm your email address.",
  confirmUrl: "http://localhost:3000/newsletter/confirm?token=t",
  unsubscribeUrl: "http://localhost:3000/newsletter/unsubscribe?token=u",
} satisfies NewsletterConfirmationProps

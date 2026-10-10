import { Link, Text } from "react-email"

import { EmailLayout } from "./layout"

export type EnquiryAutoReplyProps = {
  name: string
  subject: string
  body: string
  unsubscribeUrl?: string
}

export const subject = ({ subject }: Pick<EnquiryAutoReplyProps, "subject">) =>
  subject

// `{name}` in the editable copy is replaced by the visitor's name.
export const fillName = (body: string, name: string) =>
  body.replaceAll("{name}", name)

export default function EnquiryAutoReply(props: EnquiryAutoReplyProps) {
  const paragraphs = fillName(props.body, props.name)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  return (
    <EmailLayout
      preview={props.subject}
      title={props.subject}
      footer={
        props.unsubscribeUrl ? (
          <Link href={props.unsubscribeUrl}>Unsubscribe</Link>
        ) : undefined
      }
    >
      {paragraphs.map((p, i) => (
        <Text key={i} style={{ whiteSpace: "pre-wrap" }}>
          {p}
        </Text>
      ))}
    </EmailLayout>
  )
}

EnquiryAutoReply.PreviewProps = {
  name: "Ann Example",
  subject: "Thanks for getting in touch",
  body: "Hi {name},\n\nThanks for your enquiry. I will reply within two working days.",
  unsubscribeUrl: "http://localhost:3000/newsletter/unsubscribe?token=u",
} satisfies EnquiryAutoReplyProps

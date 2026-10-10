import { Button, Text } from "react-email"

import { EmailLayout } from "./layout"
import { theme } from "./theme"

export type DeliveryFailureKind = "notification" | "auto_reply"

export type DeliveryFailureProps = {
  kind: DeliveryFailureKind
  leadUrl: string
  occurredAt: Date
}

const KIND_LABEL: Record<DeliveryFailureKind, string> = {
  notification: "the new-enquiry notification",
  auto_reply: "the auto-reply to the visitor",
}

export const subject = ({ kind }: Pick<DeliveryFailureProps, "kind">) =>
  `Email delivery failed: ${KIND_LABEL[kind]}`

export default function DeliveryFailure(props: DeliveryFailureProps) {
  return (
    <EmailLayout preview={subject(props)} title="Email delivery failed">
      <Text>
        We could not send {KIND_LABEL[props.kind]} (at{" "}
        {props.occurredAt.toISOString()}). The enquiry itself is saved. Open it
        in the admin to follow up.
      </Text>
      <Button href={props.leadUrl} style={theme.button}>
        Open the enquiry
      </Button>
    </EmailLayout>
  )
}

DeliveryFailure.PreviewProps = {
  kind: "notification",
  leadUrl: "http://localhost:3000/admin/leads?lead=1",
  occurredAt: new Date("2026-01-01T10:00:00Z"),
} satisfies DeliveryFailureProps

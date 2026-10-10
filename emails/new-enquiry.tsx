import { Button, Text } from "react-email"

import { EmailLayout } from "./layout"
import { theme } from "./theme"

export type NewEnquiryProps = {
  name: string
  email: string
  phone: string | null
  topic: string
  format: string | null
  plan: string | null
  message?: string
  adminUrl: string
}

export const subject = ({ name }: Pick<NewEnquiryProps, "name">) =>
  `New enquiry from ${name}`

export default function NewEnquiry(props: NewEnquiryProps) {
  const rows: [string, string | null][] = [
    ["Name", props.name],
    ["Email", props.email],
    ["Phone", props.phone],
    ["Topic", props.topic],
    ["Preferred format", props.format],
    ["Plan", props.plan],
  ]
  return (
    <EmailLayout preview={subject(props)} title="New enquiry">
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <Text key={label} style={{ margin: "4px 0" }}>
            <strong>{label}:</strong> {value}
          </Text>
        ))}
      {props.message !== undefined && (
        <Text style={{ whiteSpace: "pre-wrap" }}>{props.message}</Text>
      )}
      <Button href={props.adminUrl} style={theme.button}>
        Open in the admin
      </Button>
    </EmailLayout>
  )
}

NewEnquiry.PreviewProps = {
  name: "Ann Example",
  email: "ann@example.com",
  phone: "+353 87 123 4567",
  topic: "Anxiety",
  format: "Online",
  plan: null,
  adminUrl:
    "http://localhost:3000/admin/leads?lead=00000000-0000-4000-8000-000000000001",
} satisfies NewEnquiryProps

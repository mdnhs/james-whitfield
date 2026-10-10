import { Button, Text } from "react-email"

import { EmailLayout } from "./layout"
import { theme } from "./theme"

export type InviteProps = { name: string; url: string }

export const subject = () => "You're invited to the Magda Kennedy admin"

export default function Invite({ name, url }: InviteProps) {
  return (
    <EmailLayout
      preview="Choose a password to get started"
      title="You're invited"
    >
      <Text>Hi {name},</Text>
      <Text>
        You now have access to the website admin. Choose a password to get
        started. The link works for 24 hours.
      </Text>
      <Button href={url} style={theme.button}>
        Set your password
      </Button>
    </EmailLayout>
  )
}

Invite.PreviewProps = {
  name: "Ann Example",
  url: "http://localhost:3000/admin/reset-password/token",
} satisfies InviteProps

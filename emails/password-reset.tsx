import { Button, Text } from "react-email"

import { EmailLayout } from "./layout"
import { theme } from "./theme"

export type PasswordResetProps = { name: string; url: string }

export const subject = () => "Reset your admin password"

export default function PasswordReset({ name, url }: PasswordResetProps) {
  return (
    <EmailLayout
      preview="Reset your admin password"
      title="Reset your password"
    >
      <Text>Hi {name},</Text>
      <Text>
        Someone asked to reset your password. If it was you, use the button
        below; the link works for 24 hours. If it wasn&apos;t, you can ignore
        this email.
      </Text>
      <Button href={url} style={theme.button}>
        Reset password
      </Button>
    </EmailLayout>
  )
}

PasswordReset.PreviewProps = {
  name: "Ann Example",
  url: "http://localhost:3000/admin/reset-password/token",
} satisfies PasswordResetProps

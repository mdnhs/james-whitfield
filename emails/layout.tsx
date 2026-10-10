import type { ReactNode } from "react"
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "react-email"

import { theme } from "./theme"

export function EmailLayout({
  preview,
  title,
  children,
  footer,
}: {
  preview: string
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={theme.body}>
        <Container style={theme.container}>
          <Heading as="h1" style={theme.heading}>
            {title}
          </Heading>
          {children}
          {footer ? (
            <>
              <Hr />
              <Text style={theme.footer}>{footer}</Text>
            </>
          ) : null}
        </Container>
      </Body>
    </Html>
  )
}

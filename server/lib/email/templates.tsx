import "server-only"

import { render } from "react-email"

import DeliveryFailure, {
  type DeliveryFailureProps,
  subject as deliveryFailureSubject,
} from "@/emails/delivery-failure"
import EnquiryAutoReply, {
  type EnquiryAutoReplyProps,
  fillName,
  subject as autoReplySubject,
} from "@/emails/enquiry-auto-reply"
import Invite, {
  type InviteProps,
  subject as inviteSubject,
} from "@/emails/invite"
import NewEnquiry, {
  type NewEnquiryProps,
  subject as newEnquirySubject,
} from "@/emails/new-enquiry"
import NewsletterConfirmation, {
  type NewsletterConfirmationProps,
  subject as newsletterSubject,
} from "@/emails/newsletter-confirmation"
import PasswordReset, {
  type PasswordResetProps,
  subject as resetSubject,
} from "@/emails/password-reset"

type Rendered = { subject: string; html: string; text: string }

async function renderBoth(
  subject: string,
  element: React.ReactElement
): Promise<Rendered> {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ])
  return { subject, html, text }
}

export const inviteEmail = (props: InviteProps) =>
  renderBoth(inviteSubject(), <Invite {...props} />)

export const passwordResetEmail = (props: PasswordResetProps) =>
  renderBoth(resetSubject(), <PasswordReset {...props} />)

// The visitor's message is left out unless the admin switched it on: mail
// travels through third parties, so by default only a link back is sent.
export const newEnquiryEmail = ({
  includeMessage,
  message,
  ...props
}: Omit<NewEnquiryProps, "message"> & {
  message: string | undefined
  includeMessage: boolean
}) =>
  renderBoth(
    newEnquirySubject(props),
    <NewEnquiry {...props} message={includeMessage ? message : undefined} />
  )

export const enquiryAutoReplyEmail = (props: EnquiryAutoReplyProps) =>
  renderBoth(
    fillName(autoReplySubject(props), props.name),
    <EnquiryAutoReply {...props} />
  )

export const newsletterConfirmationEmail = (
  props: NewsletterConfirmationProps
) => renderBoth(newsletterSubject(props), <NewsletterConfirmation {...props} />)

export const deliveryFailureEmail = (props: DeliveryFailureProps) =>
  renderBoth(deliveryFailureSubject(props), <DeliveryFailure {...props} />)

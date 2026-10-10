// The typed dataLayer (docs/brief.md §12.4). Pushing is always allowed; GTM
// gates tags by consent. Never put personal or health data in params.
export type TrackEvent =
  | {
      event: "virtual_page_view"
      params: { page_location: string; page_path: string; page_title: string }
    }
  | {
      event: "generate_lead"
      params: { lead_source: "contact_form"; form_id: string }
      eventId: string
    }
  | { event: "contact_click"; params: { method: "phone" | "email" } }
  | { event: "book_appointment"; params: { cta_location: string } }
  | { event: "sign_up"; params: { method: "newsletter" } }
  | { event: "share"; params: { method: string; content_type: "article" } }

export type TrackEventName = TrackEvent["event"]

export const EVENT_CATALOGUE = [
  {
    event: "virtual_page_view",
    firesWhen: "each pathname change",
    params: ["page_location", "page_path", "page_title"],
    ga4: "page_view",
    meta: "PageView (allowlisted routes)",
  },
  {
    event: "generate_lead",
    firesWhen: "the API accepted the enquiry",
    params: ["lead_source", "form_id", "event_id"],
    ga4: "generate_lead (key event)",
    meta: "Lead, deduplicated with CAPI via event_id",
  },
  {
    event: "contact_click",
    firesWhen: "phone or email links",
    params: ["method", "event_id"],
    ga4: "custom",
    meta: "Contact",
  },
  {
    event: "book_appointment",
    firesWhen: '"Book a discovery call" CTAs',
    params: ["cta_location", "event_id"],
    ga4: "custom",
    meta: "Schedule",
  },
  {
    event: "sign_up",
    firesWhen: "newsletter double opt-in requested",
    params: ["method", "event_id"],
    ga4: "sign_up",
    meta: "CompleteRegistration",
  },
  {
    event: "share",
    firesWhen: "share link or copy",
    params: ["method", "content_type"],
    ga4: "share",
    meta: "—",
  },
] as const satisfies readonly {
  event: TrackEventName
  firesWhen: string
  params: readonly string[]
  ga4: string
  meta: string
}[]

export const META_EVENT: Partial<Record<TrackEventName, string>> = {
  virtual_page_view: "PageView",
  generate_lead: "Lead",
  contact_click: "Contact",
  book_appointment: "Schedule",
  sign_up: "CompleteRegistration",
}

const MAX_VALUE = 100
const cap = (params: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, v.slice(0, MAX_VALUE)])
  )

export function pushEvent(
  dataLayer: unknown[],
  e: TrackEvent,
  newId: () => string
): { eventId: string | undefined } {
  const eventId =
    e.event === "share"
      ? undefined
      : e.event === "generate_lead"
        ? e.eventId
        : newId()
  dataLayer.push({ event_params: null })
  dataLayer.push({
    event: e.event,
    event_params: {
      ...cap(e.params as Record<string, string>),
      ...(eventId ? { event_id: eventId } : {}),
    },
  })
  return { eventId }
}

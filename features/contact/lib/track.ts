type DataLayerWindow = Window & { dataLayer?: unknown[] }

// Ruling R16: plumbing only. GTM and consent arrive in Phase 8; until then
// nothing defines dataLayer and this is a no-op.
export function trackLead(eventId: string) {
  const w = window as DataLayerWindow
  if (Array.isArray(w.dataLayer))
    w.dataLayer.push({ event: "generate_lead", event_id: eventId })
}

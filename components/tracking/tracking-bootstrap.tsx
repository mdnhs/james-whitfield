// Server-rendered only. React does not execute an inline script it creates on
// the client, and SiteFrame lives in the root layout, which a client
// navigation never re-creates: the script runs exactly once per document.
export function TrackingBootstrap({ script }: { script: string }) {
  return (
    <script id="mk-tracking" dangerouslySetInnerHTML={{ __html: script }} />
  )
}

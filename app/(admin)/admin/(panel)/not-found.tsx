import Link from "next/link"

export default function PanelNotFound() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-card-title">That page doesn&apos;t exist</h1>
      <p className="text-sm text-muted-foreground">
        Check the address, or use the menu to find what you need.
      </p>
      <Link
        href="/admin"
        className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        Back to the dashboard
      </Link>
    </section>
  )
}

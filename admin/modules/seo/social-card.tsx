export function SocialCard({
  siteHost,
  title,
  description,
  imageSrc,
}: {
  siteHost: string
  title: string
  description: string
  imageSrc: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      {/* A plain img: the generated /og/… URL is dynamic. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt="Share image preview"
        className="aspect-[1.91/1] w-full bg-muted object-cover"
      />
      <div className="flex flex-col gap-1 border-t p-3">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          {siteHost}
        </p>
        <p className="line-clamp-1 text-sm font-semibold">{title}</p>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  )
}

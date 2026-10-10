import { OgCardPreview } from "./og-card-preview"

import type { OgColors, OgSubject } from "@/lib/seo/og-card"

export function SocialCard({
  siteHost,
  title,
  description,
  imageSrc,
  card,
}: {
  siteHost: string
  title: string
  description: string
  // An uploaded or generated image URL; without one, `card` is drawn here.
  imageSrc?: string
  card?: OgSubject & { colors: OgColors }
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      {imageSrc || !card ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt="Share image preview"
          className="aspect-[1.91/1] w-full bg-muted object-cover"
        />
      ) : (
        <OgCardPreview {...card} />
      )}
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

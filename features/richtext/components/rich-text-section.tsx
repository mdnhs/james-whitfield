import { Container } from "@/components/layout/container"
import { RichText } from "@/features/insights/components/rich-text"
import type { BlockView } from "@/blocks/media-refs"
import { cn } from "@/lib/utils"

// Legal and custom pages: the article's reading typography in a plain section.
export function RichTextSection({
  id,
  content,
}: {
  id: string
  content: BlockView<"richtext">
}) {
  return (
    <section id={id} className="bg-white py-20 lg:py-30">
      <Container>
        <div
          className={cn(
            "flex flex-col gap-6 text-[17px] leading-[1.75] text-ink-muted",
            content.width === "narrow" ? "max-w-180" : "max-w-260"
          )}
        >
          <RichText doc={content.doc} />
        </div>
      </Container>
    </section>
  )
}

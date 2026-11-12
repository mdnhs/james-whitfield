import type { BlockView } from "@/blocks/media-refs"
import { Container } from "@/components/layout/container"
import { CredentialItem } from "./credential-item"

export function CredibilitySection({
  id,
  content,
}: {
  id: string
  content: BlockView<"credibility">
}) {
  return (
    <section
      id={id}
      aria-label="Credentials"
      className="bg-white pt-6 pb-2 sm:py-10"
    >
      <Container>
        <div className="rounded-[8.455px] sm:py-[25.364px] sm:drop-shadow-[0px_1.057px_1.057px_rgba(0,0,0,0.05)]">
          <ul
            data-motion="deal-group"
            className="grid grid-cols-2 items-start gap-3 sm:gap-6 xl:grid-cols-4 xl:gap-[25.364px] xl:[&>li+li]:border-l xl:[&>li+li]:border-[#e5e2dc] xl:[&>li+li]:pl-[17.966px]"
          >
            {content.badges.map((badge, i) => (
              <CredentialItem key={i} badge={badge} />
            ))}
          </ul>
        </div>
      </Container>
    </section>
  )
}

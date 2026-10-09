import { BrandMark } from "@/admin/components/brand-mark"
import { NOISE } from "@/admin/components/noise"
import { Swirl } from "@/admin/components/swirl"

// Split layout (docs/brief.md §9.3): brand panel left, form panel right.
// Below 1024px only the form panel shows.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="grid min-h-svh gap-4 bg-background p-3 sm:p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section
        aria-hidden
        className="relative isolate hidden flex-col justify-between overflow-hidden rounded-[28px] bg-[linear-gradient(150deg,#0b2f17_0%,#12612b_48%,#16823a_78%,#3f9d5e_100%)] p-10 text-white lg:flex xl:p-12"
      >
        <Swirl className="absolute inset-0 -z-10 size-full" />
        <div
          className="absolute inset-0 -z-10 opacity-[0.12] mix-blend-overlay"
          style={{ backgroundImage: NOISE }}
        />
        <div className="absolute -top-32 -left-24 -z-10 size-96 rounded-full bg-[#3f9d5e]/30 blur-3xl" />
        <BrandMark tone="inverse" />
        <div className="flex max-w-lg flex-col gap-5">
          <p className="text-[2.5rem] leading-[1.1] font-semibold tracking-tight text-balance">
            Your website, beautifully under control.
          </p>
          <p className="text-[15px] leading-relaxed text-white/75">
            Pages, insights, enquiries and SEO in one calm place, with every
            change saved as a draft until you publish.
          </p>
          <ul className="flex flex-wrap gap-2 pt-2 text-[13px] font-medium">
            {["Pages", "Insights", "Enquiries", "SEO"].map((item) => (
              <li
                key={item}
                className="rounded-full bg-white/10 px-3.5 py-1.5 ring-1 ring-white/15 backdrop-blur-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="flex flex-col rounded-[28px] bg-sidebar px-6 py-8 sm:px-10 lg:px-12">
        <BrandMark className="lg:hidden" />
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Access is by invitation only. Ask an owner if you need an account.
        </p>
      </section>
    </main>
  )
}

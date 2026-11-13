import Image from "next/image"
import Link from "next/link"

import heroBg from "@/public/images/hero/hero-bg.png"
import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Same pills as the home hero: 52px full width on phones, 50px on desktop.
const ctaBase =
  "h-13 w-full rounded-full px-6 py-0 text-base leading-5 font-semibold sm:h-12.5 sm:w-auto sm:px-[27px] sm:text-[15px] sm:leading-[normal]"

const PATHS = [
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/insights", label: "Insights" },
]

// The 404 in the site's hero language: the home photo under the teal wash, a
// ghosted serif numeral behind the copy, and calm routes back in. Static (no
// CMS reads) so app/global-not-found.tsx can prerender it too. Inside the site
// layout the fixed header overlays its top, hence the top padding.
export function NotFoundView() {
  return (
    <section
      aria-labelledby="not-found-heading"
      className="relative isolate flex min-h-svh w-full flex-col overflow-clip bg-hero-base"
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        <Image
          src={heroBg}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          style={{ objectPosition: "center 48%" }}
          className="-scale-x-100 object-cover opacity-70"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(8,18,15,0.82) 0%, rgba(8,18,15,0.55) 45%, rgba(8,18,15,0.15) 100%), linear-gradient(180deg, rgba(8,18,15,0.7) 0%, rgba(8,18,15,0.2) 35%, rgba(8,23,20,0.6) 70%, rgba(8,23,20,0.96) 100%)",
          }}
        />
        <span className="absolute right-[-4vw] bottom-[-6vw] font-display text-[44vw] leading-none font-semibold tracking-[-0.04em] text-white/6 select-none [font-variation-settings:'SOFT'_100,'WONK'_1] sm:bottom-[-9vw] sm:text-[36vw]">
          404
        </span>
      </div>

      <Container className="flex flex-1 flex-col justify-end gap-5 pt-28 pb-12 sm:gap-7 sm:pb-14 lg:pb-16">
        <Eyebrow tone="onDark" mobile="pill" className="self-start">
          Error 404 · Page not found
        </Eyebrow>

        <h1
          id="not-found-heading"
          className="max-w-215 font-display text-[40px] leading-11 font-bold tracking-[-0.5px] text-white [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[64px] sm:leading-[1.05] sm:font-semibold sm:tracking-normal lg:text-[80px]"
        >
          This path leads nowhere.{" "}
          <span className="text-white/55">Take a breath, and begin again.</span>
        </h1>

        <p className="max-w-140 text-[15px] leading-5.75 text-mist sm:text-lg sm:leading-[1.6] sm:text-white/84">
          The page you were looking for has moved or no longer exists. Every
          road below leads somewhere calmer.
        </p>

        <div className="flex w-full flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:gap-4 sm:pt-3">
          <Link
            href="/"
            data-magnetic
            className={cn(
              buttonVariants(),
              ctaBase,
              "bg-white text-brand hover:bg-white/90"
            )}
          >
            Back to home
          </Link>
          <Link
            href="/contact"
            data-magnetic
            className={cn(
              buttonVariants({ variant: "outline" }),
              ctaBase,
              "border-white bg-transparent text-white hover:bg-white/15 hover:text-white sm:border-white/40 sm:bg-white/5"
            )}
          >
            Book a discovery call
          </Link>
        </div>

        <nav
          aria-label="Helpful links"
          className="mt-4 border-t border-white/10 pt-6 sm:mt-8 sm:pt-8"
        >
          <ul className="flex flex-wrap gap-x-7 gap-y-3">
            {PATHS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group inline-flex items-center gap-2 font-plex-mono text-xs leading-4 font-medium tracking-[1px] text-white/70 uppercase transition-colors hover:text-white"
                >
                  <span
                    aria-hidden
                    className="h-0.5 w-4 bg-clay transition-[width] duration-300 group-hover:w-6"
                  />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </section>
  )
}

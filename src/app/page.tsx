import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { AnimateInView } from "@/components/animate-in-view"
import AfricaGlobe from "@/components/AfricaGlobe"
import { createClient } from "@/lib/supabase/server"

export default async function Home() {
  const supabase = await createClient()
  const { data: countryRows, error: countriesError } = await supabase
    .from("countries")
    .select("iso_code, name")
    .order("name", { ascending: true })

  if (countriesError) {
    console.error("Home: could not load countries", countriesError)
  }
  const highlightedCountries = (countryRows ?? []).map((row) => ({
    name: row.name,
    isoCode: row.iso_code,
  }))
  const countryCount = highlightedCountries.length

  return (
    <main className="flex flex-1 flex-col">
      {/* Hero / Header section — natural image height, content overlaid */}
      <section className="relative mt-14 overflow-hidden ring-1 ring-teal/40 md:mt-0 md:ring-0">
        <Image
          src="/homepage-hero.jpg"
          alt="Children's Home community group photo"
          width={4096}
          height={2720}
          className="anim-hero-zoom h-auto w-full will-change-transform"
          priority
        />

        {/* Full overlay so we can position content at bottom */}
        <div className="absolute inset-0 flex flex-col px-6 pt-4 md:px-[50px] md:pt-6">

          {/* Mobile: sticky nav bar */}
          <div className="anim-fade-down fixed inset-x-0 top-0 z-50 flex items-center justify-start bg-teal/60 px-4 py-2 shadow-[0px_4px_15.4px_0px_rgba(0,0,0,0.25)] md:hidden">
            <Image
              src="/rolf-logo-white.png"
              alt="River of Life Foundation"
              width={127}
              height={91}
              className="h-auto w-14"
            />
          </div>

          {/* Desktop/tablet: corner logo */}
          <div className="anim-fade-down anim-delay-150 hidden bg-teal/[0.33] px-4 py-3 shadow-[0px_4px_15.4px_0px_rgba(0,0,0,0.25)] md:inline-flex md:self-start">
            <Image
              src="/rolf-logo-white.png"
              alt="River of Life Foundation"
              width={127}
              height={91}
              className="h-auto w-32 lg:w-40"
            />
          </div>

          {/* Hero content box — pinned to bottom */}
          <AnimateInView
            className="mt-auto flex w-full flex-col gap-3 bg-teal/[0.33] px-4 py-3 shadow-[0px_4px_15.4px_0px_rgba(0,0,0,0.25)] md:gap-8 md:px-8 md:py-6 lg:max-w-[957px]"
            duration={750}
            variant="scale"
          >
            <h1 className="anim-fade-rise anim-delay-300 google-sans-registry-title text-[clamp(1.75rem,8vw,6.5rem)] font-semibold leading-[0.95] tracking-[-0.03em] text-[#f2f2f2] [text-shadow:0px_4px_8px_#002a37]">
              Children&apos;s Homes
            </h1>
            <div className="flex flex-col gap-1 md:gap-3">
              <h2 className="anim-fade-rise anim-delay-450 m-0 google-sans-registry text-[clamp(1rem,2.8vw,2.25rem)] font-bold leading-[1.09] tracking-[-0.05em] text-[#f2f2f2] [text-shadow:0px_4px_4px_rgba(0,0,0,0.45)]">
                Giving unhoused children a home
              </h2>
              <p className="anim-fade-rise anim-delay-600 m-0 google-sans-registry text-[clamp(0.75rem,1.4vw,1.25rem)] leading-[1.35] tracking-[-0.02em] text-[#f2f2f2] [text-shadow:0px_2px_4px_rgba(0,0,0,0.5),0px_4px_12px_rgba(0,0,0,0.4)]">
                A place of belonging, love and growth.
                <br />
                With your support they thrive
              </p>
            </div>
          </AnimateInView>

        </div>
      </section>

      {/* Welcome section */}
      <section className="flex flex-1 flex-col items-center bg-sky px-6 py-16 sm:px-16 sm:py-24 lg:px-[152px] lg:py-[135px]">
        <div className="flex w-full max-w-[942px] flex-col items-center gap-10 lg:gap-[60px]">
          <AnimateInView className="w-full max-w-[750px]" variant="left">
            <h2 className="w-full max-w-[750px] text-center google-sans-registry-title text-[clamp(1.75rem,5vw,3.875rem)] font-bold leading-[1.09] tracking-[-0.05em] text-[#007091] md:text-left">
              Welcome to the Community!
            </h2>
          </AnimateInView>
          <AnimateInView className="w-full max-w-[702px]" delay={120} duration={650} variant="scale">
            <Link
              href="/login"
              className="group relative flex w-full items-center justify-center gap-4 overflow-hidden rounded-full bg-teal px-8 py-5 text-[clamp(1.25rem,4vw,2.5rem)] font-semibold tracking-wide text-white shadow-[0_8px_32px_rgba(60,182,178,0.35)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(60,182,178,0.45)] active:translate-y-0 active:shadow-md sm:py-6 lg:text-[3rem]"
            >
              {/* shimmer sweep on hover */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-white/10 transition-transform duration-500 group-hover:translate-x-full"
              />
              <span className="relative google-sans-page">Login</span>
              <ArrowRightIcon className="relative size-6 transition-transform duration-300 group-hover:translate-x-1 lg:size-8" aria-hidden="true" />
            </Link>
          </AnimateInView>
        </div>
      </section>

      {/* Where we work — interactive globe */}
      <section className="homepage-globe-surface relative isolate flex flex-col items-center gap-8 overflow-hidden px-6 py-16 sm:px-16 sm:py-20 lg:gap-12">
        <AnimateInView className="flex w-full max-w-[720px] flex-col items-center gap-3 text-center" duration={720}>
          <h2 className="google-sans-registry-title text-[clamp(1.75rem,5vw,3.875rem)] font-bold leading-[1.09] tracking-[-0.05em] text-ice">
            Where We Serve
          </h2>
          <p className="m-0 google-sans-page text-[clamp(0.875rem,1.6vw,1.25rem)] leading-[1.4] text-sky">
            Our children&apos;s homes serve communities{" "}
            {countryCount > 0
              ? `in ${countryCount} ${countryCount === 1 ? "country" : "countries"}`
              : "around the world"}
            .  Drag the globe to explore!
          </p>
        </AnimateInView>
        <AnimateInView className="w-full max-w-[900px]" delay={140} duration={850} variant="scale">
          <AfricaGlobe
            highlightedCountries={highlightedCountries}
            extraMarkers={[
              {
                lat: 37.3802,
                lng: -121.953,
                name: "River of Life Foundation",
                subtitle: "1177 Laurelwood Rd, Santa Clara, CA",
                altitude: 0.005,
                markerType: "pin",
              },
            ]}
            className="h-[340px] w-full max-w-[900px] sm:h-[480px] lg:h-[560px]"
          />
        </AnimateInView>
      </section>

      {/* Image breaker */}
      <section className="overflow-hidden">
        <AnimateInView className="w-full" duration={900} variant="scale">
          <Image
            src="/homepage-children.jpg"
            alt="Children from the River of Life Foundation community"
            width={1280}
            height={625}
            className="w-full h-auto"
          />
        </AnimateInView>
      </section>
    </main>
  )
}

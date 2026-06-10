import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-navy px-6 py-16 text-center">
      {/* Soft brand-color glows for depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-teal/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -bottom-40 size-[30rem] rounded-full bg-sky/10 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center gap-9">
        <Image
          src="/rolf-logo-white.png"
          alt="River of Life Foundation"
          width={320}
          height={229}
          preload
          className="h-auto w-52 max-w-[70vw] drop-shadow-2xl sm:w-64"
        />

        <div className="space-y-4">
          <h1 className="font-heading text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Children&apos;s Homes
          </h1>
          <div className="mx-auto h-1 w-12 rounded-full bg-teal" />
          <p className="mx-auto max-w-md text-balance text-sm leading-relaxed text-sky/80 sm:text-base">
            Giving un-homed children a home — a place of belonging, love, and
            the chance to thrive.
          </p>
        </div>

        <Link
          href="/login"
          className="group inline-flex items-center gap-2 rounded-full bg-teal px-10 py-3.5 text-base font-semibold text-navy shadow-lg shadow-teal/25 transition-all hover:-translate-y-0.5 hover:bg-teal/90 hover:shadow-xl hover:shadow-teal/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:translate-y-0"
        >
          Login
          <ArrowRightIcon
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </main>
  )
}

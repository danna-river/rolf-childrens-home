"use client"
import Link from "next/link"

export function RegisterChildButton() {
    return (
        <Link
            href="/dashboard/children/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-2.5 text-base font-semibold shadow-xs h-fit hover:bg-blue-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
            + Register Child
        </Link>
    )
}
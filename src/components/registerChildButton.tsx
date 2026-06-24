"use client"
import Link from "next/link"
import { PlusIcon } from "lucide-react"

export function RegisterChildButton() {
    return (
        <Link
            href="/dashboard/children/new"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-teal px-5 text-base font-bold text-white shadow-sm shadow-teal/20 motion-safe:transition-colors hover:bg-teal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
        >
            <PlusIcon className="size-5" aria-hidden="true" />
            Register Child
        </Link>
    )
}

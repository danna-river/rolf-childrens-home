"use client"
import Link from "next/link"

export function RegisterChildButton() {
    return (
        <Link
            href="/dashboard/children/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-xs font-semibold shadow-xs h-fit hover:bg-blue-700 transition-colors"
        >
            + Register Child
        </Link>
    )
}
"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "@/i18n/client";

export function SearchBar() {
    const t = useTranslations();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [inputValue, setInputValue] = useState(searchParams.get("search") ?? "");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSearchQuery = e.target.value;
        setInputValue(newSearchQuery);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (newSearchQuery) {
                params.set("search", newSearchQuery);
            } else {
                params.delete("search");
            }
            params.delete("page"); // new query → back to the first page
            router.replace(`${pathname}?${params.toString()}`);
        }, 300);
    };

    return (
      <div className="relative flex items-center">
          <SearchIcon className="pointer-events-none absolute left-4 size-5 text-navy/45" aria-hidden="true" />
          <input
            value={inputValue}
            onChange={handleSearchChange}
            maxLength={100}
            placeholder={t("children.filters.searchPlaceholder")}
            className="min-h-14 w-full rounded-md border border-stone bg-ice pl-12 pr-4 text-base font-semibold text-navy outline-none motion-safe:transition-colors placeholder:text-navy/55 focus:border-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          />
      </div>
  )
}

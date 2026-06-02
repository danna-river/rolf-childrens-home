"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef, useState } from "react";

interface SearchBarProps {
    totalCount: number;
}

export function SearchBar({ totalCount }: SearchBarProps) {
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
            router.replace(`${pathname}?${params.toString()}`);
        }, 300);
    };

    return (
        <div className="space-y-4">
      
      {/* Search Utilities Control Bar Layout */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-xs max-w-md">
        <div className="relative flex items-center">
          <span className="absolute left-3.5 text-gray-400 pointer-events-none text-xs">
            🔍
          </span>
          <input
            value={inputValue}
            onChange={handleSearchChange}
            maxLength={100}
            placeholder="Search by name..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-100 rounded-lg text-gray-800 outline-none"
          />
        </div>
      </div>

      {/* Metrics Section */}
      <div className="px-1 flex items-center justify-between border-b border-gray-100 pb-2">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Active Profiles
        </h2>
        <span className="text-xs font-medium text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-md">
          {totalCount} files loaded
        </span>
      </div>

    </div>
  )
}
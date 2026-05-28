interface SearchBarProps {
    totalCount: number;
}

export function SearchBar({ totalCount }: SearchBarProps) {
    return (
        <div className="space-y-4">
      
      {/* Search Utilities Control Bar Layout */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-xs max-w-md">
        <div className="relative flex items-center">
          <span className="absolute left-3.5 text-gray-400 pointer-events-none text-xs">
            🔍
          </span>
          <input
            type="text"
            disabled
            placeholder="Search functionality disabled for now..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-100 rounded-lg cursor-not-allowed text-gray-400 outline-none"
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
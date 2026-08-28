import React from "react";
import { Search, Plus } from "lucide-react";

interface PageHeaderProps {
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filters?: string[];
  activeFilter?: string;
  onFilterChange?: (val: string) => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  children?: React.ReactNode;
}

export function PageHeader({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  activeFilter,
  onFilterChange,
  primaryActionLabel,
  onPrimaryAction,
  children
}: PageHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
        
        {/* Search */}
        {onSearchChange && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-card border border-border rounded-full pl-11 pr-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-foreground"
            />
          </div>
        )}

        {/* Filters */}
        {filters.length > 0 && onFilterChange && (
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeFilter === f
                    ? "bg-white text-black"
                    : "bg-card border border-border text-gray-300 hover:bg-black/10 dark:hover:bg-white/10"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Custom children (e.g. additional dropdowns) */}
        {children}
      </div>

      {/* Primary Action */}
      {primaryActionLabel && onPrimaryAction && (
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <button
            onClick={onPrimaryAction}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 border border-transparent text-foreground rounded-full font-medium transition-colors text-sm shadow-lg shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>{primaryActionLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}

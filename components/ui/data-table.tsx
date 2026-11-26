import * as React from "react";
import { ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyText?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyText = "No records found",
  className = "",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === "asc") setSortDirection("desc");
      else {
        setSortKey(null);
        setSortDirection("asc");
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey] as string | number | null | undefined;
      const bVal = (b as Record<string, unknown>)[sortKey] as string | number | null | undefined;
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      return sortDirection === "asc" ? 1 : -1;
    });
  }, [data, sortKey, sortDirection]);

  return (
    <div className={`w-full overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-xs ${className}`}>
      {/* Mobile (<sm): stacked cards — avoids the horizontal scroll a wide table
          forces on a 375px phone. */}
      <div className="sm:hidden divide-y divide-[#E2E8F0]">
        {sortedData.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[#64748B]">{emptyText}</div>
        ) : (
          sortedData.map((row) => (
            <button
              key={keyExtractor(row)}
              type="button"
              onClick={() => onRowClick && onRowClick(row)}
              disabled={!onRowClick}
              className={`block w-full text-left px-4 py-3 space-y-1.5 ${
                onRowClick ? "active:bg-[#F8FAFC] cursor-pointer" : "cursor-default"
              }`}
            >
              {columns.map((col) => (
                <div key={col.key} className="flex items-start justify-between gap-3 min-h-[24px]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] shrink-0">
                    {col.header}
                  </span>
                  <span className="text-[13px] text-[#09090B] text-right">
                    {col.render ? col.render(row) : ((row as Record<string, unknown>)[col.key] as React.ReactNode)}
                  </span>
                </div>
              ))}
            </button>
          ))
        )}
      </div>

      {/* Desktop/tablet (>=sm): full table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`px-4 py-3 select-none ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  }`}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-[#09090B] transition-colors focus:outline-none cursor-pointer"
                    >
                      <span>{col.header}</span>
                      {sortKey === col.key ? (
                        sortDirection === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-[#D97706]" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-[#D97706]" />
                        )
                      ) : (
                        <ArrowUpDown className="h-2.5 w-2.5 text-[#94A3B8]" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-xs text-[#64748B]"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors ${
                    onRowClick ? "cursor-pointer hover:bg-[#F8FAFC]" : "hover:bg-[#F8FAFC]/50"
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-[#09090B] ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left"
                      }`}
                    >
                      {col.render ? col.render(row) : ((row as Record<string, unknown>)[col.key] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

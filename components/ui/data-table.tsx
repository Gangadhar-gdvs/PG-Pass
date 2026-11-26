import * as React from "react";
import { ArrowUpDown, ChevronUp, ChevronDown, ChevronRight } from "lucide-react";

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
    <div className={`app-card w-full overflow-hidden ${className}`}>
      {/* Mobile (<sm): stacked cards — avoids the horizontal scroll a wide table
          forces on a 375px phone. */}
      <div className="sm:hidden p-2 space-y-2">
        {sortedData.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] font-medium text-muted">{emptyText}</div>
        ) : (
          sortedData.map((row) => (
            <div
              key={keyExtractor(row)}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={`relative block w-full text-left rounded-2xl bg-white/80 border border-[#F0EBFD] px-4 py-3 space-y-1.5 shadow-[0_6px_14px_-10px_rgba(70,40,160,0.3)] ${
                onRowClick ? "active:scale-[0.99] transition-transform cursor-pointer pr-9" : "cursor-default"
              }`}
            >
              {columns.map((col) => (
                <div key={col.key} className="flex items-start justify-between gap-3 min-h-[24px]">
                  <span className="text-xs font-semibold text-muted shrink-0">
                    {col.header}
                  </span>
                  <span className="text-[13px] font-medium text-ink text-right">
                    {col.render ? col.render(row) : ((row as Record<string, unknown>)[col.key] as React.ReactNode)}
                  </span>
                </div>
              ))}
              {onRowClick && (
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-300" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop/tablet (>=sm): full table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-line bg-brand-50/70 text-xs font-bold text-muted">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`px-4 py-3.5 select-none first:pl-5 last:pr-5 ${
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
                      className="inline-flex items-center gap-1 hover:text-brand-700 transition-colors focus:outline-none cursor-pointer"
                    >
                      <span>{col.header}</span>
                      {sortKey === col.key ? (
                        sortDirection === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5 text-brand" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-brand" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-faint" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-[13px] font-medium text-muted"
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
                    onRowClick ? "cursor-pointer hover:bg-brand-50/60" : "hover:bg-brand-50/30"
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3.5 first:pl-5 last:pr-5 text-ink font-medium ${
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

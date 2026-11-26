import * as React from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: "underline" | "pill";
}

/**
 * Segmented tabs.
 *  - pill (default): white glass track, active tab = violet gradient pill.
 *  - underline: violet label + rounded violet bar (like the bottom-nav marker).
 */
export function TabBar({
  tabs,
  activeTab,
  onChange,
  className = "",
  variant = "pill",
}: TabBarProps) {
  if (variant === "pill") {
    return (
      <div
        role="tablist"
        className={`app-card flex items-center gap-1 p-1.5 rounded-full overflow-x-auto no-scrollbar max-w-full ${className}`}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-full text-[13px] font-bold transition-all select-none cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? "text-white bg-[image:var(--grad-brand)] shadow-[0_8px_18px_-8px_rgba(106,43,234,0.6),inset_0_1px_0_rgba(255,255,255,0.3)]"
                  : "text-muted hover:text-brand-700 hover:bg-brand-50"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`min-w-[20px] px-1.5 py-px rounded-full text-[10.5px] font-bold leading-4 ${
                    isActive ? "bg-white/25 text-white" : "bg-brand-100 text-brand-700"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={`flex items-center gap-6 border-b border-line overflow-x-auto no-scrollbar ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative pb-3 text-[13px] font-bold whitespace-nowrap transition-colors select-none cursor-pointer ${
              isActive ? "text-brand-700" : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-px rounded-full text-[10.5px] ${
                  isActive ? "bg-brand-100 text-brand-700" : "bg-lilac-2 text-muted"
                }`}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <span className="absolute -bottom-px left-1 right-1 h-[3px] rounded-full bg-[image:var(--grad-brand)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

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
        className={`inline-flex items-center gap-1 p-1 rounded-[8px] bg-[#F1F5F9] border border-[#E2E8F0] text-xs ${className}`}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-[6px] font-semibold transition-all select-none cursor-pointer ${
                isActive
                  ? "bg-white text-[#09090B] shadow-[0_1px_2px_0_rgba(0,0,0,0.06)]"
                  : "text-[#64748B] hover:text-[#09090B] hover:bg-white/50"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive
                      ? "bg-[#FEF3C7] text-[#92400E]"
                      : "bg-[#E2E8F0] text-[#64748B]"
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
      className={`flex items-center gap-6 border-b border-[#E2E8F0] overflow-x-auto ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative pb-2.5 text-xs font-semibold whitespace-nowrap transition-colors select-none cursor-pointer ${
              isActive
                ? "text-[#D97706]"
                : "text-[#64748B] hover:text-[#09090B]"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  isActive
                    ? "bg-[#FEF3C7] text-[#92400E]"
                    : "bg-[#F1F5F9] text-[#64748B]"
                }`}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D97706] rounded-t-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

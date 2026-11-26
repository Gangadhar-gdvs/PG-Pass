'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: React.ReactNode;
}

export interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  label?: React.ReactNode;
  placeholder?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  id?: string;
  /** Outer wrapper width (e.g. `w-auto` for inline filters). */
  containerClassName?: string;
  /** Trigger button extra classes (height, text size for compact filters). */
  className?: string;
  'aria-label'?: string;
}

/**
 * Fully themed dropdown — a custom button + popover list, NOT a native <select>.
 * Native selects render their open option list with the OS's own styling (the
 * black/default menu), which can't be themed. This renders the options panel in
 * our own markup so it follows the app theme and font everywhere.
 *
 * The options panel is rendered through a PORTAL to <body> with fixed
 * positioning, so it is never clipped by ancestors that scroll/clip (drawers,
 * filter bars, cards). Closes on outside click / Escape / scroll / resize;
 * basic keyboard support (Enter/Space/arrows).
 */
export function Dropdown({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select…',
  error,
  helperText,
  disabled,
  id,
  containerClassName = 'w-full',
  className = '',
  'aria-label': ariaLabel,
}: DropdownProps) {
  const generatedId = React.useId();
  const triggerId = id || generatedId;
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  const [rect, setRect] = React.useState<{ left: number; top: number; width: number } | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  // Mark mounted after commit (microtask) so this doesn't setState synchronously
  // in the effect body (cascading-render lint rule). Gates the portal render.
  React.useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const positionPanel = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 6, width: r.width });
  }, []);

  // Open/close side effects: position the panel, and wire outside-click, Escape,
  // scroll and resize so the panel never floats detached from its trigger.
  React.useEffect(() => {
    if (!open) return;
    positionPanel();

    const onDocPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onReposition = () => positionPanel();

    document.addEventListener('mousedown', onDocPointer);
    window.addEventListener('keydown', onKey);
    // capture:true so we catch scrolls on any ancestor scroll container.
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open, positionPanel]);

  // Seed keyboard focus on the current value ONLY when the menu opens — depend on
  // `open` alone so a parent re-render (which recreates `options`) doesn't snap
  // activeIndex back and break arrow-key navigation.
  React.useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    // Defer so this setState runs after commit, not in the effect body
    // (cascading-render lint rule).
    queueMicrotask(() => setActiveIndex(idx >= 0 ? idx : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const opt = options[Math.min(activeIndex, options.length - 1)];
      if (opt) commit(opt.value);
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 text-left ${containerClassName}`} ref={rootRef}>
      {label && (
        <label
          htmlFor={triggerId}
          className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]"
        >
          {label}
        </label>
      )}

      <button
        id={triggerId}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`h-11 w-full flex items-center justify-between gap-2 rounded-[8px] border bg-white pl-3.5 pr-3 py-2 text-[13px] text-left transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8] shadow-xs cursor-pointer ${
          error
            ? 'border-[#EF4444] focus-visible:border-[#EF4444] focus-visible:ring-[#EF4444]'
            : 'border-[#E2E8F0] hover:border-[#CBD5E1] focus-visible:border-[#D97706] focus-visible:ring-[#D97706]'
        } ${className}`}
      >
        <span className={`truncate ${selected ? 'text-[#09090B]' : 'text-[#94A3B8]'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#94A3B8] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && mounted && rect &&
        createPortal(
          <ul
            ref={panelRef}
            role="listbox"
            tabIndex={-1}
            className="fixed z-[70] max-h-60 overflow-y-auto rounded-[12px] border border-[#E2E8F0] bg-white p-1 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.22)] animate-pop"
            style={{ left: rect.left, top: rect.top, width: rect.width }}
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIndex;
              return (
                <li key={opt.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => commit(opt.value)}
                    className={`w-full flex items-center justify-between gap-2 rounded-[8px] px-2.5 py-2.5 text-[13px] text-left transition-colors ${
                      isActive ? 'bg-[#F8FAFC]' : ''
                    } ${isSelected ? 'font-bold' : 'font-medium'}`}
                    style={isSelected ? { color: 'var(--accent)' } : { color: '#334155' }}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )}

      {error && <p className="text-xs font-medium text-[#EF4444]">{error}</p>}
      {!error && helperText && <p className="text-xs text-[#64748B]">{helperText}</p>}
    </div>
  );
}

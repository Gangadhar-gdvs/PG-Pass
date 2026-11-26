'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { fieldLabelClass, fieldBaseClass, fieldStateClass } from './input';

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
        <label htmlFor={triggerId} className={fieldLabelClass}>
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
        className={`h-12 flex items-center justify-between gap-2 pl-4 pr-3 text-left cursor-pointer ${fieldBaseClass} ${fieldStateClass(error)} ${
          open ? 'border-brand shadow-[0_0_0_4px_rgba(123,63,242,0.14)]' : ''
        } ${className}`}
      >
        <span className={`truncate ${selected ? 'text-ink font-medium' : 'text-faint'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && mounted && rect &&
        createPortal(
          <ul
            ref={panelRef}
            role="listbox"
            tabIndex={-1}
            className="fixed z-[70] max-h-64 overflow-y-auto rounded-2xl border border-white bg-white/97 p-1.5 shadow-[0_22px_48px_-16px_rgba(70,40,160,0.4)] ring-1 ring-line animate-pop"
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
                    className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[13px] text-left transition-colors ${
                      isActive ? 'bg-brand-50' : ''
                    } ${isSelected ? 'font-bold text-brand-700' : 'font-medium text-ink-2'}`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && (
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[image:var(--grad-brand)] text-white">
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )}

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      {!error && helperText && <p className="text-xs text-muted">{helperText}</p>}
    </div>
  );
}

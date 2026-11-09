'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
  tone?: string;
}

interface FilterSelectProps {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  align?: 'left' | 'right';
}

export function FilterSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  align = 'left',
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const index = options.findIndex((option) => option.value === value);
    const next = index >= 0 ? index : 0;
    setActiveIndex(next);
    listRef.current?.focus();
    const item = listRef.current?.children[next];
    if (item instanceof HTMLElement) item.scrollIntoView({ block: 'nearest' });
  }, [open, options, value]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const openMenu = () => {
    const index = options.findIndex((option) => option.value === value);
    setActiveIndex(index >= 0 ? index : 0);
    setOpen(true);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu();
    }
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + options.length) % options.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(options[activeIndex].value);
    }
  };

  return (
    <div className={`ex-filter-select ${className}`.trim()} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="ex-filter-dropdown ex-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((isOpen) => !isOpen)}
        onKeyDown={onTriggerKeyDown}
      >
        <span
          className={`ex-select-dot ${selected?.tone ? '' : 'is-none'}`}
          style={selected?.tone ? { background: selected.tone } : undefined}
          aria-hidden="true"
        />
        <span className="ex-select-value">{selected?.label ?? value}</span>
        <ChevronDown size={14} className={`ex-select-chevron ${open ? 'is-open' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={`ex-select-menu ${align === 'right' ? 'is-right' : ''}`}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                className={`ex-select-option ${isSelected ? 'is-selected' : ''} ${index === activeIndex ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option.value)}
              >
                <span
                  className={`ex-select-dot ${option.tone ? '' : 'is-none'}`}
                  style={option.tone ? { background: option.tone } : undefined}
                  aria-hidden="true"
                />
                <span className="ex-select-label">{option.label}</span>
                {isSelected && <Check size={13} className="ex-select-check" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

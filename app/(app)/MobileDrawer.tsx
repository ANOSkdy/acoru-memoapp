"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

type NavItem = {
  href: string;
  label: string;
};

type MobileDrawerProps = {
  items: NavItem[];
};

const getFocusableElements = (container: HTMLElement | null) => {
  if (!container) {
    return [] as HTMLElement[];
  }

  const focusableSelectors =
    "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])";
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
};

export default function MobileDrawer({ items }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);
  const controlsId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement | null;
    }
  }, [open]);

  useEffect(() => {
    document.body.classList.toggle("drawer-open", open);
    return () => document.body.classList.remove("drawer-open");
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (previousFocus.current) {
        previousFocus.current.focus();
      } else {
        triggerRef.current?.focus();
      }
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !panelRef.current?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const focusable = getFocusableElements(panelRef.current);
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }, [open]);

  return (
    <div className="mobile-drawer">
      <button
        ref={triggerRef}
        className="mobile-drawer__trigger"
        type="button"
        aria-expanded={open}
        aria-controls={controlsId}
        onClick={() => setOpen(true)}
      >
        Menu
      </button>

      {open && (
        <>
          <div
            className="mobile-drawer__backdrop"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            className="mobile-drawer__panel"
            id={controlsId}
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            ref={panelRef}
          >
            <div className="mobile-drawer__header">
              <span className="mobile-drawer__title">Acoru Memo</span>
              <button
                className="mobile-drawer__close"
                type="button"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <nav className="mobile-drawer__nav">
              {items.map((item) => (
                <Link
                  key={item.href}
                  className="mobile-drawer__link"
                  href={item.href}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}

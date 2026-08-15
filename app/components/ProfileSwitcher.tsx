"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Person } from "@/lib/schema";
import { DeskAvatar } from "./DeskAvatar";

const STORAGE_KEY = "dash:last_person";

export function ProfileSwitcher({
  current,
  people,
  todayRibbon,
}: {
  current: Person;
  people: Person[];
  /** Server-rendered stamp, e.g. "Wed, Apr 23, 2026" */
  todayRibbon: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q),
    );
  }, [people, query]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, current.slug);
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, [current.slug]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(
      Math.max(
        0,
        people.findIndex((p) => p.slug === current.slug),
      ),
    );
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, people, current.slug]);

  useEffect(() => {
    setActiveIndex((idx) =>
      filtered.length === 0 ? 0 : Math.min(idx, filtered.length - 1),
    );
  }, [filtered.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) =>
          filtered.length ? (i - 1 + filtered.length) % filtered.length : 0,
        );
      }
      if (e.key === "Enter" && filtered[activeIndex]) {
        e.preventDefault();
        window.location.href = `/${filtered[activeIndex].slug}`;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, activeIndex]);

  return (
    <div className="liquid-panel rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-panel)]/95 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg px-1 py-1 font-mono text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-dim)] transition duration-200 ease-out hover:text-[var(--color-gold)] active:translate-y-px"
        >
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: current.accent }}
            aria-hidden="true"
          />
          Home
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <p className="hidden font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--color-text-muted)] sm:block">
            {todayRibbon}
          </p>
          <div className="relative">
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] py-1 pl-1 pr-3 text-sm font-medium text-[var(--color-text-dim)] transition duration-200 ease-out hover:text-white active:translate-y-px"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls="profile-menu"
              aria-label="Switch profile"
            >
              <DeskAvatar person={current} size="sm" />
              <span className="hidden max-w-[9rem] truncate font-mono text-[11px] uppercase tracking-[0.14em] sm:inline">
                {current.name}
              </span>
            </button>

            {open && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setOpen(false)}
                  aria-hidden="true"
                />
                <div
                  id="profile-menu"
                  role="menu"
                  aria-label="Profiles"
                  className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-panel)] shadow-[0_24px_48px_-20px_rgba(0,0,0,0.85)] liquid-panel"
                >
                  <div className="border-b border-[var(--color-border)] px-3 py-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                      Profiles
                    </p>
                    <label className="sr-only" htmlFor="profile-search">
                      Search desks
                    </label>
                    <input
                      id="profile-search"
                      ref={searchRef}
                      type="search"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setActiveIndex(0);
                      }}
                      placeholder={`Search ${people.length} desks…`}
                      className="mt-2 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] px-2 py-1.5 font-mono text-xs text-white outline-none ring-[var(--color-gold)] placeholder:text-[var(--color-text-muted)] focus:ring-1"
                    />
                  </div>
                  <ul className="max-h-72 overflow-y-auto scroll-thin">
                    {filtered.length === 0 ? (
                      <li className="px-3 py-4 font-mono text-[11px] text-[var(--color-text-muted)]">
                        No desks match
                      </li>
                    ) : (
                      filtered.map((p, i) => {
                        const isActive = p.slug === current.slug;
                        const isFocused = i === activeIndex;
                        return (
                          <li key={p.slug}>
                            <Link
                              role="menuitem"
                              href={`/${p.slug}`}
                              onClick={() => setOpen(false)}
                              onMouseEnter={() => setActiveIndex(i)}
                              className={`flex items-center gap-3 px-3 py-2.5 text-sm transition duration-200 ease-out hover:bg-[var(--color-bg-card)] active:translate-y-px ${
                                isActive || isFocused ? "bg-[var(--color-bg-card)]" : ""
                              }`}
                            >
                              <DeskAvatar person={p} size="sm" />
                              <span className="flex-1">
                                <span className="block text-[var(--color-text)]">
                                  {p.name}
                                </span>
                                <span className="block font-mono text-[10px] text-[var(--color-text-muted)]">
                                  @{p.handle}
                                </span>
                              </span>
                              {isActive && (
                                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-gold)]">
                                  active
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })
                    )}
                  </ul>
                  <div className="border-t border-[var(--color-border)] px-3 py-2">
                    <Link
                      href="/"
                      onClick={() => setOpen(false)}
                      className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] transition hover:text-[var(--color-gold)]"
                    >
                      Home
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Person } from "@/lib/schema";

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

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, current.slug);
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, [current.slug]);

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
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] text-sm font-medium text-[var(--color-text-dim)] transition duration-200 ease-out hover:text-white active:translate-y-px"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Switch profile"
            >
              {current.name.slice(0, 1)}
            </button>

            {open && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-panel)] shadow-[0_24px_48px_-20px_rgba(0,0,0,0.85)] liquid-panel"
                >
                  <div className="border-b border-[var(--color-border)] px-3 py-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                      Profiles
                    </p>
                  </div>
                  <ul className="max-h-72 overflow-y-auto scroll-thin">
                    {people.map((p) => {
                      const isActive = p.slug === current.slug;
                      return (
                        <li key={p.slug}>
                          <Link
                            href={`/${p.slug}`}
                            onClick={() => setOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 text-sm transition duration-200 ease-out hover:bg-[var(--color-bg-card)] active:translate-y-px ${
                              isActive ? "bg-[var(--color-bg-card)]" : ""
                            }`}
                          >
                            <span
                              className="inline-block h-2 w-2 flex-none rounded-full"
                              style={{ backgroundColor: p.accent }}
                            />
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
                    })}
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

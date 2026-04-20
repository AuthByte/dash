"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Person } from "@/lib/schema";

const STORAGE_KEY = "dash:last_person";

export function ProfileSwitcher({
  current,
  people,
}: {
  current: Person;
  people: Person[];
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
    <div className="flex items-center justify-between">
      <Link
        href="/"
        className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] transition hover:text-[var(--color-gold)]"
      >
        ← All profiles
      </Link>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] px-3 py-1.5 text-xs text-[var(--color-text-dim)] transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: current.accent }}
          />
          <span className="font-mono">{current.name}</span>
          <span className="text-[var(--color-text-muted)]">·</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
            switch
          </span>
          <svg
            className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
              className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] shadow-xl"
            >
              <div className="border-b border-[var(--color-border)] px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                  / Profiles
                </p>
              </div>
              <ul className="max-h-72 overflow-y-auto">
                {people.map((p) => {
                  const isActive = p.slug === current.slug;
                  return (
                    <li key={p.slug}>
                      <Link
                        href={`/${p.slug}`}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 text-sm transition hover:bg-[var(--color-bg-elev)] ${
                          isActive ? "bg-[var(--color-bg-elev)]" : ""
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
                  className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] hover:text-[var(--color-gold)]"
                >
                  ← Back to picker
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, current.slug);
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, [current.slug]);

  const navItems = [
    { label: "Overview", href: `/${current.slug}` },
    { label: "Themes", href: `/${current.slug}#insights` },
    { label: "Picks", href: `/${current.slug}#picks` },
    { label: "Reports", href: `/${current.slug}#reports` },
  ];

  return (
    <div className="rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-panel)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="group inline-flex items-center gap-2">
          <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-black">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: current.accent }}
            />
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">
            Curio
          </span>
          <span className="text-sm text-[var(--color-text-dim)]">/</span>
          <span className="text-sm text-[var(--color-text-dim)]">Parents</span>
        </Link>

        <p className="ml-auto hidden font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] sm:block">
          Wed · Apr 20, 2026
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3">
        <nav className="flex flex-wrap items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              item.href === `/${current.slug}` && pathname === `/${current.slug}`;
            return (
              <Link
                key={item.label}
                href={item.href}
                scroll={false}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-black text-white"
                    : "text-[var(--color-text-dim)] hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-text-dim)] transition hover:text-white md:inline-flex"
          >
            Export week
          </button>
          <button
            type="button"
            className="hidden rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#111] md:inline-flex"
          >
            Add note +
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] text-sm font-medium text-[var(--color-text-dim)] transition hover:text-white"
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
                  className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-panel)] shadow-xl"
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
                            className={`flex items-center gap-3 px-3 py-2.5 text-sm transition hover:bg-[var(--color-bg-card)] ${
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
      </div>
    </div>
  );
}

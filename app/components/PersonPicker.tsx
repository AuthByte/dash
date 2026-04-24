"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Person } from "@/lib/schema";

const STORAGE_KEY = "dash:last_person";

function PickerSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2" aria-hidden="true">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="liquid-panel h-52 rounded-2xl bg-[var(--color-bg-card)]/60 sm:h-56"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

export function PersonPicker({ people }: { people: Person[] }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [autoRedirected, setAutoRedirected] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    try {
      const last = window.localStorage.getItem(STORAGE_KEY);
      if (last && people.some((p) => p.slug === last)) {
        const url = new URL(window.location.href);
        if (url.searchParams.get("pick") === "1") {
          setShowAll(true);
          return;
        }
        setAutoRedirected(true);
        router.replace(`/${last}`);
      }
    } catch {
      // ignore storage errors
    }
  }, [people, router]);

  if (!hydrated) {
    return <PickerSkeleton />;
  }

  if (autoRedirected) {
    return (
      <div className="flex min-h-[32dvh] flex-col items-start justify-center gap-4">
        <div className="h-1 w-16 rounded-full bg-[var(--color-border-strong)]">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--color-gold)]/50" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
          Resuming last desk…
        </p>
      </div>
    );
  }

  return (
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:gap-5">
      {people.map((p, i) => (
        <Link
          key={p.slug}
          href={`/${p.slug}`}
          style={{ animationDelay: `${i * 75}ms` }}
          onClick={() => {
            try {
              window.localStorage.setItem(STORAGE_KEY, p.slug);
            } catch {
              // ignore
            }
          }}
          className="animate-fade-up group relative flex flex-col overflow-hidden rounded-2xl bg-[var(--color-bg-card)]/85 p-6 transition-[transform,box-shadow,border-color] duration-300 ease-out active:translate-y-px sm:p-7 lg:min-h-[220px] liquid-panel hover:border-[var(--color-gold)]/35"
        >
          <div
            className="absolute left-0 top-0 h-full w-1 opacity-80 transition group-hover:opacity-100"
            style={{ backgroundColor: p.accent }}
            aria-hidden="true"
          />
          <div className="flex items-start justify-between gap-4 pl-2">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold text-[#0a0a0a] shadow-inner"
              style={{
                backgroundColor: p.accent,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
              }}
            >
              {p.name.charAt(0)}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[var(--color-text-muted)] transition group-hover:text-[var(--color-gold)]">
              Enter
            </span>
          </div>
          <div className="mt-6 flex flex-1 flex-col pl-2">
            <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {p.name}
            </h3>
            <p className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">
              @{p.handle}
            </p>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--color-text-dim)]">
              {p.tagline}
            </p>
          </div>
        </Link>
      ))}
      {showAll && (
        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-transparent px-6 py-8 text-left sm:col-span-2">
          <p className="max-w-sm font-mono text-[10px] uppercase leading-relaxed tracking-[0.24em] text-[var(--color-text-muted)]">
            Additional profiles ship here when you wire them in Supabase.
          </p>
        </div>
      )}
    </div>
  );
}

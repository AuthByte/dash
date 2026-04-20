"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Person } from "@/lib/schema";

const STORAGE_KEY = "dash:last_person";

export function PersonPicker({ people }: { people: Person[] }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [autoRedirected, setAutoRedirected] = useState(false);

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

  if (autoRedirected) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
          Loading last profile…
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {people.map((p) => (
        <Link
          key={p.slug}
          href={`/${p.slug}`}
          onClick={() => {
            try {
              window.localStorage.setItem(STORAGE_KEY, p.slug);
            } catch {
              // ignore
            }
          }}
          className="group relative overflow-hidden rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] p-6 transition hover:border-[var(--color-gold)]"
        >
          <div
            className="absolute inset-x-0 top-0 h-0.5 opacity-60 transition group-hover:opacity-100"
            style={{ backgroundColor: p.accent }}
          />
          <div className="flex items-start justify-between">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full font-mono text-lg font-bold text-black"
              style={{ backgroundColor: p.accent }}
            >
              {p.name.charAt(0)}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] transition group-hover:text-[var(--color-gold)]">
              Open →
            </span>
          </div>
          <div className="mt-5">
            <h3 className="font-mono text-xl font-semibold text-white">
              {p.name}
            </h3>
            <p className="mt-1 font-mono text-xs text-[var(--color-text-dim)]">
              @{p.handle}
            </p>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-dim)]">
            {p.tagline}
          </p>
        </Link>
      ))}
      {showAll && (
        <div className="rounded-md border border-dashed border-[var(--color-border-strong)] bg-transparent p-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
            More profiles coming soon
          </p>
        </div>
      )}
    </div>
  );
}

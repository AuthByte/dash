import { formatFollowers } from "@/lib/format";
import type { Person, SiteMeta } from "@/lib/schema";

export function Hero({ meta, person }: { meta: SiteMeta; person: Person }) {
  return (
    <header className="liquid-panel grid gap-8 overflow-hidden rounded-[1.75rem] bg-[var(--color-bg-card)]/90 px-6 py-8 sm:px-8 sm:py-9 lg:grid-cols-[1fr_auto] lg:items-end">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--color-text-muted)]">
          Live board
        </p>
        <h1 className="mt-4 text-3xl font-semibold leading-[1.05] tracking-tighter text-white sm:text-4xl lg:text-5xl">
          {person.name}
          <span className="text-[var(--color-text-dim)]"> — </span>
          <span className="text-[var(--color-gold)]">tape at a glance.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[var(--color-text-dim)] sm:text-base">
          {person.tagline}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:flex-col lg:items-stretch">
        <a
          href={`https://x.com/${meta.handle}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] px-4 py-2.5 text-xs text-[var(--color-text-dim)] transition duration-200 ease-out hover:border-[var(--color-gold)]/50 hover:text-[var(--color-gold)] active:translate-y-px"
        >
          <XIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="font-mono">@{meta.handle}</span>
        </a>
        <span className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          {formatFollowers(meta.follower_count)} followers
        </span>
      </div>
    </header>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

import { formatFollowers } from "@/lib/format";
import type { Person, SiteMeta } from "@/lib/schema";

export function Hero({ meta, person }: { meta: SiteMeta; person: Person }) {
  return (
    <header className="grid gap-6 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] px-6 py-7 shadow-[0_20px_40px_-28px_rgba(0,0,0,0.8)] lg:grid-cols-[1fr_auto] lg:items-start">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
          This week
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-[1.1] text-white sm:text-5xl">
          {person.name}&apos;s picks, at a glance.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-[var(--color-text-dim)] sm:text-base">
          {person.tagline}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-end">
        <a
          href={`https://x.com/${meta.handle}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] px-4 py-2 text-xs text-[var(--color-text-dim)] transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
        >
          <XIcon className="h-3 w-3" />
          <span className="font-mono">@{meta.handle}</span>
        </a>
        <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
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

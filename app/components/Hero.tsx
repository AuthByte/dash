import { formatFollowers } from "@/lib/format";
import type { Person, SiteMeta } from "@/lib/schema";

export function Hero({ meta, person }: { meta: SiteMeta; person: Person }) {
  return (
    <header className="text-center">
      <h1 className="font-mono text-3xl font-bold tracking-tight sm:text-5xl">
        <span style={{ color: person.accent }}>{person.name}&apos;s Picks</span>
        <span className="text-[var(--color-text-dim)]"> — </span>
        <span className="text-white">@{meta.handle}</span>
      </h1>
      <p className="mt-4 text-sm text-[var(--color-text-dim)] sm:text-base">
        Live tracker
        <span className="mx-2 text-[var(--color-text-muted)]">•</span>
        {person.tagline}
      </p>
      <a
        href={`https://x.com/${meta.handle}`}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] px-4 py-1.5 text-xs text-[var(--color-text-dim)] transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
      >
        <XIcon className="h-3 w-3" />
        <span className="font-mono">@{meta.handle}</span>
        <span className="text-[var(--color-text-muted)]">•</span>
        <span className="font-mono">
          {formatFollowers(meta.follower_count)} followers
        </span>
      </a>
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

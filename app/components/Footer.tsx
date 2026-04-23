import { formatDate } from "@/lib/format";
import type { SiteMeta } from "@/lib/schema";

export function Footer({ meta }: { meta: SiteMeta }) {
  return (
    <footer className="mt-16 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] px-5 py-4">
      <div className="flex flex-col items-start justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] sm:flex-row sm:items-center">
        <p>
          Last updated:{" "}
          <span className="text-[var(--color-text-dim)]">
            {formatDate(meta.last_updated)}
          </span>
        </p>
        <p>
          Built for{" "}
          <a
            href={`https://x.com/${meta.handle}`}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-text-dim)] hover:text-[var(--color-gold)]"
          >
            @{meta.handle}
          </a>{" "}
          watchers
        </p>
        <p className="text-[var(--color-text-muted)]">Not investment advice.</p>
      </div>
    </footer>
  );
}

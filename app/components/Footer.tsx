import { formatDate } from "@/lib/format";
import type { SiteMeta } from "@/lib/schema";

export function Footer({ meta }: { meta: SiteMeta }) {
  return (
    <footer className="liquid-panel rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-card)]/90 px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6">
        <p>
          Last ingest{" "}
          <span className="text-[var(--color-text-dim)]">
            {formatDate(meta.last_updated)}
          </span>
        </p>
        <p>
          <a
            href={`https://x.com/${meta.handle}`}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-text-dim)] transition duration-200 ease-out hover:text-[var(--color-gold)] active:translate-y-px"
          >
            @{meta.handle}
          </a>
        </p>
        <p className="text-[var(--color-text-muted)] sm:text-right">
          Not investment advice.
        </p>
      </div>
    </footer>
  );
}

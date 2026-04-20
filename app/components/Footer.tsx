import { formatDate } from "@/lib/format";
import type { SiteMeta } from "@/lib/schema";

export function Footer({ meta }: { meta: SiteMeta }) {
  return (
    <footer className="mt-16 border-t border-[var(--color-border)] pt-6">
      <div className="flex flex-col items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] sm:flex-row">
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
        <p>Not investment advice. Data may be stale.</p>
      </div>
    </footer>
  );
}

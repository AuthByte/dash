import type { SiteMeta } from "@/lib/schema";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderSimpleMarkdown(md: string): string {
  const escaped = escapeHtml(md);
  return escaped
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="text-[var(--color-gold)] font-semibold">$1</strong>',
    )
    .replace(/_(.+?)_/g, '<em class="italic">$1</em>')
    .replace(/\n\n/g, "</p><p class='mt-3'>");
}

export function ThesisBlock({ meta }: { meta: SiteMeta }) {
  if (!meta.current_thesis_md.trim()) {
    return (
      <section className="liquid-panel overflow-hidden rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-elev)]/60">
        <div className="border-b border-[var(--color-border)] px-5 py-3 sm:px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-gold-dim)]">
            Current thesis
          </p>
        </div>
        <p className="px-5 py-8 font-mono text-[12px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] sm:px-6">
          No thesis yet. Ingest tweets to generate one.
        </p>
      </section>
    );
  }
  const html = `<p>${renderSimpleMarkdown(meta.current_thesis_md)}</p>`;
  return (
    <section className="liquid-panel overflow-hidden rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)]/95">
      <div className="border-b border-[var(--color-border)] px-5 py-3 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-gold-dim)]">
          Current thesis
        </p>
      </div>
      <div
        className="prose-invert px-5 py-5 text-sm leading-relaxed text-[var(--color-text-dim)] sm:px-6 sm:py-6 sm:text-base"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

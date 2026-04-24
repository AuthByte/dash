import type { SiteMeta } from "@/lib/schema";

function renderSimpleMarkdown(md: string): string {
  return md
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="text-[var(--color-gold)] font-semibold">$1</strong>',
    )
    .replace(/_(.+?)_/g, '<em class="italic">$1</em>')
    .replace(/\n\n/g, "</p><p class='mt-3'>");
}

export function ThesisBlock({ meta }: { meta: SiteMeta }) {
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

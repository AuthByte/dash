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
    <section className="overflow-hidden rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)]">
      <div className="border-b border-[var(--color-border)] px-5 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-gold-dim)]">
          / Current Thesis — His Own Words
        </p>
      </div>
      <div
        className="prose-invert px-5 py-4 text-sm leading-relaxed text-[var(--color-text-dim)] sm:text-base"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

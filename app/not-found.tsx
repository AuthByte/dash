import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-gold-dim)]">
        404
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
        Desk not found.
      </h1>
      <p className="mt-4 text-sm text-[var(--color-text-dim)]">
        That profile slug is not in the roster. Pick another desk from home.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-full border border-[var(--color-border-strong)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-gold)]"
      >
        Back to roster
      </Link>
    </main>
  );
}

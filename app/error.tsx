"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-gold-dim)]">
        Something broke
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
        This page could not be rendered.
      </h1>
      <p className="mt-4 text-sm text-[var(--color-text-dim)]">
        {error.message || "Unknown error"}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-8 rounded-full border border-[var(--color-border-strong)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-gold)]"
      >
        Try again
      </button>
    </main>
  );
}

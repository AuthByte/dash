"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-[#0f0e0d] px-6 py-20 text-[#f4f0ea]">
        <main className="mx-auto max-w-xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#9e7a48]">
            Runtime error
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            The desk failed to load.
          </h1>
          <p className="mt-4 text-sm text-[#b5aea4]">
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-8 rounded-full border border-[#3a342e] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#c9a06c]"
          >
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}

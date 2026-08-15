export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-24">
      <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--color-border-strong)]" />
      <div className="mt-8 h-12 w-2/3 animate-pulse rounded-xl bg-[var(--color-bg-card)]" />
      <div className="mt-4 h-24 animate-pulse rounded-2xl bg-[var(--color-bg-card)]" />
    </main>
  );
}

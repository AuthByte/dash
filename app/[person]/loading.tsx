export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="h-12 animate-pulse rounded-2xl bg-[var(--color-bg-card)]" />
      <div className="mt-8 h-40 animate-pulse rounded-2xl bg-[var(--color-bg-card)]" />
      <div className="mt-8 h-64 animate-pulse rounded-2xl bg-[var(--color-bg-card)]" />
    </main>
  );
}

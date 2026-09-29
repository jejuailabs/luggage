export function PlaceholderPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-card p-4">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">{body}</p>
    </section>
  );
}

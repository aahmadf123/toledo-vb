/** The one empty-state treatment: a quiet dashed panel that says what to do next. */
export default function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-navy-700 p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-hex-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-hex-text">{value}</p>
      {hint ? <p className="mt-1 text-xs text-hex-muted-light dark:text-hex-muted">{hint}</p> : null}
    </div>
  );
}

export default function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-rocket-blue-dark">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

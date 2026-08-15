import PageHeader from "@/components/layout/PageHeader";
import { getManifest } from "@/lib/data";
import { fmtEt } from "@/lib/format";

export const metadata = { title: "Data Health — Toledo VB" };

const STATUS_STYLE: Record<string, string> = {
  ok: "bg-sky-100 text-sky-900",
  "ok-with-warnings": "bg-amber-100 text-amber-900",
  error: "bg-orange-200 text-orange-950",
  ignored: "bg-neutral-100 text-neutral-500",
};

export default function HealthPage() {
  const manifest = getManifest();
  const files = Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b));
  const errors = files.filter(([, f]) => f.status === "error");

  const warningCounts = new Map<string, number>();
  for (const [, f] of files) {
    for (const w of f.warnings) {
      warningCounts.set(w.code, (warningCounts.get(w.code) ?? 0) + 1);
    }
  }

  return (
    <div>
      <PageHeader
        title="Data Health"
        subtitle={`Last sync ${fmtEt(manifest.lastSyncAt)} · ${files.length} files tracked${
          errors.length > 0 ? ` · ${errors.length} failing` : ""
        }`}
      />

      {warningCounts.size > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {[...warningCounts.entries()]
            .sort(([, a], [, b]) => b - a)
            .map(([code, count]) => (
              <span
                key={code}
                className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700"
              >
                {code} × {count}
              </span>
            ))}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-4 py-2 font-medium">File</th>
              <th className="px-3 py-2 font-medium">Format</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Warnings</th>
              <th className="px-4 py-2 font-medium">Parsed</th>
            </tr>
          </thead>
          <tbody>
            {files.map(([relPath, f]) => (
              <tr key={relPath} className="border-b border-neutral-100 align-top last:border-0">
                <td className="max-w-72 px-4 py-2">
                  <span className="block truncate font-mono text-xs" title={relPath}>
                    {relPath.replace(/^Fall \d+\//, "")}
                  </span>
                  {f.status === "error" ? (
                    <span className="mt-0.5 block text-xs text-orange-800">{f.error}</span>
                  ) : null}
                  {f.warnings.length > 0 ? (
                    <details className="mt-0.5">
                      <summary className="cursor-pointer text-xs text-neutral-400">
                        show warnings
                      </summary>
                      <ul className="mt-1 space-y-0.5 text-xs text-neutral-500">
                        {f.warnings.map((w, i) => (
                          <li key={i}>
                            <span className="font-mono">[{w.code}]</span> {w.message}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-500">{f.format}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLE[f.status] ?? ""}`}
                  >
                    {f.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{f.warnings.length || ""}</td>
                <td className="px-4 py-2 text-xs text-neutral-400">{fmtEt(f.parsedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-neutral-400">
        error-cell warnings are #ERROR values in the source sheets (divide-by-zero leftovers) —
        they become blanks here, not zeros. A file listed as error was skipped without blocking the
        rest of the sync.
      </p>
    </div>
  );
}

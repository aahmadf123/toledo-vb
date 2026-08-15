import { getManifest } from "@/lib/data";
import { fmtEt } from "@/lib/format";

export default function FreshnessStamp() {
  const manifest = getManifest();
  const files = Object.values(manifest.files);
  const errors = files.filter((f) => f.status === "error").length;
  return (
    <p className="text-xs text-neutral-400">
      Synced {fmtEt(manifest.lastSyncAt)} · {files.length} files
      {errors > 0 ? <span className="text-red-500"> · {errors} with errors</span> : null}
    </p>
  );
}

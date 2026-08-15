import path from "node:path";
import { runIngest } from "../packages/ingest/src";

const args = process.argv.slice(2);
const force = args.includes("--force");
const check = args.includes("--check");
const verbose = args.includes("--verbose");
const fileArgIdx = args.indexOf("--file");
const filePrefix = fileArgIdx !== -1 ? args[fileArgIdx + 1] : undefined;

const rootDir = path.resolve(__dirname, "..");

const summary = runIngest({
  rootDir,
  force,
  check,
  fileFilter: filePrefix ? (p) => p.startsWith(filePrefix) : undefined,
});

const { ok, warned, errored, skipped, ignored } = summary;
console.log(
  `ingest: ${ok.length} ok, ${warned.length} with warnings, ${errored.length} errors, ` +
    `${skipped.length} unchanged, ${ignored.length} ignored${check ? " (check only)" : ""}`
);

if (verbose) {
  for (const p of ok) console.log(`  ok        ${p}`);
  for (const p of skipped) console.log(`  unchanged ${p}`);
  for (const p of ignored) console.log(`  ignored   ${p}`);
}
for (const p of warned) {
  const entry = summary.manifest.files[p];
  console.log(`  warnings  ${p}`);
  for (const w of entry?.warnings ?? []) console.log(`            [${w.code}] ${w.message}`);
}
for (const e of errored) console.log(`  ERROR     ${e.relPath}: ${e.error}`);

// In sync runs, parse errors are recorded in the manifest and must not block
// the commit of healthy files — exit 0. In --check mode the whole point is to
// gate on parse health, so any error is a failure.
process.exit(check && errored.length > 0 ? 1 : 0);

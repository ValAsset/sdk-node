// Verifies the npm tarball file list against the exact publish whitelist.
// Run after `pnpm build` (dist/ must exist).
import { execSync } from "node:child_process";

const EXPECTED = new Set([
  "package.json",
  "README.md",
  "LICENSE",
  "dist/index.js",
  "dist/index.js.map",
  "dist/index.d.ts",
]);

const output = execSync("npm pack --dry-run --json", { encoding: "utf8" });
const [result] = JSON.parse(output);
const files = result.files.map((file) => file.path);

const unexpected = files.filter((file) => !EXPECTED.has(file));
const missing = [...EXPECTED].filter((file) => !files.includes(file));

if (unexpected.length > 0 || missing.length > 0) {
  if (unexpected.length > 0) console.error(`Unexpected files in tarball: ${unexpected.join(", ")}`);
  if (missing.length > 0) console.error(`Missing files in tarball: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`Tarball contents OK (${files.length} files):`);
for (const file of files.sort()) console.log(`  ${file}`);

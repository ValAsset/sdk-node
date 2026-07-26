// Downloads the OpenAPI document from a running ValAsset Server, writes the normalized snapshot
// to openapi/valasset-v1.json, then regenerates src/generated/*.
//
// Usage: pnpm openapi:update [--source <url>]
//
// The script does not start a server, does not retry, does not authenticate and does not commit.
// The source URL never influences generated code or the SDK's default baseURL.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { SNAPSHOT_PATH, normalizeDocument } from "./generate-core.mjs";

const DEFAULT_SOURCE = "http://localhost:5103/openapi/v1.json";

const { values } = parseArgs({ options: { source: { type: "string" } } });
const source = values.source ?? DEFAULT_SOURCE;

console.log(`Fetching OpenAPI document from ${source} ...`);
const response = await fetch(source);
if (!response.ok) {
  console.error(`Fetch failed: HTTP ${response.status} ${response.statusText}`);
  process.exit(1);
}

let document;
try {
  document = await response.json();
} catch {
  console.error("Fetch failed: response body is not valid JSON");
  process.exit(1);
}

if (typeof document?.openapi !== "string" || typeof document?.paths !== "object") {
  console.error("Fetch failed: response is not an OpenAPI document");
  process.exit(1);
}

await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
await writeFile(SNAPSHOT_PATH, normalizeDocument(document), "utf8");
console.log(`Wrote ${SNAPSHOT_PATH}`);

await import("./openapi-generate.mjs");

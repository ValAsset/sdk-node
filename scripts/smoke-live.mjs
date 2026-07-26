// End-to-end smoke against a real, running ValAsset Server using the built SDK (dist/).
// Not part of the test suite: requires `pnpm build` first and a server with real data.
//
// Usage: node scripts/smoke-live.mjs [--base http://localhost:5103]
import { parseArgs } from "node:util";
import { isValAssetError, ValAssetClient } from "../dist/index.js";

const { values } = parseArgs({ options: { base: { type: "string" } } });
const baseURL = values.base ?? "http://localhost:5103";
const client = new ValAssetClient({ baseURL });

let failures = 0;
function check(name, condition, extra = "") {
  const ok = Boolean(condition);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

const agents = await client.agents.list();
check(
  "agents.list returns a non-empty array",
  Array.isArray(agents) && agents.length > 0,
  `${agents.length} agents`,
);
check(
  "agents are localized",
  typeof agents[0]?.displayName === "string",
  agents[0]?.displayName ?? "",
);

const firstUuid = agents[0]?.uuid ?? "";
const oneAgent = await client.agents.get(firstUuid.toUpperCase());
check("agents.get is case-insensitive on uuid", oneAgent.uuid === firstUuid);

const version = await client.version.get();
check("version.get returns the singleton", typeof version.branch === "string", version.branch);

try {
  const locres = await client.locres.get();
  check(
    "locres.get returns a manifest",
    typeof locres.downloadUrl === "string",
    locres.downloadUrl,
  );
} catch (error) {
  // A deployment without extracted locres data legitimately 404s.
  check(
    "locres.get missing data maps to language_not_found",
    isValAssetError(error) && error.code === "language_not_found",
    isValAssetError(error) ? error.code : String(error),
  );
}

try {
  await client.agents.get("00000000-0000-0000-0000-000000000000");
  check("unknown uuid rejects", false);
} catch (error) {
  check(
    "unknown uuid maps to uuid_not_found with status 404",
    isValAssetError(error) && error.code === "uuid_not_found" && error.status === 404,
  );
}

try {
  // Deliberately bypass the Locale type to exercise the server-side 400.
  await client.agents.list({ language: /** @type {never} */ ("xx-XX") });
  check("invalid locale rejects", false);
} catch (error) {
  check(
    "invalid locale maps to validation_failed with status 400",
    isValAssetError(error) && error.code === "validation_failed" && error.status === 400,
  );
}

console.log(failures === 0 ? "\nSmoke OK" : `\nSmoke FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);

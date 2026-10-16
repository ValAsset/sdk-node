// Packs the real npm tarball and verifies it from a consumer's perspective: installs it into a
// throwaway project on the invoking Node version, loads its ESM and CommonJS entry points,
// runs it against a stub HTTP server, and compiles a TypeScript consumer against the published .d.ts. Requires `pnpm build`
// first and network access for `npm install typescript`.
import { execSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const workDir = await mkdtemp(join(tmpdir(), "valasset-tarball-smoke-"));

function run(command, cwd) {
  console.log(`\n> ${command}  (${cwd})`);
  execSync(command, { cwd, stdio: "inherit" });
}

try {
  const packOutput = execSync(`npm pack --json --pack-destination "${workDir}"`, {
    cwd: packageRoot,
    encoding: "utf8",
  });
  const [packed] = JSON.parse(packOutput);
  const tarball = resolve(workDir, packed.filename);
  console.log(`Packed ${tarball}`);

  await writeFile(
    join(workDir, "package.json"),
    JSON.stringify({ name: "valasset-tarball-smoke", private: true, type: "module" }, null, 2),
  );
  run(`npm install "${tarball}" typescript@5 @types/node@24 --no-audit --no-fund`, workDir);

  await writeFile(
    join(workDir, "smoke.cjs"),
    `
const assert = require("node:assert/strict");
const { ValAssetClient, ValAssetError, isValAssetError, locales } = require("@valasset/sdk");

assert.equal(locales.length, 18);
assert.equal(typeof ValAssetClient, "function");
assert.equal(typeof ValAssetError, "function");
assert.equal(typeof isValAssetError, "function");
console.log("CommonJS runtime smoke OK");
`,
  );
  run("node smoke.cjs", workDir);

  await writeFile(
    join(workDir, "smoke.mjs"),
    `
import { createServer } from "node:http";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { ValAssetClient, ValAssetError, isValAssetError, locales } from "@valasset/sdk";

assert.equal(locales.length, 18);
assert.equal(typeof ValAssetClient, "function");
assert.equal(typeof ValAssetError, "function");

const requests = [];
const server = createServer((req, res) => {
  requests.push(req.url);
  res.setHeader("content-type", "application/json");
  if (req.url.startsWith("/v1/version")) {
    res.end(JSON.stringify({ status: 200, data: { branch: "b", productVersion: "26",
      internalVersion: "1", minorVersion: "1", buildTime: null, riotGamesApiVersion: null } }));
    return;
  }
  if (req.url.startsWith("/v1/agents/missing")) {
    res.statusCode = 404;
    res.end(JSON.stringify({ status: 404, code: "uuid_not_found", title: "UUID Not Found",
      detail: "missing", instance: req.url }));
    return;
  }
  if (req.url.startsWith("/v1/agents/example/dialogues")) {
    res.end(JSON.stringify({ status: 200, data: { info: { datasetDigest: "digest" }, dialogues: {} } }));
    return;
  }
  res.end(JSON.stringify({ status: 200, data: [] }));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const client = new ValAssetClient({ baseURL: \`http://127.0.0.1:\${server.address().port}\` });

assert.deepEqual(await client.agents.list(), []);
const cjs = createRequire(import.meta.url)("@valasset/sdk");
for (const consumer of [client, new cjs.ValAssetClient({ baseURL: \`http://127.0.0.1:\${server.address().port}\` })]) {
  for (const includeNonPlayable of [true, false]) {
    await consumer.agents.list({ includeNonPlayable, language: "zh-CN" });
    const url = new URL(requests.at(-1), "http://localhost");
    assert.equal(url.searchParams.get("includeNonPlayable"), String(includeNonPlayable));
    assert.equal(url.searchParams.get("language"), "zh-CN");
  }
  const response = await consumer.agents.dialogues("example", { language: "en-US" });
  assert.equal(requests.at(-1), "/v1/agents/example/dialogues?language=en-US");
  assert.deepEqual(response, { info: { datasetDigest: "digest" }, dialogues: {} });
}
assert.equal((await client.version.get()).branch, "b");
try {
  await client.agents.get("missing");
  assert.fail("expected rejection");
} catch (error) {
  assert.ok(isValAssetError(error));
  assert.equal(error.code, "uuid_not_found");
}
server.close();
console.log("runtime smoke OK");
`,
  );
  run("node smoke.mjs", workDir);

  await writeFile(
    join(workDir, "smoke-types.ts"),
    `
import type { Agent, AgentDialogues, AgentsListOptions, VoiceSubtitle, ClientVersion, Locale, Locres, Weapon } from "@valasset/sdk";
// @ts-expect-error - annotations are internal operator capabilities
import type { SubtitleWriteRequest } from "@valasset/sdk";
import { ValAssetClient, isValAssetError, locales } from "@valasset/sdk";

const language: Locale = "zh-CN";
const client = new ValAssetClient({ language, timeout: 1000 });

async function usage(): Promise<void> {
  const agents: Agent[] = await client.agents.list({ language: "ja-JP" });
  const options: AgentsListOptions = { includeNonPlayable: true, language };
  await client.agents.list(options);
  const dialogues: AgentDialogues = await client.agents.dialogues("agent", { language });
  const subtitle: VoiceSubtitle = { text: null, updatedAt: null, asrText: "ASR" };
  console.log(dialogues.info.datasetDigest, subtitle.text ?? subtitle.asrText);
  // @ts-expect-error - this option is exclusive to the agents list
  await client.maps.list({ includeNonPlayable: true });
  // @ts-expect-error - single-item lookups remain playable-only
  await client.agents.get("agent", { includeNonPlayable: true });
  // @ts-expect-error - voice lookups remain playable-only
  await client.agents.dialogues("agent", { includeNonPlayable: true });
  // @ts-expect-error - removed public subtitle field
  console.log(subtitle.status);
  const version: ClientVersion = await client.version.get();
  const locres: Locres = await client.locres.get();
  const weapons: Weapon[] = await client.weapons.list();
  const skins = await client.weapons.skins.list();
  console.log(agents.length, version.branch, locres.downloadUrl, weapons.length, skins.length);
  try {
    await client.agents.get("x");
  } catch (error) {
    if (isValAssetError(error)) console.log(error.code, error.status);
  }
}
void usage();
console.log(locales.length);

// @ts-expect-error - arbitrary strings are not valid locales
const invalid: Locale = "en-GB";
console.log(invalid);
`,
  );
  await writeFile(
    join(workDir, "smoke-types.cts"),
    `
import { ValAssetClient, type Locale, type AgentsListOptions, type AgentDialogues } from "@valasset/sdk";

const language: Locale = "zh-CN";
const client = new ValAssetClient({ language });
const options: AgentsListOptions = { includeNonPlayable: true, language };
const dialogues: Promise<AgentDialogues> = client.agents.dialogues("agent", options);
console.log(client.agents.list(options), dialogues);
`,
  );
  await writeFile(
    join(workDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          target: "ES2022",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: ["node"],
        },
        include: ["smoke-types.ts", "smoke-types.cts"],
      },
      null,
      2,
    ),
  );
  run("npx tsc -p tsconfig.json", workDir);

  console.log("\nTarball smoke OK");
} finally {
  await rm(workDir, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}

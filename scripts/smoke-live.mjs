// End-to-end smoke against a real, running ValAsset Server using the built SDK (dist/).
// Not part of the test suite: requires `pnpm build` first and a server with real data.
//
// Usage: node scripts/smoke-live.mjs [--base http://localhost:5103] [--language zh-CN]
//
// --language matters against a deployment extracted for a single locale: the default en-US would
// legitimately 404 there, which says nothing about the SDK.
import { isDeepStrictEqual, parseArgs } from "node:util";
import { isValAssetError, ValAssetClient } from "../dist/index.js";

const { values } = parseArgs({
  options: { base: { type: "string" }, language: { type: "string" } },
});
const baseURL = values.base ?? "http://localhost:5103";
const language = values.language;
const client = new ValAssetClient({ baseURL, ...(language ? { language } : {}) });

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
const playable = await client.agents.list({ includeNonPlayable: false });
const allCharacters = await client.agents.list({ includeNonPlayable: true });
check(
  "default agents list is playable-only",
  agents.every((agent) => agent.isPlayableCharacter),
);
check(
  "explicit false matches the default roster",
  isDeepStrictEqual(
    playable.map((agent) => agent.uuid).sort(),
    agents.map((agent) => agent.uuid).sort(),
  ),
);
check(
  "includeNonPlayable contains every playable Agent",
  agents.every((agent) => allCharacters.some((character) => character.uuid === agent.uuid)),
  `${agents.length} playable / ${allCharacters.length} total`,
);
for (const character of allCharacters.filter((agent) => !agent.isPlayableCharacter)) {
  const detail = await client.agents.get(character.uuid.toUpperCase(), {
    includeNonPlayable: true,
  });
  check(
    "non-playable list entries can be fetched by UUID",
    isDeepStrictEqual(detail, character),
    character.displayName,
  );
  for (const options of [{}, { includeNonPlayable: false }]) {
    try {
      await client.agents.get(character.uuid, options);
      check("non-playable UUID lookup requires opt-in", false);
    } catch (error) {
      check(
        "non-playable UUID lookup requires opt-in",
        isValAssetError(error) && error.code === "uuid_not_found",
      );
    }
  }
}
const oneAgent = await client.agents.get(firstUuid.toUpperCase());
check("agents.get is case-insensitive on uuid", oneAgent.uuid === firstUuid);

const voice = await client.agents.voicelines(firstUuid);
check(
  "agents.voicelines returns the four raw normalized maps",
  ["voiceLines", "events", "media", "dialogues"].every(
    (key) => voice[key] !== null && typeof voice[key] === "object",
  ),
  `${Object.keys(voice.voiceLines).length} voice lines, ${Object.keys(voice.media).length} media`,
);
check(
  "voicelines media keys are eight uppercase hex digits",
  Object.keys(voice.media).every((key) => /^[0-9A-F]{8}$/.test(key)),
);
check(
  "voice lines expose authoritative pattern keys",
  Object.values(voice.voiceLines).every(
    (line) => typeof line.patternKey === "string" && line.patternKey.length > 0,
  ),
);
check("raw response omits editorial maps", !("subtitles" in voice) && !("categories" in voice));
check(
  "voicelines info reports the Voice Dataset's own build",
  typeof voice.info.version === "string" && voice.info.version.length > 0,
  voice.info.version,
);
check("voicelines includes datasetDigest", /^[a-f0-9]{64}$/.test(voice.info.datasetDigest));
check(
  "voice events include sound mappings and dialogue references",
  Object.values(voice.events).every(
    (event) =>
      event.soundSources !== null &&
      typeof event.soundSources === "object" &&
      Array.isArray(event.dialogueRefs),
  ),
);
const dialogueResponse = await client.agents.dialogues(firstUuid);
check(
  "dialogues matches the voicelines projection",
  isDeepStrictEqual(dialogueResponse, {
    info: voice.info,
    dialogues: voice.dialogues,
  }),
);

const ready = await client.health.ready.get();
check(
  "health.ready reports healthy and both versions",
  ready.status === "healthy" && typeof ready.voiceVersion === "string",
  `${ready.status}: asset ${ready.assetVersion ?? "(none)"} vs voice ${ready.voiceVersion}`,
);

const coverage = await client.health.voiceCoverage.get();
check(
  "health.voiceCoverage counts add up",
  coverage.withVoiceSubjectCount + coverage.withoutVoiceSubjectCount ===
    coverage.playableAgentCount,
  `${coverage.withVoiceSubjectCount}/${coverage.playableAgentCount} agents have voice, ` +
    `${coverage.unmappedSubjectKeys.length} unmapped subject keys`,
);

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

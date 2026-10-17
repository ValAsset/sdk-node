# @valasset/sdk

Typed Node.js client for the [ValAsset](https://github.com/ValAsset/ValAsset) VALORANT asset API.

The API contract is the server's OpenAPI document: `https://val-api.buguoguo.cn/openapi/v1.json`.
All DTO types in this package are generated from a committed snapshot of that document.

## Requirements

- Node.js **20+**
- ESM and CommonJS are supported. Browsers are not a supported target; the package may happen to
  work there, but only Node is tested.

## Install

```bash
pnpm add @valasset/sdk
# or: npm install / yarn add
```

## Usage

```ts
import { ValAssetClient } from "@valasset/sdk";

const client = new ValAssetClient();

// Collections: list() and get(uuid)
const agents = await client.agents.list();
const allCharacters = await client.agents.list({ includeNonPlayable: true });
const jett = await client.agents.get("add6443a-41bd-e414-f6ad-e58d267f4e95");

// Nested services
const skins = await client.weapons.skins.list();
const chroma = await client.weapons.skinChromas.get("...");
const buddyLevels = await client.buddies.levels.list();
const competitive = await client.seasons.competitive.list();

// Singletons: get()
const version = await client.version.get();

// An Agent's voice lines, in one audio language
const voice = await client.agents.voicelines("707eab51-4836-f488-046a-cda6bf494859", {
  language: "zh-CN",
});

// Operational endpoints
const ready = await client.health.ready.get(); // current Server reports status: "healthy"
```

CommonJS consumers can load the same API with `require`:

```js
const { ValAssetClient } = require("@valasset/sdk");

const client = new ValAssetClient();
```

Methods resolve directly with the business data — the server's `{ status, data }` envelope is
unwrapped internally and never exposed.

### Options

```ts
const client = new ValAssetClient({
  baseURL: "http://localhost:5103", // default: https://val-api.buguoguo.cn (passed to HTTP layer verbatim)
  language: "zh-CN", // default locale for localized endpoints, default: "en-US"
  timeout: 5000, // ms; default 0 = no client-side timeout
  headers: { "X-Custom": "1" }, // merged over the single default header Accept: application/json
});
```

### Languages

Localized endpoints accept a per-request `language` that wins over the client default:

```ts
import { locales, type Locale } from "@valasset/sdk";

const maps = await client.maps.list({ language: "ja-JP" });
console.log(locales); // the 18 supported locales
```

An unsupported locale is rejected by the server with `validation_failed` (HTTP 400); a supported
locale the deployment has no data for yields `language_not_found` (HTTP 404).

### Aborting requests

Every method accepts an `AbortSignal`:

```ts
const controller = new AbortController();
const pending = client.agents.list({ signal: controller.signal });
controller.abort(); // pending rejects with code "request_aborted"
```

### Errors

Every failure rejects with `ValAssetError`; `code` is the stable discriminator:

```ts
import { isValAssetError } from "@valasset/sdk";

try {
  await client.agents.get("unknown-uuid");
} catch (error) {
  if (isValAssetError(error)) {
    error.code; // "uuid_not_found" — server codes pass through unchanged
    error.status; // 404 — present whenever an HTTP response was received
    error.detail; // server diagnostic text (wording not contractual)
    error.instance; // "/v1/agents/unknown-uuid"
  }
}
```

Server codes include `resource_not_found`, `uuid_not_found`, `language_not_found`, `validation_failed`,
`method_not_allowed`, `internal_error`. SDK codes: `network_error`, `request_timeout`,
`request_aborted`, `invalid_response`, `http_error` (an HTTP response that is not a ValAsset
error body, e.g. a proxy or CDN page).

### Voice lines

`agents.list()` returns playable Agents by default. Set `includeNonPlayable: true` to include
non-playable characters. Use the same option for details:

```ts
const character = await client.agents.get(uuid, { includeNonPlayable: true });
```

Both list and UUID lookups default to playable Agents. Voice/dialogue sub-resources still
require a playable Agent. `AgentsRequestOptions` covers list and UUID options;
`AgentsListOptions` remains available for existing consumers.

`client.agents.voicelines(uuid, { language })` returns one Agent's voice lines as top-level
normalized maps — `voiceLines`, `events`, `media` and `dialogues` — rather than a
deeply nested tree, so an Event or an audio file shared by several lines appears once:

```ts
const voice = await client.agents.voicelines(agentUuid, { language: "zh-CN" });
for (const [voiceLineId, line] of Object.entries(voice.voiceLines)) {
  const events = line.eventIds.map((id) => voice.events[id]);
  const urls = events.flatMap((e) => e?.sourceIds ?? []).map((id) => voice.media[id]?.url);
}
```

The map keys are identities, not field names: VoiceLineId (`vl_` + 32 lowercase hex), EventId as
unsigned decimal text, and SourceId as **eight uppercase hex digits**. Audio is raw WEM served from
a CDN — the SDK does not download or decode it.

The `language` option selects audio. `info.displayName` remains the localized Asset name.
Each voice line carries an authoritative `patternKey` for translation matching; event `category`
is the original Wwise category. Voice titles, human categories, subtitles and manually named
speakers are composed and edited by VALORANT PROTOCOL, outside this raw SDK contract.

A supported but unpublished audio locale yields `language_not_found` (404); an unsupported
locale yields `validation_failed` (400). An Agent without voice returns empty maps with 200.

**0.5 migration:** removed `VoiceSubtitle`, `VoiceCategory`, `categories`, `subtitles`, voice/event
human `name`, line human `category`, dialogue `displayName` and recording `subtitle`. Use the VP
composition API for website presentation. `PatternKey` is not a unique identity; `SemanticKey`
remains private. Generated types come from the matching raw-only ValAsset Server.

### Dialogues

```ts
const { info, dialogues } = await client.agents.dialogues(agentUuid, { language: "zh-CN" });
```

This returns the same dialogue projection included in `voicelines`, without the other voice
maps. Definitions contain participants, related characters, turns, groups, pairing evidence
and playback metadata. A turn's `owner` and actual `speaker` can differ. Unavailable recordings
can have null `sourceId` and `media`; The SDK passes
these structures through and does not infer pairing or play audio.

Events expose `soundSources` (decimal SoundNodeId to uppercase-hex SourceId) and `dialogueRefs`
(including nullable `groupId`). For bilingual views, align by EventId + SoundNodeId, and verify
that both responses have matching `info.version` and `info.datasetDigest`. SourceId is not a
cross-language identity. The 18 asset locales do not imply 18 published audio languages; the
current dataset publishes `zh-CN` and `en-US`.

### Health

`client.health` exposes the operational endpoints. The current Server's `ready` response is
HTTP 200 with `status: "healthy"`: the unified database must pass the Voice Dataset startup gates
before the process can serve requests. An unservable Dataset prevents startup. Readiness proves raw dataset availability; VP owns editorial readiness.

```ts
const ready = await client.health.ready.get(); // status: "healthy"
const coverage = await client.health.voiceCoverage.get(); // per-Agent voice coverage
```

### Locres

`client.locres.get({ language })` returns the download manifest for that language's raw
`Game.locres` file — a `downloadUrl` only. The SDK does not download the file for you.

```ts
const { downloadUrl } = await client.locres.get({ language: "zh-CN" });
```

## Semantics worth knowing

- **Collection order is not guaranteed.** Do not rely on the order of `list()` results; only
  explicitly modeled nested orders (weapon skin levels/chromas, contract chapters/levels) are
  meaningful.
- **Dates are strings.** Nothing is converted to `Date`. `ClientVersion.buildTime` has no
  timezone — do not interpret it as UTC.
- **UUIDs are opaque strings**, inserted into request paths verbatim.
- The SDK does **no** pagination, caching, request merging, retrying or default timeouts.

## Updating the SDK (maintainers)

Consumers never need this section. The SDK is snapshot-driven: `openapi/valasset-v1.json` is the
committed contract and everything under `src/generated/` is derived from it. Routes and options
also require handwritten service wiring; regenerating types alone does not send new query
parameters. Review examples and typed fixtures whenever fields or their semantics change.

Maintainer tooling requires Node.js **22.13+** for the pinned pnpm 11 (Node 24 recommended).
The published package continues to support Node.js 20+.

### 1. Refresh the snapshot

Run the ValAsset server locally with a valid derived database containing a finalized Voice
Dataset that passes its startup gates. An empty database cannot start the current Server.
The document itself is independent of dataset contents; the Server's synthetic contract-test
fixture can also boot the real application and export `/openapi/v1.json` using temporary data.
For a running local server:

```bash
pnpm openapi:update                                             # defaults to http://localhost:5103/openapi/v1.json
pnpm openapi:update --source http://127.0.0.1:5199/openapi/v1.json
```

This downloads the document, writes the normalized snapshot and regenerates
`src/generated/openapi.ts` + `src/generated/aliases.ts`. New DTOs automatically get a public type
alias and are re-exported from the package root — no wiring needed.

For a document exported to a file by a contract-test fixture, normalize it with
`normalizeDocument` from `scripts/generate-core.mjs`, save it to `openapi/valasset-v1.json`, then
run `pnpm openapi:generate`. Review the full document diff in either workflow, including operation
parameters and responses. Internal annotations endpoints must not appear in the snapshot.
Localized GET operations retain all 18 locales and the `en-US` default. The SDK exposes GET
services only.

### 2. Update the handwritten layer (only when the shape changed)

| Contract change              | What to touch                                                            |
| ---------------------------- | ------------------------------------------------------------------------ |
| Fields added/removed/retyped | Regenerate types; update fixtures and examples                           |
| New query parameter          | Options, service wiring and transport query forwarding                   |
| New resource route           | Service in `src/client.ts` + the path table in `test/services.test.ts`   |
| New sub-resource of an item  | `itemSubResource` in `src/client.ts` + a case in `test/services.test.ts` |
| New locale                   | Add it to `src/locales.ts`                                               |
| New server error code        | Nothing — server codes pass through unchanged                            |

### 3. Verify

```bash
pnpm check
```

The suite fails loudly on anything missed: `test/generation.test.ts` byte-compares the committed
generated files against a fresh regeneration, `test/locales.test.ts` compares `locales` with the
snapshot's language enum, and the DTO fixtures in `test/dto-fixtures.test.ts` are fully typed so
field changes surface as compile errors.

Optional deeper verification:

```bash
node scripts/smoke-live.mjs --base http://localhost:5103   # real server round-trip (run pnpm build first)
pnpm smoke:tarball                                      # consumer-perspective tarball install
```

### 4. Version and publish

Publishing is manual; this repository has no GitHub Actions CI or automatic npm publishing.
`0.5.0` is already set in `package.json` for this update — do not bump it again before publishing.
From a clean checkout of the release commit:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm smoke:tarball
npm login              # only if your existing npm session is missing or expired
npm publish            # prepublishOnly repeats the full checks and builds fresh dist/
npm view @valasset/sdk version
git tag -a v0.5.0 -m "Release 0.5.0"
git push origin v0.5.0
```

The package is public via `publishConfig.access`. Publish only after the target Server deploys
the matching contract; 0.5 requires the raw voice contract with authoritative patternKey. For future 0.x releases,
use a minor version bump for incompatible contract/type changes, update the migration notes,
and commit the version before publishing. Do not commit `dist/` or npm tarballs.

### Drift check against production

To see whether the deployed server still matches the committed contract, regenerate from it and
inspect the diff (restore afterwards if you were only checking):

```bash
pnpm openapi:update --source https://val-api.buguoguo.cn/openapi/v1.json
git diff
```

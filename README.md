# @valasset/sdk

Typed Node.js client for the [ValAsset](https://github.com/ValAsset/ValAsset) VALORANT asset API.

The API contract is the server's OpenAPI document: `https://val-api.buguoguo.cn/openapi/v1.json`.
All DTO types in this package are generated from a committed snapshot of that document.

## Requirements

- Node.js **20+**
- ESM only (`"type": "module"` — there is no CommonJS build). Browsers are not a supported
  target; the package may happen to work there, but only Node is tested.

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
const jett = await client.agents.get("add6443a-41bd-e414-f6ad-e58d267f4e95");

// Nested services
const skins = await client.weapons.skins.list();
const chroma = await client.weapons.skinChromas.get("...");
const buddyLevels = await client.buddies.levels.list();
const competitive = await client.seasons.competitive.list();

// Singletons: get()
const version = await client.version.get();
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

Server codes: `resource_not_found`, `uuid_not_found`, `language_not_found`, `validation_failed`,
`method_not_allowed`, `internal_error`. SDK codes: `network_error`, `request_timeout`,
`request_aborted`, `invalid_response`, `http_error` (an HTTP response that is not a ValAsset
error body, e.g. a proxy or CDN page).

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

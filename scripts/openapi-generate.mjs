// Regenerates src/generated/* from the committed openapi/valasset-v1.json snapshot.
// Never touches the network; the snapshot is the only input.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  GENERATED_ALIASES_PATH,
  GENERATED_TYPES_PATH,
  generateAliases,
  generateOpenApiTypes,
  readSnapshot,
} from "./generate-core.mjs";

const document = await readSnapshot();

await mkdir(dirname(GENERATED_TYPES_PATH), { recursive: true });
await writeFile(GENERATED_TYPES_PATH, await generateOpenApiTypes(document), "utf8");
await writeFile(GENERATED_ALIASES_PATH, generateAliases(document), "utf8");

console.log(`Generated ${GENERATED_TYPES_PATH}`);
console.log(`Generated ${GENERATED_ALIASES_PATH}`);

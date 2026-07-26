import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  GENERATED_ALIASES_PATH,
  GENERATED_TYPES_PATH,
  generateAliases,
  generateOpenApiTypes,
  normalizeDocument,
  readSnapshot,
} from "../scripts/generate-core.mjs";

describe("generated artifacts stay in sync with the committed snapshot", () => {
  it("the snapshot itself is in normalized form", async () => {
    const raw = await readFile(new URL("../openapi/valasset-v1.json", import.meta.url), "utf8");
    expect(raw).toBe(normalizeDocument(JSON.parse(raw)));
  });

  it("src/generated/openapi.ts regenerates without a diff", async () => {
    const document = await readSnapshot();
    const regenerated = await generateOpenApiTypes(document);
    const committed = await readFile(GENERATED_TYPES_PATH, "utf8");
    expect(committed).toBe(regenerated);
  });

  it("src/generated/aliases.ts regenerates without a diff", async () => {
    const document = await readSnapshot();
    const committed = await readFile(GENERATED_ALIASES_PATH, "utf8");
    expect(committed).toBe(generateAliases(document));
  });

  it("aliases cover every business schema and exclude protocol types", async () => {
    const document = await readSnapshot();
    const committed = await readFile(GENERATED_ALIASES_PATH, "utf8");
    const schemaNames = Object.keys(document.components.schemas);

    expect(schemaNames).toContain("ApiError");
    expect(committed).not.toContain("ApiError");
    for (const name of schemaNames.filter((schemaName: string) => schemaName !== "ApiError")) {
      expect(committed).toContain(`export type ${name} = components["schemas"]["${name}"];`);
    }
  });
});

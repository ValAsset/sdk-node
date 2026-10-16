import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { locales } from "../src/index.js";
import { SNAPSHOT_PATH } from "../scripts/generate-core.mjs";

describe("locales", () => {
  it("is the fixed 18-value closed set", () => {
    expect(locales).toHaveLength(18);
    expect(new Set(locales).size).toBe(18);
    expect(locales).toContain("en-US");
    expect(locales).toContain("zh-CN");
  });

  it.each([
    "/v1/agents",
    "/v1/agents/{uuid}/voicelines",
    "/v1/agents/{uuid}/dialogues",
    "/v1/locres",
  ])("%s keeps the GET language enum and default in the OpenAPI snapshot", async (path) => {
    const document = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
    const languageParameter = document.paths[path].get.parameters.find(
      (parameter: { name: string }) => parameter.name === "language",
    );

    expect(languageParameter.in).toBe("query");
    expect(languageParameter.required).not.toBe(true);
    expect(new Set(languageParameter.schema.enum)).toEqual(new Set(locales));
    expect(languageParameter.schema.default).toBe("en-US");
  });
});

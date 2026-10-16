import { describe, expect, it } from "vitest";
import { readSnapshot } from "../scripts/generate-core.mjs";

describe("public OpenAPI boundary", () => {
  it("does not expose internal annotations endpoints or DTOs", async () => {
    const document = await readSnapshot();
    expect(Object.keys(document.paths).some((path) => path.startsWith("/v1/annotations"))).toBe(
      false,
    );
    expect(document.components.schemas).not.toHaveProperty("SubtitleExportRow");
    expect(document.components.schemas).not.toHaveProperty("SubtitleWriteRequest");
  });
});

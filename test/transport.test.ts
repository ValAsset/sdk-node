import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isValoAssetError, ValoAssetClient } from "../src/index.js";
import { envelope, json, startStubServer, type StubServer } from "./helpers/stub-server.js";

async function expectError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (error) {
    expect(isValoAssetError(error)).toBe(true);
    if (isValoAssetError(error)) {
      expect(error.code).toBe(code);
      return error;
    }
    throw error;
  }
  throw new Error(`Expected rejection with code ${code}, but the promise resolved`);
}

describe("envelope guard", () => {
  let server: StubServer;
  let client: ValoAssetClient;

  beforeAll(async () => {
    server = await startStubServer();
    client = new ValoAssetClient({ baseURL: server.baseURL });
  });
  afterAll(() => server.close());
  beforeEach(() => server.setHandler(envelope({})));

  it("unwraps a valid envelope", async () => {
    server.setHandler(envelope({ branch: "release-13.00" }));
    await expect(client.version.get()).resolves.toEqual({ branch: "release-13.00" });
  });

  it("rejects when the body is not an envelope object", async () => {
    server.setHandler((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html>not json</html>");
    });
    const error = await expectError(client.version.get(), "invalid_response");
    expect(error.status).toBe(200);
  });

  it("rejects when the envelope status disagrees with the HTTP status", async () => {
    server.setHandler(json(200, { status: 201, data: {} }));
    await expectError(client.version.get(), "invalid_response");
  });

  it("rejects when data is missing", async () => {
    server.setHandler(json(200, { status: 200 }));
    await expectError(client.version.get(), "invalid_response");
  });

  it("rejects when data is null", async () => {
    server.setHandler(json(200, { status: 200, data: null }));
    await expectError(client.version.get(), "invalid_response");
  });

  it("accepts an empty array as valid collection data", async () => {
    server.setHandler(envelope([]));
    await expect(client.agents.list()).resolves.toEqual([]);
  });
});

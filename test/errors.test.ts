import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ValoAssetError } from "../src/index.js";
import { isValoAssetError, ValoAssetClient } from "../src/index.js";
import { envelope, json, startStubServer, type StubServer } from "./helpers/stub-server.js";

async function expectValoAssetError(promise: Promise<unknown>): Promise<ValoAssetError> {
  try {
    await promise;
  } catch (error) {
    expect(isValoAssetError(error)).toBe(true);
    return error as ValoAssetError;
  }
  throw new Error("Expected the promise to reject");
}

describe("error mapping", () => {
  let server: StubServer;
  let client: ValoAssetClient;

  beforeAll(async () => {
    server = await startStubServer();
    client = new ValoAssetClient({ baseURL: server.baseURL });
  });
  afterAll(() => server.close());
  beforeEach(() => server.setHandler(envelope({})));

  it("maps a server ApiError onto ValoAssetError fields", async () => {
    server.setHandler(
      json(404, {
        status: 404,
        code: "uuid_not_found",
        title: "UUID Not Found",
        detail: "The requested UUID x on resource Agent was not found",
        instance: "/v1/agents/x",
      }),
    );

    const error = await expectValoAssetError(client.agents.get("x"));
    expect(error.name).toBe("ValoAssetError");
    expect(error.code).toBe("uuid_not_found");
    expect(error.message).toBe("UUID Not Found");
    expect(error.status).toBe(404);
    expect(error.detail).toBe("The requested UUID x on resource Agent was not found");
    expect(error.instance).toBe("/v1/agents/x");
    expect(error.cause).toBeDefined();
  });

  it("keeps every server error code as-is", async () => {
    for (const code of ["language_not_found", "validation_failed", "internal_error"]) {
      const status = code === "validation_failed" ? 400 : code === "internal_error" ? 500 : 404;
      server.setHandler(
        json(status, { status, code, title: "T", detail: "D", instance: "/v1/agents" }),
      );
      const error = await expectValoAssetError(client.agents.list());
      expect(error.code).toBe(code);
      expect(error.status).toBe(status);
    }
  });

  it("maps a non-ApiError HTTP failure (proxy/CDN style) to http_error", async () => {
    server.setHandler((_req, res) => {
      res.writeHead(502, { "content-type": "text/html" });
      res.end("<html>Bad Gateway</html>");
    });
    const error = await expectValoAssetError(client.agents.list());
    expect(error.code).toBe("http_error");
    expect(error.status).toBe(502);
  });

  it("requires all five ApiError fields before trusting the body", async () => {
    // "instance" missing → not a ValoAsset error body, even though it looks close.
    server.setHandler(json(404, { status: 404, code: "uuid_not_found", title: "T", detail: "D" }));
    const error = await expectValoAssetError(client.agents.get("x"));
    expect(error.code).toBe("http_error");
  });

  it("maps connection failures to network_error", async () => {
    const closed = await startStubServer();
    await closed.close();
    const offline = new ValoAssetClient({ baseURL: closed.baseURL });
    const error = await expectValoAssetError(offline.agents.list());
    expect(error.code).toBe("network_error");
    expect(error.status).toBeUndefined();
  });

  it("maps a client-side timeout to request_timeout", async () => {
    server.setHandler((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: 200, data: [] }));
      }, 2_000);
    });
    const impatient = new ValoAssetClient({ baseURL: server.baseURL, timeout: 100 });
    const error = await expectValoAssetError(impatient.agents.list());
    expect(error.code).toBe("request_timeout");
  });

  it("maps AbortSignal cancellation to request_aborted", async () => {
    server.setHandler((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: 200, data: [] }));
      }, 2_000);
    });
    const controller = new AbortController();
    const pending = expectValoAssetError(client.agents.list({ signal: controller.signal }));
    setTimeout(() => controller.abort(), 50);
    const error = await pending;
    expect(error.code).toBe("request_aborted");
  });

  it("isValoAssetError rejects non-SDK errors", () => {
    expect(isValoAssetError(new Error("boom"))).toBe(false);
    expect(isValoAssetError({ name: "ValoAssetError", code: "x" })).toBe(false);
    expect(isValoAssetError(undefined)).toBe(false);
  });
});

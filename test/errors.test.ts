import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ValAssetError } from "../src/index.js";
import { isValAssetError, ValAssetClient } from "../src/index.js";
import { envelope, json, startStubServer, type StubServer } from "./helpers/stub-server.js";

async function expectValAssetError(promise: Promise<unknown>): Promise<ValAssetError> {
  try {
    await promise;
  } catch (error) {
    expect(isValAssetError(error)).toBe(true);
    return error as ValAssetError;
  }
  throw new Error("Expected the promise to reject");
}

describe("error mapping", () => {
  let server: StubServer;
  let client: ValAssetClient;

  beforeAll(async () => {
    server = await startStubServer();
    client = new ValAssetClient({ baseURL: server.baseURL });
  });
  afterAll(() => server.close());
  beforeEach(() => server.setHandler(envelope({})));

  it("maps a server ApiError onto ValAssetError fields", async () => {
    server.setHandler(
      json(404, {
        status: 404,
        code: "uuid_not_found",
        title: "UUID Not Found",
        detail: "The requested UUID x on resource Agent was not found",
        instance: "/v1/agents/x",
      }),
    );

    const error = await expectValAssetError(client.agents.get("x"));
    expect(error.name).toBe("ValAssetError");
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
      const error = await expectValAssetError(client.agents.list());
      expect(error.code).toBe(code);
      expect(error.status).toBe(status);
    }
  });

  it("maps a non-ApiError HTTP failure (proxy/CDN style) to http_error", async () => {
    server.setHandler((_req, res) => {
      res.writeHead(502, { "content-type": "text/html" });
      res.end("<html>Bad Gateway</html>");
    });
    const error = await expectValAssetError(client.agents.list());
    expect(error.code).toBe("http_error");
    expect(error.status).toBe(502);
  });

  it("requires all five ApiError fields before trusting the body", async () => {
    // "instance" missing → not a ValAsset error body, even though it looks close.
    server.setHandler(json(404, { status: 404, code: "uuid_not_found", title: "T", detail: "D" }));
    const error = await expectValAssetError(client.agents.get("x"));
    expect(error.code).toBe("http_error");
  });

  it("maps connection failures to network_error", async () => {
    const closed = await startStubServer();
    await closed.close();
    const offline = new ValAssetClient({ baseURL: closed.baseURL });
    const error = await expectValAssetError(offline.agents.list());
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
    const impatient = new ValAssetClient({ baseURL: server.baseURL, timeout: 100 });
    const error = await expectValAssetError(impatient.agents.list());
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
    const pending = expectValAssetError(client.agents.list({ signal: controller.signal }));
    setTimeout(() => controller.abort(), 50);
    const error = await pending;
    expect(error.code).toBe("request_aborted");
  });

  it("isValAssetError rejects non-SDK errors", () => {
    expect(isValAssetError(new Error("boom"))).toBe(false);
    expect(isValAssetError({ name: "ValAssetError", code: "x" })).toBe(false);
    expect(isValAssetError(undefined)).toBe(false);
  });
});

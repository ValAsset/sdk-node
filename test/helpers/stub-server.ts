import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface RecordedRequest {
  method: string;
  url: string;
  headers: NodeJS.Dict<string | string[]>;
}

export type StubHandler = (req: IncomingMessage, res: ServerResponse) => void;

export interface StubServer {
  baseURL: string;
  requests: RecordedRequest[];
  setHandler(handler: StubHandler): void;
  close(): Promise<void>;
}

/** Minimal real HTTP server so transport behavior (timeouts, aborts, malformed bodies) is tested
 * against the actual network stack rather than mocked axios internals. */
export async function startStubServer(initialHandler?: StubHandler): Promise<StubServer> {
  const requests: RecordedRequest[] = [];
  let handler: StubHandler = initialHandler ?? envelope([]);

  const server = createServer((req, res) => {
    requests.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers });
    handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseURL: `http://127.0.0.1:${port}`,
    requests,
    setHandler: (next) => {
      handler = next;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

export function json(status: number, body: unknown): StubHandler {
  return (_req, res) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
}

/** Standard success envelope response. */
export function envelope(data: unknown, status = 200): StubHandler {
  return json(status, { status, data });
}

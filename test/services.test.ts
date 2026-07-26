import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ValAssetClient } from "../src/index.js";
import { envelope, startStubServer, type StubServer } from "./helpers/stub-server.js";

describe("service hierarchy", () => {
  let server: StubServer;
  let client: ValAssetClient;

  beforeAll(async () => {
    server = await startStubServer();
    client = new ValAssetClient({ baseURL: server.baseURL });
  });
  afterAll(() => server.close());
  beforeEach(() => {
    server.requests.length = 0;
    server.setHandler(envelope([]));
  });

  const lastUrl = () => server.requests.at(-1)?.url;

  // Every service method with its exact slash-leading /v1 path. Localized endpoints carry the
  // default language; version is the only endpoint with no query at all.
  const collectionCases: Array<[string, (c: ValAssetClient) => Promise<unknown>, string]> = [
    ["agents", (c) => c.agents.list(), "/v1/agents"],
    ["buddies", (c) => c.buddies.list(), "/v1/buddies"],
    ["buddies.levels", (c) => c.buddies.levels.list(), "/v1/buddies/levels"],
    ["bundles", (c) => c.bundles.list(), "/v1/bundles"],
    ["ceremonies", (c) => c.ceremonies.list(), "/v1/ceremonies"],
    ["competitiveTiers", (c) => c.competitiveTiers.list(), "/v1/competitivetiers"],
    ["contentTiers", (c) => c.contentTiers.list(), "/v1/contenttiers"],
    ["contracts", (c) => c.contracts.list(), "/v1/contracts"],
    ["currencies", (c) => c.currencies.list(), "/v1/currencies"],
    ["events", (c) => c.events.list(), "/v1/events"],
    ["flex", (c) => c.flex.list(), "/v1/flex"],
    ["gameModes", (c) => c.gameModes.list(), "/v1/gamemodes"],
    ["gameModes.equippables", (c) => c.gameModes.equippables.list(), "/v1/gamemodes/equippables"],
    ["gear", (c) => c.gear.list(), "/v1/gear"],
    ["levelBorders", (c) => c.levelBorders.list(), "/v1/levelborders"],
    ["maps", (c) => c.maps.list(), "/v1/maps"],
    ["playerCards", (c) => c.playerCards.list(), "/v1/playercards"],
    ["playerTitles", (c) => c.playerTitles.list(), "/v1/playertitles"],
    ["seasons", (c) => c.seasons.list(), "/v1/seasons"],
    ["seasons.competitive", (c) => c.seasons.competitive.list(), "/v1/seasons/competitive"],
    ["sprays", (c) => c.sprays.list(), "/v1/sprays"],
    ["sprays.levels", (c) => c.sprays.levels.list(), "/v1/sprays/levels"],
    ["themes", (c) => c.themes.list(), "/v1/themes"],
    ["weapons", (c) => c.weapons.list(), "/v1/weapons"],
    ["weapons.skins", (c) => c.weapons.skins.list(), "/v1/weapons/skins"],
    ["weapons.skinLevels", (c) => c.weapons.skinLevels.list(), "/v1/weapons/skinlevels"],
    ["weapons.skinChromas", (c) => c.weapons.skinChromas.list(), "/v1/weapons/skinchromas"],
  ];

  it.each(collectionCases)("%s.list() hits its canonical path", async (_name, invoke, path) => {
    await invoke(client);
    expect(lastUrl()).toBe(`${path}?language=en-US`);
  });

  it.each(collectionCases)("%s.get(uuid) appends the uuid", async (_name, _invoke, path) => {
    server.setHandler(envelope({}));
    const service = pathToService(client, path);
    await service.get("some-uuid");
    expect(lastUrl()).toBe(`${path}/some-uuid?language=en-US`);
  });

  it("version.get() sends no query parameters at all", async () => {
    server.setHandler(envelope({}));
    await client.version.get();
    expect(lastUrl()).toBe("/v1/version");
  });

  it("locres.get() is language-addressed", async () => {
    server.setHandler(envelope({}));
    await client.locres.get();
    expect(lastUrl()).toBe("/v1/locres?language=en-US");
    await client.locres.get({ language: "ja-JP" });
    expect(lastUrl()).toBe("/v1/locres?language=ja-JP");
  });

  it("uuid values are inserted verbatim: no lower-casing, no encoding", async () => {
    server.setHandler(envelope({}));
    await client.agents.get("ADD6443A-41BD-E414-F6AD-E58D267F4E95");
    expect(lastUrl()).toBe("/v1/agents/ADD6443A-41BD-E414-F6AD-E58D267F4E95?language=en-US");
  });

  it("language priority: per-request beats client default beats en-US", async () => {
    const zhClient = new ValAssetClient({ baseURL: server.baseURL, language: "zh-CN" });
    await zhClient.agents.list();
    expect(lastUrl()).toBe("/v1/agents?language=zh-CN");
    await zhClient.agents.list({ language: "ko-KR" });
    expect(lastUrl()).toBe("/v1/agents?language=ko-KR");
  });

  it("service references are stable and frozen", () => {
    expect(client.agents).toBe(client.agents);
    expect(client.weapons.skins).toBe(client.weapons.skins);
    expect(Object.isFrozen(client.agents)).toBe(true);
    expect(Object.isFrozen(client.weapons)).toBe(true);
    expect(Object.isFrozen(client.version)).toBe(true);
  });

  it("sends Accept: application/json and no Content-Type on GET", async () => {
    await client.agents.list();
    const headers = server.requests.at(-1)?.headers ?? {};
    expect(headers.accept).toBe("application/json");
    expect(headers["content-type"]).toBeUndefined();
  });

  it("global headers can add and override", async () => {
    const custom = new ValAssetClient({
      baseURL: server.baseURL,
      headers: { Accept: "application/vnd.custom+json", "X-Custom": "1" },
    });
    await custom.agents.list();
    const headers = server.requests.at(-1)?.headers ?? {};
    expect(headers.accept).toBe("application/vnd.custom+json");
    expect(headers["x-custom"]).toBe("1");
  });

  it("resolves with the business data, not the envelope or an AxiosResponse", async () => {
    server.setHandler(envelope([{ hello: "world" }]));
    const result = await client.agents.list();
    expect(result).toEqual([{ hello: "world" }]);
  });
});

function pathToService(client: ValAssetClient, path: string) {
  const byPath: Record<string, { get(uuid: string): Promise<unknown> }> = {
    "/v1/agents": client.agents,
    "/v1/buddies": client.buddies,
    "/v1/buddies/levels": client.buddies.levels,
    "/v1/bundles": client.bundles,
    "/v1/ceremonies": client.ceremonies,
    "/v1/competitivetiers": client.competitiveTiers,
    "/v1/contenttiers": client.contentTiers,
    "/v1/contracts": client.contracts,
    "/v1/currencies": client.currencies,
    "/v1/events": client.events,
    "/v1/flex": client.flex,
    "/v1/gamemodes": client.gameModes,
    "/v1/gamemodes/equippables": client.gameModes.equippables,
    "/v1/gear": client.gear,
    "/v1/levelborders": client.levelBorders,
    "/v1/maps": client.maps,
    "/v1/playercards": client.playerCards,
    "/v1/playertitles": client.playerTitles,
    "/v1/seasons": client.seasons,
    "/v1/seasons/competitive": client.seasons.competitive,
    "/v1/sprays": client.sprays,
    "/v1/sprays/levels": client.sprays.levels,
    "/v1/themes": client.themes,
    "/v1/weapons": client.weapons,
    "/v1/weapons/skins": client.weapons.skins,
    "/v1/weapons/skinlevels": client.weapons.skinLevels,
    "/v1/weapons/skinchromas": client.weapons.skinChromas,
  };
  const service = byPath[path];
  if (!service) throw new Error(`No service mapped for ${path}`);
  return service;
}

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  Agent,
  AgentDialogues,
  AgentVoicelines,
  DialogueTurn,
  VoiceDialogue,
  ClientVersion,
  Readiness,
  Contract,
  Locres,
  Map as ValorantMap,
  Weapon,
  WeaponSkin,
} from "../src/index.js";
import { ValAssetClient } from "../src/index.js";
import { envelope, startStubServer, type StubServer } from "./helpers/stub-server.js";

// These fixtures are compile-time proof that realistic server JSON satisfies the generated DTO
// types (every field is present on the wire; nullability is the only optionality), plus a runtime
// proof that the client returns such payloads untouched — no date parsing, no URL rewriting,
// no reordering. There is deliberately no runtime field-by-field DTO validation in the SDK.

const agentFixture: Agent = {
  uuid: "add6443a-41bd-e414-f6ad-e58d267f4e95",
  developerName: "Wushu",
  assetPath: "ShooterGame/Content/Characters/Wushu/Wushu_PrimaryAsset",
  releaseDate: "2020-04-07",
  isFullPortraitRightFacing: false,
  isPlayableCharacter: true,
  isBaseContent: true,
  isAvailableForTest: false,
  displayIcon: "https://cdn.example/agents/add6443a/displayicon.png",
  displayIconSmall: null,
  bustPortrait: null,
  fullPortrait: null,
  fullPortraitV2: null,
  killfeedPortrait: null,
  minimapPortrait: null,
  homeScreenPromoTileImage: null,
  background: null,
  backgroundGradientColors: ["#ffffffff", "#000000ff"],
  recruitmentData: null,
  voiceLine: null,
  displayName: "Jett",
  description: "The wind is at her back.",
  characterTags: ["Duelist tag"],
  role: {
    uuid: "dbe8757e-9e92-4ed4-b39f-9dfc589691d4",
    displayName: "Duelist",
    description: "Self-sufficient fraggers.",
    displayIcon: "https://cdn.example/roles/duelist.png",
    assetPath: "ShooterGame/Content/Characters/_Core/Roles/Assault_PrimaryDataAsset",
  },
  abilities: [
    {
      slot: "Ability1",
      displayName: "Updraft",
      description: "Propel upward.",
      displayIcon: null,
    },
  ],
};

const clientVersionFixture: ClientVersion = {
  branch: "release-china-13.00",
  productVersion: "26",
  internalVersion: "13.00.00.4990809",
  minorVersion: "4990809",
  buildTime: "2026-06-26T18:12:52",
  riotGamesApiVersion: "26.3.5.0",
};

const locresFixture: Locres = {
  downloadUrl: "https://cdn.example/localization/zh-CN/Game.locres",
};

const mapFixture: ValorantMap = {
  uuid: "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319",
  assetPath: "ShooterGame/Content/Maps/Ascent/Ascent_PrimaryAsset",
  mapUrl: "/Game/Maps/Ascent/Ascent",
  displayName: "Ascent",
  narrativeDescription: null,
  tacticalDescription: "A/B Sites",
  coordinates: "45°26'BF'N,12°20'Q'E",
  displayIcon: null,
  listViewIcon: null,
  listViewIconTall: null,
  splash: null,
  stylizedBackgroundImage: null,
  premierBackgroundImage: null,
  xMultiplier: 7e-5,
  yMultiplier: -7e-5,
  xScalarToAdd: 0.813895,
  yScalarToAdd: 0.573242,
  callouts: [
    {
      regionName: "A Site",
      superRegionName: "A",
      superRegion: "EAresCalloutSuperRegion::A",
      location: { x: -4735, y: -7470, z: 120 },
      rotation: { pitch: 0, roll: 0, yaw: 0 },
      scale3D: { x: 1, y: 1, z: 1 },
    },
  ],
};

const contractFixture: Contract = {
  uuid: "cae6ab4a-4b4a-69a0-3c7a-48b17e313f52",
  developerName: "AgentContract_Jett",
  assetPath: "ShooterGame/Content/Contracts/Characters/Contract_Jett_DataAssetV2",
  uiDataAssetPath: "ShooterGame/Content/Contracts/Characters/Jett_UIData",
  displayName: "Jett Contract",
  displayNameAllCaps: "JETT CONTRACT",
  displayIcon: null,
  shipIt: true,
  useLevelVpCostOverride: false,
  levelVpCostOverride: 0,
  freeRewardScheduleUuid: null,
  relatedCharacterUuid: "add6443a-41bd-e414-f6ad-e58d267f4e95",
  relatedCharacterAssetPath: "ShooterGame/Content/Characters/Wushu/Wushu_PrimaryAsset",
  chapterCount: 1,
  content: null,
  chapters: [
    {
      chapterIndex: 0,
      isEpilogue: false,
      levelCount: 1,
      levels: [
        {
          contractUuid: "cae6ab4a-4b4a-69a0-3c7a-48b17e313f52",
          chapterIndex: 0,
          levelIndex: 0,
          xp: 20000,
          vpCost: 200,
          doughCost: 2500,
          purchasableWithVp: true,
          purchasableWithDough: true,
          rewardType: "Spray",
          rewardAmount: 1,
          rewardIsHighlighted: false,
          rewardAssetPath: "ShooterGame/Content/Sprays/Jett/Spray_PrimaryAsset",
          resolvedResourceKind: "sprays",
          resolvedResourceUuid: "0f2f5a29-4a63-2621-3ab4-b3a419a9e5a3",
        },
      ],
      freeRewards: [
        {
          contractUuid: "cae6ab4a-4b4a-69a0-3c7a-48b17e313f52",
          chapterIndex: 0,
          rewardOrder: 0,
          rewardType: "Title",
          rewardAmount: 1,
          rewardIsHighlighted: false,
          rewardAssetPath: null,
          resolvedResourceKind: null,
          resolvedResourceUuid: null,
        },
      ],
    },
  ],
};

const skinFixture: WeaponSkin = {
  uuid: "1ab72e66-4da3-33a0-164f-908113e075a4",
  weaponTypeUuid: "9c82e19d-4575-0200-1a81-3eacf00cf872",
  developerName: "AK Standard",
  assetPath: "ShooterGame/Content/Equippables/Guns/Rifles/AK/Standard/Standard_PrimaryAsset",
  displayIcon: null,
  wallpaper: null,
  themeUuid: null,
  contentTierUuid: null,
  displayName: "Standard Vandal",
  description: null,
  levels: [
    {
      uuid: "5c00d5f5-4bd8-8a4a-2e01-c5a1e0e0a5a1",
      levelNumber: 1,
      assetPath: "ShooterGame/.../Standard_Lv1_PrimaryAsset",
      displayIcon: null,
      fullRender: null,
      swatch: null,
      sniperIcon: null,
      streamedVideo: null,
      levelItem: null,
      displayName: "Standard Vandal",
      charmPosition: null,
    },
  ],
  chromas: [
    {
      uuid: "7e22f7a7-4dfa-ac6c-4a23-e7c3a2a2c7c3",
      developerName: "Standard Chroma A",
      assetPath: "ShooterGame/.../Standard_ChromaA_PrimaryAsset",
      displayIcon: null,
      fullRender: null,
      fullRenderOverride: null,
      swatch: null,
      streamedVideo: null,
      firstChannelHash: null,
      secondChannelHash: null,
      displayName: "Standard Vandal (Variant A)",
    },
  ],
};

const weaponFixture: Weapon = {
  uuid: "9c82e19d-4575-0200-1a81-3eacf00cf872",
  developerName: "AK",
  assetPath: "ShooterGame/Content/Equippables/Guns/Rifles/AK/AK_PrimaryAsset",
  category: "EEquippableCategory::Rifle",
  defaultSkinUuid: "1ab72e66-4da3-33a0-164f-908113e075a4",
  displayIcon: "https://cdn.example/weapons/9c82e19d/displayicon.png",
  killStreamIcon: null,
  displayName: "Vandal",
  shopData: {
    cost: 2900,
    category: "Rifles",
    categoryText: "Rifle",
    shopOrderPriority: 12,
    canBeTrashed: true,
    gridPosition: { row: 1, column: 2 },
    image: null,
    newImage: null,
    newImage2: null,
    assetPath: null,
  },
  weaponStats: {
    fireRate: 9.75,
    magazineSize: 25,
    runSpeedMultiplier: 5.4,
    equipTimeSeconds: 1,
    reloadTimeSeconds: 2.5,
    firstBulletAccuracy: 0.25,
    shotgunPelletCount: 1,
    wallPenetration: "EWallPenetrationDisplayType::Medium",
    feature: null,
    fireMode: "EWeaponFireModeDisplayType::FullyAutomatic",
    altFireType: "EWeaponAltFireDisplayType::ADS",
    adsStats: {
      zoomMultiplier: 1.25,
      fireRate: 9.15,
      burstCount: 1,
      runSpeedMultiplier: 5.4,
      firstBulletAccuracy: 0.25,
    },
    altShotgunStats: null,
    airBurstStats: null,
    damageRanges: [
      {
        rangeStartMeters: 0,
        rangeEndMeters: 50,
        headDamage: 160,
        bodyDamage: 40,
        legDamage: 34,
      },
    ],
  },
  skins: [skinFixture],
};

// The normalized voice-line shape (docs/adr/0004 in the server repo): keys are identities, not
// field names — VoiceLineId, unsigned-decimal EventId, eight-uppercase-hex SourceId — so this
// fixture also guards against a serializer that would camelCase dictionary keys.
const voicelinesFixture: AgentVoicelines = {
  info: {
    agentUuid: "707eab51-4836-f488-046a-cda6bf494859",
    displayName: "蝰蛇",
    developerName: "Pandemic",
    version: "13.02.00.5278054",
    datasetDigest: "63de0a06128af726c457cd74a181c3534f367b0def68f4e6b8dff1be5d61b8bc",
    language: "zh-CN",
    finalizedAt: "2026-08-18T09:53:21.1624888+00:00",
  },
  voiceLines: {
    vl_1062e19587385e31b920da0f55cb670d: {
      patternKey: "AbilityECast",
      eventIds: ["697071556"],
    },
  },
  events: {
    "697071556": {
      eventName: "Play_VO_Pandemic_AbilityECast",
      category: "playable-agent-vo",
      sourceIds: ["63DFE043"],
      soundSources: { "815551142": "63DFE043" },
      dialogueRefs: [
        {
          dialogueId: "dl_example",
          turnIndex: 0,
          soundNodeIds: ["815551142"],
          groupId: "dg_example",
        },
        { dialogueId: "dl_sequence", turnIndex: 1, soundNodeIds: ["815551142"], groupId: null },
      ],
    },
  },
  media: {
    "63DFE043": {
      url: "https://cdn.example/voice/wem/sha256/2b/a4/2ba4204409b1366785a47ada4ea59366ccc7a9131a56a69845206adc73dd09a5.wem",
      contentHash: "2ba4204409b1366785a47ada4ea59366ccc7a9131a56a69845206adc73dd09a5",
      contentLength: 3425,
    },
  },
  dialogues: {},
};

const dialogueTurn: DialogueTurn = {
  owner: {
    subjectKey: "Pandemic",
    agentUuid: voicelinesFixture.info.agentUuid,
    icon: null,
  },
  speaker: {
    kind: "character",
    key: "Wushu",
    icon: null,
    agentUuid: agentFixture.uuid,
  },
  eventId: "697071556",
  eventName: "Play_VO_Example",
  role: null,
  recordings: [
    {
      soundNodeId: "815551142",
      sourceId: "63DFE043",
      media: voicelinesFixture.media["63DFE043"]!,
      availability: "available",
    },
    {
      soundNodeId: "823832948",
      sourceId: null,
      media: null,
      availability: "missing",
    },
  ],
};

const dialogueFixture: VoiceDialogue = {
  id: "dl_example",
  kind: "sequence",
  participants: [dialogueTurn.owner],
  relatedCharacters: [
    {
      character: dialogueTurn.owner,
      relation: "target",
      componentPath: "/Game/Example",
      property: "Character",
    },
  ],
  playback: { state: "partial", pairing: "unresolved" },
  origin: {
    projectId: "project",
    eventId: "697071556",
    sequenceNodeId: "101",
    startSubjectKey: null,
    replySubjectKey: null,
    replyEventId: null,
  },
  turns: [dialogueTurn],
  groups: [
    {
      id: "dg_example",
      key: "01",
      playback: { state: "partial", pairing: "recording-name" },
      turns: [dialogueTurn],
      evidence: {
        source: "recording-name",
        recordings: [
          {
            sourceId: "63DFE043",
            recordingName: "Example_01",
            playlistNodeId: "101",
            playlistIndex: 0,
          },
        ],
      },
    },
    {
      id: "dg_other",
      key: "02",
      playback: { state: "unavailable", pairing: "unresolved" },
      turns: [],
      evidence: null,
    },
  ],
};

const readinessFixture: Readiness = {
  status: "healthy",
  assetVersion: "13.02.00.5278054",
  voiceVersion: "13.02.00.5278054",
  voiceFinalizedAt: "2026-08-18T09:53:21.1624888+00:00",
  voiceLanguages: ["zh-CN"],
};

describe("DTO fixtures round-trip through the client untouched", () => {
  let server: StubServer;
  let client: ValAssetClient;

  beforeAll(async () => {
    server = await startStubServer();
    client = new ValAssetClient({ baseURL: server.baseURL });
  });
  afterAll(() => server.close());

  it("agents", async () => {
    server.setHandler(envelope([agentFixture]));
    await expect(client.agents.list()).resolves.toEqual([agentFixture]);
  });

  it("contracts", async () => {
    server.setHandler(envelope(contractFixture));
    await expect(client.contracts.get(contractFixture.uuid)).resolves.toEqual(contractFixture);
  });

  it("maps", async () => {
    server.setHandler(envelope([mapFixture]));
    await expect(client.maps.list()).resolves.toEqual([mapFixture]);
  });

  it("weapons, including nested skins/levels/chromas", async () => {
    server.setHandler(envelope([weaponFixture]));
    const [weapon] = await client.weapons.list();
    expect(weapon).toEqual(weaponFixture);
    expect(weapon?.skins[0]?.levels[0]?.levelNumber).toBe(1);
  });

  it("version keeps buildTime as the raw timezone-less string", async () => {
    server.setHandler(envelope(clientVersionFixture));
    const version = await client.version.get();
    expect(version).toEqual(clientVersionFixture);
    expect(version.buildTime).toBe("2026-06-26T18:12:52");
  });

  it("agent voice lines keep their identity-shaped map keys verbatim", async () => {
    server.setHandler(envelope(voicelinesFixture));
    const result = await client.agents.voicelines(voicelinesFixture.info.agentUuid, {
      language: "zh-CN",
    });
    expect(result).toEqual(voicelinesFixture);
    // Uppercase hex SourceId survives; a camelCasing key policy would have produced "63dfe043".
    expect(Object.keys(result.media)).toEqual(["63DFE043"]);
    expect(result.voiceLines.vl_1062e19587385e31b920da0f55cb670d?.patternKey).toBe("AbilityECast");
    expect(result).not.toHaveProperty("subtitles");
    expect(result).not.toHaveProperty("categories");
  });

  it.each(["zh-CN", "en-US"] as const)(
    "%s selects audio without editorial fields",
    async (language) => {
      const fixture: AgentVoicelines = {
        ...voicelinesFixture,
        info: { ...voicelinesFixture.info, language },
      };
      server.setHandler(envelope(fixture));
      const result = await client.agents.voicelines(fixture.info.agentUuid, { language });
      expect(result).toEqual(fixture);
      expect(server.requests.at(-1)?.url).toBe(
        `/v1/agents/${fixture.info.agentUuid}/voicelines?language=${language}`,
      );
    },
  );

  it("keeps lines and events with no source in the requested audio language", async () => {
    const fixture: AgentVoicelines = {
      ...voicelinesFixture,
      events: {
        "697071556": {
          eventName: "Play_VO_Pandemic_AbilityECast",
          category: "playable-agent-vo",
          sourceIds: [],
          soundSources: {},
          dialogueRefs: [],
        },
      },
      media: {},
    };
    server.setHandler(envelope(fixture));
    await expect(
      client.agents.voicelines(fixture.info.agentUuid, { language: "zh-CN" }),
    ).resolves.toEqual(fixture);
  });

  it("keeps all four empty maps for an Agent without voice", async () => {
    const fixture: AgentVoicelines = {
      info: { ...voicelinesFixture.info, finalizedAt: null },
      voiceLines: {},
      events: {},
      media: {},
      dialogues: {},
    };
    server.setHandler(envelope(fixture));
    await expect(
      client.agents.voicelines(fixture.info.agentUuid, { language: "zh-CN" }),
    ).resolves.toEqual(fixture);
  });

  it("readiness reports healthy and matching build versions over HTTP 200", async () => {
    server.setHandler(envelope(readinessFixture));
    await expect(client.health.ready.get()).resolves.toEqual(readinessFixture);
  });

  it("preserves dialogue groups, evidence, distinct speakers and unavailable recordings", async () => {
    const dialogues = { dl_example: dialogueFixture };
    const fixture: AgentDialogues = { info: voicelinesFixture.info, dialogues };
    server.setHandler(envelope(fixture));
    await expect(client.agents.dialogues(fixture.info.agentUuid)).resolves.toEqual(fixture);

    const full: AgentVoicelines = { ...voicelinesFixture, dialogues };
    server.setHandler(envelope(full));
    await expect(client.agents.voicelines(fixture.info.agentUuid)).resolves.toEqual(full);
  });

  it("locres returns the manifest only — no download helper exists", async () => {
    server.setHandler(envelope(locresFixture));
    const locres = await client.locres.get({ language: "zh-CN" });
    expect(locres).toEqual(locresFixture);
    expect(Object.keys(client.locres)).toEqual(["get"]);
  });
});

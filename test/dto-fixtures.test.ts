import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  Agent,
  ClientVersion,
  Contract,
  Locres,
  Map as ValorantMap,
  Weapon,
  WeaponSkin,
} from "../src/index.js";
import { ValoAssetClient } from "../src/index.js";
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

describe("DTO fixtures round-trip through the client untouched", () => {
  let server: StubServer;
  let client: ValoAssetClient;

  beforeAll(async () => {
    server = await startStubServer();
    client = new ValoAssetClient({ baseURL: server.baseURL });
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

  it("locres returns the manifest only — no download helper exists", async () => {
    server.setHandler(envelope(locresFixture));
    const locres = await client.locres.get({ language: "zh-CN" });
    expect(locres).toEqual(locresFixture);
    expect(Object.keys(client.locres)).toEqual(["get"]);
  });
});

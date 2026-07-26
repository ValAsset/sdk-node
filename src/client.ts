import type {
  Agent,
  Buddy,
  BuddyLevel,
  Bundle,
  Ceremony,
  ClientVersion,
  CompetitiveSeason,
  CompetitiveTier,
  ContentTier,
  Contract,
  Currency,
  Event,
  Flex,
  GameMode,
  GameModeEquippable,
  Gear,
  LevelBorder,
  Locres,
  Map,
  PlayerCard,
  PlayerTitle,
  Season,
  Spray,
  SprayLevel,
  Theme,
  Weapon,
  WeaponSkin,
  WeaponSkinChroma,
  WeaponSkinLevel,
} from "./generated/aliases.js";
import type { ValoAssetClientOptions } from "./options.js";
import {
  collection,
  localizedSingleton,
  singleton,
  type CollectionService,
  type LocalizedSingletonService,
  type SingletonService,
} from "./services.js";
import { Transport } from "./transport.js";

interface BuddiesService extends CollectionService<Buddy> {
  readonly levels: CollectionService<BuddyLevel>;
}

interface GameModesService extends CollectionService<GameMode> {
  readonly equippables: CollectionService<GameModeEquippable>;
}

interface SeasonsService extends CollectionService<Season> {
  readonly competitive: CollectionService<CompetitiveSeason>;
}

interface SpraysService extends CollectionService<Spray> {
  readonly levels: CollectionService<SprayLevel>;
}

interface WeaponsService extends CollectionService<Weapon> {
  readonly skins: CollectionService<WeaponSkin>;
  readonly skinLevels: CollectionService<WeaponSkinLevel>;
  readonly skinChromas: CollectionService<WeaponSkinChroma>;
}

/**
 * Typed client for the ValoAsset API.
 *
 * ```ts
 * const client = new ValoAssetClient();
 * const agents = await client.agents.list({ language: "zh-CN" });
 * ```
 *
 * Every service reference is created once in the constructor and is stable and read-only.
 * All methods resolve with the business data directly (the `{ status, data }` envelope is
 * unwrapped internally) and reject with {@link ValoAssetError}.
 */
export class ValoAssetClient {
  readonly agents: CollectionService<Agent>;
  readonly buddies: BuddiesService;
  readonly bundles: CollectionService<Bundle>;
  readonly ceremonies: CollectionService<Ceremony>;
  readonly competitiveTiers: CollectionService<CompetitiveTier>;
  readonly contentTiers: CollectionService<ContentTier>;
  readonly contracts: CollectionService<Contract>;
  readonly currencies: CollectionService<Currency>;
  readonly events: CollectionService<Event>;
  readonly flex: CollectionService<Flex>;
  readonly gameModes: GameModesService;
  readonly gear: CollectionService<Gear>;
  readonly levelBorders: CollectionService<LevelBorder>;
  readonly locres: LocalizedSingletonService<Locres>;
  readonly maps: CollectionService<Map>;
  readonly playerCards: CollectionService<PlayerCard>;
  readonly playerTitles: CollectionService<PlayerTitle>;
  readonly seasons: SeasonsService;
  readonly sprays: SpraysService;
  readonly themes: CollectionService<Theme>;
  readonly version: SingletonService<ClientVersion>;
  readonly weapons: WeaponsService;

  constructor(options: ValoAssetClientOptions = {}) {
    const transport = new Transport(options);

    this.agents = collection<Agent>(transport, "/v1/agents");
    this.buddies = Object.freeze({
      ...collection<Buddy>(transport, "/v1/buddies"),
      levels: collection<BuddyLevel>(transport, "/v1/buddies/levels"),
    });
    this.bundles = collection<Bundle>(transport, "/v1/bundles");
    this.ceremonies = collection<Ceremony>(transport, "/v1/ceremonies");
    this.competitiveTiers = collection<CompetitiveTier>(transport, "/v1/competitivetiers");
    this.contentTiers = collection<ContentTier>(transport, "/v1/contenttiers");
    this.contracts = collection<Contract>(transport, "/v1/contracts");
    this.currencies = collection<Currency>(transport, "/v1/currencies");
    this.events = collection<Event>(transport, "/v1/events");
    this.flex = collection<Flex>(transport, "/v1/flex");
    this.gameModes = Object.freeze({
      ...collection<GameMode>(transport, "/v1/gamemodes"),
      equippables: collection<GameModeEquippable>(transport, "/v1/gamemodes/equippables"),
    });
    this.gear = collection<Gear>(transport, "/v1/gear");
    this.levelBorders = collection<LevelBorder>(transport, "/v1/levelborders");
    this.locres = localizedSingleton<Locres>(transport, "/v1/locres");
    this.maps = collection<Map>(transport, "/v1/maps");
    this.playerCards = collection<PlayerCard>(transport, "/v1/playercards");
    this.playerTitles = collection<PlayerTitle>(transport, "/v1/playertitles");
    this.seasons = Object.freeze({
      ...collection<Season>(transport, "/v1/seasons"),
      competitive: collection<CompetitiveSeason>(transport, "/v1/seasons/competitive"),
    });
    this.sprays = Object.freeze({
      ...collection<Spray>(transport, "/v1/sprays"),
      levels: collection<SprayLevel>(transport, "/v1/sprays/levels"),
    });
    this.themes = collection<Theme>(transport, "/v1/themes");
    this.version = singleton<ClientVersion>(transport, "/v1/version");
    this.weapons = Object.freeze({
      ...collection<Weapon>(transport, "/v1/weapons"),
      skins: collection<WeaponSkin>(transport, "/v1/weapons/skins"),
      skinLevels: collection<WeaponSkinLevel>(transport, "/v1/weapons/skinlevels"),
      skinChromas: collection<WeaponSkinChroma>(transport, "/v1/weapons/skinchromas"),
    });
  }
}

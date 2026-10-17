import type {
  Agent,
  AgentDialogues,
  AgentVoicelines,
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
  Liveness,
  Locres,
  Map,
  PlayerCard,
  PlayerTitle,
  Readiness,
  Season,
  Spray,
  SprayLevel,
  Theme,
  VoiceCoverage,
  Weapon,
  WeaponSkin,
  WeaponSkinChroma,
  WeaponSkinLevel,
} from "./generated/aliases.js";
import type { AgentsListOptions, AgentsRequestOptions, ValAssetClientOptions } from "./options.js";
import {
  collection,
  itemSubResource,
  localizedSingleton,
  singleton,
  type CollectionService,
  type ItemSubResource,
  type LocalizedSingletonService,
  type SingletonService,
} from "./services.js";
import { Transport } from "./transport.js";

interface AgentsService extends CollectionService<Agent> {
  /** List playable Agents by default; optionally include non-playable characters. */
  list(options?: AgentsListOptions): Promise<Agent[]>;

  /** Fetch an Agent by UUID; opt in to non-playable characters with the same option as list. */
  get(uuid: string, options?: AgentsRequestOptions): Promise<Agent>;

  /**
   * Voice lines of one Agent, in one audio language.
   *
   * The `language` option selects audio; `info.displayName` follows the Agent locale.
   * Lines provide authoritative `patternKey` plus event relationships. Event category is the
   * original Wwise category. Human titles, categories and subtitles are owned by Protocol.
   * Unpublished locales reject with `language_not_found`; Agents without voice return empty maps.
   */
  readonly voicelines: ItemSubResource<AgentVoicelines>;

  /** Dialogue definitions, groups and recordings for one playable Agent and audio language. */
  readonly dialogues: ItemSubResource<AgentDialogues>;
}

/**
 * Operational endpoints. The current Server's `ready` response is HTTP 200 with status `healthy`:
 * an unservable Voice Dataset fails startup. This does not establish ASR coverage, annotations
 * write availability or completed human proofreading.
 */
interface HealthService {
  readonly live: SingletonService<Liveness>;
  readonly ready: SingletonService<Readiness>;
  readonly voiceCoverage: SingletonService<VoiceCoverage>;
}

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
 * Typed client for the ValAsset API.
 *
 * ```ts
 * const client = new ValAssetClient();
 * const agents = await client.agents.list({ language: "zh-CN" });
 * ```
 *
 * Every service reference is created once in the constructor and is stable and read-only.
 * All methods resolve with the business data directly (the `{ status, data }` envelope is
 * unwrapped internally) and reject with {@link ValAssetError}.
 */
export class ValAssetClient {
  readonly agents: AgentsService;
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
  readonly health: HealthService;
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

  constructor(options: ValAssetClientOptions = {}) {
    const transport = new Transport(options);

    this.agents = Object.freeze({
      ...collection<Agent>(transport, "/v1/agents"),
      list: (options: AgentsListOptions = {}) =>
        transport.getLocalized<Agent[]>(
          "/v1/agents",
          options,
          options.includeNonPlayable === undefined
            ? {}
            : { includeNonPlayable: options.includeNonPlayable },
        ),
      get: (uuid: string, options: AgentsRequestOptions = {}) =>
        transport.getLocalized<Agent>(
          `/v1/agents/${uuid}`,
          options,
          options.includeNonPlayable === undefined
            ? {}
            : { includeNonPlayable: options.includeNonPlayable },
        ),
      voicelines: itemSubResource<AgentVoicelines>(transport, "/v1/agents", "voicelines"),
      dialogues: itemSubResource<AgentDialogues>(transport, "/v1/agents", "dialogues"),
    });
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
    this.health = Object.freeze({
      live: singleton<Liveness>(transport, "/health/live"),
      ready: singleton<Readiness>(transport, "/health/ready"),
      voiceCoverage: singleton<VoiceCoverage>(transport, "/health/voice-coverage"),
    });
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

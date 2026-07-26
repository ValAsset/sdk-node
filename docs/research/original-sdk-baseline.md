# `@valapi/valorant-api.com` 原始 SDK 行为基线

研究日期：2026-07-25

## 结论摘要

- 本文把 npm 当前 `latest` 指向的 `5.0.0-beta.3` 作为主基线。它是 2024-08-10 发布的最后一个版本；npm 当前明确将整个包标记为 deprecated / unmaintained。上一稳定版是 `4.0.0`。[S1]
- `5.0.0-beta.3` 是一个 CommonJS、Axios 驱动的薄封装：23 个 service 类公开 59 个无鉴权 `GET` 方法；方法本身不转换、验证、缓存、重试或解包响应。[S2][S3]
- 所有 endpoint 的返回值都是完整的 `AxiosResponse` Promise。业务 envelope 的声明是 `{ status: number; data?: T; error?: string }`；默认情况下非 2xx 会由 Axios 拒绝为 `AxiosError`，SDK 没有自定义错误类或 catch/rethrow。[S4][S8]
- 5.x 的固定 origin 是 `https://valorant-api.com`。即使 `axiosConfig.baseURL` 由调用者传入也会被覆盖；若要对兼容服务迁移，必须改源码或新增显式 `baseURL` 配置，现有公开配置无法完成换源。[S3]
- 5.x 相比 4.0.0 有一个容易漏掉的行为变化：4.0.0 默认发送 `language=en-US` 与 `responseOptions=ignore_null`，5.x 在配置省略时不再提供这两个 SDK 默认值，实际响应依赖服务端默认行为。[S3][S9]
- npm tarball 没有源文件和测试，只有构建后的 JS / `.d.ts`、README、CHANGELOG 等 56 个文件；本文以 tarball 为发布事实，并以其 `gitHead=af9b0d2...` 对应的一手仓库源码及测试交叉检查。[S1][S2][S5]

## 研究范围与证据强度

开始研究时目标工作区为空、不是 Git 仓库，因而不存在可读的本地 package 源码、README、测试或历史。本文使用以下一手资料：npm registry 元数据、npm 官方 tarball、包元数据声明的官方 GitHub 仓库与精确 `gitHead`、Axios 官方文档。[S1][S2][S3][S8]

证据优先级如下：

1. `5.0.0-beta.3` npm tarball 中的运行时 JS：消费者实际安装、执行的行为。[S2]
2. 同一 tarball 的 `.d.ts`：消费者看到的 TypeScript API 与数据模型。[S2][S4]
3. tarball 指向的精确 Git 提交 `af9b0d2...`：可读源代码与测试。[S3][S5]
4. README / CHANGELOG：作者陈述；当示例与发布代码冲突时，以发布代码为准。[S6]

下文的“没有缓存/重试/验证”等结论指 SDK 自身没有实现；调用者仍可通过 Axios adapter、transport 或拦截器在 SDK 外部引入这些行为。

## 包、模块与导出面

`5.0.0-beta.3` 的 manifest 指定 `main: build/index.js`、`types: ./build/index.d.ts`，没有 `exports`、`module`、`browser`、`sideEffects` 或 `engines` 字段。构建产物是 CommonJS (`require`, `exports`)；官方声明的直接依赖为 `axios ^1.7.3` 和固定版本 `@valapi/lib 5.0.0-beta.3`，后者又依赖 `tslib ^2.6.3`。[S1][S2]

运行时具名导出如下，并且 `default === ValorantApiCom`：[S4]

```text
ValorantApiCom (default and named)
ValorantApiComService
Agents, Buddies, Bundles, Ceremonies, CompetitiveTiers, ContentTiers,
Contracts, Currencies, Events, Gamemodes, Gear, Internal, LevelBorders,
Maps, Missions, Objectives, PlayerCards, PlayerTitles, Seasons, Sprays,
Themes, Version, Weapons
```

仅类型导出如下：[S4]

```ts
Language
Config<L>
AllLanguageResponse<T>
LanguageResponse<T, L>
Response<T>
```

每个 service 文件还使用“同名 class + 同名 namespace”的声明合并方式公开数据接口，例如值 `Agents` 与类型 `Agents.Agents<L>`。由于没有 `exports` map，`build/...` 深路径在 Node 中事实上可解析，但它不是 README 承诺的入口，重构时不应当视作稳固的公开契约。[S2][S4][S6]

## 构造、配置与请求实例

公开构造签名为：[S3][S4]

```ts
new ValorantApiCom<L extends Language>(config?: {
  language?: L
  axiosConfig?: CreateAxiosDefaults
  responseOptions?: { ignore_null?: boolean }
})
```

构造器创建一个 Axios instance，合并顺序准确如下：[S3]

```ts
axios.create({
  ...config.axiosConfig,
  baseURL: "https://valorant-api.com",
  headers: {
    ...config.axiosConfig?.headers,
    "Content-Type": "application/json"
  },
  params: {
    ...config.axiosConfig?.params,
    language: config.language,
    responseOptions: config.responseOptions
      ? Object.entries(config.responseOptions)
          .filter(entry => entry[1])
          .map(entry => entry[0])
          .join(" ")
      : undefined
  }
})
```

由此产生的兼容性约束：[S3]

- `baseURL` 始终被 SDK 固定值覆盖；用户不能通过 `axiosConfig.baseURL` 换源。
- `Content-Type` 被固定为 `application/json`，覆盖同名用户 header；其他 headers 保留。
- `axiosConfig.params.language` 和 `.responseOptions` 也会被顶层字段覆盖，即使顶层字段为 `undefined`。
- `responseOptions` 只序列化 truthy 项，以空格连接。目前公开类型只有 `ignore_null`，所以 `{ ignore_null: true }` 变成 `responseOptions=ignore_null`，`false` 变成空字符串。
- 其他 Axios defaults（如 `timeout`、`auth`、`proxy`、`validateStatus`、adapter、transform）按 Axios 语义保留。
- `request` 在 TypeScript 中是 `protected readonly AxiosInstance`，不是公开的自定义 request 方法；运行时只是普通对象属性。
- 每次读取 `client.Agents`、`client.Maps` 等 getter 都 `new` 一个新的 service wrapper，但共享同一个 Axios instance。service 自身没有状态。
- service 方法没有接受单次请求 config 的参数，也不对 UUID 做 URL encoding；UUID 会直接插入 path。

### 语言类型

`Language` 来源于 `@valapi/lib` 的 locale 表，排除 `en-GB` 后再加入特殊值 `all`。有效值共 19 个：[S7]

```text
ar-AE, de-DE, en-US, es-ES, es-MX, fr-FR, id-ID, it-IT, ja-JP,
ko-KR, pl-PL, pt-BR, ru-RU, th-TH, tr-TR, vi-VN, zh-CN, zh-TW, all
```

语言敏感字段使用条件类型：

```ts
type AllLanguageResponse<T> = Record<Exclude<Language, "all">, T>
type LanguageResponse<T, L extends Language> =
  L extends "all" ? AllLanguageResponse<T> : T
```

因此 `language: "all"` 时不是将整个资源按语言复制，而是每个被标注为语言敏感的字段变成 18 个 locale key 的 record。`Missions`、`Objectives`、`Version`、`Internal.RiotClientVersion` 和 competitive-season 数据模型不使用该泛型。[S4]

## 完整 endpoint 方法矩阵

以下 59 个方法均不带请求 body，均直接返回 `this.request.get(...)` 的结果。`uuid` 参数的公开类型都是 `string`。[S10]

| Service | SDK 方法 | HTTP path | `data` 类型 |
|---|---|---|---|
| `Agents<L>` | `get(isPlayableCharacter = true)` | `/v1/agents?isPlayableCharacter=...` | `Agents.Agents<L>[]` |
| | `getByUuid(uuid)` | `/v1/agents/{uuid}` | `Agents.Agents<L>` |
| `Buddies<L>` | `get()` | `/v1/buddies` | `Buddies.Buddies<L>[]` |
| | `getLevels()` | `/v1/buddies/levels` | `Buddies.BuddyLevels<L>[]` |
| | `getByUuid(uuid)` | `/v1/buddies/{uuid}` | `Buddies.Buddies<L>` |
| | `getLevelByUuid(uuid)` | `/v1/buddies/levels/{uuid}` | `Buddies.BuddyLevels<L>` |
| `Bundles<L>` | `get()` | `/v1/bundles` | `Bundles.Bundles<L>[]` |
| | `getByUuid(uuid)` | `/v1/bundles/{uuid}` | `Bundles.Bundles<L>` |
| `Ceremonies<L>` | `get()` | `/v1/ceremonies` | `Ceremonies.Ceremonies<L>[]` |
| | `getByUuid(uuid)` | `/v1/ceremonies/{uuid}` | `Ceremonies.Ceremonies<L>` |
| `CompetitiveTiers<L>` | `get()` | `/v1/competitivetiers` | `CompetitiveTiers.CompetitiveTiers<L>[]` |
| | `getByUuid(uuid)` | `/v1/competitivetiers/{uuid}` | `CompetitiveTiers.CompetitiveTiers<L>` |
| `ContentTiers<L>` | `get()` | `/v1/contenttiers` | `ContentTiers.ContentTiers<L>[]` |
| | `getByUuid(uuid)` | `/v1/contenttiers/{uuid}` | `ContentTiers.ContentTiers<L>` |
| `Contracts<L>` | `get()` | `/v1/contracts` | `Contracts.Contracts<L>[]` |
| | `getByUuid(uuid)` | `/v1/contracts/{uuid}` | `Contracts.Contracts<L>` |
| `Currencies<L>` | `get()` | `/v1/currencies` | `Currencies.Currencies<L>[]` |
| | `getByUuid(uuid)` | `/v1/currencies/{uuid}` | `Currencies.Currencies<L>` |
| `Events<L>` | `get()` | `/v1/events` | `Events.Events<L>[]` |
| | `getByUuid(uuid)` | `/v1/events/{uuid}` | `Events.Events<L>` |
| `Gamemodes<L>` | `get()` | `/v1/gamemodes` | `Gamemodes.Gamemodes<L>[]` |
| | `getEquippables()` | `/v1/gamemodes/equippables` | `Gamemodes.GamemodeEquippables<L>[]` |
| | `getByUuid(uuid)` | `/v1/gamemodes/{uuid}` | `Gamemodes.Gamemodes<L>` |
| | `getEquippableByUuid(uuid)` | `/v1/gamemodes/equippables/{uuid}` | `Gamemodes.GamemodeEquippables<L>` |
| `Gear<L>` | `get()` | `/v1/gear` | `Gear.Gear<L>[]` |
| | `getByUuid(uuid)` | `/v1/gear/{uuid}` | `Gear.Gear<L>` |
| `Internal<L>` | `uuid()` | `/internal/uuids` | `Internal.UUID<L>[]` |
| | `riotClientVersion()` | `/internal/ritoclientversion` | `Internal.RiotClientVersion` |
| `LevelBorders<L>` | `get()` | `/v1/levelborders` | `LevelBorders.LevelBorders<L>[]` |
| | `getByUuid(uuid)` | `/v1/levelborders/{uuid}` | `LevelBorders.LevelBorders<L>` |
| `Maps<L>` | `get()` | `/v1/maps` | `Maps.Maps<L>[]` |
| | `getByUuid(uuid)` | `/v1/maps/{uuid}` | `Maps.Maps<L>` |
| `Missions` | `get()` | `/v1/missions` | `Missions.Missions[]` |
| | `getByUuid(uuid)` | `/v1/missions/{uuid}` | `Missions.Missions` |
| `Objectives` | `get()` | `/v1/objectives` | `Objectives.Objectives[]` |
| | `getByUuid(uuid)` | `/v1/objectives/{uuid}` | `Objectives.Objectives` |
| `PlayerCards<L>` | `get()` | `/v1/playercards` | `PlayerCards.PlayerCards<L>[]` |
| | `getByUuid(uuid)` | `/v1/playercards/{uuid}` | `PlayerCards.PlayerCards<L>` |
| `PlayerTitles<L>` | `get()` | `/v1/playertitles` | `PlayerTitles.PlayerTitles<L>[]` |
| | `getByUuid(uuid)` | `/v1/playertitles/{uuid}` | `PlayerTitles.PlayerTitles<L>` |
| `Seasons<L>` | `get()` | `/v1/seasons` | `Seasons.Seasons<L>[]` |
| | `getCompetitiveSeasons()` | `/v1/seasons/competitive` | `Seasons.CompetitiveSeasons[]` |
| | `getByUuid(uuid)` | `/v1/seasons/{uuid}` | `Seasons.Seasons<L>` |
| | `getCompetitiveSeasonByUuid(uuid)` | `/v1/seasons/competitive/{uuid}` | `Seasons.CompetitiveSeasons` |
| `Sprays<L>` | `get()` | `/v1/sprays` | `Sprays.Sprays<L>[]` |
| | `getLevels()` | `/v1/sprays/levels` | `Sprays.SprayLevels<L>[]` |
| | `getByUuid(uuid)` | `/v1/sprays/{uuid}` | `Sprays.Sprays<L>` |
| | `getLevelByUuid(uuid)` | `/v1/sprays/levels/{uuid}` | `Sprays.SprayLevels<L>` |
| `Themes<L>` | `get()` | `/v1/themes` | `Themes.Themes<L>[]` |
| | `getByUuid(uuid)` | `/v1/themes/{uuid}` | `Themes.Themes<L>` |
| `Version` | `get()` | `/v1/version` | `Version.Version` |
| `Weapons<L>` | `get()` | `/v1/weapons` | `Weapons.Weapons<L>[]` |
| | `getSkins()` | `/v1/weapons/skins` | `Weapons.WeaponSkins<L>[]` |
| | `getSkinChromas()` | `/v1/weapons/skinchromas` | `Weapons.WeaponSkinChromas<L>[]` |
| | `getSkinLevels()` | `/v1/weapons/skinlevels` | `Weapons.WeaponSkinLevels<L>[]` |
| | `getByUuid(uuid)` | `/v1/weapons/{uuid}` | `Weapons.Weapons<L>` |
| | `getSkinByUuid(uuid)` | `/v1/weapons/skins/{uuid}` | `Weapons.WeaponSkins<L>` |
| | `getSkinChromaByUuid(uuid)` | `/v1/weapons/skinchromas/{uuid}` | `Weapons.WeaponSkinChromas<L>` |
| | `getSkinLevelByUuid(uuid)` | `/v1/weapons/skinlevels/{uuid}` | `Weapons.WeaponSkinLevels<L>` |

注意两个精确但反直觉的契约：[S10]

- `Agents.get()` 的运行时默认值是 `true`，并总是创建 `isPlayableCharacter` 参数；显式传 `undefined` 也触发默认值。传 `false` 才请求全部角色。
- internal endpoint 的路径是原包中的拼写 `/internal/ritoclientversion`（`rito`，不是 `riot`）。兼容实现若要无缝替换必须接受这个 path，除非 SDK 同步修正。

## 完整公开响应类型

所有接口中的 `L10n<T>` 是本文对 `LanguageResponse<T, L>` 的简写；它不是包的实际导出名。除非显式写 `?`，原 `.d.ts` 将下列字段都声明为必需，即使真实 API 可能返回 `null`。[S4][S11]

### Agents、Buddies、Bundles、Ceremonies

- `Agents.Agents<L>`：`uuid`, `displayName: L10n<string>`, `description: L10n<string>`, `developerName`, `characterTags: L10n<string[]>`, `displayIcon`, `displayIconSmall`, `bustPortrait`, `fullPortrait`, `fullPortraitV2`, `killfeedPortrait`, `background`, `backgroundGradientColors: string[]`, `assetPath`, `isFullPortraitRightFacing`, `isPlayableCharacter`, `isAvailableForTest`, `isBaseContent`; `role` 含 `uuid`, localized `displayName` / `description`, `displayIcon`, `assetPath`; `recruitmentData` 含 `counterId`, `milestoneId`, `milestoneThreshold`, `useLevelVpCostOverride`, `levelVpCostOverride`, `startDate`, `endDate`; `abilities[]` 含 `slot`, localized `displayName` / `description`, `displayIcon`; `voiceLines` 含 `minDuration`, `maxDuration`, `mediaList[] { id: number, wwise, wave }`。
- `Buddies.BuddyLevels<L>`：`uuid`, `charmLevel`, `hideIfNotOwned`, localized `displayName`, `displayIcon`, `assetPath`。
- `Buddies.Buddies<L>`：`uuid`, localized `displayName`, `isHiddenIfNotOwned`, `themeUuid`, `displayIcon`, `assetPath`, `levels: BuddyLevels<L>[]`。
- `Bundles.Bundles<L>`：`uuid`, localized `displayName`, `displayNameSubText`, `description`, `extraDescription`, `promoDescription`; `useAdditionalContext`, `displayIcon`, `displayIcon2`, `logoIcon`, `verticalPromoImage`, `assetPath`。
- `Ceremonies.Ceremonies<L>`：`uuid`, localized `displayName`, `assetPath`。[S11]

### CompetitiveTiers、ContentTiers、Contracts、Currencies、Events

- `CompetitiveTiers.CompetitiveTiers<L>`：`uuid`, `assetObjectName`, `assetPath`, `tiers[]`，tier 含 `tier: number`, localized `tierName`, `division`, localized `divisionName`, `color`, `backgroundColor`, `smallIcon`, `largeIcon`, `rankTriangleDownIcon`, `rankTriangleUpIcon`。
- `ContentTiers.ContentTiers<L>`：`uuid`, localized `displayName`, `devName`, `rank`, `juiceValue`, `juiceCost`, `highlightColor`, `displayIcon`, `assetPath`。
- `Contracts.Contracts<L>`：`uuid`, localized `displayName`, `displayIcon`, `shipIt`, `useLevelVPCostOverride`, `levelVPCostOverride`, `freeRewardScheduleUuid`, `assetPath`; `content` 含 `relationType`, `relationUuid`, `premiumRewardScheduleUuid`, `premiumVPCost`, `chapters[]`。chapter 含 `isEpilogue`, `levels[]`, `freeRewards[]`；level 含 `reward { type, uuid, amount, isHighlighted }`, `xp`, `vpCost`, `isPurchasableWithVP`, `doughCost`, `isPurchasableWithDough`；free reward 与 reward 同形。
- `Currencies.Currencies<L>`：`uuid`, localized `displayName`, localized `displayNameSingular`, `displayIcon`, `largeIcon`, `assetPath`。
- `Events.Events<L>`：`uuid`, localized `displayName`, localized `shortDisplayName`, `startTime: string | Date`, `endTime: string | Date`, `assetPath`。[S11]

### Gamemodes、Gear、LevelBorders、Maps

- `Gamemodes.Gamemodes<L>`：`uuid`, localized `displayName`, localized `duration`, `economyType`, `allowsMatchTimeouts`, `isTeamVoiceAllowed`, `isMinimapHidden`, `orbCount`, `roundsPerHalf`, `teamRoles: string[]`, `gameFeatureOverrides[] { featureName, state }`, `gameRuleBoolOverrides[] { ruleName, state }`, `displayIcon`, `listViewIconTall`, `assetPath`。声明注释约定 `roundsPerHalf === -1` 表示无数据。
- `Gamemodes.GamemodeEquippables<L>`：`uuid`, localized `displayName`, `category`, `displayIcon`, `killStreamIcon`, `assetPath`。
- `Gear.Gear<L>`：`uuid`, localized `displayName`, localized `description`, `displayIcon`, `assetPath`; `shopData` 含 `cost`, `category`, `shopOrderPriority`, localized `categoryText`, `gridPosition { row, column }`, `canBeTrashed`, `image`, `newImage`, `newImage2`, `assetPath`。
- `LevelBorders.LevelBorders<L>`：`uuid`, localized `displayName`, `startingLevel`, `levelNumberAppearance`, `smallPlayerCardAppearance`, `assetPath`。
- `Maps.Maps<L>`：`uuid`, localized `displayName`, `narrativeDescription`, `tacticalDescription`, `coordinates`; `displayIcon`, `listViewIcon`, `listViewIconTall`, `splash`, `stylizedBackgroundImage`, `premierBackgroundImage`, `assetPath`, `mapUrl`, `xMultiplier`, `yMultiplier`, `xScalarToAdd`, `yScalarToAdd`; `callouts[]` 含 localized `regionName`, localized `superRegionName`, `location { x, y }`。[S11]

### Missions、Objectives、Internal、Version

- `Missions.Missions`：`uuid`, `displayName`, `title`, `type`, `xpGrant`, `progressToComplete`, `activationDate: string | Date`, `expirationDate: string | Date`, `tags: string[]`, `objectives[] { objectiveUuid, value }`, `assetPath`。
- `Objectives.Objectives`：`uuid`, `directive`, `assetPath`。
- `Internal.UUID<L>`：`uuid`, `type`, localized `displayName`。
- `Internal.RiotClientVersion`：顶层 `manifestFileName`, `userAgentVersion`, `riotClientFoundationInfo`, `riotGamesApiInfo`。后两者各含 `VS_FIXEDFILEINFO`, `StringTable`, `Translation`；固定文件信息含 `FileVersion`, `ProductVersion`, `FileFlagsMask`, `FileFlags`, `FileOS`, `FileType`, `FileSubtype`；字符串表含 `Language`, `CodePage`, `FileDescription`, `FileVersion`, `InternalName`, `OriginalFilename`, `ProductName`, `ProductVersion`, `CompanyName`, `LegalCopyright`；translation 含 `Language`, `CodePage`。大多数字段是 `string`，`Language` / `CodePage` 声明为数字模板字符串 `` `${number}` ``；foundation 的 `FileFlags` 也是数字模板字符串，而 games API 的该字段只是 `string`。
- `Version.Version`：`manifestId`, `branch`, `version`, `buildVersion`, `engineVersion`, `riotClientVersion`, `riotClientBuild`, `buildDate: string | Date`。

`Missions`、`Objectives` 和 `Internal.UUID` 在作者声明里带有 “unknown from website” 注释，说明其模型置信度本就较低。[S11]

### PlayerCards、PlayerTitles、Seasons、Sprays、Themes

- `PlayerCards.PlayerCards<L>`：`uuid`, localized `displayName`, `isHiddenIfNotOwned`, `themeUuid`, `displayIcon`, `smallArt`, `wideArt`, `largeArt`, `assetPath`。
- `PlayerTitles.PlayerTitles<L>`：`uuid`, localized `displayName`, localized `titleText`, `isHiddenIfNotOwned`, `assetPath`。
- `Seasons.Seasons<L>`：`uuid`, localized `displayName`, `type`, `startTime: string | Date`, `endTime: string | Date`, `parentUuid`, `assetPath`。
- `Seasons.CompetitiveSeasons`：`uuid`, `startTime: string | Date`, `endTime: string | Date`, `seasonUuid`, `competitiveTiersUuid`, `assetPath`, `borders[] { uuid, level, winsRequired, displayIcon, smallIcon, assetPath }`。
- `Sprays.SprayLevels<L>`：`uuid`, `sprayLevel`, localized `displayName`, `displayIcon`, `assetPath`。
- `Sprays.Sprays<L>`：`uuid`, localized `displayName`, `category`, `themeUuid`, `isNullSpray`, `hideIfNotOwned`, `displayIcon`, `fullIcon`, `fullTransparentIcon`, `animationPng`, `animationGif`, `assetPath`, `levels: SprayLevels<L>[]`。
- `Themes.Themes<L>`：`uuid`, localized `displayName`, `displayIcon`, `storeFeaturedImage`, `assetPath`。[S11]

### Weapons

- `Weapons.WeaponSkinChromas<L>`：`uuid`, localized `displayName`, `displayIcon`, `fullRender`, `swatch`, `streamedVideo`, `assetPath`。
- `Weapons.WeaponSkinLevels<L>`：`uuid`, localized `displayName`, `levelItem`, `displayIcon`, `streamedVideo`, `assetPath`。
- `Weapons.WeaponSkins<L>`：`uuid`, localized `displayName`, `themeUuid`, `contentTierUuid`, `displayIcon`, `wallpaper`, `assetPath`, `chromas: WeaponSkinChromas<L>[]`, `levels: WeaponSkinLevels<L>[]`。
- `Weapons.Weapons<L>`：`uuid`, localized `displayName`, `category`, `defaultSkinUuid`, `displayIcon`, `killStreamIcon`, `assetPath`, `skins: WeaponSkins<L>[]`, `weaponStats`, `shopData`。
- `weaponStats`：`fireRate`, `magazineSize`, `runSpeedMultiplier`, `equipTimeSeconds`, `reloadTimeSeconds`, `firstBulletAccuracy`, `shotgunPelletCount`, `wallPenetration`, `feature`, `fireMode`, `altFireType`; `adsStats { zoomMultiplier, fireRate, runSpeedMultiplier, burstCount, firstBulletAccuracy }`; `altShotgunStats { shotgunPelletCount, burstRate }`; `airBurstStats { shotgunPelletCount, burstDistance }`; `damageRanges[] { rangeStartMeters, rangeEndMeters, headDamage, bodyDamage, legDamage }`。
- `shopData`：`cost`, `category`, `shopOrderPriority`, localized `categoryText`, `gridPosition { row, column }`, `canBeTrashed`, `image`, `newImage`, `newImage2`, `assetPath`。[S11]

## 返回、错误、缓存及其他横切行为

### 返回与解包

所有方法的声明统一是：[S4]

```ts
type Response<T> = Promise<AxiosResponse<{
  status: number
  data?: T
  error?: string
}>>
```

调用者取得资源的路径是 `response.data.data`，而非 `response.data`。HTTP status 在 `response.status`；业务 envelope 又有一个 `response.data.status`。README 示例只打印 `versions.data`，而测试实际检查 `x.data.data`，后者才是资源数据。[S5][S6]

### 错误

SDK 不检查 envelope 的 `status` / `error`，也不 catch。Axios 默认只 resolve 2xx，非 2xx 拒绝为 `AxiosError`；若调用者通过 `axiosConfig.validateStatus` 扩大 resolve 范围，错误 envelope 也可能作为正常 `AxiosResponse` 返回。网络、超时、解析错误同样保持 Axios 原生形态。[S3][S8]

### 缓存、重试、限流、并发

发布代码中没有缓存、ETag/Last-Modified 处理、请求去重、retry/backoff、rate-limit 解析、队列或并发限制。每次方法调用都会发起新的 Axios GET；每次 service getter 还创建一个轻量 wrapper。任何 HTTP cache 都只能来自用户提供的 Axios adapter、代理/CDN 或服务端，而不是 SDK。[S3][S10]

### 日期、null 与运行时验证

- 日期字段虽然声明为 `string | Date`，SDK 没有 transform 将 JSON string 转为 `Date`；默认 Axios JSON 解析下实际通常是 string。[S3][S11]
- `.d.ts` 中大量图像、嵌套对象和数值字段被声明为必需非 null，但 SDK 不做运行时验证或填充。[S11]
- `ignore_null` 是服务端 response option，只影响 query；SDK 自己不递归删除 null。[S3]

### 鉴权与 header

所有公开 endpoint 均无专门鉴权参数。用户可以借助 `axiosConfig.headers` / `auth` 等提供通用 Axios 配置，但 SDK 只固定 `Content-Type: application/json`，没有自定义 User-Agent、Accept、API key 或 bearer token 逻辑。[S3][S10]

## 测试覆盖与可靠性

对应提交只有一个 live-API Jest 测试。它用 `th-TH` 与 `ignore_null: true` 并行调用 28 个 collection 方法，然后意图断言 HTTP 200 和非空数据；没有 mock、契约 fixture 或对请求 URL / query 的断言。[S5]

测试遗漏所有 `getByUuid` / singular 方法，以及 `Internal.uuid()`、weapon chromas / levels 等部分 collection 方法。更重要的是 test body 没有 `return` 或 `await Promise.all(...)`，因此 Jest 可能在异步断言执行前就判定测试完成。这意味着“包自带测试通过”不能证明 endpoint 或响应模型正确。[S5]

## 4.0.0 → 5.0.0-beta.3 公开差异

因为 npm `latest` 是 beta，而不少既有消费者可能锁定稳定版 4.0.0，迁移规划应明确选择哪一套兼容目标。[S1][S9]

| 方面 | 4.0.0 | 5.0.0-beta.3 |
|---|---|---|
| 默认语言 | `en-US` | SDK 不设置；服务端决定 |
| 默认 response option | `ignore_null: true` | SDK 不设置；服务端决定 |
| base URL | `https://valorant-api.com/v1` | `https://valorant-api.com`，service path 自带 `/v1` |
| client request | public getter，返回绑定风险未知的 `axios.request` | protected Axios instance `request`；不属于公开 TS API |
| client 配置 | public `config`，static `Default` | 两者删除 |
| service 底层字段 | protected `axios` | protected `request` |
| 类型命名 | `ValorantApiCom.Language/Config`、service namespace response types | 顶层 `Language/Config/Response/...` type exports |
| Internal service | 无 | 新增 `uuid()`、`riotClientVersion()` |
| Axios 依赖 | 通过 `@valapi/lib` 的依赖树可用，manifest 未直接声明 | 直接声明 `axios ^1.7.3` |

其余 22 个 service 的方法名和资源 paths 基本延续；4.0.0 CHANGELOG 还确认 `Agents.get` 从 4.0.0 起默认 `isPlayableCharacter=true`。[S6][S9]

## 对兼容改造最重要的基线约束

后续对自建 endpoint 元信息做 diff 时，至少逐项比较：[S3][S4][S10][S11]

1. 是否完整支持表中的 59 个 GET path，尤其 `/internal/ritoclientversion` 的历史拼写及各 nested collection path。
2. query 是否兼容 `language`、`responseOptions=ignore_null` 和 agents 的 `isPlayableCharacter=true|false`，包括参数缺省语义。
3. envelope 是否保持 `{ status, data?, error? }`，HTTP error status 与业务 status 是否一致，Axios 默认 rejection 是否仍成立。
4. `language=all` 是字段级多语言 record，具体哪些字段被本 SDK 类型标成 localized。
5. null、缺失字段、额外字段、日期字符串与 nested object 形态是否匹配 `.d.ts`；原类型本身并不总能反映 nullability。
6. client 是否需要开放可配置 origin。按现有代码，单靠构造参数不能切到 `https://val-api.buguoguo.cn`。
7. 是精确兼容 npm `latest` 5 beta，还是同时保留 4.0.0 的默认语言、默认 `ignore_null`、public request/config 等旧行为。

## 已知不确定项

- npm 元数据显示 5.0.0 beta 系列在 2024 年发布，但包记录在 2026-05-05 被修改并加上 deprecation；没有 2024-08-10 之后的新 package version。[S1]
- `gitHead=af9b0d2...` 中仓库 manifest 仍写 beta.2，而 npm tarball manifest 写 beta.3；推测发布时版本变更未进入该提交。实际消费基线以 tarball 为准。[S1][S2][S3]
- 原包类型中 `string | Date`、必需 nested object、非 null 图像字段等只是静态声明；没有 runtime schema 或足够测试证明所有线上响应都满足它们。[S5][S11]
- `Internal.UUID`、`Missions`、`Objectives` 被作者自己标注为不了解网站来源；需要用目标服务 endpoint 元信息和实际 sample response 重新验证。[S11]
- 本文没有把 valorant-api.com 当前线上响应当作稳定规范，因为该 SDK 已弃维护且线上数据会随游戏版本变化；本文目标是复原 npm package 自身承诺和运行行为。

## 一手来源

- [S1] [npm registry：`@valapi/valorant-api.com` package metadata](https://registry.npmjs.org/%40valapi%2Fvalorant-api.com)
- [S2] [npm 官方 `5.0.0-beta.3` tarball](https://registry.npmjs.org/@valapi/valorant-api.com/-/valorant-api.com-5.0.0-beta.3.tgz)
- [S3] [官方仓库精确提交：`ValorantApiCom.ts`](https://github.com/valapi/node-valapi/blob/af9b0d2dc1af29b7e2c15300493fccf3dcaa500b/packages/%40valapi/valorant-api.com/src/client/ValorantApiCom.ts)
- [S4] [官方仓库精确提交：入口及 response types](https://github.com/valapi/node-valapi/tree/af9b0d2dc1af29b7e2c15300493fccf3dcaa500b/packages/%40valapi/valorant-api.com/src/client)
- [S5] [官方仓库精确提交：唯一 API test](https://github.com/valapi/node-valapi/blob/af9b0d2dc1af29b7e2c15300493fccf3dcaa500b/packages/%40valapi/valorant-api.com/src/__tests__/api.ts)
- [S6] [官方仓库精确提交：README 与 CHANGELOG](https://github.com/valapi/node-valapi/tree/af9b0d2dc1af29b7e2c15300493fccf3dcaa500b/packages/%40valapi/valorant-api.com)
- [S7] [官方仓库：`@valapi/lib` Locale 定义](https://github.com/valapi/node-valapi/blob/af9b0d2dc1af29b7e2c15300493fccf3dcaa500b/packages/%40valapi/lib/src/resources/Locale.ts)
- [S8] [Axios 官方：错误处理](https://axios-http.com/docs/handling_errors)
- [S9] [npm 官方 `4.0.0` tarball](https://registry.npmjs.org/@valapi/valorant-api.com/-/valorant-api.com-4.0.0.tgz)
- [S10] [官方仓库精确提交：全部 service 实现](https://github.com/valapi/node-valapi/tree/af9b0d2dc1af29b7e2c15300493fccf3dcaa500b/packages/%40valapi/valorant-api.com/src/service)
- [S11] [npm 官方 tarball 中的公开 `.d.ts`（同 S2，`build/service/*.d.ts`）](https://registry.npmjs.org/@valapi/valorant-api.com/-/valorant-api.com-5.0.0-beta.3.tgz)

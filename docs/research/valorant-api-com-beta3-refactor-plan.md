# `@valapi/valorant-api.com` 5.0.0-beta.3 兼容改造规划

研究日期：2026-07-25  
目标服务：`https://val-api.buguoguo.cn`  
SDK baseline：npm 发布物 `@valapi/valorant-api.com@5.0.0-beta.3`

## 1. 结论先行

这不是一次“把 `baseURL` 换掉、再补几个类型”的改造。

目标服务已经覆盖 baseline 的大部分路径：baseline 共公开 59 个 `GET` 方法，目标服务可直接对应其中 53 个；缺失的 6 个方法来自 `Missions`、`Objectives` 和 `Internal`。目标服务另有 `Flex` 与 `GameLocres` 三个可新增方法。但目前至少有五类契约差异会让仅换域名后的 SDK 对用户说谎或直接失效：

1. baseline 将 origin 固定为 `https://valorant-api.com`，用户传入的 `axiosConfig.baseURL` 会被覆盖。
2. baseline 支持 `language: "all"`，目标服务实测返回 404。
3. baseline 的 `responseOptions.ignore_null` 在目标服务实测未删除 `null` 字段。
4. `Version.get()` 的响应形态和字段完全不同：baseline 是单对象，目标服务是单元素数组且采用另一组字段。
5. 目标服务的错误 `error` 是 Problem Details 对象，baseline 类型却声明为 `string`。

推荐采用“运行时调用面兼容 + 目标服务模型诚实化”的策略：保留 beta.3 的导出名、service getter、方法名、AxiosResponse 返回方式和 Axios 错误语义；对不真实的旧数据类型进行明确的破坏性修正，并新增目标服务原生的 `Flex`、`GameLocres` 能力。发布上应作为新的 prerelease/major 兼容线，而不是伪装成无破坏性的 patch。

其中 `language=all`、Version、缺失端点和 `ignore_null` 应优先在服务端补齐。SDK 可以适配“包装形态”，但不应凭空制造服务端没有的数据。

## 2. 基线与证据优先级

本规划严格以 `5.0.0-beta.3` 为 baseline，不把 `4.0.0` 纳入兼容目标。

证据优先级如下：

1. npm tarball 中实际发布的 CommonJS JS：决定消费者真正运行的行为。[S2]
2. 同一 tarball 中的 `.d.ts`：决定消费者看到的 TypeScript API。[S2]
3. npm 记录的 `gitHead=af9b0d2...` 对应官方源码与测试：只用于补足发布物缺少的源级语义。[S3]
4. 目标服务 `_meta/endpoints`：决定目标服务声明的路由、模型、nullability 与媒体字段。[S4]
5. 2026-07-25 对目标服务和原站做的只读线上探测：用于核对元信息没有描述的 query、错误和包络行为。[S5][S6]

需要特别记录一个发布异常：npm tarball 的 manifest 是 `5.0.0-beta.3`，但 npm 所记 `gitHead` 中 package manifest 仍写 `5.0.0-beta.2`。因此本规划始终以 beta.3 tarball 为最终事实，不以仓库默认分支或源码 manifest 的版本字符串代替发布物。[S1][S2][S3]

完整的原 SDK 公开面、23 个 service、59 个方法和数据模型已另存于 [`original-sdk-baseline.md`](./original-sdk-baseline.md)。

## 3. beta.3 必须保住的公开契约

### 3.1 模块与导出

baseline 是 CommonJS 包，入口为 `build/index.js`，类型入口为 `build/index.d.ts`。它没有 `exports` map。需要继续提供：

- 默认导出与具名导出 `ValorantApiCom`，且两者指向同一个类。
- `ValorantApiComService`。
- 23 个原 service 类：`Agents`、`Buddies`、`Bundles`、`Ceremonies`、`CompetitiveTiers`、`ContentTiers`、`Contracts`、`Currencies`、`Events`、`Gamemodes`、`Gear`、`Internal`、`LevelBorders`、`Maps`、`Missions`、`Objectives`、`PlayerCards`、`PlayerTitles`、`Seasons`、`Sprays`、`Themes`、`Version`、`Weapons`。
- 顶层类型 `Language`、`Config`、`AllLanguageResponse`、`LanguageResponse`、`Response`。
- 同名 class + namespace 的访问方式，例如 `Agents.Agents<L>`。

`Flex` 与 `GameLocres` 作为纯新增导出，不占用或改名现有导出。

### 3.2 构造器与传输行为

baseline 构造器为：

```ts
new ValorantApiCom<L extends Language>({
  language?: L,
  axiosConfig?: CreateAxiosDefaults,
  responseOptions?: { ignore_null?: boolean }
})
```

需要保留的行为：

- 所有 service 共用一个 Axios instance。
- 每次读取 `client.Agents` 等 getter 都创建新的轻量 service wrapper。
- service 方法直接返回完整 `Promise<AxiosResponse<Envelope<T>>>`，资源仍位于 `response.data.data`。
- SDK 不 catch/rethrow；非 2xx 默认继续拒绝为 AxiosError。
- 不引入默认缓存、重试、日期转换、运行时 schema 强制校验或自动解包。
- `Agents.get()` 默认并显式发送 `isPlayableCharacter=true`。

需要有意改善的行为：

- 新增顶层 `baseURL?: string`，默认值为 `https://val-api.buguoguo.cn`。
- 推荐明确优先级为 `config.baseURL > config.axiosConfig?.baseURL > 默认目标 origin`。这修复 baseline 无法换源的问题，同时让意图清楚。
- `Content-Type: application/json`、默认 query 合并和用户 Axios 配置的其余行为保持 beta.3 语义。
- 暂不引入 ESM-only 发布；如增加 ESM，必须做 CJS/ESM 双入口并验证 `require()` 与 `import` 均可用。

### 3.3 语言类型

baseline 的 18 个普通 locale 为：

```text
ar-AE, de-DE, en-US, es-ES, es-MX, fr-FR, id-ID, it-IT, ja-JP,
ko-KR, pl-PL, pt-BR, ru-RU, th-TH, tr-TR, vi-VN, zh-CN, zh-TW
```

另有特殊值 `all`，而 `en-GB` 被排除。目标服务已实测全部 18 个普通 locale 返回 200，且省略 language 时目前等同 `en-US`。这部分可直接保留；`all` 见 P0 阻塞项。

## 4. 路由覆盖矩阵

### 4.1 数量结论

- baseline：23 个 service，59 个公开 GET 方法。
- 目标 `_meta/endpoints`：29 个 collection 路由，其中 27 个支持 `{uuid}`，2 个不支持。
- 可直接匹配 baseline：53/59 个方法。
- baseline 缺失于目标服务：6 个方法，即 `Missions` 2 个、`Objectives` 2 个、`Internal` 2 个。
- 目标服务新增：`Flex.get()`、`Flex.getByUuid()`、`GameLocres.get()`，共 3 个方法。

### 4.2 service 级决策

| Service | 目标支持 | 主要差异 | SDK 决策 |
|---|---:|---|---|
| `Agents` | 是 | `all`、`ignore_null`；新字段；`voiceLines` 变成 `voiceLine`；大量 nullable | 保留两方法，修正类型；服务端补语义 |
| `Buddies` | 是 | `developerName`、`buddyUuid`；nullable | 保留四方法，扩充类型 |
| `Bundles` | 是 | 新增 `displayIcon3`；nullable | 保留两方法，扩充类型 |
| `Ceremonies` | 是 | `displayName` nullable | 保留两方法，修正类型 |
| `CompetitiveTiers` | 是 | nested tier 字段可对应 | 保留两方法，按 meta 生成 nested 类型 |
| `ContentTiers` | 是 | 新增两个全大写名称字段；数值/媒体 nullable | 保留两方法，扩充类型 |
| `Contracts` | 是 | 字段命名和章节模型大幅变化 | 保留两方法，单独重建模型 |
| `Currencies` | 是 | 新增 `rewardPreviewIcon`；nullable | 保留两方法，扩充类型 |
| `Events` | 是 | 日期与名称 nullable | 保留两方法，修正类型 |
| `Gamemodes` | 是 | 新增 `description`、`allowsCustomGameReplays`；nullable | 保留四方法，扩充类型 |
| `Gear` | 是 | 新增 `descriptions`、`details`；`shopData` 可空 | 保留两方法，重建 nested 类型 |
| `Internal` | 否 | 两个 `/internal/*` 均 404 | 保留 API 壳并 deprecated；服务端补齐前不得宣称兼容 |
| `LevelBorders` | 是 | 新增 `levelNumber`；媒体 nullable | 保留两方法，扩充类型 |
| `Maps` | 是 | callout 新增 3D location、scale、rotation | 保留两方法，扩充 nested 类型 |
| `Missions` | 否 | collection/item 均 404 | 保留 API 壳并 deprecated；服务端补齐或明确不支持 |
| `Objectives` | 否 | collection/item 均 404 | 同上 |
| `PlayerCards` | 是 | 多数字段 nullable | 保留两方法，修正类型 |
| `PlayerTitles` | 是 | 多数字段 nullable | 保留两方法，修正类型 |
| `Seasons` | 是 | 新增 `title`；日期/父 UUID nullable | 保留四方法，扩充类型 |
| `Sprays` | 是 | `developerName`、`displayNameAllCaps`、`sprayUuid` | 保留四方法，扩充类型 |
| `Themes` | 是 | 移除 `storeFeaturedImage`，新增 developer/all-caps 字段 | 保留两方法；旧字段不能继续伪装必有 |
| `Version` | 路由有、契约无 | 数组包络且字段集合不同 | P0；服务端提供兼容 projection，SDK 不伪造 |
| `Weapons` | 是 | 大量新字段与 nullable nested 对象 | 保留八方法，按四个资源模型重建 |
| `Flex` | 目标新增 | baseline 无此 service | 新增 `Flex.get/getByUuid` |
| `GameLocres` | 目标新增 | collection-only；返回下载 URL | 新增 `GameLocres.get` |

## 5. endpoint 模型差异清单

下表关注会改变消费者类型或业务逻辑的差异；所有 `_meta` 标记为 `string?`、`int?`、`float?`、`bool?` 或 nested `?` 的字段都必须在 TypeScript 中表达为 nullable。若 `ignore_null` 修好后会删除这些键，还要同时表达 optional。

| 路由 | 相对 beta.3 的关键模型变化 |
|---|---|
| `/v1/agents` | 新增 `releaseDate`、`minimapPortrait`、`homeScreenPromoTileImage`；`voiceLines` 改名为单数 `voiceLine`；`role`、`recruitmentData` 与多数本地化/媒体字段可空。线上样本中 `characterTags` 为 `null`，与 meta 的非空声明漂移。 |
| `/v1/buddies` | 新增 `developerName`；nested levels 明确包含 `buddyUuid`；名称、主题、图标可空。 |
| `/v1/buddies/levels` | 新增 `buddyUuid`；名称和图标可空。 |
| `/v1/bundles` | 新增 `displayIcon3`；文案、图标与 `useAdditionalContext` 可空。 |
| `/v1/ceremonies` | `displayName` 可空。 |
| `/v1/competitivetiers` | tier 数组保留原核心字段；图标等字段以 meta nullability 为准。 |
| `/v1/contenttiers` | 新增 `displayNameAllCaps`、`displayNameAbbreviatedAllCaps`；rank/juice/highlight/icon 可空。 |
| `/v1/contracts` | 新增 developer、UI asset、关联角色、chapter count、all-caps 字段；`useLevelVPCostOverride`/`levelVPCostOverride` 改成 `Vp` casing；`premiumVPCost` 改成 `premiumVpCost`；除原 `content` 外新增扁平化/解析后的顶层 `chapters`，其 level/reward 结构与 beta.3 不同。 |
| `/v1/currencies` | 新增 `rewardPreviewIcon`；名称与图标可空。 |
| `/v1/events` | 名称和起止时间可空；日期仍是 JSON string，SDK 不转换为 Date。 |
| `/v1/gamemodes` | 新增 `description`、`allowsCustomGameReplays`；duration/economy/media 可空；override 数组结构仍可对应。 |
| `/v1/gamemodes/equippables` | 本地化名称、category 和媒体可空。 |
| `/v1/gear` | 新增 `descriptions: string[]` 与 `details[] {name,value}`；整个 `shopData` 及内部字段可空。 |
| `/v1/levelborders` | 新增 `levelNumber`；显示名称与外观媒体可空。 |
| `/v1/maps` | callout 新增 `superRegion`、location.z、`scale3D{x,y,z}`、`rotation{pitch,yaw,roll}`；多种文案/媒体可空。 |
| `/v1/playercards` | 除 UUID/assetPath 外，多数字段可空。 |
| `/v1/playertitles` | 名称、titleText、hidden flag 可空。 |
| `/v1/seasons` | 新增 `title`；名称、type、时间和 parentUuid 可空。 |
| `/v1/seasons/competitive` | 时间、seasonUuid、competitiveTiersUuid 可空；border 核心结构可对应。 |
| `/v1/sprays` | 新增 `developerName`、`displayNameAllCaps`；nested levels 新增 `sprayUuid`；大量媒体可空。 |
| `/v1/sprays/levels` | 新增 `sprayUuid`；名称与图标可空。 |
| `/v1/themes` | baseline 的 `storeFeaturedImage` 在目标 meta 中不存在；新增 `developerName`、`displayNameAllCaps`。 |
| `/v1/version` | baseline 的 `manifestId/version/buildVersion/engineVersion/riotClientVersion/riotClientBuild/buildDate` 不存在；目标返回 `productVersion/internalVersion/minorVersion/buildTime/riotGamesApiVersion`，仅 `branch` 同名。 |
| `/v1/weapons` | 新增 `developerName`；`weaponStats`、`shopData` 及内部大多数值可空；skins 在 meta 中展开为完整目标模型。 |
| `/v1/weapons/skinchromas` | 新增 `developerName`、`fullRenderOverride`、两个 channel hash；媒体可空。 |
| `/v1/weapons/skinlevels` | 新增 `levelNumber`、`fullRender`、`swatch`、`sniperIcon`、`charmPosition`；媒体/levelItem 可空。 |
| `/v1/weapons/skins` | 新增 `weaponTypeUuid`、`developerName`、`description`；levels/chromas 采用上述完整目标模型；主题、tier 与媒体可空。 |
| `/v1/flex` | 新模型：`uuid`、`assetPath`、nullable `displayName`、`displayNameAllCaps`、`displayIcon`。 |
| `/v1/locres` | 新模型：`downloadUrl: string`；没有 UUID，不能提供 `getByUuid`。 |

### 5.1 类型生成不能只依赖当前 meta

当前 `_meta/endpoints` 足以生成字段名、primitive、collection、nested、media 和声明 nullability，但还缺少：

- 哪些字段是 localized，因而会被 `LanguageResponse<T, L>` 包裹。
- query 参数、默认值和枚举。
- collection 与 item 的真实响应形态。
- 错误 schema。
- 排序稳定性、字段省略语义和 schema 版本。

而且线上已经出现 meta/runtime 漂移：`Agents.characterTags` 在 meta 中是非空 `string[]`，线上样本却是 `null`。因此推荐使用“meta snapshot + 手工语义 overlay + 线上样本验证”生成类型，而不是把线上 meta 直接当 npm build 的单一输入。

建议服务端扩充 meta：`schemaVersion`、`httpMethod`、`collectionResponse`、`itemResponse`、`queryParameters`、`isLocalized`、`isOptional`、`errorSchema`、`defaultLanguage`、`supportedLanguages`。SDK 构建必须读取仓库中固定版本的 snapshot，不能在 `npm publish` 时依赖在线服务实时生成。

## 6. P0 服务端兼容阻塞项

这些问题不应靠 SDK 静默掩盖。

### P0-1：`language=all`

baseline 的 `all` 不是“整个响应按语言复制”，而是每个 localized 字段变成 18-locale record。原站实测可用，目标服务实测为结构化 404。

推荐方案：服务端原生实现字段级 `all`，保证 18 个 locale key 完整，并在 meta 标记 localized 字段。

不推荐默认在 SDK 内做 18 请求聚合，因为：

- 需要按 UUID 和 nested item key 合并不同语言响应。
- nested 数组并不总有 UUID，例如 ability 可能依赖 slot，tier 依赖 tier number。
- 一次 SDK 调用会放大为 18 个请求，带来限流、延迟和部分失败问题。
- 不同语言快照若不一致，会产生无法可靠合并的数据。

若短期必须提供 SDK fallback，应显式 opt-in，例如 `allLanguages: { strategy: "client", concurrency: 4 }`，使用 `Promise.allSettled`，定义全有或全失败的原子语义，并测试每类 nested merge key；不得让 `language: "all"` 在用户无感知时自动放大请求。

### P0-2：Version 兼容 projection

目标 `/v1/version` 当前返回 `data: [Version]`；baseline 返回 `data: Version`。字段也无法一一无损映射。SDK 最多能解开单元素数组，但无法诚实制造 `manifestId`、`engineVersion`、`riotClientVersion` 和 `riotClientBuild`。

推荐服务端让 `/v1/version` 返回 beta.3 兼容单对象，并可在该对象上附加中国区字段，或另开 `/v1/cnversion` 暴露原生模型。若必须保持现有目标路由，则新增明确的 compatibility endpoint，并让 SDK 的 `Version.get()` 指向它；同时另设 `ChinaVersion.get()` 指向原生数据。

验收必须比较 shape，而非只比较 HTTP 200。

### P0-3：缺失的 6 个方法

服务端需要决定是否实现：

```text
GET /v1/missions
GET /v1/missions/{uuid}
GET /v1/objectives
GET /v1/objectives/{uuid}
GET /internal/uuids
GET /internal/ritoclientversion
```

在补齐前，SDK 应保留原 getter 和方法以维持调用面，但文档明确标为 unsupported/deprecated；请求仍发往目标服务并按 Axios 默认方式 404 reject。禁止默认 fallback 到原 `valorant-api.com`，否则一个 client 会悄悄混用两个数据源和版本体系。

### P0-4：`ignore_null`

目标服务实测 `responseOptions=ignore_null` 后仍保留 null 键。应在服务端修正为递归删除 null，且不能删除 `false`、`0`、空字符串或空数组。需要覆盖 nested object 与 collection。

在服务端修好前，SDK 不应自行递归删除，因为 baseline 明确把它作为服务端 query option；本地转换会改变 Axios 原始响应并引入额外行为。

### P0-5：Agents filter

原站实测 `isPlayableCharacter=false` 返回不满足 playable 的集合；目标服务当前对 true、false 和省略参数均返回同样 29 个 playable agent，说明 false 被忽略或数据源仅含 playable。

服务端应按布尔值过滤而不是用 truthy 判断，并为 true、false、缺省分别定义语义。SDK 继续保持 `Agents.get()` 默认 true。

## 7. SDK 目标架构

### 7.1 分层

推荐将实现拆成四个清楚层次：

```text
ValorantApiCom client
  -> transport/config（Axios 实例、baseURL、全局 query）
  -> thin services（方法名、path、单个 endpoint query）
  -> response contracts（Envelope、ProblemDetails、Axios Response）
  -> resource models（生成字段 + 手工 localized/compat overlay）
```

service 继续保持薄，不在 25 个 service 内重复 envelope、错误或语言逻辑。路径和返回模型的映射应有一份机器可读 registry，供实现、测试矩阵和文档共同使用，避免三份清单漂移。

### 7.2 建议目录

应用到上游 monorepo 的 `packages/@valapi/valorant-api.com` 时，建议：

```text
src/
  client/
    ValorantApiCom.ts
    ValorantApiComService.ts
    config.ts
    response.ts
  service/
    ...原 service
    Flex.ts
    GameLocres.ts
  model/
    generated.ts
    localized.ts
    overrides.ts
  schema/
    endpoints.snapshot.json
    endpoint-registry.ts
scripts/
  generate-models.ts
  check-schema-drift.ts
test/
  unit/
  contract/
  type/
  live/
```

不强制照搬文件名，但必须维持“请求代码、模型生成、兼容 overlay、live 检查”之间的边界。

### 7.3 响应与错误类型

保持完整 AxiosResponse：

```ts
interface Envelope<T> {
  status: number
  data?: T
  error?: string | ProblemDetails
}

interface ProblemDetails {
  title: string
  status: number
  detail: string
  instance?: string
}

type Response<T> = Promise<AxiosResponse<Envelope<T>>>
```

把 `error` 扩成 union 会修正目标服务事实，但属于类型层面的 widening；需要在迁移说明中指出。运行时仍不拦截 AxiosError。

### 7.4 null、optional 与日期

- meta 的 `T?` 应生成 `T | null`。
- 如果 `ignore_null=true` 会省略字段，则该字段还应 optional，即 `field?: T | null`。可先统一将所有 nullable 字段声明为 optional nullable，避免配置泛型爆炸。
- 线上样本违反 meta 时，在 `overrides.ts` 中收紧/放宽，并开服务端 schema issue。
- `datetime?` 映射为 `string | null`，而非 `string | Date`；SDK 没有做 Date 转换。为了兼容旧名称，可提供 `DateLike = string`，但不要声明运行时不会出现的 Date。

### 7.5 类型命名迁移

保留旧 namespace 入口，新增更清楚的单数模型别名：

```ts
namespace Agents {
  interface Agent<L extends Language> { ... }
  type Agents<L extends Language> = Agent<L> // deprecated alias
}
```

类似地保留 `Buddies.Buddies`、`Bundles.Bundles` 等历史名字。这样可以逐步改善命名而不一次删除现有引用。

对于因 nullability 修正造成的 strict TypeScript 编译错误，应作为新 major/prerelease 的已知迁移成本，而不是继续发布错误的非空承诺。

## 8. 分阶段实施计划

### 阶段 0：把事实固定进仓库

1. 导入 beta.3 tarball 对应源码或以它为起点建立 package。
2. 保存 `_meta/endpoints` 的版本化 snapshot，记录抓取时间、URL 和内容 hash。
3. 建立 59 个 baseline 方法 + 3 个目标新增方法的 endpoint registry。
4. 将 baseline tarball 的 JS 与 `.d.ts` 作为 golden fixtures，仅用于兼容测试，不直接发布。

验收：每个公开方法都有 service、method、path、query、collection/item、return model 和支持状态记录；CI 能检测 registry 与实现漏项。

### 阶段 1：先完成 transport 与公开面

1. 实现可配置 `baseURL` 与明确的配置优先级。
2. 保留 CJS、默认/具名导出、23 个 getter、59 个方法和完整 AxiosResponse。
3. 新增 `Flex`、`GameLocres` getter、class 与顶层导出。
4. 保持 `Agents.get()` 默认 query 和 UUID path 形式。
5. 暂不做模型大改，先用最小 placeholder 把请求矩阵跑通。

验收：mock transport 精确断言 62 个方法的 URL/query；`require()`、default import、named import 均有测试；用户 Axios timeout/header/adapter/validateStatus 能保留。

### 阶段 2：解决 P0 wire compatibility

与服务端协作完成：

1. `language=all` 字段级响应。
2. Version 兼容对象与字段。
3. `ignore_null` 递归语义。
4. Agents true/false filter。
5. 对 Missions/Objectives/Internal 做“实现或正式声明不支持”的产品决定。

验收：目标服务与原站针对同一请求的 envelope/shape 差分测试通过；不比较具体游戏数据值，但比较类型、nullable、数组/对象、localized key 集合和 HTTP/业务 status。

### 阶段 3：生成并修正资源模型

1. 从固定 meta snapshot 生成 primitive、nested、collection、media 和 nullability。
2. 用手工 overlay 标记 localized 字段、历史命名 alias 和已知 runtime 漂移。
3. 单独手写 Contracts、Version、Internal 这类不能可靠机械映射的兼容模型。
4. 为 `Flex`、`GameLocres` 建立原生模型。
5. 输出稳定 `.d.ts`，并做 API Extractor 或等价 public API snapshot。

验收：27 个共享资源、2 个目标新增资源均有 compile-time fixtures；所有 meta 字段必须被生成类型覆盖，额外手写字段必须有注释来源。

### 阶段 4：测试体系

建立四层测试：

1. **单元测试**：配置合并、baseURL 优先级、responseOptions 序列化、Agents 默认值、getter 共享 Axios instance。
2. **离线契约测试**：每个 service 方法的 path/query/返回 generic；404/500/network/timeout/validateStatus 行为。
3. **类型测试**：default/named export、namespace merge、18 locale、`all` conditional type、nullable/optional、ProblemDetails union。
4. **live smoke/differential**：CI 定时而非每个 PR 执行；拉 meta、抽取 collection 第一个 UUID 再测 item；与原站比较 shape；检测 schema drift。

必须修掉原项目测试的根本问题：原 Jest 测试没有 `return` 或 `await Promise.all(...)`，可能在断言前就完成。新测试必须 `await`，且不得只断言 HTTP 200 和“数组非空”。

### 阶段 5：文档与发布

1. README 示例改为目标 origin，并展示 `baseURL` override。
2. 提供从 beta.3 迁移文档：nullability、ProblemDetails、Version、unsupported services、新 services。
3. 输出 endpoint 支持表，明确 53/59、P0 完成后的新数字和 unsupported 行为。
4. 发布 prerelease，先收集真实项目的 TypeScript 编译反馈，再升稳定 tag。
5. npm provenance、锁定依赖、最小 Node engines、CJS/ESM 策略需在发布前明确。

推荐发布门槛：P0-1 至 P0-5 未完成时，只能标为 preview，不应自称 beta.3 wire-compatible。

## 9. 可独立领取的工作包

按依赖顺序拆成以下工作包，便于多人实现：

1. **WP-01 Baseline fixtures**：固定 beta.3 public API 与 59-method registry。无依赖。
2. **WP-02 Target schema snapshot**：下载、规范化、hash、drift checker。无依赖。
3. **WP-03 Client transport**：baseURL、Axios config、response types。依赖 WP-01。
4. **WP-04 Existing services**：复刻 23 个 service 的 59 方法。依赖 WP-01、WP-03。
5. **WP-05 New services**：Flex/GameLocres 三方法与 exports。依赖 WP-02、WP-03。
6. **WP-06 Model generator**：meta 到 TS 的基础生成。依赖 WP-02。
7. **WP-07 Localization overlay**：localized 标记、`all` 类型与测试。依赖 WP-06、服务端 P0-1 契约。
8. **WP-08 Complex model overlays**：Contracts/Maps/Weapons/Agents。依赖 WP-06。
9. **WP-09 Version compatibility**：服务端 projection + SDK 模型。依赖服务端 P0-2 决策。
10. **WP-10 Unsupported endpoints**：Missions/Objectives/Internal 产品与服务端决定。无代码前置，但阻塞“完整兼容”声明。
11. **WP-11 Contract test matrix**：62 个方法、错误、query 和 shape。依赖 WP-03 至 WP-09。
12. **WP-12 Docs/release**：迁移、支持矩阵、prerelease。依赖 WP-11。

并行关系：WP-01 与 WP-02 可并行；WP-04、WP-05、WP-06 可在 transport/schema 固定后并行；WP-07、WP-08、WP-09 可并行；最终由 WP-11 汇合。

## 10. 完成定义

只有同时满足以下条件，才能宣称针对 beta.3 的改造完成：

- beta.3 的默认/具名导出、23 个原 getter 和 59 个原方法仍可引用。
- 支持的方法仍返回完整 AxiosResponse，Axios 默认错误拒绝语义不变。
- 目标 origin 可配置，默认指向目标服务，用户 Axios 配置不会被意外丢弃。
- 18 个普通 locale 和 `all` 的运行时行为与类型一致。
- Version 返回单对象且包含承诺字段，或公开声明该能力不兼容；不得用不可靠猜测填字段。
- `ignore_null`、Agents filter、collection/item shape 有契约测试。
- 所有 `_meta` 字段在类型中可见，nullable/optional 与线上样本差异有 overlay 和 issue。
- Missions/Objectives/Internal 的支持状态在代码、类型、文档和测试中一致。
- Flex 与 GameLocres 有公开导出、方法、类型和测试。
- 无网络的 PR 测试稳定；live drift/differential 测试可定时运行并输出可诊断 diff。
- npm 发布物自身经过 `npm pack` 后再做 require/import/type smoke test，而不是只测试源码树。

## 11. 一手来源

- [S1] [npm registry：`@valapi/valorant-api.com` metadata](https://registry.npmjs.org/%40valapi%2Fvalorant-api.com)
- [S2] [npm 官方 `5.0.0-beta.3` tarball](https://registry.npmjs.org/@valapi/valorant-api.com/-/valorant-api.com-5.0.0-beta.3.tgz)
- [S3] [官方仓库精确 `gitHead af9b0d2...`](https://github.com/valapi/node-valapi/tree/af9b0d2dc1af29b7e2c15300493fccf3dcaa500b/packages/%40valapi/valorant-api.com)
- [S4] [目标服务 endpoint metadata](https://val-api.buguoguo.cn/v1/_meta/endpoints)
- [S5] 2026-07-25 对目标服务 `/v1/agents`、`/v1/version`、`/v1/locres`、`/v1/flex`、缺失 `/v1` 与 `/internal` 路由的只读 HTTP 探测；请求均来自本规划列出的公开 URL。
- [S6] 2026-07-25 对原站 `/v1/agents` 与 `/v1/version` 的只读 HTTP 对照探测。
- [S7] [Axios 官方错误处理语义](https://axios-http.com/docs/handling_errors)


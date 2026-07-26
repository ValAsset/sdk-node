/**
 * The closed set of locales the ValAsset API accepts, in canonical casing.
 * Mirrors the server's `Locale` value type and the `language` enum in the OpenAPI contract.
 */
export const locales = [
  "ar-AE",
  "de-DE",
  "en-US",
  "es-ES",
  "es-MX",
  "fr-FR",
  "id-ID",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "pl-PL",
  "pt-BR",
  "ru-RU",
  "th-TH",
  "tr-TR",
  "vi-VN",
  "zh-CN",
  "zh-TW",
] as const;

/** A supported API locale, e.g. `"en-US"` or `"zh-CN"`. */
export type Locale = (typeof locales)[number];

export const DEFAULT_LOCALE: Locale = "en-US";

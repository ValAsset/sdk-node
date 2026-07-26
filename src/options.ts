import type { Locale } from "./locales.js";

/** Options for constructing a {@link ValAssetClient}. All fields are optional. */
export interface ValAssetClientOptions {
  /**
   * API origin. Defaults to `https://val-api.buguoguo.cn`. Passed to the HTTP layer verbatim —
   * not validated, normalized or trimmed; forks are responsible for their own value.
   */
  baseURL?: string;

  /** Default locale for localized endpoints. Defaults to `"en-US"`. */
  language?: Locale;

  /** Request timeout in milliseconds. Defaults to `0` (no client-side timeout). */
  timeout?: number;

  /**
   * Extra HTTP headers sent with every request. Merged over the SDK's single default header
   * (`Accept: application/json`), so `Accept` can be overridden.
   */
  headers?: Readonly<Record<string, string>>;
}

/** Per-request options for non-localized endpoints. */
export interface RequestOptions {
  /** Abort the request via an `AbortController`. */
  signal?: AbortSignal;
}

/** Per-request options for localized endpoints. */
export interface LocalizedRequestOptions extends RequestOptions {
  /** Locale for this request only. Wins over the client default, which wins over `"en-US"`. */
  language?: Locale;
}

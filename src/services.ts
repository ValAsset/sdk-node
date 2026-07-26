import type { LocalizedRequestOptions, RequestOptions } from "./options.js";
import type { Transport } from "./transport.js";

/** `list()` + `get(uuid)` over a localized collection resource. */
export interface CollectionService<T> {
  /** Fetch the full collection. Order is not guaranteed — do not rely on it. */
  list(options?: LocalizedRequestOptions): Promise<T[]>;

  /**
   * Fetch one item by UUID. The UUID is an opaque string inserted into the path verbatim —
   * no validation, lower-casing or URL-encoding (canonical UUIDs are hex digits and dashes).
   */
  get(uuid: string, options?: LocalizedRequestOptions): Promise<T>;
}

/** `get()` over a non-localized singleton resource. */
export interface SingletonService<T> {
  get(options?: RequestOptions): Promise<T>;
}

/** `get()` over a language-addressed singleton resource. */
export interface LocalizedSingletonService<T> {
  get(options?: LocalizedRequestOptions): Promise<T>;
}

export function collection<T>(transport: Transport, path: string): CollectionService<T> {
  return Object.freeze({
    list: (options?: LocalizedRequestOptions) => transport.getLocalized<T[]>(path, options),
    get: (uuid: string, options?: LocalizedRequestOptions) =>
      transport.getLocalized<T>(`${path}/${uuid}`, options),
  });
}

export function singleton<T>(transport: Transport, path: string): SingletonService<T> {
  return Object.freeze({
    get: (options?: RequestOptions) => transport.get<T>(path, options),
  });
}

export function localizedSingleton<T>(
  transport: Transport,
  path: string,
): LocalizedSingletonService<T> {
  return Object.freeze({
    get: (options?: LocalizedRequestOptions) => transport.getLocalized<T>(path, options),
  });
}

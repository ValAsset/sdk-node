import axios, { isAxiosError, type AxiosInstance } from "axios";
import { ValoAssetError } from "./errors.js";
import { DEFAULT_LOCALE, type Locale } from "./locales.js";
import type { LocalizedRequestOptions, RequestOptions, ValoAssetClientOptions } from "./options.js";

export const DEFAULT_BASE_URL = "https://val-api.buguoguo.cn";

interface WireApiError {
  status: number;
  code: string;
  title: string;
  detail: string;
  instance: string;
}

/**
 * Internal HTTP layer. Axios is an implementation detail: it never appears in public types, its
 * instance is never exposed, and `validateStatus` stays at the default so 2xx resolves and
 * everything else rejects. Success bodies are `{ status, data }` envelopes that get unwrapped
 * here; only the envelope and the error shape are validated at runtime — DTO field correctness
 * is the OpenAPI snapshot's job.
 */
export class Transport {
  private readonly http: AxiosInstance;
  private readonly defaultLanguage: Locale;

  constructor(options: ValoAssetClientOptions = {}) {
    this.http = axios.create({
      baseURL: options.baseURL ?? DEFAULT_BASE_URL,
      timeout: options.timeout ?? 0,
      headers: { Accept: "application/json", ...options.headers },
    });
    this.defaultLanguage = options.language ?? DEFAULT_LOCALE;
  }

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, undefined, options.signal);
  }

  getLocalized<T>(path: string, options: LocalizedRequestOptions = {}): Promise<T> {
    return this.request<T>(path, options.language ?? this.defaultLanguage, options.signal);
  }

  private async request<T>(
    path: string,
    language: Locale | undefined,
    signal: AbortSignal | undefined,
  ): Promise<T> {
    let httpStatus: number;
    let body: unknown;
    try {
      const response = await this.http.get<unknown>(path, {
        ...(language === undefined ? {} : { params: { language } }),
        ...(signal === undefined ? {} : { signal }),
      });
      httpStatus = response.status;
      body = response.data;
    } catch (error) {
      throw toValoAssetError(error);
    }

    if (!isRecord(body) || typeof body.status !== "number") {
      throw invalidResponse("Response body is not a { status, data } envelope", httpStatus, body);
    }
    if (body.status !== httpStatus) {
      throw invalidResponse(
        `Envelope status ${body.status} does not match HTTP status ${httpStatus}`,
        httpStatus,
        body,
      );
    }
    if (!("data" in body) || body.data === null || body.data === undefined) {
      throw invalidResponse("Envelope has no data", httpStatus, body);
    }
    return body.data as T;
  }
}

function invalidResponse(message: string, status: number, cause: unknown): ValoAssetError {
  return new ValoAssetError({ message, code: "invalid_response", status, cause });
}

function toValoAssetError(error: unknown): ValoAssetError {
  if (isAxiosError(error)) {
    if (error.code === "ERR_CANCELED") {
      return new ValoAssetError({
        message: "Request aborted",
        code: "request_aborted",
        cause: error,
      });
    }

    const response = error.response;
    if (response !== undefined) {
      const apiError = asWireApiError(response.data);
      if (apiError !== null) {
        return new ValoAssetError({
          message: apiError.title,
          code: apiError.code,
          status: response.status,
          detail: apiError.detail,
          instance: apiError.instance,
          cause: error,
        });
      }
      // An HTTP response that is not a ValoAsset error body — typically a proxy or CDN answering
      // in front of the application.
      return new ValoAssetError({
        message: `HTTP ${response.status}`,
        code: "http_error",
        status: response.status,
        cause: error,
      });
    }

    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return new ValoAssetError({
        message: "Request timed out",
        code: "request_timeout",
        cause: error,
      });
    }

    return new ValoAssetError({ message: "Network error", code: "network_error", cause: error });
  }

  return new ValoAssetError({ message: "Network error", code: "network_error", cause: error });
}

function asWireApiError(body: unknown): WireApiError | null {
  if (!isRecord(body)) {
    return null;
  }
  const candidate = body as Partial<WireApiError>;
  return typeof candidate.status === "number" &&
    typeof candidate.code === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.detail === "string" &&
    typeof candidate.instance === "string"
    ? (candidate as WireApiError)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

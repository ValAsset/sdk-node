/**
 * The single error type every failed SDK call rejects with.
 *
 * `code` is the stable, machine-checkable discriminator. Server-produced errors keep the server's
 * code (`uuid_not_found`, `language_not_found`, `validation_failed`, `resource_not_found`,
 * `method_not_allowed`, `internal_error`); failures the SDK detects itself use `network_error`,
 * `request_timeout`, `request_aborted`, `invalid_response` or `http_error` (an HTTP response that
 * is not a valid ValoAsset error body, e.g. from a proxy or CDN).
 */
export class ValoAssetError extends Error {
  override readonly name = "ValoAssetError";

  /** Stable error code; the only field whose exact values are contract. */
  readonly code: string;

  /** HTTP status code, present whenever an HTTP response was received. */
  readonly status?: number;

  /** Server-provided diagnostic detail (wording not contractual). */
  readonly detail?: string;

  /** Original request path plus query string, as reported by the server. */
  readonly instance?: string;

  /** The underlying failure (transport error, invalid body, ...); intentionally untyped. */
  override readonly cause?: unknown;

  constructor(options: {
    message: string;
    code: string;
    status?: number;
    detail?: string;
    instance?: string;
    cause?: unknown;
  }) {
    super(options.message);
    this.code = options.code;
    if (options.status !== undefined) {
      this.status = options.status;
    }
    if (options.detail !== undefined) {
      this.detail = options.detail;
    }
    if (options.instance !== undefined) {
      this.instance = options.instance;
    }
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/** Type guard for {@link ValoAssetError}. */
export function isValoAssetError(value: unknown): value is ValoAssetError {
  return value instanceof ValoAssetError;
}

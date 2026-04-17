/**
 * Toolio production Booqable API v4 root (per Booqable docs:
 * `https://{company_slug}.booqable.com/api/4/`).
 * All server-side Booqable HTTP calls use this base path (no extra `/api/4` in code).
 *
 * @see https://developers.booqable.com/#introduction-endpoint
 */
export const TOOLIO_BOOQABLE_BASE_URL = "https://toolio-inc.booqable.com/api/4";

const TOOLIO_BOOQABLE_ORIGIN_ONLY = "https://toolio-inc.booqable.com";

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeBooqableBaseUrl(value) {
  if (value == null || typeof value !== "string") {
    return null;
  }
  let t = value.trim().replace(/\/+$/, "");
  if (!t.length) {
    return null;
  }
  if (t === TOOLIO_BOOQABLE_ORIGIN_ONLY) {
    return TOOLIO_BOOQABLE_BASE_URL;
  }
  return t;
}

/**
 * @returns {{ ok: true, normalized: string } | { ok: false, error: string }}
 */
export function assertToolioBooqableBaseUrl(value) {
  const n = normalizeBooqableBaseUrl(value);
  if (!n) {
    return {
      ok: false,
      error: `BOOQABLE_BASE_URL must be ${TOOLIO_BOOQABLE_BASE_URL} (or ${TOOLIO_BOOQABLE_ORIGIN_ONLY} for compatibility). Currently unset.`,
    };
  }
  if (n !== TOOLIO_BOOQABLE_BASE_URL) {
    return {
      ok: false,
      error: `BOOQABLE_BASE_URL must be exactly ${TOOLIO_BOOQABLE_BASE_URL}. Current value: ${n}`,
    };
  }
  return { ok: true, normalized: n };
}

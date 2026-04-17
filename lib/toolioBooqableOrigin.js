/**
 * Toolio production Booqable API host (company slug `toolio-inc`).
 * All server-side Booqable HTTP calls must use this origin so webhooks and PATCHes
 * target the same account as Vercel env configuration.
 *
 * @see https://developers.booqable.com/#introduction-endpoint
 */
export const TOOLIO_BOOQABLE_BASE_URL = "https://toolio-inc.booqable.com";

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeBooqableBaseUrl(value) {
  if (value == null || typeof value !== "string") {
    return null;
  }
  const t = value.trim().replace(/\/+$/, "");
  return t.length > 0 ? t : null;
}

/**
 * @returns {{ ok: true, normalized: string } | { ok: false, error: string }}
 */
export function assertToolioBooqableBaseUrl(value) {
  const n = normalizeBooqableBaseUrl(value);
  if (!n) {
    return {
      ok: false,
      error: `BOOQABLE_BASE_URL must be ${TOOLIO_BOOQABLE_BASE_URL} (set on Vercel; no trailing slash). Currently unset.`,
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

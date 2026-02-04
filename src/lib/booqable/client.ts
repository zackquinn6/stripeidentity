// Lightweight client helpers for interacting with the Booqable widget.
// Kept framework-agnostic so it can be unit tested.

export type AnyBooqableApi = any;

export function getBooqableApi(): AnyBooqableApi {
  return (window as any).Booqable || (window as any).booqable;
}

export function booqableRefresh(): void {
  const api = getBooqableApi();
  if (!api) return;
  if (typeof api.refresh === 'function') api.refresh();
  if (typeof api.trigger === 'function') api.trigger('page-change');
}

/**
 * Apply rental period in the most compatible way we can:
 * 1) Update URL params (some widget installs read from querystring)
 * 2) Attempt to call known cart period setters if present
 */
export function applyRentalPeriod(startsAt: string, stopsAt: string): {
  appliedVia: string[];
} {
  const appliedVia: string[] = [];

  // (1) URL params (used by a lot of embed setups)
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('starts_at', startsAt);
    url.searchParams.set('stops_at', stopsAt);
    window.history.replaceState({}, '', url.toString());
    appliedVia.push('url');
  } catch {
    // ignore
  }

  const api = getBooqableApi();
  const cart = api?.cart;

  // (2) Direct cart API (varies across Booqable versions/installs)
  // We defensively check multiple method names.
  const candidates: Array<{ name: string; fn: unknown }>
    = [
      { name: 'cart.setTimespan', fn: cart?.setTimespan },
      { name: 'cart.setTimeSpan', fn: cart?.setTimeSpan },
      { name: 'cart.setPeriod', fn: cart?.setPeriod },
      { name: 'cart.setDates', fn: cart?.setDates },
      { name: 'cart.setRentalPeriod', fn: cart?.setRentalPeriod },
      { name: 'setTimespan', fn: api?.setTimespan },
      { name: 'setPeriod', fn: api?.setPeriod },
      { name: 'setDates', fn: api?.setDates },
    ];

  for (const c of candidates) {
    if (typeof c.fn !== 'function') continue;
    try {
      // Most APIs accept (startsAt, stopsAt); some accept a single object.
      (c.fn as any)(startsAt, stopsAt);
      appliedVia.push(c.name);
      break;
    } catch {
      try {
        (c.fn as any)({ starts_at: startsAt, stops_at: stopsAt });
        appliedVia.push(`${c.name}:object`);
        break;
      } catch {
        // continue
      }
    }
  }

  // Nudge the widget to re-read any updated state.
  booqableRefresh();
  return { appliedVia };
}

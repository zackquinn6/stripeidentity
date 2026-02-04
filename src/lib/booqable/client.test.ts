import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyRentalPeriod } from './client';

describe('applyRentalPeriod', () => {
  beforeEach(() => {
    // Ensure a stable URL to modify (via history API; location is not writable in jsdom).
    window.history.pushState({}, '', '/projects');
    vi.spyOn(window.history, 'replaceState');
    (window as any).Booqable = undefined;
    (window as any).booqable = undefined;
  });

  afterEach(() => {
    (window.history.replaceState as any).mockRestore?.();
  });

  it('sets starts_at/stops_at in the URL', () => {
    const res = applyRentalPeriod('2026-02-12T00:00:00.000-05:00', '2026-02-19T00:00:00.000-05:00');
    expect(res.appliedVia).toContain('url');
    expect(window.history.replaceState).toHaveBeenCalled();

    const lastUrl = (window.history.replaceState as any).mock.calls.at(-1)?.[2] as string;
    expect(lastUrl).toContain('starts_at=2026-02-12T00%3A00%3A00.000-05%3A00');
    expect(lastUrl).toContain('stops_at=2026-02-19T00%3A00%3A00.000-05%3A00');
  });

  it('uses cart.setTimespan when available', () => {
    const setTimespan = vi.fn();
    (window as any).Booqable = {
      cart: { setTimespan },
      refresh: vi.fn(),
      trigger: vi.fn(),
    };

    const res = applyRentalPeriod('a', 'b');
    expect(setTimespan).toHaveBeenCalledWith('a', 'b');
    expect(res.appliedVia.some((x) => x.includes('setTimespan'))).toBe(true);
  });
});

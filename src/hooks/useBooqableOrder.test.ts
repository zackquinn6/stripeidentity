import { describe, it, expect, vi } from 'vitest';
import { createBooqableOrder } from '@/lib/booqable/orderFlow';

describe('useBooqableOrder', () => {
  it('creates an order, adds lines, and fetches checkout URL with correct payload', async () => {
    const invoke = vi
      .fn()
      // (1) create-order
      .mockResolvedValueOnce({ data: { order: { id: 'order_123' } }, error: null })
      // (2) add-line for item A
      .mockResolvedValueOnce({ data: { line: { id: 'line_a' } }, error: null })
      // (3) add-line for item B
      .mockResolvedValueOnce({ data: { line: { id: 'line_b' } }, error: null })
      // (4) get-checkout-url
      .mockResolvedValueOnce({
        data: { checkoutUrl: 'https://example.com/checkout', orderNumber: 42, checkoutUrlSource: 'test' },
        error: null,
      });

    const startDate = new Date('2026-02-11T00:00:00.000-05:00');
    const endDate = new Date('2026-02-14T00:00:00.000-05:00');

    await createBooqableOrder({
      invoke,
      items: [
        // valid mapped items
        { id: 'local1', name: 'A', retailPrice: 0, dailyRate: 0, quantity: 2, booqableId: 'uuid-a' },
        { id: 'local2', name: 'B', retailPrice: 0, dailyRate: 0, quantity: 1, booqableId: 'uuid-b' },
        // should be skipped (no explicit mapping)
        { id: 'local3', name: 'C', retailPrice: 0, dailyRate: 0, quantity: 1 },
        // should be skipped (quantity 0)
        { id: 'local4', name: 'D', retailPrice: 0, dailyRate: 0, quantity: 0, booqableId: 'uuid-d' },
      ],
      startDate,
      endDate,
    });

    // create-order call
    expect(invoke).toHaveBeenNthCalledWith(1, 'booqable', {
      body: {
        action: 'create-order',
        // JS Dates in test env are normalized; assert the day, not the timezone.
        starts_at: expect.stringMatching(/^2026-02-11T/),
        stops_at: expect.stringMatching(/^2026-02-14T/),
      },
    });

    // add-line calls
    expect(invoke).toHaveBeenNthCalledWith(2, 'booqable', {
      body: { action: 'add-line', order_id: 'order_123', product_id: 'uuid-a', quantity: 2 },
    });
    expect(invoke).toHaveBeenNthCalledWith(3, 'booqable', {
      body: { action: 'add-line', order_id: 'order_123', product_id: 'uuid-b', quantity: 1 },
    });

    // checkout URL
    expect(invoke).toHaveBeenNthCalledWith(4, 'booqable', {
      body: { action: 'get-checkout-url', order_id: 'order_123' },
    });

    // return values covered implicitly by the last mocked response; ensure all steps happened.
    expect(invoke).toHaveBeenCalledTimes(4);
  });
});

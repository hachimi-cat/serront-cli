import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `serront api <area> <action>`: every feature route, generated from the API spec.
// The CLI's own request helper (lib/api.ts) is stubbed; everything above it is real.
const apiRequest = vi.fn();
vi.mock('../lib/api.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/api.js')>();
  return { ...real, apiRequest: (...args: unknown[]) => apiRequest(...args) };
});

const { API_ROUTES, buildApiCommand } = await import('../commands/api.generated.js');

let exits: Array<number | undefined>;

beforeEach(() => {
  apiRequest.mockReset();
  exits = [];
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    exits.push(code);
    return undefined as never;
  }) as typeof process.exit);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function run(argv: string[]): Promise<number | undefined> {
  await buildApiCommand().exitOverride().parseAsync(argv, { from: 'user' });
  return exits[0];
}

describe('serront api', () => {
  it('has a command for every feature route', () => {
    const count = API_ROUTES.reduce((n, a) => n + a.routes.length, 0);
    expect(count).toBeGreaterThanOrEqual(150);
    const areas = API_ROUTES.map((a) => a.area);
    expect(areas).toEqual(expect.arrayContaining(['services', 'orders', 'gift-cards', 'fulfillment', 'payouts']));
  });

  it('creates a service from flags, typed as the spec says', async () => {
    apiRequest.mockResolvedValue({ id: 'svc_1' });
    const code = await run([
      'services', 'create',
      '--slug', 'logo-design', '--name', 'Logo design', '--pricing-type', 'fixed', '--price-idr', '1500000',
      '--tags', 'design,brand', '--active', 'true',
    ]);
    expect(code).toBe(0);
    expect(apiRequest).toHaveBeenCalledWith('POST', '/api/v1/services', {
      query: {},
      body: { slug: 'logo-design', name: 'Logo design', pricingType: 'fixed', priceIdr: 1500000, tags: ['design', 'brand'], active: true },
    });
  });

  it('refuses a value the spec does not allow, and a missing required field', async () => {
    expect(await run(['services', 'create', '--slug', 'x', '--name', 'X', '--pricing-type', 'per-word'])).toBe(1);
    exits = [];
    expect(await run(['services', 'create', '--slug', 'x', '--name', 'X'])).toBe(1);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('puts path parameters in the path (mounted routers too) and query fields in the query', async () => {
    apiRequest.mockResolvedValue({});
    expect(await run(['orders', 'get', 'ord 1'])).toBe(0);
    expect(apiRequest).toHaveBeenLastCalledWith('GET', '/api/v1/orders/ord%201', { query: {}, body: undefined });
    exits = [];
    expect(await run(['orders', 'payments-confirm', 'ord_1', 'pay_2'])).toBe(0);
    expect(apiRequest).toHaveBeenLastCalledWith('POST', '/api/v1/orders/ord_1/payments/pay_2/confirm', { query: {}, body: undefined });
    exits = [];
    expect(await run(['orders', 'list', '--status', 'confirmed', '--limit', '5'])).toBe(0);
    expect(apiRequest).toHaveBeenLastCalledWith('GET', '/api/v1/orders', { query: { status: 'confirmed', limit: '5' }, body: undefined });
  });
});

import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../supabase.client', () => ({ supabase: supabaseMock }));

import { PricingService } from './pricing';
import { AdminConfigService } from './admin-config';

type Builder = Record<string, ReturnType<typeof vi.fn>>;

function createBuilder(result: unknown): Builder {
  const builder: Builder = {};
  builder['select'] = vi.fn(() => builder);
  builder['order'] = vi.fn(() => Promise.resolve(result));
  builder['update'] = vi.fn(() => builder);
  builder['upsert'] = vi.fn(() => builder);
  builder['eq'] = vi.fn(() => builder);
  builder['insert'] = vi.fn(() => builder);
  builder['single'] = vi.fn(() => Promise.resolve(result));
  builder['then'] = vi.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve),
  );
  return builder;
}

describe('AdminConfigService', () => {
  let service: AdminConfigService;
  let pricingService: PricingService;

  beforeEach(() => {
    const injector = Injector.create({
      providers: [{ provide: PricingService, useValue: new PricingService() }],
    });
    service = runInInjectionContext(injector, () => new AdminConfigService());
    pricingService = injector.get(PricingService);
    supabaseMock.from.mockReset();
  });

  it('reads pricing, formats, rooms and settings in camelCase order', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'pricing_config') {
        return createBuilder({
          data: [
            { seat_type: 'standard', base_price: '8000', presale_price: '6500' },
            { seat_type: 'vip', base_price: 12000, presale_price: 10000 },
          ],
          error: null,
        });
      }
      if (table === 'formats') {
        return createBuilder({
          data: [{ id: 1, name: '2D', price_multiplier: '1.00', active: true }],
          error: null,
        });
      }
      if (table === 'rooms') {
        return createBuilder({ data: [{ code: 'A', active: true }], error: null });
      }
      return createBuilder({
        data: [{ key: 'hold_minutes', value: '10', description: 'Bloqueo' }],
        error: null,
      });
    });

    const config = await service.getConfig();

    expect(config.pricing).toEqual([
      { seatType: 'standard', basePrice: 8000, presalePrice: 6500 },
      { seatType: 'accessible', basePrice: 0, presalePrice: 0 },
      { seatType: 'vip', basePrice: 12000, presalePrice: 10000 },
    ]);
    expect(config.formats).toEqual([{ id: 1, name: '2D', priceMultiplier: 1, active: true }]);
    expect(config.rooms).toEqual([{ code: 'A', active: true }]);
    expect(config.settings).toEqual([{ key: 'hold_minutes', value: '10', description: 'Bloqueo' }]);
  });

  it('upserts the three seat prices and invalidates the pricing cache', async () => {
    const builder = createBuilder({ data: null, error: null });
    supabaseMock.from.mockReturnValue(builder);
    const invalidate = vi.spyOn(pricingService, 'invalidate');

    await service.savePricing([
      { seatType: 'standard', basePrice: 9000, presalePrice: 7000 },
      { seatType: 'accessible', basePrice: 9000, presalePrice: 7000 },
      { seatType: 'vip', basePrice: 13000, presalePrice: 11000 },
    ]);

    expect(builder['upsert']).toHaveBeenCalledWith([
      { seat_type: 'standard', base_price: 9000, presale_price: 7000 },
      { seat_type: 'accessible', base_price: 9000, presale_price: 7000 },
      { seat_type: 'vip', base_price: 13000, presale_price: 11000 },
    ], { onConflict: 'seat_type' });
    expect(invalidate).toHaveBeenCalled();
  });

  it('saves a setting and clears the cached presale configuration', async () => {
    const builder = createBuilder({
      data: { key: 'presale_days', value: '5', description: 'Días' },
      error: null,
    });
    supabaseMock.from.mockReturnValue(builder);
    const invalidate = vi.spyOn(pricingService, 'invalidate');

    const saved = await service.saveSetting('presale_days', ' 5 ');

    expect(builder['update']).toHaveBeenCalledWith({
      value: '5',
      updated_at: expect.any(String),
    });
    expect(builder['eq']).toHaveBeenCalledWith('key', 'presale_days');
    expect(saved).toEqual({ key: 'presale_days', value: '5', description: 'Días' });
    expect(invalidate).toHaveBeenCalled();
  });

  it('propagates database errors without masking them', async () => {
    supabaseMock.from.mockReturnValue(createBuilder({ data: null, error: { message: 'permiso denegado' } }));

    await expect(service.getConfig()).rejects.toThrow('permiso denegado');
  });
});

import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../supabase.client', () => ({ supabase: supabaseMock }));

import { AdminPromotionsService } from './admin-promotions';

type Builder = Record<string, ReturnType<typeof vi.fn>>;

function createBuilder(result: unknown): Builder {
  const builder: Builder = {};
  builder['select'] = vi.fn(() => builder);
  builder['order'] = vi.fn(() => builder);
  builder['insert'] = vi.fn(() => builder);
  builder['update'] = vi.fn(() => builder);
  builder['eq'] = vi.fn(() => builder);
  builder['single'] = vi.fn(() => Promise.resolve(result));
  builder['then'] = vi.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve),
  );
  return builder;
}

const couponRow = {
  id: 3,
  code: 'PROMO10',
  type: 'general',
  percentage: '10.00',
  min_age: null,
  active: true,
  valid_from: '2026-11-05T00:00:00-03:00',
  valid_until: null,
  description: 'Descuento general',
};

const rewardRow = {
  id: 7,
  name: 'Crédito $5.000',
  description: '',
  points_cost: 500,
  reward_type: 'credit',
  reward_value: '5000.00',
  active: true,
};

describe('AdminPromotionsService', () => {
  let service: AdminPromotionsService;

  beforeEach(() => {
    service = new AdminPromotionsService();
    supabaseMock.from.mockReset();
  });

  it('maps coupon and reward rows to the admin models', async () => {
    supabaseMock.from.mockImplementation((table: string) =>
      createBuilder({ data: table === 'coupons' ? [couponRow] : [rewardRow], error: null }),
    );

    await expect(service.getCoupons()).resolves.toEqual([{
      id: 3,
      code: 'PROMO10',
      type: 'general',
      percentage: 10,
      minAge: null,
      active: true,
      validFrom: '2026-11-05T00:00:00-03:00',
      validUntil: null,
      description: 'Descuento general',
    }]);
    await expect(service.getRewards()).resolves.toEqual([{
      id: 7,
      name: 'Crédito $5.000',
      description: '',
      pointsCost: 500,
      rewardType: 'credit',
      rewardValue: 5000,
      active: true,
    }]);
  });

  it('inserts a coupon with dates and optional minimum age', async () => {
    const builder = createBuilder({ data: couponRow, error: null });
    supabaseMock.from.mockReturnValue(builder);

    const saved = await service.saveCoupon({
      code: 'PROMO10',
      type: 'general',
      percentage: 10,
      minAge: null,
      active: true,
      validFrom: '2026-11-05T00:00:00-03:00',
      validUntil: null,
      description: 'Descuento general',
    });

    expect(supabaseMock.from).toHaveBeenCalledWith('coupons');
    expect(builder['insert']).toHaveBeenCalledWith({
      code: 'PROMO10',
      type: 'general',
      percentage: 10,
      min_age: null,
      active: true,
      valid_from: '2026-11-05T00:00:00-03:00',
      valid_until: null,
      description: 'Descuento general',
    });
    expect(saved.code).toBe('PROMO10');
  });

  it('updates only the reward state when toggling', async () => {
    const builder = createBuilder({ data: { ...rewardRow, active: false }, error: null });
    supabaseMock.from.mockReturnValue(builder);

    const updated = await service.setRewardActive(7, false);

    expect(supabaseMock.from).toHaveBeenCalledWith('rewards');
    expect(builder['update']).toHaveBeenCalledWith({ active: false });
    expect(builder['eq']).toHaveBeenCalledWith('id', 7);
    expect(updated.active).toBe(false);
  });

  it('surfaces database errors without masking them', async () => {
    supabaseMock.from.mockReturnValue(createBuilder({ data: null, error: { message: 'permiso denegado' } }));

    await expect(service.getRewards()).rejects.toThrow('permiso denegado');
  });
});

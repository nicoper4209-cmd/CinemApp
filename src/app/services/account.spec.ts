import '@angular/compiler';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('../supabase.client', () => ({ supabase: supabaseMock }));

import { AccountService } from './account';

function query(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'order', 'limit', 'eq']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

describe('AccountService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads personal points and credit balances through the balance RPCs', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ data: 175, error: null })
      .mockResolvedValueOnce({ data: '2400.50', error: null });
    const service = new AccountService();

    await service.refreshBalances();

    expect(service.pointsBalance()).toBe(175);
    expect(service.creditBalance()).toBe(2400.5);
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(1, 'my_points_balance');
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(2, 'my_credit_balance');
  });

  it('propagates balance RPC errors', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'No autorizado' } });
    const service = new AccountService();

    await expect(service.refreshBalances()).rejects.toThrow('No autorizado');
  });

  it('redeems through redeem_reward and refreshes balances and movements', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ data: { ok: true, reward: 'Crédito $500', code: 'AB12CD34' }, error: null })
      .mockResolvedValueOnce({ data: 25, error: null })
      .mockResolvedValueOnce({ data: '500', error: null });
    supabaseMock.from
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }));
    const service = new AccountService();

    await expect(service.redeemReward(9)).resolves.toEqual({
      ok: true,
      reward: 'Crédito $500',
      code: 'AB12CD34',
    });
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(1, 'redeem_reward', { p_reward_id: 9 });
    expect(service.pointsBalance()).toBe(25);
    expect(service.creditBalance()).toBe(500);
  });

  it('surfaces redeem_reward errors and does not write to ledgers directly', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Puntos insuficientes' } });
    const service = new AccountService();

    await expect(service.redeemReward(9)).rejects.toThrow('Puntos insuficientes');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});

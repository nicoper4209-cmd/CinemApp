import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../supabase.client', () => ({ supabase: supabaseMock }));

import { StaffService } from './staff';

describe('StaffService RPC contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates a ticket by sending its QR/manual code to validate_ticket', async () => {
    const ticket = {
      ok: true,
      movie: 'Película',
      room: 'A',
      starts_at: '2026-10-31T20:00:00-03:00',
      seat: 'A-1-4',
      seat_type: 'standard',
      age_rating: '+13',
      minor_notice: true,
    };
    supabaseMock.rpc.mockResolvedValueOnce({ data: ticket, error: null });

    await expect(new StaffService().validateTicket('  CODE-123  ')).resolves.toEqual(ticket);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('validate_ticket', { p_code: 'CODE-123' });
  });

  it('returns RPC validation errors without replacing the message', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Entrada ya utilizada (31/10 18:45)' } });

    await expect(new StaffService().validateTicket('CODE-123'))
      .rejects.toThrow('Entrada ya utilizada (31/10 18:45)');
  });

  it('delivers Candy through the RPC and returns its item list', async () => {
    const delivery = { ok: true, items: [{ name: 'Pochoclo', qty: 2 }, { name: 'Gaseosa', qty: 1 }] };
    supabaseMock.rpc.mockResolvedValueOnce({ data: delivery, error: null });

    await expect(new StaffService().deliverCandy('CANDY-456')).resolves.toEqual(delivery);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('deliver_candy', { p_code: 'CANDY-456' });
  });

  it('surfaces delivery errors and rejects malformed success responses', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'El pedido ya fue entregado' } })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    const service = new StaffService();

    await expect(service.deliverCandy('CANDY-456')).rejects.toThrow('El pedido ya fue entregado');
    await expect(service.deliverCandy('CANDY-456')).rejects.toThrow('La entrega no devolvió un pedido válido.');
  });
});

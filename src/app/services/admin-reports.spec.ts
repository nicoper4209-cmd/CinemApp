import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('../supabase.client', () => ({ supabase: supabaseMock }));

import { AdminReportsService } from './admin-reports';

type Builder = Record<string, ReturnType<typeof vi.fn>>;

function createBuilder(result: unknown): Builder {
  const builder: Builder = {};
  builder['select'] = vi.fn(() => builder);
  builder['order'] = vi.fn(() => builder);
  builder['limit'] = vi.fn(() => builder);
  builder['in'] = vi.fn(() => builder);
  builder['then'] = vi.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve),
  );
  return builder;
}

describe('AdminReportsService', () => {
  let service: AdminReportsService;

  beforeEach(() => {
    service = new AdminReportsService();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('maps the daily billing report returned by the RPC', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{
        report_date: '2026-11-04',
        bookings_count: '3',
        tickets_count: 5,
        tickets_amount: '45000.00',
        candy_amount: 12000,
        discounts: '4500.00',
        credit_used: 0,
        cash_total: '52500.00',
      }],
      error: null,
    });

    const report = await service.getDailyReport('2026-11-04');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('daily_billing_report', { p_date: '2026-11-04' });
    expect(report).toEqual({
      reportDate: '2026-11-04',
      bookingsCount: 3,
      ticketsCount: 5,
      ticketsAmount: 45000,
      candyAmount: 12000,
      discounts: 4500,
      creditUsed: 0,
      cashTotal: 52500,
    });
  });

  it('maps movie sales rows and passes the date range', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{ sale_date: '2026-11-03', movie_id: 9, title: 'Película', tickets: '2', revenue: '16000.00' }],
      error: null,
    });

    const rows = await service.getMovieSales('2026-11-01', '2026-11-04');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('movie_sales_report', {
      p_from: '2026-11-01',
      p_to: '2026-11-04',
      p_movie_ids: null,
    });
    expect(rows).toEqual([{
      saleDate: '2026-11-03',
      movieId: 9,
      title: 'Película',
      tickets: 2,
      revenue: 16000,
    }]);
  });

  it('loads the audit log and resolves actor emails', async () => {
    const auditBuilder = createBuilder({
      data: [{
        id: 15,
        actor_id: 'user-1',
        action: 'UPDATE',
        entity: 'formats',
        entity_id: '2',
        details: { old: { active: true }, new: { active: false } },
        created_at: '2026-11-04T12:00:00Z',
      }],
      error: null,
    });
    const profilesBuilder = createBuilder({
      data: [{ id: 'user-1', email: 'admin@cine.com' }],
      error: null,
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'audit_log' ? auditBuilder : profilesBuilder,
    );

    const entries = await service.getAuditLog(100);

    expect(auditBuilder['limit']).toHaveBeenCalledWith(100);
    expect(profilesBuilder['in']).toHaveBeenCalledWith('id', ['user-1']);
    expect(entries[0]).toMatchObject({
      id: 15,
      actorEmail: 'admin@cine.com',
      action: 'UPDATE',
      entity: 'formats',
    });
  });

  it('surfaces RPC errors without masking them', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'Requiere administrador' } });

    await expect(service.getMovieSales('2026-11-01', '2026-11-04'))
      .rejects.toThrow('Requiere administrador');
  });
});

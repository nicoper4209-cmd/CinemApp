import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('../supabase.client', () => ({ supabase: supabaseMock }));

import { AdminAlertsService } from './admin-alerts';

type Builder = Record<string, ReturnType<typeof vi.fn>>;

function createBuilder(result: unknown): Builder {
  const builder: Builder = {};
  builder['select'] = vi.fn(() => builder);
  builder['eq'] = vi.fn(() => builder);
  builder['order'] = vi.fn(() => builder);
  builder['then'] = vi.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve),
  );
  return builder;
}

describe('AdminAlertsService', () => {
  let service: AdminAlertsService;

  beforeEach(() => {
    service = new AdminAlertsService();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('lists only upcoming movies ordered by release date', async () => {
    const builder = createBuilder({
      data: [{ id: 4, title: 'Próximo estreno', release_date: '2026-12-01' }],
      error: null,
    });
    supabaseMock.from.mockReturnValue(builder);

    const movies = await service.getUpcomingMovies();

    expect(supabaseMock.from).toHaveBeenCalledWith('movies');
    expect(builder['eq']).toHaveBeenCalledWith('status', 'upcoming');
    expect(builder['order']).toHaveBeenNthCalledWith(1, 'release_date', { ascending: true });
    expect(builder['order']).toHaveBeenNthCalledWith(2, 'title', { ascending: true });
    expect(movies).toEqual([{ id: 4, title: 'Próximo estreno', releaseDate: '2026-12-01' }]);
  });

  it('sends the alert through the RPC and returns the queued count', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 7, error: null });

    const count = await service.sendPremiereAlert(4, '¡Se estrena!', 'Ya podés reservar.');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('send_premiere_alerts', {
      p_movie_id: 4,
      p_title: '¡Se estrena!',
      p_body: 'Ya podés reservar.',
    });
    expect(count).toBe(7);
  });

  it('surfaces RPC errors without masking them', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'Solo administradores' } });

    await expect(service.sendPremiereAlert(4, 'Título', 'Mensaje'))
      .rejects.toThrow('Solo administradores');
  });
});

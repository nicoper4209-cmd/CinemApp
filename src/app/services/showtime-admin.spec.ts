import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('../supabase.client', () => ({ supabase: supabaseMock }));

import { ShowtimeService } from './showtime';

describe('ShowtimeService admin scheduling', () => {
  it('lists upcoming showtimes with the database-assigned room', async () => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder['select'] = vi.fn(() => builder);
    builder['gte'] = vi.fn(() => builder);
    builder['order'] = vi.fn()
      .mockReturnValueOnce(builder)
      .mockResolvedValueOnce({
        data: [{ id: 2, movie_id: 12, room: 'B', date: '2026-11-04', time: '19:30:00', format_id: 2 }],
        error: null,
      });
    supabaseMock.from.mockReturnValue(builder);

    const showtimes = await new ShowtimeService().getUpcomingForAdmin();

    expect(supabaseMock.from).toHaveBeenCalledWith('showtimes');
    expect(builder['select']).toHaveBeenCalledWith('id,movie_id,room,date,time,format_id');
    expect(builder['gte']).toHaveBeenCalledWith('date', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(showtimes).toEqual([{
      id: 2, movieId: 12, room: 'B', date: '2026-11-04', time: '19:30', formatId: 2,
    }]);
  });

  it('calls schedule_showtimes with the selected movie, range, ISO weekdays, time, and format', async () => {
    const response = { created: 4, skipped: 1, skipped_dates: ['2026-11-04'] };
    supabaseMock.rpc.mockResolvedValue({ data: response, error: null });
    const service = new ShowtimeService();

    await expect(service.scheduleRecurring({
      movieId: 12,
      from: '2026-11-01',
      to: '2026-11-30',
      weekdays: [1, 3, 5],
      time: '19:30',
      formatId: 2,
    })).resolves.toEqual(response);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('schedule_showtimes', {
      p_movie_id: 12,
      p_from: '2026-11-01',
      p_to: '2026-11-30',
      p_weekdays: [1, 3, 5],
      p_time: '19:30',
      p_format_id: 2,
    });
  });

  it('shows the database error without masking it', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'No hay salas disponibles en ese horario' } });

    await expect(new ShowtimeService().scheduleRecurring({
      movieId: 12, from: '2026-11-01', to: '2026-11-07', weekdays: [1], time: '19:30', formatId: null,
    })).rejects.toThrow('No hay salas disponibles en ese horario');
  });
});

import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn(), storage: { from: vi.fn() } }));
vi.mock('../supabase.client', () => ({ supabase: supabaseMock }));

import { MovieService } from './movie';

describe('MovieService movie highlights', () => {
  it('reads the Top 3 from top_movies_30d and maps the sales count', async () => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    query['select'] = vi.fn(() => query);
    query['order'] = vi.fn(() => query);
    query['limit'] = vi.fn().mockResolvedValue({
      data: [{ movie_id: 19, title: 'Ejemplo', poster: 'ejemplo.webp', tickets_sold: '12' }],
      error: null,
    });
    supabaseMock.from.mockReturnValue(query);
    supabaseMock.storage.from.mockReturnValue({
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
    });

    const movies = await new MovieService().getTopMovies();

    expect(supabaseMock.from).toHaveBeenCalledWith('top_movies_30d');
    expect(query['select']).toHaveBeenCalledWith('movie_id,title,poster,tickets_sold');
    expect(query['order']).toHaveBeenCalledWith('tickets_sold', { ascending: false });
    expect(query['limit']).toHaveBeenCalledWith(3);
    expect(movies).toEqual([{
      movieId: 19,
      title: 'Ejemplo',
      poster: 'https://storage.test/ejemplo.webp',
      ticketsSold: 12,
    }]);
  });

  it('does not silently hide errors from the ranking view', async () => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    query['select'] = vi.fn(() => query);
    query['order'] = vi.fn(() => query);
    query['limit'] = vi.fn().mockResolvedValue({ data: null, error: new Error('permission denied') });
    supabaseMock.from.mockReturnValue(query);

    await expect(new MovieService().getTopMovies()).rejects.toThrow('permission denied');
  });
});

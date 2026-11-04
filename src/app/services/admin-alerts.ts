import { Injectable } from '@angular/core';
import { UpcomingMovie } from '../models/admin-alerts';
import { supabase } from '../supabase.client';

interface UpcomingMovieRow {
  id: number;
  title: string;
  release_date: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminAlertsService {
  async getUpcomingMovies(): Promise<UpcomingMovie[]> {
    const { data, error } = await supabase
      .from('movies')
      .select('id,title,release_date')
      .eq('status', 'upcoming')
      .order('release_date', { ascending: true })
      .order('title', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as UpcomingMovieRow[]).map(row => ({
      id: row.id,
      title: row.title,
      releaseDate: row.release_date,
    }));
  }

  async sendPremiereAlert(movieId: number, title: string, body: string): Promise<number> {
    const { data, error } = await supabase.rpc('send_premiere_alerts', {
      p_movie_id: movieId,
      p_title: title,
      p_body: body,
    });
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  }
}

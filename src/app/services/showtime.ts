import { Injectable } from '@angular/core';
import { Showtime } from '../models/showtime';
import { supabase } from '../supabase.client';

interface ShowtimeRow {
  id: number;
  movie_id: number;
  room: string;
  date: string;
  time: string;
  format_id: number | null;
}

export interface ShowtimeFormat {
  id: number;
  name: string;
}

export interface ScheduleShowtimesResult {
  created: number;
  skipped: number;
  skipped_dates: string[];
}

function localDateString(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values['year']}-${values['month']}-${values['day']}`;
}

@Injectable({
  providedIn: 'root',
})
export class ShowtimeService {
  async getUpcomingForAdmin(): Promise<Showtime[]> {
    const { data, error } = await supabase
      .from('showtimes')
      .select('id,movie_id,room,date,time,format_id')
      .gte('date', localDateString())
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as ShowtimeRow[]).map(row => ({
      id: row.id,
      movieId: row.movie_id,
      room: row.room,
      date: row.date,
      time: row.time.slice(0, 5),
      formatId: row.format_id,
    }));
  }

  async getActiveFormats(): Promise<ShowtimeFormat[]> {
    const { data, error } = await supabase
      .from('formats')
      .select('id,name')
      .eq('active', true)
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as ShowtimeFormat[];
  }

  async scheduleRecurring(input: {
    movieId: number;
    from: string;
    to: string;
    weekdays: number[];
    time: string;
    formatId: number | null;
  }): Promise<ScheduleShowtimesResult> {
    const { data, error } = await supabase.rpc('schedule_showtimes', {
      p_movie_id: input.movieId,
      p_from: input.from,
      p_to: input.to,
      p_weekdays: input.weekdays,
      p_time: input.time,
      p_format_id: input.formatId,
    });
    if (error) throw new Error(error.message);
    return data as ScheduleShowtimesResult;
  }

  async getByMovie(movieId: number): Promise<Showtime[]> {
    const { data, error } = await supabase
      .from('showtimes')
      .select('id, movie_id, room, date, time, format_id')
      .eq('movie_id', movieId)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) {
      console.error('Error al cargar funciones:', error);
      throw error;
    }

    return (data as ShowtimeRow[]).map((row) => ({
      id: row.id,
      movieId: row.movie_id,
      room: row.room,
      date: row.date,
      time: row.time.slice(0, 5),
      formatId: row.format_id,
    }));
  }

  async getById(id: number): Promise<Showtime | undefined> {
    const { data, error } = await supabase
      .from('showtimes')
      .select('id, movie_id, room, date, time, format_id')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error al cargar función:', error);
      throw error;
    }

    if (!data) return undefined;

    const row = data as ShowtimeRow;

    return {
      id: row.id,
      movieId: row.movie_id,
      room: row.room,
      date: row.date,
      time: row.time.slice(0, 5),
      formatId: row.format_id,
    };
  }
}

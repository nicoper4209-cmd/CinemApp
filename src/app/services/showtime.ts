import { Injectable } from '@angular/core';
import { Showtime } from '../models/showtime';
import { supabase } from '../supabase.client';

interface ShowtimeRow {
  id: number;
  movie_id: number;
  room: string;
  date: string;
  time: string;
  price: number;
}

@Injectable({
  providedIn: 'root',
})
export class ShowtimeService {
  async getByMovie(movieId: number): Promise<Showtime[]> {
    const { data, error } = await supabase
      .from('showtimes')
      .select('id, movie_id, room, date, time, price')
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
      price: Number(row.price),
    }));
  }

  async getById(id: number): Promise<Showtime | undefined> {
    const { data, error } = await supabase
      .from('showtimes')
      .select('id, movie_id, room, date, time, price')
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
      price: Number(row.price),
    };
  }
}


import { inject, Injectable } from '@angular/core';
import { Booking } from '../models/booking';
import { Movie } from '../models/movie';
import { Showtime } from '../models/showtime';
import { MovieService } from './movie';
import { ShowtimeService } from './showtime';
import { supabase } from '../supabase.client';

interface NewBooking {
  movie: Movie;
  showtime: Showtime;
  seats: string[];
}

interface BookingRow {
  id: string;
  movie_id: number;
  showtime_id: number;
  total: number;
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class BookingService {
  private movieService = inject(MovieService);
private showtimeService = inject(ShowtimeService);

  async create(data: NewBooking): Promise<Booking> {
    const { data: result, error } = await supabase.rpc(
      'create_booking',
      {
        p_showtime_id: data.showtime.id,
        p_seats: data.seats,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    const created = result as {
      id: string;
      seats: string[];
      total: number;
    };

    return {
      id: created.id,
      movie: data.movie,
      showtime: data.showtime,
      seats: created.seats,
      total: Number(created.total),
      createdAt: new Date().toISOString(),
    };
  }

  async getAll(): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, movie_id, showtime_id, total, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return Promise.all(
      ((data ?? []) as BookingRow[]).map(row => this.mapBooking(row))
    );
  }

  async getById(id: string): Promise<Booking | undefined> {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, movie_id, showtime_id, total, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return undefined;
    }

    return this.mapBooking(data as BookingRow);
  }

  private async mapBooking(row: BookingRow): Promise<Booking> {
    const [movie, showtime, seatsResult] = await Promise.all([
      this.movieService.getById(row.movie_id),
      this.showtimeService.getById(row.showtime_id),
      supabase
        .from('booking_seats')
        .select('seat_label')
        .eq('booking_id', row.id),
    ]);

    if (seatsResult.error) {
      throw seatsResult.error;
    }

    if (!movie || !showtime) {
      throw new Error('No se encontraron los datos de la película o función.');
    }

    return {
      id: row.id,
      movie,
      showtime,
      seats: (seatsResult.data ?? []).map(seat => seat.seat_label),
      total: Number(row.total),
      createdAt: row.created_at,
    };
  }
}

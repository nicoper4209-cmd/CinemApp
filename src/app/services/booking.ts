
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
  private recentlyBookedSeats = new Map<number, Set<string>>();

  getRecentlyBookedSeats(showtimeId: number): string[] {
    return [...(this.recentlyBookedSeats.get(showtimeId) ?? [])];
  }

  private rememberBookedSeats(showtimeId: number, seats: string[]): void {
    const bookedSeats =
      this.recentlyBookedSeats.get(showtimeId) ?? new Set<string>();

    seats.forEach(seat => bookedSeats.add(seat));
    this.recentlyBookedSeats.set(showtimeId, bookedSeats);
  }

  async purchase(data: NewBooking & { contactEmail: string; birthDate: string }): Promise<Booking> {
    const { error: holdError } = await supabase.rpc('hold_seats', {
      p_showtime_id: data.showtime.id,
      p_seats: data.seats,
    });
    if (holdError) throw new Error(holdError.message);

    const { data: result, error } = await supabase.rpc('purchase_tickets', {
      p_showtime_id: data.showtime.id,
      p_seats: data.seats,
      p_candy: [],
      p_coupon_code: null,
      p_use_credit: 0,
      p_payment_method: 'mock',
      p_contact_email: data.contactEmail,
      p_birth_date: data.birthDate,
    });

    if (error) {
      throw new Error(error.message);
    }

    const bookingId = result as string;
    this.rememberBookedSeats(data.showtime.id, data.seats);

    return {
      id: bookingId,
      movie: data.movie,
      showtime: data.showtime,
      seats: data.seats,
      total: data.seats.reduce((total, seat) => total + this.estimatedSeatPrice(data.showtime, seat), 0),
      createdAt: new Date().toISOString(),
    };
  }

  private estimatedSeatPrice(showtime: Showtime, seat: string): number {
    return ['R', 'S', 'T'].includes(seat.split('-')[0])
      ? (showtime.price ?? 0) + 6500
      : showtime.price ?? 0;
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


import { inject, Injectable } from '@angular/core';
import { Booking, TicketBooking } from '../models/booking';
import { Movie } from '../models/movie';
import { Showtime } from '../models/showtime';
import { MovieService } from './movie';
import { ShowtimeService } from './showtime';
import { SeatHoldService } from './seat-hold';
import { supabase } from '../supabase.client';

interface NewBooking {
  movie?: Movie;
  showtime: Showtime | null;
  seats: string[];
  candy?: Array<{ product_id: number; qty: number }>;
}

interface BookingRow {
  id: string;
  movie_id: number | null;
  showtime_id: number | null;
  total: number;
  created_at: string;
  contact_email?: string | null;
  candy_qr?: string | null;
  candy_code?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class BookingService {
  private movieService = inject(MovieService);
  private showtimeService = inject(ShowtimeService);
  private seatHoldService = inject(SeatHoldService);

  async purchase(data: NewBooking & { contactEmail: string | null; birthDate: string | null }): Promise<string> {
    if (data.showtime && data.seats.length > 0) {
      await this.seatHoldService.updateHold(data.showtime.id, data.seats);
    }

    const { data: result, error } = await supabase.rpc('purchase_tickets', {
      p_showtime_id: data.showtime?.id ?? null,
      p_seats: data.seats,
      p_candy: data.candy ?? [],
      p_coupon_code: null,
      p_use_credit: 0,
      p_payment_method: 'mock',
      p_contact_email: data.contactEmail,
      p_birth_date: data.birthDate,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.showtime && data.seats.length > 0) {
      this.seatHoldService.completePurchase(data.showtime.id);
    }
    return result as string;
  }

  async getAll(): Promise<TicketBooking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, movie_id, showtime_id, total, created_at, contact_email, candy_qr, candy_code')
      .not('showtime_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const bookings = await Promise.all(
      ((data ?? []) as BookingRow[]).map(row => this.mapBooking(row))
    );
    return bookings.map(booking => {
      if (!booking.movie || !booking.showtime) {
        throw new Error('No se encontraron los datos de la película o función.');
      }
      return { ...booking, movie: booking.movie, showtime: booking.showtime };
    });
  }

  async getById(id: string): Promise<Booking | undefined> {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, movie_id, showtime_id, total, created_at, contact_email, candy_qr, candy_code')
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
    const [movie, showtime, seatsResult, candyResult] = await Promise.all([
      row.movie_id ? this.movieService.getById(row.movie_id) : Promise.resolve(undefined),
      row.showtime_id ? this.showtimeService.getById(row.showtime_id) : Promise.resolve(undefined),
      supabase
        .from('booking_seats')
        .select('seat_label')
        .eq('booking_id', row.id),
      supabase
        .from('booking_candy_items')
        .select('product_id,quantity,unit_price,candy_products(name)')
        .eq('booking_id', row.id),
    ]);

    if (seatsResult.error) {
      throw seatsResult.error;
    }

    if (candyResult.error) throw candyResult.error;

    if (row.showtime_id && (!movie || !showtime)) {
      throw new Error('No se encontraron los datos de la película o función.');
    }

    const candyItems = (candyResult.data ?? []).map(item => ({
      productId: item.product_id,
      name: item.candy_products?.[0]?.name ?? `Producto ${item.product_id}`,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
    }));

    return {
      id: row.id,
      movie: movie ?? null,
      showtime: showtime ?? null,
      seats: (seatsResult.data ?? []).map(seat => seat.seat_label),
      total: Number(row.total),
      createdAt: row.created_at,
      contactEmail: row.contact_email ?? undefined,
      candyQr: row.candy_qr ?? undefined,
      candyCode: row.candy_code ?? undefined,
      candyItems,
    };
  }
}

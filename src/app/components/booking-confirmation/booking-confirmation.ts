
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Booking } from '../../models/booking';
import { MovieService } from '../../services/movie';
import { ShowtimeService } from '../../services/showtime';
import { supabase } from '../../supabase.client';

@Component({
  selector: 'app-booking-confirmation',
  imports: [RouterLink],
  templateUrl: './booking-confirmation.html',
  styleUrl: './booking-confirmation.css',
})
export class BookingConfirmation {
  private route = inject(ActivatedRoute);
  private movieService = inject(MovieService);
  private showtimeService = inject(ShowtimeService);

  bookingId = this.route.snapshot.paramMap.get('id') ?? '';

  booking = signal<Booking | undefined>(undefined);
  loading = signal(true);
  errorMessage = signal('');

  constructor() {
    void this.loadBooking();
  }

  private async loadBooking(): Promise<void> {
    try {
      const { data: row, error } = await supabase
        .from('bookings')
        .select('id, movie_id, showtime_id, total, created_at')
        .eq('id', this.bookingId)
        .single();

      if (error) {
        throw error;
      }

      const [movie, showtime] = await Promise.all([
        this.movieService.getById(row.movie_id),
        this.showtimeService.getById(row.showtime_id),
      ]);

      if (!movie || !showtime) {
        throw new Error('No se encontraron los datos de la película o función.');
      }

      const { data: seatRows, error: seatsError } = await supabase
        .from('booking_seats')
        .select('seat_label')
        .eq('booking_id', this.bookingId);

      if (seatsError) {
        throw seatsError;
      }

      this.booking.set({
        id: row.id,
        movie,
        showtime,
        seats: (seatRows ?? []).map(seat => seat.seat_label),
        total: Number(row.total),
        createdAt: row.created_at,
      });
    } catch (error) {
      console.error('Error al cargar la reserva:', error);

      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar la reserva.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }
}

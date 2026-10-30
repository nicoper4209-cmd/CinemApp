
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Movie } from '../../models/movie';
import { Showtime } from '../../models/showtime';
import { BookingService } from '../../services/booking';
import { AuthService } from '../../services/auth';

interface BookingData {
  movie: Movie;
  showtime: Showtime;
  seats: string[];
  total: number;
}

@Component({
  selector: 'app-booking-summary',
  imports: [RouterLink, FormsModule],
  templateUrl: './booking-summary.html',
  styleUrl: './booking-summary.css',
})
export class BookingSummary {
  private router = inject(Router);
  private bookingData = history.state as BookingData;
  private bookingService = inject(BookingService);
  private authService = inject(AuthService);

  movie = this.bookingData?.movie;
  showtime = this.bookingData?.showtime;
  seats = this.bookingData?.seats ?? [];
  total = this.bookingData?.total ?? 0;
  contactEmail = signal('');
  birthDate = signal('');
  today = new Date().toISOString().slice(0, 10);

  confirming = signal(false);
  errorMessage = signal('');

  bookingAvailable = computed(() =>
    !!this.movie &&
    !!this.showtime &&
    this.seats.length > 0
  );

  guestDetailsValid = computed(() =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.contactEmail().trim()) &&
    !!this.birthDate() && this.birthDate() <= this.today
  );

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }

  getSeatPrice(seatId: string): number {
    const isVip = ['R', 'S', 'T'].includes(seatId.split('-')[0]);
    const basePrice = this.showtime?.price ?? 0;

    return isVip ? basePrice + 6500 : basePrice;
  }

  async confirmBooking(): Promise<void> {
    if (!this.bookingAvailable() || !this.guestDetailsValid() || this.confirming()) {
      return;
    }

    this.confirming.set(true);
    this.errorMessage.set('');

    try {
      await this.authService.continueAsGuest();
      const booking = await this.bookingService.purchase({
        movie: this.movie!,
        showtime: this.showtime!,
        seats: [...this.seats],
        contactEmail: this.contactEmail().trim(),
        birthDate: this.birthDate(),
      });

      await this.router.navigate([
        '/booking-confirmation',
        booking.id,
      ]);
    } catch (error) {
      console.error('Error al crear la reserva:', error);

      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'No se pudo completar la reserva. Intentá nuevamente.'
      );
    } finally {
      this.confirming.set(false);
    }
  }

  get contactEmailValue(): string { return this.contactEmail(); }
  set contactEmailValue(value: string) { this.contactEmail.set(value); }
  get birthDateValue(): string { return this.birthDate(); }
  set birthDateValue(value: string) { this.birthDate.set(value); }
}

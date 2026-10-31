import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Movie } from '../../models/movie';
import { FavoriteService } from '../../services/favorites';
import { MovieService } from '../../services/movie';
import { BookingService } from '../../services/booking';
import { TicketBooking } from '../../models/booking';
import { AuthService } from '../../services/auth';
import { AccountService } from '../../services/account';

type MyMoviesSection = 'favorites' | 'upcoming' | 'tickets';

@Component({
  selector: 'app-my-movies',
  imports: [RouterLink],
  templateUrl: './my-movies.html',
  styleUrl: './my-movies.css',
})
export class MyMovies {
  private movieService = inject(MovieService);
  private bookingService = inject(BookingService);

  private authService = inject(AuthService);
  private favoriteService = inject(FavoriteService);
  private accountService = inject(AccountService);

  activeSection = signal<MyMoviesSection>('favorites');
  favoriteError = signal('');
  bookingError = signal('');
  cancellationError = signal('');
  cancellationMessage = signal('');
  cancelTargetId = signal<string | null>(null);
  cancellingBookingId = signal<string | null>(null);

  constructor() {
  effect(() => {
    if (!this.authService.initialized()) return;

    void this.loadFavoriteMovies();

    void this.loadBookings();
  });
}

private async loadFavoriteMovies(): Promise<void> {
  try {
    await this.favoriteService.loadFavorites();

    const favoriteIds = this.favoriteService.favoriteIds();

    const movies = await Promise.all(
      favoriteIds.map(id => this.movieService.getById(id))
    );

    this.favoriteMovies.set(
      movies.filter((movie): movie is Movie => movie !== undefined)
    );

    this.favoriteError.set('');
  } catch (error) {
    console.error('Error al cargar favoritos:', error);
    this.favoriteError.set('No se pudieron cargar los favoritos.');
  }
}

  favoriteMovies = signal<Movie[]>([]);

  bookings = signal<TicketBooking[]>([]);

  private async loadBookings(): Promise<void> {
  try {
    const bookings = await this.bookingService.getAll();

    this.bookings.set(bookings);
    this.bookingError.set('');
  } catch (error) {
    console.error('Error al cargar reservas:', error);
    this.bookingError.set('No se pudieron cargar las reservas.');
  }
}

  upcomingBookings = computed(() =>
    this.bookings()
      .filter(booking => booking.status === 'confirmed' &&
        new Date(
          `${booking.showtime.date}T${booking.showtime.time}:00-03:00`
        ).getTime() >= Date.now()
      )
      .sort((a, b) =>
        `${a.showtime.date}T${a.showtime.time}`.localeCompare(
          `${b.showtime.date}T${b.showtime.time}`
        )
      )
  );

  setSection(section: MyMoviesSection): void {
    this.activeSection.set(section);
  }

  canCancel(booking: TicketBooking): boolean {
    return booking.status === 'confirmed' &&
      new Date(`${booking.showtime.date}T${booking.showtime.time}:00-03:00`).getTime() > Date.now();
  }

  requestCancellation(bookingId: string): void {
    this.cancelTargetId.set(bookingId);
    this.cancellationError.set('');
    this.cancellationMessage.set('');
  }

  async cancelBooking(booking: TicketBooking): Promise<void> {
    if (!this.canCancel(booking) || this.cancellingBookingId()) return;
    this.cancellingBookingId.set(booking.id);
    this.cancellationError.set('');
    this.cancellationMessage.set('');
    try {
      const credited = await this.bookingService.cancelBooking(booking.id);
      this.bookings.update(bookings => bookings.map(item => item.id === booking.id
        ? { ...item, status: 'cancelled' }
        : item));
      this.cancelTargetId.set(null);
      this.cancellationMessage.set(
        `Reserva cancelada. Se acreditaron ${this.formatPrice(credited)} en tu cuenta. Los puntos de la compra fueron revertidos.`
      );
      try {
        await this.accountService.refreshBalancesAndMovements();
      } catch (error) {
        this.cancellationMessage.set(
          `Reserva cancelada y crédito de ${this.formatPrice(credited)} acreditado. No se pudo actualizar el resumen de saldos; volvé a cargar Mi cuenta.`
        );
        console.error('No se pudo refrescar la cuenta después de cancelar:', error);
      }
    } catch (error) {
      this.cancellationError.set(
        error instanceof Error ? error.message : 'No se pudo cancelar la reserva.'
      );
    } finally {
      this.cancellingBookingId.set(null);
    }
  }

  formatPrice(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2,
    }).format(amount);
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

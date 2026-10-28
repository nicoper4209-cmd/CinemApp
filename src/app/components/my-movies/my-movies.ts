import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Movie } from '../../models/movie';
import { FavoriteService } from '../../services/favorites';
import { MovieService } from '../../services/movie';
import { BookingService } from '../../services/booking';
import { Booking } from '../../models/booking';
import { AuthService } from '../../services/auth';

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

  activeSection = signal<MyMoviesSection>('favorites');
  favoriteError = signal('');
  bookingError = signal('');

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

  bookings = signal<Booking[]>([]);

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
      .filter(booking =>
        new Date(
          `${booking.showtime.date}T${booking.showtime.time}:00`
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

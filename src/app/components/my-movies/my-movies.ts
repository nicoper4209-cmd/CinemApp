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

  constructor() {
    effect(() => {
      if (!this.authService.initialized()) return;

      void this.favoriteService.loadFavorites().catch(error => {
        console.error('Error al cargar favoritos:', error);
        this.favoriteError.set('No se pudieron cargar los favoritos.');
      });
    });
  }

  favoriteMovies = computed(() =>
    this.favoriteService.favoriteIds()
      .map(id => this.movieService.getById(id))
      .filter((movie): movie is Movie => movie !== undefined)
  );

  bookings = signal<Booking[]>(this.bookingService.getAll());

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

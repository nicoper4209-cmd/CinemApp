import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Movie } from '../../models/movie';
import { FavoriteService } from '../../services/favorites';
import { MovieService } from '../../services/movie';
import { BookingService } from '../../services/booking';
import { Booking } from '../../models/booking';

type MyMoviesSection = 'favorites' | 'upcoming' | 'tickets';

@Component({
  selector: 'app-my-movies',
  imports: [RouterLink],
  templateUrl: './my-movies.html',
  styleUrl: './my-movies.css',
})
export class MyMovies {
  private favoriteService = inject(FavoriteService);
  private movieService = inject(MovieService);
  private bookingService = inject(BookingService);

  activeSection = signal<MyMoviesSection>('favorites');

  favoriteMovies = computed(() =>
    this.favoriteService.favoriteIds()
      .map(id => this.movieService.getById(id))
      .filter((movie): movie is Movie => movie !== undefined)
  );

  // Se actualizan al entrar nuevamente a esta pantalla.
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

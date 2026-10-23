import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MovieService } from '../../services/movie';
import { FavoriteService } from '../../services/favorites';
import { ShowtimeService } from '../../services/showtime';
import { AuthService } from '../../services/auth';


@Component({
  imports: [RouterLink],
  selector: 'app-movie-detail',
  styleUrl: './movie-detail.css',
  templateUrl: './movie-detail.html',
})
export class MovieDetail {
  private route = inject(ActivatedRoute);
  private movieService = inject(MovieService);
  private favoriteService = inject(FavoriteService);
  private showtimeService = inject(ShowtimeService);
  authService = inject(AuthService);

  id = computed(() => Number(this.route.snapshot.paramMap.get('id')));

  movie = computed(() => this.movieService.getById(this.id()));

  showtimes = computed(() => this.showtimeService.getByMovie(this.id()).filter(showtime => {
        const dateTime = new Date(`${showtime.date}T${showtime.time}:00`);
        return dateTime.getTime() > Date.now();
      })
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
  );

  // Favoritos
  isFavorite(id: number): boolean { return this.favoriteService.isFavorite(id);}

  toggleFavorite(id: number): void { this.favoriteService.toggleFavorite(id);}

  // Fechas de funciones
  selectedDate = signal<string | null>(null);

  availableDates = computed(() => [ ...new Set(this.showtimes().map(showtime => showtime.date))]); // obtener fechas sin repetir

  selectedShowtimes = computed(() => // elegir funciones de x dia
    this.showtimes().filter(
      showtime => showtime.date === this.selectedDate()
    )
  );

  selectDate(date: string): void { // guardo dia que eligio el usuario
    this.selectedDate.set(date);
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }

  formatSelectedDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }
}

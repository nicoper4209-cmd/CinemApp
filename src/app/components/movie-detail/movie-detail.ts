
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MovieService } from '../../services/movie';
import { FavoriteService } from '../../services/favorites';
import { ShowtimeService } from '../../services/showtime';
import { AuthService } from '../../services/auth';
import { Showtime } from '../../models/showtime';

@Component({
  imports: [RouterLink],
  selector: 'app-movie-detail',
  styleUrl: './movie-detail.css',
  templateUrl: './movie-detail.html',
})
export class MovieDetail {
  private route = inject(ActivatedRoute);
  private movieService = inject(MovieService);
  private showtimeService = inject(ShowtimeService);

  favoriteService = inject(FavoriteService);
  authService = inject(AuthService);

  favoriteError = signal('');
  showtimeError = signal('');
  loadingShowtimes = signal(false);
  allShowtimes = signal<Showtime[]>([]);

  constructor() {
    effect(() => {
      if (!this.authService.initialized()) return;

      void this.favoriteService.loadFavorites().catch(error => {
        console.error('Error al cargar favoritos:', error);
        this.favoriteError.set('No se pudieron cargar los favoritos.');
      });
    });

    effect(() => {
      const movieId = this.id();

      this.allShowtimes.set([]);
      this.showtimeError.set('');
      this.loadingShowtimes.set(true);

      void this.showtimeService.getByMovie(movieId)
        .then(showtimes => {
          this.allShowtimes.set(showtimes);
        })
        .catch(error => {
          console.error('Error al cargar funciones:', error);
          this.showtimeError.set(
            'No se pudieron cargar las funciones. Intentá nuevamente.'
          );
        })
        .finally(() => {
          this.loadingShowtimes.set(false);
        });
    });
  }

  id = computed(() => Number(this.route.snapshot.paramMap.get('id')));

  movie = computed(() => this.movieService.getById(this.id()));

  showtimes = computed(() =>
    this.allShowtimes()
      .filter(showtime => {
        const dateTime = new Date(
          `${showtime.date}T${showtime.time}:00`
        );

        return dateTime.getTime() > Date.now();
      })
      .sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
      )
  );

  isFavorite(id: number): boolean {
    return this.favoriteService.isFavorite(id);
  }

  async toggleFavorite(id: number): Promise<void> {
    this.favoriteError.set('');

    try {
      await this.favoriteService.toggleFavorite(id);
    } catch (error) {
      console.error('Error al actualizar favorito:', error);
      this.favoriteError.set(
        'No se pudo actualizar el favorito. Intentá nuevamente.'
      );
    }
  }

  selectedDate = signal<string | null>(null);

  availableDates = computed(() => [
    ...new Set(this.showtimes().map(showtime => showtime.date))
  ]);

  selectedShowtimes = computed(() =>
    this.showtimes().filter(
      showtime => showtime.date === this.selectedDate()
    )
  );

  selectDate(date: string): void {
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

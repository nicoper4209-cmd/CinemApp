import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MovieService } from '../../services/movie';
import { FavoriteService } from '../../services/favorites';
import { ShowtimeService } from '../../services/showtime';
import { AuthService } from '../../services/auth';
import { Movie } from '../../models/movie';
import { Showtime } from '../../models/showtime';
import { PricingService, TicketPriceEstimate } from '../../services/pricing';

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
  private pricingService = inject(PricingService);

  favoriteService = inject(FavoriteService);
  authService = inject(AuthService);

  movie = signal<Movie | undefined>(undefined);
  movieError = signal('');
  showtimeError = signal('');
  favoriteError = signal('');
  loadingShowtimes = signal(false);
  allShowtimes = signal<Showtime[]>([]);
  showtimeEstimates = signal<Map<number, TicketPriceEstimate>>(new Map());
  priceEstimateError = signal('');

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

      this.movie.set(undefined);
      this.movieError.set('');

      void this.movieService.getById(movieId)
        .then(movie => {
          this.movie.set(movie);

          if (!movie) {
            this.movieError.set('No se encontró la película.');
          }
        })
        .catch(error => {
          console.error('Error al cargar película:', error);
          this.movieError.set('No se pudo cargar la película. Intentá nuevamente.');
        });
    });

    effect(() => {
      const movieId = this.id();

      this.allShowtimes.set([]);
      this.showtimeEstimates.set(new Map());
      this.priceEstimateError.set('');
      this.showtimeError.set('');
      this.loadingShowtimes.set(true);
      this.selectedDate.set(null);

      void this.showtimeService.getByMovie(movieId)
        .then(showtimes => {
          this.allShowtimes.set(showtimes);
          void this.loadPriceEstimates(movieId, showtimes);
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

  private async loadPriceEstimates(movieId: number, showtimes: Showtime[]): Promise<void> {
    try {
      const movie = this.movie() ?? await this.movieService.getById(movieId);
      if (!movie) return;
      const estimates = await Promise.all(
        showtimes.map(async showtime => [
          showtime.id,
          await this.pricingService.estimateTickets(movie, showtime, ['A-0-1']),
        ] as const)
      );
      this.showtimeEstimates.set(new Map(estimates));
    } catch (error) {
      this.priceEstimateError.set(
        error instanceof Error ? error.message : 'No se pudieron estimar los precios.'
      );
    }
  }

  id = computed(() => Number(this.route.snapshot.paramMap.get('id')));

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

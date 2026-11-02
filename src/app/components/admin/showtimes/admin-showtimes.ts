import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Movie } from '../../../models/movie';
import { Showtime } from '../../../models/showtime';
import { MovieService } from '../../../services/movie';
import { ScheduleShowtimesResult, ShowtimeFormat, ShowtimeService } from '../../../services/showtime';

const WEEKDAYS = [
  { id: 1, label: 'Lunes' }, { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' }, { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' }, { id: 6, label: 'Sábado' }, { id: 7, label: 'Domingo' },
];

@Component({
  selector: 'app-admin-showtimes',
  imports: [FormsModule],
  templateUrl: './admin-showtimes.html',
  styleUrl: './admin-showtimes.css',
})
export class AdminShowtimes {
  private movieService = inject(MovieService);
  private showtimeService = inject(ShowtimeService);

  readonly weekdays = WEEKDAYS;
  allMovies = signal<Movie[]>([]);
  movies = signal<Movie[]>([]);
  formats = signal<ShowtimeFormat[]>([]);
  showtimes = signal<Showtime[]>([]);
  upcomingShowtimes = computed(() => {
    const movieNames = new Map(this.allMovies().map(movie => [movie.id, movie.title]));
    const formatNames = new Map(this.formats().map(format => [format.id, format.name]));
    return this.showtimes().map(showtime => ({
      ...showtime,
      movieTitle: movieNames.get(showtime.movieId) ?? `Película ${showtime.movieId}`,
      formatName: showtime.formatId === null || showtime.formatId === undefined
        ? '2D'
        : formatNames.get(showtime.formatId) ?? 'Formato no disponible',
    }));
  });
  loading = signal(true);
  loadingShowtimes = signal(false);
  showtimesError = signal('');
  submitting = signal(false);
  errorMessage = signal('');
  result = signal<ScheduleShowtimesResult | null>(null);

  movieId: number | null = null;
  from = '';
  to = '';
  time = '';
  formatId: number | null = null;
  selectedWeekdays = signal<number[]>([]);

  constructor() {
    void this.loadOptions();
  }

  async loadOptions(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const [movies, formats] = await Promise.all([
        this.movieService.getAll(),
        this.showtimeService.getActiveFormats(),
      ]);
      this.allMovies.set(movies);
      this.movies.set(movies.filter(movie => movie.status !== 'unavailable'));
      this.formats.set(formats);
      await this.loadUpcomingShowtimes();
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudieron cargar películas y formatos.'));
    } finally {
      this.loading.set(false);
    }
  }

  toggleWeekday(day: number, checked: boolean): void {
    this.selectedWeekdays.update(current => checked
      ? [...new Set([...current, day])].sort((a, b) => a - b)
      : current.filter(value => value !== day));
  }

  async schedule(): Promise<void> {
    if (this.submitting()) return;
    this.errorMessage.set('');
    this.result.set(null);

    if (this.movieId === null || !this.from || !this.to || !this.time || this.selectedWeekdays().length === 0) {
      this.errorMessage.set('Completá todos los datos y elegí al menos un día de la semana.');
      return;
    }
    if (this.to < this.from || this.dateDistance(this.from, this.to) > 366) {
      this.errorMessage.set('El rango debe ser válido y no superar los 366 días.');
      return;
    }

    this.submitting.set(true);
    try {
      const result = await this.showtimeService.scheduleRecurring({
        movieId: this.movieId,
        from: this.from,
        to: this.to,
        weekdays: this.selectedWeekdays(),
        time: this.time,
        formatId: this.formatId,
      });
      this.result.set(result);
      if (result.created > 0) await this.loadUpcomingShowtimes();
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudieron programar las funciones.'));
    } finally {
      this.submitting.set(false);
    }
  }

  async loadUpcomingShowtimes(): Promise<void> {
    this.loadingShowtimes.set(true);
    this.showtimesError.set('');
    try {
      this.showtimes.set(await this.showtimeService.getUpcomingForAdmin());
    } catch (error) {
      this.showtimesError.set(this.message(error, 'No se pudieron cargar las funciones programadas.'));
    } finally {
      this.loadingShowtimes.set(false);
    }
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }

  private dateDistance(from: string, to: string): number {
    const start = new Date(`${from}T00:00:00Z`).getTime();
    const end = new Date(`${to}T00:00:00Z`).getTime();
    return Math.floor((end - start) / 86_400_000);
  }

  private message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UpcomingMovie } from '../../../models/admin-alerts';
import { AdminAlertsService } from '../../../services/admin-alerts';
import {
  MAX_ALERT_BODY,
  MAX_ALERT_TITLE,
  suggestPremiereMessage,
  validateAlertBody,
  validateAlertTitle,
} from '../../../utils/admin-alerts';

@Component({
  selector: 'app-admin-alerts',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-alerts.html',
  styleUrl: './admin-alerts.css',
})
export class AdminAlerts {
  private alertsService = inject(AdminAlertsService);

  readonly maxTitleLength = MAX_ALERT_TITLE;
  readonly maxBodyLength = MAX_ALERT_BODY;

  movies = signal<UpcomingMovie[]>([]);
  loading = signal(true);
  sending = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  sentCount = signal<number | null>(null);

  movieId: number | null = null;
  title = '';
  body = '';
  confirmed = false;

  constructor() {
    void this.loadMovies();
  }

  async loadMovies(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.movies.set(await this.alertsService.getUpcomingMovies());
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudieron cargar las próximas películas.'));
    } finally {
      this.loading.set(false);
    }
  }

  onMovieChange(movieId: number | null): void {
    this.movieId = movieId;
    this.sentCount.set(null);
    this.confirmed = false;
    const movie = this.movies().find(item => item.id === movieId);
    if (movie) {
      const suggestion = suggestPremiereMessage(movie.title);
      this.title = suggestion.title;
      this.body = suggestion.body;
    }
  }

  async send(): Promise<void> {
    if (this.sending()) return;
    this.errorMessage.set('');
    this.successMessage.set('');
    this.sentCount.set(null);

    if (this.movieId === null) {
      this.errorMessage.set('Elegí la película del aviso.');
      return;
    }
    const error = validateAlertTitle(this.title) ?? validateAlertBody(this.body);
    if (error) {
      this.errorMessage.set(error);
      return;
    }
    if (!this.confirmed) {
      this.errorMessage.set('Confirmá que querés enviar el aviso a todos los suscriptos.');
      return;
    }

    this.sending.set(true);
    try {
      const count = await this.alertsService.sendPremiereAlert(
        this.movieId,
        this.title.trim(),
        this.body.trim(),
      );
      this.sentCount.set(count);
      this.confirmed = false;
      this.successMessage.set(count === 0
        ? 'El aviso se registró, pero no había usuarios suscriptos a esta película.'
        : `Aviso encolado para ${count} usuario(s). La Edge Function lo enviará según la cola.`);
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo enviar el aviso de estreno.'));
    } finally {
      this.sending.set(false);
    }
  }

  formatReleaseDate(value: string | null): string {
    if (!value) return 'Fecha a confirmar';
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(`${value}T12:00:00Z`));
  }

  private message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}

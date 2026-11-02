import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MovieService, TopMovie } from '../../services/movie';

@Component({
  selector: 'app-top-movies',
  imports: [RouterLink],
  templateUrl: './top-movies.html',
  styleUrl: './top-movies.css',
})
export class TopMovies {
  private movieService = inject(MovieService);

  topMovies = signal<TopMovie[]>([]);
  loading = signal(true);
  errorMessage = signal('');

  constructor() {
    void this.loadTopMovies();
  }

  private async loadTopMovies(): Promise<void> {
    try {
      this.topMovies.set(await this.movieService.getTopMovies());
    } catch (error) {
      console.error('Error al cargar el Top 3:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo cargar el Top 3.');
    } finally {
      this.loading.set(false);
    }
  }
}

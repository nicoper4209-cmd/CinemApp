import { Component, inject, signal } from '@angular/core';
import { Movie } from '../../models/movie';
import { MovieService } from '../../services/movie';
import { MovieCatalog } from '../movie-catalog/movie-catalog';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-movie-list',
  imports: [MovieCatalog, RouterLink],
  templateUrl: './movie-list.html',
  styleUrl: './movie-list.css',
})
export class MovieList {
  private movieService = inject(MovieService);

  movies = signal<Movie[]>([]);
  featuredMovies = signal<Movie[]>([]);
  loading = signal(true);
  errorMessage = signal('');

  constructor() {
    void this.loadMovies();
  }

  private async loadMovies(): Promise<void> {
    try {
      const available = await this.movieService.getAvailable();
      const featured = available.filter(movie => movie.isFeatured === true);
      this.featuredMovies.set(featured);
      this.movies.set(available.filter(movie => !movie.isFeatured));
    } catch (error) {
      console.error('Error al cargar la cartelera:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo cargar la cartelera.');
    } finally {
      this.loading.set(false);
    }
  }
}

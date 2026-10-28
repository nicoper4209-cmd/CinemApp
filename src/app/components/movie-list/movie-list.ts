import { Component, inject, signal } from '@angular/core';
import { Movie } from '../../models/movie';
import { MovieService } from '../../services/movie';
import { MovieCatalog } from '../movie-catalog/movie-catalog';

@Component({
  selector: 'app-movie-list',
  imports: [MovieCatalog],
  templateUrl: './movie-list.html',
  styleUrl: './movie-list.css',
})
export class MovieList {
  private movieService = inject(MovieService);

  movies = signal<Movie[]>([]);

  constructor() {
    void this.loadMovies();
  }

  private async loadMovies(): Promise<void> {
    try {
      const movies = await this.movieService.getAvailable();
      this.movies.set(movies);
    } catch (error) {
      console.error('Error al cargar la cartelera:', error);
    }
  }
}

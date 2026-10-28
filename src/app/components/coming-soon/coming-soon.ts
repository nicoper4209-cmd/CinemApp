import { Component, inject, signal } from '@angular/core';
import { Movie } from '../../models/movie';
import { MovieService } from '../../services/movie';
import { MovieCatalog } from '../../components/movie-catalog/movie-catalog';

@Component({
  selector: 'app-coming-soon',
  imports: [MovieCatalog],
  templateUrl: './coming-soon.html',
  styleUrl: './coming-soon.css',
})
export class ComingSoon {
  private movieService = inject(MovieService);

  movies = signal<Movie[]>([]);

  constructor() {
    void this.loadMovies();
  }

  private async loadMovies(): Promise<void> {
    try {
      const movies = await this.movieService.getUpcoming();
      this.movies.set(movies);
    } catch (error) {
      console.error('Error al cargar las próximas películas:', error);
    }
  }
}
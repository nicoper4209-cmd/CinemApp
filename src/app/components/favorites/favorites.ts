import { Component, computed, inject } from '@angular/core';
import { MovieService } from '../../services/movie';
import { FavoriteService } from '../../services/favorites';
import { MovieCatalog } from '../movie-catalog/movie-catalog';

@Component({
  selector: 'app-favorites',
  imports: [MovieCatalog],
  templateUrl: './favorites.html',
  styleUrl: './favorites.css',
})
export class Favorites {
  private movieService = inject(MovieService);
  private favoriteService = inject(FavoriteService);

  favoriteMovies = computed(() => {
    const favoriteIds = this.favoriteService.favoriteIds();

    return this.movieService
      .getAll()
      .filter(movie => favoriteIds.includes(movie.id));
  });
}
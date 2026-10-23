import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Movie } from '../../models/movie';
import { FavoriteService } from '../../services/favorites';
import { MovieCard } from '../movie-card/movie-card';

@Component({
  imports: [RouterLink,MovieCard],
  selector: 'app-movie-catalog',
  styleUrl: './movie-catalog.css',
  templateUrl: './movie-catalog.html',
})
export class MovieCatalog {
  
  private router = inject(Router);
  private favoriteService = inject(FavoriteService)

  movies = input.required<Movie[]>();

  // Favoritos
  isFavorite(id: number): boolean {
    return this.favoriteService.isFavorite(id);
  }

  toggleFavorite(id: number): void {
    this.favoriteService.toggleFavorite(id);
  }

  // Buscador
  searchTerm = signal('');
  selectedGenre = signal('Todos');
  sortOrder = signal('newest');

  genres = computed(() => [
    'Todos',
    ...new Set(this.movies().map(movie => movie.genre))
  ]);
  
  filteredMovies = computed(() => {
  const term = this.searchTerm().trim().toLowerCase();
  const genre = this.selectedGenre();
  const order = this.sortOrder();

  return this.movies()
    .filter(movie => {
      const matchesTitle = movie.title.toLowerCase().includes(term);
      const matchesGenre =
        genre === 'Todos' || movie.genre === genre;

      return matchesTitle && matchesGenre;
    })
    .sort((a, b) => {
      if (order === 'alphabetical') {
        return a.title.localeCompare(b.title);
      }

      if (order === 'alphabetical-reverse') {
        return b.title.localeCompare(a.title);
      }

      const yearA = Number(a.year);
      const yearB = Number(b.year);

      return order === 'newest' ? yearB - yearA : yearA - yearB;
    });
  });

  // Abrir pelicula
  openMovie(id: number) {
    this.router.navigate(['/movies', id]);
  }
}

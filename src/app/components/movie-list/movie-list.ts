import { Component, computed, inject, signal } from '@angular/core';
import { MovieCard } from '../../components/movie-card/movie-card';
import { Router } from '@angular/router';
import { MOVIES } from '../../data/movies';

@Component({
  selector: 'app-movie-list',
  imports: [MovieCard],
  templateUrl: './movie-list.html',
  styleUrl: './movie-list.css',
})

export class MovieList {
  private router = inject(Router);

  movies = MOVIES;

  // Buscador
  searchTerm = signal('');
  selectedGenre = signal('Todos');
  sortOrder = signal('newest');

  genres = computed(() => [
    'Todos',
    ...new Set(this.movies.map(movie => movie.genre))
  ]);
  
  filteredMovies = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const genre = this.selectedGenre();
    const order = this.sortOrder();

    return this.movies
      .filter(movie => {
        const matchesTitle = movie.title.toLowerCase().includes(term);
        const matchesGenre =
          genre === 'Todos' || movie.genre === genre;

        return matchesTitle && matchesGenre;
      })      
  .sort((a, b) => {
    if (order === 'alphabetical') {
      return a.title.localeCompare(b.title);
    }else if(order === 'alphabetical-reverse'){
      return b.title.localeCompare(a.title);
    }

    const yearA = Number(a.year);
    const yearB = Number(b.year);

    return order === 'newest'
      ? yearB - yearA
      : yearA - yearB;
  });

  });

  // Abrir pelicula
  openMovie(id: number) {
    this.router.navigate(['/movies', id]);
  }
}
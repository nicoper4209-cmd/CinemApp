import { Component, inject } from '@angular/core';
import { MovieService } from '../../services/movie';
import { MovieCatalog } from '../movie-catalog/movie-catalog';

@Component({
  selector: 'app-movie-list',
  imports: [MovieCatalog],
  templateUrl: './movie-list.html',
  styleUrl: './movie-list.css',
})

export class MovieList {
  private movieService = inject(MovieService)

  movies = this.movieService.getAvailable();
}
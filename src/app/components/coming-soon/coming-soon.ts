import { Component, inject } from '@angular/core';
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

  movies = this.movieService.getUpcoming();
}
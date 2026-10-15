import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MovieService } from '../../services/movie';
import { FavoriteService } from '../../services/favorites';
import { ShowtimeService } from '../../services/showtime';

@Component({
  imports: [RouterLink],
  selector: 'app-movie-detail',
  styleUrl: './movie-detail.css',
  templateUrl: './movie-detail.html',
})
export class MovieDetail {
  private route = inject(ActivatedRoute)
  private movieService = inject(MovieService)
  private favoriteService = inject(FavoriteService)
  private showtimeService = inject(ShowtimeService)

  id = computed(() => Number(this.route.snapshot.paramMap.get('id')));
  movie = computed(() => this.movieService.getById(this.id()));
  showtimes = computed(() => this.showtimeService.getByMovie(this.id()));
    // Favoritos
  isFavorite(id: number): boolean {
    return this.favoriteService.isFavorite(id);
  }

  toggleFavorite(id: number): void {
    this.favoriteService.toggleFavorite(id);
  }
}

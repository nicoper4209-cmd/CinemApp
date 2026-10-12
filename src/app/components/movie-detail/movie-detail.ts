import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MovieService } from '../../services/movie';

@Component({
  imports: [RouterLink],
  selector: 'app-movie-detail',
  styleUrl: './movie-detail.css',
  templateUrl: './movie-detail.html',
})
export class MovieDetail {
  private route = inject(ActivatedRoute)
  private movieService = inject(MovieService)

  id = computed(() => Number(this.route.snapshot.paramMap.get('id')));

  movie = computed(() => this.movieService.getById(this.id()));
}

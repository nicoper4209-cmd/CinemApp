import { Component, computed, inject } from '@angular/core';
import { MOVIES } from '../../data/movies';
import { ActivatedRoute, RouterLink } from '@angular/router';


@Component({
  imports: [RouterLink],
  selector: 'app-movie-detail',
  styleUrl: './movie-detail.css',
  templateUrl: './movie-detail.html',
})
export class MovieDetail {
  private route = inject(ActivatedRoute)

  id = computed(() => Number(this.route.snapshot.paramMap.get('id')));

  movie = computed(() => 
    MOVIES.find(movie => movie.id === this.id())
  )
}

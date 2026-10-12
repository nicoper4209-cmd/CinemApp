import { Component } from '@angular/core';
import { MOVIES } from '../../data/movies';

@Component({
  imports: [],
  selector: 'app-top-movies',
  styleUrl: './top-movies.css',
  templateUrl: './top-movies.html',
})
export class TopMovies {
  topMovies = MOVIES.filter(movie =>
    [3, 1, 2].includes(movie.id)
  );
  
}

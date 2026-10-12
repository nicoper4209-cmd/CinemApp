import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MOVIES } from '../../data/movies';

@Component({
  selector: 'app-top-movies',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './top-movies.html',
  styleUrl: './top-movies.css',
})
export class TopMovies {
  topMovies = [3, 1, 2]
    .map(id => MOVIES.find(movie => movie.id === id))
    .filter(movie => movie !== undefined);
}
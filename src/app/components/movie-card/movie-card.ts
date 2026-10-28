
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-movie-card',
  imports: [RouterLink],
  templateUrl: './movie-card.html',
  styleUrl: './movie-card.css',
})
export class MovieCard {
  id = input.required<number>();
  title = input('');
  poster = input('');
  alt = input('');
  year = input('');
}

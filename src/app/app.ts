import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLinkWithHref } from '@angular/router';
import { MovieCard } from './components/movie-card/movie-card';
import { MovieList } from './components/movie-list/movie-list';

@Component({
  imports: [RouterOutlet, MovieCard, MovieList, RouterLinkWithHref],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('cinema');
}

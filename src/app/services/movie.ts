import { Injectable } from '@angular/core';
import { Movie } from '../models/movie';
import { MOVIES } from '../data/movies';

@Injectable({
  providedIn: 'root',
})

export class MovieService {
  getAll(): Movie[] {
    return MOVIES;
  }

  getById(id: number): Movie | undefined {
    return MOVIES.find(movie => movie.id === id);
  }

  getAvailable(): Movie[] {
    return MOVIES.filter(movie => movie.status === 'available');
  }

  getUpcoming(): Movie[] {
    return MOVIES.filter(movie => movie.status === 'upcoming');
  }

  getFavorites(): Movie[]{
    return MOVIES.filter(movie => movie.status === 'upcoming');
  }
}

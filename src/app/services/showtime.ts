import { Injectable } from '@angular/core';
import { Showtime } from '../models/showtime';

const SHOWTIMES: Showtime[] = [
  {
    id: 1,
    movieId: 1,
    room: 'Sala 1',
    date: '2026-10-20',
    time: '16:00',
    price: 6500
  },
  {
    id: 2,
    movieId: 1,
    room: 'Sala 1',
    date: '2026-10-20',
    time: '19:00',
    price: 6500
  },
  {
    id: 3,
    movieId: 1,
    room: 'Sala 2',
    date: '2026-10-20',
    time: '21:30',
    price: 7500
  },
  {
    id: 4,
    movieId: 2,
    room: 'Sala 2',
    date: '2026-10-20',
    time: '18:00',
    price: 6500
  }
];

@Injectable({
  providedIn: 'root'
})
export class ShowtimeService {
  getByMovie(movieId: number): Showtime[] {
    return SHOWTIMES.filter(
      showtime => showtime.movieId === movieId
    );
  }
}

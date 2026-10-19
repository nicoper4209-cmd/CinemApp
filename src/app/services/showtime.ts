import { Injectable } from '@angular/core';
import { Showtime } from '../models/showtime';

const SHOWTIMES: Showtime[] = (() => {
  const showtimes: Showtime[] = [];
  let id = 1;

  const startDate = new Date('2026-10-19T12:00:00');
  const totalDays = 28;

  const schedules = [
    { room: 'Sala 1', time: '14:00', price: 6500 },
    { room: 'Sala 1', time: '17:00', price: 6500 },
    { room: 'Sala 1', time: '20:00', price: 6500 },
    { room: 'Sala 2', time: '15:30', price: 6500 },
    { room: 'Sala 2', time: '18:30', price: 6500 },
    { room: 'Sala 2', time: '21:30', price: 7500 },
    { room: 'Sala 3', time: '16:00', price: 7500 },
    { room: 'Sala 3', time: '19:00', price: 7500 },
  ];

  for (let day = 0; day < totalDays; day++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + day);

    const dateString = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');

    // Rotamos los horarios para variar la cartelera cada día.
    const dailySchedules = [
      ...schedules.slice(day % schedules.length),
      ...schedules.slice(0, day % schedules.length),
    ];

    for (let movieId = 1; movieId <= 20; movieId++) {
      // Cada película tiene entre 2 y 4 funciones por día.
      const numberOfShows = 2 + ((movieId + day) % 3);

      for (let i = 0; i < numberOfShows; i++) {
        const schedule = dailySchedules[
          (movieId * 3 + i * 2 + day) % dailySchedules.length
        ];

        showtimes.push({
          id: id++,
          movieId,
          room: schedule.room,
          date: dateString,
          time: schedule.time,
          price: schedule.price,
        });
      }
    }
  }

  return showtimes;
})();

@Injectable({
  providedIn: 'root',
})
export class ShowtimeService {
  getByMovie(movieId: number): Showtime[] {
    return SHOWTIMES.filter(
      showtime => showtime.movieId === movieId
    );
  }
}


/* FORMA MANUAL
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
  */

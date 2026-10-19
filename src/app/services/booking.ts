import { Injectable, signal } from '@angular/core';
import { Booking } from '../models/booking';
import { Movie } from '../models/movie';
import { Showtime } from '../models/showtime';

interface NewBooking {
  movie: Movie;
  showtime: Showtime;
  seats: string[];
  total: number;
}

@Injectable({
  providedIn: 'root',
})

export class BookingService {
  private bookings = signal<Booking[]>([]);

  getAll(): Booking[] {
    return this.bookings();
  }

  getById(id: string): Booking | undefined {
    return this.bookings().find(booking => booking.id === id);
  }

  create(data: NewBooking): Booking {
    const booking: Booking = {
      ...data,
      id: `CIN-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };

    this.bookings.update(bookings => [...bookings, booking]);

    return booking;
  }
}

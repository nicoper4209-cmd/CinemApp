import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Movie } from '../../models/movie';
import { Showtime } from '../../models/showtime';

interface BookingData {
  movie: Movie;
  showtime: Showtime;
  seats: string[];
  total: number;
}

@Component({
  selector: 'app-booking-summary',
  imports: [RouterLink],
  templateUrl: './booking-summary.html',
  styleUrl: './booking-summary.css',
})
export class BookingSummary {
  private router = inject(Router);
  private bookingData = history.state as BookingData;

  movie = this.bookingData?.movie;
  showtime = this.bookingData?.showtime;
  seats = this.bookingData?.seats ?? [];
  total = this.bookingData?.total ?? 0;

  bookingAvailable = computed(() =>
    !!this.movie &&
    !!this.showtime &&
    this.seats.length > 0
  );

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }

  getSeatPrice(seatId: string): number {
    const isVip = ['R', 'S', 'T'].includes(seatId.split('-')[0]);
    const basePrice = this.showtime?.price ?? 0;

    return isVip ? basePrice * 2 : basePrice;
  }
}

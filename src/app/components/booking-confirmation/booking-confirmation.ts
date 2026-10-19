import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BookingService } from '../../services/booking';

@Component({
  selector: 'app-booking-confirmation',
  imports: [RouterLink],
  templateUrl: './booking-confirmation.html',
  styleUrl: './booking-confirmation.css',
})
export class BookingConfirmation {
  private route = inject(ActivatedRoute);
  private bookingService = inject(BookingService);

  bookingId = this.route.snapshot.paramMap.get('id') ?? '';

  booking = computed(() =>
    this.bookingService.getById(this.bookingId)
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
}

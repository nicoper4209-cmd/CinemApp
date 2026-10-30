
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Movie } from '../../models/movie';
import { Showtime } from '../../models/showtime';
import { BookingService } from '../../services/booking';
import { AuthService } from '../../services/auth';
import { SeatHoldService } from '../../services/seat-hold';
import { PricingService, TicketPriceEstimate } from '../../services/pricing';
import { getSeatContiguityError } from '../../utils/seat-validation';

interface BookingData {
  movie: Movie;
  showtime: Showtime;
  seats: string[];
  total: number;
}

@Component({
  selector: 'app-booking-summary',
  imports: [RouterLink, FormsModule],
  templateUrl: './booking-summary.html',
  styleUrl: './booking-summary.css',
})
export class BookingSummary {
  private router = inject(Router);
  private bookingData = history.state as BookingData;
  private bookingService = inject(BookingService);
  authService = inject(AuthService);
  seatHoldService = inject(SeatHoldService);
  private pricingService = inject(PricingService);

  movie = this.bookingData?.movie;
  showtime = this.bookingData?.showtime;
  seats = this.bookingData?.seats ?? [];
  total = this.bookingData?.total ?? 0;
  priceEstimate = signal<TicketPriceEstimate | null>(null);
  priceEstimateLoading = signal(false);
  priceEstimateError = signal('');
  vipAcknowledged = signal(false);
  contactEmail = signal('');
  isRegisteredUser = computed(() => {
    const user = this.authService.user();
    return !!user && !user.is_anonymous;
  });
  today = new Date().toISOString().slice(0, 10);
  birthDay = signal('');
  birthMonth = signal('');
  birthYear = signal('');
  months = [
    { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
  ];
  years = Array.from(
    { length: new Date().getFullYear() - 1899 },
    (_, index) => String(new Date().getFullYear() - index)
  );
  birthDays = computed(() => {
    const month = Number(this.birthMonth());
    const year = Number(this.birthYear());
    const count = month && year ? new Date(year, month, 0).getDate() : 31;
    return Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, '0'));
  });
  birthDate = computed(() => {
    const day = this.birthDay();
    const month = this.birthMonth();
    const year = this.birthYear();
    return day && month && year ? `${year}-${month}-${day}` : '';
  });

  confirming = signal(false);
  errorMessage = signal('');

  bookingAvailable = computed(() =>
    !!this.movie &&
    !!this.showtime &&
    this.seats.length > 0
  );

  guestDetailsValid = computed(() =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.contactEmail().trim()) &&
    !!this.birthDate() && this.birthDate() <= this.today &&
    this.birthDays().includes(this.birthDay())
  );

  guestDetailsRequired = computed(() =>
    this.authService.initialized() && !this.isRegisteredUser()
  );
  contiguityError = computed(() => getSeatContiguityError(this.seats));
  hasVip = computed(() =>
    this.seats.some(seat => ['R', 'S', 'T'].includes(seat.split('-')[0]))
  );
  estimatedTotal = computed(() => this.priceEstimate()?.total ?? 0);

  constructor() {
    if (this.movie && this.showtime) void this.loadPriceEstimate();
    if (this.showtime) {
      void this.seatHoldService.restoreHold(this.showtime.id).catch(error => {
        this.seatHoldService.holdError.set(
          error instanceof Error ? error.message : 'No se pudo recuperar el bloqueo de butacas.'
        );
      });
    }
  }

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
    const estimate = this.priceEstimate();
    if (!estimate) return 0;
    if (estimate.seatPrices[seatId] !== undefined) return estimate.seatPrices[seatId];
    const row = seatId.split('-')[0];
    if (row === 'J' || row === 'K') return estimate.accessiblePrice;
    if (['R', 'S', 'T'].includes(row)) return estimate.vipPrice;
    return estimate.standardPrice;
  }

  private async loadPriceEstimate(): Promise<void> {
    if (!this.movie || !this.showtime) return;
    this.priceEstimateLoading.set(true);
    this.priceEstimateError.set('');
    try {
      this.priceEstimate.set(
        await this.pricingService.estimateTickets(this.movie, this.showtime, this.seats)
      );
    } catch (error) {
      this.priceEstimateError.set(
        error instanceof Error ? error.message : 'No se pudo calcular el precio estimado.'
      );
    } finally {
      this.priceEstimateLoading.set(false);
    }
  }

  async confirmBooking(): Promise<void> {
    if (
      !this.bookingAvailable() ||
      !this.authService.initialized() ||
      this.priceEstimateLoading() ||
      !!this.priceEstimateError() ||
      !!this.contiguityError() ||
      (this.hasVip() && !this.vipAcknowledged()) ||
      (this.guestDetailsRequired() && !this.guestDetailsValid()) ||
      this.confirming()
    ) {
      return;
    }

    this.confirming.set(true);
    this.errorMessage.set('');

    try {
      let session = await this.authService.getSession();
      if (!session) session = await this.authService.continueAsGuest();

      const isAnonymous = session?.user.is_anonymous ?? true;
      const bookingId = await this.bookingService.purchase({
        movie: this.movie!,
        showtime: this.showtime!,
        seats: [...this.seats],
        contactEmail: isAnonymous
          ? this.contactEmail().trim()
          : session?.user.email ?? null,
        birthDate: isAnonymous ? this.birthDate() : null,
      });

      await this.router.navigate([
        '/booking-confirmation',
        bookingId,
      ]);
    } catch (error) {
      console.error('Error al crear la reserva:', error);

      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'No se pudo completar la reserva. Intentá nuevamente.'
      );
    } finally {
      this.confirming.set(false);
    }
  }

  get contactEmailValue(): string { return this.contactEmail(); }
  set contactEmailValue(value: string) { this.contactEmail.set(value); }
  get birthDayValue(): string { return this.birthDay(); }
  set birthDayValue(value: string) { this.birthDay.set(value); }
  get birthMonthValue(): string { return this.birthMonth(); }
  set birthMonthValue(value: string) {
    this.birthMonth.set(value);
    this.clampBirthDay();
  }
  get birthYearValue(): string { return this.birthYear(); }
  set birthYearValue(value: string) {
    this.birthYear.set(value);
    this.clampBirthDay();
  }
  get vipAcknowledgedValue(): boolean { return this.vipAcknowledged(); }
  set vipAcknowledgedValue(value: boolean) { this.vipAcknowledged.set(value); }

  private clampBirthDay(): void {
    const selectedDay = Number(this.birthDay());
    const lastDay = this.birthDays().length;
    if (selectedDay > lastDay) {
      this.birthDay.set(String(lastDay).padStart(2, '0'));
    }
  }
}

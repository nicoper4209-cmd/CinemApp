
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Movie } from '../../models/movie';
import { Showtime } from '../../models/showtime';
import { BookingService, EligibleCoupon } from '../../services/booking';
import { AuthService } from '../../services/auth';
import { SeatHoldService } from '../../services/seat-hold';
import { PricingService, TicketPriceEstimate } from '../../services/pricing';
import { getSeatContiguityError } from '../../utils/seat-validation';
import { CandyCartService } from '../../services/candy-cart';

interface BookingData {
  movie?: Movie;
  showtime?: Showtime;
  seats: string[];
  total: number;
  candyOnly?: boolean;
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
  cart = inject(CandyCartService);

  movie = this.bookingData?.movie;
  showtime = this.bookingData?.showtime ?? null;
  seats = this.bookingData?.seats ?? [];
  total = this.bookingData?.total ?? 0;
  priceEstimate = signal<TicketPriceEstimate | null>(null);
  priceEstimateLoading = signal(false);
  priceEstimateError = signal('');
  vipAcknowledged = signal(false);
  eligibleCoupons = signal<EligibleCoupon[]>([]);
  selectedCouponCode = signal('');
  creditBalance = signal(0);
  useCredit = signal(false);
  creditAmount = signal(0);
  benefitsLoading = signal(false);
  couponError = signal('');
  creditError = signal('');
  private benefitsLoadedForUser: string | null = null;
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
    (!!this.movie && !!this.showtime && this.seats.length > 0) ||
    (!this.movie && !this.showtime && this.cart.items().length > 0)
  );
  hasTickets = computed(() => !!this.movie && !!this.showtime && this.seats.length > 0);
  isCandyOnly = computed(() => !this.hasTickets() && this.cart.items().length > 0);

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
  estimatedTotal = computed(() => (this.priceEstimate()?.total ?? 0) + this.cart.subtotal());
  selectedCoupon = computed(() =>
    this.eligibleCoupons().find(coupon => coupon.code === this.selectedCouponCode())
  );
  estimatedDiscount = computed(() => {
    const discount = this.estimatedTotal() * (this.selectedCoupon()?.percentage ?? 0) / 100;
    return Math.round(discount * 100) / 100;
  });
  estimatedCredit = computed(() => {
    if (!this.useCredit()) return 0;
    const requested = Number(this.creditAmount());
    if (!Number.isFinite(requested) || requested <= 0) return 0;
    return Math.min(requested, this.creditBalance(), Math.max(0, this.estimatedTotal() - this.estimatedDiscount()));
  });
  estimatedAmountDue = computed(() =>
    Math.max(0, this.estimatedTotal() - this.estimatedDiscount() - this.estimatedCredit())
  );

  get checkoutContext(): BookingData {
    return {
      movie: this.movie,
      showtime: this.showtime ?? undefined,
      seats: [...this.seats],
      total: this.total,
      candyOnly: !this.hasTickets(),
    };
  }

  constructor() {
    effect(() => {
      const initialized = this.authService.initialized();
      const user = this.authService.user();
      if (!initialized) return;
      if (!user || user.is_anonymous) {
        this.benefitsLoadedForUser = null;
        this.eligibleCoupons.set([]);
        this.selectedCouponCode.set('');
        this.creditBalance.set(0);
        this.creditAmount.set(0);
        this.useCredit.set(false);
        return;
      }
      if (this.benefitsLoadedForUser !== user.id) {
        this.benefitsLoadedForUser = user.id;
        void this.loadAccountBenefits();
      }
    });
    if (this.movie && this.showtime) void this.loadPriceEstimate();
    if (this.showtime) {
      void this.seatHoldService.restoreHold(this.showtime.id).catch(error => {
        this.seatHoldService.holdError.set(
          error instanceof Error ? error.message : 'No se pudo recuperar el bloqueo de butacas.'
        );
      });
    }
  }

  private async loadAccountBenefits(): Promise<void> {
    this.benefitsLoading.set(true);
    this.couponError.set('');
    this.creditError.set('');
    const [couponsResult, creditResult] = await Promise.allSettled([
      this.bookingService.getEligibleCoupons(),
      this.bookingService.getCreditBalance(),
    ]);

    if (couponsResult.status === 'fulfilled') {
      const coupons = couponsResult.value;
      this.eligibleCoupons.set(coupons);
      const firstPurchase = coupons.find(coupon => coupon.type === 'primera_compra');
      this.selectedCouponCode.set(firstPurchase?.code ?? '');
    } else {
      this.couponError.set(this.getErrorMessage(couponsResult.reason));
    }

    if (creditResult.status === 'fulfilled') {
      this.creditBalance.set(creditResult.value);
      this.creditAmount.set(creditResult.value);
    } else {
      this.creditError.set(this.getErrorMessage(creditResult.reason));
    }
    this.benefitsLoading.set(false);
  }

  retryAccountBenefits(): void {
    void this.loadAccountBenefits();
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'No se pudieron cargar los beneficios de la cuenta.';
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
        movie: this.movie,
        showtime: this.showtime,
        seats: [...this.seats],
        candy: this.cart.items().map(item => ({
          product_id: item.product.id,
          qty: item.quantity,
        })),
        couponCode: this.isRegisteredUser() ? this.selectedCouponCode() || null : null,
        useCredit: this.isRegisteredUser() ? this.estimatedCredit() : 0,
        contactEmail: isAnonymous
          ? this.contactEmail().trim()
          : session?.user.email ?? null,
        birthDate: isAnonymous ? this.birthDate() : null,
      });

      this.cart.clear();
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

  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2,
    }).format(price);
  }

  get selectedCouponCodeValue(): string { return this.selectedCouponCode(); }
  set selectedCouponCodeValue(value: string) { this.selectedCouponCode.set(value); }
  get creditAmountValue(): number { return this.creditAmount(); }
  set creditAmountValue(value: number) {
    this.creditAmount.set(Number.isFinite(value) ? Math.max(0, value) : 0);
  }
  get useCreditValue(): boolean { return this.useCredit(); }
  set useCreditValue(value: boolean) { this.useCredit.set(value); }

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


import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShowtimeService } from '../../services/showtime';
import { MovieService } from '../../services/movie';
import { Showtime } from '../../models/showtime';
import { Movie } from '../../models/movie';
import { SeatHoldService } from '../../services/seat-hold';
import { PricingService, TicketPriceEstimate } from '../../services/pricing';
import { getSeatContiguityError } from '../../utils/seat-validation';
import { supabase } from '../../supabase.client';

interface Seat {
  id: string;
  label: number;
}

interface SeatRow {
  label: string;
  isAccessible: boolean;
  isVip: boolean;
  sections: Seat[][];
}

interface SeatOccupancy {
  state: 'held' | 'sold';
  held_until: string | null;
}

@Component({
  selector: 'app-seat-selection',
  imports: [RouterLink],
  templateUrl: './seat-selection.html',
  styleUrl: './seat-selection.css',
})
export class SeatSelection implements OnDestroy {
  private route = inject(ActivatedRoute);
  private showtimeService = inject(ShowtimeService);
  private movieService = inject(MovieService);
  private router = inject(Router);
  seatHoldService = inject(SeatHoldService);
  private pricingService = inject(PricingService);

  showtimeId = computed(() =>
    Number(this.route.snapshot.paramMap.get('id'))
  );

  showtime = signal<Showtime | undefined>(undefined);
  movie = signal<Movie | undefined>(undefined);

  selectedSeats = signal<string[]>([]);
  seatOccupancy = signal<Map<string, SeatOccupancy>>(new Map());
  loadingOccupiedSeats = signal(false);
  seatError = signal('');
  seatConflict = signal('');
  priceEstimate = signal<TicketPriceEstimate | null>(null);
  priceEstimateLoading = signal(false);
  priceEstimateError = signal('');
  private occupancyChannel: ReturnType<typeof supabase.channel> | null = null;
  private holdExpiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const id = this.showtimeId();

      this.showtime.set(undefined);
      this.movie.set(undefined);
      this.stopOccupancyUpdates();
      this.seatOccupancy.set(new Map());
      this.selectedSeats.set([]);
      this.priceEstimate.set(null);
      this.priceEstimateError.set('');

      if (!Number.isInteger(id) || id <= 0) {
        this.seatError.set('La función seleccionada no es válida.');
        return;
      }

      void this.loadShowtimeAndMovie(id);
    });
  }

  private async loadShowtimeAndMovie(id: number): Promise<void> {
    try {
      const showtime = await this.showtimeService.getById(id);

      this.showtime.set(showtime);

      if (!showtime) {
        this.seatError.set('No se encontró la función seleccionada.');
        return;
      }

      await this.seatHoldService.restoreHold(id);
      this.selectedSeats.set(this.seatHoldService.getHeldSeats(id));

      const movie = await this.movieService.getById(showtime.movieId);
      this.movie.set(movie);
      if (movie) await this.refreshPriceEstimate(this.selectedSeats());

      this.startOccupancyUpdates(id);
    } catch (error) {
      console.error('Error al cargar la función o película:', error);
      this.seatError.set(
        'No se pudo cargar la función. Intentá nuevamente.'
      );
    }
  }

  private startOccupancyUpdates(showtimeId: number): void {
    this.loadingOccupiedSeats.set(true);
    this.seatError.set('');
    this.seatConflict.set('');

    let initialLoadFinished = false;
    const pendingChanges: Array<() => void> = [];
    const channel = supabase
      .channel(`seat-occupancy-${showtimeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seat_occupancy',
          filter: `showtime_id=eq.${showtimeId}`,
        },
        payload => {
          const applyChange = () => {
            const label =
              payload.eventType === 'DELETE'
                ? payload.old['seat_label']
                : payload.new['seat_label'];
            if (typeof label !== 'string') return;

            const next = new Map(this.seatOccupancy());
            if (payload.eventType === 'DELETE') {
              next.delete(label);
            } else {
              const row = payload.new as SeatOccupancy & { seat_label: string };
              if (row.state === 'held' || row.state === 'sold') {
                next.set(label, { state: row.state, held_until: row.held_until });
              }
            }
            this.setOccupancy(next);
          };

          if (initialLoadFinished) applyChange();
          else pendingChanges.push(applyChange);
        }
      )
      .subscribe(status => {
        if (this.occupancyChannel !== channel) return;

        if (status === 'SUBSCRIBED') {
          initialLoadFinished = false;
          pendingChanges.length = 0;
          void this.loadOccupancySnapshot(showtimeId, () => {
            initialLoadFinished = true;
            pendingChanges.splice(0).forEach(apply => apply());
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.loadingOccupiedSeats.set(false);
          this.seatError.set('No se pudo conectar con la disponibilidad en tiempo real. Intentá nuevamente.');
        }
      });

    this.occupancyChannel = channel;
  }

  private async loadOccupancySnapshot(
    showtimeId: number,
    onLoaded: () => void
  ): Promise<void> {
    this.loadingOccupiedSeats.set(true);
    this.seatError.set('');
    try {
      const { data, error } = await supabase
        .from('seat_occupancy')
        .select('seat_label,state,held_until')
        .eq('showtime_id', showtimeId);

      if (error) throw error;

      const occupancy = new Map<string, SeatOccupancy>();
      for (const row of data ?? []) {
        if (row.state === 'held' || row.state === 'sold') {
          occupancy.set(row.seat_label, {
            state: row.state,
            held_until: row.held_until,
          });
        }
      }
      this.setOccupancy(occupancy);
      onLoaded();
    } catch (error) {
      console.error('Error al cargar disponibilidad de butacas:', error);
      this.seatError.set(
        error instanceof Error
          ? error.message
          : 'No se pudo consultar la disponibilidad. Intentá nuevamente.'
      );
    } finally {
      this.loadingOccupiedSeats.set(false);
    }
  }

  private setOccupancy(occupancy: Map<string, SeatOccupancy>): void {
    this.seatOccupancy.set(occupancy);
    this.scheduleHoldExpiry();
  }

  private scheduleHoldExpiry(): void {
    if (this.holdExpiryTimer) clearTimeout(this.holdExpiryTimer);
    const expirations = [...this.seatOccupancy().values()]
      .filter(seat => seat.state === 'held' && seat.held_until)
      .map(seat => Date.parse(seat.held_until!))
      .filter(expiry => Number.isFinite(expiry) && expiry > Date.now());
    if (expirations.length === 0) return;

    const nextExpiry = Math.min(...expirations);
    this.holdExpiryTimer = setTimeout(() => {
      // Fuerza una actualización reactiva para que el bloqueo vencido se vea libre.
      this.seatOccupancy.update(current => new Map(current));
      this.scheduleHoldExpiry();
    }, Math.max(0, nextExpiry - Date.now()) + 25);
  }

  private stopOccupancyUpdates(): void {
    if (this.holdExpiryTimer) clearTimeout(this.holdExpiryTimer);
    this.holdExpiryTimer = null;
    if (this.occupancyChannel) void supabase.removeChannel(this.occupancyChannel);
    this.occupancyChannel = null;
  }

  ngOnDestroy(): void {
    this.stopOccupancyUpdates();
  }


  rows = computed<SeatRow[]>(() => {
    return Array.from({ length: 20 }, (_, index) => {
      const label = String.fromCharCode(65 + index);
      const isAccessible = label === 'J' || label === 'K';
      const isVip = ['R', 'S', 'T'].includes(label);

      const sectionSizes = isAccessible
        ? [2, 10, 2]
        : [4, 20, 4];

      const sections = sectionSizes.map((size, sectionIndex) =>
        Array.from({ length: size }, (_, seatIndex) => ({
          id: `${label}-${sectionIndex}-${seatIndex + 1}`,
          label: seatIndex + 1,
        }))
      );

      return {
        label,
        isAccessible,
        isVip,
        sections,
      };
    });
  });

  getSeatPrice(seatId: string): number {
    const estimate = this.priceEstimate();
    if (!estimate) return 0;
    return estimate.seatPrices[seatId] ?? this.getCategoryPrice(seatId, estimate);
  }

  total = computed(() =>
    this.priceEstimate()?.total ?? 0
  );

  contiguityError = computed(() => getSeatContiguityError(this.selectedSeats()));
  hasVipSelected = computed(() =>
    this.selectedSeats().some(seat => ['R', 'S', 'T'].includes(seat.split('-')[0]))
  );

  private getCategoryPrice(seatId: string, estimate: TicketPriceEstimate): number {
    const row = seatId.split('-')[0];
    if (row === 'J' || row === 'K') return estimate.accessiblePrice;
    if (['R', 'S', 'T'].includes(row)) return estimate.vipPrice;
    return estimate.standardPrice;
  }

  private async refreshPriceEstimate(seats: string[]): Promise<void> {
    const movie = this.movie();
    const showtime = this.showtime();
    if (!movie || !showtime) return;

    this.priceEstimateLoading.set(true);
    this.priceEstimateError.set('');
    try {
      this.priceEstimate.set(
        await this.pricingService.estimateTickets(movie, showtime, seats)
      );
    } catch (error) {
      this.priceEstimateError.set(
        error instanceof Error
          ? error.message
          : 'No se pudo calcular el precio estimado.'
      );
    } finally {
      this.priceEstimateLoading.set(false);
    }
  }

  isSelected(seatId: string): boolean {
    return this.selectedSeats().includes(seatId);
  }

  isOccupied(seatId: string): boolean {
    const occupancy = this.seatOccupancy().get(seatId);
    if (!occupancy) return false;
    if (occupancy.state === 'sold') return true;
    return !!occupancy.held_until && Date.parse(occupancy.held_until) > Date.now();
  }

  isHeld(seatId: string): boolean {
    return this.seatOccupancy().get(seatId)?.state === 'held' && this.isOccupied(seatId);
  }

  seatStateLabel(seatId: string): string {
    if (this.isHeld(seatId)) return 'en proceso de compra';
    if (this.isOccupied(seatId)) return 'ocupada';
    return 'disponible';
  }

  updatingSeatHold = signal(false);

  async toggleSeat(seatId: string): Promise<void> {
    if (
      this.loadingOccupiedSeats() ||
      this.updatingSeatHold() ||
      this.seatError() ||
      (this.isOccupied(seatId) && !this.isSelected(seatId))
    ) {
      return;
    }

    const previousSeats = this.selectedSeats();
    const nextSeats =
      previousSeats.includes(seatId)
        ? previousSeats.filter(id => id !== seatId)
        : [...previousSeats, seatId];
    const showtimeId = this.showtime()?.id;
    if (!showtimeId) return;

    this.updatingSeatHold.set(true);
    this.seatConflict.set('');
    try {
      if (nextSeats.length > 0) {
        await this.seatHoldService.updateHold(showtimeId, nextSeats);
      } else {
        await this.seatHoldService.releaseHold(showtimeId);
      }
      this.selectedSeats.set(nextSeats);
      await this.refreshPriceEstimate(nextSeats);
    } catch (error) {
      this.seatConflict.set(
        error instanceof Error
          ? error.message
          : 'No se pudo reservar temporalmente la butaca. Intentá nuevamente.'
      );
    } finally {
      this.updatingSeatHold.set(false);
    }

  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }

  async continueToSummary(): Promise<void> {
    const showtime = this.showtime();
    const movie = this.movie();
    const seats = this.selectedSeats();

    if (
      !showtime ||
      !movie ||
      seats.length === 0 ||
      this.loadingOccupiedSeats() ||
      this.priceEstimateLoading() ||
      !!this.priceEstimateError() ||
      !!this.contiguityError()
    ) {
      return;
    }

    // Realtime mantiene el mapa actualizado; hold_seats vuelve a validar
    // la disponibilidad de forma autoritativa al confirmar la compra.
    const newlyOccupied = seats.filter(seatId =>
      this.isOccupied(seatId) && !this.seatHoldService.ownsSeat(showtime.id, seatId)
    );

    if (newlyOccupied.length > 0) {
      this.selectedSeats.update(current =>
        current.filter(seatId => !newlyOccupied.includes(seatId))
      );

      this.seatConflict.set(
        `Estas butacas ya fueron reservadas: ${newlyOccupied.join(', ')}. Elegí otras para continuar.`
      );

      return;
    }

    try {
      await this.seatHoldService.updateHold(showtime.id, seats);
    } catch (error) {
      this.seatConflict.set(
        error instanceof Error
          ? error.message
          : 'No se pudo renovar el bloqueo de las butacas.'
      );
      return;
    }

    this.router.navigate(['/booking-summary'], {
      state: {
        showtime,
        movie,
        seats,
        total: this.total(),
      },
    });
  }
}

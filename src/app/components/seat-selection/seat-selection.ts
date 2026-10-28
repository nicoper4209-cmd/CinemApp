
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShowtimeService } from '../../services/showtime';
import { MovieService } from '../../services/movie';
import { Showtime } from '../../models/showtime';
import { Movie } from '../../models/movie';
import { BookingService } from '../../services/booking';
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

@Component({
  selector: 'app-seat-selection',
  imports: [RouterLink],
  templateUrl: './seat-selection.html',
  styleUrl: './seat-selection.css',
})
export class SeatSelection {
  private route = inject(ActivatedRoute);
  private showtimeService = inject(ShowtimeService);
  private movieService = inject(MovieService);
  private bookingService = inject(BookingService);
  private router = inject(Router);

  showtimeId = computed(() =>
    Number(this.route.snapshot.paramMap.get('id'))
  );

  showtime = signal<Showtime | undefined>(undefined);
  movie = signal<Movie | undefined>(undefined);

  selectedSeats = signal<string[]>([]);
  occupiedSeats = signal<Set<string>>(new Set());
  loadingOccupiedSeats = signal(false);
  seatError = signal('');
  seatConflict = signal('');

  constructor() {
    effect(() => {
      const id = this.showtimeId();

      this.showtime.set(undefined);
      this.movie.set(undefined);
      this.occupiedSeats.set(new Set());
      this.selectedSeats.set([]);

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

      const movie = await this.movieService.getById(showtime.movieId);
      this.movie.set(movie);

      await this.loadOccupiedSeats(id);
    } catch (error) {
      console.error('Error al cargar la función o película:', error);
      this.seatError.set(
        'No se pudo cargar la función. Intentá nuevamente.'
      );
    }
  }

  private async loadOccupiedSeats(showtimeId: number): Promise<boolean> {
    this.loadingOccupiedSeats.set(true);
    this.seatError.set('');
    this.seatConflict.set('');

    try {
      const { data, error } = await supabase
        .rpc('get_occupied_seats', {
          p_showtime_id: showtimeId,
        });

      if (error) {
        const errorCode = 'code' in error ? error.code : undefined;
        const message =
          errorCode === 'PGRST202' || errorCode === '42883'
            ? 'La función get_occupied_seats no está configurada en Supabase. Aplicá la migración de disponibilidad y volvé a intentar.'
            : `No se pudo consultar la disponibilidad: ${error.message}`;
        throw new Error(message);
      }

      const rows: unknown[] =
        data === null ? [] : Array.isArray(data) ? data : [data];
      const occupiedSeats = new Set<string>();

      for (const row of rows) {
        if (
          typeof row !== 'object' ||
          row === null ||
          !('seat_label' in row) ||
          typeof row.seat_label !== 'string'
        ) {
          throw new Error(
            'Supabase devolvió un formato inesperado para las butacas ocupadas.'
          );
        }

        occupiedSeats.add(row.seat_label);
      }

      this.bookingService
        .getRecentlyBookedSeats(showtimeId)
        .forEach(seat => occupiedSeats.add(seat));

      this.occupiedSeats.set(occupiedSeats);
      return true;
    } catch (error) {
      console.error('Error al cargar butacas ocupadas:', error);
      this.seatError.set(
        error instanceof Error
          ? error.message
          : 'No se pudo consultar la disponibilidad. Intentá nuevamente.'
      );
      return false;
    } finally {
      this.loadingOccupiedSeats.set(false);
    }
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

  vipExtra = 6500;

  getSeatPrice(seatId: string): number {
    const isVip = ['R', 'S', 'T'].includes(seatId.split('-')[0]);
    const basePrice = this.showtime()?.price ?? 0;

    return isVip ? basePrice + this.vipExtra : basePrice;
  }

  total = computed(() =>
    this.selectedSeats().reduce(
      (sum, seatId) => sum + this.getSeatPrice(seatId),
      0
    )
  );

  isSelected(seatId: string): boolean {
    return this.selectedSeats().includes(seatId);
  }

  isOccupied(seatId: string): boolean {
    return this.occupiedSeats().has(seatId);
  }

  toggleSeat(seatId: string): void {
    if (
      this.loadingOccupiedSeats() ||
      this.seatError() ||
      this.isOccupied(seatId)
    ) {
      return;
    }

    this.selectedSeats.update(seats =>
      seats.includes(seatId)
        ? seats.filter(id => id !== seatId)
        : [...seats, seatId]
    );
    this.seatConflict.set('');
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
      this.loadingOccupiedSeats()
    ) {
      return;
    }

    // Actualizar disponibilidad antes de avanzar.
    const loaded = await this.loadOccupiedSeats(showtime.id);

    if (!loaded) {
      return;
    }

    // Si otro usuario reservó una de las butacas seleccionadas,
    // quitarla de la selección y pedir al usuario que revise.
    const newlyOccupied = seats.filter(seatId =>
      this.isOccupied(seatId)
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


import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShowtimeService } from '../../services/showtime';
import { MovieService } from '../../services/movie';
import { Showtime } from '../../models/showtime';
import { Movie } from '../../models/movie';

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
  private router = inject(Router);

  showtimeId = computed(() =>
    Number(this.route.snapshot.paramMap.get('id'))
  );

  showtime = signal<Showtime | undefined>(undefined);
  movie = signal<Movie | undefined>(undefined);

  constructor() {
    effect(() => {
      const id = this.showtimeId();

      this.showtime.set(undefined);
      this.movie.set(undefined);

      void this.loadShowtimeAndMovie(id);
    });
  }

  private async loadShowtimeAndMovie(id: number): Promise<void> {
    try {
      const showtime = await this.showtimeService.getById(id);

      this.showtime.set(showtime);

      if (!showtime) {
        return;
      }

      const movie = await this.movieService.getById(showtime.movieId);
      this.movie.set(movie);
    } catch (error) {
      console.error('Error al cargar la función o película:', error);
    }
  }

  selectedSeats = signal<string[]>([]);

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

  // Disponibilidad ficticia para probar la interfaz.
  private occupiedSeats = new Set([
    'A-1-2',
    'A-1-3',
    'B-0-1',
    'C-1-8',
    'D-2-2',
    'F-1-12',
    'H-0-4',
    'J-1-3',
    'K-2-1',
    'R-1-10',
    'S-1-15',
    'T-2-3',
  ]);

  vipExtra = 6500;

  getSeatPrice(seatId: string): number {
    const isVip = ['R', 'S', 'T'].includes(
      seatId.split('-')[0]
    );

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
    return this.occupiedSeats.has(seatId);
  }

  toggleSeat(seatId: string): void {
    if (this.isOccupied(seatId)) {
      return;
    }

    this.selectedSeats.update(seats =>
      seats.includes(seatId)
        ? seats.filter(id => id !== seatId)
        : [...seats, seatId]
    );
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }

  // Resumen de compra
  continueToSummary(): void {
    const showtime = this.showtime();
    const movie = this.movie();
    const seats = this.selectedSeats();

    if (!showtime || !movie || seats.length === 0) {
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

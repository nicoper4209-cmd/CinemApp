
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShowtimeService } from '../../services/showtime';
import { MovieService } from '../../services/movie';

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

  showtimeId = computed(() =>
    Number(this.route.snapshot.paramMap.get('id'))
  );

  showtime = computed(() =>
    this.showtimeService.getById(this.showtimeId())
  );

  movie = computed(() => {
    const showtime = this.showtime();

    return showtime
      ? this.movieService.getById(showtime.movieId)
      : undefined;
  });

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }
}

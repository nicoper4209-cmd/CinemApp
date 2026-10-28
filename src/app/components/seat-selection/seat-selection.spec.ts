import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { SeatSelection } from './seat-selection';
import { ShowtimeService } from '../../services/showtime';
import { MovieService } from '../../services/movie';
import { BookingService } from '../../services/booking';
import { Movie } from '../../models/movie';
import { Showtime } from '../../models/showtime';

describe('SeatSelection', () => {
  let component: SeatSelection;
  let fixture: ComponentFixture<SeatSelection>;

  beforeEach(async () => {
    const showtime: Showtime = {
      id: 1,
      movieId: 1,
      room: 'Sala 1',
      date: '2026-10-28',
      time: '20:00',
      price: 10000,
    };
    const movie: Movie = {
      id: 1,
      title: 'Película',
      synopsis: '',
      duration: 120,
      genre: 'Drama',
      ageRating: 'ATP',
      poster: '',
      alt: '',
      year: '2026',
      rating: 0,
      trailer: '',
      status: 'available',
    };

    await TestBed.configureTestingModule({
      imports: [SeatSelection],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '0' } } },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ShowtimeService, useValue: { getById: vi.fn() } },
        { provide: MovieService, useValue: { getById: vi.fn() } },
        {
          provide: BookingService,
          useValue: { getRecentlyBookedSeats: () => [] },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SeatSelection);
    component = fixture.componentInstance;
    await fixture.whenStable();
    component.showtime.set(showtime);
    component.movie.set(movie);
    component.seatError.set('');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('disables occupied seats and does not allow selecting them', () => {
    component.occupiedSeats.set(new Set(['A-0-1']));
    fixture.detectChanges();

    const seat = fixture.nativeElement.querySelector(
      'button[aria-label="Fila A, asiento 1, ocupada"]'
    ) as HTMLButtonElement;

    expect(seat.disabled).toBe(true);
    expect(seat.classList.contains('is-occupied')).toBe(true);

    component.toggleSeat('A-0-1');

    expect(component.selectedSeats()).not.toContain('A-0-1');
  });
});

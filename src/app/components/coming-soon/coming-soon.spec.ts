import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ComingSoon } from './coming-soon';
import { MovieService } from '../../services/movie';
import { Movie } from '../../models/movie';

describe('ComingSoon', () => {
  let component: ComingSoon;
  let fixture: ComponentFixture<ComingSoon>;
  const upcomingMovies: Movie[] = [{
    id: 1,
    title: 'Próximamente',
    synopsis: '',
    duration: 100,
    genre: 'Drama',
    ageRating: 'ATP',
    poster: '',
    alt: '',
    year: '2026',
    rating: 0,
    trailer: '',
    status: 'upcoming',
  }];
  const getUpcoming = vi.fn().mockResolvedValue(upcomingMovies);

  beforeEach(async () => {
    getUpcoming.mockClear();

    await TestBed.configureTestingModule({
      imports: [ComingSoon],
      providers: [
        provideRouter([]),
        { provide: MovieService, useValue: { getUpcoming } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComingSoon);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads upcoming movies into the catalog input', async () => {
    await fixture.whenStable();

    expect(getUpcoming).toHaveBeenCalledOnce();
    expect(component.movies()).toEqual(upcomingMovies);
  });
});

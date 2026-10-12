import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TopMovies } from './top-movies';

describe('TopMovies', () => {
  let component: TopMovies;
  let fixture: ComponentFixture<TopMovies>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopMovies],
    }).compileComponents();

    fixture = TestBed.createComponent(TopMovies);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

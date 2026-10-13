import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MovieCatalog } from './movie-catalog';

describe('MovieCatalog', () => {
  let component: MovieCatalog;
  let fixture: ComponentFixture<MovieCatalog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovieCatalog],
    }).compileComponents();

    fixture = TestBed.createComponent(MovieCatalog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

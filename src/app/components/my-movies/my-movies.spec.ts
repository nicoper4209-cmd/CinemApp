import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyMovies } from './my-movies';

describe('MyMovies', () => {
  let component: MyMovies;
  let fixture: ComponentFixture<MyMovies>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyMovies],
    }).compileComponents();

    fixture = TestBed.createComponent(MyMovies);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

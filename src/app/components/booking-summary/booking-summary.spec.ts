import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookingSummary } from './booking-summary';

describe('BookingSummary', () => {
  let component: BookingSummary;
  let fixture: ComponentFixture<BookingSummary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingSummary],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingSummary);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

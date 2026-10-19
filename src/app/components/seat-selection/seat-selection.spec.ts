import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeatSelection } from './seat-selection';

describe('SeatSelection', () => {
  let component: SeatSelection;
  let fixture: ComponentFixture<SeatSelection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeatSelection],
    }).compileComponents();

    fixture = TestBed.createComponent(SeatSelection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

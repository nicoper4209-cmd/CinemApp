import { TestBed } from '@angular/core/testing';
import { Showtime } from './showtime';

describe('Showtime', () => {
  let service: Showtime;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Showtime);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

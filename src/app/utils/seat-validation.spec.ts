import { describe, expect, it } from 'vitest';
import { getSeatContiguityError } from './seat-validation';

describe('getSeatContiguityError', () => {
  it('allows one seat and consecutive seats in the same row and section', () => {
    expect(getSeatContiguityError(['A-1-4'])).toBeNull();
    expect(getSeatContiguityError(['A-1-4', 'A-1-5', 'A-1-6'])).toBeNull();
  });

  it('requires seats to be in the same row and section', () => {
    expect(getSeatContiguityError(['A-1-4', 'A-2-4'])).toBe(
      'Las butacas deben estar en la misma fila y sección.'
    );
    expect(getSeatContiguityError(['A-1-4', 'B-1-5'])).toBe(
      'Las butacas deben estar en la misma fila y sección.'
    );
  });

  it('rejects gaps, duplicate seats, and malformed labels', () => {
    expect(getSeatContiguityError(['A-1-4', 'A-1-6'])).toBe(
      'Las butacas deben ser contiguas.'
    );
    expect(getSeatContiguityError(['A-1-4', 'A-1-4'])).toBe(
      'No se puede seleccionar la misma butaca más de una vez.'
    );
    expect(getSeatContiguityError(['invalid', 'A-1-4'])).toBe(
      'La selección contiene una butaca inválida.'
    );
  });
});

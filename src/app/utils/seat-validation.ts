export function getSeatContiguityError(seats: string[]): string | null {
  if (seats.length <= 1) return null;

  const parsed = seats.map(seat => {
    const match = /^([A-T])-([0-2])-(\d+)$/.exec(seat);
    if (!match) return null;

    const row = match[1];
    const section = Number(match[2]);
    const number = Number(match[3]);
    const accessible = row === 'J' || row === 'K';
    const max = accessible
      ? [2, 10, 2][section]
      : [4, 20, 4][section];
    if (number < 1 || number > max) return null;

    return { row, section: match[2], number };
  });

  if (parsed.some(seat => seat === null)) {
    return 'La selección contiene una butaca inválida.';
  }

  const validSeats = parsed as Array<{ row: string; section: string; number: number }>;
  const first = validSeats[0];
  if (validSeats.some(seat => seat.row !== first.row || seat.section !== first.section)) {
    return 'Las butacas deben estar en la misma fila y sección.';
  }

  const numbers = validSeats.map(seat => seat.number).sort((a, b) => a - b);
  if (new Set(numbers).size !== numbers.length) {
    return 'No se puede seleccionar la misma butaca más de una vez.';
  }
  if (numbers.some((number, index) => index > 0 && number !== numbers[index - 1] + 1)) {
    return 'Las butacas deben ser contiguas.';
  }

  return null;
}

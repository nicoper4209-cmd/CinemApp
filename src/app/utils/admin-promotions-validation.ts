import { CouponType } from '../models/promotions';

export const COUPON_TYPES: readonly { value: CouponType; label: string }[] = [
  { value: 'primera_compra', label: 'Primera compra' },
  { value: 'mayor_50', label: 'Mayor de 50' },
  { value: 'general', label: 'General' },
];

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validateCouponCode(raw: string): string | null {
  const value = normalizeCouponCode(raw);
  if (!/^[A-Z0-9_-]{3,30}$/.test(value)) {
    return 'El código debe tener entre 3 y 30 caracteres: letras, números, guion o guion bajo.';
  }
  return null;
}

export function validateCouponPercentage(raw: number | string | null): string | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    return 'El porcentaje debe ser mayor que 0 y menor o igual a 100.';
  }
  if (Math.round(value * 100) / 100 !== value) {
    return 'El porcentaje admite hasta dos decimales.';
  }
  return null;
}

export function validateCouponMinAge(
  type: CouponType,
  raw: number | string | null,
): string | null {
  if (raw === null || `${raw}`.trim() === '') {
    return type === 'mayor_50' ? 'Indicá la edad mínima para el cupón de mayores.' : null;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 120) {
    return 'La edad mínima debe ser un entero entre 1 y 120.';
  }
  return null;
}

export function validateCouponDates(from: string, until: string): string | null {
  if (from && until && until < from) {
    return 'La fecha de fin no puede ser anterior a la de inicio.';
  }
  return null;
}

/** Convierte una fecha local (America/Argentina/Buenos_Aires) al instante ISO que se guarda. */
export function dateToInstant(date: string, boundary: 'start' | 'end'): string | null {
  if (!date) return null;
  const time = boundary === 'start' ? '00:00:00' : '23:59:59';
  return `${date}T${time}-03:00`;
}

/** Muestra un timestamptz como fecha local del cine (YYYY-MM-DD). */
export function toArtDate(value: string | null): string {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values['year']}-${values['month']}-${values['day']}`;
}

export function validateRewardName(raw: string): string | null {
  const value = raw.trim();
  if (value.length < 1 || value.length > 80) {
    return 'El nombre del premio debe tener entre 1 y 80 caracteres.';
  }
  return null;
}

export function validatePointsCost(raw: number | string | null): string | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 1_000_000) {
    return 'El costo en puntos debe ser un entero entre 1 y 1.000.000.';
  }
  return null;
}

export function validateRewardValue(
  type: string,
  raw: number | string | null,
): string | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return 'El valor del premio no puede ser negativo.';
  }
  if (Math.round(value * 100) / 100 !== value) {
    return 'El valor del premio admite hasta dos decimales.';
  }
  if (type === 'credit' && value <= 0) {
    return 'Un premio de crédito necesita un valor mayor que 0.';
  }
  return null;
}

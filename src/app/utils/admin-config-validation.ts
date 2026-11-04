export interface SettingRule {
  key: string;
  label: string;
  description: string;
  unit: string;
  min: number;
  max: number;
}

export const SETTING_RULES: readonly SettingRule[] = [
  {
    key: 'hold_minutes',
    label: 'Bloqueo de butacas',
    description: 'Minutos que una butaca queda reservada durante la compra.',
    unit: 'minutos',
    min: 1,
    max: 120,
  },
  {
    key: 'presale_days',
    label: 'Días de preventa',
    description: 'Días previos al estreno en los que se aplica el precio de preventa.',
    unit: 'días',
    min: 0,
    max: 365,
  },
  {
    key: 'cancel_hours',
    label: 'Límite de cancelación',
    description: 'Horas antes de la función hasta las que se puede cancelar y generar crédito.',
    unit: 'horas',
    min: 0,
    max: 72,
  },
  {
    key: 'min_gap_minutes',
    label: 'Recambio entre funciones',
    description: 'Minutos mínimos entre el fin de una función y el inicio de la siguiente en la misma sala.',
    unit: 'minutos',
    min: 0,
    max: 120,
  },
  {
    key: 'points_per_currency',
    label: 'Puntos por peso',
    description: 'Puntos que acumula el cliente por cada peso del monto con descuento.',
    unit: 'puntos/$',
    min: 0,
    max: 100,
  },
  {
    key: 'top_window_days',
    label: 'Ventana del Top 3',
    description: 'Días hacia atrás que se consideran para el ranking de ventas.',
    unit: 'días',
    min: 1,
    max: 365,
  },
  {
    key: 'validation_window_before_min',
    label: 'Anticipación de validación',
    description: 'Minutos antes de la función desde los que se puede validar una entrada.',
    unit: 'minutos',
    min: 0,
    max: 240,
  },
  {
    key: 'max_seats_per_purchase',
    label: 'Máximo de butacas por compra',
    description: 'Cantidad máxima de butacas que puede comprar una persona en una misma operación.',
    unit: 'butacas',
    min: 1,
    max: 20,
  },
];

export function validateIntegerSetting(rule: SettingRule, raw: string): string | null {
  const value = raw.trim();
  if (!/^\d+$/.test(value)) {
    return `Ingresá un número entero para "${rule.label}".`;
  }
  const parsed = Number(value);
  if (parsed < rule.min || parsed > rule.max) {
    return `"${rule.label}" debe estar entre ${rule.min} y ${rule.max} ${rule.unit}.`;
  }
  return null;
}

export function validateFormatName(raw: string): string | null {
  const value = raw.trim();
  if (value.length < 1 || value.length > 40) {
    return 'El nombre del formato debe tener entre 1 y 40 caracteres.';
  }
  return null;
}

export function validateFormatMultiplier(raw: number | string | null): string | null {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return 'Ingresá un multiplicador válido.';
  }
  if (value <= 0 || value > 99.99) {
    return 'El multiplicador debe ser mayor que 0 y menor o igual a 99,99.';
  }
  if (Math.round(value * 100) / 100 !== value) {
    return 'El multiplicador admite hasta dos decimales.';
  }
  return null;
}

export function validatePrice(raw: number | string | null): string | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return 'El precio debe ser mayor que 0.';
  }
  if (Math.round(value * 100) / 100 !== value) {
    return 'El precio admite hasta dos decimales.';
  }
  return null;
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validateRoomCode(raw: string): string | null {
  const value = normalizeRoomCode(raw);
  if (!/^[A-Z][A-Z0-9]{0,2}$/.test(value)) {
    return 'La sala debe ser una letra (A–Z) o un código de hasta 3 caracteres que empiece con letra.';
  }
  return null;
}

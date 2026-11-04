export function todayInArt(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values['year']}-${values['month']}-${values['day']}`;
}

export function daysBeforeInArt(days: number): string {
  const base = new Date(`${todayInArt()}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() - Math.max(0, Math.trunc(days)));
  return base.toISOString().slice(0, 10);
}

export function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number): string => {
    const text = String(value ?? '');
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers, ...rows].map(row => row.map(escape).join(';'));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export const ENTITY_LABELS: Record<string, string> = {
  movies: 'Película',
  showtimes: 'Función',
  rooms: 'Sala',
  formats: 'Formato',
  pricing_config: 'Precios',
  app_settings: 'Parámetros',
  coupons: 'Cupón',
  rewards: 'Premio',
  candy_categories: 'Categoría Candy',
  candy_products: 'Producto Candy',
  profiles: 'Perfil',
};

export const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  name: 'Nombre',
  code: 'Código',
  price: 'Precio',
  base_price: 'Precio base',
  presale_price: 'Precio preventa',
  price_multiplier: 'Multiplicador',
  percentage: 'Porcentaje',
  min_age: 'Edad mínima',
  active: 'Activo',
  status: 'Estado',
  is_featured: 'Destacado',
  is_combo: 'Combo',
  points_cost: 'Puntos',
  reward_value: 'Valor del premio',
  sort_order: 'Orden',
  value: 'Valor',
  description: 'Descripción',
  valid_from: 'Vigencia desde',
  valid_until: 'Vigencia hasta',
  role: 'Rol',
};

export function auditActionLabel(action: string): string {
  switch (action.toUpperCase()) {
    case 'INSERT': return 'Alta';
    case 'UPDATE': return 'Modificación';
    case 'DELETE': return 'Baja';
    default: return action;
  }
}

export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity;
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Devuelve las etiquetas de los campos que cambiaron entre `old` y `new`. */
export function changedAuditFields(details: unknown): string[] {
  if (!isRecord(details)) return [];
  const before = isRecord(details['old']) ? details['old'] : null;
  const after = isRecord(details['new']) ? details['new'] : null;
  if (!before || !after) return [];
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...fields]
    .filter(field => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map(fieldLabel);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

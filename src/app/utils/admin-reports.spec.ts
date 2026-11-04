import { describe, expect, it } from 'vitest';
import {
  auditActionLabel,
  buildCsv,
  changedAuditFields,
  daysBeforeInArt,
  entityLabel,
  fieldLabel,
  formatReportDate,
  todayInArt,
} from './admin-reports';

describe('admin reports helpers', () => {
  it('builds an Excel-friendly CSV with BOM, semicolons and escaped quotes', () => {
    const csv = buildCsv(
      ['Fecha', 'Película', 'Ingresos'],
      [['2026-11-04', 'Título; con punto y coma', '1234.50'], ['2026-11-05', 'Comillas "dobles"', '10.00']],
    );

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Fecha;Película;Ingresos\r\n');
    expect(csv).toContain('2026-11-04;"Título; con punto y coma";1234.50');
    expect(csv).toContain('"Comillas ""dobles"""');
  });

  it('returns the fields that actually changed in an audit update', () => {
    const fields = changedAuditFields({
      old: { name: '2D', price_multiplier: 1, active: true },
      new: { name: '2D', price_multiplier: 1.25, active: true },
    });

    expect(fields).toEqual(['Multiplicador']);
  });

  it('ignores inserts and deletes because they have only one snapshot', () => {
    expect(changedAuditFields({ old: null, new: { name: '3D' } })).toEqual([]);
    expect(changedAuditFields({ old: { name: '3D' }, new: null })).toEqual([]);
    expect(changedAuditFields(null)).toEqual([]);
  });

  it('translates audit actions, entities and fields', () => {
    expect(auditActionLabel('INSERT')).toBe('Alta');
    expect(auditActionLabel('UPDATE')).toBe('Modificación');
    expect(auditActionLabel('DELETE')).toBe('Baja');
    expect(entityLabel('pricing_config')).toBe('Precios');
    expect(entityLabel('unknown_table')).toBe('unknown_table');
    expect(fieldLabel('base_price')).toBe('Precio base');
  });

  it('formats dates in the cinema time zone', () => {
    expect(todayInArt()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(daysBeforeInArt(0)).toBe(todayInArt());
    expect(formatReportDate('2026-11-04')).toBe('04/11/2026');
  });
});

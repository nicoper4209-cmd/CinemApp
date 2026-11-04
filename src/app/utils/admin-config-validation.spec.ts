import { describe, expect, it } from 'vitest';
import {
  SETTING_RULES,
  normalizeRoomCode,
  validateFormatMultiplier,
  validateFormatName,
  validateIntegerSetting,
  validatePrice,
  validateRoomCode,
} from './admin-config-validation';

const rule = (key: string) => {
  const found = SETTING_RULES.find(item => item.key === key);
  if (!found) throw new Error(`Falta la regla ${key}`);
  return found;
};

describe('admin configuration validation', () => {
  it('accepts integer settings inside their range', () => {
    expect(validateIntegerSetting(rule('hold_minutes'), '10')).toBeNull();
    expect(validateIntegerSetting(rule('presale_days'), '0')).toBeNull();
    expect(validateIntegerSetting(rule('max_seats_per_purchase'), '20')).toBeNull();
  });

  it('rejects decimals, empty values and out-of-range settings', () => {
    expect(validateIntegerSetting(rule('hold_minutes'), '10.5')).toMatch(/entero/);
    expect(validateIntegerSetting(rule('hold_minutes'), '')).toMatch(/entero/);
    expect(validateIntegerSetting(rule('hold_minutes'), '0')).toMatch(/entre 1 y 120/);
    expect(validateIntegerSetting(rule('presale_days'), '400')).toMatch(/entre 0 y 365/);
  });

  it('validates format names and multipliers', () => {
    expect(validateFormatName('2D')).toBeNull();
    expect(validateFormatName('   ')).toMatch(/entre 1 y 40/);
    expect(validateFormatMultiplier(1.25)).toBeNull();
    expect(validateFormatMultiplier(0)).toMatch(/mayor que 0/);
    expect(validateFormatMultiplier(100)).toMatch(/menor o igual a 99,99/);
    expect(validateFormatMultiplier(1.255)).toMatch(/dos decimales/);
  });

  it('validates prices with up to two decimals', () => {
    expect(validatePrice(8000)).toBeNull();
    expect(validatePrice('6500.50')).toBeNull();
    expect(validatePrice(0)).toMatch(/mayor que 0/);
    expect(validatePrice(8000.555)).toMatch(/dos decimales/);
  });

  it('normalizes and validates room codes', () => {
    expect(normalizeRoomCode(' e ')).toBe('E');
    expect(validateRoomCode('e')).toBeNull();
    expect(validateRoomCode('A1')).toBeNull();
    expect(validateRoomCode('1A')).toMatch(/debe ser una letra/);
    expect(validateRoomCode('SALA')).toMatch(/debe ser una letra/);
  });
});

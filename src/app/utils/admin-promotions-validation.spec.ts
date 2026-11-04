import { describe, expect, it } from 'vitest';
import {
  dateToInstant,
  normalizeCouponCode,
  toArtDate,
  validateCouponCode,
  validateCouponDates,
  validateCouponMinAge,
  validateCouponPercentage,
  validatePointsCost,
  validateRewardName,
  validateRewardValue,
} from './admin-promotions-validation';

describe('admin promotions validation', () => {
  it('normalizes and validates coupon codes', () => {
    expect(normalizeCouponCode(' promo10 ')).toBe('PROMO10');
    expect(validateCouponCode('promo10')).toBeNull();
    expect(validateCouponCode('PRIMERA_COMPRA')).toBeNull();
    expect(validateCouponCode('ab')).toMatch(/entre 3 y 30/);
    expect(validateCouponCode('código con espacio')).toMatch(/entre 3 y 30/);
  });

  it('validates coupon percentages with two decimals', () => {
    expect(validateCouponPercentage(20)).toBeNull();
    expect(validateCouponPercentage('100')).toBeNull();
    expect(validateCouponPercentage(0)).toMatch(/mayor que 0/);
    expect(validateCouponPercentage(100.5)).toMatch(/menor o igual a 100/);
    expect(validateCouponPercentage(12.345)).toMatch(/dos decimales/);
  });

  it('requires a minimum age for senior coupons', () => {
    expect(validateCouponMinAge('general', null)).toBeNull();
    expect(validateCouponMinAge('mayor_50', null)).toMatch(/edad mínima/);
    expect(validateCouponMinAge('mayor_50', 50)).toBeNull();
    expect(validateCouponMinAge('general', 0)).toMatch(/entre 1 y 120/);
  });

  it('checks the coupon date range', () => {
    expect(validateCouponDates('', '')).toBeNull();
    expect(validateCouponDates('2026-11-01', '2026-11-30')).toBeNull();
    expect(validateCouponDates('2026-11-30', '2026-11-01')).toMatch(/no puede ser anterior/);
  });

  it('converts dates using the cinema time zone', () => {
    expect(dateToInstant('2026-11-05', 'start')).toBe('2026-11-05T00:00:00-03:00');
    expect(dateToInstant('2026-11-05', 'end')).toBe('2026-11-05T23:59:59-03:00');
    expect(dateToInstant('', 'start')).toBeNull();
    expect(toArtDate('2026-11-06T02:59:59Z')).toBe('2026-11-05');
    expect(toArtDate(null)).toBe('');
  });

  it('validates reward name, points and value', () => {
    expect(validateRewardName('Crédito $5.000')).toBeNull();
    expect(validateRewardName('   ')).toMatch(/entre 1 y 80/);
    expect(validatePointsCost(100)).toBeNull();
    expect(validatePointsCost(0)).toMatch(/entre 1 y 1.000.000/);
    expect(validatePointsCost(10.5)).toMatch(/entero/);
    expect(validateRewardValue('credit', 5000)).toBeNull();
    expect(validateRewardValue('credit', 0)).toMatch(/mayor que 0/);
    expect(validateRewardValue('candy', 0)).toBeNull();
    expect(validateRewardValue('other', 12.345)).toMatch(/dos decimales/);
  });
});

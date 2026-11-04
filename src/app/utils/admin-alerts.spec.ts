import { describe, expect, it } from 'vitest';
import {
  MAX_ALERT_BODY,
  MAX_ALERT_TITLE,
  suggestPremiereMessage,
  validateAlertBody,
  validateAlertTitle,
} from './admin-alerts';

describe('admin premiere alerts validation', () => {
  it('accepts titles and messages within the limits', () => {
    expect(validateAlertTitle('¡Se estrena esta semana!')).toBeNull();
    expect(validateAlertBody('Ya podés reservar tus entradas.')).toBeNull();
    expect(validateAlertTitle('a'.repeat(MAX_ALERT_TITLE))).toBeNull();
    expect(validateAlertBody('a'.repeat(MAX_ALERT_BODY))).toBeNull();
  });

  it('rejects empty or too long values', () => {
    expect(validateAlertTitle('   ')).toMatch(/entre 1 y 80/);
    expect(validateAlertTitle('a'.repeat(MAX_ALERT_TITLE + 1))).toMatch(/entre 1 y 80/);
    expect(validateAlertBody('')).toMatch(/entre 1 y 240/);
    expect(validateAlertBody('a'.repeat(MAX_ALERT_BODY + 1))).toMatch(/entre 1 y 240/);
  });

  it('suggests a message based on the movie title', () => {
    expect(suggestPremiereMessage('Duna 3')).toEqual({
      title: '¡Se estrena Duna 3!',
      body: 'Ya podés reservar tus entradas para Duna 3.',
    });
  });
});

export const MAX_ALERT_TITLE = 80;
export const MAX_ALERT_BODY = 240;

export function validateAlertTitle(raw: string): string | null {
  const value = raw.trim();
  if (value.length < 1 || value.length > MAX_ALERT_TITLE) {
    return `El título debe tener entre 1 y ${MAX_ALERT_TITLE} caracteres.`;
  }
  return null;
}

export function validateAlertBody(raw: string): string | null {
  const value = raw.trim();
  if (value.length < 1 || value.length > MAX_ALERT_BODY) {
    return `El mensaje debe tener entre 1 y ${MAX_ALERT_BODY} caracteres.`;
  }
  return null;
}

export function suggestPremiereMessage(movieTitle: string): { title: string; body: string } {
  return {
    title: `¡Se estrena ${movieTitle}!`,
    body: `Ya podés reservar tus entradas para ${movieTitle}.`,
  };
}

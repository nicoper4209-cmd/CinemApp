import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { AdminHome } from './admin-home';

describe('AdminHome', () => {
  it('lists only the administration modules that are still pending', () => {
    const page = new AdminHome();

    expect(page.sections).toEqual(['Reportes y auditoría', 'Avisos de estreno']);
    expect(page.sections).not.toContain('Cupones y premios');
  });
});

import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { AdminHome } from './admin-home';

describe('AdminHome', () => {
  it('lists the planned administration modules without implying they are available yet', () => {
    const page = new AdminHome();

    expect(page.sections).toContain('Reportes y auditoría');
    expect(page.sections).toHaveLength(5);
  });
});

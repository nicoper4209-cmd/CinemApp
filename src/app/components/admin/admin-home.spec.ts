import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { AdminHome } from './admin-home';

describe('AdminHome', () => {
  it('has no pending administration modules left', () => {
    const page = new AdminHome();

    expect(page.pendingModules).toEqual([]);
  });
});

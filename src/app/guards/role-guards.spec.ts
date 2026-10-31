import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth';
import { adminGuard, customerGuard, staffGuard } from './role-guards';

vi.mock('../supabase.client', () => ({ supabase: { auth: {}, from: vi.fn() } }));

describe('role guards', () => {
  const routerMock = { createUrlTree: vi.fn((commands, extras) => ({ commands, extras })) };
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/protected' } as RouterStateSnapshot;

  beforeEach(() => vi.clearAllMocks());

  async function runGuard(guard: typeof customerGuard, role: string | null, anonymous = false) {
    const authMock = {
      getSession: vi.fn().mockResolvedValue({
        user: { id: 'user-1', is_anonymous: anonymous },
      }),
      loadProfile: vi.fn().mockResolvedValue(role ? { role } : null),
    };
    const injector = Injector.create({ providers: [
      { provide: AuthService, useValue: authMock },
      { provide: Router, useValue: routerMock },
    ] });
    return runInInjectionContext(injector, () => guard(route, state));
  }

  it('allows only clients through customerGuard', async () => {
    await expect(runGuard(customerGuard, 'cliente')).resolves.toBe(true);
    await expect(runGuard(customerGuard, 'empleado')).resolves.toEqual({ commands: ['/'], extras: undefined });
  });

  it('allows employees and administrators through staffGuard', async () => {
    await expect(runGuard(staffGuard, 'empleado')).resolves.toBe(true);
    await expect(runGuard(staffGuard, 'admin')).resolves.toBe(true);
    await expect(runGuard(staffGuard, 'cliente')).resolves.toEqual({ commands: ['/'], extras: undefined });
  });

  it('allows only admins through adminGuard and denies anonymous sessions', async () => {
    await expect(runGuard(adminGuard, 'admin')).resolves.toBe(true);
    await expect(runGuard(adminGuard, 'empleado')).resolves.toEqual({ commands: ['/'], extras: undefined });
    await expect(runGuard(adminGuard, 'admin', true)).resolves.toEqual({
      commands: ['/login'],
      extras: { queryParams: { returnUrl: '/protected' } },
    });
  });
});

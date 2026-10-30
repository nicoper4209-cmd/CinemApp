import '@angular/compiler';
import { Injector } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock('../supabase.client', () => ({ supabase: { auth: authMock } }));

import { AuthService } from './auth';

describe('AuthService guest session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an anonymous session when none exists', async () => {
    const session = { user: { id: 'guest', is_anonymous: true } };
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMock.signInAnonymously.mockResolvedValue({ data: { session }, error: null });

    const service = Injector.create({ providers: [AuthService] }).get(AuthService);
    await expect(service.continueAsGuest()).resolves.toBe(session);
    expect(authMock.signInAnonymously).toHaveBeenCalledOnce();
  });

  it('reuses an existing session instead of creating another anonymous account', async () => {
    const session = { user: { id: 'existing', is_anonymous: false } };
    authMock.getSession.mockResolvedValue({ data: { session }, error: null });

    const service = Injector.create({ providers: [AuthService] }).get(AuthService);
    await expect(service.continueAsGuest()).resolves.toBe(session);
    expect(authMock.signInAnonymously).not.toHaveBeenCalled();
  });

  it('propagates failure to create a guest session', async () => {
    const error = new Error('Anonymous sign-ins are disabled');
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMock.signInAnonymously.mockResolvedValue({ data: { session: null }, error });

    const service = Injector.create({ providers: [AuthService] }).get(AuthService);
    await expect(service.continueAsGuest()).rejects.toBe(error);
  });
});

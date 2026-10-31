import '@angular/compiler';
import { Injector } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signUp: vi.fn(),
}));
const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../supabase.client', () => ({ supabase: { auth: authMock, from: supabaseMock.from } }));

import { AuthService } from './auth';

describe('AuthService guest session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function profileQuery(result: unknown) {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'update']) builder[method] = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    builder.single = vi.fn(() => Promise.resolve(result));
    return builder;
  }

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

  it('starts OAuth with the selected provider and application callback URL', async () => {
    authMock.signInWithOAuth.mockResolvedValue({ data: { provider: 'google' }, error: null });
    const service = Injector.create({ providers: [AuthService] }).get(AuthService);

    await service.signInWithProvider('google', 'https://cinema.example/account');

    expect(authMock.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://cinema.example/account' },
    });
  });

  it('saves birth date in signup metadata for profile creation', async () => {
    authMock.signUp.mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
    const service = Injector.create({ providers: [AuthService] }).get(AuthService);

    await service.signUp('new@example.com', 'password123', '2000-04-15');

    expect(authMock.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: { data: { birth_date: '2000-04-15' } },
    });
  });

  it('loads the authoritative profile including role from profiles', async () => {
    const profile = {
      id: 'registered-user', email: 'user@example.com', full_name: 'Cine User',
      birth_date: null, avatar_url: null, role: 'empleado',
    };
    supabaseMock.from.mockReturnValue(profileQuery({ data: profile, error: null }));
    const service = Injector.create({ providers: [AuthService] }).get(AuthService);
    service.user.set({ id: 'registered-user', is_anonymous: false } as never);

    await expect(service.loadProfile()).resolves.toEqual(profile);
    expect(supabaseMock.from).toHaveBeenCalledWith('profiles');
    expect(service.profile()?.role).toBe('empleado');
  });

  it('updates only the current user’s editable fields, never the role', async () => {
    const profile = {
      id: 'registered-user', email: 'user@example.com', full_name: 'New Name',
      birth_date: '1990-01-01', avatar_url: null, role: 'admin',
    };
    const builder = profileQuery({ data: profile, error: null });
    supabaseMock.from.mockReturnValue(builder);
    const service = Injector.create({ providers: [AuthService] }).get(AuthService);
    service.user.set({ id: 'registered-user', is_anonymous: false } as never);

    await service.updateProfile({ full_name: 'New Name', birth_date: '1990-01-01' });

    expect(builder.update).toHaveBeenCalledWith({ full_name: 'New Name', birth_date: '1990-01-01' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'registered-user');
    expect(service.profile()?.role).toBe('admin');
  });
});

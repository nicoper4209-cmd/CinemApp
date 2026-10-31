import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../supabase.client', () => ({ supabase: supabaseMock }));

import { persistPushSubscription } from './notifications';

describe('push subscription persistence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stores only this user’s endpoint and encryption keys with an endpoint upsert', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    supabaseMock.from.mockReturnValue({ upsert });
    const subscription = {
      endpoint: 'https://push.example/subscription/1',
      toJSON: () => ({ keys: { p256dh: 'public-key', auth: 'auth-secret' } }),
    } as unknown as PushSubscription;

    await persistPushSubscription('user-123', subscription, 'Test browser');

    expect(supabaseMock.from).toHaveBeenCalledWith('push_subscriptions');
    expect(upsert).toHaveBeenCalledWith({
      user_id: 'user-123',
      endpoint: 'https://push.example/subscription/1',
      p256dh: 'public-key',
      auth: 'auth-secret',
      user_agent: 'Test browser',
    }, { onConflict: 'endpoint' });
  });

  it('surfaces RLS/database errors and rejects incomplete browser subscriptions', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'No autorizado' } });
    supabaseMock.from.mockReturnValue({ upsert });
    const subscription = {
      endpoint: 'https://push.example/subscription/1',
      toJSON: () => ({ keys: { p256dh: 'public-key' } }),
    } as unknown as PushSubscription;

    await expect(persistPushSubscription('user-123', subscription, 'Test browser'))
      .rejects.toThrow('El navegador no generó las claves necesarias para la suscripción.');
    subscription.toJSON = () => ({ keys: { p256dh: 'public-key', auth: 'auth-secret' } });
    await expect(persistPushSubscription('user-123', subscription, 'Test browser'))
      .rejects.toThrow('No autorizado');
  });
});

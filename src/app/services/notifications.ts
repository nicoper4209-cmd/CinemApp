import { Injectable, signal } from '@angular/core';
import { AuthService } from './auth';
import { supabase } from '../supabase.client';
import { environments } from '../environments/environments';

export async function persistPushSubscription(
  userId: string,
  subscription: PushSubscription,
  userAgent = navigator.userAgent,
): Promise<void> {
  const serialized = subscription.toJSON();
  const p256dh = serialized.keys?.['p256dh'];
  const auth = serialized.keys?.['auth'];
  if (!p256dh || !auth) throw new Error('El navegador no generó las claves necesarias para la suscripción.');

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh,
    auth,
    user_agent: userAgent,
  }, { onConflict: 'endpoint' });
  if (error) throw new Error(error.message);
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  supported = signal(false);
  permission = signal<NotificationPermission | 'unsupported'>('unsupported');
  enabled = signal(false);
  loading = signal(false);
  errorMessage = signal('');
  statusMessage = signal('');

  constructor(private auth: AuthService) {
    this.supported.set(
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
    if (this.supported()) void this.refreshState();
  }

  get vapidConfigured(): boolean {
    return environments.vapidPublicKey.trim().length > 0;
  }

  async refreshState(): Promise<void> {
    if (!this.supported()) return;
    this.permission.set(Notification.permission);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      this.enabled.set(!!subscription);
    } catch {
      this.enabled.set(false);
    }
  }

  async enable(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set('');
    this.statusMessage.set('');
    try {
      if (!this.supported()) throw new Error('Este navegador no admite notificaciones push.');
      if (!this.vapidConfigured) {
        throw new Error('Las notificaciones todavía no están configuradas: falta la clave pública VAPID.');
      }
      const user = this.auth.user();
      if (!user || user.is_anonymous) throw new Error('Iniciá sesión con una cuenta registrada.');

      const permission = await Notification.requestPermission();
      this.permission.set(permission);
      if (permission !== 'granted') {
        throw new Error(permission === 'denied'
          ? 'El permiso está bloqueado en el navegador. Habilitalo desde la configuración del sitio.'
          : 'Necesitamos tu permiso para enviarte notificaciones.');
      }

      const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ??
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.decodeApplicationServerKey(environments.vapidPublicKey),
        });
      await persistPushSubscription(user.id, subscription);
      this.enabled.set(true);
      this.statusMessage.set('Notificaciones activadas para este dispositivo.');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudieron activar las notificaciones.');
    } finally {
      this.loading.set(false);
    }
  }

  async disable(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set('');
    this.statusMessage.set('');
    try {
      const user = this.auth.user();
      if (!user || user.is_anonymous) throw new Error('Iniciá sesión con una cuenta registrada.');
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
        if (error) throw new Error(error.message);
        await subscription.unsubscribe();
      }
      this.enabled.set(false);
      this.statusMessage.set('Notificaciones desactivadas en este dispositivo.');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudieron desactivar las notificaciones.');
    } finally {
      this.loading.set(false);
    }
  }

  private decodeApplicationServerKey(value: string): Uint8Array<ArrayBuffer> {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
    return bytes;
  }
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

interface QueuedNotification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  send_at: string;
  booking_id: string | null;
}

interface PushSubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

function appPath(notification: QueuedNotification): string {
  const movieId = notification.payload?.['movie_id'];
  if (typeof movieId === 'number' && Number.isSafeInteger(movieId) && movieId > 0) {
    return `/movies/${movieId}`;
  }
  if (notification.booking_id) return '/my-movies';
  return '/account';
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return jsonResponse({ error: 'Falta configurar Supabase o las claves VAPID' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const { data: notifications, error: queueError } = await admin
    .from('notification_queue')
    .select('id,user_id,type,title,body,payload,send_at,booking_id')
    .is('sent_at', null)
    .lte('send_at', new Date().toISOString())
    .order('send_at', { ascending: true });
  if (queueError) {
    console.error('No se pudo leer notification_queue:', queueError.message);
    return jsonResponse({ error: 'No se pudo leer la cola de notificaciones' }, 500);
  }

  const stats = { processed: 0, sent: 0, retried: 0, removedSubscriptions: 0 };
  for (const notification of (notifications ?? []) as QueuedNotification[]) {
    stats.processed++;
    const { data: subscriptions, error: subscriptionsError } = await admin
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .eq('user_id', notification.user_id);
    if (subscriptionsError) {
      console.error(`No se pudieron leer suscripciones ${notification.id}:`, subscriptionsError.message);
      stats.retried++;
      continue;
    }

    let hasTransientFailure = false;
    for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, JSON.stringify({
          notification: {
            title: notification.title,
            body: notification.body,
            data: {
              type: notification.type,
              onActionClick: {
                default: { operation: 'openWindow', url: appPath(notification) },
              },
            },
          },
        }), { TTL: 3600 });
      } catch (error) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await admin
            .from('push_subscriptions')
            .delete()
            .eq('id', subscription.id);
          if (deleteError) console.error('No se pudo eliminar una suscripción vencida:', deleteError.message);
          else stats.removedSubscriptions++;
        } else {
          hasTransientFailure = true;
          console.error(`Falló el envío ${notification.id}:`, error);
        }
      }
    }

    // Sin dispositivos suscriptos no queda un envío posible: se consume el aviso.
    if (hasTransientFailure) {
      stats.retried++;
      continue;
    }

    const { error: sentError } = await admin
      .from('notification_queue')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', notification.id)
      .is('sent_at', null);
    if (sentError) {
      stats.retried++;
      console.error(`No se pudo marcar como enviada ${notification.id}:`, sentError.message);
    } else {
      stats.sent++;
    }
  }

  return jsonResponse(stats);
});

-- =====================================================================
-- CINE · Endurecimiento de seguridad (ejecutar DESPUÉS de 20261029_cine_schema.sql)
-- 1) Elimina políticas RLS viejas que no pertenecen al esquema actual
-- 2) Quita permisos de escritura directa sobre tablas que solo se escriben por RPC
-- =====================================================================
begin;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and policyname not in (
        'app_settings_read','app_settings_admin','rooms_read','rooms_admin','formats_read','formats_admin',
        'pricing_config_read','pricing_config_admin','movies_read','movies_admin','showtimes_read','showtimes_admin',
        'candy_categories_read','candy_categories_admin','candy_products_read','candy_products_admin',
        'rewards_read','rewards_admin','coupons_admin','profiles_select','profiles_update',
        'favorites_own','movie_alerts_own','reviews_read','reviews_insert','reviews_update','reviews_delete',
        'points_ledger_read','credit_ledger_read','reward_redemptions_read','coupon_redemptions_read',
        'bookings_read','booking_seats_read','booking_candy_items_read','seat_occupancy_read','seat_holds_read',
        'push_subscriptions_own','notification_queue_read','audit_log_read')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Tablas que solo se escriben vía RPC (security definer)
revoke insert, update, delete, truncate on
  public.bookings, public.booking_seats, public.booking_candy_items, public.points_ledger,
  public.credit_ledger, public.coupon_redemptions, public.reward_redemptions,
  public.seat_holds, public.seat_occupancy, public.notification_queue
from anon, authenticated;

-- El rol anon nunca escribe; nadie hace truncate desde la API
revoke insert, update, delete on all tables in schema public from anon;
revoke truncate on all tables in schema public from anon, authenticated;

commit;

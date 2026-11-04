-- Permisos para los reportes y la auditoría (RF-18, RF-19).
-- Las funciones validan public.is_admin() y la política de audit_log limita la lectura.
grant select on table public.audit_log to authenticated;
grant execute on function public.daily_billing_report(date) to authenticated;
grant execute on function public.movie_sales_report(date, date, integer[]) to authenticated;

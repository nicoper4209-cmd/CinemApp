-- Permisos de tabla para la administración de cupones y premios.
-- Las políticas RLS ya limitan la escritura de cupones a administradores.
grant select, insert, update on table public.coupons, public.rewards to authenticated;
grant usage, select on sequence public.coupons_id_seq, public.rewards_id_seq to authenticated;

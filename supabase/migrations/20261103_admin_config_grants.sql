-- Permisos de tabla para la administración de configuración (RNF-08).
-- Las políticas RLS ya limitan la escritura a administradores; faltaban los grants.
grant select on table public.rooms, public.formats, public.pricing_config, public.app_settings to anon;
grant select, insert, update on table public.rooms, public.formats, public.pricing_config to authenticated;
grant select, update on table public.app_settings to authenticated;
grant usage, select on sequence public.formats_id_seq to authenticated;

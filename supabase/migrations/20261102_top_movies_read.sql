-- La cartelera pública consulta el ranking de ventas mediante esta vista.
grant select on table public.top_movies_30d to anon, authenticated;

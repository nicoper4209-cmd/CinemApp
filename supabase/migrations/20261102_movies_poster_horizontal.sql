-- Imagen horizontal opcional para usos alternativos en las pantallas.
alter table public.movies
  add column if not exists poster_horizontal text;

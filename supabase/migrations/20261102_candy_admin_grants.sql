-- Table privileges are required in addition to the existing admin-only RLS policies.
grant select on table public.candy_categories, public.candy_products to anon;
grant select, insert, update on table public.candy_categories, public.candy_products to authenticated;
grant usage, select on sequence public.candy_categories_id_seq, public.candy_products_id_seq to authenticated;

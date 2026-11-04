-- La RPC valida public.is_admin(); se habilita su ejecución para sesiones autenticadas.
grant execute on function public.send_premiere_alerts(integer, text, text) to authenticated;

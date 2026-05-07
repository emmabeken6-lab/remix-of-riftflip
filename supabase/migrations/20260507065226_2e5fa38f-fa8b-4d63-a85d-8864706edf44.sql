
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.apply_transaction(uuid, numeric, public.tx_reason, uuid, jsonb) from public, anon, authenticated;


REVOKE EXECUTE ON FUNCTION public.is_premium(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_premium(uuid) TO service_role;

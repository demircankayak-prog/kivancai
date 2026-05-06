
CREATE TABLE IF NOT EXISTS public.gift_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  plan text NOT NULL DEFAULT 'gift_full',
  expires_at timestamptz NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gift_grants_email_idx ON public.gift_grants(lower(email));

ALTER TABLE public.gift_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own gifts" ON public.gift_grants
  FOR SELECT USING (
    lower(email) = lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), ''))
    OR lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()),'')) = lower(coalesce(current_setting('app.owner_email', true), ''))
  );

CREATE OR REPLACE FUNCTION public.is_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id
      AND lower(u.email) = lower(coalesce(current_setting('app.owner_email', true), ''))
  )
  OR EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = _user_id AND s.status = 'active' AND s.current_period_end > now()
  )
  OR EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.gift_grants g ON lower(g.email) = lower(u.email)
    WHERE u.id = _user_id AND g.expires_at > now()
  );
$$;

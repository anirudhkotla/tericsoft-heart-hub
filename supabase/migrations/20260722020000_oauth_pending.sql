-- Server-side OAuth 2.1 + PKCE + DCR state, used only by the oauth-connect
-- edge function (service_role). Nothing here is ever readable by a client —
-- the whole point is to move the token exchange off the browser, since
-- Airtable's OAuth endpoints send no CORS headers at all.
CREATE TABLE public.oauth_pending (
  state text NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  ds_name text NOT NULL,
  server_url text NOT NULL,
  code_verifier text NOT NULL,
  token_endpoint text NOT NULL,
  client_id text NOT NULL,
  client_secret text,
  token_endpoint_auth_method text NOT NULL DEFAULT 'none',
  redirect_uri text NOT NULL,
  resource text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- service_role only; no client access at all.
GRANT ALL ON public.oauth_pending TO service_role;
ALTER TABLE public.oauth_pending ENABLE ROW LEVEL SECURITY;

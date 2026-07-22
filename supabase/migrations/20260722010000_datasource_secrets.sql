-- ============ DATASOURCES: provider column + owner-only visibility ============
ALTER TABLE public.datasources
  ADD COLUMN provider text NOT NULL DEFAULT 'custom'
    CHECK (provider IN ('airtable', 'notion', 'roam', 'custom'));

UPDATE public.datasources
SET provider = CASE
  WHEN config->>'serverUrl' ILIKE '%airtable%' THEN 'airtable'
  WHEN config->>'serverUrl' ILIKE '%notion%' THEN 'notion'
  ELSE 'custom'
END;

DROP POLICY IF EXISTS "Authenticated can view datasources" ON public.datasources;
CREATE POLICY "Owners and admins can view datasources"
  ON public.datasources FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- ============ DATASOURCE SECRETS (tokens/headers — never selectable by clients) ============
CREATE TABLE public.datasource_secrets (
  datasource_id uuid NOT NULL PRIMARY KEY REFERENCES public.datasources(id) ON DELETE CASCADE,
  secret jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT, UPDATE ON public.datasource_secrets TO authenticated;
GRANT ALL ON public.datasource_secrets TO service_role;
ALTER TABLE public.datasource_secrets ENABLE ROW LEVEL SECURITY;

-- No SELECT policy for `authenticated` at all: write-only from the client.
-- Only service_role (edge functions) can ever read secrets back.
CREATE POLICY "Owners can insert their datasource secret"
  ON public.datasource_secrets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.datasources d
      WHERE d.id = datasource_id AND d.created_by = auth.uid()
    )
  );
CREATE POLICY "Owners can update their datasource secret"
  ON public.datasource_secrets FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.datasources d
      WHERE d.id = datasource_id AND d.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.datasources d
      WHERE d.id = datasource_id AND d.created_by = auth.uid()
    )
  );

CREATE TRIGGER trg_datasource_secrets_updated
  BEFORE UPDATE ON public.datasource_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing plaintext tokens/headers out of datasources.config
INSERT INTO public.datasource_secrets (datasource_id, secret)
SELECT id, jsonb_build_object('authToken', config->'authToken', 'headers', config->'headers')
FROM public.datasources
WHERE config ? 'authToken' OR config ? 'headers'
ON CONFLICT (datasource_id) DO NOTHING;

UPDATE public.datasources
SET config = config - 'authToken' - 'headers';

-- ============ MCP TOOL SCHEMA CACHE (server-side only) ============
CREATE TABLE public.datasource_tool_cache (
  datasource_id uuid NOT NULL PRIMARY KEY REFERENCES public.datasources(id) ON DELETE CASCADE,
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  cached_at timestamptz NOT NULL DEFAULT now()
);

-- service_role only; no grants to authenticated/anon.
GRANT ALL ON public.datasource_tool_cache TO service_role;
ALTER TABLE public.datasource_tool_cache ENABLE ROW LEVEL SECURITY;

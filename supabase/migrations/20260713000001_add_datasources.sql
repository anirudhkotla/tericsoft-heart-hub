-- ============ DATASOURCES (MCP / external) ============
CREATE TABLE public.datasources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'mcp' CHECK (type IN ('mcp', 'rest')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasources TO authenticated;
GRANT ALL ON public.datasources TO service_role;
ALTER TABLE public.datasources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view datasources" ON public.datasources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create datasources" ON public.datasources FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Creators can update datasources" ON public.datasources FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin')) WITH CHECK (true);
CREATE POLICY "Creators can delete datasources" ON public.datasources FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_datasources_updated BEFORE UPDATE ON public.datasources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DASHBOARDS — add datasource references to config ============
-- (config already stores the full widget array in JSONB; no schema change needed)

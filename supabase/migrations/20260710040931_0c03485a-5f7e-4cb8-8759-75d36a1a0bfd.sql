CREATE TABLE public.offer_letters (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_request_id uuid REFERENCES public.job_requests(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_letters TO authenticated;
GRANT ALL ON public.offer_letters TO service_role;

ALTER TABLE public.offer_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view offer letters"
  ON public.offer_letters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create offer letters"
  ON public.offer_letters FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated can update offer letters"
  ON public.offer_letters FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Creators can delete offer letters"
  ON public.offer_letters FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER update_offer_letters_updated_at
  BEFORE UPDATE ON public.offer_letters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
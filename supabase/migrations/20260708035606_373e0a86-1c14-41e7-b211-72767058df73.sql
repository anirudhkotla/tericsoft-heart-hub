
-- ============ RECRUITMENT ============
CREATE TABLE public.job_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  department text,
  location text,
  employment_type text NOT NULL DEFAULT 'full_time',
  openings integer NOT NULL DEFAULT 1,
  description text,
  status text NOT NULL DEFAULT 'open',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_requests TO authenticated;
GRANT ALL ON public.job_requests TO service_role;
ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view job requests" ON public.job_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create job requests" ON public.job_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated can update job requests" ON public.job_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Creators or admins can delete job requests" ON public.job_requests FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_request_id uuid NOT NULL REFERENCES public.job_requests(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  stage text NOT NULL DEFAULT 'applied',
  rating integer,
  notes text,
  cv_summary text,
  source text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view candidates" ON public.candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create candidates" ON public.candidates FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated can update candidates" ON public.candidates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete candidates" ON public.candidates FOR DELETE TO authenticated USING (true);

-- ============ EXPENSES ============
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  spent_on date NOT NULL DEFAULT current_date,
  vendor text,
  notes text,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending',
  submitted_by uuid NOT NULL DEFAULT auth.uid(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "Submitters or approvers can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (auth.uid() = submitted_by OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'team_lead')) WITH CHECK (true);
CREATE POLICY "Submitters or admins can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (auth.uid() = submitted_by OR public.has_role(auth.uid(),'admin'));

-- ============ CALENDAR ============
CREATE TABLE public.calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  location text,
  event_type text NOT NULL DEFAULT 'meeting',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view events" ON public.calendar_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create events" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update events" ON public.calendar_events FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin')) WITH CHECK (true);
CREATE POLICY "Creators can delete events" ON public.calendar_events FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));

-- ============ DASHBOARDS ============
CREATE TABLE public.dashboards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{"widgets":[]}'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboards TO authenticated;
GRANT ALL ON public.dashboards TO service_role;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view dashboards" ON public.dashboards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create dashboards" ON public.dashboards FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update dashboards" ON public.dashboards FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin')) WITH CHECK (true);
CREATE POLICY "Creators can delete dashboards" ON public.dashboards FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));

-- ============ updated_at triggers ============
CREATE TRIGGER trg_job_requests_updated BEFORE UPDATE ON public.job_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_candidates_updated BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_calendar_events_updated BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dashboards_updated BEFORE UPDATE ON public.dashboards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ProjectOps360 — AI referral -> signup -> paid attribution
-- Captures first/last acquisition touch at signup and links it to the
-- organization subscription so AI-attributed paid MRR can be measured.

CREATE TABLE IF NOT EXISTS public.acquisition_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,

  first_source_class text NOT NULL DEFAULT 'direct'
    CHECK (first_source_class IN ('ai','search','social','referral','campaign','direct','other')),
  first_ai_engine text
    CHECK (first_ai_engine IS NULL OR first_ai_engine IN ('chatgpt','gemini','claude','perplexity','copilot')),
  first_source text,
  first_medium text,
  first_campaign text,
  first_content text,
  first_term text,
  first_referrer_host text,
  first_landing_path text,
  first_touch_at timestamptz,

  last_source_class text NOT NULL DEFAULT 'direct'
    CHECK (last_source_class IN ('ai','search','social','referral','campaign','direct','other')),
  last_ai_engine text
    CHECK (last_ai_engine IS NULL OR last_ai_engine IN ('chatgpt','gemini','claude','perplexity','copilot')),
  last_source text,
  last_medium text,
  last_campaign text,
  last_content text,
  last_term text,
  last_referrer_host text,
  last_landing_path text,
  last_touch_at timestamptz,

  signed_up_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acquisition_attribution_org
  ON public.acquisition_attribution (organization_id);
CREATE INDEX IF NOT EXISTS idx_acquisition_attribution_ai
  ON public.acquisition_attribution (first_ai_engine, signed_up_at DESC)
  WHERE first_ai_engine IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.acquisition_attribution;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.acquisition_attribution
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.acquisition_attribution ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own acquisition attribution" ON public.acquisition_attribution;
CREATE POLICY "Users read own acquisition attribution"
  ON public.acquisition_attribution FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Service role manages acquisition attribution" ON public.acquisition_attribution;
CREATE POLICY "Service role manages acquisition attribution"
  ON public.acquisition_attribution FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Revenue read-model. "paid_attributed_mrr" is intentionally conservative:
-- an active priced plan counts as verified revenue only when a billing provider
-- subscription id exists. This prevents internal/backfilled active plans from
-- being mislabeled as cash revenue.
CREATE OR REPLACE VIEW public.ai_revenue_attribution
WITH (security_invoker = true)
AS
SELECT
  a.id AS attribution_id,
  a.user_id,
  a.organization_id,
  a.signed_up_at,
  a.first_source_class,
  a.first_ai_engine,
  a.first_source,
  a.first_medium,
  a.first_campaign,
  a.first_referrer_host,
  a.first_landing_path,
  a.last_source_class,
  a.last_ai_engine,
  s.id AS subscription_id,
  s.status AS subscription_status,
  s.billing_provider,
  s.billing_provider_subscription_id,
  s.billing_cycle,
  p.plan_code,
  p.name AS plan_name,
  p.currency,
  CASE
    WHEN s.status = 'active'
      AND s.billing_provider_subscription_id IS NOT NULL
      AND COALESCE(p.price_monthly, 0) > 0
    THEN CASE
      WHEN s.billing_cycle = 'yearly' THEN COALESCE(p.price_yearly, 0) / 12.0
      ELSE COALESCE(p.price_monthly, 0)
    END
    ELSE 0
  END AS paid_attributed_mrr,
  CASE
    WHEN s.status = 'active' AND s.billing_provider_subscription_id IS NOT NULL THEN true
    ELSE false
  END AS is_verified_paid
FROM public.acquisition_attribution a
LEFT JOIN public.subscriptions s ON s.organization_id = a.organization_id
LEFT JOIN public.plans p ON p.id = s.plan_id;

COMMENT ON TABLE public.acquisition_attribution IS
  'First/last acquisition touch captured at signup for referral and AI revenue attribution.';
COMMENT ON VIEW public.ai_revenue_attribution IS
  'Signup-to-subscription attribution read-model; verified paid MRR requires an active provider-backed subscription.';

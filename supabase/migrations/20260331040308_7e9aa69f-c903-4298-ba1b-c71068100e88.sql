
-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. Chat scenario categories (1 Depth - main card banners)
CREATE TABLE public.chat_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Scenario nodes (N-Depth tree structure)
CREATE TABLE public.scenario_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.chat_categories(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.scenario_nodes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  message TEXT,
  answer_html TEXT,
  keywords TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. FAQ keywords (hashtag keywords)
CREATE TABLE public.faq_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  answer_html TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Brand tenants
CREATE TABLE public.brand_tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  brand_name_en TEXT NOT NULL,
  category TEXT NOT NULL,
  tenant_code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_tenants ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Anyone can read categories" ON public.chat_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can read nodes" ON public.scenario_nodes FOR SELECT USING (true);
CREATE POLICY "Anyone can read faq" ON public.faq_keywords FOR SELECT USING (true);
CREATE POLICY "Anyone can read brands" ON public.brand_tenants FOR SELECT USING (true);

-- Admin write policies
CREATE POLICY "Admin insert categories" ON public.chat_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update categories" ON public.chat_categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete categories" ON public.chat_categories FOR DELETE TO authenticated USING (true);

CREATE POLICY "Admin insert nodes" ON public.scenario_nodes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update nodes" ON public.scenario_nodes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete nodes" ON public.scenario_nodes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Admin insert faq" ON public.faq_keywords FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update faq" ON public.faq_keywords FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete faq" ON public.faq_keywords FOR DELETE TO authenticated USING (true);

CREATE POLICY "Admin insert brands" ON public.brand_tenants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update brands" ON public.brand_tenants FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete brands" ON public.brand_tenants FOR DELETE TO authenticated USING (true);

-- Triggers
CREATE TRIGGER update_chat_categories_updated_at BEFORE UPDATE ON public.chat_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scenario_nodes_updated_at BEFORE UPDATE ON public.scenario_nodes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_faq_keywords_updated_at BEFORE UPDATE ON public.faq_keywords FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_brand_tenants_updated_at BEFORE UPDATE ON public.brand_tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_scenario_nodes_category ON public.scenario_nodes(category_id);
CREATE INDEX idx_scenario_nodes_parent ON public.scenario_nodes(parent_id);
CREATE INDEX idx_brand_tenants_store ON public.brand_tenants(store_name);
CREATE INDEX idx_brand_tenants_brand ON public.brand_tenants(brand_name);
CREATE INDEX idx_brand_tenants_brand_en ON public.brand_tenants(brand_name_en);

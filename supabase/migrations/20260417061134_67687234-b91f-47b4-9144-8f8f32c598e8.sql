-- 1. Add language column to chat_categories
ALTER TABLE public.chat_categories
ADD COLUMN language text NOT NULL DEFAULT 'ko';

-- 2. Add language column to scenario_nodes
ALTER TABLE public.scenario_nodes
ADD COLUMN language text NOT NULL DEFAULT 'ko';

-- 3. Add language column to faq_keywords
ALTER TABLE public.faq_keywords
ADD COLUMN language text NOT NULL DEFAULT 'ko';

-- 4. Add language column to site_settings (key 단독 unique 해제 후 (key,language) unique)
ALTER TABLE public.site_settings
ADD COLUMN language text NOT NULL DEFAULT 'ko';

-- Drop existing unique constraint on key if exists, then add composite unique
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'site_settings_key_key'
  ) THEN
    ALTER TABLE public.site_settings DROP CONSTRAINT site_settings_key_key;
  END IF;
END $$;

ALTER TABLE public.site_settings
ADD CONSTRAINT site_settings_key_language_unique UNIQUE (key, language);

-- 5. Add multilingual brand name columns to brand_tenants
ALTER TABLE public.brand_tenants
ADD COLUMN brand_name_zh text,
ADD COLUMN brand_name_ja text;

-- 6. Add CHECK constraints for valid language codes
ALTER TABLE public.chat_categories
ADD CONSTRAINT chat_categories_language_check CHECK (language IN ('ko','en','zh','ja'));

ALTER TABLE public.scenario_nodes
ADD CONSTRAINT scenario_nodes_language_check CHECK (language IN ('ko','en','zh','ja'));

ALTER TABLE public.faq_keywords
ADD CONSTRAINT faq_keywords_language_check CHECK (language IN ('ko','en','zh','ja'));

ALTER TABLE public.site_settings
ADD CONSTRAINT site_settings_language_check CHECK (language IN ('ko','en','zh','ja'));

-- 7. Add indexes for language filtering performance
CREATE INDEX idx_chat_categories_language ON public.chat_categories(language);
CREATE INDEX idx_scenario_nodes_language ON public.scenario_nodes(language);
CREATE INDEX idx_faq_keywords_language ON public.faq_keywords(language);
CREATE INDEX idx_site_settings_language ON public.site_settings(language);
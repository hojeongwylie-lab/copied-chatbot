-- Add customer service phone setting (per language)
INSERT INTO public.site_settings (key, value, language) VALUES
  ('customer_service_phone', '', 'ko'),
  ('customer_service_phone', '', 'en'),
  ('customer_service_phone', '', 'zh'),
  ('customer_service_phone', '', 'ja')
ON CONFLICT (key, language) DO NOTHING;

-- Remove obsolete AI router toggle (always ON now)
DELETE FROM public.site_settings WHERE key = 'ai_router_enabled';
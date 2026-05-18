INSERT INTO public.site_settings (key, value, language) VALUES
  ('ai_router_enabled', 'false', 'ko'),
  ('ai_model', 'google/gemini-3-flash-preview', 'ko')
ON CONFLICT DO NOTHING;
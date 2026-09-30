-- Required booking notices are visible to editors without presenting unapproved
-- sample legal text to customers.  Public RLS hides them until a translation is
-- reviewed and published for the requested language.
insert into public.content_items (slug, kind, criticality, source_locale, sort_order)
values
  ('bag-size-rules', 'legal', 'critical', 'ko', 10),
  ('prohibited-items', 'legal', 'critical', 'ko', 20)
on conflict (slug) do nothing;

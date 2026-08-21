-- Autorise une analyse pédagogique sans note quand l'IA ne dispose pas
-- d'un énoncé, d'un barème ou d'une copie suffisamment lisible.
alter table public.ai_analyses
  alter column score drop not null;

begin;

insert into public.subjects (id, name, slug)
select gen_random_uuid(), 'Mathematiques', 'mathematiques'
where not exists (
  select 1 from public.subjects where slug = 'mathematiques'
);

insert into public.learning_areas (id, subject_id, name, slug, order_index)
select gen_random_uuid(), s.id, area_name, area_slug, area_order
from public.subjects s
cross join (
  values
    ('Guide 1 - Calcul numerique', 'guide1-calcul-numerique', 1),
    ('Guide 1 - Calcul litteral', 'guide1-calcul-litteral', 2),
    ('Guide 1 - Equations et proportionnalite', 'guide1-algebre', 3),
    ('Guide 1 - Geometrie', 'guide1-geometrie', 4),
    ('Guide 1 - Statistiques et espace', 'guide1-donnees-espace', 5)
) as areas(area_name, area_slug, area_order)
where s.slug = 'mathematiques'
  and not exists (
    select 1 from public.learning_areas where slug = area_slug
  );

insert into public.topics (id, area_id, name, slug, order_index)
select gen_random_uuid(), a.id, topic_name, topic_slug, topic_order
from public.learning_areas a
join (
  values
    ('guide1-calcul-numerique', 'Regles de signes', 'relatifs_signes', 1),
    ('guide1-calcul-numerique', 'Priorites operatoires', 'priorites_operatoires', 2),
    ('guide1-calcul-numerique', 'Fractions', 'fractions', 3),
    ('guide1-calcul-numerique', 'Puissances', 'puissances', 4),
    ('guide1-calcul-litteral', 'Calcul litteral - reduction', 'calcul_litteral_reduction', 1),
    ('guide1-calcul-litteral', 'Developpement', 'developpement', 2),
    ('guide1-calcul-litteral', 'Identites remarquables', 'identites_remarquables', 3),
    ('guide1-calcul-litteral', 'Factorisation - facteur commun', 'factorisation_facteur_commun', 4),
    ('guide1-calcul-litteral', 'Factorisation - identites remarquables', 'factorisation_identites', 5),
    ('guide1-algebre', 'Equations', 'equations', 1),
    ('guide1-algebre', 'Inequations', 'inequations', 2),
    ('guide1-algebre', 'Proportionnalite', 'proportionnalite', 3),
    ('guide1-algebre', 'Pourcentages', 'pourcentages', 4),
    ('guide1-geometrie', 'Pythagore', 'pythagore', 1),
    ('guide1-geometrie', 'Reciproque de Pythagore', 'pythagore_reciproque', 2),
    ('guide1-geometrie', 'Geometrie des milieux', 'geometrie_milieux', 3),
    ('guide1-geometrie', 'Coordonnees du milieu', 'coordonnees_milieu', 4),
    ('guide1-geometrie', 'Vecteurs et Chasles', 'vecteurs_chasles', 5),
    ('guide1-donnees-espace', 'Statistiques - moyenne', 'statistiques_moyenne', 1),
    ('guide1-donnees-espace', 'Statistiques - frequence', 'statistiques_frequence', 2),
    ('guide1-donnees-espace', 'Grandeurs et espace', 'grandeurs_espace', 3)
) as topics(area_slug, topic_name, topic_slug, topic_order)
  on a.slug = topics.area_slug
where not exists (
  select 1 from public.topics existing where existing.slug = topic_slug
);

update public.learning_program_days d
set
  day_kind = case when mapping.day_number = 14 then 'final_test' else 'lesson' end,
  title = mapping.title,
  objective = mapping.objective,
  metadata = coalesce(d.metadata, '{}'::jsonb) || jsonb_build_object(
    'guide_label', 'Guide 1 - Diagnostic & Revision',
    'page_reference', mapping.page_reference,
    'topic_slugs', mapping.topic_slugs,
    'official_source', 'Guide 1 V2 - Diagnostic & Passerelle vers la 3e'
  ),
  updated_at = now()
from (
  values
    (1, 'Calcul numerique : relatifs, signes et priorites', 'Mission : calculer sans erreur de signe et respecter les priorites.', 'Pages 4-5', '["relatifs_signes","priorites_operatoires"]'::jsonb),
    (2, 'Fractions et nombres rationnels', 'Mission : maitriser les quatre operations et les calculs enchaines.', 'Pages 6-7', '["fractions"]'::jsonb),
    (3, 'Puissances et calculs numeriques', 'Mission : utiliser correctement les regles sur les puissances.', 'Pages 8-9', '["puissances"]'::jsonb),
    (4, 'Calcul litteral : reduire et transformer', 'Mission : reduire, ordonner et calculer une valeur numerique.', 'Pages 10-11', '["calcul_litteral_reduction"]'::jsonb),
    (5, 'Developpement et identites remarquables', 'Mission : developper des produits et utiliser les trois identites remarquables.', 'Pages 12-13', '["developpement","identites_remarquables"]'::jsonb),
    (6, 'Factorisation : facteur commun et identites remarquables', 'Mission : choisir et combiner les methodes de factorisation de 4e.', 'Pages 14-15', '["factorisation_facteur_commun","factorisation_identites"]'::jsonb),
    (7, 'Equations, inequations et problemes', 'Mission : resoudre et traduire des problemes en relations algebriques.', 'Pages 16-17', '["equations","inequations"]'::jsonb),
    (8, 'Proportionnalite, rapports et pourcentages', 'Mission : resoudre des problemes de proportion, echelle et pourcentage.', 'Pages 18-19', '["proportionnalite","pourcentages"]'::jsonb),
    (9, 'Triangle rectangle : Pythagore et reciproque', 'Mission : calculer une longueur et demontrer la nature d''un triangle.', 'Pages 20-21', '["pythagore","pythagore_reciproque"]'::jsonb),
    (10, 'Geometrie plane et constructions', 'Mission : utiliser proprietes, constructions et justifications.', 'Pages 22-23', '["geometrie_milieux"]'::jsonb),
    (11, 'Reperage, coordonnees et projection', 'Mission : calculer des milieux et exploiter la projection orthogonale.', 'Pages 24-25', '["coordonnees_milieu"]'::jsonb),
    (12, 'Translations et vecteurs', 'Mission : utiliser egalite de vecteurs et relation de Chasles.', 'Pages 26-27', '["vecteurs_chasles"]'::jsonb),
    (13, 'Statistiques, grandeurs et espace', 'Mission : traiter des donnees et resoudre des problemes d''aires/volumes.', 'Pages 28-29', '["statistiques_moyenne","statistiques_frequence","grandeurs_espace"]'::jsonb),
    (14, 'Test Passerelle vers la 3e', 'Validation finale du socle de fin de 4e.', 'Pages 30-31', '[]'::jsonb)
) as mapping(day_number, title, objective, page_reference, topic_slugs)
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours'
  and d.day_number = mapping.day_number;

commit;

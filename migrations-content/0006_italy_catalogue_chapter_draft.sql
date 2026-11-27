-- Draft chapter (1-16, src/content/italy/chapters.ts) for each staged Italian catalogue question,
-- derived only from the source category ("Quesito n° ... - <category>") the question was printed under.
-- A draft is a reviewer's starting point, not a decision: chapter_basis records how it was derived and
-- chapter_confidence marks categories that do not sit cleanly in one of the 16 chapters. Nothing here
-- publishes anything; italy_catalogue_staging stays unpublished and is never read by learner routes.
ALTER TABLE italy_catalogue_staging ADD COLUMN chapter_draft INTEGER CHECK (chapter_draft IS NULL OR chapter_draft BETWEEN 1 AND 16);
ALTER TABLE italy_catalogue_staging ADD COLUMN chapter_basis TEXT;
ALTER TABLE italy_catalogue_staging ADD COLUMN chapter_confidence TEXT CHECK (chapter_confidence IS NULL OR chapter_confidence IN ('category_match', 'needs_review'));

-- Categories whose title matches a chapter title.
UPDATE italy_catalogue_staging SET chapter_confidence = 'category_match', chapter_draft = CASE
  WHEN source_group LIKE '%- Definizioni stradali e di traffico%' THEN 1
  WHEN source_group LIKE '%- Segnali di pericolo%' THEN 2
  WHEN source_group LIKE '%- Segnali di divieto%' THEN 3
  WHEN source_group LIKE '%- Segnali di obbligo%' THEN 4
  WHEN source_group LIKE '%- Segnali di precedenza%' THEN 5
  WHEN source_group LIKE '%- Segnaletica orizzontale%' THEN 6
  WHEN source_group LIKE '%- Segnalazioni semaforiche%' THEN 7
  WHEN source_group LIKE '%- Segnali di indicazione%' THEN 8
  WHEN source_group LIKE '%- Limiti di velocit%' THEN 9
  WHEN source_group LIKE '%- Distanza di sicurezza%' THEN 10
  WHEN source_group LIKE '%- Norme sulla circol%' THEN 10
  WHEN source_group LIKE '%- Esempi di precedenza%' THEN 11
  WHEN source_group LIKE '%- Norme sul sorpasso%' THEN 12
  WHEN source_group LIKE '%- Ingombro della carreggiata%' THEN 12
  WHEN source_group LIKE '%- Fermata, sosta, arresto e partenza%' THEN 13
  WHEN source_group LIKE '%- Uso delle luci%' THEN 14
  WHEN source_group LIKE '%- Patenti di guida%' THEN 15
  WHEN source_group LIKE '%- Guida in relazione alle qualit%' THEN 16
  WHEN source_group LIKE '%- Comportamenti per prevenire%' THEN 16
END
WHERE chapter_draft IS NULL;

-- Categories with no chapter of their own: the nearest chapter, flagged for a reviewer.
UPDATE italy_catalogue_staging SET chapter_confidence = 'needs_review', chapter_draft = CASE
  WHEN source_group LIKE '%- Pannelli integrativi dei segnali%' THEN 8
  WHEN source_group LIKE '%- Segnali complementari%' THEN 8
  WHEN source_group LIKE '%- Responsabilit%' THEN 15
  WHEN source_group LIKE '%- Elementi costitutivi del veicolo%' THEN 16
  WHEN source_group LIKE '%- Dispositivi di equipaggiamento%' THEN 16
  WHEN source_group LIKE '%- Limitazione dei consumi%' THEN 16
END
WHERE chapter_draft IS NULL;

UPDATE italy_catalogue_staging SET chapter_confidence = NULL WHERE chapter_draft IS NULL;
UPDATE italy_catalogue_staging SET chapter_basis = 'source category (draft, unreviewed)' WHERE chapter_draft IS NOT NULL AND chapter_basis IS NULL;

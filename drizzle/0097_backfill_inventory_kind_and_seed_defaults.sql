-- Custom SQL migration file, put your code below! --

-- Kind backfill: the 11 general sections become 'general'; everything else
-- (the 4 food sections, the pre-section "Food" catch-all, and legacy unknowns
-- like "Miscellaneous") keeps the column default 'food' — preserving today's
-- visibility, where unknown categories render on the food list.
UPDATE "inventory_categories"
SET "kind" = 'general'
WHERE "name" IN (
  'Bed linens & textiles',
  'Kitchen equipment',
  'Outdoor & fishing',
  'Tools',
  'Sports equipment',
  'Water sports',
  'Games & books',
  'Cleaning supplies',
  'Consumables & spares',
  'Safety & first aid',
  'Construction materials'
);
--> statement-breakpoint

-- Seed all default categories for every existing property that lacks them.
-- Category rows were previously created lazily on first write, so most
-- properties only have a subset; without this, sections that were visible
-- (but empty) would vanish from the lists. Guard on active name (mirrors
-- 0093), deterministic order (p.id, v.ord) so serial ids follow the canonical
-- section order. Idempotent if re-run.
INSERT INTO "inventory_categories" ("property_id", "name", "kind")
SELECT p."id", v."name", v."kind"
FROM "properties" p
CROSS JOIN (VALUES
  (1,  'Dry goods', 'food'),
  (2,  'Canned goods', 'food'),
  (3,  'Spices', 'food'),
  (4,  'Condiments', 'food'),
  (5,  'Bed linens & textiles', 'general'),
  (6,  'Kitchen equipment', 'general'),
  (7,  'Outdoor & fishing', 'general'),
  (8,  'Tools', 'general'),
  (9,  'Sports equipment', 'general'),
  (10, 'Water sports', 'general'),
  (11, 'Games & books', 'general'),
  (12, 'Cleaning supplies', 'general'),
  (13, 'Consumables & spares', 'general'),
  (14, 'Safety & first aid', 'general'),
  (15, 'Construction materials', 'general')
) AS v("ord", "name", "kind")
WHERE NOT EXISTS (
  SELECT 1 FROM "inventory_categories" c
  WHERE c."property_id" = p."id"
    AND c."name" = v."name"
    AND c."archived_at" IS NULL
)
ORDER BY p."id", v."ord";

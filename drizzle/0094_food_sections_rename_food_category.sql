-- Custom SQL migration file, put your code below! --

-- The food inventory now has fixed sections (Dry goods / Canned goods /
-- Spices / Condiments) stored as category rows. Fold the old catch-all
-- "Food" category into "Dry goods" so existing items land in a real section;
-- the NOT EXISTS guard keeps the partial unique index happy if a property
-- somehow already has an active "Dry goods" row.
UPDATE "inventory_categories" c
SET "name" = 'Dry goods'
WHERE c."name" = 'Food'
  AND c."archived_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "inventory_categories" d
    WHERE d."property_id" = c."property_id"
      AND d."name" = 'Dry goods'
      AND d."archived_at" IS NULL
  );

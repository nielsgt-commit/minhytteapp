-- Custom SQL migration file, put your code below! --

-- Seed a "Food" inventory category for every existing property. New properties
-- get theirs lazily from inventoryItem.create (ensureFoodCategoryId).
INSERT INTO "inventory_categories" ("property_id", "name")
SELECT p."id", 'Food'
FROM "properties" p
WHERE NOT EXISTS (
  SELECT 1 FROM "inventory_categories" c
  WHERE c."property_id" = p."id"
    AND c."name" = 'Food'
    AND c."archived_at" IS NULL
);

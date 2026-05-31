-- ============================================================================
-- 0069: consolidate property ownership to GROUP-ONLY.
-- Inlines the pre-flight data fixes (orphan owners + during_priority_week policy
-- remap) so the whole thing applies in one shot. Data fixes run BEFORE the
-- destructive steps, all within drizzle-kit's per-migration transaction.
-- ============================================================================

-- 0. GUARD: abort if any user belongs to 2+ is_main groups for one property
--    (the consolidation SUM would double-count their share).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "user_group_members" gm
    JOIN "user_groups" g ON g.id = gm.user_group_id
    WHERE g.is_main = true AND g.property_id IS NOT NULL
    GROUP BY gm.user_id, g.property_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Aborting 0069: user(s) belong to 2+ is_main groups for one property; consolidation would double-count. Resolve manually first.';
  END IF;
END $$;--> statement-breakpoint

-- 1. ORPHAN FIX: a user-owner with no is_main group for that property would lose
--    its ownership_pct (the consolidation has nowhere to fold it). Create an
--    is_main family group named after the user, with the user as head.
DO $$
DECLARE
  r RECORD;
  gid integer;
BEGIN
  FOR r IN
    SELECT DISTINCT po.user_id, po.property_id, u.name AS user_name
    FROM "property_owners" po
    JOIN "users" u ON u.id = po.user_id
    WHERE po.user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "user_group_members" gm
        JOIN "user_groups" g ON g.id = gm.user_group_id
        WHERE gm.user_id = po.user_id AND g.is_main = true
          AND g.property_id = po.property_id)
  LOOP
    INSERT INTO "user_groups" (name, is_main, property_id)
    VALUES (r.user_name, true, r.property_id)
    RETURNING id INTO gid;
    INSERT INTO "user_group_members" (user_group_id, user_id, is_head)
    VALUES (gid, r.user_id, true)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;--> statement-breakpoint

-- 2. REMAP during_priority_week split-policy rules: property_owner_id -> the
--    owner's family group id (group-owner's own group, or user-owner's is_main
--    group). Runs after the orphan fix so previously-orphan owners now resolve.
--    Unresolvable refs are left untouched.
DO $$
DECLARE
  pol RECORD;
  new_rules jsonb;
  new_config jsonb;
  rule jsonb;
  owner_id integer;
  grp_id integer;
  fb_when jsonb;
BEGIN
  FOR pol IN SELECT id, config FROM "property_split_policies" LOOP
    new_config := pol.config;

    -- rules[]
    new_rules := '[]'::jsonb;
    FOR rule IN
      SELECT value FROM jsonb_array_elements(COALESCE(pol.config->'rules', '[]'::jsonb))
    LOOP
      IF rule->'when'->>'kind' = 'during_priority_week'
         AND (rule->'when') ? 'property_owner_id' THEN
        owner_id := (rule->'when'->>'property_owner_id')::int;
        SELECT COALESCE(po.user_group_id, (
                 SELECT g.id FROM "user_group_members" m
                 JOIN "user_groups" g ON g.id = m.user_group_id
                 WHERE m.user_id = po.user_id AND g.is_main = true
                   AND g.property_id = po.property_id LIMIT 1))
          INTO grp_id FROM "property_owners" po WHERE po.id = owner_id;
        IF grp_id IS NOT NULL THEN
          rule := jsonb_set(rule, '{when}',
                    jsonb_build_object('kind', 'during_priority_week', 'user_group_id', grp_id));
        END IF;
      END IF;
      new_rules := new_rules || rule;
    END LOOP;
    new_config := jsonb_set(new_config, '{rules}', new_rules);

    -- fallback.when
    fb_when := pol.config->'fallback'->'when';
    IF fb_when->>'kind' = 'during_priority_week' AND fb_when ? 'property_owner_id' THEN
      owner_id := (fb_when->>'property_owner_id')::int;
      SELECT COALESCE(po.user_group_id, (
               SELECT g.id FROM "user_group_members" m
               JOIN "user_groups" g ON g.id = m.user_group_id
               WHERE m.user_id = po.user_id AND g.is_main = true
                 AND g.property_id = po.property_id LIMIT 1))
        INTO grp_id FROM "property_owners" po WHERE po.id = owner_id;
      IF grp_id IS NOT NULL THEN
        new_config := jsonb_set(new_config, '{fallback,when}',
                        jsonb_build_object('kind', 'during_priority_week', 'user_group_id', grp_id));
      END IF;
    END IF;

    IF new_config IS DISTINCT FROM pol.config THEN
      UPDATE "property_split_policies" SET config = new_config, updated_at = now() WHERE id = pol.id;
    END IF;
  END LOOP;
END $$;--> statement-breakpoint

-- 3. priority weeks: re-backfill user_group_id for rows still NULL (0068 left
--    orphan-owned weeks NULL; their groups now exist), then enforce + drop the
--    old owner link.
UPDATE "property_priority_weeks" pw SET "user_group_id" = (
  SELECT g.id FROM "property_owners" po
  JOIN "user_group_members" m ON m.user_id = po.user_id
  JOIN "user_groups" g ON g.id = m.user_group_id
  WHERE po.id = pw.property_owner_id AND g.is_main = true AND g.property_id = pw.property_id
  LIMIT 1
) WHERE pw.user_group_id IS NULL;--> statement-breakpoint
ALTER TABLE "property_priority_weeks" ALTER COLUMN "user_group_id" SET NOT NULL;--> statement-breakpoint
DROP INDEX "priority_week_uq_owner_year";--> statement-breakpoint
CREATE UNIQUE INDEX "priority_week_uq_group_year" ON "property_priority_weeks" USING btree ("user_group_id","year");--> statement-breakpoint
ALTER TABLE "property_priority_weeks" DROP CONSTRAINT "property_priority_weeks_property_owner_id_property_owners_id_fk";--> statement-breakpoint
ALTER TABLE "property_priority_weeks" DROP COLUMN "property_owner_id";--> statement-breakpoint

-- 4. property_owners: consolidate user-owners into family (is_main) group rows, SUMMING pct
UPDATE "property_owners" g SET "ownership_pct" = g.ownership_pct + s.add_pct
FROM (
  SELECT gm.user_group_id, po.property_id, SUM(po.ownership_pct) AS add_pct
  FROM "property_owners" po
  JOIN "user_group_members" gm ON gm.user_id = po.user_id
  JOIN "user_groups" ug ON ug.id = gm.user_group_id AND ug.is_main = true AND ug.property_id = po.property_id
  WHERE po.user_id IS NOT NULL
  GROUP BY gm.user_group_id, po.property_id
) s
WHERE g.user_group_id = s.user_group_id AND g.property_id = s.property_id;--> statement-breakpoint
INSERT INTO "property_owners" (property_id, user_group_id, ownership_pct)
SELECT po.property_id, gm.user_group_id, SUM(po.ownership_pct)
FROM "property_owners" po
JOIN "user_group_members" gm ON gm.user_id = po.user_id
JOIN "user_groups" ug ON ug.id = gm.user_group_id AND ug.is_main = true AND ug.property_id = po.property_id
WHERE po.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "property_owners" g2 WHERE g2.property_id = po.property_id AND g2.user_group_id = gm.user_group_id)
GROUP BY po.property_id, gm.user_group_id;--> statement-breakpoint
DELETE FROM "property_owners" WHERE "user_id" IS NOT NULL;--> statement-breakpoint

-- 5. drop the user dimension + XOR
ALTER TABLE "property_owners" DROP CONSTRAINT "property_owners_exactly_one_ref";--> statement-breakpoint
ALTER TABLE "property_owners" DROP CONSTRAINT "property_owners_user_id_users_id_fk";--> statement-breakpoint
DROP INDEX "property_owners_user_uq";--> statement-breakpoint
DROP INDEX "property_owners_user_id_idx";--> statement-breakpoint
ALTER TABLE "property_owners" ALTER COLUMN "user_group_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "property_owners" DROP COLUMN "user_id";

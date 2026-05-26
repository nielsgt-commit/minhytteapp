ALTER TABLE "routines" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "room_adjacencies" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "structure_adjacencies" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "routines" CASCADE;--> statement-breakpoint
DROP TABLE "room_adjacencies" CASCADE;--> statement-breakpoint
DROP TABLE "structure_adjacencies" CASCADE;--> statement-breakpoint
ALTER TABLE "maintenance" DROP CONSTRAINT IF EXISTS "maintenance_routine_position_pairing";--> statement-breakpoint
ALTER TABLE "maintenance" DROP CONSTRAINT IF EXISTS "maintenance_routine_id_routines_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance" DROP COLUMN "routine_id";--> statement-breakpoint
ALTER TABLE "maintenance" DROP COLUMN "routine_position";
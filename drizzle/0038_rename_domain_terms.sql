-- Custom SQL migration file, put your code below! --

-- Rename tables
ALTER TABLE "buildings" RENAME TO "structures";--> statement-breakpoint
ALTER TABLE "building_adjacencies" RENAME TO "structure_adjacencies";--> statement-breakpoint
ALTER TABLE "places" RENAME TO "infrastructure";--> statement-breakpoint

-- Rename columns
ALTER TABLE "rooms" RENAME COLUMN "building_id" TO "structure_id";--> statement-breakpoint
ALTER TABLE "equipment" RENAME COLUMN "building_id" TO "structure_id";--> statement-breakpoint
ALTER TABLE "maintenance" RENAME COLUMN "building_id" TO "structure_id";--> statement-breakpoint
ALTER TABLE "maintenance" RENAME COLUMN "place_id" TO "infrastructure_id";--> statement-breakpoint
ALTER TABLE "inspections" RENAME COLUMN "building_id" TO "structure_id";--> statement-breakpoint
ALTER TABLE "inspections" RENAME COLUMN "place_id" TO "infrastructure_id";--> statement-breakpoint
ALTER TABLE "structure_adjacencies" RENAME COLUMN "building_a" TO "structure_a";--> statement-breakpoint
ALTER TABLE "structure_adjacencies" RENAME COLUMN "building_b" TO "structure_b";--> statement-breakpoint

-- Rename FK and check constraints to match drizzle's naming convention
ALTER TABLE "structures" RENAME CONSTRAINT "buildings_property_id_properties_id_fk" TO "structures_property_id_properties_id_fk";--> statement-breakpoint
ALTER TABLE "rooms" RENAME CONSTRAINT "rooms_building_id_buildings_id_fk" TO "rooms_structure_id_structures_id_fk";--> statement-breakpoint
ALTER TABLE "structure_adjacencies" RENAME CONSTRAINT "building_adjacencies_building_a_buildings_id_fk" TO "structure_adjacencies_structure_a_structures_id_fk";--> statement-breakpoint
ALTER TABLE "structure_adjacencies" RENAME CONSTRAINT "building_adjacencies_building_b_buildings_id_fk" TO "structure_adjacencies_structure_b_structures_id_fk";--> statement-breakpoint
ALTER TABLE "structure_adjacencies" RENAME CONSTRAINT "building_adjacencies_building_a_building_b_pk" TO "structure_adjacencies_structure_a_structure_b_pk";--> statement-breakpoint
ALTER TABLE "structure_adjacencies" RENAME CONSTRAINT "building_adj_order" TO "structure_adj_order";--> statement-breakpoint
ALTER TABLE "infrastructure" RENAME CONSTRAINT "places_property_id_properties_id_fk" TO "infrastructure_property_id_properties_id_fk";--> statement-breakpoint
ALTER TABLE "equipment" RENAME CONSTRAINT "equipment_building_id_buildings_id_fk" TO "equipment_structure_id_structures_id_fk";--> statement-breakpoint
ALTER TABLE "maintenance" RENAME CONSTRAINT "maintenance_building_id_buildings_id_fk" TO "maintenance_structure_id_structures_id_fk";--> statement-breakpoint
ALTER TABLE "maintenance" RENAME CONSTRAINT "maintenance_place_id_places_id_fk" TO "maintenance_infrastructure_id_infrastructure_id_fk";--> statement-breakpoint
ALTER TABLE "inspections" RENAME CONSTRAINT "inspections_building_id_buildings_id_fk" TO "inspections_structure_id_structures_id_fk";--> statement-breakpoint
ALTER TABLE "inspections" RENAME CONSTRAINT "inspections_place_id_places_id_fk" TO "inspections_infrastructure_id_infrastructure_id_fk";

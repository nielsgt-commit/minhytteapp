import { TRPCError } from "@trpc/server"
import { sql } from "drizzle-orm"
import { z } from "zod"
import {
  propertyOwnersTable,
  propertyTable,
} from "../../db/schema/property.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import { adminProcedure, router } from "../init.ts"

const isDev = process.env.NODE_ENV !== "production"

export const devRouter = router({
  wipe: adminProcedure
    .input(z.object({ reseed: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      if (!isDev) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "wipe is disabled outside development",
        })
      }

      await ctx.db.execute(sql`
        TRUNCATE TABLE
          "booking_occupants", "booking_rooms", "bookings",
          "events",
          "maintenance_attachments", "maintenance_updates", "maintenance", "routines",
          "shares", "expenses",
          "settlement_transfers", "settlement_user_group_totals", "settlements",
          "structure_adjacencies", "room_adjacencies",
          "property_invitations", "property_owners",
          "rooms", "structures", "infrastructure",
          "user_group_members", "user_groups",
          "users",
          "properties"
        RESTART IDENTITY CASCADE
      `)

      if (!input.reseed) return { ok: true, reseeded: false }

      const [owner] = await ctx.db
        .insert(usersTable)
        .values({
          name: "Owner",
          email: "owner@example.com",
          oauth_sub: "Owner",
          is_admin: true,
        })
        .returning()
      await ctx.db.insert(usersTable).values({
        name: "Member",
        email: "member@example.com",
        oauth_sub: "Member",
        is_admin: false,
      })
      const [property] = await ctx.db
        .insert(propertyTable)
        .values({ name: "Hytta", address: "Fjellveien 1" })
        .returning()
      await ctx.db.insert(propertyOwnersTable).values({
        property_id: property.id,
        user_id: owner.id,
        ownership_pct: "100.00",
      })

      return { ok: true, reseeded: true }
    }),
})
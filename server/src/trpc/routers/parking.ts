import { TRPCError } from "@trpc/server"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import {
  parkingClaimsTable,
  propertyTable,
} from "../../db/schema/property.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import { wireMap } from "../util/wire.ts"
import { propertyAdminProcedure, router } from "../init.ts"

// Wire mapping: claimed_at (timestamp) → Temporal.Instant. The explicit
// Omit-based return type keeps the inferred procedure output clean
// (a plain generic spread would yield `Date & Instant` intersections).
const toWireClaim = wireMap({ claimed_at: "instant" })

const slotExtra = z.object({
  slot_index: z.number().int().min(0),
})

// Reserved slot indices for the "fun" extras (motorcycle/bike/stroller/wheelbarrow)
// that don't take up a real parking lot.
const EXTRA_SLOT_MIN = 1000
const EXTRA_SLOT_MAX = 1003
const isExtraSlot = (slot: number) =>
  slot >= EXTRA_SLOT_MIN && slot <= EXTRA_SLOT_MAX

export const parkingRouter = router({
  listForProperty: propertyAdminProcedure.query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({
        property_id: parkingClaimsTable.property_id,
        slot_index: parkingClaimsTable.slot_index,
        user_id: parkingClaimsTable.user_id,
        user_name: usersTable.name,
        claimed_at: parkingClaimsTable.claimed_at,
      })
      .from(parkingClaimsTable)
      .innerJoin(usersTable, eq(usersTable.id, parkingClaimsTable.user_id))
      .where(eq(parkingClaimsTable.property_id, input.property_id))
      .orderBy(asc(parkingClaimsTable.slot_index))
    return rows.map(r => toWireClaim(r))
  }),

  claim: propertyAdminProcedure
    .input(slotExtra)
    .mutation(async ({ ctx, input }) => {
      const property = (
        await ctx.db
          .select({ parking_spots: propertyTable.parking_spots })
          .from(propertyTable)
          .where(eq(propertyTable.id, input.property_id))
          .limit(1)
      ).at(0)
      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "property not found",
        })
      }
      if (
        !isExtraSlot(input.slot_index) &&
        input.slot_index >= property.parking_spots
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "slot_index out of range",
        })
      }

      const [claim] = await ctx.db
        .insert(parkingClaimsTable)
        .values({
          property_id: input.property_id,
          slot_index: input.slot_index,
          user_id: ctx.user.id,
        })
        .onConflictDoUpdate({
          target: [
            parkingClaimsTable.property_id,
            parkingClaimsTable.slot_index,
          ],
          set: {
            user_id: ctx.user.id,
            claimed_at: new Date(),
          },
        })
        .returning()
      return toWireClaim(claim)
    }),

  release: propertyAdminProcedure
    .input(slotExtra)
    .mutation(async ({ ctx, input }) => {
      const released = (
        await ctx.db
          .delete(parkingClaimsTable)
          .where(
            and(
              eq(parkingClaimsTable.property_id, input.property_id),
              eq(parkingClaimsTable.slot_index, input.slot_index),
            ),
          )
          .returning()
      ).at(0)
      return released ? toWireClaim(released) : null
    }),
})

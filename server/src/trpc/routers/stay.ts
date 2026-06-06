import { TRPCError } from "@trpc/server"
import { and, eq, isNull, ne, sql } from "drizzle-orm"
import { z } from "zod"
import {
  bookingOccupantsTable,
  bookingTable,
} from "../../db/schema/booking.schema.ts"
import {
  propertyTable,
  roomTable,
  structuresTable,
} from "../../db/schema/property.schema.ts"
import { stayTable } from "../../db/schema/stay.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import { propertyAdminProcedure, protectedProcedure, router } from "../init.ts"

const propertyInput = z.object({ property_id: z.number().int().positive() })

export const stayRouter = router({
  atProperty: propertyAdminProcedure.query(async ({ ctx, input }) => {
    const today = sql<string>`CURRENT_DATE`

    const bookingOccupants = await ctx.db
      .selectDistinct({
        user_id: usersTable.id,
        name: usersTable.name,
      })
      .from(bookingTable)
      .innerJoin(
        bookingOccupantsTable,
        eq(bookingOccupantsTable.booking_id, bookingTable.id),
      )
      .innerJoin(usersTable, eq(usersTable.id, bookingOccupantsTable.user_id))
      .where(
        and(
          eq(bookingTable.property_id, input.property_id),
          eq(bookingTable.status, "confirmed"),
          sql`${bookingTable.start_date} <= ${today}`,
          sql`${bookingTable.end_date} >= ${today}`,
        ),
      )

    const stayOccupants = await ctx.db
      .select({
        user_id: usersTable.id,
        name: usersTable.name,
      })
      .from(stayTable)
      .innerJoin(usersTable, eq(usersTable.id, stayTable.user_id))
      .where(
        and(
          eq(stayTable.property_id, input.property_id),
          isNull(stayTable.end_date),
        ),
      )

    const byId = new Map<
      number,
      { user_id: number; name: string; via: "booking" | "stay" | "both" }
    >()
    for (const u of bookingOccupants) {
      byId.set(u.user_id, { ...u, via: "booking" })
    }
    for (const u of stayOccupants) {
      const existing = byId.get(u.user_id)
      byId.set(u.user_id, {
        ...u,
        via: existing ? "both" : "stay",
      })
    }
    return Array.from(byId.values())
  }),

  currentForMe: protectedProcedure
    .input(propertyInput)
    .query(async ({ ctx, input }) => {
      const today = sql<string>`CURRENT_DATE`

      const openStay = (
        await ctx.db
          .select()
          .from(stayTable)
          .where(
            and(
              eq(stayTable.user_id, ctx.user.id),
              eq(stayTable.property_id, input.property_id),
              isNull(stayTable.end_date),
            ),
          )
          .limit(1)
      ).at(0)

      const coveringBooking = (
        await ctx.db
          .select({
            id: bookingTable.id,
            status: bookingTable.status,
            start_date: bookingTable.start_date,
            end_date: bookingTable.end_date,
          })
          .from(bookingTable)
          .innerJoin(
            bookingOccupantsTable,
            eq(bookingOccupantsTable.booking_id, bookingTable.id),
          )
          .where(
            and(
              eq(bookingTable.property_id, input.property_id),
              eq(bookingOccupantsTable.user_id, ctx.user.id),
              ne(bookingTable.status, "cancelled"),
              sql`${bookingTable.start_date} <= ${today}`,
              sql`${bookingTable.end_date} >= ${today}`,
            ),
          )
          .limit(1)
      ).at(0)

      return {
        stay: openStay ?? null,
        booking: coveringBooking ?? null,
        checkedIn: openStay != null || coveringBooking?.status === "confirmed",
      }
    }),

  checkIn: protectedProcedure
    .input(propertyInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async tx => {
        const today = sql<string>`CURRENT_DATE`

        const coveringBooking = (
          await tx
            .select({
              id: bookingTable.id,
              status: bookingTable.status,
              room_name: roomTable.name,
              building_name: structuresTable.name,
            })
            .from(bookingTable)
            .innerJoin(
              bookingOccupantsTable,
              eq(bookingOccupantsTable.booking_id, bookingTable.id),
            )
            .leftJoin(roomTable, eq(roomTable.id, bookingOccupantsTable.room_id))
            .leftJoin(
              structuresTable,
              eq(structuresTable.id, roomTable.structure_id),
            )
            .where(
              and(
                eq(bookingTable.property_id, input.property_id),
                eq(bookingOccupantsTable.user_id, ctx.user.id),
                ne(bookingTable.status, "cancelled"),
                sql`${bookingTable.start_date} <= ${today}`,
                sql`${bookingTable.end_date} >= ${today}`,
              ),
            )
            .limit(1)
        ).at(0)

        if (coveringBooking) {
          const wasConfirmed = coveringBooking.status === "confirmed"
          if (!wasConfirmed) {
            await tx
              .update(bookingTable)
              .set({ status: "confirmed", updated_at: new Date() })
              .where(eq(bookingTable.id, coveringBooking.id))
          }

          const property = (
            await tx
              .select({ name: propertyTable.name })
              .from(propertyTable)
              .where(eq(propertyTable.id, input.property_id))
              .limit(1)
          ).at(0)

          // firstCheckIn: this call actually transitioned the booking into
          // the checked-in state (was pending), so the guest hasn't been
          // greeted yet. Already-confirmed = a re-toggle, no greeting.
          // The greeting fields travel on the mutation result so the welcome
          // dialog never depends on whether the background status query has
          // finished loading.
          return {
            kind: "booking" as const,
            booking_id: coveringBooking.id,
            firstCheckIn: !wasConfirmed,
            propertyName: property?.name ?? null,
            room_name: coveringBooking.room_name,
            building_name: coveringBooking.building_name,
          }
        }

        const existingOpen = (
          await tx
            .select({ id: stayTable.id })
            .from(stayTable)
            .where(
              and(
                eq(stayTable.user_id, ctx.user.id),
                eq(stayTable.property_id, input.property_id),
                isNull(stayTable.end_date),
              ),
            )
            .limit(1)
        ).at(0)

        if (existingOpen) {
          return {
            kind: "stay" as const,
            stay_id: existingOpen.id,
            firstCheckIn: false,
            propertyName: null,
            room_name: null,
            building_name: null,
          }
        }

        const created = (
          await tx
            .insert(stayTable)
            .values({
              user_id: ctx.user.id,
              property_id: input.property_id,
              start_date: sql`CURRENT_DATE`,
            })
            .returning({ id: stayTable.id })
        ).at(0)

        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "failed to create stay",
          })
        }

        // A brand-new stay with no covering booking: nothing to greet with
        // (no room/building), so the dialog stays closed on the client.
        return {
          kind: "stay" as const,
          stay_id: created.id,
          firstCheckIn: true,
          propertyName: null,
          room_name: null,
          building_name: null,
        }
      })
    }),

  checkOut: protectedProcedure
    .input(propertyInput)
    .mutation(async ({ ctx, input }) => {
      const closed = (
        await ctx.db
          .update(stayTable)
          .set({ end_date: sql`CURRENT_DATE` })
          .where(
            and(
              eq(stayTable.user_id, ctx.user.id),
              eq(stayTable.property_id, input.property_id),
              isNull(stayTable.end_date),
            ),
          )
          .returning({ id: stayTable.id })
      ).at(0)

      if (!closed) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "no open stay to close",
        })
      }
      return closed
    }),
})

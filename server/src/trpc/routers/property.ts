import { and, asc, eq, inArray, isNotNull, or } from "drizzle-orm"
import { z } from "zod"
import {
  bookingOccupantsTable,
  bookingRoomsTable,
  bookingTable,
} from "../../db/schema/booking.schema.ts"
import { eventTable } from "../../db/schema/event.schema.ts"
import {
  equipmentTable,
  inspectionsTable,
  maintenanceTable,
} from "../../db/schema/maintenance.schema.ts"
import {
  infrastructureTable,
  parkingClaimsTable,
  propertyContactsTable,
  propertyOwnersTable,
  propertyPriorityWeeksTable,
  propertyTable,
  roomTable,
  structuresTable,
} from "../../db/schema/property.schema.ts"
import {
  expenseSharesTable,
  expensesTable,
  settlementsTable,
} from "../../db/schema/settlement.schema.ts"
import { stayTable } from "../../db/schema/stay.schema.ts"
import {
  allowedEmailsTable,
  userGroupMembersTable,
  userGroupsTable,
} from "../../db/schema/users.schema.ts"
import { geocodeNorwayAddress } from "../../services/geocode.ts"
import { assertPropertyMember, protectedProcedure, router } from "../init.ts"

const propertyFields = {
  name: z.string().min(1, { error: "name is required" }),
  address: z.string().min(1, { error: "address is required" }),
  in_family_since: z.number().int().min(1500).max(2100).nullable().optional(),
  parking_spots: z.number().int().min(0).max(99).optional(),
  adressekode: z.number().int().nullable().optional(),
  kommunenummer: z.string().length(4).nullable().optional(),
  gardsnummer: z.number().int().nullable().optional(),
  bruksnummer: z.number().int().nullable().optional(),
  festenummer: z.number().int().nullable().optional(),
  undernummer: z.number().int().nullable().optional(),
}

const createInput = z.object(propertyFields)

const updateInput = z.object({
  id: z.number().int().positive(),
  ...propertyFields,
})

export const propertyRouter = router({
  mine: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id

    const viaOwners = await ctx.db
      .selectDistinct({ id: propertyOwnersTable.property_id })
      .from(propertyOwnersTable)
      .leftJoin(
        userGroupMembersTable,
        eq(
          userGroupMembersTable.user_group_id,
          propertyOwnersTable.user_group_id,
        ),
      )
      .where(
        or(
          eq(propertyOwnersTable.user_id, userId),
          eq(userGroupMembersTable.user_id, userId),
        ),
      )

    const viaGroupLink = await ctx.db
      .selectDistinct({ id: userGroupsTable.property_id })
      .from(userGroupsTable)
      .innerJoin(
        userGroupMembersTable,
        eq(userGroupMembersTable.user_group_id, userGroupsTable.id),
      )
      .where(
        and(
          eq(userGroupMembersTable.user_id, userId),
          isNotNull(userGroupsTable.property_id),
        ),
      )

    const ids = new Set<number>()
    for (const r of viaOwners) ids.add(r.id)
    for (const r of viaGroupLink) {
      if (r.id != null) ids.add(r.id)
    }
    if (ids.size === 0) return []

    return ctx.db
      .select({
        id: propertyTable.id,
        name: propertyTable.name,
        address: propertyTable.address,
        in_family_since: propertyTable.in_family_since,
        parking_spots: propertyTable.parking_spots,
        adressekode: propertyTable.adressekode,
        kommunenummer: propertyTable.kommunenummer,
        gardsnummer: propertyTable.gardsnummer,
        bruksnummer: propertyTable.bruksnummer,
        festenummer: propertyTable.festenummer,
        undernummer: propertyTable.undernummer,
        latitude: propertyTable.latitude,
        longitude: propertyTable.longitude,
      })
      .from(propertyTable)
      .where(inArray(propertyTable.id, Array.from(ids)))
      .orderBy(asc(propertyTable.id))
  }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const coords = await geocodeNorwayAddress(input.address)
      return ctx.db.transaction(async tx => {
        const [created] = await tx
          .insert(propertyTable)
          .values({ ...input, ...coords })
          .returning()
        await tx.insert(propertyOwnersTable).values({
          property_id: created.id,
          user_id: ctx.user.id,
          ownership_pct: "100.00",
        })
        return created
      })
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.id)
      const { id, ...rest } = input
      const coords = await geocodeNorwayAddress(rest.address)
      const [updated] = await ctx.db
        .update(propertyTable)
        .set({ ...rest, ...coords })
        .where(eq(propertyTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        cascade: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.id)
      const { id, cascade } = input

      if (!cascade) {
        const [deleted] = await ctx.db
          .delete(propertyTable)
          .where(eq(propertyTable.id, id))
          .returning()
        return deleted
      }

      return ctx.db.transaction(async tx => {
        const pickIds = async <T extends { id: number }>(
          rows: Promise<T[]>,
        ): Promise<number[]> => (await rows).map(r => r.id)

        const [bookingIds, expenseIds, structureIds, infraIds, equipmentIds] =
          await Promise.all([
            pickIds(
              tx
                .select({ id: bookingTable.id })
                .from(bookingTable)
                .where(eq(bookingTable.property_id, id)),
            ),
            pickIds(
              tx
                .select({ id: expensesTable.id })
                .from(expensesTable)
                .where(eq(expensesTable.property_id, id)),
            ),
            pickIds(
              tx
                .select({ id: structuresTable.id })
                .from(structuresTable)
                .where(eq(structuresTable.property_id, id)),
            ),
            pickIds(
              tx
                .select({ id: infrastructureTable.id })
                .from(infrastructureTable)
                .where(eq(infrastructureTable.property_id, id)),
            ),
            pickIds(
              tx
                .select({ id: equipmentTable.id })
                .from(equipmentTable)
                .where(eq(equipmentTable.property_id, id)),
            ),
          ])

        if (expenseIds.length > 0) {
          await tx
            .delete(expenseSharesTable)
            .where(inArray(expenseSharesTable.expense_id, expenseIds))
        }
        if (bookingIds.length > 0) {
          await tx
            .delete(bookingOccupantsTable)
            .where(inArray(bookingOccupantsTable.booking_id, bookingIds))
          await tx
            .delete(bookingRoomsTable)
            .where(inArray(bookingRoomsTable.booking_id, bookingIds))
        }
        await tx.delete(expensesTable).where(eq(expensesTable.property_id, id))
        if (
          structureIds.length > 0 ||
          infraIds.length > 0 ||
          equipmentIds.length > 0
        ) {
          await tx
            .delete(maintenanceTable)
            .where(
              or(
                structureIds.length > 0
                  ? inArray(maintenanceTable.structure_id, structureIds)
                  : undefined,
                infraIds.length > 0
                  ? inArray(maintenanceTable.infrastructure_id, infraIds)
                  : undefined,
                equipmentIds.length > 0
                  ? inArray(maintenanceTable.equipment_id, equipmentIds)
                  : undefined,
              ),
            )
          await tx
            .delete(inspectionsTable)
            .where(
              or(
                structureIds.length > 0
                  ? inArray(inspectionsTable.structure_id, structureIds)
                  : undefined,
                infraIds.length > 0
                  ? inArray(inspectionsTable.infrastructure_id, infraIds)
                  : undefined,
                equipmentIds.length > 0
                  ? inArray(inspectionsTable.equipment_id, equipmentIds)
                  : undefined,
              ),
            )
        }
        await tx.delete(bookingTable).where(eq(bookingTable.property_id, id))
        await tx
          .delete(settlementsTable)
          .where(eq(settlementsTable.property_id, id))
        await tx
          .delete(equipmentTable)
          .where(eq(equipmentTable.property_id, id))
        if (structureIds.length > 0) {
          await tx
            .delete(roomTable)
            .where(inArray(roomTable.structure_id, structureIds))
        }
        await tx
          .delete(structuresTable)
          .where(eq(structuresTable.property_id, id))
        await tx
          .delete(infrastructureTable)
          .where(eq(infrastructureTable.property_id, id))
        await tx
          .delete(propertyPriorityWeeksTable)
          .where(eq(propertyPriorityWeeksTable.property_id, id))
        await tx
          .delete(propertyOwnersTable)
          .where(eq(propertyOwnersTable.property_id, id))
        await tx
          .delete(propertyContactsTable)
          .where(eq(propertyContactsTable.property_id, id))
        await tx
          .delete(parkingClaimsTable)
          .where(eq(parkingClaimsTable.property_id, id))
        await tx.delete(stayTable).where(eq(stayTable.property_id, id))
        await tx.delete(eventTable).where(eq(eventTable.property_id, id))
        await tx
          .delete(allowedEmailsTable)
          .where(eq(allowedEmailsTable.property_id, id))

        const groupIds = await pickIds(
          tx
            .select({ id: userGroupsTable.id })
            .from(userGroupsTable)
            .where(eq(userGroupsTable.property_id, id)),
        )
        if (groupIds.length > 0) {
          await tx
            .delete(userGroupMembersTable)
            .where(inArray(userGroupMembersTable.user_group_id, groupIds))
          await tx
            .delete(userGroupsTable)
            .where(eq(userGroupsTable.property_id, id))
        }

        const [deleted] = await tx
          .delete(propertyTable)
          .where(eq(propertyTable.id, id))
          .returning()
        return deleted
      })
    }),
})

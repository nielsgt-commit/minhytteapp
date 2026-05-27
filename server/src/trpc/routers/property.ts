import { asc, eq, or } from "drizzle-orm"
import { z } from "zod"
import {
  propertyOwnersTable,
  propertyTable,
} from "../../db/schema/property.schema.ts"
import { userGroupMembersTable } from "../../db/schema/users.schema.ts"
import { geocodeNorwayAddress } from "../../services/geocode.ts"
import {
  assertPropertyMember,
  protectedProcedure,
  publicProcedure,
  router,
} from "../init.ts"

const propertyFields = {
  name: z.string().min(1, { error: "name is required" }),
  address: z.string().min(1, { error: "address is required" }),
  link: z.string().max(255).nullable().optional(),
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
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(propertyTable).orderBy(asc(propertyTable.id))
  }),

  listForUser: protectedProcedure
    .input(z.object({ user_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .selectDistinct({
          id: propertyTable.id,
          name: propertyTable.name,
          address: propertyTable.address,
          link: propertyTable.link,
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
        .innerJoin(
          propertyOwnersTable,
          eq(propertyOwnersTable.property_id, propertyTable.id),
        )
        .leftJoin(
          userGroupMembersTable,
          eq(
            userGroupMembersTable.user_group_id,
            propertyOwnersTable.user_group_id,
          ),
        )
        .where(
          or(
            eq(propertyOwnersTable.user_id, input.user_id),
            eq(userGroupMembersTable.user_id, input.user_id),
          ),
        )
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
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.id)
      const [deleted] = await ctx.db
        .delete(propertyTable)
        .where(eq(propertyTable.id, input.id))
        .returning()
      return deleted
    }),
})

import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import {
  buildingsTable,
  roomTable,
} from "../../db/schema/property.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const roomFields = {
  name: z.string().min(1, { error: "name is required" }),
  building_id: z.number().int().positive(),
  beds_sm: z.number().int().nonnegative(),
  beds_lg: z.number().int().nonnegative(),
  beds_double: z.number().int().nonnegative(),
  mattresses: z.number().int().nonnegative(),
  travel_cot: z.number().int().nonnegative(),
  room_type: z.enum(["single", "double", "family"]),
}

const createInput = z.object(roomFields)

const updateInput = z.object({
  id: z.number().int().positive(),
  ...roomFields,
})

export const roomRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: roomTable.id,
        name: roomTable.name,
        building_id: roomTable.building_id,
        building_name: buildingsTable.name,
        beds_sm: roomTable.beds_sm,
        beds_lg: roomTable.beds_lg,
        beds_double: roomTable.beds_double,
        mattresses: roomTable.mattresses,
        travel_cot: roomTable.travel_cot,
        room_type: roomTable.room_type,
      })
      .from(roomTable)
      .leftJoin(buildingsTable, eq(buildingsTable.id, roomTable.building_id))
      .orderBy(asc(roomTable.id))
    return rows
  }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(roomTable)
        .values(input)
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(roomTable)
        .set(rest)
        .where(eq(roomTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(roomTable)
        .where(eq(roomTable.id, input.id))
        .returning()
      return deleted
    }),
})

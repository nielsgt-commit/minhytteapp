import { initTRPC, TRPCError } from "@trpc/server"
import { and, eq, or } from "drizzle-orm"
import { z } from "zod"
import { propertyOwnersTable } from "../db/schema/property.schema.ts"
import { userGroupMembersTable } from "../db/schema/users.schema.ts"
import type { Context } from "./context.ts"

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({ ctx: { ...ctx, user: ctx.user, session: ctx.session } })
})

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.is_admin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "admin role required" })
  }
  return next({ ctx })
})

export const headOrAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.is_admin && !ctx.user.is_head) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "head or admin role required",
    })
  }
  return next({ ctx })
})

export const propertyAdminProcedure = protectedProcedure
  .input(z.object({ property_id: z.number().int().positive() }))
  .use(async ({ ctx, input, next }) => {
    if (ctx.user.is_admin) return next()
    const hit = await ctx.db
      .select({ id: propertyOwnersTable.id })
      .from(propertyOwnersTable)
      .leftJoin(
        userGroupMembersTable,
        eq(
          userGroupMembersTable.user_group_id,
          propertyOwnersTable.user_group_id,
        ),
      )
      .where(
        and(
          eq(propertyOwnersTable.property_id, input.property_id),
          or(
            eq(propertyOwnersTable.user_id, ctx.user.id),
            eq(userGroupMembersTable.user_id, ctx.user.id),
          ),
        ),
      )
      .limit(1)
    if (hit.length === 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "must be an owner of this property",
      })
    }
    return next()
  })
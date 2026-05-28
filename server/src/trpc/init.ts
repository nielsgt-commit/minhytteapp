import { initTRPC, TRPCError } from "@trpc/server"
import { and, eq, or } from "drizzle-orm"
import { z } from "zod"
import type { db as dbClient } from "../db/client.ts"
import { propertyOwnersTable } from "../db/schema/property.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
} from "../db/schema/users.schema.ts"
import type { AuthUser, Context } from "./context.ts"

type Db = typeof dbClient

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

export async function assertPropertyMember(
  db: Db,
  user: AuthUser,
  propertyId: number,
) {
  if (user.is_admin) return
  const viaOwners = await db
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
        eq(propertyOwnersTable.property_id, propertyId),
        or(
          eq(propertyOwnersTable.user_id, user.id),
          eq(userGroupMembersTable.user_id, user.id),
        ),
      ),
    )
    .limit(1)
  if (viaOwners.length > 0) return

  const viaGroupLink = await db
    .select({ id: userGroupsTable.id })
    .from(userGroupsTable)
    .innerJoin(
      userGroupMembersTable,
      eq(userGroupMembersTable.user_group_id, userGroupsTable.id),
    )
    .where(
      and(
        eq(userGroupsTable.property_id, propertyId),
        eq(userGroupMembersTable.user_id, user.id),
      ),
    )
    .limit(1)
  if (viaGroupLink.length > 0) return

  throw new TRPCError({ code: "FORBIDDEN" })
}

export const propertyAdminProcedure = protectedProcedure
  .input(z.object({ property_id: z.number().int().positive() }))
  .use(async ({ ctx, input, next }) => {
    await assertPropertyMember(ctx.db, ctx.user, input.property_id)
    return next()
  })

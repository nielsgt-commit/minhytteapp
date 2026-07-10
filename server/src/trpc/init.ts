import { initTRPC, TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import type { db as dbClient } from "../db/client.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
} from "../db/schema/users.schema.ts"
import { transformer } from "../shared/transformer.ts"
import type { AuthUser, Context } from "./context.ts"

type Db = typeof dbClient

const t = initTRPC.context<Context>().create({ transformer })

export const router = t.router
export const createCallerFactory = t.createCallerFactory
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
  if (!ctx.user.is_admin && !ctx.user.is_head_anywhere) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "head or admin role required",
    })
  }
  return next({ ctx })
})

export async function isPropertyHead(
  db: Db,
  user: AuthUser,
  propertyId: number,
): Promise<boolean> {
  // "Head" means a real head-member of a family group on THIS property — it is
  // deliberately NOT satisfied by the platform-admin flag. Settlement and
  // expense participation rely on this being membership-only so the gates agree
  // with the split math (which builds heads/households from real membership).
  // Operator surfaces that should still honour admins use
  // assertPropertyHeadOrAdmin instead.
  const rows = await db
    .select({ user_id: userGroupMembersTable.user_id })
    .from(userGroupMembersTable)
    .innerJoin(
      userGroupsTable,
      eq(userGroupsTable.id, userGroupMembersTable.user_group_id),
    )
    .where(
      and(
        eq(userGroupMembersTable.user_id, user.id),
        eq(userGroupMembersTable.is_head, true),
        eq(userGroupsTable.is_family, true),
        eq(userGroupsTable.property_id, propertyId),
      ),
    )
    .limit(1)
  return rows.length > 0
}

export async function assertPropertyHead(
  db: Db,
  user: AuthUser,
  propertyId: number,
  message = "must be a household head of this property",
) {
  if (!(await isPropertyHead(db, user, propertyId))) {
    throw new TRPCError({ code: "FORBIDDEN", message })
  }
}

// Operator override for surfaces where a platform admin should be able to act
// as a head even without membership (invite management, priority weeks). Kept
// explicit per call site — rather than baked into isPropertyHead — so a future
// "admin mode" toggle can gate it in one obvious place. Do NOT use this for
// settlement/expense participation: being a head there means real membership.
export async function assertPropertyHeadOrAdmin(
  db: Db,
  user: AuthUser,
  propertyId: number,
  message?: string,
) {
  if (user.is_admin) return
  await assertPropertyHead(db, user, propertyId, message)
}

export async function assertPropertyMember(
  db: Db,
  user: AuthUser,
  propertyId: number,
) {
  if (user.is_admin) return

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

export const propertyHeadProcedure = protectedProcedure
  .input(z.object({ property_id: z.number().int().positive() }))
  .use(async ({ ctx, input, next }) => {
    await assertPropertyHead(ctx.db, ctx.user, input.property_id)
    return next()
  })

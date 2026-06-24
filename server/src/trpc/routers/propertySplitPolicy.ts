import { and, asc, eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import type { db as dbClient } from "../../db/client.ts"
import { propertySplitPoliciesTable } from "../../db/schema/settlement.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import type { AuthUser } from "../context.ts"
import { type Temporal, instantFromDate } from "../../shared/temporal.ts"
import {
  SPLIT_POLICY_PARAMETERS,
  configViolations,
  normalizeParameters,
  normalizeWhat,
  resolveOccupancy,
} from "../../shared/splitPolicy.ts"
import { assertPropertyMember, protectedProcedure, router } from "../init.ts"

type Db = typeof dbClient

// Wire mapping: policy timestamp columns → Temporal.Instant.
function toWirePolicy<T extends { created_at: Date; updated_at: Date }>(
  p: T,
): Omit<T, "created_at" | "updated_at"> & {
  created_at: Temporal.Instant
  updated_at: Temporal.Instant
} {
  return {
    ...p,
    created_at: instantFromDate(p.created_at),
    updated_at: instantFromDate(p.updated_at),
  }
}

// A rule's `what` may name several categories. Legacy rows carry a single
// `category_id`; normalizeWhat folds both shapes (and an empty selection) into
// the canonical form before validation.
const whatSchema = z.preprocess(
  normalizeWhat,
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("total") }),
    z.object({
      kind: z.literal("category"),
      category_ids: z.array(z.number().int().positive()).min(1).max(50),
    }),
  ]),
)

const howSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("equally") }),
  z.object({ kind: z.literal("weighted_by_occupancy") }),
  z.object({ kind: z.literal("by_ownership_pct") }),
])

const whoSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all_users") }),
  z.object({
    kind: z.literal("user_group"),
    group_id: z.number().int().positive(),
  }),
  z.object({ kind: z.literal("user"), user_id: z.number().int().positive() }),
  z.object({ kind: z.literal("heads_only") }),
  z.object({ kind: z.literal("main_groups") }),
])

const whenSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("always") }),
  z.object({ kind: z.literal("present_when_expense_added") }),
  z.object({ kind: z.literal("present_this_year") }),
  z.object({ kind: z.literal("present_any_priority_week") }),
  z.object({
    kind: z.literal("present_priority_week"),
    user_group_id: z.number().int().positive(),
  }),
])

const exceptItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), user_id: z.number().int().positive() }),
  z.object({ kind: z.literal("group"), group_id: z.number().int().positive() }),
  z.object({ kind: z.literal("kids") }),
])

const ruleSchema = z.object({
  what: whatSchema,
  how: howSchema,
  who: z.array(whoSchema).min(1).max(20),
  except: z.array(exceptItemSchema).max(50),
  when: whenSchema,
})

const fallbackSchema = z.object({
  how: howSchema,
  who: z.array(whoSchema).min(1).max(20),
  except: z.array(exceptItemSchema).max(50),
  when: whenSchema,
})

// Month/day (`MM-DD`), resolved against the settlement year by the calc. 01-01
// through 12-31; day-of-month range is loose because the real calendar bound
// depends on the year, which the calc clamps.
const monthDaySchema = z
  .string()
  .regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)

const occupancyWindowSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("year") }),
  z.object({ kind: z.literal("any_priority_week") }),
  z.object({
    kind: z.literal("priority_week"),
    user_group_id: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("custom_range"),
    from_md: monthDaySchema,
    to_md: monthDaySchema,
  }),
])

const occupancySchema = z.object({
  window: occupancyWindowSchema,
  include_extra_guests: z.boolean(),
  child_weight: z.number().min(0).max(1),
})

const configSchema = z
  .object({
    parameters: z.array(z.enum(SPLIT_POLICY_PARAMETERS)).optional(),
    rules: z.array(ruleSchema).max(20),
    fallback: fallbackSchema,
    occupancy: occupancySchema.optional(),
  })
  .superRefine((config, ctx) => {
    for (const v of configViolations(config)) {
      ctx.addIssue({
        code: "custom",
        path:
          v.target === "rule" && v.index != null
            ? ["rules", v.index, v.field]
            : ["fallback", v.field],
        message: `${v.field} requires the "${v.parameter}" parameter`,
      })
    }
  })

const nameSchema = z.string().trim().min(1).max(80)

async function assertAuthorOf(
  db: Db,
  user: AuthUser,
  policyId: number,
  propertyId: number,
) {
  const rows = await db
    .select({
      created_by_id: propertySplitPoliciesTable.created_by_id,
      property_id: propertySplitPoliciesTable.property_id,
    })
    .from(propertySplitPoliciesTable)
    .where(eq(propertySplitPoliciesTable.id, policyId))
    .limit(1)
  const policy = rows.at(0)
  if (policy?.property_id !== propertyId) {
    throw new TRPCError({ code: "NOT_FOUND" })
  }
  if (user.is_admin) return
  if (policy.created_by_id !== user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "only the author can edit or delete this policy",
    })
  }
}

export const propertySplitPolicyRouter = router({
  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.property_id)
      const rows = await ctx.db
        .select({
          id: propertySplitPoliciesTable.id,
          property_id: propertySplitPoliciesTable.property_id,
          name: propertySplitPoliciesTable.name,
          config: propertySplitPoliciesTable.config,
          created_by_id: propertySplitPoliciesTable.created_by_id,
          created_by_name: usersTable.name,
          created_at: propertySplitPoliciesTable.created_at,
          updated_at: propertySplitPoliciesTable.updated_at,
        })
        .from(propertySplitPoliciesTable)
        .leftJoin(
          usersTable,
          eq(usersTable.id, propertySplitPoliciesTable.created_by_id),
        )
        .where(eq(propertySplitPoliciesTable.property_id, input.property_id))
        .orderBy(asc(propertySplitPoliciesTable.name))
      return rows.map(toWirePolicy)
    }),

  save: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        property_id: z.number().int().positive(),
        name: nameSchema,
        config: configSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.property_id)
      if (input.id == null) {
        const [created] = await ctx.db
          .insert(propertySplitPoliciesTable)
          .values({
            property_id: input.property_id,
            name: input.name,
            config: input.config,
            created_by_id: ctx.user.id,
          })
          .returning()
        return toWirePolicy(created)
      }
      await assertAuthorOf(ctx.db, ctx.user, input.id, input.property_id)
      const [updated] = await ctx.db
        .update(propertySplitPoliciesTable)
        .set({
          name: input.name,
          config: input.config,
          updated_at: new Date(),
        })
        .where(
          and(
            eq(propertySplitPoliciesTable.id, input.id),
            eq(propertySplitPoliciesTable.property_id, input.property_id),
          ),
        )
        .returning()
      return toWirePolicy(updated)
    }),

  // Persist only the person-day counting definition of an existing policy. The
  // occupancy panel uses this so its Save writes immediately, independent of the
  // full policy save. Occupancy is resolved against the policy's own parameters
  // so the stored value keeps the config invariants.
  updateOccupancy: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        property_id: z.number().int().positive(),
        occupancy: occupancySchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.property_id)
      await assertAuthorOf(ctx.db, ctx.user, input.id, input.property_id)
      const rows = await ctx.db
        .select({ config: propertySplitPoliciesTable.config })
        .from(propertySplitPoliciesTable)
        .where(eq(propertySplitPoliciesTable.id, input.id))
        .limit(1)
      const existing = rows.at(0)
      if (existing == null) throw new TRPCError({ code: "NOT_FOUND" })
      const parameters = normalizeParameters(existing.config.parameters)
      const config = {
        ...existing.config,
        occupancy: resolveOccupancy(
          { ...existing.config, occupancy: input.occupancy },
          parameters,
        ),
      }
      const [updated] = await ctx.db
        .update(propertySplitPoliciesTable)
        .set({ config, updated_at: new Date() })
        .where(
          and(
            eq(propertySplitPoliciesTable.id, input.id),
            eq(propertySplitPoliciesTable.property_id, input.property_id),
          ),
        )
        .returning()
      return toWirePolicy(updated)
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        property_id: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.property_id)
      await assertAuthorOf(ctx.db, ctx.user, input.id, input.property_id)
      const [deleted] = await ctx.db
        .delete(propertySplitPoliciesTable)
        .where(
          and(
            eq(propertySplitPoliciesTable.id, input.id),
            eq(propertySplitPoliciesTable.property_id, input.property_id),
          ),
        )
        .returning()
      return toWirePolicy(deleted)
    }),
})

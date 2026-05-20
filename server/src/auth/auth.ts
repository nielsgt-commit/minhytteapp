import { and, eq, isNull } from "drizzle-orm"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink } from "better-auth/plugins"
import { db } from "../db/client.ts"
import {
  accountsTable,
  sessionsTable,
  verificationsTable,
} from "../db/schema/auth.schema.ts"
import { propertyOwnersTable } from "../db/schema/property.schema.ts"
import {
  allowedEmailsTable,
  userGroupMembersTable,
  usersTable,
} from "../db/schema/users.schema.ts"

async function applyInvitesForNewUser(new_user_id: number, email: string) {
  const lower = email.trim().toLowerCase()
  const invites = await db
    .select({
      id: allowedEmailsTable.id,
      property_id: allowedEmailsTable.property_id,
      user_group_id: allowedEmailsTable.user_group_id,
      ownership_pct: allowedEmailsTable.ownership_pct,
    })
    .from(allowedEmailsTable)
    .where(
      and(
        eq(allowedEmailsTable.email, lower),
        isNull(allowedEmailsTable.used_at),
      ),
    )
  if (invites.length === 0) return

  const groupIds = new Set<number>()
  for (const inv of invites) {
    if (inv.user_group_id != null) groupIds.add(inv.user_group_id)
  }
  if (groupIds.size > 0) {
    await db
      .insert(userGroupMembersTable)
      .values(
        [...groupIds].map(gid => ({
          user_group_id: gid,
          user_id: new_user_id,
        })),
      )
      .onConflictDoNothing()
  }

  for (const inv of invites) {
    if (inv.property_id != null && inv.ownership_pct != null) {
      await db
        .insert(propertyOwnersTable)
        .values({
          property_id: inv.property_id,
          user_id: new_user_id,
          ownership_pct: inv.ownership_pct,
        })
        .onConflictDoNothing()
    }
  }

  const now = new Date()
  for (const inv of invites) {
    await db
      .update(allowedEmailsTable)
      .set({ used_at: now, used_by_user_id: new_user_id })
      .where(eq(allowedEmailsTable.id, inv.id))
  }
}

async function isEmailAllowed(email: string): Promise<boolean> {
  const lower = email.trim().toLowerCase()
  const userHit = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, lower))
    .limit(1)
  if (userHit.length > 0) return true
  const allowHit = await db
    .select({ id: allowedEmailsTable.id })
    .from(allowedEmailsTable)
    .where(eq(allowedEmailsTable.email, lower))
    .limit(1)
  return allowHit.length > 0
}

const secret = process.env.BETTER_AUTH_SECRET
if (!secret) throw new Error("BETTER_AUTH_SECRET is not set")

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: {
      users: usersTable,
      sessions: sessionsTable,
      accounts: accountsTable,
      verifications: verificationsTable,
    },
  }),
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:5173",
  trustedOrigins: [
    process.env.CORS_ORIGIN ?? "http://localhost:5173",
  ],
  advanced: { database: { generateId: "serial" } },
  user: {
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    additionalFields: {
      is_admin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      is_head: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      is_child: {
        type: "boolean",
        required: false,
        input: false,
      },
      parent_user_id: {
        type: "number",
        required: false,
        input: false,
      },
      settlement_progress: {
        type: "string",
        required: false,
        defaultValue: "in_progress",
        input: false,
      },
      birthday: {
        type: "string",
        required: false,
      },
    },
  },
  session: {
    fields: {
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      userId: "user_id",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    fields: {
      accountId: "account_id",
      providerId: "provider_id",
      userId: "user_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async user => {
          await applyInvitesForNewUser(Number(user.id), user.email)
        },
      },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const allowed = await isEmailAllowed(email)
        if (!allowed) {
          if (process.env.NODE_ENV !== "production") {
            console.log(`[magic-link] blocked (not on allowlist) -> ${email}`)
          }
          return
        }
        if (process.env.NODE_ENV !== "production") {
          console.log(`[magic-link] ${email} -> ${url}`)
          return
        }
        throw new Error("Email transport not configured for production")
      },
    }),
  ],
})

export type Auth = typeof auth

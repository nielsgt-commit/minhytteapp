import { and, eq, isNull, sql } from "drizzle-orm"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink } from "better-auth/plugins"
import { Resend } from "resend"
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
import { isSyntheticEmail, normalizeEmail } from "./email.ts"

async function applyInvitesForNewUser(new_user_id: number, email: string) {
  const lower = normalizeEmail(email)
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
        eq(sql`lower(${allowedEmailsTable.email})`, lower),
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
    if (
      inv.property_id != null &&
      inv.ownership_pct != null &&
      inv.user_group_id != null
    ) {
      const propertyId = inv.property_id
      const groupId = inv.user_group_id
      const existing = (
        await db
          .select({
            id: propertyOwnersTable.id,
            ownership_pct: propertyOwnersTable.ownership_pct,
          })
          .from(propertyOwnersTable)
          .where(
            and(
              eq(propertyOwnersTable.property_id, propertyId),
              eq(propertyOwnersTable.user_group_id, groupId),
            ),
          )
          .limit(1)
      ).at(0)
      if (existing) {
        const summed = (
          Number(existing.ownership_pct) + Number(inv.ownership_pct)
        ).toFixed(2)
        await db
          .update(propertyOwnersTable)
          .set({ ownership_pct: summed })
          .where(eq(propertyOwnersTable.id, existing.id))
      } else {
        await db.insert(propertyOwnersTable).values({
          property_id: propertyId,
          user_group_id: groupId,
          ownership_pct: inv.ownership_pct,
        })
      }
    }
  }

  const now = new Date()
  for (const inv of invites) {
    await db
      .update(allowedEmailsTable)
      .set({ used_at: now, used_by_user_id: new_user_id })
      .where(eq(allowedEmailsTable.id, inv.id))
  }

  // The invitee is joining an existing property — they have nothing to set
  // up, so skip the onboarding wizard.
  await db
    .update(usersTable)
    .set({ onboarding_step: "done" })
    .where(eq(usersTable.id, new_user_id))
}

async function isEmailAllowed(email: string): Promise<boolean> {
  const lower = normalizeEmail(email)
  if (isSyntheticEmail(lower)) return false
  const userHit = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, lower))
    .limit(1)
  if (userHit.length > 0) return true
  const allowHit = await db
    .select({ id: allowedEmailsTable.id })
    .from(allowedEmailsTable)
    .where(eq(sql`lower(${allowedEmailsTable.email})`, lower))
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
  trustedOrigins: [process.env.CORS_ORIGIN ?? "http://localhost:5173"],
  advanced: {
    database: { generateId: "serial" },
    // Render's load balancer terminates TLS and sets X-Forwarded-For with the
    // real client IP. Without this, `sessionsTable.ip_address` and the
    // built-in rate limiter would see Render's internal LB IP for every
    // request. better-auth defaults to ["x-forwarded-for"], but declaring it
    // explicitly so the choice is documented in our code.
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for"],
    },
  },
  // Default window/max apply to all /api/auth/* paths; the magic-link
  // issuance endpoint gets a tighter rule because each request triggers
  // an outbound email.
  rateLimit: {
    window: 60,
    max: 100,
    customRules: {
      // Per-IP via x-forwarded-for. Per-email throttling deferred to edge
      // (Cloudflare/Render) once that's in place.
      "/sign-in/magic-link": { window: 60, max: 3 },
    },
  },
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
      birthday: {
        type: "string",
        required: false,
      },
      onboarding_step: {
        type: "string",
        required: false,
        input: false,
      },
      onboarding_dismissed_at: {
        type: "date",
        required: false,
        input: false,
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
        // Lowercase the email before insert so the DB never accumulates
        // mixed-case rows. The eventual unique(lower(email)) index (deploy-2)
        // assumes this invariant.
        before: user =>
          Promise.resolve({
            data: { ...user, email: normalizeEmail(user.email) },
          }),
        after: async user => {
          await applyInvitesForNewUser(Number(user.id), user.email)
        },
      },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const lower = normalizeEmail(email)
        const allowed = await isEmailAllowed(lower)
        if (!allowed) {
          if (process.env.NODE_ENV !== "production") {
            console.log(`[magic-link] blocked (not on allowlist) -> ${lower}`)
          }
          return
        }
        if (process.env.NODE_ENV !== "production") {
          console.log(`[magic-link] ${lower} -> ${url}`)
          return
        }
        const apiKey = process.env.RESEND_API_KEY
        const from = process.env.MAGIC_LINK_FROM
        if (!apiKey) throw new Error("RESEND_API_KEY is not set")
        if (!from) throw new Error("MAGIC_LINK_FROM is not set")
        const resend = new Resend(apiKey)
        const { error } = await resend.emails.send({
          from,
          to: lower,
          subject: "Sign in to minhytte.app",
          html: `<p>Click the link below to sign in:</p>
<p><a href="${url}">Sign in to minhytte.app</a></p>
<p>The link expires shortly. If you didn't request this, ignore the email.</p>`,
        })
        if (error) {
          throw new Error(`Resend send failed: ${error.message}`)
        }
      },
    }),
  ],
})

export type Auth = typeof auth

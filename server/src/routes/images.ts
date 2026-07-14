import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import sharp from "sharp"
import { TRPCError } from "@trpc/server"
import { auth } from "../auth/auth.ts"
import { db } from "../db/client.ts"
import { imagesTable } from "../db/schema/images.schema.ts"
import { assertPropertyMember } from "../trpc/init.ts"
import {
  resolvePropertyIdFromEquipment,
  resolvePropertyIdFromInfrastructure,
  resolvePropertyIdFromStructure,
} from "../trpc/util/propertyAccess.ts"

// Binary upload/serving lives outside tRPC: superjson-over-JSON is a poor fit
// for multipart bodies and image bytes. Everything else about covers (listing
// ids, removal) stays in the typed routers.

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_DIMENSION = 1600
const WEBP_QUALITY = 80

const coverTargets = ["structure", "infrastructure", "equipment"] as const
type CoverTarget = (typeof coverTargets)[number]

const targetResolvers: Record<
  CoverTarget,
  (dbc: typeof db, id: number) => Promise<number>
> = {
  structure: resolvePropertyIdFromStructure,
  infrastructure: resolvePropertyIdFromInfrastructure,
  equipment: resolvePropertyIdFromEquipment,
}

const targetColumns = {
  structure: imagesTable.structure_id,
  infrastructure: imagesTable.infrastructure_id,
  equipment: imagesTable.equipment_id,
} as const

type SessionUser = { id: number; is_admin: boolean }

async function getSessionUser(headers: Headers): Promise<SessionUser | null> {
  const result = await auth.api.getSession({ headers })
  if (!result) return null
  const raw = result.user as unknown as {
    id: number | string
    is_admin?: boolean
  }
  return { id: Number(raw.id), is_admin: raw.is_admin === true }
}

function trpcErrorStatus(err: unknown): number | null {
  if (!(err instanceof TRPCError)) return null
  if (err.code === "FORBIDDEN") return 403
  if (err.code === "NOT_FOUND") return 404
  return 500
}

export const imagesRoute = new Hono()

imagesRoute.post(
  "/cover",
  bodyLimit({
    maxSize: MAX_UPLOAD_BYTES,
    onError: c => c.json({ error: "file too large" }, 413),
  }),
  async c => {
    const user = await getSessionUser(c.req.raw.headers)
    if (!user) return c.json({ error: "unauthorized" }, 401)

    const body = await c.req.parseBody()
    const file = body.file
    const target = body.target
    const targetId = Number(body.target_id)

    if (!(file instanceof File)) {
      return c.json({ error: "file is required" }, 400)
    }
    if (
      typeof target !== "string" ||
      !coverTargets.includes(target as CoverTarget) ||
      !Number.isInteger(targetId) ||
      targetId <= 0
    ) {
      return c.json({ error: "invalid target" }, 400)
    }

    let propertyId: number
    try {
      propertyId = await targetResolvers[target as CoverTarget](db, targetId)
      await assertPropertyMember(db, user, propertyId)
    } catch (err) {
      const status = trpcErrorStatus(err)
      if (status === 403) return c.json({ error: "forbidden" }, 403)
      if (status === 404) return c.json({ error: "not found" }, 404)
      throw err
    }

    let data: Buffer
    let width: number
    let height: number
    try {
      const processed = await sharp(Buffer.from(await file.arrayBuffer()))
        .autoOrient()
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true })
      data = processed.data
      width = processed.info.width
      height = processed.info.height
    } catch {
      return c.json({ error: "unsupported image" }, 400)
    }

    // Replace = delete + insert, never update-in-place: image ids stay
    // immutable so the GET route below can be cached as such.
    const targetColumn = targetColumns[target as CoverTarget]
    const imageId = await db.transaction(async tx => {
      await tx.delete(imagesTable).where(eq(targetColumn, targetId))
      const [created] = await tx
        .insert(imagesTable)
        .values({
          property_id: propertyId,
          structure_id: target === "structure" ? targetId : null,
          infrastructure_id: target === "infrastructure" ? targetId : null,
          equipment_id: target === "equipment" ? targetId : null,
          data,
          mime_type: "image/webp",
          width,
          height,
          uploaded_by: user.id,
        })
        .returning({ id: imagesTable.id })
      return created.id
    })

    return c.json({ image_id: imageId })
  },
)

imagesRoute.get("/:id", async c => {
  const user = await getSessionUser(c.req.raw.headers)
  if (!user) return c.json({ error: "unauthorized" }, 401)

  const id = Number(c.req.param("id"))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: "invalid id" }, 400)
  }

  const row = (
    await db
      .select({
        property_id: imagesTable.property_id,
        mime_type: imagesTable.mime_type,
        data: imagesTable.data,
      })
      .from(imagesTable)
      .where(eq(imagesTable.id, id))
      .limit(1)
  ).at(0)
  if (!row) return c.json({ error: "not found" }, 404)

  try {
    await assertPropertyMember(db, user, row.property_id)
  } catch (err) {
    if (trpcErrorStatus(err) === 403) return c.json({ error: "forbidden" }, 403)
    throw err
  }

  return c.body(new Uint8Array(row.data), 200, {
    "Content-Type": row.mime_type,
    // Ids are immutable (replace mints a new row), so the browser may cache
    // hard. "private": membership-gated content must not land in shared caches.
    "Cache-Control": "private, max-age=31536000, immutable",
  })
})

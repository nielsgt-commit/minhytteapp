import { z } from "zod"

export const selectionSearchSchema = z.object({
  property: z.coerce.number().int().positive().optional().catch(undefined),
  user: z.coerce.number().int().positive().optional().catch(undefined),
})

export type SelectionSearch = z.infer<typeof selectionSearchSchema>

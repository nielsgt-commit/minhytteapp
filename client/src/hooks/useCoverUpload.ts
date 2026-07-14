import { useTranslation } from "react-i18next"
import type { UseMutationResult } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"

export type CoverTarget = "structure" | "infrastructure" | "equipment"

// Multipart cover-photo upload (lives outside tRPC — see server/src/routes/
// images.ts). Invalidates the target's list query so the new image_id renders.
export function useCoverUpload(
  target: CoverTarget,
  targetId: number,
): UseMutationResult<null, Error, File> {
  const { t } = useTranslation("shared")
  const trpc = useTRPC()

  const invalidateKeys =
    target === "structure"
      ? [trpc.structure.listForProperty.queryKey()]
      : target === "infrastructure"
        ? [trpc.infrastructure.listForProperty.queryKey()]
        : [trpc.equipment.listForProperty.queryKey()]

  return useMutationWithInvalidation<null, Error, File>(
    {
      mutationFn: async (file: File) => {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("target", target)
        fd.append("target_id", String(targetId))
        const res = await fetch("/api/images/cover", {
          method: "POST",
          body: fd,
        })
        if (!res.ok) {
          throw new Error(
            res.status === 413
              ? t("The photo is too large (max 10 MB).")
              : t("Could not upload the photo."),
          )
        }
        return null
      },
    },
    invalidateKeys,
  )
}

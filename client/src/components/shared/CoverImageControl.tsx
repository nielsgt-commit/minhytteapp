import { useRef } from "react"
import { Button } from "@digdir/designsystemet-react"
import { CameraIcon, TrashIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useCoverUpload, type CoverTarget } from "@/hooks/useCoverUpload"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import styles from "./CoverImageControl.module.css"

type Props = {
  target: CoverTarget
  targetId: number
  imageId: number | null
  name: string
  canEdit: boolean
}

export function coverImageUrl(imageId: number): string {
  return `/api/images/${String(imageId)}`
}

// Cover photo for a structure or piece of equipment: shows the current image
// and, for editors, lets them add/replace (multipart POST outside tRPC) or
// remove it. The image URL is keyed by an immutable image id, so a successful
// upload only needs the list query invalidated for the new id to render.
export function CoverImageControl({
  target,
  targetId,
  imageId,
  name,
  canEdit,
}: Props) {
  const { t } = useTranslation("shared")
  const trpc = useTRPC()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const invalidateKeys =
    target === "structure"
      ? [trpc.structure.listForProperty.queryKey()]
      : target === "infrastructure"
        ? [trpc.infrastructure.listForProperty.queryKey()]
        : [trpc.equipment.listForProperty.queryKey()]

  const upload = useCoverUpload(target, targetId)

  const removeStructureCover = useMutationWithInvalidation(
    trpc.structure.removeCover.mutationOptions(),
    invalidateKeys,
  )
  const removeInfrastructureCover = useMutationWithInvalidation(
    trpc.infrastructure.removeCover.mutationOptions(),
    invalidateKeys,
  )
  const removeEquipmentCover = useMutationWithInvalidation(
    trpc.equipment.removeCover.mutationOptions(),
    invalidateKeys,
  )
  const remove =
    target === "structure"
      ? removeStructureCover
      : target === "infrastructure"
        ? removeInfrastructureCover
        : removeEquipmentCover

  const pending = upload.isPending || remove.isPending

  if (imageId == null && !canEdit) return null

  return (
    <div className={styles.wrap}>
      <ErrorAlert error={upload.error ?? remove.error} />
      {imageId != null && (
        <img
          src={coverImageUrl(imageId)}
          alt={t("Photo of {{name}}", { name })}
          className={styles.image}
        />
      )}
      {canEdit && (
        <div className={styles.controls}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={e => {
              const file = e.currentTarget.files?.[0]
              e.currentTarget.value = ""
              if (file) upload.mutate(file)
            }}
          />
          <Button
            variant="tertiary"
            data-size="sm"
            disabled={pending}
            onClick={() => {
              fileInputRef.current?.click()
            }}
          >
            <CameraIcon aria-hidden fontSize="1.25rem" />
            {imageId == null
              ? upload.isPending
                ? t("Uploading photo…")
                : t("Add photo")
              : t("Replace photo")}
          </Button>
          {imageId != null && (
            <Button
              variant="tertiary"
              data-color="danger"
              data-size="sm"
              disabled={pending}
              onClick={() => {
                remove.mutate({ id: targetId })
              }}
            >
              <TrashIcon aria-hidden fontSize="1.25rem" />
              {t("Remove photo")}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

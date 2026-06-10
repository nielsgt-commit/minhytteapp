import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Button, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdNumber, fdString } from "@/utils/formData"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import styles from "./AddStructureFlow.module.css"

type Props = {
  onAdded?: () => void
  onCancel?: () => void
}

export function AddStructureFlow({ onAdded, onCancel }: Props) {
  const { t } = useTranslation("property")
  const trpc = useTRPC()

  const selectedPropertyId = useSelectedPropertyId()

  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )

  const createStructure = useMutationWithInvalidation(
    trpc.structure.create.mutationOptions(),
    [trpc.structure.listForProperty.queryKey()],
  )

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  const handleAddStructure = async (fd: FormData) => {
    if (!selectedProperty) return
    const name = fdString(fd, "name").trim()
    if (!name) return
    const yearRaw = fdNumber(fd, "built_year")
    const built_year = Number.isFinite(yearRaw) ? yearRaw : undefined
    try {
      await createStructure.mutateAsync({
        name,
        property_id: selectedProperty.id,
        built_year,
      })
      onAdded?.()
    } catch {
      /* surfaced via ErrorAlert below */
    }
  }

  if (!selectedProperty) {
    return <p>{t("No property selected. Pick one from the header.")}</p>
  }

  return (
    <>
      <ErrorAlert error={createStructure.error} />

      <form action={handleAddStructure} className={styles.form}>
        <Textfield
          label={t("Name")}
          name="name"
          required
          autoFocus
          disabled={createStructure.isPending}
        />
        <Textfield
          label={t("Built year")}
          name="built_year"
          type="number"
          min={1500}
          max={2100}
          step={1}
          inputMode="numeric"
          disabled={createStructure.isPending}
        />
        <div className={styles.actions}>
          <SubmitButton>{t("Add structure")}</SubmitButton>
          {onCancel && (
            <Button
              type="button"
              variant="tertiary"
              disabled={createStructure.isPending}
              onClick={onCancel}
            >
              {t("Cancel")}
            </Button>
          )}
        </div>
      </form>
    </>
  )
}

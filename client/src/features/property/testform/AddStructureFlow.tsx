import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { type SyntheticEvent } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdNumber, fdString } from "@/utils/formData"
import styles from "./AddStructureFlow.module.css"

type Props = {
  onAdded?: () => void
  onCancel?: () => void
}

export function AddStructureFlow({ onAdded, onCancel }: Props) {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const qc = useQueryClient()

  const selectedPropertyId = useSelectedPropertyId()

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

  const invalidateStructures = () => {
    void qc.invalidateQueries({ queryKey: trpc.structure.list.queryKey() })
  }

  const createStructure = useMutation(
    trpc.structure.create.mutationOptions({ onSuccess: invalidateStructures }),
  )

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  const handleAddStructure = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedProperty) return
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    if (!name) return
    const yearRaw = fdNumber(fd, "built_year")
    const built_year = Number.isFinite(yearRaw) ? yearRaw : undefined
    createStructure.mutate(
      { name, property_id: selectedProperty.id, built_year },
      {
        onSuccess: () => {
          form.reset()
          onAdded?.()
        },
      },
    )
  }

  if (!selectedProperty) {
    return <p>{t("No property selected. Pick one from the header.")}</p>
  }

  return (
    <>
      {createStructure.error && (
        <p role="alert">
          {t("Error: {{message}}", { message: createStructure.error.message })}
        </p>
      )}

      <form onSubmit={handleAddStructure} className={styles.form}>
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
          <Button type="submit" disabled={createStructure.isPending}>
            {t("Add structure")}
          </Button>
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

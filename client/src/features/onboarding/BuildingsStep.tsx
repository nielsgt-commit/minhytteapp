import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Button, Card, Heading, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { fdNumber, fdString } from "@/utils/formData"
import { useCanEdit } from "@/hooks/useCanEdit"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { useToggleState } from "@/hooks/useToggleState"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { InlineEditRow } from "@/components/shared/InlineEditRow"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import listStyles from "./StepList.module.css"

type Props = {
  propertyId: number
}

type Structure = {
  id: number
  name: string
  property_id: number | null
  built_year: number | null
}

export function BuildingsStep({ propertyId }: Props) {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()
  const canEdit = useCanEdit()
  const adding = useToggleState()
  const [editingId, setEditingId] = useState<number | null>(null)

  const { data: structures } = useSuspenseQuery(
    trpc.structure.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const structureKeys = [
    trpc.structure.listForProperty.queryKey({ property_id: propertyId }),
  ]
  const createStructure = useMutationWithInvalidation(
    trpc.structure.create.mutationOptions(),
    structureKeys,
  )
  const updateStructure = useMutationWithInvalidation(
    trpc.structure.update.mutationOptions(),
    structureKeys,
  )
  const deleteStructure = useMutationWithInvalidation(
    trpc.structure.delete.mutationOptions(),
    structureKeys,
  )

  const { error: lastError, pending } = useMutationsStatus(
    createStructure,
    updateStructure,
    deleteStructure,
  )

  const handleAdd = async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    const yearRaw = fdNumber(fd, "built_year")
    const built_year = Number.isFinite(yearRaw) ? yearRaw : undefined
    try {
      await createStructure.mutateAsync({
        name,
        property_id: propertyId,
        built_year,
      })
      adding.close()
    } catch {
      /* surfaced via lastError */
    }
  }

  const handleSave = (s: Structure) => async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    const yearRaw = fdNumber(fd, "built_year")
    const built_year = Number.isFinite(yearRaw) ? yearRaw : null
    try {
      await updateStructure.mutateAsync({
        id: s.id,
        name,
        property_id: propertyId,
        built_year,
      })
      setEditingId(null)
    } catch {
      /* surfaced via lastError */
    }
  }

  const handleDelete = (s: Structure) => {
    if (!window.confirm(t('Delete building "{{name}}"?', { name: s.name })))
      return
    deleteStructure.mutate(
      { id: s.id },
      {
        onSuccess: () => {
          setEditingId(null)
        },
      },
    )
  }

  const renderEditForm = (s: Structure) => (
    <form
      action={handleSave(s)}
      key={`edit-${String(s.id)}`}
      className={listStyles.addForm}
    >
      <Textfield
        label={t("Name")}
        name="name"
        type="text"
        required
        autoFocus
        defaultValue={s.name}
        disabled={updateStructure.isPending}
      />
      <Textfield
        label={t("Built year (optional)")}
        name="built_year"
        type="number"
        min={1500}
        max={2100}
        step={1}
        inputMode="numeric"
        defaultValue={s.built_year ?? ""}
        disabled={updateStructure.isPending}
      />
      <div className={listStyles.actions}>
        <SubmitButton>{t("Save")}</SubmitButton>
        <Button
          type="button"
          variant="tertiary"
          disabled={pending}
          onClick={() => {
            setEditingId(null)
          }}
        >
          {t("Cancel")}
        </Button>
      </div>
    </form>
  )

  return (
    <section>
      <Heading level={3}>{t("Buildings on the property")}</Heading>
      <p>
        {t(
          "Add each building (cabin, anneks, boathouse, …). You can come back later.",
        )}
      </p>

      <ErrorAlert error={lastError} />

      <ul className={listStyles.list}>
        {structures.map(s => (
          <Card asChild key={s.id}>
            <li>
              <Card.Block className={listStyles.row}>
                <InlineEditRow
                  editing={editingId === s.id}
                  canEdit={canEdit}
                  pending={pending}
                  editLabel={t("Edit building {{name}}", { name: s.name })}
                  onStartEdit={() => {
                    setEditingId(s.id)
                  }}
                  view={
                    <span className={listStyles.rowName}>
                      <strong>{s.name}</strong>
                      {s.built_year != null && <small> ({s.built_year})</small>}
                    </span>
                  }
                  form={renderEditForm(s)}
                  actions={
                    <Button
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      disabled={pending}
                      aria-label={t('Delete building "{{name}}"?', {
                        name: s.name,
                      })}
                      onClick={() => {
                        handleDelete(s)
                      }}
                    >
                      {t("Delete")}
                    </Button>
                  }
                />
              </Card.Block>
            </li>
          </Card>
        ))}

        {canEdit && (
          <Card asChild key="__add">
            <li>
              <Card.Block className={listStyles.addBlock}>
                {adding.value ? (
                  <>
                    <strong>{t("Add a building")}</strong>
                    <form action={handleAdd} className={listStyles.addForm}>
                      <Textfield
                        label={t("Name")}
                        name="name"
                        type="text"
                        required
                        autoFocus
                        disabled={createStructure.isPending}
                      />
                      <Textfield
                        label={t("Built year (optional)")}
                        name="built_year"
                        type="number"
                        min={1500}
                        max={2100}
                        step={1}
                        inputMode="numeric"
                        disabled={createStructure.isPending}
                      />
                      <div className={listStyles.actions}>
                        <SubmitButton>{t("Add building")}</SubmitButton>
                        <Button
                          type="button"
                          variant="tertiary"
                          disabled={createStructure.isPending}
                          onClick={adding.close}
                        >
                          {t("Cancel")}
                        </Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <Button
                    variant="tertiary"
                    className={listStyles.addButton}
                    disabled={pending}
                    onClick={adding.open}
                  >
                    {t("+ Add building")}
                  </Button>
                )}
              </Card.Block>
            </li>
          </Card>
        )}
      </ul>
    </section>
  )
}

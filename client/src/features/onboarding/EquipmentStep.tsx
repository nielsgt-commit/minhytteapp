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

type Equipment = {
  id: number
  name: string
  property_id: number | null
  brand: string | null
  category: string | null
  acquired_year: number | null
}

export function EquipmentStep({ propertyId }: Props) {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()
  const canEdit = useCanEdit()
  const adding = useToggleState()
  const [editingId, setEditingId] = useState<number | null>(null)

  const { data: items } = useSuspenseQuery(
    trpc.equipment.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const keys = [
    trpc.equipment.listForProperty.queryKey({ property_id: propertyId }),
  ]
  const createEquipment = useMutationWithInvalidation(
    trpc.equipment.create.mutationOptions(),
    keys,
  )
  const updateEquipment = useMutationWithInvalidation(
    trpc.equipment.update.mutationOptions(),
    keys,
  )
  const deleteEquipment = useMutationWithInvalidation(
    trpc.equipment.delete.mutationOptions(),
    keys,
  )

  const { error: lastError, pending } = useMutationsStatus(
    createEquipment,
    updateEquipment,
    deleteEquipment,
  )

  const handleAdd = async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    const brand = fdString(fd, "brand").trim()
    const category = fdString(fd, "category").trim()
    const yearRaw = fdNumber(fd, "acquired_year")
    const acquired_year = Number.isFinite(yearRaw) ? yearRaw : null
    try {
      await createEquipment.mutateAsync({
        name,
        property_id: propertyId,
        brand: brand || undefined,
        category: category || undefined,
        acquired_year,
      })
      adding.close()
    } catch {
      /* surfaced via lastError */
    }
  }

  const handleSave = (e: Equipment) => async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    const brand = fdString(fd, "brand").trim()
    const category = fdString(fd, "category").trim()
    const yearRaw = fdNumber(fd, "acquired_year")
    const acquired_year = Number.isFinite(yearRaw) ? yearRaw : null
    try {
      await updateEquipment.mutateAsync({
        id: e.id,
        name,
        property_id: propertyId,
        brand: brand || undefined,
        category: category || undefined,
        acquired_year,
      })
      setEditingId(null)
    } catch {
      /* surfaced via lastError */
    }
  }

  const handleDelete = (e: Equipment) => {
    if (!window.confirm(t('Delete equipment "{{name}}"?', { name: e.name })))
      return
    deleteEquipment.mutate(
      { id: e.id },
      {
        onSuccess: () => {
          setEditingId(null)
        },
      },
    )
  }

  const renderEditForm = (e: Equipment) => (
    <form
      action={handleSave(e)}
      key={`edit-${String(e.id)}`}
      className={listStyles.addForm}
    >
      <Textfield
        label={t("Name")}
        name="name"
        type="text"
        required
        autoFocus
        defaultValue={e.name}
        disabled={updateEquipment.isPending}
      />
      <Textfield
        label={t("Brand (optional)")}
        name="brand"
        type="text"
        defaultValue={e.brand ?? ""}
        disabled={updateEquipment.isPending}
      />
      <Textfield
        label={t("Category (optional)")}
        name="category"
        type="text"
        defaultValue={e.category ?? ""}
        disabled={updateEquipment.isPending}
      />
      <Textfield
        label={t("Acquired year (optional)")}
        name="acquired_year"
        type="number"
        min={1500}
        max={2100}
        step={1}
        inputMode="numeric"
        defaultValue={e.acquired_year ?? ""}
        disabled={updateEquipment.isPending}
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
      <Heading level={3}>{t("Big equipment")}</Heading>
      <p>
        {t(
          "Lawnmower, boat, snow blower, or any vehicle that needs regular inspections?",
        )}
      </p>

      <ErrorAlert error={lastError} />

      <ul className={listStyles.list}>
        {items.map(i => (
          <Card asChild key={i.id}>
            <li>
              <Card.Block className={listStyles.row}>
                <InlineEditRow
                  editing={editingId === i.id}
                  canEdit={canEdit}
                  pending={pending}
                  editLabel={t("Edit equipment {{name}}", { name: i.name })}
                  onStartEdit={() => {
                    setEditingId(i.id)
                  }}
                  view={
                    <span className={listStyles.rowName}>
                      <strong>{i.name}</strong>
                      {i.brand && <span> – {i.brand}</span>}
                      {i.acquired_year != null && (
                        <small> ({i.acquired_year})</small>
                      )}
                    </span>
                  }
                  form={renderEditForm(i)}
                  actions={
                    <Button
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      disabled={pending}
                      aria-label={t('Delete equipment "{{name}}"?', {
                        name: i.name,
                      })}
                      onClick={() => {
                        handleDelete(i)
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
                    <strong>{t("Add equipment")}</strong>
                    <form action={handleAdd} className={listStyles.addForm}>
                      <Textfield
                        label={t("Name")}
                        name="name"
                        type="text"
                        required
                        autoFocus
                        disabled={createEquipment.isPending}
                      />
                      <Textfield
                        label={t("Brand (optional)")}
                        name="brand"
                        type="text"
                        disabled={createEquipment.isPending}
                      />
                      <Textfield
                        label={t("Category (optional)")}
                        name="category"
                        type="text"
                        disabled={createEquipment.isPending}
                      />
                      <Textfield
                        label={t("Acquired year (optional)")}
                        name="acquired_year"
                        type="number"
                        min={1500}
                        max={2100}
                        step={1}
                        inputMode="numeric"
                        disabled={createEquipment.isPending}
                      />
                      <div className={listStyles.actions}>
                        <SubmitButton>{t("Add equipment")}</SubmitButton>
                        <Button
                          type="button"
                          variant="tertiary"
                          disabled={createEquipment.isPending}
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
                    {t("+ Add equipment")}
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

import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Fieldset,
  List,
  Paragraph,
  Textfield,
  ValidationMessage,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdString } from "@/utils/formData"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useToggleState } from "@/hooks/useToggleState"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { useCanEdit } from "@/hooks/useCanEdit"
import { InlineEditRow } from "@/components/shared/InlineEditRow"
import section from "@/features/property/managePropertySection.module.css"
import styles from "./EquipmentPanel.module.css"

type Props = {
  propertyId: number
  propertyName: string
}

type Equipment = {
  id: number
  name: string
  property_id: number
  brand: string | null
  model: string | null
  category: string | null
  notes: string | null
  acquired_year: number | null
}

function fdYear(fd: FormData, key: string): number | null {
  const raw = fdString(fd, key).trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1500 && n <= 2100 ? n : null
}

export function EquipmentPanel({ propertyId }: Props) {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const canEdit = useCanEdit()

  const { data: equipment } = useSuspenseQuery(
    trpc.equipment.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const equipmentKeys = [
    trpc.equipment.listForProperty.queryKey({ property_id: propertyId }),
  ]
  const createEquipment = useMutationWithInvalidation(
    trpc.equipment.create.mutationOptions(),
    equipmentKeys,
  )
  const updateEquipment = useMutationWithInvalidation(
    trpc.equipment.update.mutationOptions(),
    equipmentKeys,
  )
  const deleteEquipment = useMutationWithInvalidation(
    trpc.equipment.delete.mutationOptions(),
    equipmentKeys,
  )

  const [editingId, setEditingId] = useState<number | null>(null)
  const adding = useToggleState()

  const { pending, error: lastError } = useMutationsStatus(
    createEquipment,
    updateEquipment,
    deleteEquipment,
  )

  const handleAdd = async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    const brand = fdString(fd, "brand").trim()
    const model = fdString(fd, "model").trim()
    const category = fdString(fd, "category").trim()
    const notes = fdString(fd, "notes").trim()
    const acquired_year = fdYear(fd, "acquired_year")
    try {
      await createEquipment.mutateAsync({
        name,
        property_id: propertyId,
        brand: brand || undefined,
        model: model || undefined,
        category: category || undefined,
        notes: notes || undefined,
        acquired_year,
      })
      adding.close()
    } catch {
      /* surfaced via useMutationsStatus lastError */
    }
  }

  const handleSave = (item: Equipment) => async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    const brand = fdString(fd, "brand").trim()
    const model = fdString(fd, "model").trim()
    const category = fdString(fd, "category").trim()
    const notes = fdString(fd, "notes").trim()
    const acquired_year = fdYear(fd, "acquired_year")
    if (!name) return
    try {
      await updateEquipment.mutateAsync({
        id: item.id,
        name,
        property_id: propertyId,
        brand: brand || undefined,
        model: model || undefined,
        category: category || undefined,
        notes: notes || undefined,
        acquired_year,
      })
      setEditingId(null)
    } catch {
      /* surfaced via useMutationsStatus lastError */
    }
  }

  const handleDelete = (item: Equipment) => {
    if (!window.confirm(t('Delete equipment "{{name}}"?', { name: item.name })))
      return
    deleteEquipment.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          setEditingId(null)
        },
      },
    )
  }

  const renderEditForm = (item: Equipment) => (
    <form
      action={handleSave(item)}
      key={`edit-${String(item.id)}`}
      className={styles.editForm}
    >
      <Fieldset>
        <Fieldset.Legend>{t("Edit equipment")}</Fieldset.Legend>
        <Textfield
          label={t("Name")}
          name="name"
          required
          autoFocus
          defaultValue={item.name}
          disabled={updateEquipment.isPending}
        />
        <Textfield
          label={t("Brand")}
          name="brand"
          maxLength={64}
          defaultValue={item.brand ?? ""}
          disabled={updateEquipment.isPending}
        />
        <Textfield
          label={t("Model")}
          name="model"
          maxLength={64}
          defaultValue={item.model ?? ""}
          disabled={updateEquipment.isPending}
        />
        <Textfield
          label={t("Category")}
          name="category"
          maxLength={32}
          placeholder={t("appliance, tool, boat…")}
          defaultValue={item.category ?? ""}
          disabled={updateEquipment.isPending}
        />
        <Textfield
          label={t("Notes")}
          name="notes"
          maxLength={255}
          defaultValue={item.notes ?? ""}
          disabled={updateEquipment.isPending}
        />
        <Textfield
          label={t("Acquired")}
          name="acquired_year"
          type="number"
          min={1500}
          max={2100}
          defaultValue={item.acquired_year ?? ""}
          disabled={updateEquipment.isPending}
        />
        <div className={styles.actions}>
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
      </Fieldset>
    </form>
  )

  return (
    <div className={section.column}>
      {lastError && (
        <ValidationMessage>
          {t("Error: {{message}}", { message: lastError.message })}
        </ValidationMessage>
      )}

      <List.Unordered className={styles.list}>
        {equipment.map(item => (
          <Card asChild key={item.id}>
            <List.Item>
              <Card.Block>
                <InlineEditRow
                  editing={editingId === item.id}
                  canEdit={canEdit}
                  pending={pending}
                  editLabel={t("Edit equipment {{name}}", { name: item.name })}
                  onStartEdit={() => {
                    setEditingId(item.id)
                  }}
                  view={
                    <>
                      <span className={styles.rowName}>{item.name}</span>
                      {item.acquired_year != null && (
                        <Paragraph data-size="sm" title={t("Acquired")}>
                          {t("Acquired {{year}}", { year: item.acquired_year })}
                        </Paragraph>
                      )}
                    </>
                  }
                  form={renderEditForm(item)}
                  actions={
                    <Button
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      disabled={pending}
                      aria-label={t('Delete equipment "{{name}}"?', {
                        name: item.name,
                      })}
                      onClick={() => {
                        handleDelete(item)
                      }}
                    >
                      {t("Delete")}
                    </Button>
                  }
                />
              </Card.Block>
            </List.Item>
          </Card>
        ))}

        {canEdit && (
          <Card asChild key="__add">
            <List.Item>
              <Card.Block className={styles.addBlock}>
                {adding.value ? (
                  <>
                    <Paragraph data-weight="medium">
                      {t("Add equipment")}
                    </Paragraph>
                    <form action={handleAdd} className={styles.addForm}>
                      <Fieldset>
                        <Fieldset.Legend>{t("New equipment")}</Fieldset.Legend>
                        <Textfield
                          label={t("Name")}
                          name="name"
                          required
                          autoFocus
                          disabled={createEquipment.isPending}
                        />
                        <Textfield
                          label={t("Brand")}
                          name="brand"
                          maxLength={64}
                          disabled={createEquipment.isPending}
                        />
                        <Textfield
                          label={t("Model")}
                          name="model"
                          maxLength={64}
                          disabled={createEquipment.isPending}
                        />
                        <Textfield
                          label={t("Category")}
                          name="category"
                          maxLength={32}
                          placeholder={t("appliance, tool, boat…")}
                          disabled={createEquipment.isPending}
                        />
                        <Textfield
                          label={t("Notes")}
                          name="notes"
                          maxLength={255}
                          disabled={createEquipment.isPending}
                        />
                        <Textfield
                          label={t("Acquired")}
                          name="acquired_year"
                          type="number"
                          min={1500}
                          max={2100}
                          disabled={createEquipment.isPending}
                        />
                        <div className={styles.actions}>
                          <SubmitButton>{t("Add equipment")}</SubmitButton>
                          <Button
                            type="button"
                            variant="tertiary"
                            disabled={createEquipment.isPending}
                            onClick={() => {
                              adding.close()
                            }}
                          >
                            {t("Cancel")}
                          </Button>
                        </div>
                      </Fieldset>
                    </form>
                  </>
                ) : (
                  <Button
                    variant="tertiary"
                    className={styles.addButton}
                    disabled={pending}
                    onClick={adding.open}
                  >
                    {t("+ Add equipment")}
                  </Button>
                )}
              </Card.Block>
            </List.Item>
          </Card>
        )}
      </List.Unordered>
    </div>
  )
}

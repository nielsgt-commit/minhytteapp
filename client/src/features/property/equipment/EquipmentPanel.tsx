import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Fieldset,
  Switch,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdString } from "@/utils/formData"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
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

export function EquipmentPanel({ propertyId, propertyName }: Props) {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: equipment } = useSuspenseQuery(
    trpc.equipment.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const invalidate = () => {
    void qc.invalidateQueries({
      queryKey: trpc.equipment.listForProperty.queryKey({
        property_id: propertyId,
      }),
    })
  }

  const createEquipment = useMutation(
    trpc.equipment.create.mutationOptions({ onSuccess: invalidate }),
  )
  const updateEquipment = useMutation(
    trpc.equipment.update.mutationOptions({ onSuccess: invalidate }),
  )
  const deleteEquipment = useMutation(
    trpc.equipment.delete.mutationOptions({ onSuccess: invalidate }),
  )

  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const { pending, error: lastError } = useMutationsStatus(
    createEquipment,
    updateEquipment,
    deleteEquipment,
  )

  const editingItem = editingId
    ? equipment.find(e => e.id === editingId) ?? null
    : null

  const handleAdd = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    const brand = fdString(fd, "brand").trim()
    const model = fdString(fd, "model").trim()
    const category = fdString(fd, "category").trim()
    const notes = fdString(fd, "notes").trim()
    const acquired_year = fdYear(fd, "acquired_year")
    if (!name) return
    createEquipment.mutate(
      {
        name,
        property_id: propertyId,
        brand: brand || undefined,
        model: model || undefined,
        category: category || undefined,
        notes: notes || undefined,
        acquired_year,
      },
      {
        onSuccess: () => {
          form.reset()
          setIsAdding(false)
        },
      },
    )
  }

  const handleSave =
    (item: Equipment) => (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      const name = fdString(fd, "name").trim()
      const brand = fdString(fd, "brand").trim()
      const model = fdString(fd, "model").trim()
      const category = fdString(fd, "category").trim()
      const notes = fdString(fd, "notes").trim()
      const acquired_year = fdYear(fd, "acquired_year")
      if (!name) return
      updateEquipment.mutate(
        {
          id: item.id,
          name,
          property_id: propertyId,
          brand: brand || undefined,
          model: model || undefined,
          category: category || undefined,
          notes: notes || undefined,
          acquired_year,
        },
        { onSuccess: () => { setEditingId(null) } },
      )
    }

  const handleDelete = (item: Equipment) => {
    if (!window.confirm(t("Delete equipment \"{{name}}\"?", { name: item.name }))) return
    deleteEquipment.mutate(
      { id: item.id },
      { onSuccess: () => { setEditingId(null) } },
    )
  }

  return (
    <section>
      <h3>{t("Equipment at {{name}}", { name: propertyName })}</h3>

      <Switch
        label={t("Edit mode")}
        checked={editMode}
        onChange={e => {
          const next = e.target.checked
          setEditMode(next)
          if (!next) {
            setEditingId(null)
            setIsAdding(false)
          }
        }}
      />

      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}

      {editingItem ? (
        <form
          onSubmit={handleSave(editingItem)}
          key={`edit-${String(editingItem.id)}`}
          className={styles.editForm}
        >
          <Fieldset>
            <Fieldset.Legend>{t("Edit equipment")}</Fieldset.Legend>
            <Textfield
              label={t("Name")}
              name="name"
              required
              autoFocus
              defaultValue={editingItem.name}
              disabled={updateEquipment.isPending}
            />
            <Textfield
              label={t("Brand")}
              name="brand"
              maxLength={64}
              defaultValue={editingItem.brand ?? ""}
              disabled={updateEquipment.isPending}
            />
            <Textfield
              label={t("Model")}
              name="model"
              maxLength={64}
              defaultValue={editingItem.model ?? ""}
              disabled={updateEquipment.isPending}
            />
            <Textfield
              label={t("Category")}
              name="category"
              maxLength={32}
              placeholder={t("appliance, tool, boat…")}
              defaultValue={editingItem.category ?? ""}
              disabled={updateEquipment.isPending}
            />
            <Textfield
              label={t("Notes")}
              name="notes"
              maxLength={255}
              defaultValue={editingItem.notes ?? ""}
              disabled={updateEquipment.isPending}
            />
            <Textfield
              label={t("Acquired")}
              name="acquired_year"
              type="number"
              min={1500}
              max={2100}
              defaultValue={editingItem.acquired_year ?? ""}
              disabled={updateEquipment.isPending}
            />
            <div className={styles.actions}>
              <Button type="submit" disabled={pending}>
                {t("Save")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                data-color="danger"
                disabled={pending}
                onClick={() => { handleDelete(editingItem) }}
              >
                {t("Delete")}
              </Button>
              <Button
                type="button"
                variant="tertiary"
                disabled={pending}
                onClick={() => { setEditingId(null) }}
              >
                {t("Cancel")}
              </Button>
            </div>
          </Fieldset>
        </form>
      ) : (
        <ul className={styles.list}>
          {equipment.map(item => (
            <Card asChild key={item.id}>
              <li>
                <Card.Block className={styles.row}>
                  <span className={styles.rowName}>{item.name}</span>
                  {item.acquired_year != null && (
                    <small title={t("Acquired")}>
                      {t("Acquired {{year}}", { year: item.acquired_year })}
                    </small>
                  )}
                  {editMode && (
                    <>
                      <Button
                        variant="tertiary"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => { setEditingId(item.id) }}
                      >
                        {t("Edit")}
                      </Button>
                      <Button
                        variant="tertiary"
                        data-color="danger"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => { handleDelete(item) }}
                      >
                        {t("Delete")}
                      </Button>
                    </>
                  )}
                </Card.Block>
              </li>
            </Card>
          ))}

          <Card asChild key="__add">
            <li>
              <Card.Block className={styles.addBlock}>
                {isAdding ? (
                  <>
                    <strong>{t("Add equipment")}</strong>
                    <form
                      onSubmit={handleAdd}
                      className={styles.addForm}
                    >
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
                          <Button type="submit" disabled={createEquipment.isPending}>
                            {t("Add equipment")}
                          </Button>
                          <Button
                            type="button"
                            variant="tertiary"
                            disabled={createEquipment.isPending}
                            onClick={() => { setIsAdding(false) }}
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
                    onClick={() => { setIsAdding(true) }}
                  >
                    {t("+ Add equipment")}
                  </Button>
                )}
              </Card.Block>
            </li>
          </Card>
        </ul>
      )}
    </section>
  )
}

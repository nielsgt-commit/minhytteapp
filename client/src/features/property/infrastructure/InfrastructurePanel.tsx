import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Switch,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import styles from "./InfrastructurePanel.module.css"

type Props = {
  propertyId: number
  propertyName: string
}

type Infrastructure = {
  id: number
  name: string
  description: string
  property_id: number | null
  since_year: number | null
}

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

function fdYear(fd: FormData, key: string): number | null {
  const raw = fdString(fd, key).trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1500 && n <= 2100 ? n : null
}

export function InfrastructurePanel({ propertyId, propertyName }: Props) {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: infrastructure } = useSuspenseQuery(
    trpc.infrastructure.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const invalidate = () => {
    void qc.invalidateQueries({
      queryKey: trpc.infrastructure.listForProperty.queryKey({
        property_id: propertyId,
      }),
    })
  }

  const createInfrastructure = useMutation(
    trpc.infrastructure.create.mutationOptions({ onSuccess: invalidate }),
  )
  const updateInfrastructure = useMutation(
    trpc.infrastructure.update.mutationOptions({ onSuccess: invalidate }),
  )
  const deleteInfrastructure = useMutation(
    trpc.infrastructure.delete.mutationOptions({ onSuccess: invalidate }),
  )

  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const lastError =
    createInfrastructure.error ?? updateInfrastructure.error ?? deleteInfrastructure.error
  const pending =
    createInfrastructure.isPending || updateInfrastructure.isPending || deleteInfrastructure.isPending

  const editingInfrastructure = editingId
    ? infrastructure.find(p => p.id === editingId) ?? null
    : null

  const handleAdd = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    const description = fdString(fd, "description").trim()
    const since_year = fdYear(fd, "since_year")
    if (!name || !description) return
    createInfrastructure.mutate(
      { name, description, property_id: propertyId, since_year },
      {
        onSuccess: () => {
          form.reset()
          setIsAdding(false)
        },
      },
    )
  }

  const handleSave =
    (p: Infrastructure) => (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      const name = fdString(fd, "name").trim()
      const description = fdString(fd, "description").trim()
      const since_year = fdYear(fd, "since_year")
      if (!name || !description) return
      updateInfrastructure.mutate(
        { id: p.id, name, description, property_id: propertyId, since_year },
        { onSuccess: () => { setEditingId(null) } },
      )
    }

  const handleDelete = (p: Infrastructure) => {
    if (!window.confirm(t("Delete infrastructure \"{{name}}\"?", { name: p.name }))) return
    deleteInfrastructure.mutate(
      { id: p.id },
      { onSuccess: () => { setEditingId(null) } },
    )
  }

  return (
    <section>
      <h3>{t("Infrastructure at {{name}}", { name: propertyName })}</h3>

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

      {editingInfrastructure ? (
        <form
          onSubmit={handleSave(editingInfrastructure)}
          key={`edit-${String(editingInfrastructure.id)}`}
          className={styles.editForm}
        >
          <Textfield
            label={t("Name")}
            name="name"
            required
            autoFocus
            defaultValue={editingInfrastructure.name}
            disabled={updateInfrastructure.isPending}
          />
          <Textfield
            label={t("Description")}
            name="description"
            required
            defaultValue={editingInfrastructure.description}
            disabled={updateInfrastructure.isPending}
          />
          <Textfield
            label={t("Since")}
            name="since_year"
            type="number"
            min={1500}
            max={2100}
            defaultValue={editingInfrastructure.since_year ?? ""}
            disabled={updateInfrastructure.isPending}
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
              onClick={() => { handleDelete(editingInfrastructure) }}
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
        </form>
      ) : (
        <ul className={styles.list}>
          {infrastructure.map(p => (
            <Card asChild key={p.id}>
              <li>
                <Card.Block className={styles.row}>
                  <span className={styles.rowName}>{p.name}</span>
                  {p.since_year != null && (
                    <small title={t("Since")}>
                      {t("Since {{year}}", { year: p.since_year })}
                    </small>
                  )}
                  {editMode && (
                    <>
                      <Button
                        variant="tertiary"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => { setEditingId(p.id) }}
                      >
                        {t("Edit")}
                      </Button>
                      <Button
                        variant="tertiary"
                        data-color="danger"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => { handleDelete(p) }}
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
                    <strong>{t("Add infrastructure")}</strong>
                    <form
                      onSubmit={handleAdd}
                      className={styles.addForm}
                    >
                      <Textfield
                        label={t("Name")}
                        name="name"
                        required
                        autoFocus
                        disabled={createInfrastructure.isPending}
                      />
                      <Textfield
                        label={t("Description")}
                        name="description"
                        required
                        disabled={createInfrastructure.isPending}
                      />
                      <Textfield
                        label={t("Since")}
                        name="since_year"
                        type="number"
                        min={1500}
                        max={2100}
                        disabled={createInfrastructure.isPending}
                      />
                      <div className={styles.actions}>
                        <Button type="submit" disabled={createInfrastructure.isPending}>
                          {t("Add infrastructure")}
                        </Button>
                        <Button
                          type="button"
                          variant="tertiary"
                          disabled={createInfrastructure.isPending}
                          onClick={() => { setIsAdding(false) }}
                        >
                          {t("Cancel")}
                        </Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <Button
                    variant="tertiary"
                    className={styles.addButton}
                    disabled={pending}
                    onClick={() => { setIsAdding(true) }}
                  >
                    {t("+ Add infrastructure")}
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

import { type SyntheticEvent, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdString } from "@/utils/formData"
import { useCanEdit } from "@/hooks/useCanEdit"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useToggleState } from "@/hooks/useToggleState"
import { useFormSubmit } from "@/hooks/useFormSubmit"
import { InlineEditRow } from "@/components/shared/InlineEditRow"
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

function fdYear(fd: FormData, key: string): number | null {
  const raw = fdString(fd, key).trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1500 && n <= 2100 ? n : null
}

export function InfrastructurePanel({ propertyId, propertyName }: Props) {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const canEdit = useCanEdit()

  const { data: infrastructure } = useSuspenseQuery(
    trpc.infrastructure.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const infrastructureKeys = [
    trpc.infrastructure.listForProperty.queryKey({ property_id: propertyId }),
  ]
  const createInfrastructure = useMutationWithInvalidation(
    trpc.infrastructure.create.mutationOptions(),
    infrastructureKeys,
  )
  const updateInfrastructure = useMutationWithInvalidation(
    trpc.infrastructure.update.mutationOptions(),
    infrastructureKeys,
  )
  const deleteInfrastructure = useMutationWithInvalidation(
    trpc.infrastructure.delete.mutationOptions(),
    infrastructureKeys,
  )

  const [editingId, setEditingId] = useState<number | null>(null)
  const adding = useToggleState()

  const lastError =
    createInfrastructure.error ?? updateInfrastructure.error ?? deleteInfrastructure.error
  const pending =
    createInfrastructure.isPending || updateInfrastructure.isPending || deleteInfrastructure.isPending

  const handleAdd = useFormSubmit(
    fd => {
      const name = fdString(fd, "name").trim()
      const description = fdString(fd, "description").trim()
      if (!name || !description) return null
      const since_year = fdYear(fd, "since_year")
      return { name, description, property_id: propertyId, since_year }
    },
    payload => {
      createInfrastructure.mutate(payload, { onSuccess: adding.close })
    },
  )

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

  const renderEditForm = (p: Infrastructure) => (
    <form
      onSubmit={handleSave(p)}
      key={`edit-${String(p.id)}`}
      className={styles.editForm}
    >
      <Textfield
        label={t("Name")}
        name="name"
        required
        autoFocus
        defaultValue={p.name}
        disabled={updateInfrastructure.isPending}
      />
      <Textfield
        label={t("Description")}
        name="description"
        required
        defaultValue={p.description}
        disabled={updateInfrastructure.isPending}
      />
      <Textfield
        label={t("Since")}
        name="since_year"
        type="number"
        min={1500}
        max={2100}
        defaultValue={p.since_year ?? ""}
        disabled={updateInfrastructure.isPending}
      />
      <div className={styles.actions}>
        <Button type="submit" disabled={pending}>
          {t("Save")}
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
  )

  return (
    <section>
      <h3>{t("Infrastructure at {{name}}", { name: propertyName })}</h3>

      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}

      <ul className={styles.list}>
        {infrastructure.map(p => (
          <Card asChild key={p.id}>
            <li>
              <Card.Block className={styles.row}>
                <InlineEditRow
                  editing={editingId === p.id}
                  canEdit={canEdit}
                  pending={pending}
                  editLabel={t("Edit infrastructure {{name}}", { name: p.name })}
                  onStartEdit={() => { setEditingId(p.id) }}
                  view={
                    <>
                      <span className={styles.rowName}>{p.name}</span>
                      {p.since_year != null && (
                        <small title={t("Since")}>
                          {t("Since {{year}}", { year: p.since_year })}
                        </small>
                      )}
                    </>
                  }
                  form={renderEditForm(p)}
                  actions={
                    <Button
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      disabled={pending}
                      aria-label={t("Delete infrastructure \"{{name}}\"?", { name: p.name })}
                      onClick={() => { handleDelete(p) }}
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
              <Card.Block className={styles.addBlock}>
                {adding.value ? (
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
                    className={styles.addButton}
                    disabled={pending}
                    onClick={adding.open}
                  >
                    {t("+ Add infrastructure")}
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

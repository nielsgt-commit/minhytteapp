import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Button, Card, Heading, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdString } from "@/utils/formData"
import { useCanEdit } from "@/hooks/useCanEdit"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useToggleState } from "@/hooks/useToggleState"
import { SubmitButton } from "@/components/shared/SubmitButton"
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
    trpc.infrastructure.listForProperty.queryOptions({
      property_id: propertyId,
    }),
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
    createInfrastructure.error ??
    updateInfrastructure.error ??
    deleteInfrastructure.error
  const pending =
    createInfrastructure.isPending ||
    updateInfrastructure.isPending ||
    deleteInfrastructure.isPending

  const handleAdd = async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    const description = fdString(fd, "description").trim()
    if (!name || !description) return
    const since_year = fdYear(fd, "since_year")
    try {
      await createInfrastructure.mutateAsync({
        name,
        description,
        property_id: propertyId,
        since_year,
      })
      adding.close()
    } catch {
      /* surfaced via useMutationsStatus lastError */
    }
  }

  const handleSave = (p: Infrastructure) => async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    const description = fdString(fd, "description").trim()
    const since_year = fdYear(fd, "since_year")
    if (!name || !description) return
    try {
      await updateInfrastructure.mutateAsync({
        id: p.id,
        name,
        description,
        property_id: propertyId,
        since_year,
      })
      setEditingId(null)
    } catch {
      /* surfaced via useMutationsStatus lastError */
    }
  }

  const handleDelete = (p: Infrastructure) => {
    if (
      !window.confirm(t('Delete infrastructure "{{name}}"?', { name: p.name }))
    )
      return
    deleteInfrastructure.mutate(
      { id: p.id },
      {
        onSuccess: () => {
          setEditingId(null)
        },
      },
    )
  }

  const renderEditForm = (p: Infrastructure) => (
    <form
      action={handleSave(p)}
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
      <Heading level={3}>
        {t("Infrastructure at {{name}}", { name: propertyName })}
      </Heading>

      {lastError && (
        <p role="alert">
          {t("Error: {{message}}", { message: lastError.message })}
        </p>
      )}

      <ul className={styles.list}>
        {infrastructure.map(p => (
          <Card asChild key={p.id}>
            <li>
              <Card.Block className={styles.row}>
                <InlineEditRow
                  editing={editingId === p.id}
                  canEdit={canEdit}
                  pending={pending}
                  editLabel={t("Edit infrastructure {{name}}", {
                    name: p.name,
                  })}
                  onStartEdit={() => {
                    setEditingId(p.id)
                  }}
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
                      aria-label={t('Delete infrastructure "{{name}}"?', {
                        name: p.name,
                      })}
                      onClick={() => {
                        handleDelete(p)
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
              <Card.Block className={styles.addBlock}>
                {adding.value ? (
                  <>
                    <strong>{t("Add infrastructure")}</strong>
                    <form action={handleAdd} className={styles.addForm}>
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
                        <SubmitButton>{t("Add infrastructure")}</SubmitButton>
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

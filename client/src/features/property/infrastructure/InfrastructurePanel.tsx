import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  List,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdString } from "@/utils/formData"
import { useCanEdit } from "@/hooks/useCanEdit"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useToggleState } from "@/hooks/useToggleState"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { InlineEditRow } from "@/components/shared/InlineEditRow"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import section from "@/features/property/managePropertySection.module.css"
import styles from "./InfrastructurePanel.module.css"

type Props = {
  propertyId: number
  propertyName: string
}

type Infrastructure = {
  id: number
  name: string
  description: string | null
  property_id: number | null
  since_year: number | null
}

function fdYear(fd: FormData, key: string): number | null {
  const raw = fdString(fd, key).trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1500 && n <= 2100 ? n : null
}

export function InfrastructurePanel({ propertyId }: Props) {
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

  const { pending, error: lastError } = useMutationsStatus(
    createInfrastructure,
    updateInfrastructure,
    deleteInfrastructure,
  )

  const handleAdd = async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    const description = fdString(fd, "description").trim() || null
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
    if (!name) return
    const description = fdString(fd, "description").trim() || null
    const since_year = fdYear(fd, "since_year")
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
      !window.confirm(
        t('Delete infrastructure "{{name}}"?', { name: p.name }) +
          "\n\n" +
          t(
            "This will also permanently delete any maintenance tasks and inspections linked to it.",
          ),
      )
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
        label={t("Description (optional)")}
        name="description"
        defaultValue={p.description ?? ""}
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
    <div className={section.column}>
      <ErrorAlert error={lastError} />

      <List.Unordered className={styles.list}>
        {canEdit && (
          <Card asChild key="__add">
            <List.Item>
              <Card.Block className={styles.addBlock}>
                {adding.value ? (
                  <>
                    <Paragraph data-weight="medium">
                      {t("Add infrastructure")}
                    </Paragraph>
                    <form action={handleAdd} className={styles.addForm}>
                      <Textfield
                        label={t("Name")}
                        name="name"
                        required
                        autoFocus
                        disabled={createInfrastructure.isPending}
                      />
                      <Textfield
                        label={t("Description (optional)")}
                        name="description"
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
            </List.Item>
          </Card>
        )}

        {infrastructure.map(p => (
          <Card asChild key={p.id}>
            <List.Item>
              <Card.Block>
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
                        <Paragraph data-size="sm" title={t("Since")}>
                          {t("Since {{year}}", { year: p.since_year })}
                        </Paragraph>
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
            </List.Item>
          </Card>
        ))}
      </List.Unordered>
    </div>
  )
}

import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Button, Card, Heading, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { fdNumber, fdString } from "@/utils/formData"
import { useCanEdit } from "@/hooks/useCanEdit"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useToggleState } from "@/hooks/useToggleState"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { InlineEditRow } from "@/components/shared/InlineEditRow"
import listStyles from "./StepList.module.css"

type Props = {
  propertyId: number
}

type Infrastructure = {
  id: number
  name: string
  description: string | null
  property_id: number | null
  since_year: number | null
}

export function InfrastructureStep({ propertyId }: Props) {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()
  const canEdit = useCanEdit()
  const adding = useToggleState()
  const [editingId, setEditingId] = useState<number | null>(null)

  const { data: items } = useSuspenseQuery(
    trpc.infrastructure.listForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  const keys = [
    trpc.infrastructure.listForProperty.queryKey({ property_id: propertyId }),
  ]
  const createInfra = useMutationWithInvalidation(
    trpc.infrastructure.create.mutationOptions(),
    keys,
  )
  const updateInfra = useMutationWithInvalidation(
    trpc.infrastructure.update.mutationOptions(),
    keys,
  )
  const deleteInfra = useMutationWithInvalidation(
    trpc.infrastructure.delete.mutationOptions(),
    keys,
  )

  const lastError = createInfra.error ?? updateInfra.error ?? deleteInfra.error
  const pending =
    createInfra.isPending || updateInfra.isPending || deleteInfra.isPending

  const handleAdd = async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    const description = fdString(fd, "description").trim() || null
    const yearRaw = fdNumber(fd, "since_year")
    const since_year = Number.isFinite(yearRaw) ? yearRaw : undefined
    try {
      await createInfra.mutateAsync({
        name,
        description,
        property_id: propertyId,
        since_year,
      })
      adding.close()
    } catch {
      /* surfaced via lastError */
    }
  }

  const handleSave = (p: Infrastructure) => async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    const description = fdString(fd, "description").trim() || null
    const yearRaw = fdNumber(fd, "since_year")
    const since_year = Number.isFinite(yearRaw) ? yearRaw : null
    try {
      await updateInfra.mutateAsync({
        id: p.id,
        name,
        description,
        property_id: propertyId,
        since_year,
      })
      setEditingId(null)
    } catch {
      /* surfaced via lastError */
    }
  }

  const handleDelete = (p: Infrastructure) => {
    if (
      !window.confirm(t('Delete infrastructure "{{name}}"?', { name: p.name }))
    )
      return
    deleteInfra.mutate(
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
      className={listStyles.addForm}
    >
      <Textfield
        label={t("Name")}
        name="name"
        type="text"
        required
        autoFocus
        defaultValue={p.name}
        disabled={updateInfra.isPending}
      />
      <Textfield
        label={t("Description (optional)")}
        name="description"
        type="text"
        defaultValue={p.description ?? ""}
        disabled={updateInfra.isPending}
      />
      <Textfield
        label={t("Since year (optional)")}
        name="since_year"
        type="number"
        min={1500}
        max={2100}
        step={1}
        inputMode="numeric"
        defaultValue={p.since_year ?? ""}
        disabled={updateInfra.isPending}
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
      <Heading level={3}>{t("Infrastructure")}</Heading>
      <p>
        {t(
          "Does the property have a bridge, dock, well, septic, or anything similar?",
        )}
      </p>

      {lastError && (
        <p role="alert">
          {t("Error: {{message}}", { message: lastError.message })}
        </p>
      )}

      <ul className={listStyles.list}>
        {items.map(i => (
          <Card asChild key={i.id}>
            <li>
              <Card.Block className={listStyles.row}>
                <InlineEditRow
                  editing={editingId === i.id}
                  canEdit={canEdit}
                  pending={pending}
                  editLabel={t("Edit infrastructure {{name}}", {
                    name: i.name,
                  })}
                  onStartEdit={() => {
                    setEditingId(i.id)
                  }}
                  view={
                    <span className={listStyles.rowName}>
                      <strong>{i.name}</strong>
                      {i.description && <span> – {i.description}</span>}
                      {i.since_year != null && <small> ({i.since_year})</small>}
                    </span>
                  }
                  form={renderEditForm(i)}
                  actions={
                    <Button
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      disabled={pending}
                      aria-label={t('Delete infrastructure "{{name}}"?', {
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
                    <strong>{t("Add infrastructure")}</strong>
                    <form action={handleAdd} className={listStyles.addForm}>
                      <Textfield
                        label={t("Name")}
                        name="name"
                        type="text"
                        required
                        autoFocus
                        disabled={createInfra.isPending}
                      />
                      <Textfield
                        label={t("Description (optional)")}
                        name="description"
                        type="text"
                        disabled={createInfra.isPending}
                      />
                      <Textfield
                        label={t("Since year (optional)")}
                        name="since_year"
                        type="number"
                        min={1500}
                        max={2100}
                        step={1}
                        inputMode="numeric"
                        disabled={createInfra.isPending}
                      />
                      <div className={listStyles.actions}>
                        <SubmitButton>{t("Add infrastructure")}</SubmitButton>
                        <Button
                          type="button"
                          variant="tertiary"
                          disabled={createInfra.isPending}
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

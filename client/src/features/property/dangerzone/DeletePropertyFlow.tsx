import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Checkbox,
  Fieldset,
  Heading,
  Paragraph,
  Switch,
  Textfield,
  ValidationMessage,
} from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import {
  useSelectedPropertyId,
  useSetSelectedPropertyId,
} from "@/selection/useSelection"
import { useTRPC } from "@/trpc/trpc.ts"

export function DeletePropertyFlow() {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const setSelectedPropertyId = useSetSelectedPropertyId()

  const selectedPropertyId = useSelectedPropertyId()

  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )

  const deleteProperty = useMutation(
    trpc.property.delete.mutationOptions({
      onSuccess: async () => {
        // Refresh the property list before clearing the selection so the
        // navigation's beforeLoad re-defaults from the fresh list.
        await qc.invalidateQueries({ queryKey: trpc.property.mine.queryKey() })
        await setSelectedPropertyId(null, { replace: true })
      },
    }),
  )

  const [isArmed, setIsArmed] = useState(false)
  const [typedName, setTypedName] = useState("")
  const [acknowledged, setAcknowledged] = useState(false)
  const [cascade, setCascade] = useState(false)

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  if (!selectedProperty) {
    return <Paragraph>{t("No property selected.")}</Paragraph>
  }

  const nameMatches = typedName === selectedProperty.name
  const canDelete = nameMatches && acknowledged && !deleteProperty.isPending

  const reset = () => {
    setIsArmed(false)
    setTypedName("")
    setAcknowledged(false)
    setCascade(false)
  }

  const handleDelete = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canDelete) return
    deleteProperty.mutate(
      { id: selectedProperty.id, cascade },
      { onSuccess: reset },
    )
  }

  if (!isArmed) {
    return (
      <div>
        <Heading level={4}>{t("Delete property")}</Heading>
        <Paragraph>
          <Trans
            t={t}
            i18nKey="Permanently delete <1>{{name}}</1> and all data associated with it."
            values={{ name: selectedProperty.name }}
            components={{ 1: <strong /> }}
          />
        </Paragraph>
        <Button
          type="button"
          onClick={() => {
            setIsArmed(true)
          }}
        >
          {t("Delete this property…")}
        </Button>
      </div>
    )
  }

  return (
    <div>
      <Heading level={4}>{t("Delete property")}</Heading>

      <ValidationMessage role="alert">
        <Trans
          t={t}
          i18nKey="<1>Warning:</1> This action cannot be undone. Deleting <3>{{name}}</3> will permanently remove the property along with all its Structures, rooms, bookings, and history."
          values={{ name: selectedProperty.name }}
          components={{ 1: <strong />, 3: <strong /> }}
        />
      </ValidationMessage>

      <form onSubmit={handleDelete}>
        <Fieldset>
          <Fieldset.Legend>{t("Confirm deletion")}</Fieldset.Legend>

          <div>
            <Textfield
              label={
                <Trans
                  t={t}
                  i18nKey="Type <1>{{name}}</1> to confirm"
                  values={{ name: selectedProperty.name }}
                  components={{ 1: <strong /> }}
                />
              }
              type="text"
              value={typedName}
              onChange={e => {
                setTypedName(e.target.value)
              }}
              autoComplete="off"
              autoFocus
              required
            />
          </div>

          <div>
            <Switch
              label={t(
                "Cascade delete — also remove every structure, room, booking, expense, settlement and related record under this property",
              )}
              checked={cascade}
              onChange={e => {
                setCascade(e.target.checked)
              }}
            />
          </div>

          <div>
            <Checkbox
              label={t(
                "I understand that this action is permanent and cannot be undone.",
              )}
              checked={acknowledged}
              onChange={e => {
                setAcknowledged(e.target.checked)
              }}
            />
          </div>

          <div>
            <Button type="submit" disabled={!canDelete}>
              {t("Permanently delete {{name}}", {
                name: selectedProperty.name,
              })}
            </Button>
            <Button
              type="button"
              onClick={reset}
              disabled={deleteProperty.isPending}
            >
              {t("Cancel")}
            </Button>
          </div>

          {deleteProperty.error && (
            <ValidationMessage role="alert">
              {t("Error: {{message}}", {
                message: deleteProperty.error.message,
              })}
            </ValidationMessage>
          )}
        </Fieldset>
      </form>
    </div>
  )
}

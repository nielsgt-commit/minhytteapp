import { useSelectedPropertyId } from "@/features/property/propertySlice"
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
  Textfield,
} from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import { useAppDispatch } from "@/app/hooks.ts"
import { setSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

export function DeletePropertyFlow() {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const dispatch = useAppDispatch()

  const selectedPropertyId = useSelectedPropertyId()

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

  const deleteProperty = useMutation(
    trpc.property.delete.mutationOptions({
      onSuccess: () => {
        dispatch(setSelectedPropertyId(null))
        void qc.invalidateQueries({ queryKey: trpc.property.list.queryKey() })
        void qc.invalidateQueries({
          queryKey: trpc.property.listForUser.queryKey(),
        })
      },
    }),
  )

  const [isArmed, setIsArmed] = useState(false)
  const [typedName, setTypedName] = useState("")
  const [acknowledged, setAcknowledged] = useState(false)

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  if (!selectedProperty) {
    return <p>{t("No property selected.")}</p>
  }

  const nameMatches = typedName === selectedProperty.name
  const canDelete = nameMatches && acknowledged && !deleteProperty.isPending

  const reset = () => {
    setIsArmed(false)
    setTypedName("")
    setAcknowledged(false)
  }

  const handleDelete = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canDelete) return
    deleteProperty.mutate({ id: selectedProperty.id }, { onSuccess: reset })
  }

  if (!isArmed) {
    return (
      <div>
        <h4>{t("Delete property")}</h4>
        <p>
          <Trans
            t={t}
            i18nKey="Permanently delete <1>{{name}}</1> and all data associated with it."
            values={{ name: selectedProperty.name }}
            components={{ 1: <strong /> }}
          />
        </p>
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
      <h4>{t("Delete property")}</h4>

      <p role="alert">
        <Trans
          t={t}
          i18nKey="<1>Warning:</1> This action cannot be undone. Deleting <3>{{name}}</3> will permanently remove the property along with all its Structures, rooms, bookings, and history."
          values={{ name: selectedProperty.name }}
          components={{ 1: <strong />, 3: <strong /> }}
        />
      </p>

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
            <p role="alert">
              {t("Error: {{message}}", {
                message: deleteProperty.error.message,
              })}
            </p>
          )}
        </Fieldset>
      </form>
    </div>
  )
}

import { type SyntheticEvent } from "react"
import {
  Button,
  Card,
  Field,
  Fieldset,
  Label,
  Textarea,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"

export type MaintenanceHistoryItem = {
  id: number
  description: string
  instructions: string | null
  completed_at: string | Date | null
}

function toDateInputValue(value: string | Date | null): string {
  if (value == null) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const yyyy = String(d.getFullYear()).padStart(4, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export function MaintenanceHistoryEditForm(props: {
  item: MaintenanceHistoryItem
  pending: boolean
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  const { t } = useTranslation("maintenance")
  const { item, pending, onSubmit, onCancel } = props
  return (
    <Card key={item.id} asChild>
      <article>
        <Card.Block>
          <form onSubmit={onSubmit}>
            <Fieldset>
              <Fieldset.Legend>{t("Edit completed task")}</Fieldset.Legend>
              <Textfield
                label={t("Task")}
                name="description"
                defaultValue={item.description}
                required
              />
              <Field>
                <Label>{t("Instructions")}</Label>
                <Textarea
                  name="instructions"
                  defaultValue={item.instructions ?? ""}
                  rows={4}
                />
              </Field>
              <Textfield
                label={t("Completion date")}
                name="completed_at"
                type="date"
                defaultValue={toDateInputValue(item.completed_at)}
              />
              <Button type="submit" disabled={pending}>{t("Save")}</Button>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={onCancel}
              >
                {t("Cancel")}
              </Button>
            </Fieldset>
          </form>
        </Card.Block>
      </article>
    </Card>
  )
}

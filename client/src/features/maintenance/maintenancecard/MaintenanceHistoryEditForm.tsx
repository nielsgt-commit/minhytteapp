import { type SyntheticEvent } from "react"
import {
  Button,
  Card,
  Fieldset,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"

export type MaintenanceHistoryItem = {
  id: number
  description: string
  instructions: string | null
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
              <Textfield
                label={t("Instructions")}
                name="instructions"
                defaultValue={item.instructions ?? ""}
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

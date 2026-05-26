import { type SyntheticEvent, useState } from "react"
import {
  Button,
  Card,
  Field,
  Fieldset,
  Label,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import type { PortableTextBlock } from "@portabletext/types"
import { MaintenanceInstructionsPTEditor } from "./MaintenanceInstructionsPTEditor.tsx"
import styles from "./MaintenanceHistory.module.css"

export type MaintenanceHistoryItem = {
  id: number
  description: string
  instructions_pt: PortableTextBlock[] | null
  completed_at: string | Date | null
}

export type MaintenanceHistoryEditValues = {
  description: string
  instructions_pt: PortableTextBlock[] | null
  completed_at?: Date
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
  onSubmit: (values: MaintenanceHistoryEditValues) => void
  onCancel: () => void
}) {
  const { t } = useTranslation("maintenance")
  const { item, pending, onSubmit, onCancel } = props
  const [instructionsPT, setInstructionsPT] = useState<PortableTextBlock[]>(
    item.instructions_pt ?? [],
  )

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const rawDescription = fd.get("description")
    const rawCompletedAt = fd.get("completed_at")
    const description =
      typeof rawDescription === "string" ? rawDescription.trim() : ""
    const completedAtStr =
      typeof rawCompletedAt === "string" ? rawCompletedAt.trim() : ""
    if (!description) return
    onSubmit({
      description,
      instructions_pt: instructionsPT.length > 0 ? instructionsPT : null,
      completed_at: completedAtStr
        ? new Date(`${completedAtStr}T12:00:00`)
        : undefined,
    })
  }

  return (
    <Card key={item.id} asChild>
      <article>
        <Card.Block>
          <form onSubmit={handleSubmit}>
            <Fieldset>
              <Fieldset.Legend>{t("Edit completed task")}</Fieldset.Legend>
              <Textfield
                label={t("Task")}
                name="description"
                defaultValue={item.description}
                required
              />
              <Field>
                <Label>{t("Description")}</Label>
                <MaintenanceInstructionsPTEditor
                  initialValue={item.instructions_pt ?? undefined}
                  onChange={setInstructionsPT}
                />
              </Field>
              <Textfield
                label={t("Completion date")}
                name="completed_at"
                type="date"
                defaultValue={toDateInputValue(item.completed_at)}
              />
              <div className={styles.formActions}>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={onCancel}
                >
                  {t("Cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  {t("Save")}
                </Button>
              </div>
            </Fieldset>
          </form>
        </Card.Block>
      </article>
    </Card>
  )
}

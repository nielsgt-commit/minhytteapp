import { useActionState, useState } from "react"
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
import { toDateInputValue } from "@/utils/dateUtils"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { fdString } from "@/utils/formData"
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

type SubmitState = {
  error: string | null
  // Echo the submitted field values so the post-action form reset restores
  // what the user typed instead of the original item on failure.
  values?: { description: string; completed_at: string }
}

export function MaintenanceHistoryEditForm(props: {
  item: MaintenanceHistoryItem
  pending: boolean
  onSubmit: (values: MaintenanceHistoryEditValues) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useTranslation("maintenance")
  const { item, pending, onSubmit, onCancel } = props
  // The PT editor reports edits via callback, so it stays component state.
  const [instructionsPT, setInstructionsPT] = useState<PortableTextBlock[]>(
    item.instructions_pt ?? [],
  )

  const [submitState, submitAction, isPending] = useActionState<
    SubmitState,
    FormData
  >(
    async (_prev, fd) => {
      const description = fdString(fd, "description").trim()
      const completedAtStr = fdString(fd, "completed_at").trim()
      if (!description) return { error: null }
      try {
        await onSubmit({
          description,
          instructions_pt: instructionsPT.length > 0 ? instructionsPT : null,
          completed_at: completedAtStr
            ? new Date(`${completedAtStr}T12:00:00`)
            : undefined,
        })
        return { error: null }
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : String(err),
          values: { description, completed_at: completedAtStr },
        }
      }
    },
    { error: null },
  )

  return (
    <Card key={item.id} asChild>
      <article>
        <Card.Block>
          <form action={submitAction}>
            <Fieldset>
              <Fieldset.Legend>{t("Edit completed task")}</Fieldset.Legend>
              <Textfield
                label={t("Task")}
                name="description"
                defaultValue={
                  submitState.values?.description ?? item.description
                }
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
                defaultValue={
                  submitState.values?.completed_at ??
                  toDateInputValue(item.completed_at)
                }
              />
              <ErrorAlert
                error={
                  submitState.error ? { message: submitState.error } : null
                }
              />
              <div className={styles.formActions}>
                <Button
                  variant="secondary"
                  disabled={pending || isPending}
                  onClick={onCancel}
                >
                  {t("Cancel")}
                </Button>
                <SubmitButton disabled={pending}>{t("Save")}</SubmitButton>
              </div>
            </Fieldset>
          </form>
        </Card.Block>
      </article>
    </Card>
  )
}

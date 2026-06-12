import { useActionState } from "react"
import { Button, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./MyExpenses.module.css"
import type { ExpenseRow } from "../types.ts"
import { toUpdateInput } from "../buildUpdatePayload.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { Temporal } from "temporal-polyfill"
import { toDateInputValue } from "@/utils/dateUtils"
import { fdString } from "@/utils/formData"

type Props = {
  expense: ExpenseRow
  propertyId: number
  onSaved: () => void
  onCancel: () => void
}

type SubmitState = {
  error: string | null
  // Echoed back on failure so the form keeps the user's input after the
  // automatic form-action reset.
  values: { date: string; description: string; amount: string } | null
}

const INITIAL_STATE: SubmitState = { error: null, values: null }

export function MyExpenseEditForm({
  expense,
  propertyId,
  onSaved,
  onCancel,
}: Props) {
  const { t } = useTranslation("expenses")
  const trpc = useTRPC()

  const updateExpense = useMutationWithInvalidation(
    trpc.expense.update.mutationOptions(),
    [trpc.expense.pathKey()],
  )

  const [state, submitAction, isPending] = useActionState<
    SubmitState,
    FormData
  >(async (_prev, fd) => {
    const values = {
      date: fdString(fd, "date"),
      description: fdString(fd, "description"),
      amount: fdString(fd, "amount"),
    }
    try {
      await updateExpense.mutateAsync(
        toUpdateInput(expense, propertyId, {
          description: values.description,
          amount: Number(values.amount),
          date: Temporal.PlainDate.from(values.date),
          status: "submitted",
        }),
      )
      onSaved()
      return INITIAL_STATE
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
        values,
      }
    }
  }, INITIAL_STATE)

  return (
    <form action={submitAction} className={styles.editForm}>
      <Textfield
        label={t("Date")}
        name="date"
        type="date"
        defaultValue={state.values?.date ?? toDateInputValue(expense.date)}
        required
      />
      <Textfield
        label={t("Description")}
        name="description"
        defaultValue={state.values?.description ?? expense.description}
      />
      <Textfield
        label={t("Amount")}
        name="amount"
        type="number"
        step={1}
        defaultValue={state.values?.amount ?? String(expense.amount)}
        required
      />
      <div className={styles.editActions}>
        <SubmitButton>{t("Submit")}</SubmitButton>
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={onCancel}
        >
          {t("Cancel")}
        </Button>
      </div>
      <ErrorAlert error={state.error ? { message: state.error } : null} />
    </form>
  )
}

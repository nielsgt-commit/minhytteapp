import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import type { ExpenseRow } from "./types.ts"
import { useTRPC } from "@/trpc/trpc"

export function RecurringPropertyFees() {
  const { t } = useTranslation("expenses")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )

  const fixed = (expenses as ExpenseRow[])
    .filter(
      e => e.expense_types.includes("fixed") && e.status === "reimbursed",
    )
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <section>
      <h3>{t("Recurring property fees")}</h3>
      {fixed.length === 0 ? (
        <p>{t("(no recurring fees)")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("Date")}</th>
              <th>{t("Description")}</th>
              <th>{t("Amount")}</th>
              <th>{t("Paid by")}</th>
              <th>{t("Status")}</th>
            </tr>
          </thead>
          <tbody>
            {fixed.map(e => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td>{e.description}</td>
                <td>{e.amount}</td>
                <td>{e.payer_name ?? `#${String(e.payer_id)}`}</td>
                <td>{e.status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>
                <strong>{t("Total")}</strong>
              </td>
              <td>
                <strong>{fixed.reduce((sum, e) => sum + e.amount, 0)}</strong>
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  )
}

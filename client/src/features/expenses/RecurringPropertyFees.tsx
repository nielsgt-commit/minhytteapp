import { useSuspenseQuery } from "@tanstack/react-query"
import type { ExpenseRow } from "./types.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

export function RecurringPropertyFees() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
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
      <h3>Recurring property fees</h3>
      {fixed.length === 0 ? (
        <p>(no recurring fees)</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Paid by</th>
              <th>Status</th>
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
                <strong>Total</strong>
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

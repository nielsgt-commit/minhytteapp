import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type Status = "draft" | "submitted" | "reimbursed" | "rejected"
type ExpenseType = "food" | "gas" | "maintenance" | "capex" | "opex" | "fixed"

type ExpenseRow = {
  id: number
  description: string
  amount: number
  payer_id: number
  payer_name: string | null
  reimbursed_by_id: number | null
  date: string
  status: Status
  receipt_url: string | null
  expense_types: ExpenseType[]
}

export function RecurringPropertyFees() {
  const trpc = useTRPC()
  const { data: expenses } = useSuspenseQuery(trpc.expense.list.queryOptions())

  const fixed = (expenses as ExpenseRow[])
    .filter(e => e.expense_types.includes("fixed"))
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

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
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
  booking_id: number | null
  maintenance_id: number | null
  settlement_id: number | null
  date: string
  status: Status
  receipt_url: string | null
  expense_types: ExpenseType[]
}

export function ReviewExpenses() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: expenses } = useSuspenseQuery(trpc.expense.list.queryOptions())
  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembers.queryOptions(),
  )
  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.list.queryOptions(),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.expense.list.queryKey() })

  const updateExpense = useMutation(
    trpc.expense.update.mutationOptions({ onSuccess: invalidate }),
  )

  if (me == null || !me.is_head) return null

  const myGroup = groups.find(
    g => g.is_main && g.members.some(m => m.user_id === me.id),
  )
  const memberIds = new Set(myGroup?.members.map(m => m.user_id) ?? [])

  const openSettlement = settlements
    .filter(s => s.status === "open")
    .slice()
    .sort((a, b) => b.year - a.year)[0]

  const toReview = (expenses as ExpenseRow[])
    .filter(e => e.status === "submitted" && memberIds.has(e.payer_id))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))

  const basePayload = (e: ExpenseRow) => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    booking_id: e.booking_id ?? undefined,
    maintenance_id: e.maintenance_id ?? undefined,
    date: e.date,
    receipt_url: e.receipt_url,
    expense_types: e.expense_types,
  })

  const approve = (e: ExpenseRow) => {
    if (openSettlement == null) return
    updateExpense.mutate({
      ...basePayload(e),
      status: "reimbursed",
      reimbursed_by_id: me.id,
      settlement_id: openSettlement.id,
    })
  }

  const reject = (e: ExpenseRow) => {
    updateExpense.mutate({
      ...basePayload(e),
      status: "rejected",
      reimbursed_by_id: e.reimbursed_by_id ?? undefined,
      settlement_id: e.settlement_id ?? undefined,
    })
  }

  return (
    <section>
      <h3>Review expenses</h3>
      <p>Group: {myGroup?.name ?? "(no group)"}</p>
      <p>
        Open settlement:{" "}
        {openSettlement
          ? `#${String(openSettlement.id)} (${String(openSettlement.year)}${openSettlement.season ? ` ${openSettlement.season}` : ""})`
          : "(none — approve disabled)"}
      </p>
      {updateExpense.error && (
        <p role="alert">Error: {updateExpense.error.message}</p>
      )}
      {toReview.length === 0 ? (
        <p>(nothing to review)</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Paid by</th>
              <th>Types</th>
              <th>Receipt</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {toReview.map(e => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td>{e.description}</td>
                <td>{e.amount}</td>
                <td>{e.payer_name ?? `#${String(e.payer_id)}`}</td>
                <td>{e.expense_types.join(", ")}</td>
                <td>
                  {e.receipt_url ? (
                    <a href={e.receipt_url} target="_blank" rel="noreferrer">
                      link
                    </a>
                  ) : (
                    ""
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    disabled={
                      openSettlement == null || updateExpense.isPending
                    }
                    onClick={() => {
                      approve(e)
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={updateExpense.isPending}
                    onClick={() => {
                      reject(e)
                    }}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>
                <strong>Total</strong>
              </td>
              <td>
                <strong>
                  {toReview.reduce((sum, e) => sum + e.amount, 0)}
                </strong>
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  )
}

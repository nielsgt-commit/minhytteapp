import { useSuspenseQuery } from "@tanstack/react-query"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

export function PreliminarySettlement() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: users } = useSuspenseQuery(
    trpc.user.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )

  const heads = users.filter(u => u.is_head)
  const reimbursed = expenses.filter(
    e => e.status === "reimbursed" && e.reimbursed_by_id != null,
  )

  const rows = heads.map(h => {
    const total = reimbursed
      .filter(e => e.reimbursed_by_id === h.id)
      .reduce((sum, e) => sum + e.amount, 0)
    return { head: h, total }
  })

  return (
    <section>
      <h3>Preliminary settlement</h3>
      {rows.length === 0 ? (
        <p>No heads.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Head</th>
              <th>Reimbursed total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.head.id}>
                <td>{r.head.name}</td>
                <td>{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

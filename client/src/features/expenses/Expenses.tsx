import { useState } from "react"
import styles from "./Expenses.module.css"
import { useExpenses } from "./api/queries"
import { useCreateExpense } from "./api/mutations"

export function Expenses() {
  const { data: expenses = [], isPending } = useExpenses()
  const createExpense = useCreateExpense()
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Expenses</h2>
      <div className={styles.content}>
        {isPending ? (
          <p>Loading…</p>
        ) : (
          <ul>
            {expenses.map(e => (
              <li key={e.id}>
                {e.paidAt} — {e.description} ({e.amount} kr, {e.paidBy})
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={e => {
            e.preventDefault()
            if (!description || !amount) return
            createExpense.mutate(
              {
                description,
                amount: Number(amount),
                paidBy: "Anna",
                paidAt: new Date().toISOString().slice(0, 10),
              },
              {
                onSuccess: () => {
                  setDescription("")
                  setAmount("")
                },
              },
            )
          }}
        >
          <input
            placeholder="Description"
            value={description}
            onChange={e => {
              setDescription(e.target.value)
            }}
          />
          <input
            placeholder="Amount"
            type="number"
            value={amount}
            onChange={e => {
              setAmount(e.target.value)
            }}
          />
          <button type="submit" disabled={createExpense.isPending}>
            {createExpense.isPending ? "Adding…" : "Add expense"}
          </button>
        </form>
      </div>
    </section>
  )
}

import { useState } from "react"
import { Temporal } from "temporal-polyfill"

export type ExpenseDraft = {
  id: string
  category: string
  amount: number
  receipt_date: Temporal.PlainDate
}

export function useExpenseDrafts() {
  const [drafts, setDrafts] = useState<ExpenseDraft[]>([])

  const add = (
    category: string,
    amount: number,
    receiptDate: Temporal.PlainDate = Temporal.Now.plainDateISO(),
  ) => {
    setDrafts(prev => [
      ...prev,
      {
        id: `${String(Date.now())}-${String(Math.random())}`,
        category,
        amount,
        receipt_date: receiptDate,
      },
    ])
  }

  const remove = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id))
  }

  const reset = () => {
    setDrafts([])
  }

  const total = drafts.reduce((sum, d) => sum + d.amount, 0)

  return { drafts, add, remove, reset, total }
}

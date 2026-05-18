import { useState } from "react"

export type ExpenseDraft = {
  id: string
  category: string
  amount: number
}

export function useExpenseDrafts() {
  const [drafts, setDrafts] = useState<ExpenseDraft[]>([])

  const add = (category: string, amount: number) => {
    setDrafts(prev => [
      ...prev,
      {
        id: `${String(Date.now())}-${String(Math.random())}`,
        category,
        amount,
      },
    ])
  }

  const remove = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id))
  }

  const reset = () => { setDrafts([]) }

  const total = drafts.reduce((sum, d) => sum + d.amount, 0)

  return { drafts, add, remove, reset, total }
}

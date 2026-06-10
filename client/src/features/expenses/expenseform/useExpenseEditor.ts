import { useState } from "react"

export type ExpenseEditor = {
  openCategory: string | null
  amount: string
  setAmount: (next: string) => void
  open: (categoryName: string) => void
  close: () => void
}

export function useExpenseEditor(): ExpenseEditor {
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const [amount, setAmount] = useState("")

  const open = (categoryName: string) => {
    setOpenCategory(categoryName)
    setAmount("")
  }

  const close = () => {
    setOpenCategory(null)
    setAmount("")
  }

  return { openCategory, amount, setAmount, open, close }
}

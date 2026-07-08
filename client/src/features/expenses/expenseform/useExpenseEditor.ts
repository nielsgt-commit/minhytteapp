import { useState } from "react"
import { Temporal } from "temporal-polyfill"

export type ExpenseEditor = {
  openCategory: string | null
  amount: string
  receiptDate: Temporal.PlainDate
  setAmount: (next: string) => void
  setReceiptDate: (next: Temporal.PlainDate) => void
  open: (categoryName: string) => void
  close: () => void
}

export function useExpenseEditor(): ExpenseEditor {
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [receiptDate, setReceiptDate] = useState(() =>
    Temporal.Now.plainDateISO(),
  )

  const open = (categoryName: string) => {
    setOpenCategory(categoryName)
    setAmount("")
    setReceiptDate(Temporal.Now.plainDateISO())
  }

  const close = () => {
    setOpenCategory(null)
    setAmount("")
    setReceiptDate(Temporal.Now.plainDateISO())
  }

  return {
    openCategory,
    amount,
    receiptDate,
    setAmount,
    setReceiptDate,
    open,
    close,
  }
}

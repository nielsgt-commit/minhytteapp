import type { Status } from "./expenseStatus.ts"

export type { Status } from "./expenseStatus.ts"

export type ExpenseType =
  | "food"
  | "gas"
  | "maintenance"
  | "capex"
  | "opex"
  | "fixed"

export type ExpenseRow = {
  id: number
  property_id: number | null
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
  expense_types: string[]
}

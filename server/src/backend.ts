import {
  db,
  type Balance,
  type Booking,
  type Expense,
  type MaintenanceStatus,
  type MaintenanceTask,
} from "./db"

const delay = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms))
const newId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`

// ---------- Expenses ----------

export async function listExpenses(): Promise<Expense[]> {
  await delay()
  return [...db.expenses]
}

export async function getExpense(id: string): Promise<Expense> {
  await delay()
  const found = db.expenses.find(e => e.id === id)
  if (!found) throw new Error(`Expense ${id} not found`)
  return found
}

export async function createExpense(
  input: Omit<Expense, "id">,
): Promise<Expense> {
  await delay()
  const expense: Expense = { id: newId("exp"), ...input }
  db.expenses = [expense, ...db.expenses]
  return expense
}

// ---------- Bookings ----------

export async function listBookings(): Promise<Booking[]> {
  await delay()
  return [...db.bookings].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  )
}

export async function createBooking(
  input: Omit<Booking, "id">,
): Promise<Booking> {
  await delay()
  const booking: Booking = { id: newId("bk"), ...input }
  db.bookings = [...db.bookings, booking]
  return booking
}

// ---------- Maintenance ----------

export async function listMaintenance(): Promise<MaintenanceTask[]> {
  await delay()
  return [...db.maintenance]
}

export async function createMaintenanceTask(
  input: Omit<MaintenanceTask, "id">,
): Promise<MaintenanceTask> {
  await delay()
  const task: MaintenanceTask = { id: newId("mt"), ...input }
  db.maintenance = [task, ...db.maintenance]
  return task
}

export async function setMaintenanceStatus(input: {
  id: string
  status: MaintenanceStatus
}): Promise<MaintenanceTask> {
  await delay()
  const idx = db.maintenance.findIndex(t => t.id === input.id)
  if (idx === -1) throw new Error(`Task ${input.id} not found`)
  const updated: MaintenanceTask = {
    ...db.maintenance[idx],
    status: input.status,
  }
  db.maintenance = [
    ...db.maintenance.slice(0, idx),
    updated,
    ...db.maintenance.slice(idx + 1),
  ]
  return updated
}

// ---------- Settlement ----------

export async function listBalances(): Promise<Balance[]> {
  await delay()
  return [...db.balances]
}

export async function settleAll(): Promise<Balance[]> {
  await delay()
  db.balances = db.balances.map(b => ({ ...b, balance: 0 }))
  return [...db.balances]
}

// ---------- Dashboard (aggregate) ----------

export type DashboardSummary = {
  expenseCount: number
  totalSpent: number
  upcomingBookings: number
  openMaintenance: number
  netBalance: number
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  await delay()
  const today = new Date().toISOString().slice(0, 10)
  return {
    expenseCount: db.expenses.length,
    totalSpent: db.expenses.reduce((sum, e) => sum + e.amount, 0),
    upcomingBookings: db.bookings.filter(b => b.startDate >= today).length,
    openMaintenance: db.maintenance.filter(t => t.status !== "done").length,
    netBalance: db.balances.reduce((sum, b) => sum + b.balance, 0),
  }
}
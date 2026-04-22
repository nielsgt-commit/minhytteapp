


export type Expense = {
  id: string
  description: string
  amount: number
  paidBy: string
  paidAt: string
}

export type Booking = {
  id: string
  userId: string
  userName: string
  startDate: string
  endDate: string
  note?: string
}

export type MaintenanceStatus = "open" | "in_progress" | "done"

export type MaintenanceTask = {
  id: string
  title: string
  status: MaintenanceStatus
  dueDate?: string
}

export type Balance = {
  userId: string
  userName: string
  balance: number
}

type Db = {
  expenses: Expense[]
  bookings: Booking[]
  maintenance: MaintenanceTask[]
  balances: Balance[]
}

export const db: Db = {
  expenses: [
    {
      id: "exp_1",
      description: "Firewood delivery",
      amount: 1200,
      paidBy: "Anna",
      paidAt: "2026-03-12",
    },
    {
      id: "exp_2",
      description: "New kitchen faucet",
      amount: 890,
      paidBy: "Bjørn",
      paidAt: "2026-04-02",
    },
  ],
  bookings: [
    {
      id: "bk_1",
      userId: "u_anna",
      userName: "Anna",
      startDate: "2026-05-01",
      endDate: "2026-05-05",
      note: "Easter week",
    },
    {
      id: "bk_2",
      userId: "u_bjorn",
      userName: "Bjørn",
      startDate: "2026-06-14",
      endDate: "2026-06-20",
    },
  ],
  maintenance: [
    {
      id: "mt_1",
      title: "Re-stain the deck",
      status: "open",
      dueDate: "2026-06-01",
    },
    { id: "mt_2", title: "Service the heat pump", status: "in_progress" },
    { id: "mt_3", title: "Check smoke alarms", status: "done" },
  ],
  balances: [
    { userId: "u_anna", userName: "Anna", balance: 600 },
    { userId: "u_bjorn", userName: "Bjørn", balance: -445 },
    { userId: "u_cecilie", userName: "Cecilie", balance: -155 },
  ],
}
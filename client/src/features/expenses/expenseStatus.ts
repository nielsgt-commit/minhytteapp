export type Status = "draft" | "submitted" | "reimbursed" | "rejected"

export const STATUS_ORDER: Record<Status, number> = {
  draft: 0,
  submitted: 1,
  reimbursed: 2,
  rejected: 3,
}

export const STATUS_COLOR: Record<
  Status,
  "info" | "success" | "warning" | "danger" | "neutral"
> = {
  draft: "neutral",
  submitted: "info",
  reimbursed: "success",
  rejected: "danger",
}

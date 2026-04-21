export const expenseKeys = {
  all: ["expenses"] as const,
  list: () => [...expenseKeys.all, "list"] as const,
  detail: (id: string) => [...expenseKeys.all, "detail", id] as const,
}

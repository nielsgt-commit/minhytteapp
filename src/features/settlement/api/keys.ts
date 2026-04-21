export const settlementKeys = {
  all: ["settlement"] as const,
  balances: () => [...settlementKeys.all, "balances"] as const,
}

export const SETTLEMENT_PHASES = [
  "collecting_expenses",
  "collecting_bookings",
  "reviewing",
  "split_policy",
  "closed",
] as const

export type SettlementPhase = (typeof SETTLEMENT_PHASES)[number]

export function phaseAtLeast(
  current: SettlementPhase,
  target: SettlementPhase,
): boolean {
  return SETTLEMENT_PHASES.indexOf(current) >= SETTLEMENT_PHASES.indexOf(target)
}

export const NEXT_PHASE: Record<SettlementPhase, SettlementPhase | null> = {
  collecting_expenses: "collecting_bookings",
  collecting_bookings: "reviewing",
  reviewing: "split_policy",
  split_policy: null,
  closed: null,
}

export const PREV_PHASE: Record<SettlementPhase, SettlementPhase | null> = {
  collecting_expenses: null,
  collecting_bookings: "collecting_expenses",
  reviewing: "collecting_bookings",
  split_policy: "reviewing",
  closed: null,
}

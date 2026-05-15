import styles from "./SettlementPhaseStepper.module.css"
import {
  SETTLEMENT_PHASES,
  type SettlementPhase,
} from "@/features/settlement/phase"

export const PHASE_LABELS: Record<SettlementPhase, string> = {
  collecting_expenses: "Expenses",
  collecting_bookings: "Stays",
  reviewing: "Reviewing",
  split_policy: "Split policy",
  closed: "Close",
}

export function SettlementPhaseStepper({ phase }: { phase: SettlementPhase }) {
  return (
    <nav className={styles.stepper} aria-label="Settlement phases">
      {SETTLEMENT_PHASES.map((p, i) => {
        const isActive = p === phase
        return (
          <div
            key={p}
            className={`${styles.stepperItem} ${isActive ? styles.stepperItemActive : ""}`}
            aria-current={isActive ? "step" : undefined}
          >
            <span className={styles.stepperBadge}>{i + 1}</span>
            <span>{PHASE_LABELS[p]}</span>
          </div>
        )
      })}
    </nav>
  )
}

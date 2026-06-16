import { useTranslation } from "react-i18next"
import styles from "./SettlementPhaseStepper.module.css"
import {
  SETTLEMENT_PHASES,
  type SettlementPhase,
} from "@/features/settlement/phase"

export function usePhaseLabels(): Record<SettlementPhase, string> {
  const { t } = useTranslation("settlement")
  return {
    collecting_expenses: t("Expenses"),
    collecting_bookings: t("Stays"),
    reviewing: t("Reviewing"),
    split_policy: t("Split policy"),
    closed: t("Close"),
  }
}

export function SettlementPhaseStepper({
  phase,
  phases = [...SETTLEMENT_PHASES],
}: {
  phase: SettlementPhase
  phases?: SettlementPhase[]
}) {
  const { t } = useTranslation("settlement")
  const PHASE_LABELS = usePhaseLabels()
  return (
    <nav className={styles.stepper} aria-label={t("Settlement phases")}>
      {phases.map((p, i) => {
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

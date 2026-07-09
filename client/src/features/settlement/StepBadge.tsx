import styles from "./StepBadge.module.css"

// Circled step marker shared by the settlement intro and the step headings so
// the numbering reads the same everywhere. "active" gets the accent look the
// stepper uses for the current phase; "done" swaps the number for a check.
export function StepBadge({
  number,
  state,
}: {
  number?: number
  state?: "active" | "done"
}) {
  if (state === "done") {
    return (
      <span className={`${styles.badge} ${styles.done}`} aria-hidden="true">
        ✓
      </span>
    )
  }
  return (
    <span
      className={`${styles.badge} ${state === "active" ? styles.active : ""}`}
    >
      {number}
    </span>
  )
}

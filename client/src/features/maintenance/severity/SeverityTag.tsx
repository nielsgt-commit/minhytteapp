import { Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./SeverityTag.module.css"

export type Severity = "major" | "minor" | "patch"

const colorBySeverity: Record<Severity, "danger" | "warning" | "info"> = {
  major: "danger",
  minor: "warning",
  patch: "info",
}

const nextSeverity: Record<Severity, Severity> = {
  patch: "minor",
  minor: "major",
  major: "patch",
}

export function cycleSeverity(s: Severity): Severity {
  return nextSeverity[s]
}

export function SeverityTag(props: {
  severity: Severity
  onCycle?: () => void
  disabled?: boolean
}) {
  const { t } = useTranslation("maintenance")
  const { severity, onCycle, disabled } = props
  const label: Record<Severity, string> = {
    major: t("Major"),
    minor: t("Minor"),
    patch: t("Patch"),
  }
  const interactive = onCycle != null && !disabled
  return (
    <Tag
      data-color={colorBySeverity[severity]}
      data-size="sm"
      variant="outline"
      className={interactive ? styles.interactive : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={t("Severity: {{label}} (click to change)", { label: label[severity] })}
      onClick={interactive ? onCycle : undefined}
      onKeyDown={interactive
        ? e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onCycle()
          }
        }
        : undefined}
    >
      {label[severity]}
    </Tag>
  )
}

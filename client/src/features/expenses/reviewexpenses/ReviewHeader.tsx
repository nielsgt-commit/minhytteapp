import { Heading, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { StepBadge } from "@/components/shared/StepBadge.tsx"
import stepStyles from "@/components/shared/StepBadge.module.css"
import styles from "./ReviewExpenses.module.css"

export function ReviewHeader() {
  const { t } = useTranslation("expenses")
  return (
    <>
      <div className={styles.header}>
        <Heading level={4} data-size="sm" className={stepStyles.stepHeading}>
          <StepBadge number={1} state="active" />
          {t("Review expenses")}
        </Heading>
      </div>
      <Paragraph data-size="sm">
        {t(
          "This is where you review the expenses logged by your family group. Approving an expense adds it to the settlement for review — what stays in the final settlement is decided in the Review settlement step.",
        )}
      </Paragraph>
    </>
  )
}

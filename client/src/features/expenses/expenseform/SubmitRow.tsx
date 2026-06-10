import { Button } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./AddNewExpenseFlow.module.css"
import { SubmitButton } from "@/components/shared/SubmitButton"

type Props = {
  pending: boolean
  onCancel: () => void
}

export function SubmitRow({ pending, onCancel }: Props) {
  const { t } = useTranslation("expenses")
  return (
    <div className={styles.submitRow}>
      <SubmitButton disabled={pending}>{t("Submit")}</SubmitButton>
      <Button
        type="button"
        variant="tertiary"
        onClick={onCancel}
        disabled={pending}
      >
        {t("Cancel")}
      </Button>
    </div>
  )
}

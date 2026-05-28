import { Button } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"

type Props = {
  onSkip?: () => void
  onFinishLater: () => void
  onDismiss: () => void
  pending?: boolean
}

export function WizardFooter({
  onSkip,
  onFinishLater,
  onDismiss,
  pending,
}: Props) {
  const { t } = useTranslation("onboarding")
  return (
    <div>
      {onSkip && (
        <Button
          type="button"
          variant="tertiary"
          onClick={onSkip}
          disabled={pending}
        >
          {t("Skip this step")}
        </Button>
      )}
      <Button
        type="button"
        variant="tertiary"
        onClick={onFinishLater}
        disabled={pending}
      >
        {t("Save & finish later")}
      </Button>
      <Button
        type="button"
        variant="tertiary"
        onClick={onDismiss}
        disabled={pending}
      >
        {t("Don't show this again")}
      </Button>
    </div>
  )
}

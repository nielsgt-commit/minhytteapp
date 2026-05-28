import { Button } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"

type PrimaryAction = {
  label: string
  onClick?: () => void
  type?: "submit" | "button"
  form?: string
  disabled?: boolean
}

type Props = {
  primary: PrimaryAction
  onBack?: () => void
  onSkip?: () => void
  onFinishLater: () => void
  onDismiss: () => void
  pending?: boolean
}

export function WizardFooter({
  primary,
  onBack,
  onSkip,
  onFinishLater,
  onDismiss,
  pending,
}: Props) {
  const { t } = useTranslation("onboarding")
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "0.5rem",
        flexWrap: "wrap",
        marginTop: "1rem",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {onBack && (
          <Button
            type="button"
            variant="tertiary"
            data-size="sm"
            onClick={onBack}
            disabled={pending}
          >
            {t("Back")}
          </Button>
        )}
        {onSkip && (
          <Button
            type="button"
            variant="tertiary"
            data-size="sm"
            onClick={onSkip}
            disabled={pending}
          >
            {t("Skip")}
          </Button>
        )}
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          onClick={onFinishLater}
          disabled={pending}
        >
          {t("Finish later")}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          onClick={onDismiss}
          disabled={pending}
        >
          {t("Don't show again")}
        </Button>
      </div>
      <Button
        type={primary.type ?? "button"}
        form={primary.form}
        onClick={primary.onClick}
        disabled={pending || primary.disabled}
      >
        {primary.label}
      </Button>
    </div>
  )
}

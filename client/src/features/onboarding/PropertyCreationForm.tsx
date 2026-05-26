import { Fieldset, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdString } from "@/utils/formData"
import { SubmitButton } from "@/components/shared/SubmitButton"

type PropertyCreationFormProps = {
  onSubmit: (input: { name: string; address: string }) => Promise<void>
}

export function PropertyCreationForm({ onSubmit }: PropertyCreationFormProps) {
  const { t } = useTranslation("onboarding")

  return (
    <form
      action={async fd => {
        const input = {
          name: fdString(fd, "name"),
          address: fdString(fd, "address"),
        }
        try {
          await onSubmit(input)
        } catch {
          /* surfaced by caller via mutation.error */
        }
      }}
    >
      <Fieldset>
        <Fieldset.Legend>{t("Step 2 – Add the property")}</Fieldset.Legend>
        <div>
          <Textfield label={t("Name")} type="text" name="name" required />
        </div>
        <div>
          <Textfield label={t("Address")} type="text" name="address" required />
        </div>
        <div>
          <SubmitButton>{t("Create property")}</SubmitButton>
        </div>
      </Fieldset>
    </form>
  )
}

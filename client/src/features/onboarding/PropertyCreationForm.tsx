import { Button, Fieldset, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdString } from "@/utils/formData"
import { useFormSubmit } from "@/hooks/useFormSubmit"

type PropertyCreationFormProps = {
  pending: boolean
  onSubmit: (input: { name: string; address: string }) => void
}

export function PropertyCreationForm({
  pending,
  onSubmit,
}: PropertyCreationFormProps) {
  const { t } = useTranslation("onboarding")
  const handleSubmit = useFormSubmit(
    fd => ({
      name: fdString(fd, "name"),
      address: fdString(fd, "address"),
    }),
    onSubmit,
  )

  return (
    <form onSubmit={handleSubmit}>
      <Fieldset>
        <Fieldset.Legend>{t("Step 2 – Add the property")}</Fieldset.Legend>
        <div>
          <Textfield label={t("Name")} type="text" name="name" required />
        </div>
        <div>
          <Textfield label={t("Address")} type="text" name="address" required />
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {t("Create property")}
          </Button>
        </div>
      </Fieldset>
    </form>
  )
}

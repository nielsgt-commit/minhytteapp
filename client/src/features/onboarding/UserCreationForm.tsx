import { Button, Checkbox, Fieldset, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdBoolean, fdString } from "@/utils/formData"
import { useFormSubmit } from "@/hooks/useFormSubmit"

type UserCreationFormProps = {
  pending: boolean
  onSubmit: (input: { name: string; email: string; is_child: boolean }) => void
}

export function UserCreationForm({ pending, onSubmit }: UserCreationFormProps) {
  const { t } = useTranslation("onboarding")
  const handleSubmit = useFormSubmit(
    fd => ({
      name: fdString(fd, "name"),
      email: fdString(fd, "email"),
      is_child: fdBoolean(fd, "is_child"),
    }),
    onSubmit,
  )

  return (
    <form onSubmit={handleSubmit}>
      <Fieldset>
        <Fieldset.Legend>{t("Step 1 – Create your admin account")}</Fieldset.Legend>
        <div>
          <Textfield label={t("Name")} type="text" name="name" required />
        </div>
        <div>
          <Textfield label={t("Email")} type="email" name="email" required />
        </div>
        <div>
          <Checkbox label={t("Is child")} name="is_child" />
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {t("Create admin")}
          </Button>
        </div>
      </Fieldset>
    </form>
  )
}

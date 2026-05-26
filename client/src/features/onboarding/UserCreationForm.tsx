import { Checkbox, Fieldset, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdBoolean, fdString } from "@/utils/formData"
import { SubmitButton } from "@/components/shared/SubmitButton"

type UserCreationFormProps = {
  onSubmit: (input: { name: string; email: string; is_child: boolean }) => Promise<void>
}

export function UserCreationForm({ onSubmit }: UserCreationFormProps) {
  const { t } = useTranslation("onboarding")

  return (
    <form
      action={async fd => {
        const input = {
          name: fdString(fd, "name"),
          email: fdString(fd, "email"),
          is_child: fdBoolean(fd, "is_child"),
        }
        try {
          await onSubmit(input)
        } catch {
          /* surfaced by caller via mutation.error */
        }
      }}
    >
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
          <SubmitButton>{t("Create admin")}</SubmitButton>
        </div>
      </Fieldset>
    </form>
  )
}

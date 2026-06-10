import { Button, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { fdString } from "@/utils/formData.ts"

type CreateUserFormProps = {
  groupName: string
  pending: boolean
  onSubmit: (name: string) => Promise<void>
  onBack: () => void
}

export function CreateUserForm({
  groupName,
  pending,
  onSubmit,
  onBack,
}: CreateUserFormProps) {
  const { t } = useTranslation("usergroups")
  const handleSubmit = async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    await onSubmit(name)
  }

  return (
    <form action={handleSubmit}>
      <fieldset>
        <legend>
          {t("Create user and add to {{groupName}}", { groupName })}
        </legend>
        <div>
          <Textfield
            label={t("Name")}
            type="text"
            name="name"
            required
            autoFocus
          />
        </div>
        <div>
          <SubmitButton disabled={pending}>{t("Save")}</SubmitButton>
          <Button
            type="button"
            variant="secondary"
            onClick={onBack}
            disabled={pending}
          >
            {t("Back")}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}

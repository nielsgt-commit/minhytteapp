import { Button, Checkbox, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { fdBoolean, fdString } from "@/utils/formData"

type CreateGroupFormProps = {
  pending: boolean
  onSubmit: (input: { name: string; is_family: boolean }) => Promise<void>
  onCancel: () => void
}

export function CreateGroupForm({
  pending,
  onSubmit,
  onCancel,
}: CreateGroupFormProps) {
  const { t } = useTranslation("usergroups")
  const handleSubmit = async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    await onSubmit({ name, is_family: fdBoolean(fd, "is_family") })
  }

  return (
    <form action={handleSubmit}>
      <fieldset>
        <legend>{t("New group")}</legend>
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
          <Checkbox label={t("Main")} name="is_family" />
        </div>
        <div>
          <SubmitButton disabled={pending}>{t("Save")}</SubmitButton>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={pending}
          >
            {t("Cancel")}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}

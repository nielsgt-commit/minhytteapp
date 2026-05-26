import { type SyntheticEvent } from "react"
import { Button, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdString } from "@/utils/formData.ts"

type CreateUserFormProps = {
  groupName: string
  pending: boolean
  onSubmit: (name: string, reset: () => void) => void
  onBack: () => void
}

export function CreateUserForm({
  groupName,
  pending,
  onSubmit,
  onBack,
}: CreateUserFormProps) {
  const { t } = useTranslation("usergroups")
  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    if (!name) return
    onSubmit(name, () => {
      form.reset()
    })
  }

  return (
    <form onSubmit={handleSubmit}>
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
          <Button type="submit" disabled={pending}>
            {t("Save")}
          </Button>
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

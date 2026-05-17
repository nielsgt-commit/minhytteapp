import { type SyntheticEvent } from "react"
import { Button, Textfield } from "@digdir/designsystemet-react"
import { fdString } from "@/utils/formData"

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
  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    if (!name) return
    onSubmit(name, () => { form.reset() })
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset>
        <legend>Create user and add to {groupName}</legend>
        <div>
          <Textfield label="Name" type="text" name="name" required autoFocus />
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onBack}
            disabled={pending}
          >
            Back
          </Button>
        </div>
      </fieldset>
    </form>
  )
}

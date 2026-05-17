import { type SyntheticEvent } from "react"
import { Button, Checkbox, Textfield } from "@digdir/designsystemet-react"
import { fdBoolean, fdString } from "@/utils/formData"

type CreateGroupFormProps = {
  pending: boolean
  onSubmit: (input: { name: string; is_main: boolean }, reset: () => void) => void
  onCancel: () => void
}

export function CreateGroupForm({
  pending,
  onSubmit,
  onCancel,
}: CreateGroupFormProps) {
  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    if (!name) return
    onSubmit({ name, is_main: fdBoolean(fd, "is_main") }, () => { form.reset() })
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset>
        <legend>New group</legend>
        <div>
          <Textfield label="Name" type="text" name="name" required autoFocus />
        </div>
        <div>
          <Checkbox label="Main" name="is_main" />
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  )
}

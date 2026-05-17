import { type SyntheticEvent } from "react"
import { Button, Checkbox, Fieldset, Textfield } from "@digdir/designsystemet-react"
import { fdBoolean, fdString } from "@/utils/formData"

type UserCreationFormProps = {
  pending: boolean
  onSubmit: (input: { name: string; email: string; is_child: boolean }) => void
}

export function UserCreationForm({ pending, onSubmit }: UserCreationFormProps) {
  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    onSubmit({
      name: fdString(fd, "name"),
      email: fdString(fd, "email"),
      is_child: fdBoolean(fd, "is_child"),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <Fieldset>
        <Fieldset.Legend>Step 1 – Create your admin account</Fieldset.Legend>
        <div>
          <Textfield label="Name" type="text" name="name" required />
        </div>
        <div>
          <Textfield label="Email" type="email" name="email" required />
        </div>
        <div>
          <Checkbox label="Is child" name="is_child" />
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            Create admin
          </Button>
        </div>
      </Fieldset>
    </form>
  )
}

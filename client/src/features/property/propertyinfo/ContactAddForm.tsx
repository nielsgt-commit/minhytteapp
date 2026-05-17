import { type SyntheticEvent } from "react"
import { Button, Fieldset, Textfield } from "@digdir/designsystemet-react"

type Props = {
  createPending: boolean
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}

export function ContactAddForm({ createPending, onSubmit, onCancel }: Props) {
  return (
    <>
      <strong>Add contact</strong>
      <form
        onSubmit={onSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <Fieldset>
          <Fieldset.Legend>New contact</Fieldset.Legend>
          <Textfield
            label="Name"
            name="name"
            required
            autoFocus
            maxLength={255}
            disabled={createPending}
          />
          <Textfield
            label="Phone"
            name="phone"
            type="tel"
            maxLength={64}
            disabled={createPending}
          />
          <Textfield
            label="Email"
            name="email"
            type="email"
            maxLength={255}
            disabled={createPending}
          />
          <Textfield
            label="Info"
            name="info"
            multiline
            rows={3}
            maxLength={1024}
            disabled={createPending}
          />
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <Button type="submit" disabled={createPending}>
              Add contact
            </Button>
            <Button
              type="button"
              variant="tertiary"
              disabled={createPending}
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </Fieldset>
      </form>
    </>
  )
}

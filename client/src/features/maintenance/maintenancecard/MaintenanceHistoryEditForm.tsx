import { type SyntheticEvent } from "react"
import {
  Button,
  Card,
  Fieldset,
  Textfield,
} from "@digdir/designsystemet-react"

export type MaintenanceHistoryItem = {
  id: number
  description: string
  instructions: string | null
}

export function MaintenanceHistoryEditForm(props: {
  item: MaintenanceHistoryItem
  pending: boolean
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  const { item, pending, onSubmit, onCancel } = props
  return (
    <Card key={item.id} asChild>
      <article>
        <Card.Block>
          <form onSubmit={onSubmit}>
            <Fieldset>
              <Fieldset.Legend>Edit completed task</Fieldset.Legend>
              <Textfield
                label="Task"
                name="description"
                defaultValue={item.description}
                required
              />
              <Textfield
                label="Instructions"
                name="instructions"
                defaultValue={item.instructions ?? ""}
              />
              <Button type="submit" disabled={pending}>Save</Button>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={onCancel}
              >
                Cancel
              </Button>
            </Fieldset>
          </form>
        </Card.Block>
      </article>
    </Card>
  )
}

import { Button, Card } from "@digdir/designsystemet-react"

type Contact = {
  id: number
  property_id: number
  name: string
  phone: string | null
  email: string | null
  info: string | null
}

type Props = {
  contacts: Contact[] | undefined
  editMode: boolean
  pending: boolean
  isAdding: boolean
  onEdit: (id: number) => void
  onDelete: (c: Contact) => void
  onStartAdd: () => void
  addSlot: React.ReactNode
}

export function ContactListView({
  contacts,
  editMode,
  pending,
  isAdding,
  onEdit,
  onDelete,
  onStartAdd,
  addSlot,
}: Props) {
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      {contacts?.map(c => (
        <Card asChild key={c.id}>
          <li>
            <Card.Block
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{c.name}</span>
              {editMode && (
                <>
                  <Button
                    variant="tertiary"
                    data-size="sm"
                    disabled={pending}
                    onClick={() => { onEdit(c.id) }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="tertiary"
                    data-color="danger"
                    data-size="sm"
                    disabled={pending}
                    onClick={() => { onDelete(c) }}
                  >
                    Delete
                  </Button>
                </>
              )}
            </Card.Block>
          </li>
        </Card>
      ))}

      <Card asChild key="__add">
        <li>
          <Card.Block
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {isAdding ? (
              addSlot
            ) : (
              <Button
                variant="tertiary"
                style={{
                  flex: 1,
                  minHeight: "4rem",
                  alignSelf: "stretch",
                }}
                disabled={pending}
                onClick={onStartAdd}
              >
                + Add contact
              </Button>
            )}
          </Card.Block>
        </li>
      </Card>
    </ul>
  )
}

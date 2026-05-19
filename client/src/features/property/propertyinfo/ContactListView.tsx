import { Button, Card } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./ContactListView.module.css"

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
  const { t } = useTranslation("property")
  return (
    <ul className={styles.list}>
      {contacts?.map(c => (
        <Card asChild key={c.id}>
          <li>
            <Card.Block className={styles.row}>
              <span className={styles.rowName}>{c.name}</span>
              {editMode && (
                <>
                  <Button
                    variant="tertiary"
                    data-size="sm"
                    disabled={pending}
                    onClick={() => { onEdit(c.id) }}
                  >
                    {t("Edit")}
                  </Button>
                  <Button
                    variant="tertiary"
                    data-color="danger"
                    data-size="sm"
                    disabled={pending}
                    onClick={() => { onDelete(c) }}
                  >
                    {t("Delete")}
                  </Button>
                </>
              )}
            </Card.Block>
          </li>
        </Card>
      ))}

      <Card asChild key="__add">
        <li>
          <Card.Block className={styles.addBlock}>
            {isAdding ? (
              addSlot
            ) : (
              <Button
                variant="tertiary"
                className={styles.addButton}
                disabled={pending}
                onClick={onStartAdd}
              >
                {t("+ Add contact")}
              </Button>
            )}
          </Card.Block>
        </li>
      </Card>
    </ul>
  )
}

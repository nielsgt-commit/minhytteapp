import { useState } from "react"
import { Button, Card, Link, Tag } from "@digdir/designsystemet-react"
import { EnvelopeClosedIcon, PhoneIcon } from "@navikt/aksel-icons"
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
  const [expandedId, setExpandedId] = useState<number | null>(null)
  return (
    <ul className={styles.list}>
      {contacts?.map(c => {
        const hasDetails = Boolean(c.phone ?? c.email)
        const expanded = !editMode && expandedId === c.id && hasDetails
        return (
          <Card asChild key={c.id}>
            <li>
              <Card.Block className={styles.row}>
                {editMode ? (
                  <span className={styles.rowName}>{c.name}</span>
                ) : (
                  <button
                    type="button"
                    className={styles.toggle}
                    aria-expanded={expanded}
                    disabled={!hasDetails}
                    onClick={() => {
                      setExpandedId(expanded ? null : c.id)
                    }}
                  >
                    <span className={styles.rowName}>{c.name}</span>
                    {c.phone && (
                      <Tag data-color="info" data-size="sm" className={styles.tag}>
                        <PhoneIcon aria-hidden />
                        {t("Phone")}
                      </Tag>
                    )}
                    {c.email && (
                      <Tag data-color="info" data-size="sm" className={styles.tag}>
                        <EnvelopeClosedIcon aria-hidden />
                        {t("Email")}
                      </Tag>
                    )}
                  </button>
                )}
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
              {expanded && (
                <Card.Block className={styles.details}>
                  {c.phone && (
                    <div className={styles.line}>
                      <PhoneIcon aria-hidden />
                      <Link href={`tel:${c.phone}`}>{c.phone}</Link>
                    </div>
                  )}
                  {c.email && (
                    <div className={styles.line}>
                      <EnvelopeClosedIcon aria-hidden />
                      <Link href={`mailto:${c.email}`}>{c.email}</Link>
                    </div>
                  )}
                </Card.Block>
              )}
            </li>
          </Card>
        )
      })}

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

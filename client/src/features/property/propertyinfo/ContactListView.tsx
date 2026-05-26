import { type ReactNode, useState } from "react"
import { Button, Card, Link, Tag } from "@digdir/designsystemet-react"
import { EnvelopeClosedIcon, PhoneIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { InlineEditRow } from "@/components/shared/InlineEditRow"
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
  canEdit: boolean
  pending: boolean
  isAdding: boolean
  editingId: number | null
  onEdit: (id: number) => void
  onDelete: (c: Contact) => void
  onStartAdd: () => void
  renderEditForm: (c: Contact) => ReactNode
  addSlot: ReactNode
}

export function ContactListView({
  contacts,
  canEdit,
  pending,
  isAdding,
  editingId,
  onEdit,
  onDelete,
  onStartAdd,
  renderEditForm,
  addSlot,
}: Props) {
  const { t } = useTranslation("property")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  return (
    <ul className={styles.list}>
      {contacts?.map(c => {
        const hasDetails = Boolean(c.phone ?? c.email)
        const isEditing = editingId === c.id
        const expanded = !isEditing && expandedId === c.id && hasDetails
        return (
          <Card asChild key={c.id}>
            <li>
              <Card.Block className={styles.row}>
                <InlineEditRow
                  editing={isEditing}
                  canEdit={canEdit}
                  pending={pending}
                  editLabel={t("Edit contact {{name}}", { name: c.name })}
                  onStartEdit={() => {
                    onEdit(c.id)
                  }}
                  view={
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
                        <Tag
                          data-color="info"
                          data-size="sm"
                          className={styles.tag}
                        >
                          <PhoneIcon aria-hidden />
                          {t("Phone")}
                        </Tag>
                      )}
                      {c.email && (
                        <Tag
                          data-color="info"
                          data-size="sm"
                          className={styles.tag}
                        >
                          <EnvelopeClosedIcon aria-hidden />
                          {t("Email")}
                        </Tag>
                      )}
                    </button>
                  }
                  form={renderEditForm(c)}
                  actions={
                    <Button
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      disabled={pending}
                      aria-label={t("Remove contact {{name}}", {
                        name: c.name,
                      })}
                      onClick={() => {
                        onDelete(c)
                      }}
                    >
                      {t("Delete")}
                    </Button>
                  }
                />
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

      {canEdit && (
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
      )}
    </ul>
  )
}

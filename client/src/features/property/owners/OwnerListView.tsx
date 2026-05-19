import { Button, Card, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { ownerLabel } from "./ownershipCalculations.ts"
import styles from "./OwnerListView.module.css"

type Owner = {
  id: number
  user_id: number | null
  user_group_id: number | null
  user_name: string | null
  user_group_name: string | null
  ownership_pct: number | string
}

type Props = {
  owners: Owner[]
  editMode: boolean
  pending: boolean
  onEdit: (id: number) => void
  onRemove: (o: Owner) => void
  onStartAdd: () => void
}

export function OwnerListView({
  owners,
  editMode,
  pending,
  onEdit,
  onRemove,
  onStartAdd,
}: Props) {
  const { t } = useTranslation("property")
  return (
    <>
      {owners.length === 0 ? (
        <p>{t("No owners yet.")}</p>
      ) : (
        <ul className={styles.list}>
          {owners.map(o => {
            const isUser = o.user_id != null
            return (
              <Card asChild key={o.id}>
                <li>
                  <Card.Block className={styles.row}>
                    <span className={styles.rowName}>
                      {ownerLabel(o)}
                    </span>
                    <Tag data-color={isUser ? "info" : "neutral"}>
                      {isUser ? t("User") : t("Group")}
                    </Tag>
                    <span>{o.ownership_pct}%</span>
                    {editMode && (
                      <>
                        <Button
                          variant="tertiary"
                          data-size="sm"
                          disabled={pending}
                          onClick={() => { onEdit(o.id) }}
                        >
                          {t("Edit")}
                        </Button>
                        <Button
                          variant="tertiary"
                          data-color="danger"
                          data-size="sm"
                          disabled={pending}
                          onClick={() => { onRemove(o) }}
                        >
                          {t("Delete")}
                        </Button>
                      </>
                    )}
                  </Card.Block>
                </li>
              </Card>
            )
          })}
        </ul>
      )}

      {editMode && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={onStartAdd}
        >
          {t("+ Add owner")}
        </Button>
      )}
    </>
  )
}

import { Button, Card, List, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { InlineEditField } from "@/components/shared/InlineEditField"
import { ownerLabel } from "./ownershipCalculations.ts"
import styles from "./OwnerListView.module.css"

type Owner = {
  id: number
  user_group_id: number | null
  user_group_name: string | null
  ownership_pct: number | string
}

type Props = {
  owners: Owner[]
  canEdit: boolean
  pending: boolean
  onPctSave: (o: Owner, pct: number) => void
  onRemove: (o: Owner) => void
  onStartAdd: () => void
}

export function OwnerListView({
  owners,
  canEdit,
  pending,
  onPctSave,
  onRemove,
  onStartAdd,
}: Props) {
  const { t } = useTranslation("property")
  return (
    <>
      {owners.length === 0 ? (
        <Paragraph>{t("No owners yet.")}</Paragraph>
      ) : (
        <List.Unordered className={styles.list}>
          {owners.map(o => {
            const label = ownerLabel(o)
            return (
              <Card asChild key={o.id}>
                <List.Item>
                  <Card.Block className={styles.row}>
                    <span className={styles.rowName}>{label}</span>
                    <span className={styles.pct}>
                      <InlineEditField
                        value={String(o.ownership_pct)}
                        canEdit={canEdit}
                        pending={pending}
                        ariaLabel={t("Edit ownership % for {{label}}", {
                          label,
                        })}
                        onSave={next => {
                          const pct = Number(next)
                          if (Number.isFinite(pct)) onPctSave(o, pct)
                        }}
                      />
                      %
                    </span>
                    {canEdit && (
                      <Button
                        variant="tertiary"
                        data-color="danger"
                        data-size="sm"
                        disabled={pending}
                        aria-label={t("Remove {{label}} as owner?", { label })}
                        onClick={() => {
                          onRemove(o)
                        }}
                      >
                        {t("Delete")}
                      </Button>
                    )}
                  </Card.Block>
                </List.Item>
              </Card>
            )
          })}
        </List.Unordered>
      )}

      {canEdit && (
        <Button variant="secondary" disabled={pending} onClick={onStartAdd}>
          {t("+ Add owner")}
        </Button>
      )}
    </>
  )
}

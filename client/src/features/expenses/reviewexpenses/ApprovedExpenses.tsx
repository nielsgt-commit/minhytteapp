import { Card, Details, Paragraph, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./ReviewExpenses.module.css"
import type { ExpenseRow } from "../types.ts"
import { STATUS_COLOR } from "../expenseStatus.ts"
import { formatDate } from "@/utils/dateUtils"

type Props = {
  expenses: ExpenseRow[]
}

export function ApprovedExpenses({ expenses }: Props) {
  const { t, i18n } = useTranslation("expenses")
  if (expenses.length === 0) return null
  return (
    <Details>
      <Details.Summary>
        {t("Approved expenses ({{count}})", { count: expenses.length })}
      </Details.Summary>
      <Details.Content className={styles.content}>
        <ul className={styles.cardList}>
          {expenses.map(e => (
            <li key={e.id}>
              <Card asChild>
                <article>
                  <Card.Block className={styles.row} data-size="sm">
                    <div className={styles.cardHeader}>
                      <div className={styles.headerRow}>
                        <Paragraph asChild data-size="sm">
                          <span className={styles.category}>
                            {e.expense_types[0] ?? t("(no category)")}
                          </span>
                        </Paragraph>
                        <Tag data-color={STATUS_COLOR[e.status]} data-size="sm">
                          {e.status}
                        </Tag>
                      </div>
                      {e.description.trim() !== "" && (
                        <Paragraph
                          className={styles.description}
                          data-size="sm"
                        >
                          {e.description}
                        </Paragraph>
                      )}
                    </div>
                    <Paragraph asChild data-size="sm">
                      <span className={styles.receipt}>
                        {t("Date on receipt")}
                        {": "}
                        {formatDate(e.receipt_date, i18n.language)}
                      </span>
                    </Paragraph>
                    <Paragraph className={styles.sumLabel} data-size="sm">
                      {t("Sum")}
                    </Paragraph>
                    <div className={styles.amountGroup}>
                      <Paragraph asChild data-size="sm">
                        <span>{e.amount}</span>
                      </Paragraph>
                      <Paragraph asChild data-size="sm">
                        <span>{t(",-")}</span>
                      </Paragraph>
                    </div>
                    <Paragraph
                      className={styles.submittedByLabel}
                      data-size="sm"
                    >
                      {t("Submitted by")}
                    </Paragraph>
                    <Tag
                      className={styles.name}
                      data-color="info"
                      data-size="sm"
                    >
                      {e.payer_name ?? `#${String(e.payer_id)}`}
                    </Tag>
                  </Card.Block>
                </article>
              </Card>
            </li>
          ))}
        </ul>
      </Details.Content>
    </Details>
  )
}

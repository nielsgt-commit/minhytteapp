import { Button, Card, Divider, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./Equipment.module.css"
import type {
  EquipmentHistoryEntryData} from "@/features/maintenance/equipment/EquipmentHistoryEntry.tsx";
import {
  EquipmentHistoryEntry
} from "@/features/maintenance/equipment/EquipmentHistoryEntry.tsx"
import { InspectionFlow } from "@/features/maintenance/inspectionflow/InspectionFlow.tsx"
import { MaintenanceTodos } from "@/features/maintenance/maintenancecard/MaintenanceTodos.tsx"
import { useIsMobile } from "@/hooks/useIsMobile.ts"

export type ModalState =
  | { kind: "none" }
  | { kind: "inspecting"; id: number }
  | { kind: "history"; id: number }
  | { kind: "todos"; id: number }

type EquipmentItem = {
  id: number
  name: string
  brand: string | null
  model: string | null
  category: string | null
  acquired_year: number | null
}

export function EquipmentCard(props: {
  item: EquipmentItem
  historyEntries: readonly EquipmentHistoryEntryData[]
  modalState: ModalState
  setModalState: (next: ModalState) => void
}) {
  const { t } = useTranslation("maintenance")
  const isMobile = useIsMobile()
  const {
    item,
    historyEntries,
    modalState,
    setModalState,
  } = props

  const isInspecting =
    modalState.kind === "inspecting" && modalState.id === item.id
  const isHistoryOpen =
    modalState.kind === "history" && modalState.id === item.id
  const isTodosOpen =
    modalState.kind === "todos" && modalState.id === item.id

  const todosLabel = isMobile
    ? t("Todos")
    : isTodosOpen ? t("Hide todos") : t("Show todos")
  const historyLabel = isMobile
    ? t("History")
    : isHistoryOpen ? t("Hide history") : t("Show history")

  return (
    <Card asChild>
      <article>
        <Card.Block className={styles.row} data-size="sm">
          <div className={styles.nameGroup}>
            <Paragraph className={styles.name} data-size="sm">
              {item.name}
            </Paragraph>
            {(item.brand ?? item.model) && (
              <Paragraph className={styles.brandModel} data-size="xs">
                {[item.brand, item.model].filter(Boolean).join(" · ")}
              </Paragraph>
            )}
            {item.acquired_year != null && (
              <Paragraph className={styles.brandModel} data-size="xs">
                {t("Acquired {{year}}", { year: item.acquired_year })}
              </Paragraph>
            )}
          </div>
          <Paragraph className={styles.category} data-size="sm">
            {item.category ?? ""}
          </Paragraph>
          {!isInspecting && (
            <Button
              className={styles.inspect}
              variant="secondary"
              data-size="sm"
              onClick={() => {
                setModalState({ kind: "inspecting", id: item.id })
              }}
            >
              {t("Start inspection")}
            </Button>
          )}
          {!isInspecting && (
            <Divider className={styles.divider} />
          )}
          <div className={styles.actions}>
            {!isInspecting && (
              <Button
                variant="tertiary"
                data-size="sm"
                onClick={() => {
                  setModalState(
                    isTodosOpen
                      ? { kind: "none" }
                      : { kind: "todos", id: item.id },
                  )
                }}
              >
                {todosLabel}
              </Button>
            )}
            {!isInspecting && (
              <Button
                variant="tertiary"
                data-size="sm"
                onClick={() => {
                  setModalState(
                    isHistoryOpen
                      ? { kind: "none" }
                      : { kind: "history", id: item.id },
                  )
                }}
              >
                {historyLabel}
              </Button>
            )}
          </div>
        </Card.Block>
        {isTodosOpen && !isInspecting && (
          <Card.Block>
            <MaintenanceTodos
              scope={{ kind: "equipment", id: item.id, name: item.name }}
            />
          </Card.Block>
        )}
        {isHistoryOpen && !isInspecting && (
          <Card.Block>
            {historyEntries.length === 0 ? (
              <Paragraph data-size="sm">
                {t("No history yet.")}
              </Paragraph>
            ) : (
              <div className={styles.list}>
                {historyEntries.map(entry => {
                  const key =
                    entry.kind === "inspection"
                      ? `i-${String(entry.i.id)}`
                      : `m-${String(entry.m.id)}`
                  return <EquipmentHistoryEntry key={key} entry={entry} />
                })}
              </div>
            )}
          </Card.Block>
        )}
        {isInspecting && (
          <Card.Block>
            <InspectionFlow
              scope={{
                kind: "equipment",
                id: item.id,
                name: item.name,
              }}
              open={isInspecting}
              onClose={() => { setModalState({ kind: "none" }) }}
            />
          </Card.Block>
        )}
      </article>
    </Card>
  )
}

import { type SyntheticEvent } from "react"
import { Button, Card, Paragraph, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./Equipment.module.css"
import type {
  EquipmentHistoryEntryData} from "@/features/maintenance/equipment/EquipmentHistoryEntry.tsx";
import {
  EquipmentHistoryEntry
} from "@/features/maintenance/equipment/EquipmentHistoryEntry.tsx"
import { InspectionFlow } from "@/features/maintenance/inspectionflow/InspectionFlow.tsx"

export type ModalState =
  | { kind: "none" }
  | { kind: "scheduling"; id: number }
  | { kind: "inspecting"; id: number }
  | { kind: "history"; id: number }

type EquipmentItem = {
  id: number
  name: string
  structure_id: number
  category: string | null
}

export function EquipmentCard(props: {
  item: EquipmentItem
  structureName: string
  historyEntries: readonly EquipmentHistoryEntryData[]
  modalState: ModalState
  setModalState: (next: ModalState) => void
  onScheduleSubmit: (
    equipmentId: number,
  ) => (e: SyntheticEvent<HTMLFormElement>) => void
  schedulePending: boolean
  canSubmitSchedule: boolean
}) {
  const { t } = useTranslation("maintenance")
  const {
    item,
    structureName,
    historyEntries,
    modalState,
    setModalState,
    onScheduleSubmit,
    schedulePending,
    canSubmitSchedule,
  } = props

  const isScheduling =
    modalState.kind === "scheduling" && modalState.id === item.id
  const isInspecting =
    modalState.kind === "inspecting" && modalState.id === item.id
  const isHistoryOpen =
    modalState.kind === "history" && modalState.id === item.id

  return (
    <Card asChild>
      <article>
        <Card.Block className={styles.row} data-size="sm">
          <Paragraph className={styles.name} data-size="sm">
            {item.name}
          </Paragraph>
          <Paragraph className={styles.building} data-size="sm">
            {structureName}
          </Paragraph>
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
          <div className={styles.actions}>
            {!isScheduling && !isInspecting && (
              <Button
                variant="tertiary"
                data-size="sm"
                onClick={() => {
                  setModalState({ kind: "scheduling", id: item.id })
                }}
              >
                {t("Schedule maintenance")}
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
                {isHistoryOpen ? t("Hide history") : t("Show history")}
              </Button>
            )}
          </div>
        </Card.Block>
        {isScheduling && !isInspecting && (
          <Card.Block>
            <form
              onSubmit={onScheduleSubmit(item.id)}
              className={styles.schedule}
            >
              <Textfield
                label={t("Task")}
                name="description"
                defaultValue={t("Service {{name}}", { name: item.name })}
                required
              />
              <Textfield
                label={t("Due")}
                type="date"
                name="due_at"
              />
              <div className={styles.scheduleActions}>
                <Button
                  type="submit"
                  data-size="sm"
                  disabled={schedulePending || !canSubmitSchedule}
                >
                  {t("Schedule")}
                </Button>
                <Button
                  variant="secondary"
                  data-size="sm"
                  disabled={schedulePending}
                  onClick={() => { setModalState({ kind: "none" }) }}
                >
                  {t("Cancel")}
                </Button>
              </div>
            </form>
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

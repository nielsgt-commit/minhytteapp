import { useState } from "react"
import {
  Button,
  Card,
  Dropdown,
  Heading,
  Paragraph,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import {
  ClipboardCheckmarkIcon,
  ClockDashedIcon,
  MenuElipsisVerticalIcon,
} from "@navikt/aksel-icons"
import styles from "./Equipment.module.css"
import type { EquipmentHistoryEntryData } from "@/features/maintenance/equipment/EquipmentHistoryEntry.tsx"
import { EquipmentHistoryEntry } from "@/features/maintenance/equipment/EquipmentHistoryEntry.tsx"
import { InspectionFlow } from "@/features/maintenance/inspectionflow/InspectionFlow.tsx"
import { MaintenanceTodos } from "@/features/maintenance/maintenancecard/MaintenanceTodos.tsx"
import { useIsMobile } from "@/hooks/useIsMobile.ts"
import { EmptyState } from "@/components/shared/query-states/EmptyState"

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
  const [menuOpen, setMenuOpen] = useState(false)
  const { item, historyEntries, modalState, setModalState } = props

  const isInspecting =
    modalState.kind === "inspecting" && modalState.id === item.id
  const isHistoryOpen =
    modalState.kind === "history" && modalState.id === item.id
  const isTodosOpen = modalState.kind === "todos" && modalState.id === item.id

  const historyLabel = isMobile
    ? t("History")
    : isHistoryOpen
      ? t("Hide history")
      : t("Show history")

  const nameGroup = (
    <div className={styles.nameGroup}>
      <Heading level={3} data-size="xs" className={styles.name}>
        {item.name}
      </Heading>
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
      {item.category && (
        <Paragraph className={styles.category} data-size="xs">
          {item.category}
        </Paragraph>
      )}
    </div>
  )

  const historyToggle = (
    <Button
      variant="tertiary"
      data-size="sm"
      onClick={() => {
        setModalState(
          isHistoryOpen ? { kind: "none" } : { kind: "history", id: item.id },
        )
      }}
    >
      <ClockDashedIcon aria-hidden fontSize="1.25rem" />
      {historyLabel}
    </Button>
  )

  const todosToggle = (
    <Button
      variant="tertiary"
      data-size="sm"
      onClick={() => {
        setModalState(
          isTodosOpen ? { kind: "none" } : { kind: "todos", id: item.id },
        )
      }}
    >
      <ClipboardCheckmarkIcon aria-hidden fontSize="1.25rem" />
      {t("Todos")}
    </Button>
  )

  // On the narrowest phones the History/Todos labels stop fitting next to the
  // name, so collapse them into a kebab menu in the top-right corner instead.
  const kebabMenu = (
    <Dropdown.TriggerContext>
      <Dropdown.Trigger
        variant="tertiary"
        data-size="sm"
        icon
        aria-label={t("More actions")}
      >
        <MenuElipsisVerticalIcon aria-hidden fontSize="1.25rem" />
      </Dropdown.Trigger>
      <Dropdown
        placement="bottom-end"
        open={menuOpen}
        onOpen={() => {
          setMenuOpen(true)
        }}
        onClose={() => {
          setMenuOpen(false)
        }}
      >
        <Dropdown.List>
          <Dropdown.Item>
            <Dropdown.Button
              className={styles.menuItem}
              onClick={() => {
                setModalState(
                  isTodosOpen
                    ? { kind: "none" }
                    : { kind: "todos", id: item.id },
                )
                setMenuOpen(false)
              }}
            >
              <ClipboardCheckmarkIcon aria-hidden fontSize="1.25rem" />
              {t("Todos")}
            </Dropdown.Button>
          </Dropdown.Item>
          <Dropdown.Item>
            <Dropdown.Button
              className={styles.menuItem}
              onClick={() => {
                setModalState(
                  isHistoryOpen
                    ? { kind: "none" }
                    : { kind: "history", id: item.id },
                )
                setMenuOpen(false)
              }}
            >
              <ClockDashedIcon aria-hidden fontSize="1.25rem" />
              {t("History")}
            </Dropdown.Button>
          </Dropdown.Item>
        </Dropdown.List>
      </Dropdown>
    </Dropdown.TriggerContext>
  )

  const inspectButton = (
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
  )

  const historyBlock = isHistoryOpen && !isInspecting && (
    <Card.Block>
      {historyEntries.length === 0 ? (
        <EmptyState title={t("No history yet.")} />
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
  )

  const todosBlock = isTodosOpen && !isInspecting && (
    <Card.Block>
      <MaintenanceTodos
        scope={{ kind: "equipment", id: item.id, name: item.name }}
      />
    </Card.Block>
  )

  const inspectionBlock = isInspecting && (
    <Card.Block>
      <InspectionFlow
        scope={{
          kind: "equipment",
          id: item.id,
          name: item.name,
        }}
        open={isInspecting}
        onClose={() => {
          setModalState({ kind: "none" })
        }}
      />
    </Card.Block>
  )

  if (isMobile) {
    return (
      <Card asChild>
        <article>
          <Card.Block className={styles.topRow} data-size="sm">
            {nameGroup}
            {!isInspecting && kebabMenu}
          </Card.Block>
          {!isInspecting && (
            <Card.Block className={styles.inspectRow} data-size="sm">
              {inspectButton}
            </Card.Block>
          )}
          {historyBlock}
          {todosBlock}
          {inspectionBlock}
        </article>
      </Card>
    )
  }

  return (
    <Card asChild>
      <article>
        <Card.Block className={styles.row} data-size="sm">
          {nameGroup}
          {!isInspecting && historyToggle}
          {!isInspecting && todosToggle}
          {!isInspecting && inspectButton}
        </Card.Block>
        {historyBlock}
        {todosBlock}
        {inspectionBlock}
      </article>
    </Card>
  )
}

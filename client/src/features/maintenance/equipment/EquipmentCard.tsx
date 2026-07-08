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
  ImageIcon,
  MenuElipsisVerticalIcon,
} from "@navikt/aksel-icons"
import styles from "./Equipment.module.css"
import type { EquipmentHistoryEntryData } from "@/features/maintenance/equipment/EquipmentHistoryEntry.tsx"
import { EquipmentHistoryEntry } from "@/features/maintenance/equipment/EquipmentHistoryEntry.tsx"
import { InspectionFlow } from "@/features/maintenance/inspectionflow/InspectionFlow.tsx"
import { MaintenanceTodos } from "@/features/maintenance/maintenancecard/MaintenanceTodos.tsx"
import { useIsMobile } from "@/hooks/useIsMobile.ts"
import { BottomSheet } from "@/components/shared/BottomSheet"
import { EmptyState } from "@/components/shared/query-states/EmptyState"

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
}) {
  const { t } = useTranslation("maintenance")
  const isMobile = useIsMobile()
  const [sheet, setSheet] = useState<
    "none" | "todos" | "history" | "inspection"
  >("none")
  const [menuOpen, setMenuOpen] = useState(false)
  const { item, historyEntries } = props

  const closeSheet = () => {
    setSheet("none")
  }

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

  const historyButton = (
    <Button
      variant="tertiary"
      data-size="sm"
      onClick={() => {
        setSheet("history")
      }}
    >
      <ClockDashedIcon aria-hidden fontSize="1.25rem" />
      {t("History")}
    </Button>
  )

  const todosButton = (
    <Button
      variant="tertiary"
      data-size="sm"
      onClick={() => {
        setSheet("todos")
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
                setSheet("todos")
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
                setSheet("history")
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
        setSheet("inspection")
      }}
    >
      {t("Start inspection")}
    </Button>
  )

  return (
    <Card asChild>
      <article>
        <Card.Block className={styles.row} data-size="sm">
          {nameGroup}
          {isMobile ? (
            kebabMenu
          ) : (
            <>
              {historyButton}
              {todosButton}
              {inspectButton}
            </>
          )}
        </Card.Block>
        {/* Placeholder slot for a future image/thumbnail of the equipment. */}
        <Card.Block className={styles.imageRow} data-size="sm">
          <ImageIcon aria-hidden fontSize="1.25rem" />
        </Card.Block>
        {isMobile && (
          <Card.Block className={styles.inspectRow} data-size="sm">
            {inspectButton}
          </Card.Block>
        )}
        <BottomSheet
          open={sheet === "todos"}
          onClose={closeSheet}
          title={t("Todos for {{name}}", { name: item.name })}
        >
          <MaintenanceTodos
            scope={{ kind: "equipment", id: item.id, name: item.name }}
          />
        </BottomSheet>
        <BottomSheet
          open={sheet === "history"}
          onClose={closeSheet}
          title={t("History for {{name}}", { name: item.name })}
        >
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
        </BottomSheet>
        <BottomSheet
          open={sheet === "inspection"}
          onClose={closeSheet}
          title={t("Inspect {{name}}", { name: item.name })}
        >
          <InspectionFlow
            scope={{
              kind: "equipment",
              id: item.id,
              name: item.name,
            }}
            open={sheet === "inspection"}
            onClose={closeSheet}
          />
        </BottomSheet>
      </article>
    </Card>
  )
}

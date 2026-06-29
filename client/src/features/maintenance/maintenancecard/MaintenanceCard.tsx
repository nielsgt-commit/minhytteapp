import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Card,
  Dropdown,
  Heading,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import {
  ClipboardCheckmarkIcon,
  ClockDashedIcon,
  MenuElipsisVerticalIcon,
} from "@navikt/aksel-icons"
import styles from "./MaintenanceCard.module.css"
import { InspectionFlow } from "@/features/maintenance/inspectionflow/InspectionFlow.tsx"
import { MaintenanceHistory } from "@/features/maintenance/maintenancecard/MaintenanceHistory.tsx"
import { MaintenanceTodos } from "@/features/maintenance/maintenancecard/MaintenanceTodos.tsx"
import { useIsMobile } from "@/hooks/useIsMobile.ts"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { useTRPC } from "@/trpc/trpc.ts"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"

export type MaintenanceScope =
  | { kind: "structure"; id: number; name: string; builtYear?: number | null }
  | {
      kind: "infrastructure"
      id: number
      name: string
      builtYear?: number | null
    }
  | { kind: "equipment"; id: number; name: string; builtYear?: number | null }

export function MaintenanceCard({ scope }: { scope: MaintenanceScope }) {
  const { t } = useTranslation("maintenance")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const [view, setView] = useState<"none" | "todos" | "history">("none")
  const [inspecting, setInspecting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isMobile = useIsMobile()

  // Shares its cache key with MaintenanceTodos/MaintenanceHistory, so this only
  // surfaces the summary counts already loaded for the card's expandable views.
  const { data: items } = useQuery(
    trpc.maintenance.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

  const matchesScope = (i: NonNullable<typeof items>[number]) =>
    scope.kind === "structure"
      ? i.structure_id === scope.id
      : scope.kind === "infrastructure"
        ? i.infrastructure_id === scope.id
        : i.equipment_id === scope.id

  const scoped = items?.filter(matchesScope) ?? []
  const openTodosCount = scoped.filter(
    i => i.status === "todo" || i.status === "doing",
  ).length

  const showTodos = view === "todos"
  const showHistory = view === "history"

  const historyLabel = isMobile
    ? t("History")
    : showHistory
      ? t("Hide history")
      : t("Show history")

  const toggleTodos = () => {
    setView(v => (v === "todos" ? "none" : "todos"))
  }
  const toggleHistory = () => {
    setView(v => (v === "history" ? "none" : "history"))
  }

  const historyToggle = (
    <Button variant="tertiary" data-size="sm" onClick={toggleHistory}>
      <ClockDashedIcon aria-hidden fontSize="1.25rem" />
      {historyLabel}
    </Button>
  )

  const todosToggle = (
    <Badge.Position placement="top-right">
      {openTodosCount > 0 && <Badge count={openTodosCount} />}
      <Button variant="tertiary" data-size="sm" onClick={toggleTodos}>
        <ClipboardCheckmarkIcon aria-hidden fontSize="1.25rem" />
        {t("Todos")}
      </Button>
    </Badge.Position>
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
        <Badge.Position placement="top-right">
          {openTodosCount > 0 && <Badge count={openTodosCount} />}
          <MenuElipsisVerticalIcon aria-hidden fontSize="1.25rem" />
        </Badge.Position>
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
                toggleTodos()
                setMenuOpen(false)
              }}
            >
              <ClipboardCheckmarkIcon aria-hidden fontSize="1.25rem" />
              {t("Todos")}
              {openTodosCount > 0 && (
                <Badge
                  className={styles.menuCount}
                  count={openTodosCount}
                  data-color="accent"
                />
              )}
            </Dropdown.Button>
          </Dropdown.Item>
          <Dropdown.Item>
            <Dropdown.Button
              className={styles.menuItem}
              onClick={() => {
                toggleHistory()
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

  const todosBlock = showTodos && !inspecting && (
    <Card.Block>
      <MaintenanceTodos scope={scope} />
    </Card.Block>
  )
  const historyBlock = showHistory && !inspecting && (
    <Card.Block>
      <QueryBoundary>
        <MaintenanceHistory scope={scope} />
      </QueryBoundary>
    </Card.Block>
  )
  const inspectionBlock = inspecting && (
    <Card.Block>
      <InspectionFlow
        scope={scope}
        open={inspecting}
        onClose={() => {
          setInspecting(false)
        }}
      />
    </Card.Block>
  )

  if (isMobile) {
    return (
      <Card asChild>
        <article>
          <Card.Block className={styles.mobileTopRow} data-size="sm">
            <Heading level={3} data-size="xs" className={styles.nameTag}>
              {scope.name}
            </Heading>
            {!inspecting && kebabMenu}
          </Card.Block>
          {!inspecting && (
            <Card.Block className={styles.mobileInspectRow} data-size="sm">
              <Button
                className={styles.inspect}
                variant="secondary"
                data-size="sm"
                onClick={() => {
                  setInspecting(true)
                }}
              >
                {t("Start inspection")}
              </Button>
            </Card.Block>
          )}
          {todosBlock}
          {historyBlock}
          {inspectionBlock}
        </article>
      </Card>
    )
  }

  return (
    <Card asChild>
      <article>
        <Card.Block className={styles.row} data-size="sm">
          <Heading level={3} data-size="xs" className={styles.name}>
            {scope.name}
          </Heading>
          {!inspecting && historyToggle}
          {!inspecting && todosToggle}
          {!inspecting && (
            <Button
              className={styles.inspect}
              variant="secondary"
              data-size="sm"
              onClick={() => {
                setInspecting(true)
              }}
            >
              {t("Start inspection")}
            </Button>
          )}
        </Card.Block>
        {todosBlock}
        {historyBlock}
        {inspectionBlock}
      </article>
    </Card>
  )
}

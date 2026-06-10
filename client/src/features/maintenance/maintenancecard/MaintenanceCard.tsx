import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Card,
  Divider,
  Heading,
  Paragraph,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { ClockDashedIcon } from "@navikt/aksel-icons"
import styles from "./MaintenanceCard.module.css"
import { InspectionFlow } from "@/features/maintenance/inspectionflow/InspectionFlow.tsx"
import { MaintenanceHistory } from "@/features/maintenance/maintenancecard/MaintenanceHistory.tsx"
import { MaintenanceTodos } from "@/features/maintenance/maintenancecard/MaintenanceTodos.tsx"
import { useIsMobile } from "@/hooks/useIsMobile.ts"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { useTRPC } from "@/trpc/trpc.ts"

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

  // The build/since year counts as the structure's first completed milestone, so
  // it surfaces as "last completed" until real maintenance is logged on top of it.
  const builtYear = scope.builtYear ?? null
  const finished: { description: string; t: number }[] = scoped.flatMap(i =>
    i.status === "done" && i.completed_at != null
      ? [{ description: i.description, t: new Date(i.completed_at).getTime() }]
      : [],
  )
  if (builtYear != null) {
    finished.push({
      description:
        scope.kind === "infrastructure"
          ? t("Established {{year}}", { year: builtYear })
          : t("Built {{year}}", { year: builtYear }),
      t: new Date(builtYear, 0, 1).getTime(),
    })
  }
  finished.sort((a, b) => b.t - a.t)
  const lastFinished = finished.length > 0 ? finished[0] : undefined

  const showTodos = view === "todos"
  const showHistory = view === "history"

  const todosLabel = isMobile
    ? t("Todos")
    : showTodos
      ? t("Hide todos")
      : t("Show todos")
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

  const todosToggle = (
    <Badge.Position placement="top-right">
      {openTodosCount > 0 && <Badge count={openTodosCount} />}
      <Button variant="tertiary" data-size="sm" onClick={toggleTodos}>
        {todosLabel}
      </Button>
    </Badge.Position>
  )

  const todosBlock = showTodos && !inspecting && (
    <Card.Block>
      <MaintenanceTodos scope={scope} />
    </Card.Block>
  )
  const historyBlock = showHistory && !inspecting && (
    <Card.Block>
      <MaintenanceHistory scope={scope} />
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
            {!inspecting && (
              <Button variant="tertiary" data-size="sm" onClick={toggleHistory}>
                <ClockDashedIcon aria-hidden fontSize="1.25rem" />
                {historyLabel}
              </Button>
            )}
          </Card.Block>
          {historyBlock}
          {!inspecting && (
            <Card.Block className={styles.mobileTodosRow} data-size="sm">
              {todosToggle}
              {lastFinished ? (
                <Paragraph className={styles.lastFinished} data-size="sm">
                  {t("Last completed: {{description}}", {
                    description: lastFinished.description,
                  })}
                </Paragraph>
              ) : (
                <Paragraph className={styles.lastFinishedEmpty} data-size="sm">
                  {t("No completed work yet")}
                </Paragraph>
              )}
            </Card.Block>
          )}
          {todosBlock}
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
          {!inspecting && <Divider className={styles.divider} />}
          {!inspecting && (
            <div className={styles.actions}>
              <Button variant="tertiary" data-size="sm" onClick={toggleTodos}>
                {todosLabel}
              </Button>
              <Button variant="tertiary" data-size="sm" onClick={toggleHistory}>
                <ClockDashedIcon aria-hidden fontSize="1.25rem" />
                {historyLabel}
              </Button>
            </div>
          )}
        </Card.Block>
        {todosBlock}
        {historyBlock}
        {inspectionBlock}
      </article>
    </Card>
  )
}

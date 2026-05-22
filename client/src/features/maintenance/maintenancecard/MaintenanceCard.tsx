import { useState } from "react"
import { Button, Card, Divider, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./MaintenanceCard.module.css"
import { InspectionFlow } from "@/features/maintenance/inspectionflow/InspectionFlow.tsx"
import { MaintenanceHistory } from "@/features/maintenance/maintenancecard/MaintenanceHistory.tsx"
import { MaintenanceTodos } from "@/features/maintenance/maintenancecard/MaintenanceTodos.tsx"
import { useIsMobile } from "@/hooks/useIsMobile.ts"

export type MaintenanceScope =
  | { kind: "structure"; id: number; name: string }
  | { kind: "infrastructure"; id: number; name: string }
  | { kind: "equipment"; id: number; name: string }

export function MaintenanceCard({ scope }: { scope: MaintenanceScope }) {
  const { t } = useTranslation("maintenance")
  const [view, setView] = useState<"none" | "todos" | "history">("none")
  const [inspecting, setInspecting] = useState(false)
  const isMobile = useIsMobile()

  const showTodos = view === "todos"
  const showHistory = view === "history"

  const todosLabel = isMobile
    ? t("Todos")
    : showTodos ? t("Hide todos") : t("Show todos")
  const historyLabel = isMobile
    ? t("History")
    : showHistory ? t("Hide history") : t("Show history")

  return (
    <Card asChild>
      <article>
        <Card.Block className={styles.row} data-size="sm">
          <Paragraph className={styles.name} data-size="sm">
            {scope.name}
          </Paragraph>
          {!inspecting && (
            <Button
              className={styles.inspect}
              variant="secondary"
              data-size="sm"
              onClick={() => { setInspecting(true) }}
            >
              {t("Start inspection")}
            </Button>
          )}
          {!inspecting && (
            <Divider className={styles.divider} />
          )}
          {!inspecting && (
            <div className={styles.actions}>
              <Button
                variant="tertiary"
                data-size="sm"
                onClick={() => { setView(v => v === "todos" ? "none" : "todos") }}
              >
                {todosLabel}
              </Button>
              <Button
                variant="tertiary"
                data-size="sm"
                onClick={() => { setView(v => v === "history" ? "none" : "history") }}
              >
                {historyLabel}
              </Button>
            </div>
          )}
        </Card.Block>
        {showTodos && !inspecting && (
          <Card.Block>
            <MaintenanceTodos scope={scope} />
          </Card.Block>
        )}
        {showHistory && !inspecting && (
          <Card.Block>
            <MaintenanceHistory scope={scope} />
          </Card.Block>
        )}
        {inspecting && (
          <Card.Block>
            <InspectionFlow
              scope={scope}
              open={inspecting}
              onClose={() => { setInspecting(false) }}
            />
          </Card.Block>
        )}
      </article>
    </Card>
  )
}

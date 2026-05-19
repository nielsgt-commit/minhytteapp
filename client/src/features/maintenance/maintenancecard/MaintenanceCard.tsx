import { useState } from "react"
import { Button, Card, Divider, Paragraph } from "@digdir/designsystemet-react"
import styles from "./MaintenanceCard.module.css"
import { InspectionFlow } from "@/features/maintenance/inspectionflow/InspectionFlow.tsx"
import { MaintenanceHistory } from "@/features/maintenance/maintenancecard/MaintenanceHistory.tsx"
import { MaintenanceTodos } from "@/features/maintenance/maintenancecard/MaintenanceTodos.tsx"
import { useIsMobile } from "@/hooks/useIsMobile.ts"

export type MaintenanceScope =
  | { kind: "structure"; id: number; name: string }
  | { kind: "infrastructure"; id: number; name: string }

export function MaintenanceCard({ scope }: { scope: MaintenanceScope }) {
  const [showHistory, setShowHistory] = useState(false)
  const [showTodos, setShowTodos] = useState(false)
  const [inspecting, setInspecting] = useState(false)
  const isMobile = useIsMobile()

  const todosLabel = isMobile
    ? "Todos"
    : showTodos ? "Hide todos" : "Show todos"
  const historyLabel = isMobile
    ? "History"
    : showHistory ? "Hide history" : "Show history"

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
              Start inspection
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
                onClick={() => { setShowTodos(v => !v) }}
              >
                {todosLabel}
              </Button>
              <Button
                variant="tertiary"
                data-size="sm"
                onClick={() => { setShowHistory(v => !v) }}
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

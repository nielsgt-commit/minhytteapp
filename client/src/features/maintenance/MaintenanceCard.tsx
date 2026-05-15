import { useState } from "react"
import { Button, Card, Paragraph } from "@digdir/designsystemet-react"
import styles from "./MaintenanceCard.module.css"
import { InspectionFlow } from "@/features/maintenance/InspectionFlow.tsx"
import { MaintenanceHistory } from "@/features/maintenance/MaintenanceHistory.tsx"
import { MaintenanceTodos } from "@/features/maintenance/MaintenanceTodos.tsx"

export type MaintenanceScope =
  | { kind: "building"; id: number; name: string }
  | { kind: "place"; id: number; name: string }

export function MaintenanceCard({ scope }: { scope: MaintenanceScope }) {
  const [showHistory, setShowHistory] = useState(false)
  const [showTodos, setShowTodos] = useState(false)
  const [inspecting, setInspecting] = useState(false)

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
            <div className={styles.actions}>
              <Button
                variant="tertiary"
                data-size="sm"
                onClick={() => { setShowTodos(v => !v) }}
              >
                {showTodos ? "Hide todos" : "Show todos"}
              </Button>
              <Button
                variant="tertiary"
                data-size="sm"
                onClick={() => { setShowHistory(v => !v) }}
              >
                {showHistory ? "Hide history" : "Show history"}
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

import { useState } from "react"
import { Button, Card, Heading } from "@digdir/designsystemet-react"
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
      <section>
        <Card.Block>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
            }}
          >
            <Heading level={4} data-size="xs">{scope.name}</Heading>
            {!inspecting && (
              <Button
                variant="secondary"
                data-size="sm"
                onClick={() => { setInspecting(true) }}
              >
                Start inspection
              </Button>
            )}
          </div>
        </Card.Block>
        {inspecting ? (
          <Card.Block>
            <InspectionFlow
              scope={scope}
              open={inspecting}
              onClose={() => { setInspecting(false) }}
            />
          </Card.Block>
        ) : (
          <>
            <Card.Block>
              <Button
                variant="tertiary"
                onClick={() => { setShowTodos(v => !v) }}
              >
                {showTodos ? "Hide todos" : "Show todos"}
              </Button>
              {showTodos && <MaintenanceTodos scope={scope} />}
            </Card.Block>
            <Card.Block>
              <Button
                variant="tertiary"
                onClick={() => { setShowHistory(v => !v) }}
              >
                {showHistory ? "Hide history" : "Show history"}
              </Button>
              {showHistory && <MaintenanceHistory scope={scope} />}
            </Card.Block>
          </>
        )}
      </section>
    </Card>
  )
}
